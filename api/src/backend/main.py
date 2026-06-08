import logging
import os
from pathlib import Path

import typer
import uvicorn
from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
from .db.mongodb import MongoDB, mongodb, get_db
# from db.mongodb import MongoDB, mongodb
from .models.responses import BaseResponse
from .api import router as api_router
# from models.responses import BaseResponse
# from api.chat import router as chat_router
# from api.user import router as user_router

# Load .env from root directory
root_env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(root_env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="AI Chat API",
        version="1.0.0", 
        description="API for managing AI chat conversations",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "HTTPBearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter JWT token"
        }
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Create FastAPI backend
app = FastAPI(
    title="AI Chat API",
    description="API for managing AI chat conversations",
    version="1.0.0",
)

# Set custom OpenAPI
app.openapi = custom_openapi

# Configure CORS - PHẢI ĐẶT TRƯỚC KHI INCLUDE ROUTERS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api", tags=["api"])

# Custom exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=BaseResponse(
            statusCode=exc.status_code,
            message=exc.detail,
            data=None
        ).model_dump(),
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=BaseResponse(
            statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Internal server error",
            data=None
        ).model_dump(),
    )
@app.on_event("startup")
async def startup_db_client():
    try:
        # Sử dụng hàm helper get_db để khởi tạo kết nối
        db = await get_db()
        collections = await db.list_collection_names()
        logger.info(f"✅ Connected to MongoDB. Collections: {collections}")
    except Exception as e:
        logger.exception(f"❌ MongoDB connection failed: {str(e)}")
        raise Exception("Failed to connect to MongoDB. Application cannot start.")
    
    # Initialize model_manager with active model from DB
    try:
        logger.info("🤖 Loading active LLM model...")
        from llm.model_manager import model_manager
        
        # Get active model from MongoDB
        active_model = await db.llm_models.find_one({"isActive": True})
        if active_model:
            model_manager.set_active_model_from_dict(active_model)
            logger.info(f"✅ Active LLM model loaded: {active_model.get('name')} ({active_model.get('modelType')})")
        else:
            logger.warning("⚠️  No active model found in database, will use environment defaults")
    except Exception as e:
        logger.warning(f"⚠️  Could not initialize model_manager: {e}")
    
    # Test Milvus Cloud connection - EAGER INIT
    try:
        logger.info("🔗 Testing Milvus Cloud connection...")
        import os
        from .services.vector_store_service import VectorStoreService
        
        milvus_endpoint = os.getenv("MILVUS_CLOUD_ENDPOINT")
        milvus_collection = os.getenv("MILVUS_COLLECTION_NAME")
        
        if milvus_endpoint:
            logger.info(f"   📍 Endpoint: {milvus_endpoint}")
            logger.info(f"   📚 Collection: {milvus_collection}")
            
            # Initialize connection immediately (eager init)
            logger.info("   🔐 Establishing connection...")
            vector_store = VectorStoreService()
            logger.info("✅ Milvus Cloud connection established successfully!")
            logger.info(f"   Ready for file embeddings")
        else:
            logger.warning("⚠️  MILVUS_CLOUD_ENDPOINT not set. Vector search unavailable")
            
    except Exception as e:
        logger.error(f"❌ Milvus Cloud connection error: {str(e)}")
        logger.error(f"   Application cannot proceed without Milvus. Please fix the configuration.")
    
    # Warm up GraphRAG cache on startup for instant first query
    try:
        logger.info("🔥 Warming up GraphRAG cache...")
        from ..rag import get_retriever
        retriever = get_retriever()
        logger.info(f"✅ GraphRAG cache ready (retriever type: {type(retriever).__name__})")
    except Exception as e:
        logger.warning(f"⚠️  Failed to warm up GraphRAG cache: {e}")
    
    logger.info("=" * 50)
    logger.info("✅ Backend startup complete")
    logger.info("=" * 50)



@app.on_event("shutdown")
async def shutdown_db_client():
    from .db.mongodb import MongoDB
    await MongoDB.close_mongodb_connection()

@app.get("/", response_model=BaseResponse)
async def root():
    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="AI Chat API is running",
        data=None
    )

@app.get("/health", response_model=BaseResponse)
async def health_check():
    """Health check endpoint for monitoring backend status"""
    try:
        # Sử dụng hàm helper get_db để kiểm tra kết nối
        db = await get_db()
        collections = await db.list_collection_names()
        
        db_status = {
            "connected": True,
            "collections": collections
        }
        
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Service is healthy",
            data=db_status
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        return BaseResponse(
            statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Service has issues: {str(e)}",
            data=None
        )
    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Backend is healthy",
        data={
            "status": "online",
            "timestamp": "2025-08-03",
            "version": "1.0.0"
        }
    )

@app.get("/health/milvus", response_model=BaseResponse)
async def milvus_health_check():
    """Health check endpoint specifically for Milvus Vector Store"""
    try:
        import os
        from pymilvus import connections
        
        milvus_endpoint = os.getenv("MILVUS_CLOUD_ENDPOINT")
        milvus_collection = os.getenv("MILVUS_COLLECTION_NAME", "user_document_embeddings")
        
        milvus_status = {
            "endpoint": milvus_endpoint or "localhost:19530 (Standalone)",
            "collection": milvus_collection,
            "connected": False,
            "entities_count": 0
        }
        
        # Check connection
        if "default" in connections.list_connections():
            milvus_status["connected"] = True
            logger.info("✅ Milvus connection is active")
            
            # Try to get collection info
            try:
                from pymilvus import Collection
                collection = Collection(milvus_collection)
                milvus_status["entities_count"] = collection.num_entities
                logger.info(f"✅ Milvus collection '{milvus_collection}' has {collection.num_entities} entities")
            except Exception as e:
                logger.warning(f"⚠️  Could not get collection info: {str(e)}")
                
        else:
            logger.warning("⚠️  Milvus connection not established yet")
            
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Milvus health check" if milvus_status["connected"] else "Milvus not connected",
            data=milvus_status
        )
    except Exception as e:
        logger.error(f"❌ Milvus health check failed: {str(e)}", exc_info=True)
        return BaseResponse(
            statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Milvus check failed: {str(e)}",
            data=None
        )

@app.get("/test-cors")
async def test_cors():
    """Test CORS configuration"""
    return {"message": "CORS is working!", "status": "success"}

def run_backend(port: int = 8000, host: str = "0.0.0.0", reload: bool = True):
    """
    Run the FastAPI backend with the specified configuration.
    
    Args:
        port: The port to run the server on
        host: The host address to bind to
        reload: Whether to reload the server on code changes
    """
    logger.info(f"Starting KMA Chat Agent backend on {host}:{port}")
    uvicorn.run("src.backend.main:app", host=host, port=port, reload=reload)

# Command line interface using Typer
cli = typer.Typer()

@app.get("/db-check", response_model=BaseResponse)
async def db_check():
    try:
        if mongodb.db is None:
            return BaseResponse(
                statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="MongoDB connection not established",
                data=None
            )

        # Lấy danh sách collections
        collections = await mongodb.db.list_collection_names()

        # Kiểm tra collection users
        if "users" not in collections:
            return BaseResponse(
                statusCode=status.HTTP_404_NOT_FOUND,
                message="Collection 'users' not found",
                data={"collections": collections}
            )

        # Đếm số lượng user
        user_count = await mongodb.db["users"].count_documents({})

        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="MongoDB connection OK",
            data={
                "collections": collections,
                "user_count": user_count
            }
        )
    except Exception as e:
        return BaseResponse(
            statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"MongoDB check failed: {str(e)}",
            data=None
        )

    except Exception as e:
        return BaseResponse(
            statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"MongoDB check failed: {str(e)}",
            data=None
        )

@cli.command()
def start(port: int = 8000, host: str = "0.0.0.0", reload: bool = True):
    """Run the KMA Chat Agent backend
    
    Note: Use reload=False in production for better performance with cached GraphRAG
    """
    port = os.environ.get("PORT")
    if port is None:
        port = 3434
    else:
        port = int(port)
    
    # Check if PRODUCTION env variable is set
    is_production = os.environ.get("PRODUCTION", "false").lower() == "true"
    if is_production:
        reload = False
        logger.info("🏭 Production mode: reload disabled for cache persistence")

    run_backend(port=port, host=host, reload=reload)

if __name__ == "__main__":
    cli() 