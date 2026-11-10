"""Run GraphRAG against the dataset imported on this branch."""

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from math import log2
from pathlib import Path
import re
from statistics import mean


BENCHMARK = Path(__file__).resolve().parents[2] / "benchmark"


def load_benchmark():
    config = json.loads((BENCHMARK / "dataset.json").read_text(encoding="utf-8"))
    with (BENCHMARK / "queries.jsonl").open(encoding="utf-8") as source:
        rows = [json.loads(line) for line in source]
    files = sorted((BENCHMARK / "data").rglob("*.md"))
    names = {file.name for file in files}
    if not files or not rows or len(names) != len(files):
        raise ValueError("Expected nonempty data and unique corpus filenames")
    if len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Duplicate query IDs")
    for row in rows:
        gold = row["gold"]
        if (not row["question"].strip() or bool(gold) != row["answerable"]
                or gold.keys() - names or any(grade <= 0 for grade in gold.values())):
            raise ValueError(f"Invalid query or labels: {row['id']}")
    return config, rows, files


def retrieval_scores(ranking, gold, k):
    grades = [gold.get(source, 0) for source in ranking[:k]]
    hits = [rank for rank, grade in enumerate(grades, 1) if grade > 0]
    dcg = sum((2 ** grade - 1) / log2(rank + 1) for rank, grade in enumerate(grades, 1))
    ideal = sorted(gold.values(), reverse=True)[:k]
    idcg = sum((2 ** grade - 1) / log2(rank + 1) for rank, grade in enumerate(ideal, 1))
    return {f"mrr@{k}": 1 / hits[0] if hits else 0.0,
            f"recall@{k}": len(hits) / len(gold), f"ndcg@{k}": dcg / idcg}


def tokens(text):
    return re.findall(r"\w+(?:[.,]\d+)*|[%$€£−-]", text.casefold())


def answer_scores(answer, reference, dataset):
    actual, expected = tokens(answer), tokens(reference)
    length = len(actual) + len(expected)
    scores = {"exact_match": float(actual == expected)}
    if dataset == "multihop":
        overlap = sum((Counter(actual) & Counter(expected)).values())
        scores["token_f1"] = 2 * overlap / length if length else 1.0
    else:
        previous = [0] * (len(expected) + 1)
        for token in actual:
            current = [0]
            for index, target in enumerate(expected, 1):
                current.append(previous[index - 1] + 1 if token == target else max(previous[index], current[-1]))
            previous = current
        scores["rouge_l_f1"] = 2 * previous[-1] / length if length else 1.0
    return scores


def run_graph(dataset, rows, files, args):
    import ga_tuning_RAG as ga

    fingerprint = hashlib.sha256()
    for file in files:
        fingerprint.update(file.relative_to(BENCHMARK).as_posix().encode() + b"\0")
        fingerprint.update(hashlib.sha256(file.read_bytes()).digest())
    ga.RUN_DIR = ga.ROOT / "api" / "experiments" / "rag_ga_runs_benchmark_v1" / dataset / fingerprint.hexdigest()[:16]
    ga.DATA_FOLDER = BENCHMARK / "data"
    documents = ga.load_rag_documents()
    loaded = {doc.metadata["source"] for doc in documents}
    if {file.name for file in files} - loaded:
        raise ValueError("The chunker omitted corpus files")
    config = {"threshold": args.threshold, "max_edges_per_node": args.max_edges, "top_k": args.k * 3}
    retriever, _ = ga.get_shared_graph_retriever(config, documents, generate_summaries=False)
    llm = ga.get_llm() if args.answers else None
    if args.answers and llm is None:
        raise ValueError("Configure an active LLM to generate answers")
    for row in rows:
        chunks = retriever.invoke(row["question"])
        ranking = list(dict.fromkeys(doc.metadata["source"] for doc in chunks))[:args.k]
        answer = None
        if llm is not None:
            context = "\n\n".join(doc.page_content for doc in chunks[:args.k])
            prompt = (
                "Answer in English using only the evidence below. Preserve relevant values and units. "
                "If evidence is insufficient, reply exactly: Insufficient information.\n\n"
                f"Evidence:\n{context}\n\nQuestion: {row['question']}"
            )
            answer = ga.extract_llm_text(llm.invoke([ga.HumanMessage(content=prompt)]))
        yield row, ranking, answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate", action="store_true", help="Check data and labels without a model")
    parser.add_argument("--limit", type=int, help="Run only the first N queries for a smoke check")
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--threshold", type=float, default=0.7)
    parser.add_argument("--max-edges", type=int, default=5)
    parser.add_argument("--answers", action="store_true", help="Also score generated answers")
    parser.add_argument("--output", type=Path, help="Write aggregate and per-query scores as JSON")
    args = parser.parse_args()
    if args.k < 1 or args.max_edges < 1 or not 0 <= args.threshold <= 1 or (args.limit is not None and args.limit < 1):
        parser.error("Expected positive k, max-edges and limit, and a threshold in [0, 1]")
    config, rows, files = load_benchmark()
    dataset = config["dataset"]
    summary = {"dataset": dataset, "retrieval_unit": config["retrieval_unit"],
               "queries": len(rows), "excluded_queries": config["excluded_queries"],
               "corpus_units": len(files), "answerable": sum(row["answerable"] for row in rows)}
    if args.validate:
        print(json.dumps(summary, indent=2))
        return
    if args.answers and dataset == "fiqa":
        parser.error("FiQA evaluates retrieval using qrels")
    totals = defaultdict(list)
    details = []
    for row, ranking, answer in run_graph(dataset, rows[:args.limit], files, args):
        scores = retrieval_scores(ranking, row["gold"], args.k) if row["answerable"] else {}
        if dataset in {"multihop", "financebench"} and row["answerable"]:
            scores[f"all_evidence@{args.k}"] = float(scores[f"recall@{args.k}"] == 1.0)
        if answer is not None:
            if row["answerable"]:
                scores.update(answer_scores(answer, row["answer"], dataset))
            else:
                scores["abstention_accuracy"] = float(tokens(answer) == ["insufficient", "information"])
        for metric, value in scores.items():
            totals[metric].append(value)
        details.append({"id": row["id"], "ranking": ranking, "answer": answer, "scores": scores})
    summary.update(evaluated=len(details), k=args.k, threshold=args.threshold, max_edges=args.max_edges,
                   metrics={name: mean(values) for name, values in totals.items()},
                   metric_counts={name: len(values) for name, values in totals.items()})
    print(json.dumps(summary, indent=2))
    if args.output:
        args.output.write_text(json.dumps({**summary, "per_query": details}, ensure_ascii=False, indent=2) + "\n",
                               encoding="utf-8")


if __name__ == "__main__":
    main()
