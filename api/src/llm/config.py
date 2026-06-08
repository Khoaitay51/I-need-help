
import os
from typing import Optional, List, Any
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.callbacks.manager import CallbackManager
from langchain_ollama import ChatOllama
from langsmith import Client as LangSmithClient
try:
    from langsmith.wrappers.langchain import LangChainTracer
except ImportError:
    LangChainTracer = None
from langchain_google_genai import ChatGoogleGenerativeAI

from .llm_factory import LLMFactory

# Load environment variables
load_dotenv()

# Phần còn lại của file giữ nguyên
class LLMConfig:
    """Configuration for language models used in the KMA Chat Agent."""
    
    DEFAULT_RAG_MODEL_NAME = "mistral"
    DEFAULT_PROJECT_NAME = "KMA_CHAT"
    DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
    
    @classmethod
    def create_rag_llm(cls,
                  model_name: str = None,
                  callback_manager: Optional[CallbackManager] = None) -> BaseChatModel:
        """Create a model instance with specified configuration.
        
        Args:
            model_name: Name of the model to use (deprecated - model selection now via ModelManager)
            callback_manager: Optional callback manager for tracing
            
        Returns:
            Configured model instance based on admin's active model selection
        """
        # Use LLMFactory which respects ModelManager's active model selection
        return LLMFactory.create_llm(callback_manager)
    
    @classmethod
    def create_callback_manager(cls, project_name: str = None) -> CallbackManager:
        """Create a callback manager with LangSmith tracer if available."""
        if project_name is None:
            project_name = cls.DEFAULT_PROJECT_NAME
        
        callbacks = []
        if LangChainTracer is not None:
            callbacks.append(LangChainTracer(project_name=project_name))
        
        return CallbackManager(callbacks) if callbacks else CallbackManager([])
    
# Utility function to get an LLM instance
def get_llm(model_name: str = None, project_name: str = None) -> BaseChatModel:
    """Get a configured LLM instance.
    
    Args:
        model_name: Optional model name to use
        project_name: Optional project name for LangSmith
        
    Returns:
        Configured LLM instance based on active model selection
    """
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    logger.critical(f"🚨 GET_LLM CALLED!")
    print(f"\n🚨🚨🚨 GET_LLM CALLED! 🚨🚨🚨\n", file=sys.stderr)
    sys.stderr.flush()
    
    callback_manager = None
    if project_name:
        callback_manager = LLMConfig.create_callback_manager(project_name)

    result = LLMConfig.create_rag_llm(model_name, callback_manager)
    logger.critical(f"🚨 GET_LLM RETURNING: {type(result).__name__}")
    print(f"\n🚨🚨🚨 GET_LLM RETURNING: {type(result).__name__} 🚨🚨🚨\n", file=sys.stderr)
    sys.stderr.flush()
    return result

def get_gemini_llm(model_name: str = None, callback_manager: Optional[CallbackManager] = None) -> BaseChatModel:
    """Get a configured LLM instance for Gemini."""
    load_dotenv()
    
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment variables")
    
    gemini_model = os.environ.get("GEMINI_MODEL")    
    if model_name is None:
        if gemini_model:
            model_name = gemini_model
        else:
            model_name = LLMConfig.DEFAULT_GEMINI_MODEL
    
    print(f"Initializing Gemini LLM with model: {model_name} and API key: {api_key[:5]}...")

    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=0,
        max_tokens=None,
        timeout=None,
        max_retries=2,
        google_api_key=api_key,
        callback_manager=callback_manager
    )
    return llm
