"""
LLM Factory để tạo các instance model khác nhau dựa trên loại model đang hoạt động.
"""
from typing import Optional, Dict, Any, List
from langchain_core.language_models import BaseChatModel
from langchain_core.callbacks.manager import CallbackManager
from langchain_ollama import ChatOllama
from langchain_google_genai import ChatGoogleGenerativeAI
import os

from .HFChatModel import HuggingFaceChatModel
from .model_manager import model_manager, ModelType

class LLMFactory:
    """Factory để tạo các instance LLM khác nhau dựa trên cấu hình."""
    
    @classmethod
    def create_llm(cls, callback_manager: Optional[CallbackManager] = None) -> BaseChatModel:
        """
        Tạo instance LLM dựa trên model đang hoạt động với fallback logic.
        
        Args:
            callback_manager: Optional callback manager cho tracing
            
        Returns:
            BaseChatModel: Instance LLM tương ứng
        """
        import logging
        import sys
        factory_logger = logging.getLogger(__name__)
        
        # Lấy loại model đang hoạt động
        model_type = model_manager.get_model_type()
        
        # Log for debugging with immediate flush using LOGGER
        factory_logger.critical(f"🏭🚨 [LLMFactory.create_llm] STARTING")
        factory_logger.critical(f"🏭🚨 model_type value: {model_type}")
        factory_logger.critical(f"🏭🚨 model_type == ModelType.OLLAMA: {model_type == ModelType.OLLAMA}")
        factory_logger.critical(f"🏭🚨 model_type == ModelType.GEMINI: {model_type == ModelType.GEMINI}")
        
        print(f"\n🏭🚨🏭🚨 [LLMFactory] model_type={model_type} 🏭🚨🏭🚨\n", file=sys.stderr)
        sys.stderr.flush()
        
        # Lấy các tham số chung
        temperature = model_manager.get_temperature()
        max_tokens = model_manager.get_max_tokens()
        
        # Tạo instance model tương ứng với fallback logic
        factory_logger.critical(f"🏭🚨 Condition check: model_type == ModelType.OLLAMA = {model_type == ModelType.OLLAMA}")
        if model_type == ModelType.OLLAMA:
            factory_logger.critical(f"✅ OLLAMA CONDITION TRUE - Creating Ollama model")
            try:
                result = cls._create_ollama_model(temperature, max_tokens, callback_manager)
                factory_logger.critical(f"✅ Successfully created Ollama: {type(result).__name__}")
                return result
            except Exception as e:
                factory_logger.critical(f"⚠️ OLLAMA CREATION FAILED!")
                factory_logger.critical(f"⚠️ Exception: {str(e)}")
                factory_logger.critical(f"⚠️ Exception Type: {type(e).__name__}")
                import traceback
                factory_logger.critical(f"⚠️ Traceback:\n{traceback.format_exc()}")
                factory_logger.critical(f"🔄 FALLING BACK TO GEMINI MODEL...")
                import sys
                print(f"\n\n🚨🚨🚨 OLLAMA FAILED - FALLBACK TO GEMINI 🚨🚨🚨", file=sys.stderr)
                print(f"Exception: {e}", file=sys.stderr)
                print(f"Type: {type(e).__name__}", file=sys.stderr)
                sys.stderr.flush()
                return cls._create_gemini_model(temperature, max_tokens, callback_manager)
        elif model_type == ModelType.GEMINI:
            factory_logger.critical(f"✅ GEMINI CONDITION TRUE - Creating Gemini model")
            return cls._create_gemini_model(temperature, max_tokens, callback_manager)
        else:  # HUGGINGFACE hoặc loại khác
            factory_logger.critical(f"⚠️ NEITHER OLLAMA NOR GEMINI - model_type is {model_type}")
            return cls._create_huggingface_model(temperature, max_tokens, callback_manager)
    
    @classmethod
    def _create_ollama_model(cls, temperature: float, max_tokens: int, 
                            callback_manager: Optional[CallbackManager] = None) -> ChatOllama:
        """Tạo model Ollama."""
        import logging
        logger = logging.getLogger(__name__)
        ollama_info = model_manager.get_ollama_info()
        
        logger.critical(f"🔧 Creating ChatOllama with model: {ollama_info['model']}")
        
        try:
            llm = ChatOllama(
                model=ollama_info["model"],
                base_url=ollama_info["url"],
                temperature=temperature,
                num_predict=max_tokens,
                callback_manager=callback_manager
            )
            logger.critical(f"✅ ChatOllama created successfully: {type(llm).__name__}")
            return llm
        except Exception as e:
            logger.critical(f"❌ Failed to create ChatOllama: {e}")
            import traceback
            logger.critical(traceback.format_exc())
            raise
    
    @classmethod
    def _create_gemini_model(cls, temperature: float, max_tokens: int,
                            callback_manager: Optional[CallbackManager] = None) -> ChatGoogleGenerativeAI:
        """Tạo model Gemini."""
        import logging
        logger = logging.getLogger(__name__)
        gemini_info = model_manager.get_gemini_info()
        
        logger.critical(f"🔧 Creating ChatGoogleGenerativeAI with model: {gemini_info['model']}")
        
        os.environ["GOOGLE_API_KEY"] = gemini_info["api_key"]
        
        try:
            llm = ChatGoogleGenerativeAI(
                model=gemini_info["model"],
                temperature=temperature,
                max_output_tokens=max_tokens,
                callback_manager=callback_manager
            )
            logger.critical(f"✅ ChatGoogleGenerativeAI created successfully: {type(llm).__name__}")
            return llm
        except Exception as e:
            logger.critical(f"❌ Failed to create ChatGoogleGenerativeAI: {e}")
            import traceback
            logger.critical(traceback.format_exc())
            raise
    
    @classmethod
    def _create_huggingface_model(cls, temperature: float, max_tokens: int,
                                callback_manager: Optional[CallbackManager] = None) -> HuggingFaceChatModel:
        """Tạo model Hugging Face."""
        hf_info = model_manager.get_huggingface_info()
        
        # Đặt HF_TOKEN
        os.environ["HF_TOKEN"] = hf_info["token"]
        
        return HuggingFaceChatModel(
            model_path=hf_info["model"],
            temperature=temperature,
            max_tokens=max_tokens
        )
