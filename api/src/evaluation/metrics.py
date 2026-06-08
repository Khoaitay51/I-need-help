"""
RAG Evaluation Metrics Utilities
Các hàm tiện ích để tính toán các độ đo đánh giá RAG
"""

import numpy as np
from typing import List, Dict, Tuple
from langchain_core.documents import Document
from sklearn.metrics.pairwise import cosine_similarity


class RAGMetrics:
    """Collection of RAG evaluation metrics"""
    
    @staticmethod
    def cosine_similarity(embeddings1: np.ndarray, embeddings2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two embeddings
        
        Args:
            embeddings1: First embedding vector
            embeddings2: Second embedding vector
        
        Returns:
            Cosine similarity score (0-1)
        """
        if not isinstance(embeddings1, np.ndarray):
            embeddings1 = np.array(embeddings1)
        if not isinstance(embeddings2, np.ndarray):
            embeddings2 = np.array(embeddings2)
        
        embeddings1 = embeddings1.reshape(1, -1)
        embeddings2 = embeddings2.reshape(1, -1)
        
        return float(cosine_similarity(embeddings1, embeddings2)[0][0])
    
    @staticmethod
    def precision_at_k(retrieved_doc_ids: List[int], 
                      relevant_doc_ids: List[int], 
                      k: int) -> float:
        """
        Calculate Precision@K
        - Tỷ lệ tài liệu liên quan trong top-K tài liệu được truy xuất
        
        Args:
            retrieved_doc_ids: List of document IDs retrieved (ordered)
            relevant_doc_ids: List of document IDs that are relevant to query
            k: Top K documents to consider
        
        Returns:
            Precision@K (0-1)
        """
        if k == 0 or not retrieved_doc_ids:
            return 0.0
        
        top_k_ids = retrieved_doc_ids[:k]
        relevant_in_top_k = sum(1 for doc_id in top_k_ids if doc_id in relevant_doc_ids)
        
        return relevant_in_top_k / k
    
    @staticmethod
    def recall_at_k(retrieved_doc_ids: List[int], 
                   relevant_doc_ids: List[int], 
                   k: int) -> float:
        """
        Calculate Recall@K
        - Tỷ lệ tài liệu liên quan được tìm thấy trong top-K
        
        Args:
            retrieved_doc_ids: List of document IDs retrieved (ordered)
            relevant_doc_ids: List of document IDs that are relevant to query
            k: Top K documents to consider
        
        Returns:
            Recall@K (0-1)
        """
        if not relevant_doc_ids:
            return 0.0
        
        top_k_ids = retrieved_doc_ids[:k]
        relevant_in_top_k = sum(1 for doc_id in top_k_ids if doc_id in relevant_doc_ids)
        
        return relevant_in_top_k / len(relevant_doc_ids)
    
    @staticmethod
    def mean_average_precision(retrieved_doc_ids: List[int], 
                               relevant_doc_ids: List[int], 
                               k: int) -> float:
        """
        Calculate Mean Average Precision (MAP)
        - Trung bình độ chính xác tại từng vị trí liên quan
        
        Args:
            retrieved_doc_ids: List of document IDs retrieved (ordered)
            relevant_doc_ids: List of document IDs that are relevant to query
            k: Top K documents to consider
        
        Returns:
            MAP score (0-1)
        """
        if not retrieved_doc_ids or not relevant_doc_ids:
            return 0.0
        
        top_k_ids = retrieved_doc_ids[:k]
        precisions = []
        num_relevant = 0
        
        for i, doc_id in enumerate(top_k_ids):
            if doc_id in relevant_doc_ids:
                num_relevant += 1
                precisions.append(num_relevant / (i + 1))
        
        if not precisions:
            return 0.0
        
        return sum(precisions) / len(relevant_doc_ids)
    
    @staticmethod
    def mean_reciprocal_rank(retrieved_doc_ids: List[int], 
                            relevant_doc_ids: List[int]) -> float:
        """
        Calculate Mean Reciprocal Rank (MRR)
        - Nghịch đảo của vị trí tài liệu liên quan đầu tiên
        
        Args:
            retrieved_doc_ids: List of document IDs retrieved (ordered)
            relevant_doc_ids: List of document IDs that are relevant to query
        
        Returns:
            MRR score (0-1)
        """
        for i, doc_id in enumerate(retrieved_doc_ids):
            if doc_id in relevant_doc_ids:
                return 1.0 / (i + 1)
        
        return 0.0
    
    @staticmethod
    def normalized_discounted_cumulative_gain(retrieved_doc_ids: List[int], 
                                             relevant_doc_ids: List[int], 
                                             k: int) -> float:
        """
        Calculate Normalized Discounted Cumulative Gain (NDCG@K)
        - Đo lường chất lượng xếp hạng có tính đến vị trí
        
        Args:
            retrieved_doc_ids: List of document IDs retrieved (ordered)
            relevant_doc_ids: List of document IDs that are relevant to query
            k: Top K documents to consider
        
        Returns:
            NDCG@K score (0-1)
        """
        # DCG calculation
        dcg = 0.0
        for i, doc_id in enumerate(retrieved_doc_ids[:k]):
            if doc_id in relevant_doc_ids:
                dcg += 1.0 / np.log2(i + 2)  # log2(i+2) vì i bắt đầu từ 0
        
        # IDCG calculation (ideal ranking - all relevant docs ranked first)
        idcg = 0.0
        num_relevant = min(len(relevant_doc_ids), k)
        for i in range(num_relevant):
            idcg += 1.0 / np.log2(i + 2)
        
        if idcg == 0.0:
            return 0.0
        
        return dcg / idcg
    
    @staticmethod
    def f1_score(precision: float, recall: float) -> float:
        """
        Calculate F1 Score
        - Trung bình điều hòa của Precision và Recall
        
        Args:
            precision: Precision score
            recall: Recall score
        
        Returns:
            F1 score (0-1)
        """
        if precision + recall == 0:
            return 0.0
        
        return 2 * (precision * recall) / (precision + recall)
    
    @staticmethod
    def average_retrieval_rank(retrieved_doc_ids: List[int], 
                              relevant_doc_ids: List[int]) -> float:
        """
        Calculate Average Retrieval Rank (ARR)
        - Trung bình xếp hạng của tất cả tài liệu liên quan
        
        Args:
            retrieved_doc_ids: List of document IDs retrieved (ordered)
            relevant_doc_ids: List of document IDs that are relevant to query
        
        Returns:
            Average rank (lower is better)
        """
        positions = []
        for doc_id in relevant_doc_ids:
            if doc_id in retrieved_doc_ids:
                positions.append(retrieved_doc_ids.index(doc_id) + 1)
        
        if not positions:
            return float('inf')
        
        return np.mean(positions)


class AggregatedMetrics:
    """Aggregation utilities for multiple queries"""
    
    @staticmethod
    def aggregate_metrics(metric_list: List[float]) -> Dict[str, float]:
        """
        Aggregate metric values across multiple queries
        
        Args:
            metric_list: List of metric values
        
        Returns:
            Dictionary with mean, std, min, max values
        """
        if not metric_list:
            return {
                "mean": 0.0,
                "std": 0.0,
                "min": 0.0,
                "max": 0.0
            }
        
        return {
            "mean": float(np.mean(metric_list)),
            "std": float(np.std(metric_list)),
            "min": float(np.min(metric_list)),
            "max": float(np.max(metric_list))
        }
    
    @staticmethod
    def compare_retrievers(results_a: Dict, results_b: Dict, metric_key: str) -> Dict:
        """
        Compare two sets of retriever results
        
        Args:
            results_a: Results from retriever A
            results_b: Results from retriever B
            metric_key: Key of metric to compare
        
        Returns:
            Comparison metrics
        """
        values_a = [r[metric_key] for r in results_a if metric_key in r]
        values_b = [r[metric_key] for r in results_b if metric_key in r]
        
        mean_a = np.mean(values_a) if values_a else 0.0
        mean_b = np.mean(values_b) if values_b else 0.0
        
        diff = mean_b - mean_a
        pct_change = (diff / mean_a * 100) if mean_a != 0 else 0
        
        return {
            "retriever_a_mean": float(mean_a),
            "retriever_b_mean": float(mean_b),
            "difference": float(diff),
            "percent_change": float(pct_change),
            "winner": "B" if mean_b > mean_a else "A"
        }
