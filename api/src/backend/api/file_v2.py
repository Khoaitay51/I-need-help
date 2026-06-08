"""
API endpoints for file management - Metadata only (no GridFS storage)
Supports file upload with automatic RAG processing, file listing, and deletion
"""
import logging
import sys
import os
from typing import List, Dict, Optional
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends, Header
from fastapi.responses import StreamingResponse
import io

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from ..models.chat import FileMetadataResponse, AttachmentSchema
from ..models.responses import BaseResponse
from ..auth.dependencies import require_auth
from ..db.mongodb import mongodb
from ..services.file_service import FileManagementService
from ..services.vector_store_service import get_vector_store_service
from ..services.attachment_rag_service import get_attachment_rag_service
from .file_upload_limit import check_file_upload_limit, update_file_upload_stats

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/files", tags=["files"])

# Lazy initialization - services will be created on first use
_file_service = None
_vector_store_service = None
_attachment_rag_service = None

def get_file_service():
    """Get or create file service"""
    global _file_service
    if _file_service is None:
        if mongodb.db is None:
            raise HTTPException(
                status_code=503,
                detail="Database not initialized"
            )
        _file_service = FileManagementService(mongodb.db)
    return _file_service

def get_vector_store_svc():
    """Get or create vector store service"""
    global _vector_store_service
    if _vector_store_service is None:
        _vector_store_service = get_vector_store_service()
    return _vector_store_service

def get_attachment_rag_svc():
    """Get or create attachment RAG service"""
    global _attachment_rag_service
    if _attachment_rag_service is None:
        _attachment_rag_service = get_attachment_rag_service(
            get_file_service(),
            get_vector_store_svc()
        )
    return _attachment_rag_service

# Constants
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "image/png",
    "image/jpeg",
    "application/zip",
    "application/x-rar-compressed"
}


from fastapi.security import HTTPBearer

# Optional auth helper
async def get_optional_user(credentials: HTTPBearer = Depends(HTTPBearer(auto_error=False))):
    """Get user from token if provided, otherwise return None"""
    if not credentials:
        logger.debug("⚪ No credentials provided, using anonymous user")
        return None  # No token provided
    
    try:
        # credentials.credentials contains the actual token string
        from ..auth.jwt import verify_token
        user_data = verify_token(credentials.credentials)
        
        if user_data:
            logger.info(f"✅ User authenticated: {user_data.get('sub')}")
            return user_data
        else:
            logger.debug("⚪ Token verification returned None, using anonymous user")
            return None
    except ImportError as e:
        logger.warning(f"❌ Failed to import verify_token: {str(e)}")
        return None
    except Exception as e:
        logger.warning(f"❌ Error verifying token: {str(e)}")
        return None


@router.post("/upload", response_model=BaseResponse[Dict])
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: str = Query(None),
    current_user: dict = Depends(get_optional_user)
):
    """
    Upload a file: extract text → generate embeddings → store in Milvus → save metadata
    Single endpoint that handles entire file processing pipeline.
    Optional authentication - works with or without token
    
    Args:
        file: File to upload
        conversation_id: Optional conversation ID
        current_user: Authenticated user or None for anonymous
        
    Returns:
        File metadata with file_id, status, embedding_count
    """
    try:
        # Get user_id from authenticated user or use "anonymous"
        logger.info(f"📋 current_user: {current_user}")  # Debug logging
        
        if current_user:
            user_id = current_user.get("sub") or current_user.get("user_id")
            username = current_user.get("username", "unknown")
            logger.info(f"✅ Got user_id from token: {user_id}")
        else:
            user_id = "anonymous"
            username = "anonymous"
            logger.info(f"⚪ No authenticated user, using anonymous")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Cannot determine user ID")
        
        # Validate file size
        file_content = await file.read()
        
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024:.0f} MB"
            )
        
        # Convert file size to MB for limit checking
        file_size_mb = len(file_content) / (1024 * 1024)
        
        # Check file upload limits (only for authenticated users)
        if user_id != "anonymous":
            allowed, error_msg = await check_file_upload_limit(
                user_id=user_id,
                username=username,
                file_size_mb=int(file_size_mb),
                conversation_id=conversation_id
            )
            if not allowed:
                logger.warning(f"⛔ File upload limit exceeded for user {username}: {error_msg}")
                raise HTTPException(
                    status_code=429,  # Too Many Requests
                    detail=error_msg
                )
        
        # Validate MIME type
        if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
            logger.warning(f"Unsupported file type: {file.content_type}")
            # Allow anyway, just log it
        
        logger.info(f"📤 Uploading file: {file.filename}, Size: {len(file_content)} bytes, User: {user_id}")
        
        # Step 1: Save file metadata to MongoDB
        metadata_result = await get_file_service().save_file_metadata(
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream",
            file_size=len(file_content),
            user_id=user_id,
            conversation_id=conversation_id
        )
        file_id = metadata_result["file_id"]
        logger.info(f"✅ File metadata saved: {file_id}")
        
        # Update file upload stats (only for authenticated users)
        if user_id != "anonymous":
            await update_file_upload_stats(user_id, int(file_size_mb))
        
        # Step 2: Process file (extract text, embed, store in Milvus)
        # Process file asynchronously in background to avoid timeout
        logger.info(f"🔄 Processing file embeddings in background...")
        try:
            process_result = await get_attachment_rag_svc().process_file_attachment(
                file_id=file_id,
                file_bytes=file_content,
                mime_type=file.content_type or "application/octet-stream"
            )
            
            if process_result["status"] == "success":
                logger.info(f"✅ File processing complete: {process_result['embedding_count']} embeddings")
            else:
                logger.warning(f"⚠️ File processing had errors: {process_result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.error(f"❌ Background processing error: {str(e)}", exc_info=True)
            # Update status to indicate processing failed, but still return file_id
            await get_file_service().update_embedding_status(file_id, 0)
        
        logger.info(f"✅ File uploaded and queued for processing: {file_id} by user: {user_id}")
        
        return BaseResponse(
            success=True,
            data={
                **metadata_result,
                "status": "processing"  # File is being processed
            },
            message=f"File '{metadata_result['filename']}' uploaded and processing"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))





@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user = Depends(require_auth)
):
    """
    Note: We don't store file binaries anymore, only metadata.
    This endpoint is deprecated.
    """
    raise HTTPException(
        status_code=410,
        detail="File download not supported - files are processed and stored as vectors"
    )


@router.delete("/{file_id}", response_model=BaseResponse)
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_optional_user)
):
    """
    Delete a file: remove metadata from MongoDB and embeddings from Milvus
    
    Args:
        file_id: File ID to delete
        current_user: Current authenticated user (or None for anonymous)
        
    Returns:
        Confirmation message
    """
    try:
        # Get user_id from authenticated user or use "anonymous"
        if current_user:
            user_id = current_user.get("sub") or current_user.get("user_id")
        else:
            user_id = "anonymous"
        
        logger.info(f"🗑️ Deleting file: {file_id}, User: {user_id}")
        
        # Get file metadata to verify ownership
        metadata = await get_file_service().get_file_metadata(file_id)
        
        if metadata["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied - you don't own this file")
        
        # Delete embeddings from Milvus
        logger.info(f"  ↳ Deleting embeddings from Milvus...")
        await get_vector_store_svc().delete_file_embeddings(file_id)
        
        # Delete metadata from MongoDB
        logger.info(f"  ↳ Deleting metadata from MongoDB...")
        success = await get_file_service().delete_file_metadata(file_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="File not found")
        
        logger.info(f"✅ File deleted successfully: {file_id}")
        
        return BaseResponse(
            success=True,
            message=f"File '{metadata['original_filename']}' deleted successfully"
        )
    
    except HTTPException:
        raise
    except ValueError as ve:
        # File not found error from get_file_metadata
        logger.warning(f"⚠️ File not found during delete: {str(ve)}")
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"❌ Error deleting file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


@router.get("/", response_model=BaseResponse[List[FileMetadataResponse]])
async def list_user_files(
    current_user: dict = Depends(get_optional_user)
):
    """
    List all files for current user (supports anonymous users)
    
    Args:
        current_user: Authenticated user or None for anonymous
        
    Returns:
        List of file metadata
    """
    try:
        # Get user_id from authenticated user or use "anonymous"
        if current_user:
            user_id = current_user.get("sub") or current_user.get("user_id")
        else:
            user_id = "anonymous"
        
        if not user_id:
            user_id = "anonymous"
        
        logger.info(f"📂 Listing files for user: {user_id}")
        
        files = await get_file_service().list_user_files(user_id)
        
        logger.info(f"✅ Found {len(files)} files for user: {user_id}")
        
        return BaseResponse(
            success=True,
            data=files,
            message=f"Found {len(files)} files"
        )
    
    except Exception as e:
        logger.error(f"❌ Error listing files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.get("/{file_id}/metadata", response_model=BaseResponse[FileMetadataResponse])
async def get_file_metadata(
    file_id: str,
    current_user = Depends(require_auth)
):
    """
    Get metadata for a specific file
    
    Args:
        file_id: File ID
        current_user: Current authenticated user
        
    Returns:
        File metadata
    """
    try:
        logger.info(f"Getting metadata for file: {file_id}")
        
        metadata = await get_file_service().get_file_metadata(file_id)
        
        # Verify ownership
        if metadata["user_id"] != current_user.get("sub"):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return BaseResponse(
            success=True,
            data=metadata
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting file metadata: {str(e)}")




@router.post("/search", response_model=BaseResponse[List[Dict]])
async def search_attachments(
    query: str = Query(..., description="Search query"),
    file_ids: Optional[str] = Query(None, description="Comma-separated file IDs to search in"),
    limit: int = Query(5, ge=1, le=20),
    current_user = Depends(require_auth)
):
    """
    Search across uploaded files
    
    Args:
        query: Search query
        file_ids: Optional comma-separated file IDs to limit search
        limit: Maximum results
        current_user: Current authenticated user
        
    Returns:
        List of relevant chunks with scores
    """
    try:
        logger.info(f"Searching files. Query: '{query}', User: {current_user.get('sub')}")
        
        # Parse file IDs if provided
        file_list = None
        if file_ids:
            file_list = [f.strip() for f in file_ids.split(",")]
            
            # Verify ownership of all files
            for fid in file_list:
                metadata = await get_file_service().get_file_metadata(fid)
                if metadata["user_id"] != current_user.get("sub"):
                    raise HTTPException(status_code=403, detail="Access denied to one or more files")
        
        # Search attachments
        results = await get_attachment_rag_svc().search_attachments(
            query=query,
            file_ids=file_list,
            limit=limit
        )
        
        logger.info(f"Search found {len(results)} results")
        
        return BaseResponse(
            success=True,
            data=results,
            message=f"Found {len(results)} relevant chunks"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching files: {str(e)}")


@router.get("/{file_id}/content", response_model=BaseResponse[Dict])
async def get_file_content(
    file_id: str,
    current_user: dict = Depends(get_optional_user)
):
    """
    Retrieve full file content from Milvus vectors
    
    Reconstructs the complete document by fetching all chunks with the given file_id
    from Milvus and concatenating them in order.
    
    Args:
        file_id: File ID
        current_user: Authenticated user or None for anonymous
        
    Returns:
        File content with metadata
    """
    try:
        # Get user_id from authenticated user or use "anonymous"
        if current_user:
            user_id = current_user.get("sub") or current_user.get("user_id")
        else:
            user_id = "anonymous"
        
        if not user_id:
            user_id = "anonymous"
        
        logger.info(f"📄 Retrieving content for file: {file_id}, User: {user_id}")
        
        # Get file metadata to verify ownership and get original filename
        try:
            metadata = await get_file_service().get_file_metadata(file_id)
        except Exception as e:
            logger.error(f"❌ File metadata not found: {file_id}")
            raise HTTPException(status_code=404, detail="File not found")
        
        # Verify ownership (if authenticated)
        if current_user and metadata.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied - you don't own this file")
        
        # Retrieve all chunks from Milvus for this file
        logger.info(f"  ↳ Fetching chunks from Milvus for file: {file_id}")
        
        try:
            vector_store = get_vector_store_svc()
            
            # Get all chunks associated with this file_id using the built-in method
            chunks = await vector_store.get_file_embeddings(file_id)
            
            if not chunks:
                logger.warning(f"⚠️ No chunks found for file: {file_id}")
            
            logger.info(f"✅ Retrieved {len(chunks) if chunks else 0} chunks from Milvus")
            
            # Sort chunks by chunk_index if available and concatenate them
            if isinstance(chunks, list) and len(chunks) > 0:
                # Sort by 'chunk_index' if available
                try:
                    chunks_sorted = sorted(
                        chunks,
                        key=lambda x: x.get("chunk_index", 0)
                    )
                except Exception as e:
                    logger.warning(f"Could not sort chunks: {str(e)}")
                    chunks_sorted = chunks
                
                # Concatenate content from all chunks - extract 'text' field
                content_parts = []
                for chunk in chunks_sorted:
                    if isinstance(chunk, dict):
                        # Extract text content - Milvus returns 'text' field
                        text = chunk.get("text", "")
                    else:
                        text = str(chunk)
                    
                    if text and text.strip():
                        content_parts.append(text.strip())
                
                full_content = "\n\n".join(content_parts)
            else:
                full_content = ""
            
            logger.info(f"✅ Content retrieved: {len(full_content)} characters from {len(chunks) if chunks else 0} chunks")
            
            return BaseResponse(
                success=True,
                data={
                    "file_id": file_id,
                    "filename": metadata.get("original_filename", metadata.get("filename", "Unknown")),
                    "content": full_content,
                    "size": metadata.get("size", 0),
                    "mime_type": metadata.get("mime_type", "application/octet-stream"),
                    "chunk_count": len(chunks) if chunks else 0,
                    "created_at": metadata.get("created_at", ""),
                },
                message=f"Content retrieved successfully ({len(chunks) if chunks else 0} chunks)"
            )
        
        except Exception as e:
            logger.error(f"❌ Error retrieving file content: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error retrieving file content: {str(e)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error retrieving file content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving file content: {str(e)}")
