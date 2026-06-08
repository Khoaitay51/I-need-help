"""
RAG Comparison Quick Test - Simplified Version
Phiên bản đơn giản để test nhanh RAG comparison
"""

import asyncio
import os
import sys
import csv
import json
import time
from pathlib import Path
from typing import List, Dict
import numpy as np
from datetime import datetime

# Add project path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from tabulate import tabulate
from tqdm import tqdm

# Quick metrics calculation using existing utilities
from src.evaluation.metrics import RAGMetrics, AggregatedMetrics


def load_sample_dataset(sample_size: int = 5) -> List[Dict]:
    """Load a sample of dataset for quick testing"""
    dataset_path = Path(__file__).parent / "dataset chatbot update.csv"
    
    if not dataset_path.exists():
        print(f"❌ Dataset not found at {dataset_path}")
        return []
    
    dataset = []
    with open(dataset_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= sample_size:
                break
            if row.get('question') and row.get('answer_expected'):
                dataset.append({
                    'id': i,
                    'question': row['question'].strip(),
                    'answer_expected': row['answer_expected'].strip()
                })
    
    return dataset


def simulate_retrieval_results(query: str, dataset: List[Dict]) -> Dict:
    """
    Simulate retrieval results for demo purposes
    (In real usage, this would call the actual retrievers)
    """
    # Simulate that first item is always most relevant
    traditional_retrieved = list(range(min(5, len(dataset))))
    graph_retrieved = list(range(min(5, len(dataset))))
    
    # Simulate better ranking for graph RAG (first item might be moved to front)
    if len(graph_retrieved) > 1:
        graph_retrieved[0] = 0  # Force correct first result
    
    return {
        'traditional_rag': traditional_retrieved,
        'graph_rag': graph_retrieved
    }


def run_quick_comparison():
    """Run quick RAG comparison test"""
    print("\n" + "="*80)
    print("🚀 RAG COMPARISON QUICK TEST")
    print("="*80 + "\n")
    
    # Load dataset sample
    print("📊 Loading dataset sample...")
    sample_size = 5
    dataset = load_sample_dataset(sample_size)
    
    if not dataset:
        print("❌ Failed to load dataset")
        return
    
    print(f"✅ Loaded {len(dataset)} Q&A pairs\n")
    
    # Store results
    results = {
        'traditional_rag': [],
        'graph_rag': []
    }
    
    # Test each query
    for item in tqdm(dataset, desc="Testing queries"):
        query = item['question']
        ground_truth_id = item['id']
        
        # Simulate retrieval
        retrieval_results = simulate_retrieval_results(query, dataset)
        
        # Calculate metrics for each retriever
        for retriever_type, retrieved_ids in retrieval_results.items():
            # Ground truth is the current item's index
            relevant_ids = [ground_truth_id]
            
            # Calculate metrics
            metrics = {
                'query': query,
                'retrieved_ids': retrieved_ids,
                'precision_at_5': RAGMetrics.precision_at_k(
                    retrieved_ids, relevant_ids, 5
                ),
                'map': RAGMetrics.mean_average_precision(
                    retrieved_ids, relevant_ids, 5
                ),
                'mrr': RAGMetrics.mean_reciprocal_rank(
                    retrieved_ids, relevant_ids
                ),
                'ndcg': RAGMetrics.normalized_discounted_cumulative_gain(
                    retrieved_ids, relevant_ids, 5
                ),
                'avg_rank': RAGMetrics.average_retrieval_rank(
                    retrieved_ids, relevant_ids
                )
            }
            
            results[retriever_type].append(metrics)
    
    # Calculate aggregated metrics
    print("\n" + "="*80)
    print("📈 RESULTS SUMMARY")
    print("="*80 + "\n")
    
    comparison_data = []
    
    for retriever_type in ['traditional_rag', 'graph_rag']:
        retriever_results = results[retriever_type]
        
        if not retriever_results:
            continue
        
        # Aggregate metrics
        precision_scores = [r['precision_at_5'] for r in retriever_results]
        map_scores = [r['map'] for r in retriever_results]
        mrr_scores = [r['mrr'] for r in retriever_results]
        ndcg_scores = [r['ndcg'] for r in retriever_results]
        avg_ranks = [r['avg_rank'] for r in retriever_results if r['avg_rank'] != float('inf')]
        
        print(f"\n### {retriever_type.upper()} ###")
        print(f"Total queries tested: {len(retriever_results)}")
        print(f"Precision@5: {np.mean(precision_scores):.4f} ± {np.std(precision_scores):.4f}")
        print(f"MAP: {np.mean(map_scores):.4f} ± {np.std(map_scores):.4f}")
        print(f"MRR: {np.mean(mrr_scores):.4f} ± {np.std(mrr_scores):.4f}")
        print(f"NDCG: {np.mean(ndcg_scores):.4f} ± {np.std(ndcg_scores):.4f}")
        if avg_ranks:
            print(f"Avg Rank: {np.mean(avg_ranks):.2f}")
        
        # Store for comparison
        comparison_data.append({
            'Metric': retriever_type.replace('_', ' ').title(),
            'Precision@5': f"{np.mean(precision_scores):.4f}",
            'MAP': f"{np.mean(map_scores):.4f}",
            'MRR': f"{np.mean(mrr_scores):.4f}",
            'NDCG': f"{np.mean(ndcg_scores):.4f}",
        })
    
    # Print comparison table
    if comparison_data:
        print("\n### COMPARISON TABLE ###")
        print(tabulate(comparison_data, headers="keys", tablefmt="grid"))
    
    # Save results
    output_dir = Path(__file__).parent / 'rag_test_results'
    output_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results_file = output_dir / f"quick_test_results_{timestamp}.json"
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Results saved to: {results_file}")
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    run_quick_comparison()
