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
