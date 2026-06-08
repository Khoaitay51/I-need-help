"""
Example Usage of RAG Metrics
Ví dụ cách sử dụng metrics module độc lập
"""

import sys
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent / "api"))

from src.evaluation.metrics import RAGMetrics, AggregatedMetrics
import numpy as np


def example_1_basic_metrics():
    """Example 1: Calculate metrics for a single query result"""
    print("\n" + "="*70)
    print("EXAMPLE 1: Basic Metrics for Single Query")
    print("="*70 + "\n")
    
    # Simulate retrieval results
    # Retrieved document IDs in ranking order: [0, 2, 4, 1, 3]
    retrieved_doc_ids = [0, 2, 4, 1, 3]
    
    # Documents that are actually relevant: [0] (only first one)
    relevant_doc_ids = [0]
    
    print(f"Query: 'Quy định công tác khảo thí?'")
    print(f"Retrieved docs (ordered): {retrieved_doc_ids}")
    print(f"Relevant docs: {relevant_doc_ids}\n")
    
    # Calculate metrics
    k = 5
    precision = RAGMetrics.precision_at_k(retrieved_doc_ids, relevant_doc_ids, k)
    recall = RAGMetrics.recall_at_k(retrieved_doc_ids, relevant_doc_ids, k)
    map_score = RAGMetrics.mean_average_precision(retrieved_doc_ids, relevant_doc_ids, k)
    mrr = RAGMetrics.mean_reciprocal_rank(retrieved_doc_ids, relevant_doc_ids)
    ndcg = RAGMetrics.normalized_discounted_cumulative_gain(retrieved_doc_ids, relevant_doc_ids, k)
    f1 = RAGMetrics.f1_score(precision, recall)
    
    # Display results
    print("📊 Metrics Results:")
    print(f"  Precision@{k}: {precision:.4f}")
    print(f"  Recall@{k}:    {recall:.4f}")
    print(f"  F1 Score:      {f1:.4f}")
    print(f"  MAP:           {map_score:.4f}")
    print(f"  MRR:           {mrr:.4f}")
    print(f"  NDCG@{k}:      {ndcg:.4f}")


def example_2_compare_retrievers():
    """Example 2: Compare results from two different retrievers"""
    print("\n" + "="*70)
    print("EXAMPLE 2: Compare Two Retrievers on Same Query")
    print("="*70 + "\n")
    
    query = "Điều kiện dự thi kết thúc học phần?"
    relevant_ids = [1]  # Only document 1 is relevant
    
    # Traditional RAG results (worse ranking)
    trad_results = [3, 1, 4, 0, 2]  # Correct answer is at position 2
    
    # GraphRAG results (better ranking)
    graph_results = [1, 3, 4, 0, 2]  # Correct answer is at position 1
    
    print(f"Query: '{query}'")
    print(f"Relevant Documents: {relevant_ids}\n")
    print(f"Traditional RAG ranking: {trad_results}")
    print(f"GraphRAG ranking:        {graph_results}\n")
    
    k = 5
    
    # Calculate metrics for Traditional RAG
    print("Traditional RAG Metrics:")
    trad_metrics = {
        'Precision': RAGMetrics.precision_at_k(trad_results, relevant_ids, k),
        'Recall': RAGMetrics.recall_at_k(trad_results, relevant_ids, k),
        'MAP': RAGMetrics.mean_average_precision(trad_results, relevant_ids, k),
        'MRR': RAGMetrics.mean_reciprocal_rank(trad_results, relevant_ids),
        'NDCG': RAGMetrics.normalized_discounted_cumulative_gain(trad_results, relevant_ids, k),
    }
    
    for metric_name, value in trad_metrics.items():
        print(f"  {metric_name:12s}: {value:.4f}")
    
    print("\nGraphRAG Metrics:")
    graph_metrics = {
        'Precision': RAGMetrics.precision_at_k(graph_results, relevant_ids, k),
        'Recall': RAGMetrics.recall_at_k(graph_results, relevant_ids, k),
        'MAP': RAGMetrics.mean_average_precision(graph_results, relevant_ids, k),
        'MRR': RAGMetrics.mean_reciprocal_rank(graph_results, relevant_ids),
        'NDCG': RAGMetrics.normalized_discounted_cumulative_gain(graph_results, relevant_ids, k),
    }
    
    for metric_name, value in graph_metrics.items():
        print(f"  {metric_name:12s}: {value:.4f}")
    
    # Compare
    print("\n📊 COMPARISON:")
    for metric_name in trad_metrics:
        trad_val = trad_metrics[metric_name]
        graph_val = graph_metrics[metric_name]
        diff = graph_val - trad_val
        pct = (diff / trad_val * 100) if trad_val != 0 else 0
        winner = "✓ GraphRAG" if graph_val > trad_val else "✓ Traditional"
        print(f"  {metric_name:12s}: {trad_val:.4f} → {graph_val:.4f} ({diff:+.4f}, {pct:+.1f}%) {winner}")


def example_3_aggregate_metrics():
    """Example 3: Aggregate metrics across multiple queries"""
    print("\n" + "="*70)
    print("EXAMPLE 3: Aggregate Metrics Over Multiple Queries")
    print("="*70 + "\n")
    
    # Simulate results for 5 queries
    queries_data = [
        {
            'query': 'Q1: Quy định công tác khảo thí?',
            'retrieved': [0, 2, 4, 1, 3],
            'relevant': [0],
        },
        {
            'query': 'Q2: Điều kiện dự thi?',
            'retrieved': [1, 3, 0, 2, 4],
            'relevant': [1],
        },
        {
            'query': 'Q3: Cách tính điểm?',
            'retrieved': [2, 0, 1, 3, 4],
            'relevant': [2],
        },
        {
            'query': 'Q4: Yêu cầu đánh giá?',
            'retrieved': [4, 2, 1, 0, 3],
            'relevant': [4],
        },
        {
            'query': 'Q5: Bảo vệ bí mật nhà nước?',
            'retrieved': [3, 1, 2, 4, 0],
            'relevant': [3],
        },
    ]
    
    # Calculate metrics for each query
    k = 5
    all_ndcg_scores = []
    all_precision_scores = []
    all_mrr_scores = []
    
    print("Individual Query Results:")
    print("-" * 70)
    
    for data in queries_data:
        retrieved = data['retrieved']
        relevant = data['relevant']
        
        ndcg = RAGMetrics.normalized_discounted_cumulative_gain(retrieved, relevant, k)
        precision = RAGMetrics.precision_at_k(retrieved, relevant, k)
        mrr = RAGMetrics.mean_reciprocal_rank(retrieved, relevant)
        
        all_ndcg_scores.append(ndcg)
        all_precision_scores.append(precision)
        all_mrr_scores.append(mrr)
        
        print(f"{data['query']}")
        print(f"  NDCG: {ndcg:.4f} | Precision: {precision:.4f} | MRR: {mrr:.4f}")
    
    # Aggregate across all queries
    print("\n" + "="*70)
    print("Aggregated Metrics (across 5 queries):")
    print("="*70)
    
    ndcg_stats = AggregatedMetrics.aggregate_metrics(all_ndcg_scores)
    precision_stats = AggregatedMetrics.aggregate_metrics(all_precision_scores)
    mrr_stats = AggregatedMetrics.aggregate_metrics(all_mrr_scores)
    
    print("\nNDCG@5:")
    print(f"  Mean:   {ndcg_stats['mean']:.4f}")
    print(f"  Std:    {ndcg_stats['std']:.4f}")
    print(f"  Min:    {ndcg_stats['min']:.4f}")
    print(f"  Max:    {ndcg_stats['max']:.4f}")
    
    print("\nPrecision@5:")
    print(f"  Mean:   {precision_stats['mean']:.4f}")
    print(f"  Std:    {precision_stats['std']:.4f}")
    print(f"  Min:    {precision_stats['min']:.4f}")
    print(f"  Max:    {precision_stats['max']:.4f}")
    
    print("\nMRR:")
    print(f"  Mean:   {mrr_stats['mean']:.4f}")
    print(f"  Std:    {mrr_stats['std']:.4f}")
    print(f"  Min:    {mrr_stats['min']:.4f}")
    print(f"  Max:    {mrr_stats['max']:.4f}")


def example_4_real_world_scenario():
    """Example 4: Real-world scenario with multiple relevant documents"""
    print("\n" + "="*70)
    print("EXAMPLE 4: Real-World Scenario with Multiple Relevant Docs")
    print("="*70 + "\n")
    
    query = "What are quality assurance requirements?"
    
    # Suppose multiple documents can be relevant
    retrieved_docs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    relevant_docs = [0, 2, 5]  # 3 documents are relevant
    
    print(f"Query: '{query}'")
    print(f"Retrieved docs (top-10): {retrieved_docs}")
    print(f"Relevant docs: {relevant_docs}\n")
    
    k_values = [3, 5, 10]
    
    print("Metrics at different K values:")
    print("-" * 70)
    
    for k in k_values:
        precision = RAGMetrics.precision_at_k(retrieved_docs, relevant_docs, k)
        recall = RAGMetrics.recall_at_k(retrieved_docs, relevant_docs, k)
        map_score = RAGMetrics.mean_average_precision(retrieved_docs, relevant_docs, k)
        ndcg = RAGMetrics.normalized_discounted_cumulative_gain(retrieved_docs, relevant_docs, k)
        f1 = RAGMetrics.f1_score(precision, recall)
        
        print(f"\nK = {k}:")
        print(f"  Precision@{k}:  {precision:.4f}")
        print(f"  Recall@{k}:     {recall:.4f}")
        print(f"  F1 Score:    {f1:.4f}")
        print(f"  MAP:         {map_score:.4f}")
        print(f"  NDCG@{k}:     {ndcg:.4f}")


def main():
    """Run all examples"""
    print("\n" + "="*70)
    print("RAG METRICS EXAMPLES")
    print("="*70)
    
    try:
        example_1_basic_metrics()
        example_2_compare_retrievers()
        example_3_aggregate_metrics()
        example_4_real_world_scenario()
        
        print("\n" + "="*70)
        print("✅ All examples completed successfully!")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
