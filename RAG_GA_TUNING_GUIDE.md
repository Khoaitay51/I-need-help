# RAG/GraphRAG GA Tuning Guide

Tài liệu này tập trung riêng vào phần RAG/GraphRAG của KMA Agent và cách triển khai Genetic Algorithm để tối ưu 3 tham số:

```text
threshold ∈ [0.3, 0.9], step = 0.1
max_edges_per_node ∈ [3, 10], step = 1
top_k ∈ [3, 10], step = 1
```

Mục tiêu: tìm cấu hình GraphRAG cho retrieval tốt nhất trước khi đưa vào GA/production.

## 1. RAG hiện tại nằm ở đâu?

Các file chính:

```text
api/src/rag/tool.py
api/src/rag/rag_graph.py
api/src/rag/retriever.py
api/src/rag/table_aware_chunking.py
api/src/graph_rag/graph_builder.py
api/src/graph_rag/department_graph_manager.py
api/src/graph_rag/graph_retriever.py
api/src/graph_rag/subgraph_partitioner.py
api/src/graph_rag/semantic_department_detector.py
api/src/backend/api/admin_rag.py
api/test_rag_comparison.py
api/src/evaluation/metrics.py
```

Luồng hỏi tài liệu chính:

```text
User question
  -> /api/chat/{conversation_id}/messages
  -> agent.supervisor_agent.ReActGraph
  -> search_kma_regulations tool
  -> rag.rag_graph.process_kma_query_sync()
  -> DepartmentGraphManager.query_smart()
  -> GraphRoutedRetriever._get_relevant_documents()
  -> LLM answer generation with retrieved context
```

## 2. GraphRAG hiện tại hoạt động thế nào?

GraphRAG có 2 pha lớn:

```text
Pha build graph:
Documents -> chunks -> embeddings -> graph nodes/edges -> communities -> save graph

Pha query:
Query -> detect department -> route communities -> retrieve nodes/chunks -> rerank -> top_k docs -> LLM
```

### 2.1 Pha build graph

Code chính: `api/src/graph_rag/graph_builder.py`.

Class:

```python
class DocumentGraph:
    def __init__(
        self,
        semantic_threshold: float = 0.7,
        max_semantic_edges_per_node: int = 5,
        embeddings_model: str = None
    )
```

Mỗi chunk tài liệu là một node.

Graph có 3 loại edge:

1. `structural`: nối các chunk liên tiếp trong cùng file.
2. `metadata_*`: nối chunk có metadata giống nhau như department/category/education_level.
3. `semantic`: nối chunk có cosine similarity vượt threshold.

Hai tham số GA tác động trực tiếp vào pha build graph:

```text
threshold -> DocumentGraph.semantic_threshold
max_edges_per_node -> DocumentGraph.max_semantic_edges_per_node
```

Trong code, semantic edge được tạo tại `_add_semantic_edges()`:

```python
k = self.max_semantic_edges_per_node + 1
distances, indices = index.search(embeddings_matrix, k)

if similarity >= self.semantic_threshold:
    self.graph.add_edge(i, j, edge_type="semantic", weight=similarity)
```

Ý nghĩa:

- threshold thấp hơn: graph dày hơn, recall có thể tăng nhưng noise cũng tăng.
- threshold cao hơn: graph thưa hơn, precision có thể tăng nhưng dễ miss tài liệu liên quan gián tiếp.
- max_edges_per_node lớn hơn: mỗi node nối được nhiều semantic neighbor hơn, tăng coverage nhưng tăng chi phí build/query và noise.

### 2.2 Pha quản lý graph theo phòng ban

Code chính: `api/src/graph_rag/department_graph_manager.py`.

Hiện code build graph department đang hard-code:

```python
graph_builder = DocumentGraph(
    semantic_threshold=0.7,
    max_semantic_edges_per_node=7
)
```

Và retriever đang hard-code:

```python
retriever = GraphRoutedRetriever(
    graph=graph,
    partitioner=partitioner,
    embeddings_model="nomic-embed-text:latest",
    k=10,
    internal_k=30,
    hop_depth=3,
    expansion_factor=2.5
)
```

Đây là vị trí cần parameterize để GA truyền cấu hình.

### 2.3 Pha retrieval

Code chính: `api/src/graph_rag/graph_retriever.py`.

Class:

```python
class GraphRoutedRetriever(BaseRetriever):
    def __init__(
        self,
        graph,
        partitioner,
        k: int = 4,
        internal_k: int = None,
        hop_depth: int = 2,
        expansion_factor: float = 1.5,
        embeddings_model: str = None
    )
```

Tham số GA thứ ba:

```text
top_k -> GraphRoutedRetriever.k
```

Ý nghĩa:

- `top_k` là số document/chunk cuối cùng đưa sang LLM.
- top_k thấp: context ngắn, ít noise, nhanh hơn nhưng dễ thiếu thông tin.
- top_k cao: context nhiều hơn, tăng recall nhưng có thể làm LLM nhiễu và tốn token.

Nên hiểu thêm:

```text
k: số chunk cuối cùng trả về cho LLM
internal_k: số candidate nội bộ để expand/rerank
hop_depth: độ sâu graph traversal
expansion_factor: mức mở rộng node từ seed
```

Trong bài toán GA hiện tại, chỉ tối ưu `k`, chưa tối ưu `internal_k`, `hop_depth`, `expansion_factor`.

## 3. Search space của GA

Các giá trị:

```python
threshold_values = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
max_edges_values = [3, 4, 5, 6, 7, 8, 9, 10]
top_k_values = [3, 4, 5, 6, 7, 8, 9, 10]
```

Tổng số cấu hình nếu grid search:

```text
7 * 8 * 8 = 448 cấu hình
```

448 cấu hình không quá lớn về mặt tổ hợp, nhưng rất đắt nếu mỗi cấu hình đều rebuild graph từ đầu. GA có lợi khi:

- Graph build tốn thời gian.
- Dataset lớn.
- Muốn giảm số cấu hình phải thử.
- Sau này thêm nhiều tham số nữa như `hop_depth`, `internal_k`, `expansion_factor`, chunk_size, chunk_overlap.

## 4. Genotype và phenotype

Một cá thể GA nên biểu diễn bằng 3 gene rời rạc:

```python
chromosome = {
    "threshold": 0.7,
    "max_edges_per_node": 7,
    "top_k": 10
}
```

Hoặc dùng index để crossover/mutation dễ hơn:

```python
chromosome = [threshold_idx, max_edges_idx, top_k_idx]
```

Decode:

```python
threshold = threshold_values[threshold_idx]
max_edges_per_node = max_edges_values[max_edges_idx]
top_k = top_k_values[top_k_idx]
```

Khuyến nghị dùng index rời rạc để mutation không sinh giá trị ngoài range.

## 5. Fitness nên đo gì?

Phần RAG tuning nên ưu tiên retrieval quality, không nên dùng LLM answer quality làm fitness chính ở vòng đầu, vì LLM làm kết quả nhiễu và tốn chi phí.

Metric có sẵn:

```text
Precision@K
Recall@K
MAP
MRR
NDCG
Cosine similarity
Retrieval latency
Graph size/edge count
```

Code metric:

```text
api/src/evaluation/metrics.py
api/test_rag_comparison.py
```

Khuyến nghị fitness:

```text
fitness = 0.35 * NDCG
        + 0.25 * MAP
        + 0.20 * MRR
        + 0.15 * Precision@K
        + 0.05 * Recall@K
        - latency_penalty
        - graph_density_penalty
```

Trong đó:

```text
latency_penalty = min(avg_retrieval_time_ms / 5000, 1.0) * 0.05
graph_density_penalty = min(avg_degree / 50, 1.0) * 0.03
```

Nếu bạn chưa có relevance label nhiều mức, dùng binary relevance là đủ:

```text
relevant = 1 nếu retrieved doc/chunk là ground truth hoặc có semantic similarity cao với answer_expected
relevant = 0 nếu không
```

## 6. Dataset đánh giá

Repo hiện có:

```text
dataset chatbot update.csv
api/test_rag_comparison.py
```

`api/test_rag_comparison.py` hiện load CSV với cột:

```text
question
answer_expected
```

Cách đánh giá hiện tại trong script là tạo document từ `answer_expected`, rồi coi index của expected answer là ground truth. Cách này phù hợp để test nhanh nhưng chưa phản ánh đầy đủ retrieval thật trên `api/data`.

Có 2 hướng:

### Hướng A: quick benchmark

Dùng `answer_expected` làm corpus như `test_rag_comparison.py`.

Ưu điểm:

- Dễ chạy.
- Có ground truth rõ.
- Nhanh để debug GA.

Nhược điểm:

- Không đánh giá đúng graph thật từ `api/data`.

### Hướng B: production-like benchmark

Dùng corpus thật trong `api/data`, mỗi câu hỏi có:

```text
question
answer_expected
expected_file
expected_department
expected_clause
expected_keywords
```

Khi retrieval trả chunks, đánh giá relevant nếu:

- chunk metadata file trùng `expected_file`, hoặc
- chunk chứa `expected_clause`, hoặc
- similarity(chunk, answer_expected) >= threshold đánh giá, ví dụ 0.75.

Khuyến nghị cho GA thật: dùng hướng B.

## 7. Điểm quan trọng: tham số nào cần rebuild graph?

Không phải tham số nào cũng tốn như nhau.

```text
threshold              -> cần rebuild graph
max_edges_per_node     -> cần rebuild graph
top_k                  -> không cần rebuild graph, chỉ cần tạo retriever mới hoặc query với k mới
```

Vì vậy nên cache theo cặp:

```text
graph_key = f"threshold_{threshold}_edges_{max_edges_per_node}"
```

Sau đó với cùng graph, thử nhiều `top_k` nhanh hơn.

Ví dụ:

```text
threshold=0.7, max_edges=7
  -> build graph một lần
  -> evaluate top_k=3..10 trên cùng graph
```

Nếu làm tốt, số lần build graph tối đa chỉ là:

```text
7 * 8 = 56 graph builds
```

Không phải 448 lần build.

## 8. Vị trí nên sửa để hỗ trợ GA

Không nên nhúng GA vào API production ngay. Nên tạo script experiment riêng:

```text
api/experiments/ga_tune_graphrag.py
```

Và thêm helper config nhẹ trong code GraphRAG:

```text
api/src/graph_rag/tuning_config.py
```

Hoặc truyền thẳng config vào `DepartmentGraphManager`.

### 8.1 Parameterize DepartmentGraphManager

Hiện `DepartmentGraphManager.build_department_graphs()` hard-code:

```python
DocumentGraph(
    semantic_threshold=0.7,
    max_semantic_edges_per_node=7
)
```

Nên đổi concept thành:

```python
def build_department_graphs(
    self,
    documents,
    dept_documents_override=None,
    semantic_threshold=0.7,
    max_semantic_edges_per_node=7,
    retriever_top_k=10
):
    graph_builder = DocumentGraph(
        semantic_threshold=semantic_threshold,
        max_semantic_edges_per_node=max_semantic_edges_per_node
    )
```

Với load graph, vì graph đã save theo threshold/edges, cần output folder riêng cho mỗi config:

```text
api/experiments/rag_ga_runs/t0.7_e7/
```

Không ghi đè graph production trong:

```text
api/graphs/department_graphs/
```

### 8.2 Parameterize GraphRoutedRetriever.k

Hiện load retriever trong `DepartmentGraphManager` hard-code `k=10`.

Nên cho phép:

```python
DepartmentGraphManager(..., retriever_top_k=top_k)
```

Hoặc tạo method:

```python
def set_retriever_top_k(self, top_k: int):
    for retriever in self.department_retrievers.values():
        retriever.k = top_k
        retriever.internal_k = max(top_k * 3, 10)
```

Khuyến nghị:

```text
internal_k = max(3 * top_k, 10)
```

Vì nếu `top_k` nhỏ mà `internal_k` quá nhỏ, graph expansion/rerank sẽ bị nghèo candidate.

## 9. GA workflow đề xuất

```text
1. Load evaluation dataset
2. Generate initial population
3. For each individual:
   a. Decode threshold, max_edges_per_node, top_k
   b. Load graph cache if exists
   c. If not exists, build graph with threshold/max_edges
   d. Create retriever with top_k
   e. Run all evaluation queries
   f. Calculate metrics and fitness
4. Select parents
5. Crossover
6. Mutation
7. Elitism: keep best N individuals
8. Repeat generations
9. Save best config + full experiment report
```

## 10. GA hyperparameters đề xuất

Vì search space ban đầu là 448, nên GA không cần quá lớn.

Khuyến nghị:

```python
POPULATION_SIZE = 16
GENERATIONS = 12
ELITE_SIZE = 2
TOURNAMENT_SIZE = 3
CROSSOVER_RATE = 0.8
MUTATION_RATE = 0.2
RANDOM_SEED = 42
```

Tổng số evaluations xấp xỉ:

```text
16 * 12 = 192 individuals
```

Nhỏ hơn grid 448. Nếu cache graph tốt, chi phí build còn thấp hơn vì nhiều individual trùng threshold/max_edges.

Nếu muốn chắc chắn hơn:

```python
POPULATION_SIZE = 24
GENERATIONS = 15
```

Tổng khoảng 360 evaluations, vẫn thấp hơn grid search.

## 11. Selection, crossover, mutation

### 11.1 Selection

Dùng tournament selection:

```python
def tournament_select(population, k=3):
    candidates = random.sample(population, k)
    return max(candidates, key=lambda x: x.fitness)
```

Ưu điểm:

- Dễ implement.
- Không cần normalize fitness.
- Ổn với population nhỏ.

### 11.2 Crossover

Vì chromosome chỉ có 3 gene, dùng uniform crossover:

```python
child_gene[i] = parent_a[i] if random.random() < 0.5 else parent_b[i]
```

Ví dụ:

```text
Parent A = [4, 2, 7] -> threshold=0.7, max_edges=5, top_k=10
Parent B = [2, 6, 3] -> threshold=0.5, max_edges=9, top_k=6
Child    = [4, 6, 3] -> threshold=0.7, max_edges=9, top_k=6
```

### 11.3 Mutation

Mutation theo index rời rạc:

```python
if random.random() < mutation_rate:
    gene_idx = random.choice([0, 1, 2])
    chromosome[gene_idx] = random_valid_index_for_that_gene()
```

Có thể dùng mutation lân cận để tránh nhảy quá mạnh:

```python
new_idx = current_idx + random.choice([-1, 1])
new_idx = clamp(new_idx, 0, max_idx)
```

Khuyến nghị:

- 70% mutation lân cận.
- 30% mutation random toàn range.

## 12. Pseudocode runner

```python
threshold_values = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
max_edges_values = list(range(3, 11))
top_k_values = list(range(3, 11))

def decode(chromosome):
    return {
        "threshold": threshold_values[chromosome[0]],
        "max_edges_per_node": max_edges_values[chromosome[1]],
        "top_k": top_k_values[chromosome[2]],
    }

def evaluate(chromosome):
    cfg = decode(chromosome)
    graph_dir = get_or_build_graph(
        threshold=cfg["threshold"],
        max_edges_per_node=cfg["max_edges_per_node"],
    )
    manager = load_manager(
        graph_dir=graph_dir,
        top_k=cfg["top_k"],
    )
    metrics = run_eval_queries(manager)
    fitness = compute_fitness(metrics)
    return fitness, metrics

population = init_population()

for generation in range(GENERATIONS):
    evaluated = [evaluate(ind) for ind in population]
    elites = keep_best(evaluated, ELITE_SIZE)
    children = []
    while len(children) < POPULATION_SIZE - ELITE_SIZE:
        p1 = tournament_select(evaluated)
        p2 = tournament_select(evaluated)
        child = crossover(p1, p2)
        child = mutate(child)
        children.append(child)
    population = elites + children

best = max(evaluated, key=lambda x: x.fitness)
save_report(best)
```

## 13. Output report nên lưu gì?

Mỗi run nên lưu:

```text
api/experiments/rag_ga_results/
├── ga_run_YYYYMMDD_HHMMSS.json
├── ga_run_YYYYMMDD_HHMMSS.csv
├── best_config.json
└── best_config_report.md
```

Mỗi individual cần lưu:

```json
{
  "generation": 3,
  "individual_id": "g3_i7",
  "chromosome": [4, 6, 3],
  "threshold": 0.7,
  "max_edges_per_node": 9,
  "top_k": 6,
  "fitness": 0.8123,
  "metrics": {
    "precision_at_k": 0.76,
    "recall_at_k": 0.81,
    "map": 0.73,
    "mrr": 0.84,
    "ndcg": 0.82,
    "avg_retrieval_time_ms": 430.2,
    "avg_degree": 12.4,
    "total_edges": 1234
  }
}
```

## 14. Cách chạy experiment an toàn

Không chạy GA trên graph production.

Nên dùng thư mục riêng:

```text
api/experiments/rag_ga_runs/
```

Mỗi config build vào:

```text
api/experiments/rag_ga_runs/t{threshold}_e{max_edges}/department_graphs/
```

Ví dụ:

```text
api/experiments/rag_ga_runs/t0.7_e7/department_graphs/
api/experiments/rag_ga_runs/t0.8_e5/department_graphs/
```

Khi tìm được best config, mới copy/rebuild production graph:

```text
api/graphs/department_graphs/
```

## 15. Baseline cần so trước GA

Config hiện tại trong production-like code:

```text
threshold = 0.7
max_edges_per_node = 7
top_k = 10
internal_k = 30
hop_depth = 3
expansion_factor = 2.5
```

Trước khi chạy GA, hãy đo baseline:

```text
baseline_fitness
baseline_precision
baseline_map
baseline_mrr
baseline_ndcg
baseline_latency
baseline_total_edges
```

Best GA chỉ nên được chấp nhận nếu:

```text
fitness tăng rõ ràng
NDCG hoặc MAP tăng
latency không vượt ngưỡng vận hành
answer quality không tệ hơn khi kiểm thử thủ công
```

## 16. Khi nào threshold thấp/tăng là tốt?

### threshold thấp: 0.3 - 0.5

Ưu điểm:

- Nhiều semantic edges.
- Dễ tìm quan hệ xa.
- Recall cao hơn.

Nhược điểm:

- Graph nhiễu.
- Community có thể bị trộn.
- Precision/NDCG có thể giảm.
- Query chậm hơn do nhiều edge.

Phù hợp nếu dataset ít tài liệu hoặc câu hỏi cần multi-hop mạnh.

### threshold trung bình: 0.6 - 0.7

Ưu điểm:

- Cân bằng precision/recall.
- Thường là vùng tốt cho tài liệu hành chính.

Đây là baseline hợp lý.

### threshold cao: 0.8 - 0.9

Ưu điểm:

- Edge semantic đáng tin hơn.
- Ít noise.
- Có thể tăng precision.

Nhược điểm:

- Graph thưa.
- Dễ miss thông tin liên quan gián tiếp.
- Community có thể rời rạc.

Phù hợp nếu tài liệu nhiều, embedding tốt, câu hỏi thường rõ phòng ban.

## 17. Khi nào max_edges_per_node thấp/tăng là tốt?

### 3 - 5 edges/node

Ưu điểm:

- Graph gọn.
- Query nhanh.
- Ít noise.

Nhược điểm:

- Có thể thiếu bridge giữa các đoạn liên quan.

### 6 - 8 edges/node

Thường là vùng cân bằng cho GraphRAG hiện tại.

### 9 - 10 edges/node

Ưu điểm:

- Coverage rộng.
- Tốt nếu tài liệu phân tán, có nhiều cách diễn đạt.

Nhược điểm:

- Graph dày.
- Community dễ bị lẫn.
- Retrieval có thể đưa context thừa.

## 18. Khi nào top_k thấp/tăng là tốt?

### top_k = 3 - 5

Ưu điểm:

- Context gọn.
- Ít token.
- LLM ít bị nhiễu.
- Nhanh.

Nhược điểm:

- Dễ thiếu điều/khoản liên quan.

### top_k = 6 - 8

Thường là vùng cân bằng.

### top_k = 9 - 10

Ưu điểm:

- Nhiều context.
- Tốt cho câu hỏi tổng hợp/nhiều điều khoản.

Nhược điểm:

- Dễ đưa tài liệu thừa.
- Tốn token.
- Có thể làm LLM trả lời dài hoặc lẫn nguồn.

## 19. Kiểm thử sau khi GA tìm best config

Sau khi có best config, cần test 3 lớp:

### 19.1 Retrieval-only test

Chạy toàn bộ evaluation dataset:

```text
Precision@K
Recall@K
MAP
MRR
NDCG
Latency
```

### 19.2 End-to-end answer test

Gửi câu hỏi qua API thật:

```text
POST /api/chat/quick-messages
POST /api/chat/{conversation_id}/messages
```

Check:

- Câu trả lời đúng.
- Có nguồn.
- Không hallucinate.
- Không lấy nhầm phòng ban.
- Không quá dài.

### 19.3 Regression set thủ công

Tạo một file câu hỏi cố định cho các case khó:

```text
questions_regression.json
```

Nên có:

- câu hỏi phòng đào tạo
- câu hỏi phòng khảo thí
- câu hỏi viện nghiên cứu
- câu hỏi có bảng
- câu hỏi follow-up
- câu hỏi mơ hồ
- câu hỏi gần giống nhưng khác phòng ban

## 20. Sai lầm cần tránh

- Không dùng LLM answer làm fitness duy nhất.
- Không rebuild graph production trong lúc GA đang chạy.
- Không so config chỉ bằng Precision, vì top_k thấp có thể làm Precision đẹp nhưng recall kém.
- Không tăng top_k quá cao nếu context window/latency không chịu được.
- Không đánh giá bằng một dataset quá nhỏ.
- Không dùng random seed khác nhau mà không ghi lại.
- Không quên log graph density, vì threshold thấp + max_edges cao có thể làm graph quá dày.

## 21. Cấu hình GA nên thử đầu tiên

Nếu muốn chạy nhanh:

```python
POPULATION_SIZE = 12
GENERATIONS = 8
ELITE_SIZE = 2
MUTATION_RATE = 0.2
```

Nếu muốn nghiêm túc hơn:

```python
POPULATION_SIZE = 16
GENERATIONS = 12
ELITE_SIZE = 2
MUTATION_RATE = 0.2
```

Nếu dataset lớn và build graph quá chậm:

```python
POPULATION_SIZE = 10
GENERATIONS = 10
```

Nhưng bắt buộc dùng graph cache theo `(threshold, max_edges_per_node)`.

## 22. Best config cuối cùng nên đưa vào đâu?

Sau khi GA chọn được:

```json
{
  "threshold": 0.7,
  "max_edges_per_node": 8,
  "top_k": 6
}
```

Cần cập nhật:

1. Build graph production bằng threshold/max_edges mới.
2. `DepartmentGraphManager` production dùng `top_k` mới.
3. Ghi vào `.env` hoặc config file thay vì hard-code.

Env đề xuất:

```env
GRAPHRAG_SEMANTIC_THRESHOLD=0.7
GRAPHRAG_MAX_EDGES_PER_NODE=8
GRAPHRAG_TOP_K=6
GRAPHRAG_INTERNAL_K=18
```

Code nên đọc env:

```python
semantic_threshold = float(os.getenv("GRAPHRAG_SEMANTIC_THRESHOLD", "0.7"))
max_edges = int(os.getenv("GRAPHRAG_MAX_EDGES_PER_NODE", "7"))
top_k = int(os.getenv("GRAPHRAG_TOP_K", "10"))
internal_k = int(os.getenv("GRAPHRAG_INTERNAL_K", str(top_k * 3)))
```

## 23. Kết luận triển khai

Ba tham số bạn đưa ra map trực tiếp vào code hiện tại:

```text
threshold              -> DocumentGraph.semantic_threshold
max_edges_per_node     -> DocumentGraph.max_semantic_edges_per_node
top_k                  -> GraphRoutedRetriever.k
```

Thứ tự triển khai hợp lý:

1. Tạo experiment runner `api/experiments/ga_tune_graphrag.py`.
2. Parameterize `DepartmentGraphManager` để nhận threshold/max_edges/top_k.
3. Cache graph theo threshold/max_edges.
4. Dùng dataset evaluation để tính Precision/MAP/MRR/NDCG/latency.
5. Chạy GA.
6. So sánh best config với baseline hiện tại `0.7 / 7 / 10`.
7. Chạy regression thủ công qua API.
8. Chỉ sau đó mới rebuild graph production và cập nhật config.
