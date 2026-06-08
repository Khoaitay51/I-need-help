# 🎯 RAG Test Quick Reference Card

## 🚀 Quick Start

### Option 1: Windows

```batch
# Double-click to run
run_rag_test.bat

# Or from command line
cd api
python test_rag_quick.py
```

### Option 2: Linux/macOS

```bash
chmod +x run_rag_test.sh
./run_rag_test.sh

# Or directly
cd api
python test_rag_quick.py
```

### Option 3: Python

```bash
cd api
python test_rag_comparison.py  # Full test (recommended when data is ready)
```

---

## 📊 Metrics at a Glance

| Metric                | Range | Formula                   | Interpretation                                       |
| --------------------- | ----- | ------------------------- | ---------------------------------------------------- |
| **Cosine Similarity** | 0-1   | `A·B / (\|A\|\|B\|)`      | How semantically similar are the question and answer |
| **Precision@K**       | 0-1   | `relevant ∩ top_k / K`    | How many of top-K results are correct                |
| **MAP**               | 0-1   | `Σ(P(k)×rel) / \|rel\|`   | Average accuracy, respecting ranking order           |
| **MRR**               | 0-1   | `1 / rank_first_relevant` | Position of first correct result                     |
| **NDCG@K**            | 0-1   | `DCG / IDCG`              | Overall ranking quality (industry standard)          |

---

## 📈 Reading Results

### Green Light ✅ (Good)

- **Precision/MAP/NDCG > 0.7**: Excellent retrieval quality
- **MRR > 0.8**: First result is usually correct
- **Cosine Sim > 0.75**: Good semantic matching
- **Retrieval time < 100ms**: Fast enough for real-time

### Yellow Light ⚠️ (Acceptable)

- **Precision/MAP/NDCG: 0.5-0.7**: Room for improvement
- **MRR: 0.6-0.8**: Correct answer often in top 2-3
- **Cosine Sim: 0.6-0.75**: Moderate semantic match
- **Retrieval time: 100-300ms**: May need optimization

### Red Light 🔴 (Needs Fixing)

- **Precision/MAP/NDCG < 0.5**: Poor ranking
- **MRR < 0.6**: Correct answer deep in results
- **Cosine Sim < 0.6**: Weak semantic understanding
- **Retrieval time > 500ms**: Too slow for production

---

## 🔄 GraphRAG vs Traditional RAG

### Traditional RAG (BM25 + FAISS)

```
Input Query
    ↓
[BM25] ← Keyword matching (fast)
    ↓
[FAISS] ← Vector similarity
    ↓
Combined Results (top-K)
```

**Pros**: Fast, simple, no preprocessing
**Cons**: May miss semantic relationships

### GraphRAG (Department-aware routing)

```
Input Query
    ↓
[Semantic Analysis] ← Understand query intent
    ↓
[Department Detection] ← Route to relevant knowledge graph
    ↓
[Graph Traversal] ← Hop through connected documents
    ↓
[Ranking] ← Re-rank by relevance
    ↓
Combined Results (top-K)
```

**Pros**: Better semantic understanding, department-aware
**Cons**: Slower, requires graph construction

Expected improvement: **20-40% on NDCG/MAP**

---

## 💾 Output Files Explained

```
rag_test_results/
│
├── rag_comparison_YYYYMMDD_HHMMSS.json
│   └── Detailed results per query:
│       {
│         "traditional_rag": [
│           {
│             "query": "...",
│             "cosine_similarity": 0.75,
│             "precision_at_k": 0.80,
│             "map": 0.72,
│             "mrr": 0.90,
│             "ndcg": 0.78
│           },
│           ...
│         ]
│       }
│
├── aggregate_metrics_YYYYMMDD_HHMMSS.json
│   └── Summary statistics:
│       {
│         "traditional_rag": {
│           "cosine_similarity": {
│             "mean": 0.75,
│             "std": 0.08,
│             "min": 0.60,
│             "max": 0.95
│           },
│           ...
│         }
│       }
│
└── comparison_report_YYYYMMDD_HHMMSS.csv
    └── Side-by-side comparison table (Excel-ready)
```

---

## 🛠️ Troubleshooting

| Problem                       | Solution                                                     |
| ----------------------------- | ------------------------------------------------------------ |
| `ModuleNotFoundError`         | Run from `api/` directory or add to `PYTHONPATH`             |
| `FileNotFoundError` (dataset) | Check file exists: `dir "dataset chatbot update.csv"`        |
| Ollama connection error       | Check Ollama running: `curl http://localhost:11434/api/tags` |
| Out of memory                 | Reduce `num_samples` or `k_retrieved` in config              |
| Slow test                     | Run quick test first, then increase samples                  |

---

## 📚 Usage Examples

### Example 1: Quick validation of setup

```bash
python test_rag_quick.py
# Takes ~1-2 minutes, uses 5 samples
```

### Example 2: Compare with 10 samples (recommended)

```bash
# Edit test_rag_comparison.py, line 70:
TEST_CONFIG = {
    "num_samples": 10,  # ← Change from None to 10
}

python test_rag_comparison.py
```

### Example 3: Full comprehensive test

```bash
# Keep num_samples as None
python test_rag_comparison.py
# May take 10-30 minutes depending on dataset size
```

### Example 4: Use metrics in custom code

```python
from src.evaluation.metrics import RAGMetrics

# Calculate individual metrics
scores = {
    'precision': RAGMetrics.precision_at_k([0,2,4,1,3], [0], k=5),
    'map': RAGMetrics.mean_average_precision([0,2,4,1,3], [0], k=5),
    'mrr': RAGMetrics.mean_reciprocal_rank([0,2,4,1,3], [0]),
    'ndcg': RAGMetrics.normalized_discounted_cumulative_gain([0,2,4,1,3], [0], k=5),
}

print(f"Precision: {scores['precision']:.4f}")
print(f"MAP: {scores['map']:.4f}")
print(f"MRR: {scores['mrr']:.4f}")
print(f"NDCG: {scores['ndcg']:.4f}")
```

---

## 🎓 Key Takeaways

1. **Start with quick test** to validate setup
2. **Use NDCG as primary metric** - best overall quality indicator
3. **Monitor retrieval time** - don't sacrifice too much speed for quality
4. **GraphRAG shines** when you have well-structured knowledge domains
5. **Traditional RAG is faster** - good baseline

---

## 📖 Full Documentation

See: `RAG_TEST_GUIDE.md` for comprehensive guide with:

- Detailed metric explanations with formulas
- Setup instructions
- Interpretation guidelines
- FAQ and common errors

---

**Last Updated**: 2026-03-21  
**Version**: 1.0  
**Status**: Ready to use ✅
