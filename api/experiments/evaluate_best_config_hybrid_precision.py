import csv
import json
import math
import os
import sys
import time
from pathlib import Path
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from langchain_ollama import OllamaEmbeddings

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

load_dotenv(dotenv_path=ROOT / ".env")

# Cấu hình
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = "nomic-embed-text:latest"
DATASET_PATH = ROOT / "dataset chatbot update.csv"
DATA_FOLDER = ROOT / "api" / "data"
RESULT_DIR = API_DIR / "experiments" / "rag_ga_results"
GLOBAL_THRESHOLD_PATH = RESULT_DIR / "global_relevance_threshold.json"

# Lớp tính toán BM25 cục bộ dựa trên corpus của RAG
class BM25Scorer:
    def __init__(self, corpus_docs):
        from collections import Counter
        self.N = len(corpus_docs)
        self.doc_lens = [len(doc.split()) for doc in corpus_docs]
        self.avg_len = sum(self.doc_lens) / self.N if self.N > 0 else 1.0
        
        # Đếm tần suất xuất hiện của từ trong các văn bản
        self.doc_freqs = Counter()
        for doc in corpus_docs:
            unique_tokens = set(doc.lower().split())
            for token in unique_tokens:
                self.doc_freqs[token] += 1
                
    def get_idf(self, token):
        freq = self.doc_freqs.get(token, 0)
        # Công thức tính IDF tiêu chuẩn BM25
        return math.log((self.N - freq + 0.5) / (freq + 0.5) + 1.0)

    def score(self, query, doc_text):
        from collections import Counter
        query_tokens = query.lower().split()
        if not query_tokens:
            return 0.0
            
        doc_tokens = doc_text.lower().split()
        doc_len = len(doc_tokens)
        token_freqs = Counter(doc_tokens)
        
        k1, b = 1.5, 0.75
        score = 0.0
        query_unique_tokens = set(query_tokens)
        for token in query_unique_tokens:
            if token in token_freqs:
                tf = token_freqs[token]
                idf = self.get_idf(token)
                score += idf * (tf * (k1 + 1)) / (
                    tf + k1 * (1 - b + b * doc_len / self.avg_len)
                )
        # Chuẩn hóa về [0, 1]
        return score / (len(query_unique_tokens) + 1)

def cosine_sim(a, b):
    a = np.array(a)
    b = np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)

def embed_text(text, embeddings, embedding_cache):
    if text not in embedding_cache:
        try:
            embedding_cache[text] = embeddings.embed_query(text)
        except Exception as e:
            print(f"Lỗi tạo embedding cho text: {text[:50]}... - {e}")
            return [0.0] * 768  # Trả về vector rỗng nếu lỗi
    return embedding_cache[text]

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
                dataset.append({
                    "index": i + 1,
                    "question": question,
                    "answer_expected": answer_expected,
                    "ground_truth": ground_truth,
                    "doc_file": doc_file,
                    "department": department,
                })
    return dataset

def get_shared_graph_retriever(cfg, documents):
    # Sử dụng cache thư mục như trong ga_tuning_RAG.py
    RUN_DIR = API_DIR / "experiments" / "rag_ga_runs_deterministic_v1"
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
        print(f"Đang tải GraphRAG từ bộ nhớ đệm: {graph_path}")
        graph_builder.load_graph(str(graph_path))
    else:
        print(f"Đang xây dựng GraphRAG mới với config: {cfg}")
        graph_builder.build_graph(documents)
        graph_builder.save_graph(str(graph_path))

    partitioner = SubgraphPartitioner(graph_builder.graph)
    partitioner.partition_by_community_detection(generate_summaries=True)
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
    print("="*60)
    print("🚀 BẮT ĐẦU ĐÁNH GIÁ CHẤT LƯỢNG RAG VỚI BEST CONFIG")
    print("="*60)
    
    # 1. Đọc cấu hình tốt nhất từ best_config.json
    best_config_path = RESULT_DIR / "best_config.json"
    if best_config_path.exists():
        with open(best_config_path, "r", encoding="utf-8") as f:
            best_cfg = json.load(f)
        threshold = best_cfg.get("threshold", 0.4)
        max_edges_per_node = best_cfg.get("max_edges_per_node", 9)
        top_k = best_cfg.get("top_k", 11)
        print(f"Tải thành công cấu hình tốt nhất từ {best_config_path}:")
        print(f"  - Threshold: {threshold}")
        print(f"  - Max edges per node: {max_edges_per_node}")
        print(f"  - Top K: {top_k}")
    else:
        threshold = 0.4
        max_edges_per_node = 9
        top_k = 11
        print(f"Không tìm thấy best_config.json, sử dụng cấu hình mặc định:")
        print(f"  - Threshold: {threshold}")
        print(f"  - Max edges per node: {max_edges_per_node}")
        print(f"  - Top K: {top_k}")

    # 2. Đọc global relevance threshold
    global_threshold = 0.65
    if GLOBAL_THRESHOLD_PATH.exists():
        with open(GLOBAL_THRESHOLD_PATH, "r", encoding="utf-8") as f:
            payload = json.load(f)
        global_threshold = float(payload.get("threshold", 0.65))
        print(f"Tải thành công global relevance threshold: {global_threshold:.4f}")
    else:
        print(f"Sử dụng global relevance threshold mặc định: {global_threshold:.4f}")

    relevance_threshold = global_threshold * 0.95
    print(f"Relevance Similarity Threshold dùng để xét nhãn relevance: {relevance_threshold:.4f}")

    # 3. Tải dataset và tài liệu RAG
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

    # Khởi tạo mô hình embeddings và BM25 scorer
    print("Khởi tạo mô hình embeddings Ollama...")
    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL, base_url=OLLAMA_BASE_URL)
    embedding_cache = {}
    
    print("Khởi tạo BM25 scorer với corpus của các chunk...")
    corpus_texts = [doc.page_content for doc in documents]
    bm25_scorer = BM25Scorer(corpus_texts)

    # 4. Khởi tạo retriever với best config
    cfg = {
        "threshold": threshold,
        "max_edges_per_node": max_edges_per_node,
        "top_k": top_k
    }
    retriever, graph = get_shared_graph_retriever(cfg, documents)

    # 5. Đánh giá từng câu hỏi trong dataset
    print("\nĐang chạy đánh giá trên toàn bộ dataset...")
    rows = []
    precision_scores = []
    
    for idx, item in enumerate(dataset):
        question = item["question"]
        expected_answer = item["answer_expected"]
        ground_truth = item.get("ground_truth") or expected_answer
        expected_file = os.path.basename(item.get("doc_file") or "").lower().strip()
        expected_department = (item.get("department") or "").lower().strip()
        
        # Lấy embedding của câu trả lời mong đợi làm mốc so sánh
        truth_embedding = embed_text(ground_truth, embeddings, embedding_cache)
        
        # Truy xuất top_k tài liệu
        try:
            retrieved = retriever._get_relevant_documents(question)
        except Exception as exc:
            print(f"Lỗi khi truy xuất cho câu hỏi {idx+1}: {exc}")
            retrieved = []
            
        # Loại bỏ các chunk trùng lặp nội dung
        unique_retrieved = []
        seen = set()
        for doc in retrieved:
            content = getattr(doc, "page_content", "")
            if content and content not in seen:
                seen.add(content)
                unique_retrieved.append(doc)
        
        top_docs = unique_retrieved[:top_k]
        
        # Đánh giá độ phù hợp của từng chunk truy xuất được
        binary_relevance = []
        
        for chunk_rank, doc in enumerate(top_docs, start=1):
            metadata = getattr(doc, "metadata", {}) or {}
            page_content = doc.page_content
            
            # 1. Cosine similarity giữa chunk và expected answer (ground truth)
            doc_embedding = embed_text(page_content, embeddings, embedding_cache)
            cosine_score = cosine_sim(doc_embedding, truth_embedding)
            
            # 2. BM25 score giữa chunk và expected answer (ground truth)
            bm25_score = bm25_scorer.score(ground_truth, page_content)
            
            # 3. Điểm tổng hợp hybrid: 30% BM25 + 70% Cosine
            hybrid_score = 0.70 * cosine_score + 0.30 * bm25_score
            
            # Xét bộ lọc phòng ban (department) và file nguồn giống ga_tuning_RAG.py
            source_candidates = [
                metadata.get("source", ""),
                metadata.get("source_path", ""),
                metadata.get("full_path", ""),
                metadata.get("filename", ""),
            ]
            normalized_sources = [str(s).lower().strip() for s in source_candidates if s]
            source_basenames = {os.path.basename(s) for s in normalized_sources}
            
            metadata_department = str(metadata.get("department", "") or metadata.get("query_department", "")).lower().strip()
            department_candidates = [metadata_department, *normalized_sources]
            has_department_signal = any(department_candidates)
            
            department_matched = (
                True
                if not expected_department or not has_department_signal
                else any(expected_department in s for s in department_candidates)
            )
            
            file_matched = (
                True
                if not expected_file
                else expected_file in source_basenames
            )
            
            text_matched = (
                normalized_truth in page_content.lower()
                if normalized_truth
                else False
            )
            
            sim_matched = hybrid_score >= relevance_threshold
            
            # Nhãn relevance: 1 hoặc 0
            is_relevant = 1 if department_matched and file_matched and (text_matched or sim_matched) else 0
            binary_relevance.append(is_relevant)
            
            # Thêm dòng dữ liệu vào Excel list
            rows.append({
                "Câu số": item["index"],
                "Câu hỏi": question,
                "Câu trả lời": page_content,
                "Điểm Cosine": round(cosine_score, 4),
                "Điểm BM25": round(bm25_score, 4),
                "Điểm Tổng": round(hybrid_score, 4),
                "Relevance": is_relevant
            })
            
        # Tính Precision@K cho câu hỏi này
        q_precision = sum(binary_relevance) / top_k if top_k > 0 else 0.0
        precision_scores.append(q_precision)
        
        if (idx + 1) % 10 == 0 or (idx + 1) == len(dataset):
            print(f"Đã xử lý {idx+1}/{len(dataset)} câu hỏi. Precision@K trung bình hiện tại: {np.mean(precision_scores):.4f}")

    # 6. Tạo DataFrame và lưu kết quả ra Excel
    df = pd.DataFrame(rows)
    
    # Tính toán tổng hợp ở cuối bảng
    total_questions = len(dataset)
    avg_precision = float(np.mean(precision_scores))
    
    # Tạo các dòng tổng hợp bổ sung dưới cùng bảng dữ liệu
    summary_rows = [
        {"Câu số": "", "Câu hỏi": "", "Câu trả lời": "", "Điểm Cosine": "", "Điểm BM25": "", "Điểm Tổng": "", "Relevance": ""},
        {"Câu số": "Tổng số câu hỏi", "Câu hỏi": total_questions, "Câu trả lời": "", "Điểm Cosine": "", "Điểm BM25": "", "Điểm Tổng": "", "Relevance": ""},
        {"Câu số": "Điểm Precision trung bình", "Câu hỏi": f"{avg_precision:.4%}", "Câu trả lời": "", "Điểm Cosine": "", "Điểm BM25": "", "Điểm Tổng": "", "Relevance": ""}
    ]
    
    df_summary = pd.DataFrame(summary_rows)
    df_final = pd.concat([df, df_summary], ignore_index=True)
    
    # Đường dẫn xuất file excel
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    excel_path = RESULT_DIR / f"hybrid_precision_evaluation_{timestamp}.xlsx"
    
    # Lưu file excel
    df_final.to_excel(excel_path, index=False)
    
    print("\n" + "="*60)
    print("🎉 HOÀN THÀNH ĐÁNH GIÁ CHẤT LƯỢNG")
    print("="*60)
    print(f"Tổng số câu hỏi đánh giá: {total_questions}")
    print(f"Điểm Precision@{top_k} trung bình toàn bộ dataset: {avg_precision:.4%}")
    print(f"Đường dẫn file kết quả Excel: {excel_path}")
    print("="*60)

if __name__ == "__main__":
    main()
