"""
Vector Store Service for similarity search using Milvus Cloud
"""
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime
import numpy as np
import uuid

try:
    from pymilvus import Collection, connections, MilvusException
    MILVUS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Manage vector embeddings and similarity search using Milvus only"""
    
    def __init__(self):
        self.milvus_collection = None
        self._init_milvus()
    
    def _get_schema_info(self):
        """Get detailed info about collection schema"""
        try:
            if not self.milvus_collection:
                return None
            
            schema_dict = {}
            for field in self.milvus_collection.schema.fields:
                schema_dict[field.name] = {
                    'dtype': str(field.dtype),
                    'is_primary': field.is_primary,
                    'auto_id': getattr(field, 'auto_id', False),
                }
            return schema_dict
        except Exception as e:
            logger.warning(f"Could not get schema info: {str(e)}")
            return None
    
    def _verify_collection_schema(self):
        """Verify collection schema is correct"""
        try:
            if not self.milvus_collection:
                logger.warning("Collection not initialized")
                return
            
            logger.info("🔍 Verifying collection schema...")
            
            # Get field info
            field_names = []
            vector_field_found = False
            vector_dim = None
            
            for field in self.milvus_collection.schema.fields:
                field_names.append(field.name)
                logger.info(f"   Field: {field.name}")
                logger.info(f"     - Type: {field.dtype}")
                logger.info(f"     - Primary: {field.is_primary}")
                
                if field.name == "vector":
                    vector_field_found = True
                    # Try to get dimension
                    if hasattr(field, 'params'):
                        for param in field.params:
                            if param.get('key') == 'dim':
                                vector_dim = param.get('value')
                                logger.info(f"     - Dimension: {vector_dim}")
            
            logger.info(f"   Fields present: {field_names}")
            
            if not vector_field_found:
                logger.error("⚠️  SCHEMA ISSUE: 'vector' field not found!")
            else:
                logger.info(f"✅ 'vector' field found (dim: {vector_dim})")
            
            if "primary_key" in field_names or "id" in field_names:
                logger.info("✅ Primary key field found")
            else:
                logger.info("⚠️  No explicit primary key found (may use system default)")
                
        except Exception as e:
            logger.warning(f"Could not verify schema: {str(e)}")
    
    def _init_milvus(self):
        """Initialize Milvus connection and collection"""
        try:
            logger.info("=" * 50)
            logger.info("🔗 Initializing Milvus Vector Store...")
            
            # Check for Milvus Cloud connection
            milvus_cloud_endpoint = os.getenv("MILVUS_CLOUD_ENDPOINT")
            milvus_cloud_token = os.getenv("MILVUS_CLOUD_TOKEN")
            
            if milvus_cloud_endpoint and milvus_cloud_token:
                # Use Milvus Cloud
                logger.info(f"📍 Milvus Mode: CLOUD")
                logger.info(f"   Endpoint: {milvus_cloud_endpoint}")
                token_preview = milvus_cloud_token[:20] + "..." if len(milvus_cloud_token) > 20 else milvus_cloud_token
                logger.info(f"   Token: {token_preview}")
                
                # Connect to Milvus Cloud with error handling
                try:
                    connections.connect(
                        alias="default",
                        uri=milvus_cloud_endpoint,
                        token=milvus_cloud_token,
                        pool_size=30
                    )
                    logger.info("✅ Successfully connected to Milvus Cloud")
                except Exception as conn_error:
                    logger.error(f"❌ Failed to connect to Milvus Cloud: {str(conn_error)}")
                    logger.error(f"   Please verify:")
                    logger.error(f"   1. MILVUS_CLOUD_ENDPOINT is correct")
                    logger.error(f"   2. MILVUS_CLOUD_TOKEN is valid")
                    logger.error(f"   3. Milvus Cloud cluster is running")
                    raise
            else:
                # Use Milvus Standalone (localhost)
                milvus_host = os.getenv("MILVUS_HOST", "localhost")
                milvus_port = int(os.getenv("MILVUS_PORT", "19530"))
                logger.info(f"📍 Milvus Mode: STANDALONE")
                logger.info(f"   Host: {milvus_host}")
                logger.info(f"   Port: {milvus_port}")
                
                connections.connect("default", host=milvus_host, port=milvus_port)
                logger.info(f"✅ Successfully connected to Milvus Standalone")
            
            # Get collection name from env or use default
            collection_name = os.getenv("MILVUS_COLLECTION_NAME", "file_embeddings")
            logger.info(f"📚 Collection Name: {collection_name}")
            
            # Get existing collection instead of creating new schema
            try:
                self.milvus_collection = Collection(collection_name)
                logger.info(f"✅ Using existing Milvus collection: {collection_name}")
                
                # Get collection stats and schema info
                collection_info = self.milvus_collection.num_entities
                schema_info = self._get_schema_info()
                logger.info(f"   Current entities in collection: {collection_info}")
                logger.info(f"   Schema info: {schema_info}")
                
            except MilvusException as e:
                logger.error(f"❌ Collection {collection_name} not found")
                logger.error(f"   Error: {str(e)}")
                logger.error(f"   Please create the collection in Milvus Cloud first with:")
                logger.error(f"   - Collection Name: {collection_name}")
                logger.error(f"   - Field 'primary_key' (INT64, Auto ID: YES, PK)")
                logger.error(f"   - Field 'vector' (FLOAT_VECTOR, Dimension: 384)")
                logger.error(f"   - Enable Dynamic Field: Yes")
                raise
            
            # Load collection data
            self.milvus_collection.load()
            collection_info = self.milvus_collection.num_entities
            logger.info(f"✅ Loaded collection: {collection_name}")
            logger.info(f"   Entities in collection: {collection_info}")
            
            # Verify schema
            self._verify_collection_schema()
            
            logger.info("=" * 50)
            logger.info("✅ Milvus Vector Store initialized successfully!")
            logger.info("=" * 50)
            
        except Exception as e:
            logger.error("=" * 50)
            logger.error(f"❌ Failed to initialize Milvus: {str(e)}")
            logger.error("=" * 50)
            raise
    
    def _create_milvus_index(self):
        """Create vector index in Milvus"""
        try:
            if self.milvus_collection is None:
                return
            
            index_params = {
                "metric_type": "COSINE",
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128}
            }
            self.milvus_collection.create_index("vector", index_params)
            logger.info("Created Milvus index")
        except MilvusException as e:
            if "already exist" in str(e):
                logger.info("Milvus index already exists")
            else:
                logger.warning(f"Index creation warning: {str(e)}")
    
    async def store_embedding(
        self,
        file_id: str,
        chunk_index: int,
        text: str,
        embedding: List[float],
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Store embedding in Milvus
        
        Args:
            file_id: File identifier
            chunk_index: Chunk number
            text: Original text
            embedding: Embedding vector (list of floats)
            metadata: Additional metadata (stored as dynamic fields)
            
        Returns:
            Embedding ID
        """
        try:
            # Ensure embedding is a flat list of floats
            if isinstance(embedding, np.ndarray):
                embedding = embedding.tolist()
            elif not isinstance(embedding, list):
                embedding = list(embedding)
            
            # Build row WITHOUT primary_key (assume Auto ID is enabled)
            # If Auto ID is enabled on primary_key field, we should NOT provide it
            row = {
                "file_id": file_id,
                "chunk_index": chunk_index,
                "text": text,
                "vector": embedding  # Must be a flat list of floats
            }
            
            try:
                insert_result = self.milvus_collection.insert([row])
                logger.info(f"✅ Stored embedding in Milvus for file {file_id}, chunk {chunk_index}")
                # Get the primary key that was auto-generated
                return str(insert_result.primary_keys[0])
                
            except MilvusException as e:
                error_msg = str(e)
                if "primary_key" in error_msg.lower() or "auto_id" in error_msg.lower():
                    logger.warning(f"Auto ID insert failed, trying with explicit primary_key: {error_msg}")
                    # Fallback: try with explicit primary_key
                    primary_key = int(uuid.uuid4().int % (2**63))
                    row_with_pk = {
                        "primary_key": primary_key,
                        **row
                    }
                    insert_result = self.milvus_collection.insert([row_with_pk])
                    logger.info(f"✅ Stored embedding with explicit primary_key: {primary_key}")
                    return str(primary_key)
                else:
                    raise
                
        except Exception as e:
            logger.error(f"❌ Error storing embedding: {str(e)}")
            raise
    
    async def store_embeddings_batch(
        self,
        file_id: str,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: Optional[Dict] = None
    ) -> List[str]:
        """
        Store multiple embeddings at once in Milvus
        
        Args:
            file_id: File identifier
            chunks: List of text chunks
            embeddings: List of corresponding embeddings
            metadata: Additional metadata
            
        Returns:
            List of embedding IDs
        """
        try:
            # Build rows WITHOUT primary_key (assume Auto ID is enabled)
            # Each embedding must be a list (not numpy array or nested structure)
            rows = []
            
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                # Ensure embedding is a flat list of floats
                if isinstance(embedding, np.ndarray):
                    embedding = embedding.tolist()
                elif not isinstance(embedding, list):
                    embedding = list(embedding)
                
                row = {
                    "file_id": file_id,
                    "chunk_index": i,
                    "text": chunk,
                    "vector": embedding  # Must be a list of floats, not nested
                }
                rows.append(row)
            
            try:
                # Try insert without primary_key (Auto ID enabled case)
                insert_result = self.milvus_collection.insert(rows)
                logger.info(f"✅ Stored {len(chunks)} embeddings in Milvus for file {file_id}")
                logger.info(f"   Inserted {len(insert_result.primary_keys)} entities")
                logger.info(f"   Primary keys: {insert_result.primary_keys[:3]}...")  # Show first 3
                
                # Force flush to ensure data is persisted
                try:
                    self.milvus_collection.flush()
                    logger.info(f"   🔄 Collection flushed")
                except:
                    pass  # Flush might not be available in all Milvus versions
                
                return [str(pk) for pk in insert_result.primary_keys]
                
            except MilvusException as e:
                error_msg = str(e)
                if "primary_key" in error_msg.lower() or "auto_id" in error_msg.lower():
                    logger.warning(f"Auto ID insert failed, trying with explicit primary_keys: {error_msg}")
                    # Fallback: add explicit primary_key values
                    rows_with_pk = []
                    primary_keys = []
                    for row in rows:
                        pk = int(uuid.uuid4().int % (2**63))
                        primary_keys.append(str(pk))
                        rows_with_pk.append({
                            "primary_key": pk,
                            **row
                        })
                    
                    insert_result = self.milvus_collection.insert(rows_with_pk)
                    logger.info(f"✅ Stored {len(chunks)} embeddings with explicit primary_keys in Milvus for file {file_id}")
                    
                    # Force flush to ensure data is persisted
                    try:
                        self.milvus_collection.flush()
                        logger.info(f"   🔄 Collection flushed after explicit PK insert")
                        logger.info(f"   Collection now has {self.milvus_collection.num_entities} total entities")
                    except Exception as flush_err:
                        logger.warning(f"   Flush warning: {str(flush_err)}")
                    
                    return primary_keys
                else:
                    raise
                
        except Exception as e:
            logger.error(f"❌ Error storing embeddings batch: {str(e)}")
            raise
    
    async def search_similar(
        self,
        query_embedding: List[float],
        file_id: Optional[str] = None,
        limit: int = 10,
        threshold: float = 0.0
    ) -> List[Dict]:
        """
        Search for similar embeddings in Milvus
        
        Args:
            query_embedding: Query embedding vector
            file_id: Optional file filter
            limit: Number of results
            threshold: Minimum similarity score (0.0-1.0 for COSINE)
            
        Returns:
            List of similar embeddings with scores
        """
        try:
            # Debug logging
            logger.info(f"🔍 Search similar: file_id={file_id}, limit={limit}, threshold={threshold}")
            logger.info(f"   Query embedding dim: {len(query_embedding) if isinstance(query_embedding, list) else 'unknown'}")
            
            # Ensure embedding is properly formatted
            if isinstance(query_embedding, np.ndarray):
                query_embedding = query_embedding.tolist()
            elif not isinstance(query_embedding, list):
                query_embedding = list(query_embedding)
            
            logger.info(f"   Collection entities: {self.milvus_collection.num_entities}")
            
            search_params = {"metric_type": "COSINE", "params": {"nprobe": 128}}
            
            # Build filter expression
            expr = f"file_id == '{file_id}'" if file_id else None
            logger.info(f"   Filter expr: {expr}")
            
            try:
                results = self.milvus_collection.search(
                    data=[query_embedding],  # Pass as list of vectors
                    anns_field="vector",
                    param=search_params,
                    limit=limit,
                    expr=expr,
                    output_fields=["file_id", "chunk_index", "text"]
                )
            except Exception as search_error:
                logger.error(f"❌ Search execution failed: {str(search_error)}")
                logger.error(f"   Query embedding type: {type(query_embedding)}")
                logger.error(f"   Query embedding length: {len(query_embedding) if isinstance(query_embedding, list) else 'unknown'}")
                raise
            
            # Format results
            formatted_results = []
            total_hits = 0
            
            for hits in results:
                logger.info(f"   Processing {len(hits)} hits from result")
                for hit in hits:
                    total_hits += 1
                    similarity = float(hit.distance)
                    logger.info(f"     Hit: id={hit.id}, similarity={similarity:.4f}, threshold={threshold}")
                    
                    if similarity >= threshold:
                        formatted_results.append({
                            "_id": str(hit.id),
                            "file_id": hit.entity.get("file_id"),
                            "chunk_index": hit.entity.get("chunk_index"),
                            "text": hit.entity.get("text"),
                            "similarity": similarity,
                            "created_at": datetime.utcnow()
                        })
            
            logger.info(f"✅ Found {len(formatted_results)} similar embeddings (threshold={threshold}) from {total_hits} total hits")
            return formatted_results
                
        except Exception as e:
            logger.error(f"❌ Error searching similar embeddings: {str(e)}")
            logger.error(f"   File ID: {file_id}")
            logger.error(f"   Query embedding length: {len(query_embedding) if isinstance(query_embedding, list) else type(query_embedding)}")
            raise
    
    async def get_embedding(self, embedding_id: str) -> Optional[Dict]:
        """Get a single embedding from Milvus by ID"""
        try:
            # Milvus requires querying with a filter expression
            expr = f"id == {embedding_id}"
            results = self.milvus_collection.query(expr=expr, output_fields=["file_id", "chunk_index", "text"])
            
            if results:
                return results[0]
            return None
            
        except Exception as e:
            logger.error(f"Error getting embedding: {str(e)}")
            return None
    
    async def get_file_embeddings(self, file_id: str) -> List[Dict]:
        """Get all embeddings for a file from Milvus"""
        try:
            expr = f"file_id == '{file_id}'"
            results = self.milvus_collection.query(expr=expr, output_fields=["file_id", "chunk_index", "text"])
            return results if results else []
            
        except Exception as e:
            logger.error(f"Error getting file embeddings: {str(e)}")
            raise
    
    async def count_embeddings(self, file_id: Optional[str] = None) -> int:
        """Count embeddings in Milvus"""
        try:
            expr = f"file_id == '{file_id}'" if file_id else None
            results = self.milvus_collection.query(expr=expr, output_fields=["file_id"]) if expr else []
            return len(results) if results else 0
            
        except Exception as e:
            logger.error(f"Error counting embeddings: {str(e)}")
            return 0
    
    async def delete_file_embeddings(self, file_id: str) -> bool:
        """Delete all embeddings for a file from Milvus"""
        try:
            expr = f"file_id == '{file_id}'"
            delete_result = self.milvus_collection.delete(expr=expr)
            logger.info(f"✅ Deleted embeddings for file {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting file embeddings: {str(e)}")
            return False

# Global instance
_vector_store_service = None


def get_vector_store_service() -> VectorStoreService:
    """Get or create global vector store service instance (Milvus only)"""
    global _vector_store_service
    
    if _vector_store_service is None:
        _vector_store_service = VectorStoreService()
    
    return _vector_store_service
