import csv
import json
import math
import argparse
import logging
import random
import sys
import time
import os
import dotenv
from dataclasses import dataclass
from pathlib import Path


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
MUTATION_RATE = 0.3
RANDOM_IMMIGRANTS = 2
RANDOM_SEED = 42
GRAPH_CACHE_NAMESPACE = "rag_ga_runs_deterministic_v1"
USE_LLM_EVAL = False
MAX_EVAL_QUESTIONS = None
SEED_BEST_CONFIG = {
    "threshold": 0.3,
    "max_edges_per_node": 4,
    "top_k": 8,
}

RESULT_DIR = ROOT / "api" / "experiments" / "rag_ga_results"
RUN_DIR = ROOT / "api" / "experiments" / GRAPH_CACHE_NAMESPACE
DATASET_PATH = ROOT / "dataset chatbot update.csv"
GLOBAL_THRESHOLD_PATH = RESULT_DIR / "global_relevance_threshold.json"


DATA_FOLDER = ROOT / "api" / "data"
EMBEDDING_MODEL = "nomic-embed-text:latest"
SIMILARITY_THRESHOLD = 0.65
RELATIVE_RELEVANCE_MARGIN = 0.02
CALIBRATED_THRESHOLD_MIN = 0.55
CALIBRATED_THRESHOLD_MAX = 0.78

RESULT_DIR.mkdir(parents=True, exist_ok=True)
RUN_DIR.mkdir(parents=True, exist_ok=True)

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


def load_eval_dataset():
    dataset = []

    with open(DATASET_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            question = row.get("question", "").strip()
            answer_expected = row.get("answer_expected", "").strip()
            ground_truth = row.get("ground_truth", "").strip()
            doc_file = row.get("doc_file", "").strip()
            department = row.get("department", "").strip()

            if question and answer_expected:
                dataset.append({
                    "question": question,
                    "answer_expected": answer_expected,
                    "ground_truth": ground_truth,
                    "doc_file": doc_file,
                    "department": department,
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


def calibrate_threshold(population, dataset, documents, embeddings, embedding_cache):
    all_scores = []

    for individual in population:
        cfg = decode(individual.chromosome)
        try:
            retriever, _ = get_shared_graph_retriever(cfg, documents)
        except Exception as exc:
            logger.warning("[CALIBRATE][ERROR] config=%s error=%s", cfg, exc)
            continue

        for item in dataset:
            try:
                retrieved_docs = retriever._get_relevant_documents(item["question"])
            except Exception as exc:
                logger.warning("[CALIBRATE][RETRIEVE_ERROR] question=%s error=%s", item["question"], exc)
                continue

            truth_text = item.get("ground_truth") or item["answer_expected"]
            expected_embedding = embed_text(truth_text, embeddings, embedding_cache)
            for doc in deduplicate_docs(retrieved_docs):
                if not hasattr(doc, "page_content"):
                    continue
                doc_embedding = embed_text(doc.page_content, embeddings, embedding_cache)
                all_scores.append(cosine_sim(doc_embedding, expected_embedding))

    if not all_scores:
        logger.warning("[CALIBRATE] Không thu thập được score nào, dùng SIMILARITY_THRESHOLD mặc định=%.2f", SIMILARITY_THRESHOLD)
        return SIMILARITY_THRESHOLD

    scores_arr = np.array(all_scores)
    raw = float(np.percentile(scores_arr, 67))
    calibrated = float(np.clip(raw, CALIBRATED_THRESHOLD_MIN, CALIBRATED_THRESHOLD_MAX))

    logger.info(
        "[CALIBRATE] n_scores=%s mean=%.4f std=%.4f p67=%.4f clipped_threshold=%.4f",
        len(scores_arr),
        scores_arr.mean(),
        scores_arr.std(),
        raw,
        calibrated,
    )
    return calibrated


def load_or_create_global_threshold(population, dataset, documents, embeddings, embedding_cache):
    if GLOBAL_THRESHOLD_PATH.exists():
        with open(GLOBAL_THRESHOLD_PATH, "r", encoding="utf-8") as f:
            payload = json.load(f)

        threshold = float(payload["threshold"])
        logger.info(
            "[GLOBAL_THRESHOLD][LOAD] path=%s threshold=%.4f",
            GLOBAL_THRESHOLD_PATH,
            threshold,
        )
        return threshold

    logger.info("[GLOBAL_THRESHOLD][CREATE] path=%s", GLOBAL_THRESHOLD_PATH)
    threshold = calibrate_threshold(
        population,
        dataset,
        documents,
        embeddings,
        embedding_cache,
    )
    payload = {
        "threshold": threshold,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset_path": str(DATASET_PATH),
        "embedding_model": EMBEDDING_MODEL,
        "calibrated_threshold_min": CALIBRATED_THRESHOLD_MIN,
        "calibrated_threshold_max": CALIBRATED_THRESHOLD_MAX,
        "note": "Delete this file to force recalibration.",
    }
    with open(GLOBAL_THRESHOLD_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    logger.info(
        "[GLOBAL_THRESHOLD][SAVE] path=%s threshold=%.4f",
        GLOBAL_THRESHOLD_PATH,
        threshold,
    )
    return threshold


def score_retrieved_docs(
    retrieved_docs,
    question,
    expected_answer,
    ground_truth,
    doc_file,
    department,
    embeddings,
    embedding_cache,
    top_k,
    global_threshold=None,
):
    truth_text = ground_truth or expected_answer
    truth_embedding = embed_text(truth_text, embeddings, embedding_cache)

    relevance_scores = []
    for doc in retrieved_docs[:top_k]:
        doc_embedding = embed_text(doc.page_content, embeddings, embedding_cache)
        relevance_scores.append(
            cosine_sim(doc_embedding, truth_embedding)
        )

    if not relevance_scores:
        return {
            "precision_at_k": 0.0,
            "map": 0.0,
            "mrr": 0.0,
            "ndcg": 0.0,
        }

    threshold = (
        global_threshold * 0.95
        if global_threshold is not None
        else SIMILARITY_THRESHOLD
    )

    expected_file = os.path.basename(doc_file or "").lower().strip()
    expected_department = (department or "").lower().strip()
    normalized_truth = (truth_text or "").lower().strip()

    logger.debug("=" * 100)
    logger.debug("[QUESTION] %s", question)
    logger.debug("[EXPECTED_FILE] %s", expected_file)
    logger.debug("[EXPECTED_DEPARTMENT] %s", expected_department)
    logger.debug("[THRESHOLD] %.4f", threshold)

    binary_relevance = []

    for idx, doc in enumerate(retrieved_docs[:top_k]):

        score = relevance_scores[idx]

        metadata = getattr(doc, "metadata", {}) or {}

        source_candidates = [
            metadata.get("source", ""),
            metadata.get("source_path", ""),
            metadata.get("full_path", ""),
            metadata.get("filename", ""),
        ]

        normalized_sources = [
            str(s).lower().strip()
            for s in source_candidates
            if s
        ]

        source_basenames = {
            os.path.basename(s)
            for s in normalized_sources
        }

        metadata_department = (
            str(
                metadata.get("department", "")
                or metadata.get("query_department", "")
            )
            .lower()
            .strip()
        )

        department_candidates = [
            metadata_department,
            *normalized_sources,
        ]

        has_department_signal = any(department_candidates)

        department_matched = (
            True
            if not expected_department or not has_department_signal
            else any(
                expected_department in s
                for s in department_candidates
            )
        )

        file_matched = (
            True
            if not expected_file
            else expected_file in source_basenames
        )

        text_matched = (
            normalized_truth in doc.page_content.lower()
            if normalized_truth
            else False
        )

        sim_matched = score >= threshold

        binary = (
            department_matched
            and file_matched
            and (
                text_matched
                or sim_matched
            )
        )

        binary_relevance.append(int(binary))

        logger.debug(
            "[DOC %02d]"
            "\nscore          : %.4f"
            "\ndepartment     : %s"
            "\nfile           : %s"
            "\ntext           : %s"
            "\nsim            : %s"
            "\nbinary         : %d"
            "\nexpected dep   : %s"
            "\nactual dep     : %s"
            "\nexpected file  : %s"
            "\nactual file(s) : %s"
            "\nsource         : %s"
            "\npreview        : %s"
            "\n----------------------------------------------------",
            idx + 1,
            score,
            department_matched,
            file_matched,
            text_matched,
            sim_matched,
            int(binary),
            expected_department,
            metadata_department,
            expected_file,
            list(source_basenames),
            source_candidates,
            doc.page_content[:120].replace("\n", " "),
        )

    relevant_count = sum(binary_relevance)

    precision_at_k = (
        relevant_count / top_k
        if top_k
        else 0.0
    )

    mrr = 0.0
    for idx, rel in enumerate(binary_relevance):
        if rel:
            mrr = 1.0 / (idx + 1)
            break

    hits = 0
    precision_sum = 0.0

    for idx, rel in enumerate(binary_relevance, start=1):
        if rel:
            hits += 1
            precision_sum += hits / idx

    map_score = precision_sum / hits if hits else 0.0

    dcg = sum(
        rel / math.log2(idx + 2)
        for idx, rel in enumerate(binary_relevance)
    )

    ideal = sorted(binary_relevance, reverse=True)

    idcg = sum(
        rel / math.log2(idx + 2)
        for idx, rel in enumerate(ideal)
    )

    ndcg = dcg / idcg if idcg else 0.0

    logger.debug("[truth_scores] %s",
                 [round(s, 4) for s in relevance_scores])

    logger.debug("[binary] %s", binary_relevance)

    logger.debug(
        "[RESULT] P@K=%.4f MAP=%.4f MRR=%.4f NDCG=%.4f",
        precision_at_k,
        map_score,
        mrr,
        ndcg,
    )

    return {
        "precision_at_k": precision_at_k,
        "map": map_score,
        "mrr": mrr,
        "ndcg": ndcg,
    }
    truth_text = ground_truth or expected_answer
    truth_embedding = embed_text(truth_text, embeddings, embedding_cache)
    relevance_scores = []

    for doc in retrieved_docs[:top_k]:
        doc_embedding = embed_text(doc.page_content, embeddings, embedding_cache)
        relevance_scores.append(cosine_sim(doc_embedding, truth_embedding))

    if not relevance_scores:
        return {
            "precision_at_k": 0.0,
            "map": 0.0,
            "mrr": 0.0,
            "ndcg": 0.0,
        }

    threshold = global_threshold * 0.95 if global_threshold is not None else SIMILARITY_THRESHOLD

    # Binary relevance from the new ground-truth fields.
    # A chunk is relevant when it matches the expected source file (if provided)
    # AND its content matches the ground_truth passage by substring or cosine score.
    binary_relevance = []
    expected_file = os.path.basename(doc_file or "").lower().strip()
    expected_department = (department or "").lower().strip()
    normalized_truth = (truth_text or "").lower().strip()

    for idx, doc in enumerate(retrieved_docs[:top_k]):
        score = relevance_scores[idx]
        metadata = getattr(doc, "metadata", {}) or {}
        source_candidates = [
            metadata.get("source", ""),
            metadata.get("source_path", ""),
            metadata.get("full_path", ""),
            metadata.get("filename", ""),
        ]
        normalized_sources = [
            str(source).lower().strip()
            for source in source_candidates
            if source
        ]
        source_basenames = {
            os.path.basename(source)
            for source in normalized_sources
        }

        metadata_department = str(metadata.get("department", "") or metadata.get("query_department", "")).lower().strip()
        department_candidates = [metadata_department, *normalized_sources]
        has_department_signal = any(candidate for candidate in department_candidates)
        department_matched = (
            True
            if not expected_department or not has_department_signal
            else any(expected_department in candidate for candidate in department_candidates)
        )

        file_matched = True if not expected_file else expected_file in source_basenames
        text_matched = normalized_truth in doc.page_content.lower().strip() if normalized_truth else False
        sim_matched = score >= threshold
        binary_relevance.append(1 if department_matched and file_matched and (text_matched or sim_matched) else 0)

    relevant_count = sum(binary_relevance)
    precision_at_k = relevant_count / top_k if top_k else 0.0

    # MRR: reciprocal rank of the first binary-relevant chunk.
    mrr = 0.0
    for idx, rel in enumerate(binary_relevance):
        if rel:
            mrr = 1.0 / (idx + 1)
            break

    # Standard binary AP/MAP, not graded AP.
    # AP@K = average of Precision@rank over binary-relevant hits.
    hits = 0
    precision_sum = 0.0
    for idx, rel in enumerate(binary_relevance, start=1):
        if rel:
            hits += 1
            precision_sum += hits / idx
    map_score = precision_sum / hits if hits else 0.0

    # Standard binary NDCG@K, not graded NDCG.
    dcg = sum(
        rel / math.log2(idx + 2)
        for idx, rel in enumerate(binary_relevance)
    )
    ideal_relevance = sorted(binary_relevance, reverse=True)
    idcg = sum(
        rel / math.log2(idx + 2)
        for idx, rel in enumerate(ideal_relevance)
    )
    ndcg = dcg / idcg if idcg > 0 else 0.0

    logger.info(
        "[SCORE] q=%s threshold=%.4f truth_scores=%s binary=%s expected_file=%s expected_department=%s",
        question,
        threshold,
        [round(score, 4) for score in relevance_scores[:top_k]],
        binary_relevance,
        expected_file,
        expected_department,
    )

    return {
        "precision_at_k": precision_at_k,
        "map": map_score,
        "mrr": mrr,
        "ndcg": ndcg,
    }

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

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
    except Exception as exc:
        answer = f"LLM_ERROR: {type(exc).__name__}: {exc}"
        logger.exception(
            "[LLM_ERROR] config=%s question=%s response=%s",
            config,
            question,
            answer,
        )
        return answer

    answer = extract_llm_text(response)
    logger.info(
        "[LLM_RESPONSE] config=%s question=%s response=%s",
        config,
        question,
        " ".join(answer.split()) if answer else "",
    )
    return answer


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


def get_shared_graph_retriever(cfg, documents):
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
    else:
        graph_builder.build_graph(documents)
        graph_builder.save_graph(str(graph_path))

    partitioner = SubgraphPartitioner(graph_builder.graph)
    partitioner.partition_by_community_detection(generate_summaries=True)
    
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


def retrieve_for_evaluation(retriever, question, top_k, config=None):
    try:
        retrieved_docs = retriever._get_relevant_documents(question)
    except Exception as exc:
        logger.warning("[RETRIEVE][ERROR] config=%s question=%s error=%s", config, question, exc)
        retrieved_docs = []

    top_docs = deduplicate_docs(retrieved_docs)[:top_k]
    top_doc_summaries = [
        summarize_doc(doc, rank)
        for rank, doc in enumerate(top_docs, start=1)
    ]

    logger.debug(
        "[RETRIEVE] config=%s top_k=%s question=%s graph=document_graph returned=%s",
        config,
        top_k,
        question,
        len(top_docs),
    )
    for summary in top_doc_summaries:
        logger.debug("[RETRIEVE][TOP_%s] %s", summary["rank"], summary)

    return top_docs


def evaluate(individual, dataset, documents, embeddings, embedding_cache, llm=None, global_threshold=None, fitness_mode="hybrid"):
    cfg = decode(individual.chromosome)
    retriever, graph = get_shared_graph_retriever(cfg, documents)

    query_metrics = []
    retrieval_times = []
    answer_similarities = []

    for item in dataset:
        start = time.time()
        retrieved_docs = retrieve_for_evaluation(
            retriever,
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
                item["question"],
                item["answer_expected"],
                item.get("ground_truth", ""),
                item.get("doc_file", ""),
                item.get("department", ""),
                embeddings,
                embedding_cache,
                cfg["top_k"],
                global_threshold=global_threshold,
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

    total_nodes = graph.number_of_nodes()
    total_edges = graph.number_of_edges()
    total_communities = len(retriever.partitioner.communities) if hasattr(retriever, "partitioner") and hasattr(retriever.partitioner, "communities") else 0
    avg_degree = (2 * total_edges / total_nodes) if total_nodes else 0.0

    metrics = {
        "precision_at_k": float(np.mean([m["precision_at_k"] for m in query_metrics])),
        "map": float(np.mean([m["map"] for m in query_metrics])),
        "mrr": float(np.mean([m["mrr"] for m in query_metrics])),
        "ndcg": float(np.mean([m["ndcg"] for m in query_metrics])),
        "avg_retrieval_time_ms": float(np.mean(retrieval_times)) if retrieval_times else 0.0,
        "avg_degree": avg_degree,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "total_communities": total_communities,
    }

    if answer_similarities:
        metrics["answer_cosine_similarity"] = float(np.mean(answer_similarities))

    individual.fitness = calculate_fitness(metrics, fitness_mode=fitness_mode)
    individual.metrics = metrics
    return individual


def evaluate_with_cache(individual, dataset, documents, embeddings, embedding_cache, evaluation_cache, llm=None, global_threshold=None, fitness_mode="hybrid"):
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
        global_threshold=global_threshold,
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


def run_baseline(dataset, documents, embeddings, embedding_cache, llm=None, global_threshold=None, fitness_mode="hybrid"):
    baseline = Individual(chromosome=[
        THRESHOLD_VALUES.index(0.4),
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
        global_threshold=global_threshold,
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
        help="Only evaluate the current baseline: threshold=0.4, max_edges=7, top_k=10",
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
    parser.set_defaults(fitness_mode="hybrid")
    args = parser.parse_args()
    setup_ga_logging(args.fitness_mode)

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

    global_threshold = load_or_create_global_threshold(
        population, dataset, documents, embeddings, embedding_cache
    )
    print(f"Global relevance threshold: {global_threshold:.4f}")

    if args.baseline:
        run_baseline(dataset, documents, embeddings, embedding_cache, llm=llm, global_threshold=global_threshold, fitness_mode=args.fitness_mode)
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
                global_threshold=global_threshold,
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