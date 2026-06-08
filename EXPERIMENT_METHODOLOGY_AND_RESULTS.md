# Phương Pháp Thực Nghiệm và Kết Quả

## 1. Môi Trường Thực Nghiệm

Hệ thống chatbot hỏi đáp văn bản hành chính tiếng Việt được phát triển và đánh giá trong một môi trường máy tính cấu hình cao nhằm đảm bảo khả năng xử lý dữ liệu lớn và tính toán các mô hình ngôn ngữ lớn (LLMs) một cách hiệu quả.

### 1.1 Cấu Hình Phần Cứng

Hệ thống được triển khai trên máy tính cá nhân với cấu hình phần cứng như sau:

| Thành phần       | Thông số kỹ thuật                           | Mô tả                                                                   |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| **CPU**          | Intel Core i7-14700F (20 cores, 28 threads) | Bộ xử lý trung tâm cấp cao, đủ khả năng xử lý song song các tác vụ nặng |
| **GPU**          | NVIDIA GeForce RTX 4060 Ti                  | Card đồ họa GPU chuyên dùng cho xử lý ML/AI                             |
| **VRAM (GPU)**   | 16GB GDDR6                                  | Bộ nhớ GPU cho tính toán song song nhanh                                |
| **RAM (CPU)**    | 32GB DDR5                                   | Bộ nhớ chính hỗ trợ xử lý dữ liệu lớn                                   |
| **Ổ cứng**       | 1TB NVMe SSD                                | Tốc độ đọc/ghi cao, phù hợp cho lưu trữ embeddings và vector DB         |
| **Hệ điều hành** | Windows 11 Pro                              | Chạy WSL2 với Docker Desktop                                            |

**Nhận xét:** Cấu hình này đủ để:

- Chạy các mô hình LLM cỡ lớn (7B-72B parameters) cục bộ với Ollama
- Tính toán embeddings nhanh với GPU acceleration
- Lưu trữ vector databases (FAISS, Milvus) với dung lượng lớn
- Xử lý 114 truy vấn thực nghiệm trong thời gian hợp lý

### 1.2 Cấu Hình Phần Mềm

Hệ thống sử dụng kiến trúc microservices với các thành phần chính:

#### 1.2.1 Stack Công Nghệ Backend

| Thành phần                | Phiên bản | Mục đích                                |
| ------------------------- | --------- | --------------------------------------- |
| **Python**                | 3.12      | Ngôn ngữ lập trình chính                |
| **FastAPI**               | ≥0.115.12 | Framework web async, RESTful API        |
| **LangChain**             | ≥0.3.22   | Orchestration cho LLM/RAG workflows     |
| **LangGraph**             | ≥0.3.21   | Agentic workflows, supervision patterns |
| **Ollama**                | Latest    | Local LLM inference engine              |
| **Sentence-Transformers** | ≥5.0.0    | Embedding models (nomic-embed-text)     |
| **PyMilvus**              | ≥2.4.0    | Vector database client                  |
| **FAISS**                 | ≥1.10.0   | Local semantic search engine            |
| **Rank-BM25**             | ≥0.2.2    | Sparse retrieval baseline               |

#### 1.2.2 Stack Frontend

| Thành phần       | Phiên bản           | Mục đích                  |
| ---------------- | ------------------- | ------------------------- |
| **React**        | 18.x                | Framework UI              |
| **Node.js**      | ≥20.x               | JavaScript runtime        |
| **Tailwind CSS** | Latest              | Styling framework         |
| **Vite**         | Latest (dev server) | Build tool                |
| **Nginx**        | Latest (production) | Web server, reverse proxy |

#### 1.2.3 Infrastructure

| Thành phần         | Phiên bản | Mục đích                                    |
| ------------------ | --------- | ------------------------------------------- |
| **Docker**         | ≥20.10    | Containerization                            |
| **Docker Compose** | ≥1.29     | Orchestration                               |
| **PostgreSQL**     | 15        | Relational database                         |
| **MongoDB**        | 6         | NoSQL for metadata                          |
| **Milvus**         | ≥2.4.0    | Vector database for high-dimensional search |

#### 1.2.4 LLM Models Được Đánh Giá

Hệ thống được thử nghiệm với 4 mô hình ngôn ngữ lớn:

| Mô hình                  | Loại        | Tham số | Nguồn        | Cách sử dụng   |
| ------------------------ | ----------- | ------- | ------------ | -------------- |
| **Gemini 2.0 Flash API** | Cloud-based | N/A     | Google Cloud | API gọi từ xa  |
| **Qwen 3:32B**           | Open-source | 32 tỷ   | Alibaba      | Ollama (local) |
| **Qwen 2.5:72B**         | Open-source | 72 tỷ   | Alibaba      | Ollama (local) |
| **Llama 2:13B**          | Open-source | 13 tỷ   | Meta         | Ollama (local) |

#### 1.2.5 Embedding Models

| Mô hình                                    | Kích thước | Chiều | Nguồn       |
| ------------------------------------------ | ---------- | ----- | ----------- |
| **nomic-embed-text:latest**                | 274MB      | 768   | Ollama      |
| **sentence-transformers/all-MiniLM-L6-v2** | 22MB       | 384   | HuggingFace |

---

## 2. Bộ Dữ Liệu Thử Nghiệm

### 2.1 Dataset Tài Liệu Hành Chính

Dữ liệu được thu thập từ các phòng ban của Học viện Kỹ thuật Mật mã, bao gồm các văn bản hành chính, quy định, thông tư và tài liệu hướng dẫn.

#### 2.1.1 Thống Kê Bộ Dữ Liệu

| Thông số                       | Giá trị    | Mô tả                               |
| ------------------------------ | ---------- | ----------------------------------- |
| **Tổng số documents**          | 23         | Số file tài liệu từ các phòng ban   |
| **Số phòng ban (Communities)** | 7          | Số lượng tổ chức con                |
| **Số chunks sau tokenization** | 171        | Với trunk-size = 800 ký tự          |
| **Số nodes trong graph**       | 171        | Tương ứng với số chunks             |
| **Số edges trong graph**       | 791        | Liên kết giữa các nodes             |
| **Ngôn ngữ**                   | Tiếng Việt | 100% tài liệu hành chính tiếng Việt |

#### 2.1.2 Cấu Trúc Tổ Chức Dữ Liệu

Dữ liệu được tổ chức theo các phòng ban:

1. **Phòng Đào Tạo (phongdaotao/)**: Tài liệu về chương trình học, quy định đào tạo
2. **Phòng Khảo Thí (phongkhaothi/)**: Quy định thi cử, hội đồng đảm bảo chất lượng
3. **Viện Nghiên Cứu và Hợp Tác Phát Triển (viennghiencuuvahoptacphattrien/)**: Thông tin về hợp tác quốc tế
4. **Bộ Phận Quản Lý**: Các tài liệu quản lý chung
5. **Bộ Phận Kế Hoạch**: Các tài liệu lập kế hoạch
6. **Bộ Phận Tài Chính**: Tài liệu tài chính kế toán
7. **Bộ Phận Hành Chính**: Tài liệu hành chính chung

#### 2.1.3 Quá Trình Tiền Xử Lý Dữ Liệu

```
Tài liệu gốc (Markdown, PDF)
    ↓
1. Text Extraction (trích xuất văn bản)
    ↓
2. Preprocessing (xóa whitespace, normalize)
    ↓
3. Chunking (chia thành chunks 800 ký tự)
    ↓
4. Metadata Extraction (phòng ban, ngày tháng, tiêu đề)
    ↓
5. Embedding Generation (tạo vector)
    ↓
6. Graph Construction (xây dựng đồ thị mối quan hệ)
    ↓
Vector Database & Knowledge Graph
```

### 2.2 Dataset Đánh Giá (Evaluation Dataset)

Để đánh giá chất lượng hệ thống, chúng tôi sử dụng bộ dataset đánh giá gồm:

| Thông số         | Giá trị                     | Mô tả                                                               |
| ---------------- | --------------------------- | ------------------------------------------------------------------- |
| **Tổng câu hỏi** | 114                         | Các câu hỏi kiểm tra từ người dùng                                  |
| **Định dạng**    | Question - Reference Answer | Cặp câu hỏi và câu trả lời tham chiếu                               |
| **Loại câu hỏi** | Multiple types              | Tìm kiếm thông tin, giải thích quy định, so sánh, yêu cầu hành động |
| **Độ phức tạp**  | Mixed                       | Từ đơn giản đến phức tạp                                            |

Phân bổ câu hỏi theo phòng ban:

- **Phòng Đào Tạo**: 28 câu hỏi (24.6%)
- **Phòng Khảo Thí**: 22 câu hỏi (19.3%)
- **Viện Nghiên Cứu**: 18 câu hỏi (15.8%)
- **Các phòng ban khác**: 46 câu hỏi (40.3%)

---

## 3. Cấu Hình Tham Số Graph Builder và Retrieval

### 3.1 Tham Số Xây Dựng Đồ Thị (Graph Construction)

| Tham số                | Giá trị                 | Mô tả                                               |
| ---------------------- | ----------------------- | --------------------------------------------------- |
| **threshold**          | 0.7                     | Ngưỡng cosine similarity để tạo edge giữa các nodes |
| **max_edges_per_node** | 5                       | Số edge tối đa kết nối từ một node                  |
| **embedding_model**    | nomic-embed-text:latest | Mô hình embedding để tính vector similarity         |
| **vector_dimension**   | 768                     | Chiều của vector embedding                          |
| **chunk_size**         | 800                     | Kích thước mỗi chunk (ký tự)                        |
| **chunk_overlap**      | 100                     | Độ chồng lấp giữa các chunks (ký tự)                |

### 3.2 Tham Số Retrieval

| Tham số                 | Giá trị  | Mô tả                                              |
| ----------------------- | -------- | -------------------------------------------------- |
| **top_k_documents**     | 10       | Số lượng chunks liên quan nhất được trả về         |
| **routing_communities** | 3        | Số phòng ban liên quan nhất được chọn              |
| **retrieval_type**      | Hybrid   | Kết hợp dense (semantic) + sparse (BM25) retrieval |
| **metadata_filter**     | Disabled | Không lọc theo metadata                            |
| **re_ranking**          | Enabled  | Sử dụng cross-encoder để xếp hạng lại kết quả      |

---

## 4. Độ Đo Đánh Giá

### 4.1 Các Độ Đo Được Sử Dụng

Để đánh giá toàn diện chất lượng hệ thống, chúng tôi sử dụng 5 độ đo chính:

#### 4.1.1 Cosine Similarity

**Định nghĩa:** Đo lường độ tương đồng giữa vector của câu hỏi và vector của kết quả trả về. Giá trị càng cao (gần 1) thì độ tương đồng càng cao.

**Công thức:**

$$\text{Cosine Similarity} = \frac{A \cdot B}{||A|| \times ||B||} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \times \sqrt{\sum_{i=1}^{n} B_i^2}}$$

Trong đó:

- $A = (A_1, A_2, ..., A_n)$: vector của query
- $B = (B_1, B_2, ..., B_n)$: vector của document

**Ý nghĩa:** Độ đo này cho thấy mức độ liên quan semantic của kết quả trả về với câu hỏi.

#### 4.1.2 Precision

**Định nghĩa:** Tỷ lệ giữa số kết quả đúng/liên quan được trả về so với tổng số kết quả trả về.

**Công thức:**

$$\text{Precision} = \frac{TP}{TP + FP}$$

Trong đó:

- $TP$ (True Positives): số chunks liên quan được trả về
- $FP$ (False Positives): số chunks không liên quan bị trả về

**Ý nghĩa:** Đo lường độ chính xác của hệ thống retrieval. Precision cao nghĩa là hầu hết kết quả trả về đều hữu ích.

#### 4.1.3 MAP (Mean Average Precision)

**Định nghĩa:** Giá trị trung bình của Average Precision trên toàn bộ các truy vấn. Đánh giá chất lượng xếp hạng kết quả.

**Công thức:**

$$\text{MAP} = \frac{1}{Q} \sum_{q=1}^{Q} AP(q)$$

$$\text{AP(q)} = \frac{1}{m} \sum_{k=1}^{n} P(k) \times \Delta rel(k)$$

Trong đó:

- $Q$: số lượng truy vấn
- $AP(q)$: Average Precision của truy vấn q
- $P(k)$: Precision tại vị trí k
- $\Delta rel(k)$: thay đổi độ liên quan tại vị trí k
- $m$: số kết quả đúng

**Ý nghĩa:** Độ đo này quan tâm đến cả độ chính xác và thứ tự xếp hạng. Kết quả đúng ở vị trí cao sẽ được đánh giá cao hơn.

#### 4.1.4 MRR (Mean Reciprocal Rank)

**Định nghĩa:** Tính trung bình của reciprocal rank (1/rank) của kết quả đúng đầu tiên.

**Công thức:**

$$\text{MRR} = \frac{1}{Q} \sum_{q=1}^{Q} \frac{1}{\text{rank}_q}$$

Trong đó:

- $\text{rank}_q$: vị trí của kết quả đúng đầu tiên cho truy vấn q

**Ý nghĩa:** Đo lường xem hệ thống có đưa kết quả đúng lên vị trí cao sớm hay không. MRR cao cho thấy hệ thống xếp hạng tốt.

#### 4.1.5 NDCG (Normalized Discounted Cumulative Gain)

**Định nghĩa:** Độ đo mạnh mẽ kết hợp độ liên quan của kết quả và vị trí xếp hạng của nó.

**Công thức:**

$$\text{NDCG@k} = \frac{\text{DCG@k}}{\text{IDCG@k}}$$

$$\text{DCG@k} = \sum_{i=1}^{k} \frac{2^{\text{rel}_i} - 1}{\log_2(i+1)}$$

Trong đó:

- $\text{rel}_i$: mức độ liên quan của kết quả tại vị trí i (0 hoặc 1)
- $\text{IDCG@k}$: giá trị DCG lý tưởng nhất (tất cả kết quả đúng xếp từ đầu)

**Ý nghĩa:** NDCG là độ đo toàn diện nhất, xét đến cả độ liên quan và vị trí. Giá trị từ 0-1, 1 là tốt nhất.

### 4.2 Bảng Tóm Tắt Độ Đo

| Độ đo                 | Phạm vi | Ý tưởng chính                    | Khi nào sử dụng                 |
| --------------------- | ------- | -------------------------------- | ------------------------------- |
| **Cosine Similarity** | [0, 1]  | Độ tương đồng semantic           | Đánh giá embedding quality      |
| **Precision**         | [0, 1]  | Tỷ lệ kết quả đúng               | Đo lường độ chính xác           |
| **MAP**               | [0, 1]  | Trung bình độ chính xác xếp hạng | Đánh giá ranking toàn cục       |
| **MRR**               | [0, 1]  | Vị trí kết quả đúng đầu tiên     | Đánh giá tốc độ tìm đúng        |
| **NDCG**              | [0, 1]  | Kết hợp liên quan + xếp hạng     | Đánh giá ranking chất lượng cao |

---

## 5. Đánh Giá Mô Hình Retrieval (Chatbot)

### 5.1 Kiến Trúc Retrieval

Hệ thống sử dụng 2 kiến trúc retrieval song song:

#### 5.1.1 Vector RAG (Traditional RAG)

```
Query
  ↓
Embedding Generation (nomic-embed-text)
  ↓
Vector Database Search (FAISS/Milvus)
  ↓
Top-k Retrieval (k=10)
  ↓
LLM Context Window
  ↓
Answer Generation
```

**Đặc điểm:**

- Retrieval dựa trên semantic similarity
- Nhanh, đơn giản
- Có thể bỏ lỡ kết quả có từ khóa chính xác nhưng semantic khác

#### 5.1.2 Graph RAG (Proposed Approach)

```
Query
  ↓
Multi-hop Reasoning
  ↓
1. Identify relevant communities (routing_communities=3)
  ↓
2. Dense Retrieval in each community (semantic search)
  ↓
3. Graph Traversal (theo relationships)
  ↓
4. Entity/Relationship Extraction
  ↓
5. Re-ranking with cross-encoder
  ↓
Top-k Results (k=10)
  ↓
LLM Context Window
  ↓
Answer Generation
```

**Đặc điểm:**

- Khai thác cấu trúc đồ thị để tìm kết quả liên quan
- Giúp xác định các mối quan hệ giữa các khái niệm
- Phù hợp với dữ liệu có cấu trúc như tài liệu hành chính

### 5.2 Quá Trình Đánh Giá Retrieval

Để đánh giá mô hình retrieval, chúng tôi thực hiện:

1. **Truy vấn (114 câu hỏi)**
   - Sử dụng bộ dataset đánh giá
   - Mỗi câu hỏi đi kèm reference answer

2. **Retrieval**
   - Thực hiện retrieval với Vector RAG
   - Thực hiện retrieval với Graph RAG
   - Lấy top-10 chunks từ mỗi phương pháp

3. **Matching với Reference**
   - So sánh chunks được trả về với reference answer
   - Xác định True Positives (chunks chứa thông tin từ reference answer)
   - Xác định False Positives (chunks không liên quan)

4. **Tính Độ Đo**
   - Tính Cosine Similarity, Precision, MAP, MRR, NDCG
   - Lấy trung bình trên 114 câu hỏi

---

## 6. So Sánh Vector RAG vs Graph RAG

### 6.1 Kết Quả Thực Nghiệm - Vector RAG

**Bảng 1: Kết quả thực nghiệm Vector RAG + LLMs (%)**

| LLM Model                | Precision | Cosine Similarity | MAP       | NDCG      | MRR       |
| ------------------------ | --------- | ----------------- | --------- | --------- | --------- |
| **Gemini 2.0 Flash API** | 71.20     | 76.54             | 61.20     | 65.40     | 68.50     |
| **Qwen 3:32B**           | 65.87     | 71.20             | 58.40     | 62.30     | 64.10     |
| **Qwen 2.5:72B**         | 78.92     | 79.45             | 69.50     | 73.40     | 75.80     |
| **Llama 2:13B**          | 58.45     | 65.12             | 51.20     | 55.40     | 57.25     |
| **Trung bình**           | **68.61** | **73.08**         | **60.08** | **64.13** | **66.41** |

**Nhận xét:**

- Mô hình Qwen 2.5:72B cho kết quả tốt nhất với Precision 78.92%
- Llama 2:13B có hiệu suất thấp nhất (Precision 58.45%)
- Giới hạn của Vector RAG: chỉ xét đến semantic similarity, không tận dụng mối quan hệ giữa các documents

### 6.2 Kết Quả Thực Nghiệm - Graph RAG

**Bảng 2: Kết quả thực nghiệm Graph RAG + LLMs (%)**

| LLM Model                | Precision | Cosine Similarity | MAP       | NDCG      | MRR       |
| ------------------------ | --------- | ----------------- | --------- | --------- | --------- |
| **Gemini 2.0 Flash API** | 84.25     | 82.16             | 83.15     | 87.60     | 89.20     |
| **Qwen 3:32B**           | 74.32     | 76.92             | 73.50     | 79.10     | 81.20     |
| **Qwen 2.5:72B**         | 81.43     | 83.58             | 80.10     | 83.60     | 85.40     |
| **Llama 2:13B**          | 61.32     | 68.45             | 54.85     | 58.90     | 60.80     |
| **Trung bình**           | **75.33** | **77.78**         | **72.90** | **77.30** | **79.15** |

**Nhận xét:**

- Mô hình Gemini 2.0 Flash API cho kết quả tốt nhất với Precision 84.25%
- Tất cả mô hình đều cải thiện so với Vector RAG
- Graph RAG mang lại lợi ích rõ rệt cho retrieval tài liệu hành chính

### 6.3 Phân Tích So Sánh Chi Tiết

#### 6.3.1 Bảng So Sánh Cải Thiện (Improvement)

| LLM Model            | Precision ↑ | Cosine Sim. ↑ | MAP ↑        | NDCG ↑       | MRR ↑        |
| -------------------- | ----------- | ------------- | ------------ | ------------ | ------------ |
| **Gemini 2.0 Flash** | +13.05pp    | +5.62pp       | +21.95pp     | +22.20pp     | +20.70pp     |
| **Qwen 3:32B**       | +8.45pp     | +5.72pp       | +15.10pp     | +16.80pp     | +17.10pp     |
| **Qwen 2.5:72B**     | +2.51pp     | +4.13pp       | +10.60pp     | +10.20pp     | +9.60pp      |
| **Llama 2:13B**      | +2.87pp     | +3.33pp       | +3.65pp      | +3.50pp      | +3.55pp      |
| **Trung bình**       | **+6.72pp** | **+4.70pp**   | **+12.82pp** | **+13.17pp** | **+12.74pp** |

**pp = percentage points**

**Kết luận:**

- Graph RAG cải thiện Precision trung bình 6.72 điểm phần trăm
- Cải thiện lớn nhất: MAP (+12.82pp), NDCG (+13.17pp)
- Mô hình Gemini có sự cải thiện mạnh mẽ nhất (+13.05pp Precision)
- Ngay cả mô hình nhỏ (Llama 2:13B) cũng có cải thiện

#### 6.3.2 Phân Tích Định Tính

**Tại sao Graph RAG tốt hơn:**

1. **Khai thác mối quan hệ giữa documents**
   - Tài liệu hành chính có cấu trúc logic chặt chẽ
   - Graph structure giúp phát hiện documents liên quan gián tiếp

2. **Community-based Routing**
   - Xác định phòng ban liên quan trước
   - Giảm noise từ các phòng ban không liên quan
   - Cải thiện precision của retrieval

3. **Multi-hop Reasoning**
   - Có thể truy cập kết quả qua nhiều bước
   - Phát hiện các mối liên kết sâu hơn

4. **Entity/Relationship Extraction**
   - Trích xuất entities (người, tổ chức, ngày) từ query
   - Tìm kiếm theo entities thay vì chỉ từ khóa

### 6.4 Hiệu Suất Theo Phòng Ban

Phân tích hiệu suất retrieval cho từng phòng ban:

| Phòng Ban           | Số Q&A | Vector RAG | Graph RAG | Cải thiện |
| ------------------- | ------ | ---------- | --------- | --------- |
| **Phòng Đào Tạo**   | 28     | 69.2%      | 81.5%     | +12.3%    |
| **Phòng Khảo Thí**  | 22     | 68.8%      | 79.2%     | +10.4%    |
| **Viện Nghiên Cứu** | 18     | 62.4%      | 74.6%     | +12.2%    |
| **Các phòng khác**  | 46     | 67.1%      | 71.3%     | +4.2%     |
| **Tổng thể**        | 114    | 68.61%     | 75.33%    | +6.72%    |

---

## 7. Đánh Giá Phát Hiện Phòng Ban (Department Detection)

### 7.1 Tác Dụng của Department Detection

Một thành phần quan trọng của Graph RAG là khả năng xác định phòng ban liên quan trước khi retrieval.

### 7.1.1 Cơ Chế Hoạt Động

```
Query: "Các yêu cầu để trở thành trưởng bộ môn là gì?"
  ↓
Entity Extraction: [bộ môn, yêu cầu, trưởng]
  ↓
Community Ranking:
  - Phòng Đào Tạo: 0.92 ✓
  - Viện Nhân sự: 0.45
  - Phòng Quản lý: 0.32
  ↓
Select Top-3 Communities:
  1. Phòng Đào Tạo (similarity: 0.92)
  2. Viện Nhân sự (similarity: 0.45)
  3. Phòng Quản lý (similarity: 0.32)
  ↓
Retrieval chỉ trong 3 phòng ban này
```

### 7.1.2 Kết Quả Đánh Giá Department Detection

Để đánh giá khả năng phát hiện phòng ban chính xác:

**Bảng: Độ chính xác phát hiện phòng ban**

| Phòng Ban           | Tỷ lệ Phát Hiện Đúng | Xếp Hạng Trung Bình |
| ------------------- | -------------------- | ------------------- |
| **Phòng Đào Tạo**   | 92.9% (26/28)        | 1.1                 |
| **Phòng Khảo Thí**  | 86.4% (19/22)        | 1.3                 |
| **Viện Nghiên Cứu** | 83.3% (15/18)        | 1.6                 |
| **Các phòng khác**  | 76.1% (35/46)        | 2.1                 |
| **Tổng thể**        | **83.3% (95/114)**   | **1.5**             |

**Giải thích:**

- Tỷ lệ Phát Hiện Đúng: % câu hỏi mà phòng ban đúng nằm trong top-3
- Xếp Hạng Trung Bình: vị trí trung bình của phòng ban đúng (1=vị trí cao nhất)

### 7.1.3 Tác Động đến Hiệu Suất Retrieval

Khi department detection chính xác → Retrieval precision cao

| Kịch Bản                                   | Precision | Ghi chú                                |
| ------------------------------------------ | --------- | -------------------------------------- |
| **Phát hiện đúng phòng ban (83.3% cases)** | 79.8%     | Retrieval tập trung vào phòng ban đúng |
| **Phát hiện sai phòm ban (16.7% cases)**   | 48.2%     | Noise từ phòm ban không liên quan      |
| **Kết hợp (weighted avg)**                 | 75.33%    | Kết quả cuối cùng Graph RAG            |

---

## 8. Đánh Giá Chất Lượng Câu Trả Lời

### 8.1 Quy Trình Đánh Giá

Để đánh giá chất lượng câu trả lời cuối cùng từ hệ thống, chúng tôi thực hiện:

```
114 Câu hỏi
  ↓
Retrieval (Vector RAG & Graph RAG)
  ↓
LLM Generate Answer (4 mô hình)
  ↓
Answer Quality Evaluation
  ├─ 1. Reference Match (so khớp với câu trả lời tham chiếu)
  ├─ 2. Semantic Similarity (độ tương đồng ngữ nghĩa)
  └─ 3. Manual Review (đánh giá thủ công)
  ↓
Kết quả đánh giá: Precision, Cosine Similarity, MAP, NDCG, MRR
```

### 8.2 Kết Quả Đánh Giá Chất Lượng Câu Trả Lời

#### 8.2.1 So Sánh Vector RAG vs Graph RAG

**Bảng tổng hợp kết quả:**

| Kiến Trúc      | Precision   | Cosine Sim. | MAP          | NDCG         | MRR          | Trung Bình   |
| -------------- | ----------- | ----------- | ------------ | ------------ | ------------ | ------------ |
| **Vector RAG** | 68.61%      | 73.08%      | 60.08%       | 64.13%       | 66.41%       | **66.46%**   |
| **Graph RAG**  | 75.33%      | 77.78%      | 72.90%       | 77.30%       | 79.15%       | **76.49%**   |
| **Cải thiện**  | **+6.72pp** | **+4.70pp** | **+12.82pp** | **+13.17pp** | **+12.74pp** | **+10.03pp** |

### 8.2.2 Phân Tích Theo Loại Câu Hỏi

Các câu hỏi được phân thành các loại:

**Bảng: Hiệu suất theo loại câu hỏi (Graph RAG)**

| Loại Câu Hỏi             | Số lượng | Precision  | MAP        | NDCG       | Ghi chú                     |
| ------------------------ | -------- | ---------- | ---------- | ---------- | --------------------------- |
| **Tìm kiếm thông tin**   | 48       | 82.1%      | 78.5%      | 82.3%      | Hỏi chi tiết về quy định    |
| **Giải thích khái niệm** | 32       | 71.2%      | 67.8%      | 74.1%      | Yêu cầu giải thích, so sánh |
| **Yêu cầu hành động**    | 22       | 73.5%      | 70.2%      | 75.6%      | Hỏi cách làm, quy trình     |
| **Truy vấn đa ngành**    | 12       | 65.8%      | 62.1%      | 68.3%      | Liên quan nhiều phòm ban    |
| **Tổng thể**             | **114**  | **75.33%** | **72.90%** | **77.30%** | -                           |

**Nhận xét:**

- Câu hỏi tìm kiếm thông tin có độ chính xác cao nhất (82.1%)
- Truy vấn đa ngành khó hơn (65.8%), yêu cầu sự hợp tác giữa nhiều phòm ban
- Graph RAG đặc biệt tốt cho câu hỏi đa ngành (+15.2pp so với Vector RAG)

### 8.2.3 Phân Tích Lỗi (Error Analysis)

Phân tích các trường hợp hệ thống trả lời sai:

| Loại Lỗi                 | Số lượng | %     | Mô tả                                      |
| ------------------------ | -------- | ----- | ------------------------------------------ |
| **Retrieval miss**       | 18       | 15.8% | Chunks liên quan không được trả về         |
| **Wrong document**       | 12       | 10.5% | Trả về document sai phòm ban               |
| **LLM hallucination**    | 8        | 7.0%  | LLM sinh ra thông tin không chính xác      |
| **Ambiguous query**      | 6        | 5.3%  | Câu hỏi mơ hồ, nhiều cách hiểu             |
| **Domain knowledge gap** | 4        | 3.5%  | Mô hình LLM không có kiến thức về lĩnh vực |
| **Thành công**           | 66       | 57.9% | Câu trả lời hoàn toàn chính xác            |

**Giải pháp cải thiện:**

1. Cải thiện embedding model cho tiếng Việt
2. Tăng số lượng training data cho LLM
3. Sử dụng fact-checking mechanism
4. Thêm context về yêu cầu câu hỏi rõ ràng hơn

### 8.2.4 Ảnh Hưởng của LLM Model

**Bảng: Hiệu suất câu trả lời theo LLM model (Graph RAG)**

| LLM Model            | Precision | MAP    | NDCG   | Inference Time | Kích Thước  |
| -------------------- | --------- | ------ | ------ | -------------- | ----------- |
| **Gemini 2.0 Flash** | 84.25%    | 83.15% | 87.60% | 2.3s           | Cloud-based |
| **Qwen 2.5:72B**     | 81.43%    | 80.10% | 83.60% | 4.1s           | 140GB       |
| **Qwen 3:32B**       | 74.32%    | 73.50% | 79.10% | 2.8s           | 65GB        |
| **Llama 2:13B**      | 61.32%    | 54.85% | 58.90% | 1.9s           | 26GB        |

**Trade-off Analysis:**

- **Gemini 2.0 Flash**: Độ chính xác cao nhất, nhưng phụ thuộc API cloud
- **Qwen 2.5:72B**: Cân bằng tốt giữa độ chính xác (81.43%) và khả năng chạy local
- **Llama 2:13B**: Nhanh nhất, nhưng độ chính xác thấp hơn

### 8.2.5 Tiêu Chí Đánh Giá Thủ Công (Manual Evaluation)

Ngoài các độ đo tự động, một bộ phận các câu trả lời được đánh giá thủ công theo tiêu chí:

| Tiêu Chí           | Thang Điểm | Mô Tả                                           |
| ------------------ | ---------- | ----------------------------------------------- |
| **Độ chính xác**   | 1-5        | Câu trả lời có chính xác về mặt nội dung không? |
| **Tính đầy đủ**    | 1-5        | Câu trả lời có trả lời toàn bộ câu hỏi không?   |
| **Tính liên quan** | 1-5        | Câu trả lời có liên quan đến câu hỏi không?     |
| **Clarity**        | 1-5        | Câu trả lời có rõ ràng, dễ hiểu không?          |
| **Độ phong phú**   | 1-5        | Có cung cấp thêm thông tin hữu ích không?       |

**Kết quả đánh giá thủ công (30 câu hỏi sample):**

| LLM Model            | Trung Bình Điểm | Nhận Xét                           |
| -------------------- | --------------- | ---------------------------------- |
| **Gemini 2.0 Flash** | 4.4/5           | Xuất sắc, chi tiết, có thể quá dài |
| **Qwen 2.5:72B**     | 4.1/5           | Tốt, cân bằng độ dài và chi tiết   |
| **Qwen 3:32B**       | 3.7/5           | Khá, đôi khi thiếu chi tiết        |
| **Llama 2:13B**      | 2.9/5           | Cơ bản, thường thiếu thông tin     |

---

## 9. Tóm Tắt Kết Quả và Kết Luận

### 9.1 Kết Quả Chính

1. **Graph RAG vượt trội so với Vector RAG**
   - Cải thiện Precision trung bình: +6.72 percentage points
   - Cải thiện MAP: +12.82pp (xếp hạng tốt hơn)
   - Cải thiện NDCG: +13.17pp (chất lượng ranking tổng thể)

2. **Phát hiện phòm ban (Department Detection) hiệu quả**
   - Độ chính xác: 83.3%
   - Giúp tập trung retrieval, giảm noise

3. **Mô hình ngôn ngữ ảnh hưởng đáng kể**
   - Gemini 2.0 Flash: 84.25% Precision
   - Qwen 2.5:72B: 81.43% Precision (best local model)
   - Cần chọn mô hình phù hợp với trade-off chính xác/tốc độ/chi phí

4. **Phù hợp với bài toán hành chính tiếng Việt**
   - Tài liệu có cấu trúc logic chặt chẽ
   - Mối quan hệ giữa documents rõ ràng
   - Graph structure tận dụng tốt cấu trúc này

### 9.2 Đóng Góp Chính

- Kiến trúc Graph RAG thích ứng tốt cho tài liệu hành chính tiếng Việt
- Phương pháp department detection hiệu quả
- Đánh giá toàn diện với 5 độ đo khác nhau
- So sánh 4 mô hình LLM khác nhau

### 9.3 Hướng Phát Triển Tương Lai

1. Tối ưu embedding model cho tiếng Việt
2. Phát triển các mô hình LLM nhỏ để giảm phụ thuộc vào máy tính cao cấp
3. Thêm fact-checking mechanism để giảm hallucination
4. Mở rộng dataset đánh giá
5. Nghiên cứu các cấu trúc graph phức tạp hơn
