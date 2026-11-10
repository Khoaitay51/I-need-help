"""
Grid Search tuning for KMA GraphRAG.

Exhaustively (or on a specified sub-grid) evaluates combinations of
(threshold, max_edges_per_node, top_k) using the exact same evaluation pipeline
as ga_tuning_RAG.py (shared graph cache, embedding cache, global relevance
threshold, IR metrics, and fitness function).

Note on efficiency:
    The outer loops iterate over (threshold, max_edges_per_node) and the inner
    loop iterates over top_k. Because the document graph only depends on
    (threshold, max_edges_per_node), all top_k values for a given graph pair
    reuse the same cached graph on disk.
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
    evaluate_with_cache,
     load_eval_dataset,
    add_benchmark_arguments,
    load_rag_documents,
    result_row_from_individual,
    save_ranked_csv,
    get_llm,
    OllamaEmbeddings,
    EMBEDDING_MODEL,
    RANDOM_SEED,
    RESULT_DIR,
    THRESHOLD_VALUES,
    MAX_EDGES_VALUES,
    TOP_K_VALUES,
    USE_LLM_EVAL,
)

logger = ga.logger


def setup_grid_search_logging(fitness_mode="hybrid"):
    suffix = "" if fitness_mode == "hybrid" else f"_{fitness_mode}"
    log_file = RESULT_DIR / f"grid_search_tuning{suffix}_{time.strftime('%Y%m%d_%H%M%S')}.log"
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    logging.getLogger("src.graph_rag").setLevel(logging.WARNING)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if not any(getattr(h, "_gs_console_handler", False) for h in logger.handlers):
        console = logging.StreamHandler(sys.stdout)
        console._gs_console_handler = True
        console.setFormatter(formatter)
        console.setLevel(logging.INFO)
        logger.addHandler(console)

    if not any(getattr(h, "_gs_file_handler", False) for h in logger.handlers):
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler._gs_file_handler = True
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        logger.addHandler(file_handler)

    logger.info("[LOG_FILE] %s", log_file)


def parse_subgrid(values_str, allowed_values, cast_fn):
    if not values_str:
        return list(range(len(allowed_values)))
    indices = []
    for part in values_str.split(","):
        val = cast_fn(part.strip())
        if val not in allowed_values:
            raise ValueError(f"Value {val} is not in allowed search space {allowed_values}")
        indices.append(allowed_values.index(val))
    return indices


def save_grid_csv(rows, path):
    if not rows:
        return
    fieldnames = [
        "grid_index",
        "individual_id",
        "threshold",
        "max_edges_per_node",
        "top_k",
        "fitness",
        "answer_cosine_similarity",
        "ndcg",
        "map",
        "mrr",
        "avg_retrieval_time_ms",
        "avg_degree",
        "total_nodes",
        "total_edges",
        "total_communities",
        "chromosome",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for idx, row in enumerate(rows, start=1):
            writer.writerow({
                "grid_index": idx,
                "individual_id": row["individual_id"],
                "threshold": row["threshold"],
                "max_edges_per_node": row["max_edges_per_node"],
                "top_k": row["top_k"],
                "fitness": row["fitness"],
                "answer_cosine_similarity": row.get("answer_cosine_similarity", 0.0),
                "ndcg": row["ndcg"],
                "map": row["map"],
                "mrr": row["mrr"],
                "avg_retrieval_time_ms": row["avg_retrieval_time_ms"],
                "avg_degree": row["avg_degree"],
                "total_nodes": row.get("total_nodes", 0),
                "total_edges": row["total_edges"],
                "total_communities": row.get("total_communities", 0),
                "chromosome": row["chromosome"],
            })


def main():
    parser = argparse.ArgumentParser(description="Grid Search tuning for KMA GraphRAG")
    parser.add_argument("--llm-eval", action="store_true",
                        help="Generate answers with the active LLM during evaluation")
    parser.add_argument("--mrr", dest="fitness_mode", action="store_const", const="mrr")
    parser.add_argument("--map", dest="fitness_mode", action="store_const", const="map")
    parser.add_argument("--ndcg", dest="fitness_mode", action="store_const", const="ndcg")
    parser.add_argument("--thresholds", type=str, default=None,
                        help="Optional comma-separated subset of thresholds, e.g. '0.3,0.5,0.7,0.9'")
    parser.add_argument("--max-edges", type=str, default=None,
                        help="Optional comma-separated subset of max_edges_per_node, e.g. '3,5,7,9'")
    parser.add_argument("--top-ks", type=str, default=None,
                        help="Optional comma-separated subset of top_k, e.g. '5,8,10,12,15,18'")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED,
                        help=f"Random seed for deterministic graph behavior (default: {RANDOM_SEED})")
    add_benchmark_arguments(parser)
    parser.set_defaults(fitness_mode="hybrid")
    args = parser.parse_args()

    setup_grid_search_logging(args.fitness_mode)

    random.seed(args.seed)
    np.random.seed(args.seed)

    t_indices = parse_subgrid(args.thresholds, THRESHOLD_VALUES, float)
    e_indices = parse_subgrid(args.max_edges, MAX_EDGES_VALUES, int)
    k_indices = parse_subgrid(args.top_ks, TOP_K_VALUES, int)

    grid_chromosomes = [
        [t_idx, e_idx, k_idx]
        for t_idx, e_idx, k_idx in product(t_indices, e_indices, k_indices)
    ]
    total_configs = len(grid_chromosomes)

    dataset = load_eval_dataset(args.limit, USE_LLM_EVAL or args.llm_eval)
    print(f"Loaded {len(dataset)} evaluation questions")

    documents = load_rag_documents()
    print(f"Loaded {len(documents)} document chunks")

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=os.getenv("OLLAMA_BASE_URL"))
    embedding_cache = {}
    evaluation_cache = {}
    llm = get_llm() if (USE_LLM_EVAL or args.llm_eval) else None


    logger.info(
        "[GRID_SEARCH_START] total_configs=%s thresholds=%s max_edges=%s top_ks=%s "
        "dataset_size=%s llm_eval=%s fitness_mode=%s seed=%s",
        total_configs,
        [THRESHOLD_VALUES[i] for i in t_indices],
        [MAX_EDGES_VALUES[i] for i in e_indices],
        [TOP_K_VALUES[i] for i in k_indices],
        len(dataset),
        llm is not None,
        args.fitness_mode,
        args.seed,
    )

    all_rows = []
    best_ind = None
    best_fit = -np.inf
    start_time = time.time()

    for idx, chrom in enumerate(grid_chromosomes):
        cfg = decode(chrom)
        print(
            f"[{idx + 1}/{total_configs}] Evaluating config: "
            f"threshold={cfg['threshold']}, max_edges={cfg['max_edges_per_node']}, top_k={cfg['top_k']}"
        )
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

        if evaluated.fitness > best_fit:
            best_fit = evaluated.fitness
            best_ind = Individual(evaluated.chromosome[:], evaluated.fitness, evaluated.metrics.copy())

        row = result_row_from_individual(
            evaluated,
            generation=0,
            individual_index=idx,
            individual_id=f"grid_{idx}",
        )
        all_rows.append(row)

        best_cfg = decode(best_ind.chromosome)
        logger.info(
            "[GRID_STEP] %s/%s | cfg=%s | fit=%.4f (MAP=%.4f MRR=%.4f NDCG=%.4f) | "
            "best_so_far=%.4f best_cfg=%s",
            idx + 1,
            total_configs,
            cfg,
            evaluated.fitness,
            evaluated.metrics["map"],
            evaluated.metrics["mrr"],
            evaluated.metrics["ndcg"],
            best_fit,
            best_cfg,
        )

    elapsed_sec = round(time.time() - start_time, 2)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    suffix = "" if args.fitness_mode == "hybrid" else f"_{args.fitness_mode}"
    grid_csv_path = RESULT_DIR / f"grid_search_run{suffix}_{timestamp}.csv"
    ranked_path = RESULT_DIR / f"grid_search_run{suffix}_{timestamp}_ranked.csv"
    best_path = RESULT_DIR / f"grid_search_best_config{suffix}.json"

    save_grid_csv(all_rows, grid_csv_path)
    save_ranked_csv(all_rows, ranked_path)

    best = result_row_from_individual(best_ind, individual_id="grid_search_best")
    best["optimizer"] = "GridSearch"
    best["seed"] = args.seed
    best["total_evaluations"] = total_configs
    best["unique_configs_evaluated"] = len(evaluation_cache)
    best["elapsed_seconds"] = elapsed_sec
    with open(best_path, "w", encoding="utf-8") as f:
        json.dump(best, f, indent=2, ensure_ascii=False)

    print(f"Saved grid CSV: {grid_csv_path}")
    print(f"Saved ranked CSV: {ranked_path}")
    print(f"Best config: {best}")


if __name__ == "__main__":
    main()

