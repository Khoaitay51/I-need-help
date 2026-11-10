import csv
import json
import argparse
import logging
import random
import sys
import time
import os
import dotenv
import evaluate_benchmark as benchmark
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory


import numpy as np
from langchain_core.messages import HumanMessage
from langchain_ollama import OllamaEmbeddings

dotenv.load_dotenv()

ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "api"
SRC_DIR = API_DIR / "src"
for path in (API_DIR, SRC_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from src.graph_rag.graph_builder import DocumentGraph
from src.graph_rag.graph_retriever import GraphRoutedRetriever
from src.graph_rag.subgraph_partitioner import SubgraphPartitioner
from src.rag.table_aware_chunking import load_documents_from_folder
from src.llm.config import get_llm

THRESHOLD_VALUES = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
MAX_EDGES_VALUES = list(range(3, 11))
TOP_K_VALUES = list(range(5, 20))

POPULATION_SIZE = 12
GENERATIONS = 8
ELITE_SIZE = 2
MUTATION_RATE = 0.4
RANDOM_IMMIGRANTS = 5
RANDOM_SEED = 60
USE_LLM_EVAL = False
SEED_BEST_CONFIG = {
    "threshold": 0.3,
    "max_edges_per_node": 4,
    "top_k": 8,
}

RESULT_DIR = ROOT / "api" / "experiments" / "rag_ga_results"
RUN_DIR = None
DATASET_PATH = benchmark.BENCHMARK / "queries.jsonl"
DATA_FOLDER = benchmark.BENCHMARK / "data"
EMBEDDING_MODEL = "nomic-embed-text:latest"

RESULT_DIR.mkdir(parents=True, exist_ok=True)

GA_LOGGER_NAME = "ga_graph_rag"
logger = logging.getLogger(GA_LOGGER_NAME)


def setup_ga_logging(fitness_mode="hybrid"):
    log_suffix = "" if fitness_mode == "hybrid" else f"_{fitness_mode}"
    ga_log_file = RESULT_DIR / f"ga_tuning{log_suffix}_{time.strftime('%Y%m%d_%H%M%S')}.log"
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    logging.getLogger("src.graph_rag").setLevel(logging.WARNING)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if not any(getattr(handler, "_ga_console_handler", False) for handler in logger.handlers):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler._ga_console_handler = True
        console_handler.setFormatter(formatter)
        console_handler.setLevel(logging.INFO)
        logger.addHandler(console_handler)

    if not any(getattr(handler, "_ga_file_handler", False) for handler in logger.handlers):
        file_handler = logging.FileHandler(ga_log_file, encoding="utf-8")
        file_handler._ga_file_handler = True
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        logger.addHandler(file_handler)

    logger.info("[LOG_FILE] %s", ga_log_file)


def log_graph_stats(config, graph, partitioner, loaded_from_cache):
    logger.info(
        "[GRAPH_BUILD] config=%s source=%s total_nodes=%s total_edges=%s total_communities=%s",
        config,
        "cache" if loaded_from_cache else "built",
        graph.number_of_nodes(),
        graph.number_of_edges(),
        len(getattr(partitioner, "communities", {}) or {}),
    )


@dataclass
class Individual:
    chromosome: list
    fitness: float = None
    metrics: dict = None


def decode(chromosome):
    return {
        "threshold": THRESHOLD_VALUES[chromosome[0]],
        "max_edges_per_node": MAX_EDGES_VALUES[chromosome[1]],
        "top_k": TOP_K_VALUES[chromosome[2]],
    }


def random_chromosome():
    return [
        random.randrange(len(THRESHOLD_VALUES)),
        random.randrange(len(MAX_EDGES_VALUES)),
        random.randrange(len(TOP_K_VALUES)),
    ]


def encode_config(config):
    return [
        THRESHOLD_VALUES.index(config["threshold"]),
        MAX_EDGES_VALUES.index(config["max_edges_per_node"]),
        TOP_K_VALUES.index(config["top_k"]),
    ]


def init_population():
    population = [Individual(encode_config(SEED_BEST_CONFIG))]

    while len(population) < POPULATION_SIZE:
        population.append(Individual(random_chromosome()))

    return population


def tournament_select(population, size=3):
    candidates = random.sample(population, size)
    return max(candidates, key=lambda x: x.fitness)


def crossover(parent_a, parent_b):
    child = []
    for gene_a, gene_b in zip(parent_a.chromosome, parent_b.chromosome):
        child.append(gene_a if random.random() < 0.5 else gene_b)
    return Individual(child)


def mutate(individual):
    if random.random() >= MUTATION_RATE:
        return individual

    new_chromosome = individual.chromosome[:]  # clone
    gene_idx = random.randrange(3)
    max_indices = [
        len(THRESHOLD_VALUES) - 1,
        len(MAX_EDGES_VALUES) - 1,
        len(TOP_K_VALUES) - 1,
    ]

    current = new_chromosome[gene_idx]
    step = random.choice([-1, 1])
    new_chromosome[gene_idx] = max(0, min(max_indices[gene_idx], current + step))
    return Individual(new_chromosome)


def add_benchmark_arguments(parser):
    parser.add_argument("--limit", type=int, help="Use only the first N tuning queries for a smoke run")


def load_eval_dataset(limit=None, llm_eval=False):
    global RUN_DIR
    config, rows, files = benchmark.load_benchmark()
    dataset = config["dataset"]
    if llm_eval and dataset == "fiqa":
        raise SystemExit("FiQA uses qrels; omit --llm-eval.")
    if limit is not None and limit < 1:
        raise SystemExit("--limit must be positive.")
    rows = benchmark.select_queries(rows, "tune")[:limit]
    if not any(row["answerable"] for row in rows):
        raise SystemExit("The tuning sample needs at least one query with retrieval labels.")
    RUN_DIR = benchmark.graph_cache_dir(ROOT, dataset, files)
    print(f"Benchmark: {dataset}, split=tune, queries={len(rows)}")
    return rows


def load_rag_documents():
    return benchmark.load_corpus(load_documents_from_folder, sorted(DATA_FOLDER.rglob("*.md")))


def cosine_sim(a, b):
    a = np.array(a)
    b = np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)

    if denom == 0:
        return 0.0

    return float(np.dot(a, b) / denom)


def embed_text(text, embeddings, embedding_cache):
    if text not in embedding_cache:
        embedding_cache[text] = embeddings.embed_query(text)

    return embedding_cache[text]


def normalize_llm_content(value):
    import re
    def strip_thinking_content(text: str) -> str:
        return re.sub(r"<think(?:ing)?>[\s\S]*?(?:</think(?:ing)?>|$)", "", str(text), flags=re.IGNORECASE).strip()

    if value is None:
        return ""

    if isinstance(value, str):
        return strip_thinking_content(value)

    if isinstance(value, list):
        parts = []
        for item in value:
            text = normalize_llm_content(item)
            if text:
                parts.append(text)
        return "\n".join(parts).strip()

    if isinstance(value, dict):
        for key in ("text", "content", "answer", "output"):
            if key in value:
                text = normalize_llm_content(value[key])
                if text:
                    return text
        return json.dumps(value, ensure_ascii=False)

    return strip_thinking_content(str(value))


def extract_llm_text(response):
    if hasattr(response, "content"):
        return normalize_llm_content(response.content)

    return normalize_llm_content(response)


def get_llm_cache_key(llm):
    if llm is None:
        return None

    model_name = (
        getattr(llm, "model", None)
        or getattr(llm, "model_name", None)
        or getattr(llm, "model_id", None)
        or getattr(llm, "_llm_type", None)
        or "unknown"
    )
    return f"{type(llm).__name__}:{model_name}"


def score_generated_answer(generated_answer, expected_answer, embeddings, embedding_cache):
    generated_answer = normalize_llm_content(generated_answer)
    expected_answer = normalize_llm_content(expected_answer)

    if not expected_answer:
        return 0.0

    generated_embedding = embed_text(generated_answer, embeddings, embedding_cache)
    expected_embedding = embed_text(expected_answer, embeddings, embedding_cache)
    return cosine_sim(generated_embedding, expected_embedding)


def calculate_fitness(metrics, fitness_mode="hybrid"):
    latency_penalty = min(metrics["avg_retrieval_time_ms"] / 5000.0, 1.0) * 0.05
    graph_density_penalty = min(metrics["avg_degree"] / 50.0, 1.0) * 0.03

    if fitness_mode == "mrr":
        fitness = metrics["mrr"]

    elif fitness_mode == "map":
        fitness = metrics["map"]

    elif fitness_mode == "ndcg":
        fitness = metrics["ndcg"]

    elif "answer_cosine_similarity" in metrics:
        fitness = (
            0.55 * metrics["answer_cosine_similarity"]
            + 0.15 * metrics["ndcg"]
            + 0.15 * metrics["map"]
            + 0.15 * metrics["mrr"]
        )

    else:
        fitness = (
            0.34 * metrics["ndcg"]
            + 0.33 * metrics["map"]
            + 0.33 * metrics["mrr"]
        )

    return max(fitness, 0.0)

def get_shared_graph_retriever(cfg, documents, *, generate_summaries=True):
    graph_cache_dir = RUN_DIR / f"t{cfg['threshold']}_e{cfg['max_edges_per_node']}" / "document_graph"
    graph_cache_dir.mkdir(parents=True, exist_ok=True)
    graph_path = graph_cache_dir / "document_graph.pkl"

    graph_builder = DocumentGraph(
        semantic_threshold=cfg["threshold"],
        max_semantic_edges_per_node=cfg["max_edges_per_node"],
        embeddings_model=EMBEDDING_MODEL,
    )

    loaded_from_cache = graph_path.exists()
    if loaded_from_cache:
        graph_builder.load_graph(str(graph_path))
        partitioner = SubgraphPartitioner(graph_builder.graph)
        # Restore cached community summaries and centroids
        partitioner.community_summaries = getattr(graph_builder, 'community_summaries', {}) or {}
        partitioner.community_centroids = getattr(graph_builder, 'community_centroids', {}) or {}
        # Partition by community but skip LLM summary generation
        partitioner.partition_by_community_detection(generate_summaries=False)
    else:
        graph_builder.build_graph(documents, generate_summaries=generate_summaries)
        partitioner = SubgraphPartitioner(graph_builder.graph)
        # Build for first time: generate LLM summaries
        partitioner.partition_by_community_detection(generate_summaries=generate_summaries)
        # Save summaries and centroids to builder so they are serialized
        graph_builder.community_summaries = partitioner.community_summaries
        graph_builder.community_centroids = partitioner.community_centroids
        with TemporaryDirectory(dir=graph_cache_dir) as temporary:
            pending = Path(temporary) / graph_path.name
            graph_builder.save_graph(str(pending))
            pending.replace(graph_path)

    # Write community summaries to ga_tuning log
    logger.info("[COMMUNITY_SUMMARIES_START] Listing all generated community summaries:")
    for comm_id, summary in partitioner.community_summaries.items():
        logger.info("[COMMUNITY_SUMMARY] Community %s:\n%s", comm_id, summary)
    logger.info("[COMMUNITY_SUMMARIES_END]")

    partitioner.generate_centroids_from_embeddings()

    retriever = GraphRoutedRetriever(
        graph=graph_builder.graph,
        partitioner=partitioner,
        embeddings_model=EMBEDDING_MODEL,
        k=cfg["top_k"],
        internal_k=max(cfg["top_k"] * 3, 10),
        hop_depth=3,
        expansion_factor=2.5,
    )

    log_graph_stats(cfg, graph_builder.graph, partitioner, loaded_from_cache)
    return retriever, graph_builder.graph


def evaluate(individual, dataset, documents, embeddings, embedding_cache, llm=None, fitness_mode="hybrid"):
    cfg = decode(individual.chromosome)
    top_k = cfg["top_k"]
    search_cfg = {**cfg, "top_k": top_k * 3}
    retriever, graph = get_shared_graph_retriever(search_cfg, documents, generate_summaries=False)
    query_metrics = []
    retrieval_times = []
    answer_similarities = []

    for row in dataset:
        if not row["answerable"] and llm is None:
            continue
        start = time.perf_counter()
        chunks = retriever.invoke(row["question"])
        ranking = benchmark.ranked_sources(chunks, top_k)
        retrieval_times.append((time.perf_counter() - start) * 1000)
        if row["answerable"]:
            query_metrics.append(benchmark.retrieval_scores(ranking, row["gold"], top_k))
        if llm is not None:
            answer = benchmark.generate_answer(row["question"], chunks[:top_k], llm, HumanMessage, extract_llm_text)
            logger.info("[LLM_RESPONSE] config=%s question=%s response=%s", cfg, row["question"], answer)
            answer_similarities.append(score_generated_answer(answer, row["answer"], embeddings, embedding_cache))

    total_nodes = graph.number_of_nodes()
    total_edges = graph.number_of_edges()
    metrics = {
        "precision_at_k": float(np.mean([row[f"precision@{top_k}"] for row in query_metrics])),
        "map": float(np.mean([row[f"map@{top_k}"] for row in query_metrics])),
        "mrr": float(np.mean([row[f"mrr@{top_k}"] for row in query_metrics])),
        "ndcg": float(np.mean([row[f"ndcg@{top_k}"] for row in query_metrics])),
        "avg_retrieval_time_ms": float(np.mean(retrieval_times)),
        "avg_degree": 2 * total_edges / total_nodes if total_nodes else 0.0,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "total_communities": len(retriever.partitioner.communities),
    }
    if answer_similarities:
        metrics["answer_cosine_similarity"] = float(np.mean(answer_similarities))

    individual.fitness = calculate_fitness(metrics, fitness_mode=fitness_mode)
    individual.metrics = metrics
    return individual


def evaluate_with_cache(individual, dataset, documents, embeddings, embedding_cache, evaluation_cache, llm=None, fitness_mode="hybrid"):
    key = (tuple(individual.chromosome), get_llm_cache_key(llm), fitness_mode)

    if key in evaluation_cache:
        cached = evaluation_cache[key]
        individual.fitness = cached["fitness"]
        individual.metrics = cached["metrics"].copy()
        return individual

    evaluated = evaluate(
        individual,
        dataset,
        documents,
        embeddings,
        embedding_cache,
        llm=llm,
        fitness_mode=fitness_mode,
    )
    evaluation_cache[key] = {
        "fitness": evaluated.fitness,
        "metrics": evaluated.metrics.copy(),
    }
    return evaluated


def result_row_from_individual(individual, generation=0, individual_index=0, individual_id="baseline"):
    cfg = decode(individual.chromosome)
    return {
        "generation": generation,
        "individual_index": individual_index,
        "individual_id": individual_id,
        "chromosome": json.dumps(individual.chromosome),
        "threshold": cfg["threshold"],
        "max_edges_per_node": cfg["max_edges_per_node"],
        "top_k": cfg["top_k"],
        "fitness": round(individual.fitness, 4),
        "answer_cosine_similarity": round(
            individual.metrics.get("answer_cosine_similarity", 0.0),
            4,
        ),
        "map": round(individual.metrics["map"], 4),
        "mrr": round(individual.metrics["mrr"], 4),
        "ndcg": round(individual.metrics["ndcg"], 4),
        "avg_retrieval_time_ms": round(individual.metrics["avg_retrieval_time_ms"], 2),
        "avg_degree": round(individual.metrics["avg_degree"], 2),
        "total_nodes": individual.metrics.get("total_nodes", 0),
        "total_edges": individual.metrics["total_edges"],
        "total_communities": individual.metrics.get("total_communities", 0),
    }


def run_baseline(dataset, documents, embeddings, embedding_cache, llm=None, fitness_mode="hybrid"):
    baseline = Individual(chromosome=[
        THRESHOLD_VALUES.index(0.7),
        MAX_EDGES_VALUES.index(5),
        TOP_K_VALUES.index(10),
    ])

    evaluated = evaluate(
        baseline,
        dataset,
        documents,
        embeddings,
        embedding_cache,
        llm=llm,
        fitness_mode=fitness_mode,
    )

    result = result_row_from_individual(evaluated)
    baseline_suffix = "" if fitness_mode == "hybrid" else f"_{fitness_mode}"
    baseline_path = RESULT_DIR / f"baseline_config{baseline_suffix}.json"

    with open(baseline_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Baseline saved: {baseline_path}")
    print(f"Baseline result: {result}")
    return result


def save_wide_csv(all_rows, path):
    generations = sorted(set(row["generation"] for row in all_rows))
    ordered_rows = []

    for generation in generations:
        generation_rows = [
            row for row in all_rows
            if row["generation"] == generation
        ]
        generation_rows.sort(key=lambda x: x["individual_index"])
        ordered_rows.extend(generation_rows)

    header_generation = ["", "", ""]
    header_individual = ["No.", "Hyperparameter", "Range"]

    for row in ordered_rows:
        is_first_individual = row["individual_index"] == 0
        header_generation.append(f"Generation {row['generation'] + 1}" if is_first_individual else "")
        header_individual.append(f"Individual {row['individual_index'] + 1}")

    table = [
        header_generation,
        header_individual,
        [
            "1",
            "Semantic threshold",
            "[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]",
            *[row["threshold"] for row in ordered_rows],
        ],
        [
            "2",
            "Max edges per node",
            str(MAX_EDGES_VALUES),
            *[row["max_edges_per_node"] for row in ordered_rows],
        ],
        [
            "3",
            "Top K",
            str(TOP_K_VALUES),
            *[row["top_k"] for row in ordered_rows],
        ],
        [],
        [
            "Component fitness function",
            "Weights",
            "Function (metrics)",
            *["" for _ in ordered_rows],
        ],
        [
            "",
            "w0 = 0.55",
            "f0 (Answer cosine)",
            *[row.get("answer_cosine_similarity", 0.0) for row in ordered_rows],
        ],
        [
            "",
            "w1 = 0.15",
            "f1 (NDCG)",
            *[row["ndcg"] for row in ordered_rows],
        ],
        [
            "",
            "w2 = 0.15",
            "f2 (MAP)",
            *[row["map"] for row in ordered_rows],
        ],
        [
            "",
            "w3 = 0.10/0.15",
            "f3 (MRR)",
            *[row["mrr"] for row in ordered_rows],
        ],
        [
            "Global fitness function",
            "",
            "",
            *[row["fitness"] for row in ordered_rows],
        ],
        [
            "Retrieval time (ms)",
            "",
            "",
            *[row["avg_retrieval_time_ms"] for row in ordered_rows],
        ],
        [
            "Average graph degree",
            "",
            "",
            *[row["avg_degree"] for row in ordered_rows],
        ],
        [
            "Total nodes",
            "",
            "",
            *[row.get("total_nodes", 0) for row in ordered_rows],
        ],
        [
            "Total edges",
            "",
            "",
            *[row["total_edges"] for row in ordered_rows],
        ],
        [
            "Total communities",
            "",
            "",
            *[row.get("total_communities", 0) for row in ordered_rows],
        ],
    ]

    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(table)


def save_ranked_csv(all_rows, path):
    ranked_rows = sorted(
        all_rows,
        key=lambda row: row["fitness"],
        reverse=True,
    )

    fieldnames = [
        "rank",
        "generation",
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

        for rank, row in enumerate(ranked_rows, start=1):
            writer.writerow({
                "rank": rank,
                "generation": row["generation"] + 1,
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
    parser = argparse.ArgumentParser(description="GA tuning for KMA GraphRAG")
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Only evaluate the current baseline: threshold=0.7, max_edges=5, top_k=10",
    )
    parser.add_argument(
        "--llm-eval",
        action="store_true",
        help="Generate answers with the active LLM and log each LLM response during evaluation",
    )
    parser.add_argument(
        "--mrr",
        dest="fitness_mode",
        action="store_const",
        const="mrr",
        help="Use MRR as the GA fitness objective; MAP and NDCG are still calculated and exported.",
    )
    parser.add_argument(
        "--map",
        dest="fitness_mode",
        action="store_const",
        const="map",
        help="Use MAP as the GA fitness objective; MRR and NDCG are still calculated and exported.",
    )
    parser.add_argument(
        "--ndcg",
        dest="fitness_mode",
        action="store_const",
        const="ndcg",
        help="Use NDCG as the GA fitness objective; MRR and MAP are still calculated and exported.",
    )
    add_benchmark_arguments(parser)
    parser.set_defaults(fitness_mode="hybrid")
    args = parser.parse_args()
    setup_ga_logging(args.fitness_mode)

    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)

    print(f"Loading evaluation dataset from {DATASET_PATH}")
    dataset = load_eval_dataset(args.limit, USE_LLM_EVAL or args.llm_eval)
    print(f"Loaded {len(dataset)} evaluation questions")

    print(f"Loading RAG documents from {DATA_FOLDER}")
    documents = load_rag_documents()
    print(f"Loaded {len(documents)} document chunks")

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=os.getenv("OLLAMA_BASE_URL"))
    embedding_cache = {}
    evaluation_cache = {}
    llm = get_llm() if (USE_LLM_EVAL or args.llm_eval) else None
    logger.info(
        "[GA_START] generations=%s population=%s dataset_size=%s llm_eval=%s fitness_mode=%s",
        GENERATIONS,
        POPULATION_SIZE,
        len(dataset),
        llm is not None,
        args.fitness_mode,
    )

    population = init_population()

    if args.baseline:
        run_baseline(dataset, documents, embeddings, embedding_cache, llm=llm, fitness_mode=args.fitness_mode)
        return

    all_rows = []

    for generation in range(GENERATIONS):
        print(f"Evaluating generation {generation + 1}/{GENERATIONS}")
        evaluated = [
            evaluate_with_cache(
                ind,
                dataset,
                documents,
                embeddings,
                embedding_cache,
                evaluation_cache,
                llm=llm,
                fitness_mode=args.fitness_mode,
            )
            for ind in population
        ]
        evaluated.sort(key=lambda x: x.fitness, reverse=True)
        best_ind = evaluated[0]
        best_cfg = decode(best_ind.chromosome)
        logger.info(
            "[GENERATION] Gen %s/%s | Best Fitness: %.4f | Config: %s | Metrics: MAP=%.4f, MRR=%.4f, NDCG=%.4f",
            generation + 1,
            GENERATIONS,
            best_ind.fitness,
            best_cfg,
            best_ind.metrics["map"],
            best_ind.metrics["mrr"],
            best_ind.metrics["ndcg"],
        )

        for idx, ind in enumerate(evaluated):
            all_rows.append(
                result_row_from_individual(
                    ind,
                    generation=generation,
                    individual_index=idx,
                    individual_id=f"g{generation}_i{idx}",
                )
            )

        elites = evaluated[:ELITE_SIZE]
        children = []
        num_children = POPULATION_SIZE - ELITE_SIZE - RANDOM_IMMIGRANTS

        while len(children) < num_children:
            p1 = tournament_select(evaluated)
            p2 = tournament_select(evaluated)
            child = crossover(p1, p2)
            child = mutate(child)
            children.append(child)

        immigrants = [
            Individual(random_chromosome())
            for _ in range(RANDOM_IMMIGRANTS)
        ]
        population = elites + children + immigrants

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_suffix = "" if args.fitness_mode == "hybrid" else f"_{args.fitness_mode}"
    csv_path = RESULT_DIR / f"ga_run{output_suffix}_{timestamp}.csv"
    ranked_csv_path = RESULT_DIR / f"ga_run{output_suffix}_{timestamp}_ranked.csv"
    save_wide_csv(all_rows, csv_path)
    save_ranked_csv(all_rows, ranked_csv_path)

    best = max(all_rows, key=lambda x: x["fitness"])
    with open(RESULT_DIR / "best_config.json", "w", encoding="utf-8") as f:
        json.dump(best, f, indent=2, ensure_ascii=False)

    print(f"Saved CSV: {csv_path}")
    print(f"Saved ranked CSV: {ranked_csv_path}")
    print(f"Best config: {best}")


if __name__ == "__main__":
    main()