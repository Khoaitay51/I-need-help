# financebench GraphRAG benchmark

Source: [financebench](https://github.com/patronus-ai/financebench). Imported from the local `FinanceBench_GraphRAG` bundle.

Scores retrieval at the evidence page level using the original zero-based page annotations. The corpus includes evidence pages from the local bundle. With --answers, reports exact match and ROUGE-L F1. Inspect per-query answers against reference answers and evidence in queries.jsonl for numeric accuracy, units and grounding. Lexical scores are diagnostics. Annotations: https://github.com/patronus-ai/financebench/blob/main/data/financebench_open_source.jsonl

Run from the worktree root. Install `api/requirements.txt` and configure a reachable Ollama with `nomic-embed-text:latest` for the graph run.

```bash
python api/experiments/evaluate_benchmark.py --validate
python api/experiments/evaluate_benchmark.py --limit 5
python api/experiments/evaluate_benchmark.py --output /tmp/financebench-results.json
```

Add `--answers` to generate and score answers with the configured LLM.

The evaluator builds or loads a graph over the entire imported corpus. The limit restricts evaluated queries. Use fixed graph parameters for reported runs. Retrieval metrics exclude unanswerable queries and de-duplicate ranked source IDs.

Benchmark uses community centroids without generating LLM summaries. Ranking takes the first k distinct sources from up to 3k retrieved chunks.
