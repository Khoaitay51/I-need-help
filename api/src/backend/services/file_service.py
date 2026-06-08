"""
File Metadata Service - Simple metadata storage without file chunks
Handles file metadata management in MongoDB (no GridFS)
"""
import logging
import uuid
from datetime import datetime
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class FileManagementService:
    """Manage file metadata in MongoDB (no GridFS used)"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        logger.info("📝 Initializing FileManagementService - Metadata Only (No GridFS)")
        self.files_collection = db.files_metadata
    
    async def save_file_metadata(
        self,
        filename: str,
        mime_type: str,
        file_size: int,
        user_id: str,
        conversation_id: Optional[str] = None
    ) -> dict:
        """
        Save file metadata to MongoDB
        File binary is NOT stored - only metadata
        
        Args:
            filename: Original filename
            mime_type: MIME type (e.g., application/pdf)
            file_size: File size in bytes
            user_id: User ID
            conversation_id: Optional conversation ID
            
        Returns:
            dict with file_id, filename, size, etc.
        """
        try:
            file_id = str(uuid.uuid4())
            
            # Store only metadata in MongoDB
            metadata = {
                "file_id": file_id,
                "original_filename": filename,
                "size": file_size,
                "mime_type": mime_type,
                "user_id": user_id,
                "conversation_id": conversation_id,
                "created_at": datetime.utcnow(),
                "status": "processing",  # Will change to "ready" after embedding
                "embedding_count": 0,
                "last_indexed": None
            }
            
            await self.files_collection.insert_one(metadata)
            
            logger.info(f"✅ File metadata saved: {file_id}, size: {file_size} bytes")
            
            return {
                "file_id": file_id,
                "filename": filename,
                "size": file_size,
                "mime_type": mime_type,
                "created_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error saving file metadata: {str(e)}")
            raise
    
    async def get_file_metadata(self, file_id: str) -> dict:
        """Get file metadata"""
        try:
            metadata = await self.files_collection.find_one({"file_id": file_id})
            if not metadata:
                raise ValueError(f"File not found: {file_id}")
            
            # Remove MongoDB _id for API response
            metadata.pop("_id", None)
            if metadata.get("created_at"):
                metadata["created_at"] = metadata["created_at"].isoformat()
            if metadata.get("last_indexed"):
                metadata["last_indexed"] = metadata["last_indexed"].isoformat()
            
            return metadata
            
        except Exception as e:
            logger.error(f"❌ Error getting file metadata: {str(e)}")
            raise
    
    async def list_user_files(self, user_id: str) -> List[dict]:
        """List all files for a user"""
        try:
            cursor = self.files_collection.find({"user_id": user_id}).sort("created_at", -1)
            files = []
            
            async for file_doc in cursor:
                file_doc.pop("_id", None)
                file_doc["created_at"] = file_doc["created_at"].isoformat()
                if file_doc.get("last_indexed"):
                    file_doc["last_indexed"] = file_doc["last_indexed"].isoformat()
                # Add filename field if not present (for backwards compatibility)
                if "filename" not in file_doc and "original_filename" in file_doc:
                    file_doc["filename"] = file_doc["original_filename"]
                files.append(file_doc)
            
            return files
            
        except Exception as e:
            logger.error(f"Error listing user files: {str(e)}")
            raise
    
    async def list_conversation_files(self, conversation_id: str) -> List[dict]:
        """List all files in a conversation"""
        try:
            cursor = self.files_collection.find({
                "conversation_id": conversation_id
            }).sort("created_at", -1)
            files = []
            
            async for file_doc in cursor:
                file_doc.pop("_id", None)
                file_doc["created_at"] = file_doc["created_at"].isoformat()
                if file_doc.get("last_indexed"):
                    file_doc["last_indexed"] = file_doc["last_indexed"].isoformat()
                # Add filename field if not present (for backwards compatibility)
                if "filename" not in file_doc and "original_filename" in file_doc:
                    file_doc["filename"] = file_doc["original_filename"]
                files.append(file_doc)
            
            return files
            
        except Exception as e:
            logger.error(f"Error listing conversation files: {str(e)}")
            raise
    
    async def delete_file_metadata(self, file_id: str) -> bool:
        """Delete file metadata from MongoDB"""
        try:
            result = await self.files_collection.delete_one({"file_id": file_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"❌ Error deleting file metadata: {str(e)}")
            raise
    
    async def update_embedding_status(self, file_id: str, embedding_count: int) -> bool:
        """Update embedding status after indexing"""
        try:
            result = await self.files_collection.update_one(
                {"file_id": file_id},
                {
                    "$set": {
                        "status": "ready",
                        "embedding_count": embedding_count,
                        "last_indexed": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"❌ Error updating embedding status: {str(e)}")
            raise
