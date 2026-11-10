# msmarco GraphRAG benchmark

Source: [msmarco](https://microsoft.github.io/msmarco/). Imported from the local `MSMARCO_GraphRAG` bundle.

Scores retrieval by passage ID. Question headers and gold markers from the local Markdown export are omitted from the indexed passages. Queries without a marked positive passage are excluded. This is the local QA subset, with optional exact match and ROUGE-L F1 for generated answers.

Run from the worktree root. Install `api/requirements.txt` and configure a reachable Ollama with `nomic-embed-text:latest` for the graph run.

```bash
python api/experiments/evaluate_benchmark.py --validate
python api/experiments/evaluate_benchmark.py --limit 5
python api/experiments/evaluate_benchmark.py --output /tmp/msmarco-results.json
```

Add `--answers` to generate and score answers with the configured LLM.

The evaluator builds or loads a graph over the entire imported corpus. The limit restricts evaluated queries. Use fixed graph parameters for reported runs. Retrieval metrics exclude unanswerable queries and de-duplicate ranked source IDs.

Benchmark uses community centroids without generating LLM summaries. Ranking takes the first k distinct sources from up to 3k retrieved chunks.
