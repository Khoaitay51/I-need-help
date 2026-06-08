"""
Model Manager Module để quản lý các mô hình LLM khác nhau.
"""
import os
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from enum import Enum

# Load environment variables
load_dotenv()

class ModelType(str, Enum):
    HUGGINGFACE = "huggingface"
    OLLAMA = "ollama"
    GEMINI = "gemini"
    OTHER = "other"

class ModelManager:
    """Quản lý các mô hình LLM và tham số của chúng."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            print(f"🔄 ModelManager already initialized, skipping init")
            return
        
        print(f"🆕 ModelManager initializing for first time")
        
        # Skip MongoDB - chỉ dùng runtime và environment variables
        self.client = None
        self.db = None
        
        # Cache cho active model
        self._active_model = None
        self._active_model_params = None
        
        # Runtime model override (sẽ ghi đè lên DB config)
        self._runtime_model_type = None
        self._runtime_ollama_model = None
        self._runtime_gemini_model = None
        
        self._initialized = True
    
    def set_active_model_from_dict(self, model_dict: Dict[str, Any]) -> None:
        """
        Set active model from API layer after DB update. Called by models.py during activate.
        
        Args:
            model_dict: Model configuration dict from MongoDB
        """
        if model_dict:
            # DEBUG: Log entire model_dict to see structure
            print(f"🔍 [DEBUG] set_active_model_from_dict received: {model_dict}")
            
            # Convert ObjectId to string if needed
            if "_id" in model_dict:
                model_dict["id"] = str(model_dict["_id"])
                del model_dict["_id"]
            
            self._active_model = model_dict
            self._active_model_params = model_dict.get("parameters", {})
            
            # CRITICAL: Also set runtime model type from the dict
            # This ensures subsequent requests use the correct model type
            raw_model_type = model_dict.get("modelType", "gemini")
            print(f"🔍 [DEBUG] Raw modelType value: {raw_model_type} (type: {type(raw_model_type)})")
            
            # Handle both enum and string values
            if isinstance(raw_model_type, ModelType):
                # Already an enum, use directly
                self._runtime_model_type = raw_model_type
                print(f"✅ Runtime model type set to: {self._runtime_model_type} (from enum)")
            else:
                # Convert string to enum
                model_type_str = str(raw_model_type).lower()
                print(f"🔍 [DEBUG] Converted modelType string: {model_type_str}")
                try:
                    self._runtime_model_type = ModelType(model_type_str)
                    print(f"✅ Runtime model type set to: {self._runtime_model_type}")
                except ValueError as e:
                    print(f"❌ ValueError: Could not convert '{model_type_str}' to ModelType: {e}")
                    self._runtime_model_type = ModelType.GEMINI
                    print(f"⚠️  Defaulting to GEMINI")
            
            print(f"✅ Active model: {model_dict.get('name')} | Runtime type: {self._runtime_model_type}")
        else:
            self._active_model = None
            self._active_model_params = None
            self._runtime_model_type = None
            print(f"⚠️  set_active_model_from_dict received None")
    
    def get_active_model(self) -> Dict[str, Any]:
        """
        Lấy thông tin về mô hình đang hoạt động từ cache hoặc environment.
        
        Returns:
            Dict[str, Any]: Thông tin của mô hình đang hoạt động.
        """
        # Return cached model if available (set by API layer)
        if self._active_model is not None:
            return self._active_model
        
        # No cache available, use environment defaults
        default = self._get_default_model()
        print(f"ℹ️ No cached active model, using environment defaults")
        return default
    
    def _get_default_model(self) -> Dict[str, Any]:
        """Get default model from environment variables"""
        model_type = os.environ.get("DEFAULT_MODEL_TYPE", ModelType.GEMINI).lower()
        
        # Map string to ModelType
        if model_type == "ollama":
            model_type_enum = ModelType.OLLAMA
        elif model_type == "gemini":
            model_type_enum = ModelType.GEMINI
        elif model_type == "huggingface":
            model_type_enum = ModelType.HUGGINGFACE
        else:
            model_type_enum = ModelType.GEMINI  # Default to Gemini
        
        default_model = {
            "id": "default",
            "name": os.environ.get("DEFAULT_MODEL_NAME", "Gemini"),
            "modelType": model_type_enum,
            "isActive": True,
            "parameters": {
                "temperature": float(os.environ.get("DEFAULT_TEMPERATURE", "0.7")),
                "top_p": float(os.environ.get("DEFAULT_TOP_P", "0.9")),
                "top_k": int(os.environ.get("DEFAULT_TOP_K", "40")),
                "max_tokens": int(os.environ.get("DEFAULT_MAX_TOKENS", "2048")),
                "presence_penalty": float(os.environ.get("DEFAULT_PRESENCE_PENALTY", "0")),
                "frequency_penalty": float(os.environ.get("DEFAULT_FREQUENCY_PENALTY", "0")),
            }
        }
        
        # Thêm thông tin đặc thù cho từng loại model
        if model_type_enum == ModelType.GEMINI:
            default_model["api_key"] = os.environ.get("GOOGLE_API_KEY", "")
            default_model["gemini_model"] = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        elif model_type_enum == ModelType.OLLAMA:
            default_model["ollama_model"] = os.environ.get("OLLAMA_MODEL", "llama3")
            default_model["ollama_url"] = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        elif model_type_enum == ModelType.HUGGINGFACE:
            default_model["hf_token"] = os.environ.get("HF_TOKEN", "")
        
        self._active_model = default_model
        self._active_model_params = default_model.get("parameters", {})
        
        print(f"ℹ️ Using default model from env: {default_model.get('name')} ({model_type})")
        return default_model
    
    def get_model_parameter(self, param_name: str, default_value: Any = None) -> Any:
        """
        Lấy giá trị của một tham số cụ thể từ mô hình đang hoạt động.
        
        Args:
            param_name (str): Tên tham số cần lấy.
            default_value (Any, optional): Giá trị mặc định nếu tham số không tồn tại.
            
        Returns:
            Any: Giá trị của tham số.
        """
        # Đảm bảo đã có active model parameters
        if self._active_model_params is None:
            self.get_active_model()
        
        # Lấy giá trị tham số
        return self._active_model_params.get(param_name, default_value)
    
    def get_all_models(self):
        """
        Không cần database - models được quản lý qua runtime và environment.
        """
        return []
    
    def activate_model(self, model_id: str) -> bool:
        """
        Kích hoạt một mô hình cụ thể.
        
        Args:
            model_id (str): ID của mô hình cần kích hoạt.
            
        Returns:
            bool: True nếu thành công, False nếu thất bại.
        """
        try:
            # Vô hiệu hóa tất cả các mô hình
            self.db.llm_models.update_many(
                {},
                {"$set": {"isActive": False}}
            )
            
            # Kích hoạt mô hình được chỉ định
            result = self.db.llm_models.update_one(
                {"_id": ObjectId(model_id)},
                {"$set": {"isActive": True}}
            )
            
            # Reset cache
            self._active_model = None
            self._active_model_params = None
            
            return result.modified_count > 0
        except Exception as e:
            print(f"Error activating model: {str(e)}")
            return False
    
    def update_model_params(self, model_id: str, params: Dict[str, Any]) -> bool:
        """
        Cập nhật tham số cho một mô hình cụ thể.
        
        Args:
            model_id (str): ID của mô hình cần cập nhật.
            params (Dict[str, Any]): Các tham số mới.
            
        Returns:
            bool: True nếu thành công, False nếu thất bại.
        """
        try:
            result = self.db.llm_models.update_one(
                {"_id": ObjectId(model_id)},
                {"$set": {"parameters": params}}
            )
            
            # Nếu model đang active, reset cache
            active_model = self.get_active_model()
            if active_model and active_model.get("id") == model_id:
                self._active_model = None
                self._active_model_params = None
            
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating model parameters: {str(e)}")
            return False
    
    def create_model(self, model_data: Dict[str, Any]) -> Optional[str]:
        """
        Tạo một mô hình mới.
        
        Args:
            model_data (Dict[str, Any]): Thông tin mô hình mới.
            
        Returns:
            Optional[str]: ID của mô hình mới nếu thành công, None nếu thất bại.
        """
        try:
            result = self.db.llm_models.insert_one(model_data)
            return str(result.inserted_id)
        except Exception as e:
            print(f"Error creating model: {str(e)}")
            return None
    
    def get_system_prompt(self) -> str:
        """
        Lấy system prompt từ mô hình đang hoạt động.
        
        Returns:
            str: System prompt.
        """
        return self.get_model_parameter("system_prompt", "Bạn là trợ lý AI của Học viện Kỹ thuật Mật mã.")
    
    def get_model_path(self) -> str:
        """
        Lấy đường dẫn đến mô hình đang hoạt động.
        
        Returns:
            str: Đường dẫn đến mô hình.
        """
        active_model = self.get_active_model()
        if active_model:
            return active_model.get("path", os.environ.get("DEFAULT_MODEL_PATH", "NousResearch/Hermes-2-Pro-Llama-3-8B"))
        return os.environ.get("DEFAULT_MODEL_PATH", "NousResearch/Hermes-2-Pro-Llama-3-8B")
    
    def get_gemini_info(self) -> Dict[str, Any]:
        """
        Lấy thông tin cấu hình cho Gemini từ active model hoặc environment.
        
        Returns:
            Dict[str, Any]: Thông tin cấu hình Gemini.
        """
        active_model = self.get_active_model()
        if active_model and active_model.get("modelType") == ModelType.GEMINI:
            return {
                "api_key": active_model.get("api_key", os.environ.get("GOOGLE_API_KEY", "")),
                "model": active_model.get("name") or active_model.get("gemini_model", os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"))
            }
        return {
            "api_key": os.environ.get("GOOGLE_API_KEY", ""),
            "model": os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        }
    
    def get_ollama_info(self) -> Dict[str, Any]:
        """
        Lấy thông tin cấu hình cho Ollama từ active model hoặc environment.
        
        Returns:
            Dict[str, Any]: Thông tin cấu hình Ollama.
        """
        active_model = self.get_active_model()
        if active_model and active_model.get("modelType") == ModelType.OLLAMA:
            return {
                "model": active_model.get("name") or active_model.get("ollama_model", os.environ.get("OLLAMA_MODEL", "llama3")),
                "url": active_model.get("ollama_url", os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))
            }
        return {
            "model": os.environ.get("OLLAMA_MODEL", "llama3"),
            "url": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        }
    
    def get_huggingface_info(self) -> Dict[str, Any]:
        """
        Lấy thông tin cấu hình cho Hugging Face.
        
        Returns:
            Dict[str, Any]: Thông tin cấu hình Hugging Face.
        """
        active_model = self.get_active_model()
        if active_model and active_model.get("modelType") == ModelType.HUGGINGFACE:
            return {
                "model": active_model.get("path", os.environ.get("DEFAULT_MODEL_PATH", "NousResearch/Hermes-2-Pro-Llama-3-8B")),
                "token": active_model.get("hf_token", os.environ.get("HF_TOKEN", ""))
            }
        return {
            "model": os.environ.get("DEFAULT_MODEL_PATH", "NousResearch/Hermes-2-Pro-Llama-3-8B"),
            "token": os.environ.get("HF_TOKEN", "")
        }
    
    def get_temperature(self) -> float:
        """
        Lấy giá trị temperature từ mô hình đang hoạt động.
        
        Returns:
            float: Giá trị temperature.
        """
        return self.get_model_parameter("temperature", 0.7)
    
    def get_max_tokens(self) -> int:
        """
        Lấy giá trị max_tokens từ mô hình đang hoạt động.
        
        Returns:
            int: Giá trị max_tokens.
        """
        return self.get_model_parameter("max_tokens", 2048)
    
    # ============ RUNTIME MODEL SWITCHING METHODS ============
    
    def set_active_model_type(self, model_type: ModelType) -> None:
        """
        Đặt loại model đang hoạt động (runtime override).
        
        Args:
            model_type: Loại model cần kích hoạt
        """
        self._runtime_model_type = model_type
        # Clear cache để force reload
        self._active_model = None
        self._active_model_params = None
        print(f"🔄 Runtime model type set to: {model_type}")
    
    def set_ollama_model(self, ollama_model: str) -> None:
        """
        Đặt model Ollama cụ thể (runtime override).
        
        Args:
            ollama_model: Tên model Ollama
        """
        self._runtime_ollama_model = ollama_model
        if self._runtime_model_type != ModelType.OLLAMA:
            self.set_active_model_type(ModelType.OLLAMA)
        print(f"🔄 Runtime Ollama model set to: {ollama_model}")
    
    def set_gemini_model(self, gemini_model: str) -> None:
        """
        Đặt model Gemini cụ thể (runtime override).
        
        Args:
            gemini_model: Tên model Gemini
        """
        self._runtime_gemini_model = gemini_model
        if self._runtime_model_type != ModelType.GEMINI:
            self.set_active_model_type(ModelType.GEMINI)
        print(f"🔄 Runtime Gemini model set to: {gemini_model}")
    
    def get_model_type(self) -> ModelType:
        """
        Lấy loại model đang hoạt động (có thể là runtime override).
        
        Returns:
            ModelType: Loại model đang hoạt động
        """
        print(f"🔍 [get_model_type] _runtime_model_type: {self._runtime_model_type}")
        
        # Ưu tiên runtime override (for single worker scenarios)
        if self._runtime_model_type:
            print(f"✅ [get_model_type] Returning runtime override: {self._runtime_model_type}")
            return self._runtime_model_type
        
        print(f"⚠️ [get_model_type] No runtime override, checking env var")
        
        # Fallback về environment variable
        if os.getenv("ACTIVE_MODEL_TYPE"):
            try:
                env_model = ModelType(os.getenv("ACTIVE_MODEL_TYPE").lower())
                print(f"✅ [get_model_type] Returning from env: {env_model}")
                return env_model
            except ValueError:
                pass
        
        print(f"⚠️ [get_model_type] No env var, checking cached active_model")
        
        # Fallback về cached active model
        active_model = self.get_active_model()
        if active_model:
            model_type_val = active_model.get("modelType", ModelType.GEMINI)
            print(f"🔍 [get_model_type] active_model modelType: {model_type_val}")
            # Handle both enum and string values
            if isinstance(model_type_val, ModelType):
                print(f"✅ [get_model_type] Returning from cache (enum): {model_type_val}")
                return model_type_val
            elif isinstance(model_type_val, str):
                try:
                    result = ModelType(model_type_val.lower())
                    print(f"✅ [get_model_type] Returning from cache (string): {result}")
                    return result
                except ValueError:
                    print(f"❌ [get_model_type] Could not convert: {model_type_val}")
                    return ModelType.GEMINI
        
        # Default to GEMINI
        print(f"❌ [get_model_type] Defaulting to GEMINI")
        return ModelType.GEMINI
    
    def get_ollama_info(self) -> Dict[str, Any]:
        """
        Lấy thông tin Ollama đang hoạt động (có thể là runtime override).
        
        Returns:
            Dict[str, Any]: Thông tin Ollama
        """
        # Ưu tiên runtime override
        if self._runtime_ollama_model:
            return {
                "model": self._runtime_ollama_model,
                "url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            }
        
        # Ưu tiên environment variable
        if os.getenv("ACTIVE_OLLAMA_MODEL"):
            return {
                "model": os.getenv("ACTIVE_OLLAMA_MODEL"),
                "url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            }
        
        # Fallback về RAG_MODEL từ env
        return {
            "model": os.getenv("RAG_MODEL", "qwen3:8b"),
            "url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        }
    
    def get_gemini_info(self) -> Dict[str, Any]:
        """
        Lấy thông tin Gemini đang hoạt động (có thể là runtime override).
        
        Returns:
            Dict[str, Any]: Thông tin Gemini
        """
        # Ưu tiên runtime override
        if self._runtime_gemini_model:
            return {
                "model": self._runtime_gemini_model,
                "api_key": os.getenv("GOOGLE_API_KEY", "")
            }
        
        # Ưu tiên environment variable
        if os.getenv("ACTIVE_GEMINI_MODEL"):
            return {
                "model": os.getenv("ACTIVE_GEMINI_MODEL"),
                "api_key": os.getenv("GOOGLE_API_KEY", "")
            }
        
        # Fallback về GEMINI_MODEL từ env
        return {
            "model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            "api_key": os.getenv("GOOGLE_API_KEY", "")
        }
    
    def clear_runtime_overrides(self) -> None:
        """
        Xóa tất cả runtime overrides và trở về cấu hình mặc định.
        """
        self._runtime_model_type = None
        self._runtime_ollama_model = None
        self._runtime_gemini_model = None
        self._active_model = None
        self._active_model_params = None
        print("🔄 Runtime overrides cleared")

# Singleton instance
model_manager = ModelManager()
