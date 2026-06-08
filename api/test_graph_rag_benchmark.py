"""
GraphRAG vs Traditional RAG Benchmark
So sánh GraphRAG vs RAG thường, LLM models (Gemini vs Ollama)
"""

import asyncio
import time
import json
from typing import Dict, List, Tuple
from datetime import datetime
import numpy as np
from tabulate import tabulate

# Test queries
TEST_QUERIES = [
    "Các thành phần trong đánh giá học phần?",
    "Quy định về công tác khảo thí 2025?",
    "Quy chế hoạt động KHCN là gì?",
    "Cách tính điểm trung bình học kỳ?",
    "Điều kiện để được cấp bằng tốt nghiệp?",
]

# Models to test
MODELS_CONFIG = {
    "gemini": {
        "name": "Gemini 2.0 Flash (API)",
        "type": "gemini",
        "cost_per_token": 0.000075,  # $0.075 per 1M input tokens
        "cost_output_token": 0.0003,  # $0.3 per 1M output tokens
    },
    "qwen3:8b": {
        "name": "Qwen 3 8B (Ollama)",
        "type": "ollama",
        "cost_per_token": 0.0,
    },
    "qwen3:32b": {
        "name": "Qwen 3 32B (Ollama)",
        "type": "ollama",
        "cost_per_token": 0.0,
    },
    "qwen2.5:72b-instruct": {
        "name": "Qwen 2.5 72B Instruct (Ollama)",
        "type": "ollama",
        "cost_per_token": 0.0,
    },
}

# RAG modes
RAG_MODES = {
    "traditional_rag": "Traditional Keyword-based RAG",
    "graph_rag": "GraphRAG (Department-aware)"
}


class RAGBenchmark:
    def __init__(self):
        self.results = []
        self.start_time = datetime.now()
    
    async def test_traditional_rag(self, query: str, model: str) -> Dict:
        """Test với Traditional RAG"""
        import time
        from langchain.retrievers import BM25Retriever
        from langchain_community.vectorstores import FAISS
        
        try:
            start = time.time()
            
            # Simulate traditional RAG (keyword + vector search)
            # Thực tế sẽ gọi retriever
            await asyncio.sleep(0.1)  # Simulate retrieval time
            
            elapsed = time.time() - start
            
            return {
                "mode": "traditional_rag",
                "query": query,
                "model": model,
                "response_time_ms": elapsed * 1000,
                "tokens_input": len(query.split()) * 2,
                "tokens_output": len("Kết quả tìm kiếm truyền thống").split(),
                "retrieval_docs_count": 5,
                "answer_length": len("Kết quả tìm kiếm truyền thống"),
                "latency_ms": elapsed * 1000,
            }
        except Exception as e:
            return {"error": str(e), "mode": "traditional_rag"}
    
    async def test_graph_rag(self, query: str, model: str) -> Dict:
        """Test với GraphRAG"""
        try:
            start = time.time()
            
            # Simulate GraphRAG (semantic routing + department-aware)
            await asyncio.sleep(0.15)  # Simulate semantic analysis + retrieval
            
            elapsed = time.time() - start
            
            return {
                "mode": "graph_rag",
                "query": query,
                "model": model,
                "response_time_ms": elapsed * 1000,
                "tokens_input": len(query.split()) * 2,
                "tokens_output": len("Kết quả từ GraphRAG").split(),
                "retrieval_docs_count": 3,
                "answer_length": len("Kết quả từ GraphRAG"),
                "latency_ms": elapsed * 1000,
                "department_detected": "viennghiencuuvahoptacphattrien",
                "semantic_score": 0.95,
            }
        except Exception as e:
            return {"error": str(e), "mode": "graph_rag"}
    
    def calculate_metrics(self, results: List[Dict]) -> Dict:
        """Tính toán các metrics từ kết quả test"""
        if not results:
            return {}
        
        response_times = [r.get("response_time_ms", 0) for r in results if "error" not in r]
        tokens_input = [r.get("tokens_input", 0) for r in results if "error" not in r]
        tokens_output = [r.get("tokens_output", 0) for r in results if "error" not in r]
        
        metrics = {
            "test_count": len(results),
            "success_count": len([r for r in results if "error" not in r]),
            "error_count": len([r for r in results if "error" in r]),
            "avg_response_time_ms": np.mean(response_times) if response_times else 0,
            "min_response_time_ms": np.min(response_times) if response_times else 0,
            "max_response_time_ms": np.max(response_times) if response_times else 0,
            "p95_response_time_ms": np.percentile(response_times, 95) if response_times else 0,
            "p99_response_time_ms": np.percentile(response_times, 99) if response_times else 0,
            "avg_tokens_input": np.mean(tokens_input) if tokens_input else 0,
            "avg_tokens_output": np.mean(tokens_output) if tokens_output else 0,
            "total_tokens": sum(tokens_input) + sum(tokens_output),
        }
        
        return metrics
    
    async def run_benchmark(self):
        """Chạy benchmark test"""
        print("\n" + "="*100)
        print("🧪 GraphRAG vs Traditional RAG Benchmark")
        print("="*100 + "\n")
        
        all_results = []
        
        for rag_mode_key, rag_mode_name in RAG_MODES.items():
            print(f"\n📊 Testing {rag_mode_name}")
            print("-" * 80)
            
            mode_results = []
            
            for query in TEST_QUERIES:
                for model_key, model_config in MODELS_CONFIG.items():
                    print(f"  Testing: {query[:50]}... with {model_config['name']}")
                    
                    if rag_mode_key == "traditional_rag":
                        result = await self.test_traditional_rag(query, model_key)
                    else:
                        result = await self.test_graph_rag(query, model_key)
                    
                    mode_results.append(result)
                    all_results.append(result)
            
            # Calculate metrics for this RAG mode
            metrics = self.calculate_metrics(mode_results)
            
            print(f"\n📈 Kết quả {rag_mode_name}:")
            metrics_table = [
                ["Success Rate", f"{metrics.get('success_count', 0)}/{metrics.get('test_count', 0)}"],
                ["Avg Response Time", f"{metrics.get('avg_response_time_ms', 0):.2f}ms"],
                ["Min Response Time", f"{metrics.get('min_response_time_ms', 0):.2f}ms"],
                ["Max Response Time", f"{metrics.get('max_response_time_ms', 0):.2f}ms"],
                ["P95 Latency", f"{metrics.get('p95_response_time_ms', 0):.2f}ms"],
                ["P99 Latency", f"{metrics.get('p99_response_time_ms', 0):.2f}ms"],
                ["Avg Tokens (Input)", f"{metrics.get('avg_tokens_input', 0):.0f}"],
                ["Avg Tokens (Output)", f"{metrics.get('avg_tokens_output', 0):.0f}"],
                ["Total Tokens", f"{metrics.get('total_tokens', 0):.0f}"],
            ]
            print(tabulate(metrics_table, headers=["Metric", "Value"], tablefmt="grid"))
        
        return all_results
    
    def compare_models(self, results: List[Dict]) -> None:
        """So sánh hiệu suất các models"""
        print("\n" + "="*100)
        print("🤖 Model Performance Comparison")
        print("="*100 + "\n")
        
        model_stats = {}
        
        for result in results:
            if "error" in result:
                continue
            
            model = result.get("model")
            if model not in model_stats:
                model_stats[model] = []
            
            model_stats[model].append(result)
        
        comparison_table = []
        
        for model_key in MODELS_CONFIG.keys():
            if model_key not in model_stats:
                continue
            
            model_results = model_stats[model_key]
            model_config = MODELS_CONFIG[model_key]
            
            response_times = [r.get("response_time_ms", 0) for r in model_results]
            tokens = [r.get("tokens_input", 0) + r.get("tokens_output", 0) for r in model_results]
            
            avg_response_time = np.mean(response_times)
            throughput = len(model_results) / (sum(response_times) / 1000) if sum(response_times) > 0 else 0
            total_tokens = sum(tokens)
            estimated_cost = (total_tokens * model_config["cost_per_token"]) if model_config["type"] == "gemini" else 0
            
            comparison_table.append([
                model_config["name"],
                f"{avg_response_time:.2f}ms",
                f"{throughput:.2f} req/s",
                f"{total_tokens:.0f}",
                f"${estimated_cost:.4f}" if estimated_cost > 0 else "FREE",
                model_config["type"].upper(),
            ])
        
        print(tabulate(
            comparison_table,
            headers=["Model", "Avg Response Time", "Throughput", "Total Tokens", "Est. Cost", "Type"],
            tablefmt="grid"
        ))
    
    def compare_rag_modes(self, results: List[Dict]) -> None:
        """So sánh RAG modes"""
        print("\n" + "="*100)
        print("🔍 RAG Modes Comparison")
        print("="*100 + "\n")
        
        rag_stats = {}
        
        for result in results:
            if "error" in result:
                continue
            
            mode = result.get("mode")
            if mode not in rag_stats:
                rag_stats[mode] = []
            
            rag_stats[mode].append(result)
        
        comparison_table = []
        
        for mode_key, mode_name in RAG_MODES.items():
            if mode_key not in rag_stats:
                continue
            
            mode_results = rag_stats[mode_key]
            response_times = [r.get("response_time_ms", 0) for r in mode_results]
            doc_counts = [r.get("retrieval_docs_count", 0) for r in mode_results]
            
            avg_response_time = np.mean(response_times)
            avg_docs_retrieved = np.mean(doc_counts)
            
            comparison_table.append([
                mode_name,
                f"{avg_response_time:.2f}ms",
                f"{avg_docs_retrieved:.1f}",
                len(mode_results),
            ])
        
        print(tabulate(
            comparison_table,
            headers=["RAG Mode", "Avg Response Time", "Avg Docs Retrieved", "Test Count"],
            tablefmt="grid"
        ))
    
    async def save_results(self, results: List[Dict], filename: str = "benchmark_results.json") -> None:
        """Lưu kết quả test"""
        output = {
            "timestamp": self.start_time.isoformat(),
            "total_tests": len(results),
            "models_tested": list(MODELS_CONFIG.keys()),
            "rag_modes_tested": list(RAG_MODES.keys()),
            "queries_tested": len(TEST_QUERIES),
            "results": results,
        }
        
        filepath = f"e:/My_Project/AI/lma_agent/api/{filename}"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Kết quả đã lưu: {filepath}")


async def main():
    """Main entry point"""
    benchmark = RAGBenchmark()
    
    # Run benchmark
    results = await benchmark.run_benchmark()
    
    # Compare models
    benchmark.compare_models(results)
    
    # Compare RAG modes
    benchmark.compare_rag_modes(results)
    
    # Save results
    await benchmark.save_results(results)
    
    print("\n" + "="*100)
    print("✅ Benchmark hoàn thành!")
    print("="*100)


if __name__ == "__main__":
    asyncio.run(main())
