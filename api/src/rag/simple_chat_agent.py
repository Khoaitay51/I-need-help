import logging
import os
from pathlib import Path
from typing import Dict, Any

from langchain_core.messages import HumanMessage
from llm import get_llm, LLMConfig  # Sử dụng get_llm() để respect runtime model selection
from .retriever import create_enhanced_hybrid_retriever, smart_retrieve, get_metadata_config, MetadataEnhancedHybridRetriever

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class SimpleChatAgent:
    """Simplified chat agent without LangGraph to avoid recursion issues"""
    
    def __init__(self, custom_retriever=None, model_name: str = None):
        """Initialize the Simple Chat Agent"""
        
        # Sử dụng get_llm() để respect runtime model selection (Ollama/Gemini)
        try:
            self.llm = get_llm()
            logger.info(f"Initialized LLM with runtime model selection")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            raise
        
        # Store the retriever
        self.retriever = custom_retriever if custom_retriever is not None else self.get_default_retriever()
        
        # Load prompts
        self.prompts = self._load_prompts()
    
    def get_default_retriever(self):
        """Get the default hybrid retriever for KMA regulations"""
        current_dir = Path(__file__).parent.absolute()
        project_root = current_dir.parent.parent
        vector_db_path = os.path.join(project_root, "vector_db")
        data_dir = os.path.join(project_root, "data")
        
        # Use enhanced hybrid retriever with sliding window
        config = get_metadata_config()
        chunk_settings = config.get_chunk_settings()
        window_size = chunk_settings.get('sliding_window_size', 2)
        
        enhanced_retriever, _ = create_enhanced_hybrid_retriever(
            vector_db_path=vector_db_path, 
            data_dir=data_dir,
            window_size=window_size
        )
        return enhanced_retriever
    
    def _load_prompts(self):
        """Load prompts from files"""
        prompts = {}
        prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
        
        # Try to load detailed prompt first
        try:
            with open(os.path.join(prompts_dir, "detailed_generate.txt"), "r", encoding="utf-8") as f:
                prompts["generate"] = f.read().strip()
                logger.info("Loaded detailed generate prompt")
        except FileNotFoundError:
            # Try standard prompt
            try:
                with open(os.path.join(prompts_dir, "generate.txt"), "r", encoding="utf-8") as f:
                    prompts["generate"] = f.read().strip()
                    logger.info("Loaded standard generate prompt")
            except FileNotFoundError:
                # Enhanced detailed prompt for file content
                prompts["generate"] = """Bạn là một trợ lý AI thông minh chuyên phân tích và trả lời câu hỏi dựa trên nội dung tài liệu.

Nhiệm vụ: Hãy phân tích kỹ thông tin được cung cấp và đưa ra câu trả lời chi tiết, đầy đủ và hữu ích.

Câu hỏi: {question}

Thông tin từ tài liệu:
{context}

Yêu cầu trả lời:
1. Trả lời trực tiếp câu hỏi với thông tin cụ thể từ tài liệu
2. Cung cấp chi tiết và ví dụ nếu có trong tài liệu
3. Nếu có nhiều thông tin liên quan, hãy tổ chức thành các điểm rõ ràng
4. Nếu thông tin không đầy đủ để trả lời, hãy nêu rõ những gì có thể trả lời được
5. Sử dụng ngôn ngữ rõ ràng, dễ hiểu và tự nhiên

Trả lời chi tiết:"""
                logger.info("Using fallback detailed prompt")
        
        return prompts
    
    def chat(self, message: str) -> str:
        """Process a chat message and return detailed response"""
        try:
            logger.info(f"Processing query: {message}")
            
            # Retrieve relevant documents using smart retrieval with sliding window
            if isinstance(self.retriever, MetadataEnhancedHybridRetriever):
                docs = smart_retrieve(self.retriever, message, use_smart_filtering=True)
            else:
                docs = self.retriever.get_relevant_documents(message)
            
            # Use more context for detailed answers
            context_docs = docs[:8]  # Increase from 5 to 8 for more context
            context = "\n\n---\n\n".join([
                f"Đoạn {i+1}:\n{doc.page_content}" 
                for i, doc in enumerate(context_docs)
            ])
            
            # Enhanced prompt for detailed responses
            if context.strip():
                # Add context about the query type for better responses
                enhanced_prompt = f"""Bạn là một trợ lý AI chuyên nghiệp, hãy phân tích kỹ câu hỏi và thông tin được cung cấp để đưa ra câu trả lời toàn diện.

🎯 Câu hỏi cần trả lời: {message}

📚 Thông tin từ tài liệu (được chia thành các đoạn):
{context}

📝 Hướng dẫn trả lời:
• Đọc kỹ tất cả các đoạn thông tin được cung cấp
• Tổng hợp và phân tích để đưa ra câu trả lời đầy đủ nhất
• Sắp xếp thông tin theo logic, chia thành các phần rõ ràng
• Cung cấp ví dụ cụ thể từ tài liệu nếu có
• Sử dụng bullet points hoặc số thứ tự khi phù hợp
• Nếu có nhiều khía cạnh, hãy trình bày từng khía cạnh một cách có hệ thống

💬 Câu trả lời chi tiết:"""
            else:
                enhanced_prompt = f"""Xin lỗi, tôi không tìm thấy thông tin liên quan trong tài liệu đã upload để trả lời câu hỏi: "{message}"

Vui lòng thử:
• Đặt câu hỏi khác liên quan đến nội dung tài liệu
• Sử dụng từ khóa khác có thể có trong tài liệu
• Kiểm tra lại xem tài liệu có chứa thông tin bạn đang tìm không

Tôi sẽ cố gắng trả lời dựa trên kiến thức tổng quát: {message}"""
            
            response = self.llm.invoke([{"role": "user", "content": enhanced_prompt}])
            
            # Post-process response to add more details if needed
            answer = response.content
            
            # Add source information at the end
            if context.strip() and len(context_docs) > 0:
                answer += f"\n\n📋 *Thông tin được tổng hợp từ {len(context_docs)} đoạn liên quan trong tài liệu.*"
            
            logger.info("Detailed response generated successfully")
            return answer
            
        except Exception as e:
            logger.error(f"Error in chat processing: {str(e)}")
            return f"❌ Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi: {str(e)}\n\nVui lòng thử lại hoặc đặt câu hỏi khác."


async def process_simple_query(query: str, retriever=None, llm=None) -> Dict[str, Any]:
    """Simple query processing function without LangGraph"""
    try:
        # Create agent
        agent = SimpleChatAgent(custom_retriever=retriever)
        
        # Process query
        answer = agent.chat(query)
        
        # Get sources using smart retrieval
        if isinstance(agent.retriever, MetadataEnhancedHybridRetriever):
            docs = smart_retrieve(agent.retriever, query, use_smart_filtering=True)
        else:
            docs = agent.retriever.get_relevant_documents(query)
        sources = [doc.page_content for doc in docs[:3]]
        
        return {
            "answer": answer,
            "sources": sources,
            "source_type": "simple_agent"
        }
        
    except Exception as e:
        logger.error(f"Error in simple query processing: {str(e)}")
        return {
            "answer": f"Lỗi xử lý câu hỏi: {str(e)}",
            "sources": [],
            "source_type": "error"
        }
