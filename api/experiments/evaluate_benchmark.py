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
TUNING_CUTOFF = 10


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


def select_queries(rows, split):
    if split == "all":
        return rows
    test_ids = set()
    for answerable in (True, False):
        group = [row["id"] for row in rows if row["answerable"] == answerable]
        if len(group) < 2:
            continue
        group.sort(key=lambda key: hashlib.sha256(key.encode()).digest())
        count = max(1, len(group) // 5)
        test_ids.update(group[:count])
    return [row for row in rows if (row["id"] in test_ids) == (split == "test")]


def retrieval_scores(ranking, gold, k):
    grades = [gold.get(source, 0) for source in ranking[:k]]
    hits = [rank for rank, grade in enumerate(grades, 1) if grade > 0]
    dcg = sum((2 ** grade - 1) / log2(rank + 1) for rank, grade in enumerate(grades, 1))
    ideal = sorted(gold.values(), reverse=True)[:k]
    idcg = sum((2 ** grade - 1) / log2(rank + 1) for rank, grade in enumerate(ideal, 1))
    average_precision = sum(hit / rank for hit, rank in enumerate(hits, 1)) / min(len(gold), k)
    return {f"mrr@{k}": 1 / hits[0] if hits else 0.0, f"map@{k}": average_precision,
            f"precision@{k}": len(hits) / k, f"recall@{k}": len(hits) / len(gold),
            f"ndcg@{k}": dcg / idcg}


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


def graph_cache_dir(root, dataset, files):
    fingerprint = hashlib.sha256()
    for file in files:
        fingerprint.update(file.relative_to(BENCHMARK).as_posix().encode() + b"\0")
        fingerprint.update(hashlib.sha256(file.read_bytes()).digest())
    cache = root / "api" / "experiments" / "rag_ga_runs_benchmark_v2"
    return cache / dataset / fingerprint.hexdigest()[:16]


def load_corpus(loader, files):
    documents = loader(data_folder=str(BENCHMARK / "data"), chunk_size=800, chunk_overlap=200)
    loaded = {doc.metadata["source"] for doc in documents}
    if {file.name for file in files} - loaded:
        raise ValueError("The chunker omitted corpus files")
    return documents


def ranked_sources(chunks, top_k):
    return list(dict.fromkeys(doc.metadata["source"] for doc in chunks))[:top_k]


def generate_answer(question, chunks, llm, message_class, extract_text):
    context = "\n\n".join(doc.page_content for doc in chunks)
    prompt = (
        "Answer in English using only the evidence below. Preserve relevant values and units. "
        "If evidence is insufficient, reply exactly: Insufficient information.\n\n"
        f"Evidence:\n{context}\n\nQuestion: {question}"
    )
    return extract_text(llm.invoke([message_class(content=prompt)]))


def run_graph(dataset, rows, files, args):
    import ga_tuning_RAG as ga

    ga.RUN_DIR = graph_cache_dir(ga.ROOT, dataset, files)
    documents = load_corpus(ga.load_documents_from_folder, files)
    config = {"threshold": args.threshold, "max_edges_per_node": args.max_edges, "top_k": args.k * 3}
    retriever, _ = ga.get_shared_graph_retriever(config, documents, generate_summaries=False)
    llm = ga.get_llm() if args.answers else None
    if args.answers and llm is None:
        raise ValueError("Configure an active LLM to generate answers")
    for row in rows:
        chunks = retriever.invoke(row["question"])
        ranking = ranked_sources(chunks, args.k)
        answer = None if llm is None else generate_answer(
            row["question"], chunks[:args.k], llm, ga.HumanMessage, ga.extract_llm_text
        )
        yield row, ranking, answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate", action="store_true", help="Check data and labels without a model")
    parser.add_argument("--limit", type=int, help="Run only the first N queries for a smoke check")
    parser.add_argument("--k", type=int, default=10, help="Maximum returned sources")
    parser.add_argument("--cutoff", type=int, help="Metric cutoff, defaults to --k")
    parser.add_argument("--split", choices=("all", "tune", "test"), default="all")
    parser.add_argument("--threshold", type=float, default=0.7)
    parser.add_argument("--max-edges", type=int, default=5)
    parser.add_argument("--answers", action="store_true", help="Also score generated answers")
    parser.add_argument("--output", type=Path, help="Write aggregate and per-query scores as JSON")
    args = parser.parse_args()
    if args.k < 1 or args.max_edges < 1 or not 0 <= args.threshold <= 1 or (args.limit is not None and args.limit < 1):
        parser.error("Expected positive k, max-edges and limit, and a threshold in [0, 1]")
    cutoff = args.k if args.cutoff is None else args.cutoff
    if cutoff < 1:
        parser.error("--cutoff must be positive")
    config, rows, files = load_benchmark()
    rows = select_queries(rows, args.split)
    if not rows:
        parser.error("The selected split contains no queries")
    dataset = config["dataset"]
    summary = {"dataset": dataset, "split": args.split, "retrieval_unit": config["retrieval_unit"],
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
        scores = retrieval_scores(ranking, row["gold"], cutoff) if row["answerable"] else {}
        if dataset in {"multihop", "financebench"} and row["answerable"]:
            scores[f"all_evidence@{cutoff}"] = float(scores[f"recall@{cutoff}"] == 1.0)
        if answer is not None:
            if row["answerable"]:
                scores.update(answer_scores(answer, row["answer"], dataset))
            else:
                scores["abstention_accuracy"] = float(tokens(answer) == ["insufficient", "information"])
        for metric, value in scores.items():
            totals[metric].append(value)
        details.append({"id": row["id"], "ranking": ranking, "answer": answer, "scores": scores})
    summary.update(evaluated=len(details), k=args.k, cutoff=cutoff, threshold=args.threshold, max_edges=args.max_edges,
                   metrics={name: mean(values) for name, values in totals.items()},
                   metric_counts={name: len(values) for name, values in totals.items()})
    print(json.dumps(summary, indent=2))
    if args.output:
        args.output.write_text(json.dumps({**summary, "per_query": details}, ensure_ascii=False, indent=2) + "\n",
                               encoding="utf-8")


if __name__ == "__main__":
    main()
