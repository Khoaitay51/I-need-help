# 📊 RAG Comparison Test Guide - GraphRAG vs Traditional RAG

## 📋 Mục lục

1. [Giới thiệu](#giới-thiệu)
2. [Cài đặt](#cài-đặt)
3. [Hướng dẫn sử dụng](#hướng-dẫn-sử-dụng)
4. [Hiểu các độ đo](#hiểu-các-độ-đo)
5. [Kết quả và Giải thích](#kết-quả-và-giải-thích)
6. [Lỗi thường gặp](#lỗi-thường-gặp)

---

## 🎯 Giới thiệu

Bộ test này so sánh hai phương pháp truy xuất thông tin (RAG):

- **Traditional RAG**: Sử dụng BM25 (keyword matching) + Vector search (FAISS)
- **GraphRAG**: Sử dụng đồ thị tri thức với semantic routing và department-aware retrieval

### Độ đo được sử dụng

| Độ đo                            | Ý nghĩa                                                 | Giá trị | Công thức                       |
| -------------------------------- | ------------------------------------------------------- | ------- | ------------------------------- |
| **Cosine Similarity**            | Độ tương tự giữa câu hỏi và câu trả lời mong đợi        | 0-1     | `cos(θ) = A·B / (\|A\|\|B\|)`   |
| **Precision@K**                  | Tỷ lệ tài liệu liên quan trong top-K                    | 0-1     | `\|relevant ∩ retrieved\| / K`  |
| **Mean Average Precision (MAP)** | Trung bình độ chính xác tại từng vị trí liên quan       | 0-1     | `Σ(P(k)×rel(k)) / \|relevant\|` |
| **Mean Reciprocal Rank (MRR)**   | Nghịch đảo vị trí của tài liệu liên quan đầu tiên       | 0-1     | `1 / rank_first_relevant`       |
| **NDCG@K**                       | Xếp hạng chất lượng có tính đến vị trí (log-discounted) | 0-1     | `DCG / IDCG`                    |

---

## ⚙️ Cài đặt

### 1. Yêu cầu hệ thống

```bash
# Kiểm tra Python version (3.10+)
python --version

# Kiểm tra Docker/Ollama (nếu muốn sử dụng Ollama embeddings)
docker ps
```

### 2. Cài đặt dependenciesđã được định nghĩa trong `requirements.txt`

Nếu chưa cài, chạy:

```bash
cd api
pip install -r requirements.txt

# Hoặc cài thêm các package cần thiết
pip install numpy pandas tabulate scikit-learn
```

### 3. Cấu hình môi trường

Tạo file `.env` trong thư mục `api/`:

```bash
# .env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
GOOGLE_API_KEY=your_api_key_here  # Tuỳ chọn
```

### 4. Chạy Ollama (tuỳ chọn)

```bash
# Chạy Ollama container
docker run -d -v ollama:/root/.ollama -p 11434:11434 ollama/ollama

# Pull mô hình embedding
docker exec <container_id> ollama pull nomic-embed-text

# Kiểm tra
curl http://localhost:11434/api/tags
```

---

## 🚀 Hướng dẫn sử dụng

### Tùy chọn 1: Quick Test (Khuyến nghị để test nhanh)

Chạy với 5 câu hỏi mẫu - Thích hợp để kiểm tra thiết lập:

```bash
cd api
python test_rag_quick.py
```

**Kết quả**:

- In các metrics trực tiếp trên console
- Lưu kết quả vào `rag_test_results/quick_test_results_YYYYMMDD_HHMMSS.json`

### Tùy chọn 2: Full Comprehensive Test

Chạy với toàn bộ dataset:

```bash
cd api
python test_rag_comparison.py
```

**Kết quả**:

- `rag_test_results/rag_comparison_*.json` - Chi tiết từng câu hỏi
- `rag_test_results/aggregate_metrics_*.json` - Thống kê tổng hợp
- `rag_test_results/comparison_report_*.csv` - Bảng so sánh

**Để test với số lượng mẫu cụ thể**, sửa config trong file:

```python
# test_rag_comparison.py - Dòng 70
TEST_CONFIG = {
    "k_retrieved": 5,           # Số tài liệu truy xuất
    "top_k_for_metrics": 5,     # Top K cho precision, MAP, NDCG
    "num_samples": 10,          # ← Đổi thành số lượng mong muốn (None = toàn bộ)
}
```

### Tùy chọn 3: Custom Test Script

Viết script tùy chỉnh sử dụng utilities:

```python
from src.evaluation.metrics import RAGMetrics

# Giả sử bạn đã có retrieved IDs và relevant IDs
retrieved_ids = [0, 2, 4, 1, 3]
relevant_ids = [0]  # Document ID 0 liên quan

# Tính toán metrics
precision = RAGMetrics.precision_at_k(retrieved_ids, relevant_ids, k=5)
map_score = RAGMetrics.mean_average_precision(retrieved_ids, relevant_ids, k=5)
mrr = RAGMetrics.mean_reciprocal_rank(retrieved_ids, relevant_ids)
ndcg = RAGMetrics.normalized_discounted_cumulative_gain(retrieved_ids, relevant_ids, k=5)

print(f"Precision@5: {precision:.4f}")
print(f"MAP: {map_score:.4f}")
print(f"MRR: {mrr:.4f}")
print(f"NDCG: {ndcg:.4f}")
```

---

## 📚 Hiểu các độ đo

### 1. **Cosine Similarity** - Độ tương tự của embedding

```
Công thức: cos(θ) = A·B / (||A|| * ||B||)

Ý nghĩa:
- 0.0 = Hoàn toàn không liên quan
- 0.5 = Có liên quan trung bình
- 1.0 = Hoàn toàn giống nhau

Ví dụ:
- Q: "Quy định công tác khảo thí?"
- A: "Quy định này được áp dụng..."
- Cosine Sim: 0.87 (rất tương tự)
```

### 2. **Precision@K** - Độ chặt của kết quả

```
Công thức: P@K = (Số tài liệu liên quan trong top-K) / K

Ý nghĩa:
- Đo tỷ lệ kết quả đúng trong top-K
- Cao = Ít false positive

Ví dụ:
- Truy xuất 5 tài liệu, 3 cái liên quan
- Precision@5 = 3/5 = 0.60

Khi nào dùng:
- Khi độ chính xác quan trọng hơn đầy đủ
- Ví dụ: Hệ thống tư vấn cần câu trả lời đúng
```

### 3. **MAP - Mean Average Precision** - Trung bình chính xác

```
Công thức: MAP = Σ(P(k) × rel(k)) / |relevant|

Ý nghĩa:
- Xem xét vị trí từ tài liệu liên quan
- Tài liệu liên quan sớm = điểm cao hơn
- Trung bình của tất cả precision points

Ví dụ:
Retrieved: [doc_A(liên quan), doc_B, doc_C(liên quan), doc_D, doc_E]
P@1 = 1/1 = 1.0   (doc_A ở vị trí 1)
P@3 = 2/3 = 0.67  (2/3 liên quan trong top-3)
MAP = (1.0 + 0.67) / 2 = 0.835

Khi nào dùng:
- Đánh giá overall ranking quality
- Cấu hình tiêu chuẩn trong TREC
```

### 4. **MRR - Mean Reciprocal Rank** - Nghịch đảo vị trí

```
Công thức: MRR = 1 / rank(first_relevant)

Ý nghĩa:
- Đo vị trí của kết quả đúng đầu tiên
- Cao = Tài liệu liên quan ở đầu

Ví dụ:
Retrieved: [doc_A, doc_B(liên quan), doc_C, ...]
MRR = 1/2 = 0.50

Retrieved: [doc_A(liên quan), doc_B, ...]
MRR = 1/1 = 1.00

Khi nào dùng:
- Khi quan tâm đến "first correct answer"
- Ví dụ: Tìm kiếm web, QA systems
```

### 5. **NDCG@K - Normalized DCG** - Xếp hạng chuẩn hóa

```
Công thức: NDCG@K = DCG@K / IDCG@K

DCG = Σ(relevance(i) / log2(i+1))  [log-discount cao với i nhỏ]
IDCG = DCG của perfect ranking (tất cả liên quan trước)

Ý nghĩa:
- Xem xét cả vị trí và độ liên quan
- Chuẩn hóa bởi ideal ranking (0-1)
- Phổ biến nhất trong utility-based evaluation

Ví dụ:
Retrieved: [relevant, not-relevant, relevant, not-relevant, ...]
           rel=1     rel=0       rel=1
DCG = 1/log2(2) + 0/log2(3) + 1/log2(4)
    = 1.0 + 0 + 0.5 = 1.5

Perfect: [relevant, relevant, ...]
IDCG = 1/log2(2) + 1/log2(3) + ... = 2.44

NDCG = 1.5 / 2.44 = 0.615

Khi nào dùng:
- Đánh giá tổng thể ranking quality
- Tiêu chuẩn công nghiệp
- Trong các cuộc thi như TREC
```

---

## 📊 Kết quả và Giải thích

### Kết quả mẫu

```
================================================================================
📊 RAG COMPARISON TEST REPORT
================================================================================

### TRADITIONAL_RAG ###
┌──────────────────────────────┬────────────────────────┐
│ Metric                       │ Value                  │
├──────────────────────────────┼────────────────────────┤
│ Total Tests                  │ 10                     │
│ Cosine Similarity            │ 0.7234 ± 0.1456        │
│ Precision@K                  │ 0.4000 ± 0.2108        │
│ MAP                          │ 0.3500 ± 0.2040        │
│ MRR                          │ 0.5500 ± 0.3082        │
│ NDCG                         │ 0.6234 ± 0.2156        │
│ Avg Retrieval Time (ms)      │ 45.32 ± 12.45          │
└──────────────────────────────┴────────────────────────┘

### GRAPH_RAG ###
┌──────────────────────────────┬────────────────────────┐
│ Metric                       │ Value                  │
├──────────────────────────────┼────────────────────────┤
│ Total Tests                  │ 10                     │
│ Cosine Similarity            │ 0.7456 ± 0.1302        │
│ Precision@K                  │ 0.5200 ± 0.1789        │
│ MAP                          │ 0.4800 ± 0.1950        │
│ MRR                          │ 0.6800 ± 0.2749        │
│ NDCG                         │ 0.7123 ± 0.1834        │
│ Avg Retrieval Time (ms)      │ 62.15 ± 15.67          │
└──────────────────────────────┴────────────────────────┘

### COMPARISON ###
┌────────────────────┬──────────────────┬─────────────┬──────────────┬──────────┬──────────────┐
│ Metric             │ Traditional RAG  │ GraphRAG    │ Difference   │ % Change │ Winner       │
├────────────────────┼──────────────────┼─────────────┼──────────────┼──────────┼──────────────┤
│ Cosine Similarity  │ 0.7234           │ 0.7456      │ +0.0222      │ +3.07%   │ GraphRAG ✓   │
│ Precision@K        │ 0.4000           │ 0.5200      │ +0.1200      │ +30.00%  │ GraphRAG ✓   │
│ MAP                │ 0.3500           │ 0.4800      │ +0.1300      │ +37.14%  │ GraphRAG ✓   │
│ MRR                │ 0.5500           │ 0.6800      │ +0.1300      │ +23.64%  │ GraphRAG ✓   │
│ NDCG               │ 0.6234           │ 0.7123      │ +0.0889      │ +14.27%  │ GraphRAG ✓   │
└────────────────────┴──────────────────┴─────────────┴──────────────┴──────────┴──────────────┘
```

### Giải thích kết quả

1. **GraphRAG tốt hơn 30-37%** trên Precision, MAP
   - Xếp hạng di tài liệu liên quan tốt hơn
   - Department routing giúp focus tài liệu đúng

2. **Cosine Similarity tương tự** (+3%)
   - Cả hai đều hiểu ý nghĩa câu hỏi tốt
   - Graph RAG hơn nhẹ nhàng

3. **GraphRAG chậm hơn** ~37% trong retrieval
   - Trade-off: Chất lượng vs tốc độ
   - Có thể tối ưu graph traversal

---

## 🐛 Lỗi thường gặp

### 1. `ModuleNotFoundError: No module named 'src'`

```bash
# Chạy từ folder api/
cd api
python test_rag_comparison.py

# HOẶC thêm vào script:
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
```

### 2. `FileNotFoundError: Dataset not found`

```bash
# Kiểm tra đường dẫn file
ls -la "dataset chatbot update.csv"

# Cập nhật đường dẫn nếu cần
DATASET_PATH = Path("/path/to/dataset chatbot update.csv")
```

### 3. Ollama connection error

```bash
# Kiểm tra Ollama đang chạy
curl http://localhost:11434/api/tags

# Hoặc set embeddings model fallback
# Script tự động fallback sang sentence-transformers nếu Ollama không available
```

### 4. Out of memory error

```python
# Giảm số samples:
TEST_CONFIG = {
    "num_samples": 50,  # Từ None (toàn bộ) thành 50
}

# Hoặc giảm k_retrieved
TEST_CONFIG = {
    "k_retrieved": 3,  # Từ 5 xuống 3
}
```

### 5. Kết quả thấp cho cả hai retriever

```python
# Kiểm tra dataset quality
# Có thể dataset quá ngắn hoặc không đa dạng

# Thử với full dataset (không lựa chọn sample)
TEST_CONFIG['num_samples'] = None
```

---

## 📁 Cấu trúc file

```
api/
├── test_rag_comparison.py          # Main comprehensive test
├── test_rag_quick.py               # Quick test version
├── src/
│   └── evaluation/
│       └── metrics.py              # Metrics utilities
├── rag_test_results/               # (Auto-created) Test results
│   ├── rag_comparison_*.json
│   ├── aggregate_metrics_*.json
│   └── comparison_report_*.csv
└── dataset\ chatbot\ update.csv    # Input dataset
```

---

## 🔗 Tài liệu tham khảo

- [LangChain Documentation](https://python.langchain.com/)
- [TREC Evaluation Metrics](https://trec.nist.gov/)
- [Information Retrieval Metrics](https://en.wikipedia.org/wiki/Information_retrieval)
- [Scikit-learn Text Feature Extraction](https://scikit-learn.org/stable/modules/feature_extraction.html)

---

## ❓ Câu hỏi thường gặp (FAQ)

**Q: Nên dùng metric nào để lựa chọn retriever?**
A: Dùng NDCG vì nó cân bằng giữa:

- Ranking quality (vị trí)
- Relevance (độ liên quan)
- Chuẩn hóa (dễ so sánh)

**Q: Test này cần bao lâu?**
A:

- Quick test (~5 samples): 2-5 phút
- Full test (~30 samples): 10-30 phút
- Phụ thuộc vào embedding model size

**Q: Có thể cải thiện kết quả không?**
A: Có:

1. Tinh chỉnh số hop_depth trong graph RAG
2. Tối ưu chunking strategy trong preprocessing
3. Dùng mô hình embedding tốt hơn
4. Enrichment metadata của tài liệu

---

**Được tạo: [2026-03-21]**
**Language: Vietnamese**
