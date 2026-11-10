# multihop GraphRAG benchmark

Source: [multihop](https://huggingface.co/datasets/yixuantt/MultiHopRAG). Imported from the local `MultiHop_GraphRAG` bundle.

Scores article retrieval with all evidence titles mapped from the original annotations. All-evidence@k checks whether every evidence article was retrieved. With --answers, reports exact match, token F1 and abstention accuracy for insufficient-information cases. Annotation revision: https://huggingface.co/datasets/yixuantt/MultiHopRAG/tree/71ac0d0bd1f951d2d6b70311f7d2ae404e1ffa82

Run from the worktree root. Install `api/requirements.txt` and configure a reachable Ollama with `nomic-embed-text:latest` for the graph run.

```bash
python api/experiments/evaluate_benchmark.py --validate
python api/experiments/evaluate_benchmark.py --limit 5
python api/experiments/evaluate_benchmark.py --output /tmp/multihop-results.json
```

Add `--answers` to generate and score answers with the configured LLM.

The evaluator builds or loads a graph over the entire imported corpus. The limit restricts evaluated queries. Use fixed graph parameters for reported runs. Retrieval metrics exclude unanswerable queries and de-duplicate ranked source IDs.

Benchmark uses community centroids without generating LLM summaries. Ranking takes the first k distinct sources from up to 3k retrieved chunks.
