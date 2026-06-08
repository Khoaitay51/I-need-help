import csv
import json
import math
import argparse
import logging
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from langchain_core.messages import HumanMessage
from langchain_ollama import OllamaEmbeddings

ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "api"
SRC_DIR = API_DIR / "src"
for path in (API_DIR, SRC_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from src.graph_rag.department_graph_manager import DepartmentGraphManager
from src.rag.table_aware_chunking import load_documents_from_folder
from llm.config import get_llm

THRESHOLD_VALUES = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
MAX_EDGES_VALUES = list(range(3, 11))
TOP_K_VALUES = list(range(3, 11))

POPULATION_SIZE = 24
GENERATIONS = 12
ELITE_SIZE = 2
MUTATION_RATE = 0.2
RANDOM_SEED = 42
GRAPH_CACHE_NAMESPACE = "rag_ga_runs_deterministic_v1"
USE_LLM_EVAL = False
MAX_EVAL_QUESTIONS = None
SEED_BEST_CONFIG = {
    "threshold": 0.3,
    "max_edges_per_node": 6,
    "top_k": 6,
}

RESULT_DIR = ROOT / "api" / "experiments" / "rag_ga_results"
RUN_DIR = ROOT / "api" / "experiments" / GRAPH_CACHE_NAMESPACE
DATASET_PATH = ROOT / "dataset chatbot update.csv"
DATA_FOLDER = ROOT / "api" / "data"
EMBEDDING_MODEL = "nomic-embed-text:latest"
SIMILARITY_THRESHOLD = 0.65

RESULT_DIR.mkdir(parents=True, exist_ok=True) 
RUN_DIR.mkdir(parents=True, exist_ok=True)

GA_LOGGER_NAME = "ga_graph_rag"
logger = logging.getLogger(GA_LOGGER_NAME)


def setup_ga_logging():
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if any(getattr(handler, "_ga_console_handler", False) for handler in logger.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler._ga_console_handler = True
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logger.addHandler(handler)


def summarize_doc(doc, rank):
    metadata = getattr(doc, "metadata", {}) or {}
    content = " ".join(getattr(doc, "page_content", str(doc)).split())
    source = (
        metadata.get("source_path")
        or metadata.get("full_path")
        or metadata.get("source")
        or metadata.get("filename")
        or "unknown"
    )

    return {
        "rank": rank,
        "source": str(source),
        "department": metadata.get("query_department") or metadata.get("department", ""),
        "chunk_index": metadata.get("chunk_index", ""),
        "score": metadata.get("relevance_score", ""),
        "preview": content[:240],
    }


def log_graph_stats(config, manager, loaded_from_cache):
    stats = manager.get_department_stats()
    total_nodes = sum(stat.get("nodes", 0) for stat in stats.values())
    total_edges = sum(stat.get("edges", 0) for stat in stats.values())
    total_communities = sum(stat.get("communities", 0) for stat in stats.values())

    logger.info(
        "[GRAPH_BUILD] config=%s source=%s total_nodes=%s total_edges=%s total_communities=%s",
        config,
        "cache" if loaded_from_cache else "built",
        total_nodes,
        total_edges,
        total_communities,
    )

    for dept, stat in stats.items():
        logger.info(
            "[GRAPH_BUILD][%s] nodes=%s edges=%s communities=%s available=%s",
            dept,
            stat.get("nodes", 0),
            stat.get("edges", 0),
            stat.get("communities", 0),
            stat.get("available", False),
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

    gene_idx = random.randrange(3)
    max_indices = [
        len(THRESHOLD_VALUES) - 1,
        len(MAX_EDGES_VALUES) - 1,
        len(TOP_K_VALUES) - 1,
    ]

    current = individual.chromosome[gene_idx]
    step = random.choice([-1, 1])
    individual.chromosome[gene_idx] = max(0, min(max_indices[gene_idx], current + step))
    return individual


def load_eval_dataset():
    dataset = []

    with open(DATASET_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            question = row.get("question", "").strip()
            answer_expected = row.get("answer_expected", "").strip()

            if question and answer_expected:
                dataset.append({
                    "question": question,
                    "answer_expected": answer_expected,
                })

    return dataset


def load_rag_documents():
    return load_documents_from_folder(
        data_folder=str(DATA_FOLDER),
        chunk_size=800,
        chunk_overlap=200,
    )


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


def score_retrieved_docs(retrieved_docs, expected_answer, embeddings, embedding_cache, top_k):
    expected_embedding = embed_text(expected_answer, embeddings, embedding_cache)
    relevance = []

    for doc in retrieved_docs[:top_k]:
        doc_embedding = embed_text(doc.page_content, embeddings, embedding_cache)
        sim = cosine_sim(doc_embedding, expected_embedding)
        relevance.append(1 if sim >= SIMILARITY_THRESHOLD else 0)

    relevant_count = sum(relevance)
    precision_at_k = relevant_count / top_k if top_k else 0.0

    recall_at_k = 1.0 if relevant_count > 0 else 0.0

    mrr = 0.0
    for idx, is_relevant in enumerate(relevance):
        if is_relevant:
            mrr = 1.0 / (idx + 1)
            break

    average_precision = 0.0
    found = 0
    for idx, is_relevant in enumerate(relevance):
        if is_relevant:
            found += 1
            average_precision += found / (idx + 1)
    map_score = average_precision / relevant_count if relevant_count else 0.0

    dcg = 0.0
    for idx, is_relevant in enumerate(relevance):
        if is_relevant:
            dcg += 1.0 / math.log2(idx + 2)

    idcg = 0.0
    for idx in range(relevant_count):
        idcg += 1.0 / math.log2(idx + 2)
    ndcg = dcg / idcg if idcg else 0.0

    return {
        "precision_at_k": precision_at_k,
        "recall_at_k": recall_at_k,
        "map": map_score,
        "mrr": mrr,
        "ndcg": ndcg,
    }


def extract_llm_text(response):
    if hasattr(response, "content"):
        return response.content

    if isinstance(response, str):
        return response

    return str(response)


def generate_answer_with_llm(question, retrieved_docs, llm, config=None):
    context = "\n\n".join(
        f"[Chunk {idx + 1}]\n{doc.page_content}"
        for idx, doc in enumerate(retrieved_docs)
    )

    prompt = f"""
Bạn là trợ lý tư vấn quy định của Học viện Kỹ thuật mật mã.

Chỉ sử dụng ngữ cảnh được cung cấp để trả lời.
Nếu ngữ cảnh không đủ thông tin, hãy nói rằng không tìm thấy đủ thông tin trong tài liệu.

Ngữ cảnh:
{context}

Câu hỏi:
{question}

Trả lời ngắn gọn, đúng trọng tâm:
""".strip()

    response = llm.invoke([HumanMessage(content=prompt)])
    answer = extract_llm_text(response)
    logger.info(
        "[LLM_RESPONSE] config=%s question=%s response=%s",
        config,
        question,
        " ".join(answer.split()),
    )
    return answer


def score_generated_answer(generated_answer, expected_answer, embeddings, embedding_cache):
    generated_embedding = embed_text(generated_answer, embeddings, embedding_cache)
    expected_embedding = embed_text(expected_answer, embeddings, embedding_cache)
    return cosine_sim(generated_embedding, expected_embedding)


def calculate_fitness(metrics):
    latency_penalty = min(metrics["avg_retrieval_time_ms"] / 5000, 1.0) * 0.05
    graph_density_penalty = min(metrics["avg_degree"] / 50, 1.0) * 0.03

    if "answer_cosine_similarity" in metrics:
        return (
            0.45 * metrics["answer_cosine_similarity"]
            + 0.20 * metrics["ndcg"]
            + 0.15 * metrics["map"]
            + 0.10 * metrics["mrr"]
            + 0.05 * metrics["precision_at_k"]
            + 0.05 * metrics["recall_at_k"]
            - latency_penalty
            - graph_density_penalty
        )

    return (
        0.35 * metrics["ndcg"]
        + 0.25 * metrics["map"]
        + 0.20 * metrics["mrr"]
        + 0.15 * metrics["precision_at_k"]
        + 0.05 * metrics["recall_at_k"]
        - latency_penalty
        - graph_density_penalty
    )


def deduplicate_docs(docs):
    unique_docs = []
    seen = set()

    for doc in docs:
        content = getattr(doc, "page_content", "")
        if not content or content in seen:
            continue

        seen.add(content)
        unique_docs.append(doc)

    return unique_docs


def retrieve_for_evaluation(manager, question, top_k, config=None):
    if not manager.department_retrievers:
        manager.load_existing_graphs()

    preferred_departments = []

    try:
        decision = manager.detect_department_smart(
            question,
            user_metadata={"role": "admin"},
        )
        preferred_departments.append(decision.chosen_department)

        for signal in getattr(decision, "signals", []):
            if signal.department not in preferred_departments:
                preferred_departments.append(signal.department)
    except Exception:
        preferred_departments = []

    candidate_departments = [
        dept for dept in preferred_departments
        if dept in manager.department_retrievers
    ]

    for dept in manager.department_retrievers:
        if dept not in candidate_departments:
            candidate_departments.append(dept)

    retrieved_docs = []
    for dept in candidate_departments:
        retriever = manager.department_retrievers[dept]

        try:
            dept_docs = retriever._get_relevant_documents(question)
        except Exception:
            continue

        for doc in dept_docs:
            if hasattr(doc, "metadata"):
                doc.metadata["query_department"] = dept

        retrieved_docs.extend(dept_docs)

        if len(deduplicate_docs(retrieved_docs)) >= top_k:
            break

    top_docs = deduplicate_docs(retrieved_docs)[:top_k]
    top_doc_summaries = [
        summarize_doc(doc, rank)
        for rank, doc in enumerate(top_docs, start=1)
    ]

    logger.info(
        "[RETRIEVE] config=%s top_k=%s question=%s departments=%s returned=%s",
        config,
        top_k,
        question,
        candidate_departments,
        len(top_docs),
    )
    for summary in top_doc_summaries:
        logger.info("[RETRIEVE][TOP_%s] %s", summary["rank"], summary)

    return top_docs


def evaluate(individual, dataset, documents, embeddings, embedding_cache, llm=None):
    cfg = decode(individual.chromosome)
    graph_cache_dir = (
        RUN_DIR
        / f"t{cfg['threshold']}_e{cfg['max_edges_per_node']}"
        / "department_graphs"
    )

    manager = DepartmentGraphManager(
        base_output_dir=str(graph_cache_dir),
        semantic_threshold=cfg["threshold"],
        max_edges_per_node=cfg["max_edges_per_node"],
        retriever_top_k=cfg["top_k"],
        retriever_internal_k=max(cfg["top_k"] * 3, 10),
    )

    loaded_from_cache = manager.load_existing_graphs()
    if not loaded_from_cache:
        manager.build_department_graphs(documents)
    log_graph_stats(cfg, manager, loaded_from_cache)

    query_metrics = []
    retrieval_times = []
    answer_similarities = []

    for item in dataset:
        start = time.time()
        retrieved_docs = retrieve_for_evaluation(
            manager,
            item["question"],
            cfg["top_k"],
            config=cfg,
        )
        retrieval_times.append((time.time() - start) * 1000)

        docs_only = [
            doc for doc in retrieved_docs
            if hasattr(doc, "page_content")
        ]

        query_metrics.append(
            score_retrieved_docs(
                docs_only,
                item["answer_expected"],
                embeddings,
                embedding_cache,
                cfg["top_k"],
            )
        )

        if llm is not None:
            generated_answer = generate_answer_with_llm(
                item["question"],
                docs_only,
                llm,
                config=cfg,
            )
            answer_similarities.append(
                score_generated_answer(
                    generated_answer,
                    item["answer_expected"],
                    embeddings,
                    embedding_cache,
                )
            )

    stats = manager.get_department_stats()
    total_nodes = sum(stat.get("nodes", 0) for stat in stats.values())
    total_edges = sum(stat.get("edges", 0) for stat in stats.values())
    avg_degree = (2 * total_edges / total_nodes) if total_nodes else 0.0

    metrics = {
        "precision_at_k": float(np.mean([m["precision_at_k"] for m in query_metrics])),
        "recall_at_k": float(np.mean([m["recall_at_k"] for m in query_metrics])),
        "map": float(np.mean([m["map"] for m in query_metrics])),
        "mrr": float(np.mean([m["mrr"] for m in query_metrics])),
        "ndcg": float(np.mean([m["ndcg"] for m in query_metrics])),
        "avg_retrieval_time_ms": float(np.mean(retrieval_times)) if retrieval_times else 0.0,
        "avg_degree": avg_degree,
        "total_edges": total_edges,
    }

    if answer_similarities:
        metrics["answer_cosine_similarity"] = float(np.mean(answer_similarities))

    individual.fitness = calculate_fitness(metrics)
    individual.metrics = metrics
    return individual


def evaluate_with_cache(individual, dataset, documents, embeddings, embedding_cache, evaluation_cache, llm=None):
    key = (tuple(individual.chromosome), bool(llm))

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
        "precision_at_k": round(individual.metrics["precision_at_k"], 4),
        "recall_at_k": round(individual.metrics["recall_at_k"], 4),
        "map": round(individual.metrics["map"], 4),
        "mrr": round(individual.metrics["mrr"], 4),
        "ndcg": round(individual.metrics["ndcg"], 4),
        "avg_retrieval_time_ms": round(individual.metrics["avg_retrieval_time_ms"], 2),
        "avg_degree": round(individual.metrics["avg_degree"], 2),
        "total_edges": individual.metrics["total_edges"],
    }


def run_baseline(dataset, documents, embeddings, embedding_cache, llm=None):
    baseline = Individual(chromosome=[
        THRESHOLD_VALUES.index(0.7),
        MAX_EDGES_VALUES.index(7),
        TOP_K_VALUES.index(10),
    ])

    evaluated = evaluate(
        baseline,
        dataset,
        documents,
        embeddings,
        embedding_cache,
        llm=llm,
    )

    result = result_row_from_individual(evaluated)
    baseline_path = RESULT_DIR / "baseline_config.json"

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
            "[3, 4, 5, 6, 7, 8, 9, 10]",
            *[row["max_edges_per_node"] for row in ordered_rows],
        ],
        [
            "3",
            "Top K",
            "[3, 4, 5, 6, 7, 8, 9, 10]",
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
            "w0 = 0.45",
            "f0 (Answer cosine)",
            *[row.get("answer_cosine_similarity", 0.0) for row in ordered_rows],
        ],
        [
            "",
            "w1 = 0.20",
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
            "w3 = 0.10",
            "f3 (MRR)",
            *[row["mrr"] for row in ordered_rows],
        ],
        [
            "",
            "w4 = 0.05",
            "f4 (Precision@K)",
            *[row["precision_at_k"] for row in ordered_rows],
        ],
        [
            "",
            "w5 = 0.05",
            "f5 (Recall@K)",
            *[row["recall_at_k"] for row in ordered_rows],
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
            "Total edges",
            "",
            "",
            *[row["total_edges"] for row in ordered_rows],
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
        "precision_at_k",
        "recall_at_k",
        "avg_retrieval_time_ms",
        "avg_degree",
        "total_edges",
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
                "precision_at_k": row["precision_at_k"],
                "recall_at_k": row["recall_at_k"],
                "avg_retrieval_time_ms": row["avg_retrieval_time_ms"],
                "avg_degree": row["avg_degree"],
                "total_edges": row["total_edges"],
                "chromosome": row["chromosome"],
            })


def main():
    setup_ga_logging()

    parser = argparse.ArgumentParser(description="GA tuning for KMA GraphRAG")
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Only evaluate the current baseline: threshold=0.7, max_edges=7, top_k=10",
    )
    parser.add_argument(
        "--llm-eval",
        action="store_true",
        help="Generate answers with the active LLM and log each LLM response during evaluation",
    )
    args = parser.parse_args()

    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)

    print(f"Loading evaluation dataset from {DATASET_PATH}")
    dataset = load_eval_dataset()
    if MAX_EVAL_QUESTIONS:
        dataset = dataset[:MAX_EVAL_QUESTIONS]
    print(f"Loaded {len(dataset)} evaluation questions")

    print(f"Loading RAG documents from {DATA_FOLDER}")
    documents = load_rag_documents()
    print(f"Loaded {len(documents)} document chunks")

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    embedding_cache = {}
    evaluation_cache = {}
    llm = get_llm() if (USE_LLM_EVAL or args.llm_eval) else None
    logger.info(
        "[GA_START] generations=%s population=%s dataset_size=%s llm_eval=%s",
        GENERATIONS,
        POPULATION_SIZE,
        len(dataset),
        llm is not None,
    )

    if args.baseline:
        run_baseline(dataset, documents, embeddings, embedding_cache, llm=llm)
        return

    population = init_population()
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
            )
            for ind in population
        ]
        evaluated.sort(key=lambda x: x.fitness, reverse=True)

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

        while len(children) < POPULATION_SIZE - ELITE_SIZE:
            p1 = tournament_select(evaluated)
            p2 = tournament_select(evaluated)
            child = crossover(p1, p2)
            child = mutate(child)
            children.append(child)

        population = elites + children

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    csv_path = RESULT_DIR / f"ga_run_{timestamp}.csv"
    ranked_csv_path = RESULT_DIR / f"ga_run_{timestamp}_ranked.csv"
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
