# fiqa GraphRAG benchmark

Source: [fiqa](https://huggingface.co/datasets/BeIR/fiqa). Imported from the local `FiQA_BEIR_GraphRAG` bundle.

Scores document retrieval with the original BEIR test qrels against the local reduced corpus. Use nDCG@10 as the primary score. This corpus is smaller than the official BEIR corpus. Source archive and qrels: https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/fiqa.zip

Run from the worktree root. Install `api/requirements.txt` and configure a reachable Ollama with `nomic-embed-text:latest` for the graph run.

```bash
python api/experiments/evaluate_benchmark.py --validate
python api/experiments/evaluate_benchmark.py --limit 5
python api/experiments/evaluate_benchmark.py --output /tmp/fiqa-results.json
```

The evaluator builds or loads a graph over the entire imported corpus. The limit restricts evaluated queries. Use fixed graph parameters for reported runs. Retrieval metrics exclude unanswerable queries and de-duplicate ranked source IDs.

Benchmark uses community centroids without generating LLM summaries. Ranking takes the first k distinct sources from up to 3k retrieved chunks.

## Hyperparameter search

The four optimizers share this branch's corpus, relevance labels and graph cache. They tune on a deterministic split with approximately 80% of the queries, keeping approximately 20% for held-out evaluation. MultiHop is split separately by answerability. The searched `top_k` sets the maximum number of returned sources and the depth used to score retrieval. The held-out evaluator uses `--k` for the same two purposes.

```bash
python api/experiments/ga_tuning_RAG.py
python api/experiments/pso_tuning_RAG.py
python api/experiments/grid_search_tuning_RAG.py
python api/experiments/random_search_tuning_RAG.py
```

The default fitness keeps the existing weights for nDCG, MAP and MRR. Use `--mrr`, `--map` or `--ndcg` for a single-metric run. On datasets with answer references, `--llm-eval` also measures answer cosine similarity with the existing hybrid weights. FiQA uses retrieval labels.

Add `--limit 5` to test each command on five tuning queries. The graph is still built from the full corpus. Results are written to `api/experiments/rag_ga_results/`.

To score a selected configuration on the held-out set, substitute the values from the best-config JSON.

```bash
python api/experiments/evaluate_benchmark.py --split test --threshold 0.5 --max-edges 4 --k 8 --output /tmp/test-results.json
```
