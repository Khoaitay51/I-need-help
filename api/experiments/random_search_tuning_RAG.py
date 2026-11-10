"""
Random Search tuning for KMA GraphRAG.

Reuses the exact evaluation pipeline of ga_tuning_RAG.py (graph cache, embedding cache,
global relevance threshold, IR metrics, fitness function) so GA, PSO, Random Search,
and Grid Search are compared fairly on the SAME search space, SAME fitness, and
SAME evaluation budget.

Default budget:
    POPULATION_SIZE x GENERATIONS (12 x 8 = 96 evaluations), grouped into
    8 rounds of 12 samples so convergence curves can be plotted directly against
    GA generations and PSO iterations. Uses a deterministic random seed (default:
    RANDOM_SEED from ga_tuning_RAG.py) and optionally seeds sample 0 with
    SEED_BEST_CONFIG (--no-seed-config to disable).
"""

import argparse
import csv
import json
import logging
import os
import random
import sys
import time
from itertools import product
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ga_tuning_RAG as ga  # noqa: E402
from ga_tuning_RAG import (  # noqa: E402
    Individual,
    decode,
    encode_config,
    evaluate_with_cache,
    load_eval_dataset,
    add_benchmark_arguments,
    load_rag_documents,
    result_row_from_individual,
    save_ranked_csv,
    save_wide_csv,
    get_llm,
    OllamaEmbeddings,
    EMBEDDING_MODEL,
    RANDOM_SEED,
    RESULT_DIR,
    SEED_BEST_CONFIG,
    THRESHOLD_VALUES,
    MAX_EDGES_VALUES,
    TOP_K_VALUES,
    USE_LLM_EVAL,
)

BATCH_SIZE = ga.POPULATION_SIZE
ROUNDS = ga.GENERATIONS

logger = ga.logger


def setup_random_search_logging(fitness_mode="hybrid"):
    suffix = "" if fitness_mode == "hybrid" else f"_{fitness_mode}"
    log_file = RESULT_DIR / f"random_search_tuning{suffix}_{time.strftime('%Y%m%d_%H%M%S')}.log"
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    logging.getLogger("src.graph_rag").setLevel(logging.WARNING)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if not any(getattr(h, "_rs_console_handler", False) for h in logger.handlers):
        console = logging.StreamHandler(sys.stdout)
        console._rs_console_handler = True
        console.setFormatter(formatter)
        console.setLevel(logging.INFO)
        logger.addHandler(console)

    if not any(getattr(h, "_rs_file_handler", False) for h in logger.handlers):
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler._rs_file_handler = True
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        logger.addHandler(file_handler)

    logger.info("[LOG_FILE] %s", log_file)


def sample_chromosomes(rng, total_samples, without_replacement=False, include_seed_config=False):
    all_chromosomes = [
        [t_idx, e_idx, k_idx]
        for t_idx in range(len(THRESHOLD_VALUES))
        for e_idx in range(len(MAX_EDGES_VALUES))
        for k_idx in range(len(TOP_K_VALUES))
    ]

    chromosomes = []
    if include_seed_config:
        seed_chr = encode_config(SEED_BEST_CONFIG)
        chromosomes.append(seed_chr)

    remaining = total_samples - len(chromosomes)
    if remaining <= 0:
        return chromosomes[:total_samples]

    if without_replacement:
        pool = [c for c in all_chromosomes if c not in chromosomes]
        chosen_indices = rng.choice(len(pool), size=min(remaining, len(pool)), replace=False)
        for idx in chosen_indices:
            chromosomes.append(pool[int(idx)])
    else:
        for _ in range(remaining):
            chromosomes.append([
                int(rng.integers(0, len(THRESHOLD_VALUES))),
                int(rng.integers(0, len(MAX_EDGES_VALUES))),
                int(rng.integers(0, len(TOP_K_VALUES))),
            ])

    return chromosomes


def save_convergence_csv(rows, path):
    fieldnames = [
        "round",
        "best_so_far_fitness",
        "round_best_fitness",
        "round_mean_fitness",
        "unique_configs_evaluated",
        "best_threshold",
        "best_max_edges_per_node",
        "best_top_k",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description="Random Search tuning for KMA GraphRAG")
    parser.add_argument("--llm-eval", action="store_true",
                        help="Generate answers with the active LLM during evaluation")
    parser.add_argument("--mrr", dest="fitness_mode", action="store_const", const="mrr")
    parser.add_argument("--map", dest="fitness_mode", action="store_const", const="map")
    parser.add_argument("--ndcg", dest="fitness_mode", action="store_const", const="ndcg")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE,
                        help="Number of samples per round (default matches GA POPULATION_SIZE=12)")
    parser.add_argument("--rounds", type=int, default=ROUNDS,
                        help="Number of rounds (default matches GA GENERATIONS=8)")
    parser.add_argument("--n-samples", type=int, default=None,
                        help="Total random samples (overrides --batch-size * --rounds if set)")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED,
                        help=f"Random seed for reproducibility (default: {RANDOM_SEED})")
    parser.add_argument("--unique", action="store_true",
                        help="Sample without replacement (all sampled configs are distinct)")
    parser.add_argument("--include-seed-config", action="store_true",
                        help="Include SEED_BEST_CONFIG as the first sample (like GA/PSO)")
    add_benchmark_arguments(parser)
    parser.set_defaults(fitness_mode="hybrid")
    args = parser.parse_args()

    setup_random_search_logging(args.fitness_mode)

    random.seed(args.seed)
    np.random.seed(args.seed)
    rng = np.random.default_rng(args.seed)

    total_samples = args.n_samples if args.n_samples is not None else (args.batch_size * args.rounds)
    batch_size = args.batch_size
    num_rounds = (total_samples + batch_size - 1) // batch_size

    dataset = load_eval_dataset(args.limit, USE_LLM_EVAL or args.llm_eval)
    print(f"Loaded {len(dataset)} evaluation questions")

    documents = load_rag_documents()
    print(f"Loaded {len(documents)} document chunks")

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=os.getenv("OLLAMA_BASE_URL"))
    embedding_cache = {}
    evaluation_cache = {}
    llm = get_llm() if (USE_LLM_EVAL or args.llm_eval) else None

    chromosomes = sample_chromosomes(
        rng,
        total_samples=total_samples,
        without_replacement=args.unique,
        include_seed_config=args.include_seed_config,
    )


    logger.info(
        "[RANDOM_SEARCH_START] total_samples=%s rounds=%s batch_size=%s unique=%s "
        "include_seed_config=%s dataset_size=%s llm_eval=%s fitness_mode=%s seed=%s",
        len(chromosomes), num_rounds, batch_size, args.unique,
        args.include_seed_config, len(dataset), llm is not None, args.fitness_mode, args.seed,
    )

    all_rows = []
    convergence_rows = []
    best_ind = None
    best_fit = -np.inf

    for r in range(num_rounds):
        start_idx = r * batch_size
        end_idx = min(start_idx + batch_size, len(chromosomes))
        batch_chromosomes = chromosomes[start_idx:end_idx]

        print(f"Evaluating round {r + 1}/{num_rounds} (samples {start_idx + 1}..{end_idx}/{len(chromosomes)})")

        round_fits = []
        for idx_in_round, chrom in enumerate(batch_chromosomes):
            ind = Individual(chrom)
            evaluated = evaluate_with_cache(
                ind,
                dataset,
                documents,
                embeddings,
                embedding_cache,
                evaluation_cache,
                llm=llm,
                fitness_mode=args.fitness_mode,
            )
            fit = evaluated.fitness
            round_fits.append(fit)

            if fit > best_fit:
                best_fit = fit
                best_ind = Individual(evaluated.chromosome[:], evaluated.fitness, evaluated.metrics.copy())

            row = result_row_from_individual(
                evaluated,
                generation=r,
                individual_index=idx_in_round,
                individual_id=f"r{r}_s{idx_in_round}",
            )
            all_rows.append(row)

        best_cfg = decode(best_ind.chromosome)
        convergence_rows.append({
            "round": r + 1,
            "best_so_far_fitness": round(float(best_fit), 4),
            "round_best_fitness": round(float(np.max(round_fits)), 4),
            "round_mean_fitness": round(float(np.mean(round_fits)), 4),
            "unique_configs_evaluated": len(evaluation_cache),
            "best_threshold": best_cfg["threshold"],
            "best_max_edges_per_node": best_cfg["max_edges_per_node"],
            "best_top_k": best_cfg["top_k"],
        })

        logger.info(
            "[ROUND] Round %s/%s | best_so_far=%.4f | round_best=%.4f | round_mean=%.4f | "
            "unique_evals=%s | best_cfg=%s | MAP=%.4f MRR=%.4f NDCG=%.4f",
            r + 1, num_rounds, best_fit, np.max(round_fits), np.mean(round_fits),
            len(evaluation_cache), best_cfg,
            best_ind.metrics["map"], best_ind.metrics["mrr"], best_ind.metrics["ndcg"],
        )

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    suffix = "" if args.fitness_mode == "hybrid" else f"_{args.fitness_mode}"
    wide_path = RESULT_DIR / f"random_search_run{suffix}_{timestamp}.csv"
    ranked_path = RESULT_DIR / f"random_search_run{suffix}_{timestamp}_ranked.csv"
    convergence_path = RESULT_DIR / f"random_search_run{suffix}_{timestamp}_convergence.csv"
    best_path = RESULT_DIR / f"random_search_best_config{suffix}.json"

    save_wide_csv(all_rows, wide_path)
    save_ranked_csv(all_rows, ranked_path)
    save_convergence_csv(convergence_rows, convergence_path)

    best = result_row_from_individual(best_ind, individual_id="random_search_best")
    best["optimizer"] = "RandomSearch"
    best["seed"] = args.seed
    best["unique_sampling"] = args.unique
    best["total_evaluations"] = len(chromosomes)
    best["unique_configs_evaluated"] = len(evaluation_cache)
    with open(best_path, "w", encoding="utf-8") as f:
        json.dump(best, f, indent=2, ensure_ascii=False)

    print(f"Saved wide CSV: {wide_path}")
    print(f"Saved ranked CSV: {ranked_path}")
    print(f"Saved convergence CSV: {convergence_path}")
    print(f"Best config: {best}")


if __name__ == "__main__":
    main()

