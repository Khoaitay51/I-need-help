"""
RAG Comparison Test Script - GraphRAG vs Traditional RAG
Đánh giá hai phương pháp RAG với các độ đo: 
- Cosine Similarity
- Precision
- MAP (Mean Average Precision)
- MRR (Mean Reciprocal Rank)
- NDCG (Normalized Discounted Cumulative Gain)
"""

import asyncio
import os
import sys
import json
import csv
import time
import numpy as np
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from pathlib import Path
import logging

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize
import pandas as pd
from tabulate import tabulate
from tqdm import tqdm
from dotenv import load_dotenv

# LangChain imports
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings

# Project imports
from src.rag.retriever import MetadataEnhancedHybridRetriever
from src.graph_rag.graph_retriever import GraphRoutedRetriever
from src.graph_rag.graph_builder import DocumentGraph
from src.graph_rag.subgraph_partitioner import SubgraphPartitioner
from src.llm.config import get_llm

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text:latest")
DATASET_PATH = Path(__file__).parent.parent / "dataset chatbot update.csv"
OUTPUT_DIR = Path(__file__).parent / "rag_test_results"
OUTPUT_DIR.mkdir(exist_ok=True)

# Test configuration
TEST_CONFIG = {
    "k_retrieved": 5,  # Number of documents to retrieve
    "top_k_for_metrics": 5,  # Top K for precision and other metrics
    "num_samples": None,  # None for all samples, set to number for testing
}


class RAGComparisonTester:
    """Comprehensive RAG comparison tester"""
    
    def __init__(self):
        self.dataset: List[Dict] = []
        self.embeddings = None
        self.traditional_retriever: Optional[MetadataEnhancedHybridRetriever] = None
        self.graph_retriever: Optional[GraphRoutedRetriever] = None
        self.results = {
            "traditional_rag": [],
            "graph_rag": [],
            "aggregate_metrics": {}
        }
        self.test_start_time = None
        
    def load_dataset(self) -> None:
        """Load dataset from CSV file"""
        logger.info(f"📚 Loading dataset from {DATASET_PATH}")
        
        if not DATASET_PATH.exists():
            raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")
        
        with open(DATASET_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            row_count = 0
            for row in reader:
                row_count += 1
                if row.get('question') and row.get('answer_expected'):
                    self.dataset.append({
                        'question': row['question'].strip(),
                        'answer_expected': row['answer_expected'].strip()
                    })
            if row_count == 0:
                logger.warning(f"⚠️  CSV file is empty or has no valid rows")
        
        logger.info(f"✅ Loaded {len(self.dataset)} Q&A pairs")
        
        # Limit samples if specified in config
        if TEST_CONFIG['num_samples']:
            self.dataset = self.dataset[:TEST_CONFIG['num_samples']]
            logger.info(f"🎯 Using {len(self.dataset)} samples for testing")
    
    async def setup_retrievers(self) -> None:
        """Initialize embeddings and retrievers"""
        logger.info("🔧 Setting up embeddings...")
        
        try:
            # Initialize embeddings
            self.embeddings = OllamaEmbeddings(
                model=OLLAMA_EMBEDDING_MODEL,
                base_url=OLLAMA_BASE_URL
            )
            logger.info(f"✅ Using Ollama embeddings: {OLLAMA_EMBEDDING_MODEL}")
        except Exception as e:
            logger.warning(f"⚠️  Failed to initialize Ollama embeddings: {e}")
            logger.info("Using default sentence-transformers...")
            from langchain_community.embeddings import HuggingFaceEmbeddings
            self.embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
        
        # Prepare documents from dataset expected answers
        logger.info("📄 Preparing documents from dataset...")
        documents = [
            Document(
                page_content=item['answer_expected'],
                metadata={
                    'question': item['question'],
                    'source': 'dataset',
                    'index': i
                }
            )
            for i, item in enumerate(self.dataset)
        ]
        
        logger.info(f"📝 Creating FAISS vector store with {len(documents)} documents...")
        vectorstore = FAISS.from_documents(
            documents, 
            self.embeddings
        )
        
        logger.info("🔤 Creating BM25 retriever...")
        bm25_retriever = BM25Retriever.from_documents(documents)
        bm25_retriever.k = TEST_CONFIG['k_retrieved']
        
        # Setup Traditional RAG
        self.traditional_retriever = MetadataEnhancedHybridRetriever(
            vectorstore=vectorstore,
            bm25_retriever=bm25_retriever,
            k=TEST_CONFIG['k_retrieved']
        )
        logger.info("✅ Traditional Retriever ready")
        
        # Setup Graph RAG (if documents available)
        try:
            logger.info("🔗 Building GraphRAG retriever...")
            
            # Validate documents
            if not documents:
                logger.warning("⚠️  No documents available for GraphRAG")
                self.graph_retriever = None
            else:
                logger.info(f"📊 Creating DocumentGraph from {len(documents)} documents...")
                # Create document graph using build_graph
                doc_graph = DocumentGraph()
                doc_graph.build_graph(documents)
                
                logger.info(f"📊 Graph created: {doc_graph.graph.number_of_nodes()} nodes, {doc_graph.graph.number_of_edges()} edges")
                
                # Create subgraph partitioner
                logger.info("🔗 Creating SubgraphPartitioner...")
                partitioner = SubgraphPartitioner(doc_graph.graph)  # ✅ Pass the nx.Graph, not DocumentGraph
                logger.info(f"📊 Partitioner created with {len(partitioner.communities)} communities")
                
                # Initialize graph retriever
                logger.info("🔗 Initializing GraphRoutedRetriever...")
                self.graph_retriever = GraphRoutedRetriever(
                    graph=doc_graph.graph,
                    partitioner=partitioner,
                    k=TEST_CONFIG['k_retrieved'],
                    embeddings_model=OLLAMA_EMBEDDING_MODEL
                )
                logger.info("✅ GraphRAG Retriever ready")
        except Exception as e:
            import traceback
            logger.error(f"❌ Failed to setup GraphRAG: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            logger.info("Proceeding with Traditional RAG only")
            self.graph_retriever = None
    
    # ============ METRIC CALCULATIONS ============
    
    @staticmethod
    def calculate_cosine_similarity(text1: str, text2: str, embeddings_model) -> float:
        """Calculate cosine similarity between two texts"""
        try:
            emit1 = embeddings_model.embed_query(text1)
            emit2 = embeddings_model.embed_query(text2)
            
            # Reshape for sklearn
            emit1 = np.array(emit1).reshape(1, -1)
            emit2 = np.array(emit2).reshape(1, -1)
            
            similarity = cosine_similarity(emit1, emit2)[0][0]
            return float(similarity)
        except Exception as e:
            logger.warning(f"Error calculating cosine similarity: {e}")
            return 0.0
    
    @staticmethod
    def calculate_precision_at_k(retrieved_docs: List[Document], 
                                 ground_truth_indices: List[int], 
                                 k: int) -> float:
        """Calculate Precision@K"""
        if not retrieved_docs or k == 0:
            return 0.0
        
        retrieved_indices = [
            doc.metadata.get('index', -1) 
            for doc in retrieved_docs[:k]
        ]
        
        # Count matches
        matches = sum(1 for idx in retrieved_indices if idx in ground_truth_indices)
        precision = matches / k
        return precision
    
    @staticmethod
    def calculate_map(retrieved_docs: List[Document], 
                      ground_truth_indices: List[int],
                      k: int) -> float:
        """Calculate Mean Average Precision"""
        if not retrieved_docs:
            return 0.0
        
        retrieved_indices = [
            doc.metadata.get('index', -1) 
            for doc in retrieved_docs[:k]
        ]
        
        precisions = []
        num_relevant = 0
        
        for i, idx in enumerate(retrieved_indices):
            if idx in ground_truth_indices:
                num_relevant += 1
                precisions.append(num_relevant / (i + 1))
        
        if not precisions:
            return 0.0
        
        return sum(precisions) / len(ground_truth_indices) if ground_truth_indices else 0.0
    
    @staticmethod
    def calculate_mrr(retrieved_docs: List[Document], 
                      ground_truth_indices: List[int]) -> float:
        """Calculate Mean Reciprocal Rank"""
        if not retrieved_docs:
            return 0.0
        
        for i, doc in enumerate(retrieved_docs):
            if doc.metadata.get('index', -1) in ground_truth_indices:
                return 1.0 / (i + 1)
        
        return 0.0
    
    @staticmethod
    def calculate_ndcg(retrieved_docs: List[Document], 
                       ground_truth_indices: List[int],
                       k: int) -> float:
        """Calculate Normalized Discounted Cumulative Gain"""
        if not retrieved_docs:
            return 0.0
        
        # DCG calculation
        dcg = 0.0
        for i, doc in enumerate(retrieved_docs[:k]):
            if doc.metadata.get('index', -1) in ground_truth_indices:
                dcg += 1.0 / np.log2(i + 2)  # log2(i+2) because i is 0-indexed
        
        # IDCG calculation (ideal ranking)
        idcg = 0.0
        num_relevant = min(len(ground_truth_indices), k)
        for i in range(num_relevant):
            idcg += 1.0 / np.log2(i + 2)
        
        if idcg == 0.0:
            return 0.0
        
        return dcg / idcg
    
    # ============ RETRIEVAL AND TESTING ============
    
    async def test_retriever(self, 
                            query: str, 
                            retriever_type: str,
                            retriever,
                            ground_truth_index: int) -> Dict:
        """Test a single retriever on a query"""
        try:
            # Retrieve documents
            start_time = time.time()
            
            if retriever_type == "traditional_rag":
                retrieved_docs = self.traditional_retriever.invoke(query)
            else:  # graph_rag
                retrieved_docs = self.graph_retriever.invoke(query)
            
            retrieval_time = time.time() - start_time
            
            # Prepare metrics
            metrics = {
                "retriever_type": retriever_type,
                "query": query,
                "retrieval_time_ms": retrieval_time * 1000,
                "num_docs_retrieved": len(retrieved_docs),
                "retrieved_indices": [
                    doc.metadata.get('index', -1) for doc in retrieved_docs
                ]
            }
            
            # Calculate similarity with expected answer
            expected_answer = self.dataset[ground_truth_index]['answer_expected']
            cosine_sim = self.calculate_cosine_similarity(
                query, 
                expected_answer, 
                self.embeddings
            )
            metrics['cosine_similarity'] = cosine_sim
            
            # Ground truth is single document (the expected answer)
            ground_truth_indices = [ground_truth_index]
            
            # Calculate ranking metrics
            k = TEST_CONFIG['top_k_for_metrics']
            metrics['precision_at_k'] = self.calculate_precision_at_k(
                retrieved_docs, 
                ground_truth_indices, 
                k
            )
            metrics['map'] = self.calculate_map(
                retrieved_docs, 
                ground_truth_indices, 
                k
            )
            metrics['mrr'] = self.calculate_mrr(
                retrieved_docs, 
                ground_truth_indices
            )
            metrics['ndcg'] = self.calculate_ndcg(
                retrieved_docs, 
                ground_truth_indices, 
                k
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error testing {retriever_type}: {e}")
            return {
                "retriever_type": retriever_type,
                "query": query,
                "error": str(e)
            }
    
    async def run_tests(self) -> None:
        """Run comprehensive tests"""
        self.test_start_time = datetime.now()
        logger.info(f"🚀 Starting RAG comparison tests at {self.test_start_time}")
        
        await self.setup_retrievers()
        
        # Test each question
        for idx, item in enumerate(tqdm(self.dataset, desc="Testing")):
            query = item['question']
            
            # Test Traditional RAG
            trad_result = await self.test_retriever(
                query,
                "traditional_rag",
                self.traditional_retriever,
                idx
            )
            self.results["traditional_rag"].append(trad_result)
            
            # Test Graph RAG (if available)
            if self.graph_retriever:
                graph_result = await self.test_retriever(
                    query,
                    "graph_rag",
                    self.graph_retriever,
                    idx
                )
                self.results["graph_rag"].append(graph_result)
    
    def calculate_aggregate_metrics(self) -> None:
        """Calculate aggregate metrics for comparison"""
        logger.info("📊 Calculating aggregate metrics...")
        
        for retriever_type in ["traditional_rag", "graph_rag"]:
            if not self.results[retriever_type]:
                continue
            
            results = self.results[retriever_type]
            
            # Filter out errors
            valid_results = [r for r in results if "error" not in r]
            
            if not valid_results:
                logger.warning(f"No valid results for {retriever_type}")
                continue
            
            aggregate = {
                "total_tests": len(valid_results),
                "cosine_similarity": {
                    "mean": np.mean([r['cosine_similarity'] for r in valid_results]),
                    "std": np.std([r['cosine_similarity'] for r in valid_results]),
                    "min": np.min([r['cosine_similarity'] for r in valid_results]),
                    "max": np.max([r['cosine_similarity'] for r in valid_results]),
                },
                "precision_at_k": {
                    "mean": np.mean([r['precision_at_k'] for r in valid_results]),
                    "std": np.std([r['precision_at_k'] for r in valid_results]),
                },
                "map": {
                    "mean": np.mean([r['map'] for r in valid_results]),
                    "std": np.std([r['map'] for r in valid_results]),
                },
                "mrr": {
                    "mean": np.mean([r['mrr'] for r in valid_results]),
                    "std": np.std([r['mrr'] for r in valid_results]),
                },
                "ndcg": {
                    "mean": np.mean([r['ndcg'] for r in valid_results]),
                    "std": np.std([r['ndcg'] for r in valid_results]),
                },
                "retrieval_time_ms": {
                    "mean": np.mean([r['retrieval_time_ms'] for r in valid_results]),
                    "std": np.std([r['retrieval_time_ms'] for r in valid_results]),
                },
            }
            
            self.results["aggregate_metrics"][retriever_type] = aggregate
    
    def generate_comparison_report(self) -> Dict:
        """Generate detailed comparison report"""
        comparison = {}
        
        if len(self.results["aggregate_metrics"]) < 2:
            logger.warning("Need results from both retrievers for comparison")
            return comparison
        
        trad_metrics = self.results["aggregate_metrics"].get("traditional_rag", {})
        graph_metrics = self.results["aggregate_metrics"].get("graph_rag", {})
        
        metrics_to_compare = [
            ("Cosine Similarity", "cosine_similarity"),
            ("Precision@K", "precision_at_k"),
            ("MAP", "map"),
            ("MRR", "mrr"),
            ("NDCG", "ndcg"),
        ]
        
        comparison_data = []
        for metric_name, metric_key in metrics_to_compare:
            trad_val = trad_metrics.get(metric_key, {}).get("mean", 0)
            graph_val = graph_metrics.get(metric_key, {}).get("mean", 0)
            
            diff = graph_val - trad_val
            pct_change = (diff / trad_val * 100) if trad_val != 0 else 0
            winner = "GraphRAG ✓" if graph_val > trad_val else "Traditional ✓"
            
            comparison_data.append({
                "Metric": metric_name,
                "Traditional RAG": f"{trad_val:.4f}",
                "GraphRAG": f"{graph_val:.4f}",
                "Difference": f"{diff:+.4f}",
                "% Change": f"{pct_change:+.2f}%",
                "Winner": winner
            })
        
        return comparison_data
    
    def save_results(self) -> None:
        """Save detailed results to JSON and CSV"""
        logger.info("💾 Saving results...")
        
        # Save full results as JSON
        results_json_path = OUTPUT_DIR / f"rag_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_json_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Full results saved to {results_json_path}")
        
        # Save aggregate metrics
        aggregate_json_path = OUTPUT_DIR / f"aggregate_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(aggregate_json_path, 'w', encoding='utf-8') as f:
            json.dump(self.results["aggregate_metrics"], f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Aggregate metrics saved to {aggregate_json_path}")
        
        # Save comparison report as CSV
        comparison_data = self.generate_comparison_report()
        if comparison_data:
            csv_path = OUTPUT_DIR / f"comparison_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            csv_df = pd.DataFrame(comparison_data)
            csv_df.to_csv(csv_path, index=False, encoding='utf-8')
            logger.info(f"✅ Comparison report saved to {csv_path}")
    
    def print_report(self) -> None:
        """Print formatted report to console"""
        print("\n" + "="*80)
        print("📊 RAG COMPARISON TEST REPORT")
        print("="*80)
        
        # Print aggregate metrics per retriever
        for retriever_type, metrics in self.results["aggregate_metrics"].items():
            print(f"\n### {retriever_type.upper()} ###")
            
            metrics_display = [
                ["Total Tests", metrics.get("total_tests", 0)],
                ["Cosine Similarity", f"{metrics['cosine_similarity']['mean']:.4f} ± {metrics['cosine_similarity']['std']:.4f}"],
                ["Precision@K", f"{metrics['precision_at_k']['mean']:.4f} ± {metrics['precision_at_k']['std']:.4f}"],
                ["MAP", f"{metrics['map']['mean']:.4f} ± {metrics['map']['std']:.4f}"],
                ["MRR", f"{metrics['mrr']['mean']:.4f} ± {metrics['mrr']['std']:.4f}"],
                ["NDCG", f"{metrics['ndcg']['mean']:.4f} ± {metrics['ndcg']['std']:.4f}"],
                ["Avg Retrieval Time (ms)", f"{metrics['retrieval_time_ms']['mean']:.2f} ± {metrics['retrieval_time_ms']['std']:.2f}"],
            ]
            print(tabulate(metrics_display, headers=["Metric", "Value"], tablefmt="grid"))
        
        # Print comparison
        print("\n### COMPARISON ###")
        comparison_data = self.generate_comparison_report()
        if comparison_data:
            print(tabulate(comparison_data, headers="keys", tablefmt="grid"))
        
        print("\n" + "="*80)
        end_time = datetime.now()
        duration = (end_time - self.test_start_time).total_seconds()
        print(f"✅ Test completed in {duration:.2f} seconds")
        print(f"📁 Results saved to: {OUTPUT_DIR}")


async def main():
    """Main entry point"""
    try:
        tester = RAGComparisonTester()
        
        # Load dataset
        tester.load_dataset()
        
        # Run tests
        await tester.run_tests()
        
        # Calculate metrics
        tester.calculate_aggregate_metrics()
        
        # Save and print results
        tester.save_results()
        tester.print_report()
        
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
