"""
PSO tuning for KMA GraphRAG.

Reuses the evaluation pipeline of ga_tuning_RAG.py (graph cache, embedding cache,
global relevance threshold, IR metrics, fitness function) so GA and PSO are
compared on the SAME search space, SAME fitness and SAME evaluation budget.

Encoding:
    Each particle lives in a continuous space over the *index* of each discrete
    hyperparameter list (THRESHOLD_VALUES, MAX_EDGES_VALUES, TOP_K_VALUES).
    Position is rounded to the nearest index before evaluation
    (continuous relaxation + rounding). Bounds are [-0.5, n-0.5) so every
    discrete value owns an equal-width interval (no boundary bias).

Algorithm:
    Global-best PSO with linearly decreasing inertia weight,
    velocity clamping, and absorbing walls (clip position, zero velocity).
"""

import argparse
import csv
import json
import logging
import os
import random
import sys
import time
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

# Same budget as GA by default (POPULATION_SIZE x GENERATIONS = 12 x 8)
SWARM_SIZE = ga.POPULATION_SIZE
ITERATIONS = ga.GENERATIONS

W_START = 0.9          # inertia at iteration 0
W_END = 0.4            # inertia at last iteration
C1 = 1.5               # cognitive coefficient (pbest)
C2 = 1.5               # social coefficient (gbest)
V_MAX_RATIO = 0.3      # |v| <= V_MAX_RATIO * (hi - lo) per dimension

DIM_SIZES = np.array(
    [len(THRESHOLD_VALUES), len(MAX_EDGES_VALUES), len(TOP_K_VALUES)],
    dtype=float,
)
LOWER = np.full(3, -0.5 + 1e-6)
UPPER = DIM_SIZES - 0.5 - 1e-6
V_MAX = V_MAX_RATIO * (UPPER - LOWER)

logger = ga.logger


def setup_pso_logging(fitness_mode="hybrid"):
    suffix = "" if fitness_mode == "hybrid" else f"_{fitness_mode}"
    log_file = RESULT_DIR / f"pso_tuning{suffix}_{time.strftime('%Y%m%d_%H%M%S')}.log"
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    logging.getLogger("src.graph_rag").setLevel(logging.WARNING)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    console.setLevel(logging.INFO)
    logger.addHandler(console)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)
    logger.addHandler(file_handler)

    logger.info("[LOG_FILE] %s", log_file)


def position_to_chromosome(position):
    idx = np.rint(position).astype(int)
    idx = np.clip(idx, 0, DIM_SIZES.astype(int) - 1)
    return idx.tolist()


def init_swarm(rng, swarm_size):
    positions = rng.uniform(LOWER, UPPER, size=(swarm_size, 3))
    # Seed particle 0 with the same known config as the GA (fair comparison)
    positions[0] = np.array(encode_config(SEED_BEST_CONFIG), dtype=float)
    velocities = rng.uniform(-V_MAX, V_MAX, size=(swarm_size, 3))
    return positions, velocities


def swarm_diversity(positions):
    """Mean Euclidean distance to swarm centroid, normalized by search-space diagonal."""
    centroid = positions.mean(axis=0)
    diag = np.linalg.norm(UPPER - LOWER)
    return float(np.mean(np.linalg.norm(positions - centroid, axis=1)) / diag)


def save_convergence_csv(rows, path):
    fieldnames = [
        "iteration",
        "inertia",
        "gbest_fitness",
        "iter_best_fitness",
        "iter_mean_fitness",
        "diversity",
        "unique_configs_evaluated",
        "gbest_threshold",
        "gbest_max_edges_per_node",
        "gbest_top_k",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def save_particles_csv(rows, path):
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description="PSO tuning for KMA GraphRAG")
    parser.add_argument("--llm-eval", action="store_true",
                        help="Generate answers with the active LLM during evaluation")
    parser.add_argument("--mrr", dest="fitness_mode", action="store_const", const="mrr")
    parser.add_argument("--map", dest="fitness_mode", action="store_const", const="map")
    parser.add_argument("--ndcg", dest="fitness_mode", action="store_const", const="ndcg")
    parser.add_argument("--swarm-size", type=int, default=SWARM_SIZE)
    parser.add_argument("--iterations", type=int, default=ITERATIONS)
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    add_benchmark_arguments(parser)
    parser.set_defaults(fitness_mode="hybrid")
    args = parser.parse_args()

    setup_pso_logging(args.fitness_mode)

    random.seed(args.seed)
    np.random.seed(args.seed)
    rng = np.random.default_rng(args.seed)

    dataset = load_eval_dataset(args.limit, USE_LLM_EVAL or args.llm_eval)
    print(f"Loaded {len(dataset)} evaluation questions")

    documents = load_rag_documents()
    print(f"Loaded {len(documents)} document chunks")

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=os.getenv("OLLAMA_BASE_URL"))
    embedding_cache = {}
    evaluation_cache = {}
    llm = get_llm() if (USE_LLM_EVAL or args.llm_eval) else None

    positions, velocities = init_swarm(rng, args.swarm_size)

    # Reuse the same global relevance threshold as GA (loaded from JSON if present)

    logger.info(
        "[PSO_START] iterations=%s swarm=%s dataset_size=%s llm_eval=%s fitness_mode=%s "
        "w=%.2f->%.2f c1=%.2f c2=%.2f vmax=%s seed=%s",
        args.iterations, args.swarm_size, len(dataset), llm is not None,
        args.fitness_mode, W_START, W_END, C1, C2, V_MAX.round(3).tolist(), args.seed,
    )

    def evaluate_position(position):
        ind = Individual(position_to_chromosome(position))
        return evaluate_with_cache(
            ind, dataset, documents, embeddings, embedding_cache, evaluation_cache,
            llm=llm, fitness_mode=args.fitness_mode,
        )

    pbest_pos = positions.copy()
    pbest_fit = np.full(args.swarm_size, -np.inf)
    gbest_pos = positions[0].copy()
    gbest_fit = -np.inf
    gbest_ind = None

    all_rows = []
    particle_rows = []
    convergence_rows = []

    for it in range(args.iterations):
        inertia = W_START - (W_START - W_END) * it / max(args.iterations - 1, 1)
        print(f"Evaluating iteration {it + 1}/{args.iterations} (w={inertia:.3f})")

        iter_fits = []
        for i in range(args.swarm_size):
            ind = evaluate_position(positions[i])
            fit = ind.fitness
            iter_fits.append(fit)

            if fit > pbest_fit[i]:
                pbest_fit[i] = fit
                pbest_pos[i] = positions[i].copy()
            if fit > gbest_fit:
                gbest_fit = fit
                gbest_pos = positions[i].copy()
                gbest_ind = Individual(ind.chromosome[:], ind.fitness, ind.metrics.copy())

            row = result_row_from_individual(
                ind, generation=it, individual_index=i, individual_id=f"it{it}_p{i}",
            )
            all_rows.append(row)
            particle_rows.append({
                "iteration": it + 1,
                "particle": i,
                "pos_threshold_idx": round(float(positions[i][0]), 4),
                "pos_max_edges_idx": round(float(positions[i][1]), 4),
                "pos_top_k_idx": round(float(positions[i][2]), 4),
                "vel_threshold": round(float(velocities[i][0]), 4),
                "vel_max_edges": round(float(velocities[i][1]), 4),
                "vel_top_k": round(float(velocities[i][2]), 4),
                **{k: v for k, v in row.items()
                   if k not in ("generation", "individual_index", "individual_id")},
            })

        gbest_cfg = decode(gbest_ind.chromosome)
        diversity = swarm_diversity(positions)
        convergence_rows.append({
            "iteration": it + 1,
            "inertia": round(inertia, 4),
            "gbest_fitness": round(float(gbest_fit), 4),
            "iter_best_fitness": round(float(np.max(iter_fits)), 4),
            "iter_mean_fitness": round(float(np.mean(iter_fits)), 4),
            "diversity": round(diversity, 4),
            "unique_configs_evaluated": len(evaluation_cache),
            "gbest_threshold": gbest_cfg["threshold"],
            "gbest_max_edges_per_node": gbest_cfg["max_edges_per_node"],
            "gbest_top_k": gbest_cfg["top_k"],
        })
        logger.info(
            "[ITERATION] It %s/%s | gbest=%.4f | iter_best=%.4f | iter_mean=%.4f | "
            "diversity=%.4f | unique_evals=%s | gbest_cfg=%s | MAP=%.4f MRR=%.4f NDCG=%.4f",
            it + 1, args.iterations, gbest_fit, np.max(iter_fits), np.mean(iter_fits),
            diversity, len(evaluation_cache), gbest_cfg,
            gbest_ind.metrics["map"], gbest_ind.metrics["mrr"], gbest_ind.metrics["ndcg"],
        )

        # Skip the update after the final evaluation round
        if it == args.iterations - 1:
            break

        r1 = rng.random((args.swarm_size, 3))
        r2 = rng.random((args.swarm_size, 3))
        velocities = (
            inertia * velocities
            + C1 * r1 * (pbest_pos - positions)
            + C2 * r2 * (gbest_pos - positions)
        )
        velocities = np.clip(velocities, -V_MAX, V_MAX)
        positions = positions + velocities

        # Absorbing walls: clip position and zero the out-of-bound velocity component
        out_of_bounds = (positions < LOWER) | (positions > UPPER)
        velocities[out_of_bounds] = 0.0
        positions = np.clip(positions, LOWER, UPPER)

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    suffix = "" if args.fitness_mode == "hybrid" else f"_{args.fitness_mode}"
    ranked_path = RESULT_DIR / f"pso_run{suffix}_{timestamp}_ranked.csv"
    particles_path = RESULT_DIR / f"pso_run{suffix}_{timestamp}_particles.csv"
    convergence_path = RESULT_DIR / f"pso_run{suffix}_{timestamp}_convergence.csv"
    best_path = RESULT_DIR / f"pso_best_config{suffix}.json"

    save_ranked_csv(all_rows, ranked_path)
    save_particles_csv(particle_rows, particles_path)
    save_convergence_csv(convergence_rows, convergence_path)

    best = result_row_from_individual(gbest_ind, individual_id="pso_gbest")
    best["optimizer"] = "PSO"
    best["seed"] = args.seed
    best["total_evaluations"] = args.swarm_size * args.iterations
    best["unique_configs_evaluated"] = len(evaluation_cache)
    with open(best_path, "w", encoding="utf-8") as f:
        json.dump(best, f, indent=2, ensure_ascii=False)

    print(f"Saved ranked CSV: {ranked_path}")
    print(f"Saved particles CSV: {particles_path}")
    print(f"Saved convergence CSV: {convergence_path}")
    print(f"Best config: {best}")


if __name__ == "__main__":
    main()
