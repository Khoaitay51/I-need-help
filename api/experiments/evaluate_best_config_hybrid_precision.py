import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from langchain_ollama import OllamaEmbeddings
from langchain_core.messages import HumanMessage
from rouge_score import rouge_scorer as rouge_scorer_lib

# Thiết lập đường dẫn import cho hệ thống
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
import re

load_dotenv(dotenv_path=ROOT / ".env")

# Cấu hình
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = "nomic-embed-text:latest"
DATASET_PATH = ROOT / "dataset chatbot update.csv"
DATA_FOLDER = ROOT / "api" / "data"
RESULT_DIR = API_DIR / "experiments" / "rag_ga_results"


def cosine_sim(a, b):
    a = np.array(a)
    b = np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def rouge_similarity(expected, llm_answer):
    """Tính ROUGE-1, ROUGE-2, ROUGE-L giữa expected và llm_answer."""
    scorer = rouge_scorer_lib.RougeScorer(
        ["rouge1", "rouge2", "rougeL"], use_stemmer=False
    )
    scores = scorer.score(expected, llm_answer)
    return {
        "rouge1": scores["rouge1"].fmeasure,
        "rouge2": scores["rouge2"].fmeasure,
        "rougeL": scores["rougeL"].fmeasure,
    }


def embed_text(text, embeddings, embedding_cache):
    if text not in embedding_cache:
        try:
            embedding_cache[text] = embeddings.embed_query(text)
        except Exception as e:
            print(f"Lỗi tạo embedding cho text: {text[:50]}... - {e}")
            return np.zeros(len(embeddings.embed_query("test"))).tolist()
    return embedding_cache[text]


def normalize_llm_content(value):

    def strip_thinking(text):
        return re.sub(
            r"<think(?:ing)?>[\s\S]*?(?:</think(?:ing)?>|$)",
            "",
            str(text),
            flags=re.IGNORECASE,
        ).strip()

    if value is None:
        return ""

    if isinstance(value, str):
        return strip_thinking(value)

    if isinstance(value, list):
        return "\n".join(
            normalize_llm_content(x) for x in value if normalize_llm_content(x)
        ).strip()

    if isinstance(value, dict):
        for key in ("text", "content", "answer", "output"):
            if key in value:
                txt = normalize_llm_content(value[key])
                if txt:
                    return txt

    return strip_thinking(str(value))


def generate_answer_with_llm(question, docs, llm):
    context = "\n\n".join(
        f"[Chunk {i+1}]\n{doc.page_content}" for i, doc in enumerate(docs)
    )

    prompt = f"""
Bạn là công cụ trích xuất thông tin từ văn bản quy định.

Ngữ cảnh:
{context}

Câu hỏi: {question}

Yêu cầu:
- Tìm đoạn văn bản trong ngữ cảnh trả lời trực tiếp cho câu hỏi.
- Chép lại NGUYÊN VĂN hoặc gần nguyên văn đoạn đó, không diễn giải lại.
- Nếu không tìm thấy, chỉ trả lời: "Không tìm thấy đủ thông tin."
- Không thêm lời giải thích, không mở đầu, không kết luận.


Trả lời:
""".strip()

    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if hasattr(response, "content") else response
    return normalize_llm_content(content)


def load_eval_dataset():
    dataset = []
    with open(DATASET_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            question = row.get("question", "").strip()
            answer_expected = row.get("answer_expected", "").strip()
            ground_truth = row.get("ground_truth", "").strip()
            doc_file = row.get("doc_file", "").strip()
            department = row.get("department", "").strip()
            if question and answer_expected:
                dataset.append(
                    {
                        "index": i + 1,
                        "question": question,
                        "answer_expected": answer_expected,
                        "ground_truth": ground_truth,
                        "doc_file": doc_file,
                        "department": department,
                    }
                )
    return dataset


def get_shared_graph_retriever(cfg, documents):
    RUN_DIR = API_DIR / "experiments" / "rag_ga_runs_deterministic_v1"
    graph_cache_dir = (
        RUN_DIR
        / f"t{cfg['threshold']}_e{cfg['max_edges_per_node']}"
        / "document_graph"
    )
    graph_cache_dir.mkdir(parents=True, exist_ok=True)
    graph_path = graph_cache_dir / "document_graph.pkl"

    graph_builder = DocumentGraph(
        semantic_threshold=cfg["threshold"],
        max_semantic_edges_per_node=cfg["max_edges_per_node"],
        embeddings_model=EMBEDDING_MODEL,
    )

    if graph_path.exists():
        print(f"Đang tải GraphRAG từ bộ nhớ đệm: {graph_path}")
        graph_builder.load_graph(str(graph_path))
    else:
        print(f"Đang xây dựng GraphRAG mới với config: {cfg}")
        graph_builder.build_graph(documents)
        graph_builder.save_graph(str(graph_path))

    partitioner = SubgraphPartitioner(graph_builder.graph)
    partitioner.partition_by_community_detection(generate_summaries=False)
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
    return retriever, graph_builder.graph


def main():
    global DATASET_PATH

    parser = argparse.ArgumentParser(
        description="Đánh giá chất lượng RAG với cấu hình tùy chỉnh hoặc best config."
    )
    parser.add_argument("-d", "--dataset", type=str, default=None)
    parser.add_argument("-t", "--threshold", type=float, default=None)
    parser.add_argument("-e", "--max-edges-per-node", type=int, default=None)
    parser.add_argument("-k", "--top-k", type=int, default=None)
    parser.add_argument("-o", "--output", type=str, default=None)
    parser.add_argument("--llm-eval", action="store_true")

    args = parser.parse_args()

    print("=" * 60)
    print("🚀 BẮT ĐẦU ĐÁNH GIÁ CHẤT LƯỢNG RAG VỚI HỆ THỐNG")
    print("=" * 60)

    if args.dataset:
        custom_dataset = Path(args.dataset)
        if custom_dataset.exists():
            DATASET_PATH = custom_dataset
        elif (ROOT / args.dataset).exists():
            DATASET_PATH = ROOT / args.dataset
        elif (API_DIR / args.dataset).exists():
            DATASET_PATH = API_DIR / args.dataset
        else:
            print(f"Cảnh báo: Không tìm thấy file dataset '{args.dataset}'.")
            DATASET_PATH = custom_dataset
        print(f"Sử dụng file dataset: {DATASET_PATH}")
    else:
        print(f"Sử dụng file dataset mặc định: {DATASET_PATH}")

    # 1. Đọc cấu hình từ best_config.json
    best_config_path = RESULT_DIR / "best_config.json"
    base_threshold = 0.4
    base_max_edges = 9
    base_top_k = 11

    if best_config_path.exists():
        with open(best_config_path, "r", encoding="utf-8") as f:
            best_cfg = json.load(f)
        cfg_threshold = best_cfg.get("threshold", base_threshold)
        cfg_max_edges = best_cfg.get("max_edges_per_node", base_max_edges)
        cfg_top_k = best_cfg.get("top_k", base_top_k)
        print(f"Tải thành công cấu hình từ {best_config_path}:")
        print(f"  - Threshold: {cfg_threshold}")
        print(f"  - Max edges per node: {cfg_max_edges}")
        print(f"  - Top K: {cfg_top_k}")
    else:
        cfg_threshold = base_threshold
        cfg_max_edges = base_max_edges
        cfg_top_k = base_top_k
        print("Không tìm thấy best_config.json, sử dụng cấu hình mặc định.")

    threshold = args.threshold if args.threshold is not None else cfg_threshold
    max_edges_per_node = (
        args.max_edges_per_node if args.max_edges_per_node is not None else cfg_max_edges
    )
    top_k = args.top_k if args.top_k is not None else cfg_top_k

    if args.threshold is not None or args.max_edges_per_node is not None or args.top_k is not None:
        print("\n--> Áp dụng cấu hình tùy chỉnh từ dòng lệnh:")
        print(f"  - Threshold: {threshold}, Max edges: {max_edges_per_node}, Top K: {top_k}")

    # 2. Tải dataset và tài liệu RAG
    print("\nĐang tải dataset...")
    dataset = load_eval_dataset()
    print(f"Đã tải {len(dataset)} câu hỏi đánh giá.")

    print("Đang tải các chunk tài liệu RAG...")
    documents = load_documents_from_folder(
        data_folder=str(DATA_FOLDER),
        chunk_size=800,
        chunk_overlap=200,
    )
    print(f"Đã tải {len(documents)} chunk tài liệu.")

    print("Khởi tạo mô hình embeddings Ollama...")
    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=OLLAMA_BASE_URL)
    embedding_cache = {}

    llm = None
    if args.llm_eval:
        print("Loading LLM...")
        llm = get_llm()
        print("LLM ready.")

    # 3. Khởi tạo retriever
    cfg = {
        "threshold": threshold,
        "max_edges_per_node": max_edges_per_node,
        "top_k": top_k,
    }
    retriever, graph = get_shared_graph_retriever(cfg, documents)

    # 4. Đánh giá từng câu hỏi
    print("\nĐang chạy đánh giá trên toàn bộ dataset...")
    rows = []
    cosine_scores = []
    rouge1_scores = []
    rouge2_scores = []
    rougeL_scores = []
    hybrid_scores = []

    for idx, item in enumerate(dataset):
        question = item["question"]
        expected_answer = item["answer_expected"]

        try:
            retrieved = retriever._get_relevant_documents(question)
        except Exception as exc:
            print(f"Lỗi khi truy xuất cho câu hỏi {idx + 1}: {exc}")
            retrieved = []

        # Dedup
        unique_retrieved = []
        seen = set()
        for doc in retrieved:
            content = getattr(doc, "page_content", "")
            if content and content not in seen:
                seen.add(content)
                unique_retrieved.append(doc)

        top_docs = unique_retrieved[:top_k]

        llm_answer = ""
        cosine_score = 0.0
        r1 = r2 = rL = rouge_combined = hybrid_score = 0.0
        is_relevant = 0

        if llm is not None and top_docs:
            llm_answer = generate_answer_with_llm(question, top_docs, llm)

            # Cosine similarity (semantic)
            expected_embedding = embed_text(expected_answer, embeddings, embedding_cache)
            answer_embedding = embed_text(llm_answer, embeddings, embedding_cache)
            cosine_score = cosine_sim(answer_embedding, expected_embedding)

            # ROUGE scores (lexical)
            rouge_scores = rouge_similarity(expected_answer, llm_answer)
            r1 = rouge_scores["rouge1"]
            r2 = rouge_scores["rouge2"]
            rL = rouge_scores["rougeL"]
            rouge_combined = (r1 + r2 + rL) / 3

            hybrid_score = 0.7 * cosine_score + 0.3 * rouge_combined
            is_relevant = int(hybrid_score >= 0.70)

        cosine_scores.append(cosine_score)
        rouge1_scores.append(r1)
        rouge2_scores.append(r2)
        rougeL_scores.append(rL)
        hybrid_scores.append(hybrid_score)

        rows.append(
            {
                "Question ID": item["index"],
                "Question": question,
                "Expected Answer": expected_answer,
                "LLM Answer": llm_answer,
                "Cosine Similarity": round(cosine_score, 4),
                "ROUGE-1": round(r1, 4),
                "ROUGE-2": round(r2, 4),
                "ROUGE-L": round(rL, 4),
                "ROUGE Combined": round(rouge_combined, 4),
                "Hybrid Score": round(hybrid_score, 4),
                "Relevant": is_relevant,
            }
        )

        if (idx + 1) % 10 == 0 or (idx + 1) == len(dataset):
            print(
                f"Đã xử lý {idx + 1}/{len(dataset)}"
                f" | Cosine={np.mean(cosine_scores):.4f}"
                f" | R1={np.mean(rouge1_scores):.4f}"
                f" | R2={np.mean(rouge2_scores):.4f}"
                f" | RL={np.mean(rougeL_scores):.4f}"
                f" | Hybrid={np.mean(hybrid_scores):.4f}"
            )

    # 5. Lưu kết quả ra Excel
    df = pd.DataFrame(rows)

    total_questions = len(dataset)
    avg_cosine = float(np.mean(cosine_scores)) if cosine_scores else 0.0
    avg_r1 = float(np.mean(rouge1_scores)) if rouge1_scores else 0.0
    avg_r2 = float(np.mean(rouge2_scores)) if rouge2_scores else 0.0
    avg_rL = float(np.mean(rougeL_scores)) if rougeL_scores else 0.0
    avg_hybrid = float(np.mean(hybrid_scores)) if hybrid_scores else 0.0
    relevant_count = sum(row["Relevant"] for row in rows)
    relevant_rate = relevant_count / total_questions if total_questions > 0 else 0.0

    summary_rows = [
        {"Question ID": "", "Question": ""},
        {"Question ID": "Total Questions", "Question": total_questions},
        {"Question ID": "Average Cosine Similarity", "Question": f"{avg_cosine:.4f}"},
        {"Question ID": "Average ROUGE-1", "Question": f"{avg_r1:.4f}"},
        {"Question ID": "Average ROUGE-2", "Question": f"{avg_r2:.4f}"},
        {"Question ID": "Average ROUGE-L", "Question": f"{avg_rL:.4f}"},
        {"Question ID": "Average Hybrid Score", "Question": f"{avg_hybrid:.4f}"},
        {"Question ID": "Relevant Responses", "Question": f"{relevant_count}/{total_questions}"},
        {"Question ID": "Relevant Rate", "Question": f"{relevant_rate:.2%}"},
    ]

    df_summary = pd.DataFrame(summary_rows)
    df_final = pd.concat([df, df_summary], ignore_index=True)

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    if args.output:
        custom_out = Path(args.output)
        if custom_out.suffix != ".xlsx":
            custom_out = custom_out.with_suffix(".xlsx")
        excel_path = custom_out if custom_out.is_absolute() else RESULT_DIR / custom_out
    else:
        excel_path = RESULT_DIR / f"rouge_cosine_evaluation_{timestamp}.xlsx"

    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    df_final.to_excel(excel_path, index=False)

    print("\n" + "=" * 60)
    print("🎉 HOÀN THÀNH ĐÁNH GIÁ CHẤT LƯỢNG")
    print("=" * 60)
    print(f"Tổng số câu hỏi đánh giá : {total_questions}")
    print(f"Average Cosine Similarity : {avg_cosine:.4f}")
    print(f"Average ROUGE-1           : {avg_r1:.4f}")
    print(f"Average ROUGE-2           : {avg_r2:.4f}")
    print(f"Average ROUGE-L           : {avg_rL:.4f}")
    print(f"Average Hybrid Score      : {avg_hybrid:.4f}")
    print(f"Relevant Responses        : {relevant_count}/{total_questions}")
    print(f"Relevant Rate             : {relevant_rate:.2%}")
    print(f"Đường dẫn file kết quả    : {excel_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()