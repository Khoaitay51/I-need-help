# Bảng Tóm Tắt Thực Nghiệm - Quick Reference

## 📊 Bảng Kết Quả Tổng Hợp

### Kết Quả Vector RAG vs Graph RAG

| Độ Đo                     | Vector RAG | Graph RAG | Cải Thiện    |
| ------------------------- | ---------- | --------- | ------------ |
| **Precision (%)**         | 68.61      | 75.33     | +6.72pp      |
| **Cosine Similarity (%)** | 73.08      | 77.78     | +4.70pp      |
| **MAP (%)**               | 60.08      | 72.90     | +12.82pp     |
| **NDCG (%)**              | 64.13      | 77.30     | +13.17pp     |
| **MRR (%)**               | 66.41      | 79.15     | +12.74pp     |
| **Trung Bình (%)**        | 66.46      | 76.49     | **+10.03pp** |

---

### Kết Quả Chi Tiết - Vector RAG + LLMs

| LLM Model            | Precision | Cosine Sim. | MAP   | NDCG  | MRR   |
| -------------------- | --------- | ----------- | ----- | ----- | ----- |
| Gemini 2.0 Flash API | 71.20     | 76.54       | 61.20 | 65.40 | 68.50 |
| Qwen 3:32B           | 65.87     | 71.20       | 58.40 | 62.30 | 64.10 |
| Qwen 2.5:72B         | 78.92     | 79.45       | 69.50 | 73.40 | 75.80 |
| Llama 2:13B          | 58.45     | 65.12       | 51.20 | 55.40 | 57.25 |

### Kết Quả Chi Tiết - Graph RAG + LLMs

| LLM Model            | Precision | Cosine Sim. | MAP   | NDCG  | MRR   |
| -------------------- | --------- | ----------- | ----- | ----- | ----- |
| Gemini 2.0 Flash API | 84.25     | 82.16       | 83.15 | 87.60 | 89.20 |
| Qwen 3:32B           | 74.32     | 76.92       | 73.50 | 79.10 | 81.20 |
| Qwen 2.5:72B         | 81.43     | 83.58       | 80.10 | 83.60 | 85.40 |
| Llama 2:13B          | 61.32     | 68.45       | 54.85 | 58.90 | 60.80 |

---

## 🖥️ Cấu Hình Hệ Thống

### Hardware

- **CPU**: Intel Core i7-14700F (20 cores, 28 threads)
- **GPU**: NVIDIA GeForce RTX 4060 Ti, 16GB VRAM
- **RAM**: 32GB DDR5
- **Storage**: 1TB NVMe SSD

### Software Chính

- **Backend**: FastAPI, Python 3.12
- **Frontend**: React 18, Tailwind CSS
- **Vector DB**: FAISS, Milvus
- **LLM**: Ollama (local) + Gemini API (cloud)
- **Embedding**: nomic-embed-text:latest (768 dimensions)
- **Containerization**: Docker, Docker Compose

---

## 📁 Dataset

| Thông Số             | Giá Trị    |
| -------------------- | ---------- |
| **Tổng Documents**   | 23         |
| **Số Phòng Ban**     | 7          |
| **Số Chunks**        | 171        |
| **Chunk Size**       | 800 ký tự  |
| **Số Nodes (Graph)** | 171        |
| **Số Edges (Graph)** | 791        |
| **Câu Hỏi Đánh Giá** | 114        |
| **Ngôn Ngữ**         | Tiếng Việt |

---

## ⚙️ Cấu Hình Retrieval

| Tham Số                  | Giá Trị  |
| ------------------------ | -------- |
| **Similarity Threshold** | 0.7      |
| **Max Edges per Node**   | 5        |
| **Top-k Documents**      | 10       |
| **Routing Communities**  | 3        |
| **Metadata Filter**      | Disabled |
| **Re-ranking**           | Enabled  |

---

## 🎯 Độ Đo Đánh Giá

| Độ Đo           | Công Thức                              | Phạm Vi | Ý Nghĩa                          |
| --------------- | -------------------------------------- | ------- | -------------------------------- |
| **Cosine Sim.** | $\frac{A \cdot B}{\|A\| \times \|B\|}$ | [0,1]   | Độ tương đồng semantic           |
| **Precision**   | $\frac{TP}{TP+FP}$                     | [0,1]   | Độ chính xác kết quả             |
| **MAP**         | $\frac{1}{Q}\sum AP(q)$                | [0,1]   | Trung bình độ chính xác xếp hạng |
| **MRR**         | $\frac{1}{Q}\sum \frac{1}{rank_q}$     | [0,1]   | Vị trí kết quả đúng đầu tiên     |
| **NDCG**        | $\frac{DCG@k}{IDCG@k}$                 | [0,1]   | Chất lượng xếp hạng toàn diện    |

---

## 📈 Hiệu Suất Theo Phòng Ban (Graph RAG)

| Phòng Ban       | Q&A | Precision |
| --------------- | --- | --------- |
| Phòng Đào Tạo   | 28  | 81.5%     |
| Phòng Khảo Thí  | 22  | 79.2%     |
| Viện Nghiên Cứu | 18  | 74.6%     |
| Các phòng khác  | 46  | 71.3%     |

---

## 🔍 Department Detection

| Chỉ Số                  | Giá Trị |
| ----------------------- | ------- |
| **Độ Chính Xác**        | 83.3%   |
| **Xếp Hạng Trung Bình** | 1.5     |
| **True Positives**      | 95/114  |

---

## 🏆 Kết Luận Chính

✅ **Graph RAG cải thiện hiệu suất trung bình 10.03%**

- Cải thiện MAP: +12.82%
- Cải thiện NDCG: +13.17%

✅ **Phát hiện phòm ban (Department Detection) hiệu quả 83.3%**

✅ **Gemini 2.0 Flash cho kết quả tốt nhất (84.25% Precision)**

✅ **Qwen 2.5:72B là mô hình local tốt nhất (81.43% Precision)**

✅ **Phù hợp cho bài toán tài liệu hành chính tiếng Việt**

---

## 🚀 Hướng Phát Triển

1. Tối ưu embedding model cho tiếng Việt
2. Phát triển LLM nhỏ (7B-13B) với độ chính xác cao
3. Thêm fact-checking mechanism
4. Mở rộng dataset đánh giá
5. Nghiên cứu graph structure phức tạp hơn
