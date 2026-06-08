"""
RAG (Retrieval-Augmented Generation) Service for file attachments
Integrates file embeddings with the chat system
"""
import logging
import re
from typing import List, Optional, Dict
import io
import tempfile
import os
from dotenv import load_dotenv

from langchain_ollama import OllamaEmbeddings
from rag.retriever import extract_text_from_file
from rag.table_aware_chunking import enhanced_text_chunking

load_dotenv()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

logger = logging.getLogger(__name__)


class AttachmentRAGService:
    """Handle RAG operations for document attachments"""
    
    def __init__(self, file_service, vector_store_service, db=None):
        self.file_service = file_service
        self.vector_store_service = vector_store_service
        self.db = db
        # Initialize OllamaEmbeddings with fixed 384-dim model for Milvus schema
        self.embeddings = OllamaEmbeddings(
            model="nomic-embed-text:latest",
            base_url=OLLAMA_BASE_URL
        )
        logger.info("✅ AttachmentRAGService initialized with embedding model: nomic-embed-text:latest")
    
    async def process_file_attachment(
        self,
        file_id: str,
        file_bytes: bytes,
        mime_type: str,
        chunk_size: int = 800
    ) -> Dict:
        """
        Process file attachment: extract text, generate embeddings, store
        
        Args:
            file_id: File identifier
            file_bytes: File content as bytes
            mime_type: MIME type
            chunk_size: Characters per chunk
            
        Returns:
            Process result with chunk count and embedding count
        """
        try:
            logger.info(f"🚀 Starting file processing for {file_id}")
            
            # Extract text from file - this will raise an exception if extraction fails
            logger.info(f"Step 1/4: Extracting text from file {file_id}")
            try:
                text = await self._extract_file_text(file_bytes, mime_type)
            except ValueError as ve:
                logger.error(f"❌ Extraction failed: {str(ve)}")
                return {
                    "file_id": file_id,
                    "chunk_count": 0,
                    "embedding_count": 0,
                    "status": "failed",
                    "error": f"Text extraction failed: {str(ve)}"
                }
            
            if not text or not text.strip():
                logger.warning(f"❌ No text extracted from file {file_id}")
                return {
                    "file_id": file_id,
                    "chunk_count": 0,
                    "embedding_count": 0,
                    "status": "failed",
                    "error": "No text extracted from file"
                }
            
            logger.info(f"✅ Step 1 complete: {len(text)} characters extracted")
            
            # Split into chunks using smart chunking strategy
            logger.info(f"Step 2/4: Smart chunking text (size={chunk_size})")
            chunks = self._smart_chunk_text(text, mime_type, chunk_size)
            logger.info(f"✅ Step 2 complete: {len(chunks)} chunks created")
            
            if not chunks:
                logger.error(f"❌ No chunks created from text")
                return {
                    "file_id": file_id,
                    "chunk_count": 0,
                    "embedding_count": 0,
                    "status": "failed",
                    "error": "Failed to chunk text"
                }
            
            # Generate embeddings
            logger.info(f"Step 3/4: Generating embeddings for {len(chunks)} chunks")
            try:
                # Use OllamaEmbeddings directly (synchronous call)
                embeddings = self.embeddings.embed_documents(chunks)
                logger.info(f"✅ Step 3 complete: {len(embeddings)} embeddings generated")
            except Exception as e:
                logger.error(f"❌ Embedding generation failed: {str(e)}")
                return {
                    "file_id": file_id,
                    "chunk_count": len(chunks),
                    "embedding_count": 0,
                    "status": "failed",
                    "error": f"Failed to generate embeddings: {str(e)}"
                }
            
            if not embeddings or len(embeddings) != len(chunks):
                logger.error(f"❌ Embedding generation failed: expected {len(chunks)}, got {len(embeddings)}")
                return {
                    "file_id": file_id,
                    "chunk_count": len(chunks),
                    "embedding_count": 0,
                    "status": "failed",
                    "error": "Failed to generate embeddings"
                }
            
            # Store embeddings in Milvus
            logger.info(f"Step 4/4: Storing embeddings in Milvus for file {file_id}")
            embedding_ids = await self.vector_store_service.store_embeddings_batch(
                file_id=file_id,
                chunks=chunks,
                embeddings=embeddings
            )
            logger.info(f"✅ Step 4 complete: {len(embedding_ids)} embeddings stored in Milvus")
            
            # Update file metadata
            await self.file_service.update_embedding_status(
                file_id=file_id,
                embedding_count=len(embedding_ids)
            )
            
            logger.info(f"✅✅✅ File processing COMPLETE: {file_id} - {len(chunks)} chunks, {len(embeddings)} embeddings")
            
            return {
                "file_id": file_id,
                "chunk_count": len(chunks),
                "embedding_count": len(embeddings),
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"❌ Unexpected error processing file attachment: {str(e)}", exc_info=True)
            return {
                "file_id": file_id,
                "chunk_count": 0,
                "embedding_count": 0,
                "status": "failed",
                "error": str(e)
            }
    
    async def _extract_file_text(self, file_bytes: bytes, mime_type: str) -> str:
        """
        Extract text from various file types
        
        Args:
            file_bytes: File content
            mime_type: MIME type
            
        Returns:
            Extracted text
            
        Raises:
            ValueError: If extraction fails
        """
        temp_file_path = None
        try:
            # Get file extension from MIME type
            ext_map = {
                "text/plain": ".txt",
                "application/pdf": ".pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
                "application/msword": ".doc"  # Support legacy .doc files
            }
            ext = ext_map.get(mime_type, "")
            
            # Write bytes to temporary file
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
                tf.write(file_bytes)
                temp_file_path = tf.name
            
            logger.info(f"📝 Extracting text from {mime_type} (temp file: {temp_file_path})")
            
            # extract_text_from_file now raises exceptions instead of returning error strings
            text = extract_text_from_file(temp_file_path, mime_type)
            
            # Validate that we got actual content (not an error string)
            if not text or not text.strip():
                logger.error(f"❌ No text extracted from file (empty result)")
                raise ValueError("No text extracted from file - content is empty")
            
            logger.info(f"✅ Successfully extracted {len(text)} characters from file")
            return text
            
        except ValueError as ve:
            # These are expected extraction failures - log and re-raise
            logger.error(f"❌ Text extraction failed: {str(ve)}")
            raise
        except Exception as e:
            # Unexpected errors
            logger.error(f"❌ Unexpected error extracting text from {mime_type}: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to extract text: {str(e)}")
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    logger.debug(f"Cleaned up temp file: {temp_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file {temp_file_path}: {str(e)}")
    
    def _smart_chunk_text(self, text: str, mime_type: str, chunk_size: int = 800) -> List[str]:
        """
        Use enhanced_text_chunking from table_aware_chunking.py
        Already handles:
        - Table preservation
        - Vietnamese legal structure
        - Large file splitting
        - Overlapping chunks
        
        Args:
            text: Full text content
            mime_type: File MIME type (for context)
            chunk_size: Target chunk size
            
        Returns:
            List of text chunks
        """
        chunk_settings = {
            'chunk_size': chunk_size,
            'chunk_overlap': 200,
            'max_chunk_size': chunk_size * 2,
            'min_chunk_size': chunk_size // 2,
            'overlap_size': 200
        }
        
        logger.info(f"🔄 Smart chunking with enhanced_text_chunking (size={chunk_size})")
        try:
            chunks = enhanced_text_chunking(text, chunk_settings)
            
            if chunks:
                avg_size = sum(len(c) for c in chunks) // len(chunks)
                total_chars = sum(len(c) for c in chunks)
                logger.info(f"✅ Chunking success: {len(chunks)} chunks, avg {avg_size} chars, total {total_chars}")
                
                # Check for metrics keywords
                metrics_keywords = ['độ đo', 'metrics', 'cosine', 'precision', 'recall', 'map', 'ndcg', 'mRR', '评估']
                chunks_with_metrics = sum(1 for c in chunks if any(kw.lower() in c.lower() for kw in metrics_keywords))
                logger.info(f"   📊 Chunks with metrics keywords: {chunks_with_metrics}/{len(chunks)}")
            else:
                logger.warning(f"⚠️  No chunks created by enhanced_text_chunking")
            
            return chunks
            
        except Exception as e:
            logger.error(f"❌ enhanced_text_chunking failed: {str(e)}", exc_info=True)
            logger.warning(f"   Falling back to fallback_chunk_text")
            return self._fallback_chunk_text(text, chunk_size)
    
    def _fallback_chunk_text(self, text: str, chunk_size: int = 800) -> List[str]:
        """
        Fallback chunking if enhanced chunking fails
        Simple overlapping chunks
        
        Args:
            text: Full text
            chunk_size: Characters per chunk
            
        Returns:
            List of text chunks
        """
        chunks = []
        text = text.strip()
        
        if len(text) <= chunk_size:
            return [text] if text else []
        
        # Create overlapping chunks
        overlap = 200
        step = chunk_size - overlap
        for i in range(0, len(text), step):
            chunk = text[i:i + chunk_size]
            if chunk.strip():
                chunks.append(chunk)
        
        logger.info(f"   ℹ️  Fallback chunking created {len(chunks)} chunks")
        return chunks
    
    async def search_attachments(
        self,
        query: str,
        file_ids: Optional[List[str]] = None,
        limit: int = 5,
        per_file_limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Search for relevant content in attachments
        
        Args:
            query: Search query
            file_ids: List of file IDs to search in (if None, search all)
            limit: Max results
            
        Returns:
            List of relevant chunks with scores
        """
        try:
            # Generate query embedding using OllamaEmbeddings (synchronous call)
            query_embedding = self.embeddings.embed_query(query)
            logger.info(f"Generated query embedding with dim: {len(query_embedding) if isinstance(query_embedding, list) else 'unknown'}")
            
            # Search in each file
            all_results = []
            
            if file_ids:
                effective_per_file_limit = per_file_limit or limit
                for file_id in file_ids:
                    logger.info(f"Searching file: {file_id}")
                    results = await self.vector_store_service.search_similar(
                        query_embedding=query_embedding,
                        file_id=file_id,
                        limit=effective_per_file_limit,
                        threshold=0.0  # Allow all results, then filter
                    )
                    logger.info(f"  Found {len(results)} results from file {file_id}")
                    all_results.extend(results)
            else:
                # Search across all files
                logger.info("Searching across all files")
                results = await self.vector_store_service.search_similar(
                    query_embedding=query_embedding,
                    limit=limit * 3,  # Get more to have variety
                    threshold=0.0  # Allow all results, then filter
                )
                logger.info(f"  Found {len(results)} total results")
                all_results.extend(results)
            
            # Sort by similarity and limit
            all_results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
            if not file_ids:
                all_results = all_results[:limit]
            
            logger.info(f"🔎 Search found {len(all_results)} relevant chunks after filtering")
            
            return all_results
            
        except Exception as e:
            logger.error(f"Error searching attachments: {str(e)}")
            return []
    
    async def build_context_from_attachments(
        self,
        query: str,
        file_ids: Optional[List[str]] = None,
        max_context_length: int = 12000
    ) -> str:
        """
        Build context string from relevant attachment chunks for RAG
        
        Args:
            query: User query
            file_ids: Attachment file IDs
            max_context_length: Max length of context
            
        Returns:
            Context string formatted for LLM
        """
        try:
            # Search attachments. For multi-file analysis, keep a per-file quota
            # so one document cannot crowd out the other.
            results = await self.search_attachments(
                query,
                file_ids,
                limit=24,
                per_file_limit=18 if file_ids and len(file_ids) > 1 else 24
            )
            
            if not results:
                return ""

            results = await self._augment_results_for_document_analysis(query, results, file_ids)
            
            # Build context
            context_parts = []
            current_length = 0
            file_name_cache = {}
            
            for i, result in enumerate(results, 1):
                chunk = result.get("text", "")
                similarity = result.get("similarity", 0)
                file_id = result.get("file_id")

                if file_id and file_id not in file_name_cache:
                    try:
                        file_metadata = await self.file_service.get_file_metadata(file_id)
                        file_name_cache[file_id] = file_metadata.get(
                            "original_filename",
                            file_metadata.get("filename", file_id)
                        )
                    except Exception:
                        file_name_cache[file_id] = file_id or "Unknown"

                filename = file_name_cache.get(file_id, file_id or "Unknown")
                
                # Add source reference
                part = (
                    f"[Source {i}]\n"
                    f"File: {filename}\n"
                    f"File ID: {file_id or 'Unknown'}\n"
                    f"Chunk: {result.get('chunk_index', 0)}\n"
                    f"Relevance: {similarity:.2f}\n"
                    f"{chunk}\n"
                )
                
                if current_length + len(part) > max_context_length:
                    continue
                
                context_parts.append(part)
                current_length += len(part)
            
            context = "\n".join(context_parts)
            logger.info(f"Built context from {len(context_parts)} chunks, {len(context)} chars")
            
            return context
            
        except Exception as e:
            logger.error(f"Error building context: {str(e)}")
            return ""

    async def _augment_results_for_document_analysis(
        self,
        query: str,
        results: List[Dict],
        file_ids: Optional[List[str]]
    ) -> List[Dict]:
        """Add keyword-rich chunks for paper analysis questions."""
        if not file_ids:
            return results

        query_lower = (query or "").lower()
        analysis_terms = [
            "phân tích", "ưu", "nhược", "đóng góp", "kết quả", "bảng",
            "analysis", "advantage", "disadvantage", "limitation",
            "contribution", "result", "evaluation", "experiment", "table",
            "methodology", "proposed", "discussion", "conclusion",
        ]
        if not any(term in query_lower for term in analysis_terms):
            return results

        supplemental_terms = [
            "contribution", "đóng góp", "result", "results", "kết quả",
            "evaluation", "experiment", "performance", "table", "bảng",
            "methodology", "proposed", "architecture", "limitation",
            "advantage", "disadvantage", "discussion", "conclusion",
        ]

        seen = {(item.get("file_id"), item.get("chunk_index")) for item in results}
        supplemented = list(results)

        for file_id in file_ids:
            try:
                chunks = await self.vector_store_service.get_file_embeddings(file_id)
            except Exception as exc:
                logger.warning(f"Could not load all chunks for supplemental scan: {file_id} - {exc}")
                continue

            keyword_hits = []
            for chunk in chunks or []:
                text = chunk.get("text", "")
                score = sum(1 for term in supplemental_terms if term in text.lower())
                if score <= 0:
                    continue

                key = (chunk.get("file_id"), chunk.get("chunk_index"))
                if key in seen:
                    continue

                seen.add(key)
                chunk["similarity"] = 0.45 + min(score, 6) * 0.02
                keyword_hits.append(chunk)

            keyword_hits.sort(
                key=lambda item: (
                    float(item.get("similarity", 0)),
                    -int(item.get("chunk_index", 0) or 0)
                ),
                reverse=True
            )
            supplemented.extend(keyword_hits[:6])

        supplemented.sort(
            key=lambda item: (
                item.get("file_id", ""),
                -float(item.get("similarity", 0)),
                int(item.get("chunk_index", 0) or 0)
            )
        )
        logger.info(f"Augmented attachment context candidates: {len(results)} -> {len(supplemented)} chunks")
        return supplemented
    
    async def cleanup_file(self, file_id: str) -> bool:
        """Clean up file and its embeddings"""
        try:
            # Delete embeddings
            await self.vector_store_service.delete_file_embeddings(file_id)
            
            # Delete file
            await self.file_service.delete_file(file_id)
            
            logger.info(f"Cleaned up file {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error cleaning up file: {str(e)}")
            return False


# Global instance
_attachment_rag_service = None


def get_attachment_rag_service(
    file_service=None,
    vector_store_service=None
) -> AttachmentRAGService:
    """Get or create global attachment RAG service instance"""
    global _attachment_rag_service
    
    if _attachment_rag_service is None:
        if any(x is None for x in [file_service, vector_store_service]):
            # Lazy load if not provided
            from .file_service import FileManagementService
            from .vector_store_service import get_vector_store_service
            from ..db.mongodb import mongodb
            
            db = mongodb.db
            file_service = file_service or FileManagementService(db)
            vector_store_service = vector_store_service or get_vector_store_service()
        else:
            # Get db from file_service if available
            db = getattr(file_service, 'db', None)
            if db is None:
                from ..db.mongodb import mongodb
                db = mongodb.db
        
        _attachment_rag_service = AttachmentRAGService(
            file_service,
            vector_store_service,
            db=db
        )
    
    return _attachment_rag_service
