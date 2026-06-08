# KMA Agent - Technical Overview

Tài liệu này giải thích cách code hiện tại của KMA Agent hoạt động ở mức hệ thống, luồng xử lý, API và các module chính. Mục tiêu là giúp người mới đọc repo có thể hiểu từ ngoài vào trong trước khi bàn chuyện GA.

## 1. KMA Agent là gì?

KMA Agent là hệ thống chatbot cho Học viện Kỹ thuật Mật mã, gồm:

- Web app React trong `client/`.
- Mobile app Expo/React Native trong `mobile/`.
- Backend FastAPI trong `api/src/backend/`.
- Agent/RAG/GraphRAG trong `api/src/agent/`, `api/src/rag/`, `api/src/graph_rag/`.
- Truy vấn điểm/thông tin sinh viên từ PostgreSQL trong `api/src/score/`.
- MongoDB để lưu user, token context, hội thoại, message, cấu hình model, metadata file.
- Milvus để lưu vector embedding cho file upload cá nhân.
- Ollama/Gemini/HuggingFace làm LLM, chọn qua biến môi trường hoặc API admin model.

Tên repo và README hiện có chỗ ghi `LMA Agent`, nhưng code, UI và nội dung domain đang hướng tới KMA Agent.

## 2. Cấu trúc repo quan trọng

```text
kma_agent/
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/                         # Tài liệu nguồn RAG theo phòng ban/thư mục
│   ├── graphs/department_graphs/      # GraphRAG đã build sẵn theo phòng ban
│   └── src/
│       ├── backend/
│       │   ├── main.py                # FastAPI app, startup, health, include router
│       │   ├── api/                   # Toàn bộ router REST API
│       │   ├── auth/                  # JWT, auth dependencies
│       │   ├── db/                    # MongoDB connection
│       │   ├── models/                # Pydantic response/request models
│       │   └── services/              # File, Milvus vector, attachment RAG
│       ├── agent/
│       │   └── supervisor_agent.py    # LangGraph/ReAct supervisor
│       ├── rag/                       # RAG tool, retriever, chunking, query answer
│       ├── graph_rag/                 # Department graph manager/retriever/building
│       ├── llm/                       # Model manager/factory/config
│       └── score/                     # PostgreSQL student score/info tools
├── client/                            # Web app React
├── mobile/                            # Mobile app Expo
├── docker-compose.yml                 # Full stack local
├── docker-compose.dev.yml             # Dev override
├── .env.example
├── start.bat / start.sh
└── Makefile
```

Ngoài ra repo có `libre/`, đây là codebase frontend riêng/tham khảo, không phải client chính được compose chạy.

## 3. Kiến trúc chạy local bằng Docker

`docker-compose.yml` định nghĩa các service:

- `postgres`: dữ liệu điểm sinh viên.
- `mongodb`: user, conversation, message, metadata, config.
- `etcd` + `minio` + `milvus`: stack Milvus standalone cho vector store.
- `ollama`: LLM/embedding local.
- `api`: FastAPI, expose `http://localhost:8000`.
- `client`: React web, expose `http://localhost:3000`.

Luồng mạng chính:

```text
Browser/Mobile
    ↓ HTTP/JWT
FastAPI /api/*
    ├── MongoDB: users, conversations, messages, files metadata, model config
    ├── PostgreSQL: students, subjects, scores
    ├── Milvus: uploaded-file embeddings
    ├── GraphRAG files: api/graphs/department_graphs
    └── LLM: Ollama/Gemini/HuggingFace
```

## 4. Backend startup

Entrypoint backend là `api/src/backend/main.py`.

Khi app khởi động:

1. Load `.env` ở root repo.
2. Tạo FastAPI app.
3. Bật CORS `allow_origins=["*"]`.
4. Include toàn bộ router dưới prefix `/api`.
5. Kết nối MongoDB qua `get_db()`.
6. Load active LLM model từ MongoDB collection `llm_models` nếu có.
7. Khởi tạo/test Milvus nếu có cấu hình.
8. Warm up GraphRAG cache bằng `get_retriever()` từ `api/src/rag`.
9. Expose health endpoints:
   - `GET /`
   - `GET /health`
   - `GET /health/milvus`
   - `GET /db-check`
   - `GET /test-cors`

Router tổng nằm ở `api/src/backend/api/__init__.py`:

```text
/api/chat           -> chat.py + file.py legacy
/api/files          -> file_v2.py
/api/users          -> user.py
/api/auth           -> auth.py
/api/models         -> models.py
/api/admin/rag      -> admin_rag.py
/api/admin/models   -> admin_model.py
/api/rate-limits    -> rate_limit.py
/api/file-upload-limits -> file_upload_limit.py
/api/admin/stats, /api/admin/conversations -> dashboard_stats.py
```

## 5. Authentication và user

### Đăng ký

Endpoint:

```text
POST /api/users/
```

Code: `api/src/backend/api/user.py`.

Payload chính:

```json
{
  "username": "student1",
  "password": "secret",
  "email": "student1@example.com",
  "student_code": "ATxxxxxx",
  "student_name": "Nguyen Van A",
  "student_class": "ATxx",
  "role": "user"
}
```

Backend:

1. Check duplicate username/email/student_code.
2. Hash password bằng SHA-256 + salt.
3. Lưu user vào MongoDB collection `users`.
4. Trả user public data, không trả password hash.

### Đăng nhập

Endpoint:

```text
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded
```

Body:

```text
username=...
password=...
```

Backend:

1. Tìm user theo username trong MongoDB.
2. Check `is_active`.
3. Verify password.
4. Tạo access token và refresh token.
5. Cập nhật `last_login`.

Web client gọi login trong `client/src/services/authService.js`.
Mobile gọi login trong `mobile/src/api.js`.

### Token refresh và current user

```text
POST /api/auth/refresh
GET  /api/auth/me
```

Web có `client/src/utils/httpClient.js` tự gắn `Authorization: Bearer <token>`, tự refresh nếu access token hết hạn.

## 6. Chat API chính

Các model request/response nằm trong `api/src/backend/models/chat.py`.

### Conversation

```text
GET    /api/chat/conversations
POST   /api/chat/conversations
PUT    /api/chat/conversations/{conversation_id}
DELETE /api/chat/conversations/{conversation_id}
GET    /api/chat/messages/{conversation_id}
```

MongoDB collections chính:

- `conversations`
- `messages`
- `conversation_stats`

### Gửi message thường

```text
POST /api/chat/{conversation_id}/messages
```

Payload:

```json
{
  "content": "Điều kiện tốt nghiệp là gì?",
  "is_user": true,
  "department": "phongdaotao",
  "attachments": ["file_id_1"],
  "chat_mode": "document"
}
```

`chat_mode` hiện hỗ trợ:

- `document`: ép đi qua RAG tài liệu/quy định.
- `student`: ép xử lý điểm/thông tin sinh viên.
- `auto`: tự phát hiện câu hỏi sinh viên nếu có ngữ cảnh phù hợp, còn lại đi tài liệu.

Luồng trong `query_ai()`:

1. Validate `conversation_id`.
2. Lấy current user từ JWT.
3. Check rate limit trước khi xử lý.
4. Nếu có `chat_mode=student`, inject student code từ profile user.
5. Nếu `chat_mode=auto`, kiểm tra câu hỏi có đụng dữ liệu cá nhân không.
6. Nếu có attachment, lấy context từ Milvus qua `AttachmentRAGService`.
7. Lưu user message vào MongoDB.
8. Load toàn bộ history của conversation.
9. Convert history thành LangChain `HumanMessage`/`AIMessage`.
10. Gọi `agent.chat_with_memory(...)`.
11. Lưu assistant response vào MongoDB.
12. Cập nhật rate limit token/request.
13. Ghi `conversation_stats`.
14. Trả `MessageResponse`.

### Streaming SSE

```text
POST /api/chat/{conversation_id}/messages/stream
```

Backend vẫn gọi lại `query_ai()` để giữ cùng logic persistence, sau đó stream text ra client bằng SSE.

Event format:

```text
event: status
data: {"message": "..."}

event: message_start
data: {"_id": "...", "created_at": "...", "attachments": []}

event: delta
data: {"content": "..."}

event: done
data: {"_id": "...", "content": "...", "is_user": false}
```

Web client parse SSE trong `client/src/services/chatService.js`, hàm `sendMessageStream`.

### Quick chat

```text
POST /api/chat/quick-messages
```

Không lưu conversation/message, nhưng vẫn check/cập nhật rate limit. Dùng cho hỏi nhanh.

### Department query

```text
POST /api/chat/department-query?department=phongdaotao
```

Không lưu hội thoại, gọi agent với department cụ thể.

Lưu ý ở web client: nếu chọn department khác `default`, `chatService.sendMessage()` sẽ gọi endpoint này thay vì endpoint conversation message.

## 7. Agent và LangGraph

Code chính: `api/src/agent/supervisor_agent.py`.

Agent dùng LangGraph với 3 node:

```text
contextualize -> agent -> action -> agent -> END
```

Trong đó:

- `contextualize`: rewrite câu hỏi follow-up thành câu hỏi độc lập dựa trên tối đa 5 message gần nhất. Bỏ qua rewrite nếu message có `[DOCUMENT CONTEXT]` hoặc auth context student code.
- `agent`: xử lý chính. Có thể trả lời trực tiếp, gọi student DB, hoặc ép gọi RAG tool.
- `action`: LangGraph `ToolNode`, hiện tool chính là `search_kma_regulations`.

### Logic chọn đường xử lý

Trong `call_model_no_human_loop()`:

1. Nếu `chat_mode == "student"`:
   - Gọi `_handle_student_query_directly(..., force_student=True)`.
   - Không đi ReAct/RAG tài liệu.
2. Nếu `chat_mode != "document"`:
   - Thử nhận diện câu hỏi điểm/thông tin sinh viên.
   - Nếu nhận diện được thì xử lý trực tiếp qua PostgreSQL.
3. Nếu message có `[DOCUMENT CONTEXT]`:
   - Không ép gọi RAG tool.
   - LLM trả lời dựa trên context upload.
4. Nếu `chat_mode == "document"`:
   - Ép gọi `search_kma_regulations`.
5. Nếu còn lại:
   - Fallback cũng ép gọi `search_kma_regulations` cho câu hỏi tài liệu.

Điểm quan trọng: hiện code chủ yếu ép gọi tool RAG trực tiếp với tài liệu, không dựa hoàn toàn vào LLM tự quyết định tool.

## 8. Luồng hỏi tài liệu/quy định

Luồng phổ biến:

```text
Client
  -> POST /api/chat/{conversation_id}/messages
  -> chat.py/query_ai()
  -> ReActGraph.chat_with_memory()
  -> contextualize_latest_query()
  -> call_model_no_human_loop()
  -> search_kma_regulations.invoke()
  -> process_kma_query_sync()
  -> DepartmentGraphManager.query_smart()
  -> GraphRoutedRetriever
  -> LLM generate answer with context/source metadata
  -> MongoDB save assistant message
  -> response to client
```

Module liên quan:

- `api/src/rag/tool.py`: định nghĩa LangChain tool `search_kma_regulations`.
- `api/src/rag/rag_graph.py`: process query, lấy retriever, tạo answer, thêm nguồn.
- `api/src/graph_rag/department_graph_manager.py`: chọn graph phòng ban, load graph, query smart.
- `api/src/graph_rag/graph_retriever.py`: truy xuất node/chunk theo graph, community, expansion, rerank.
- `api/src/rag/prompts/generate.txt`: prompt sinh câu trả lời.

## 9. GraphRAG theo phòng ban

GraphRAG hiện dùng graph đã build trong:

```text
api/graphs/department_graphs/
```

Các department thường gặp:

- `phongdaotao`
- `phongkhaothi`
- `khoa`
- `viennghiencuuvahoptacphattrien`
- `thongtinhvktmm`
- `document_graph`

`DepartmentGraphManager`:

1. Load graph `.pkl` hoặc `.graphml`.
2. Tạo `SubgraphPartitioner`.
3. Load/rebuild community metadata.
4. Tạo `GraphRoutedRetriever`.
5. Dùng `SemanticDepartmentDetector` để chọn department theo semantic signal và metadata người dùng.
6. Query đúng department graph.
7. Nếu lỗi, fallback sang `document_graph` nếu có.

Build/rebuild graph liên quan:

- `api/src/build_department_graphs.py`
- `api/src/rag/table_aware_chunking.py`
- `api/src/graph_rag/graph_builder.py`
- Admin API `/api/admin/rag/rebuild-department-rag-index`

Yêu cầu embedding:

- Ollama chạy ở `OLLAMA_BASE_URL`.
- Embedding model mặc định: `nomic-embed-text:latest`.

## 10. Luồng hỏi điểm/thông tin sinh viên

Điểm sinh viên không đi RAG tài liệu. Code cố tình xử lý trước ReAct bằng structured extraction + PostgreSQL.

Module chính:

- `api/src/agent/supervisor_agent.py`
- `api/src/score/database.py`
- `api/src/score/student_tool.py`
- `api/src/score/models.py`

Luồng:

```text
Client chọn chat_mode=student
  -> Backend lấy student_code từ JWT profile user
  -> Inject vào query: "My authenticated student code is ..."
  -> Agent _handle_student_query_directly()
  -> LLM structured output ScoreQueryExtraction
  -> ScoreQueryPlan
  -> PostgreSQL get_scores()
  -> Format bảng điểm/GPA
  -> Trả thẳng AIMessage, không gọi RAG tool
```

Security quan trọng:

- Backend bỏ qua `student_code` header từ client.
- Mã sinh viên dùng để xem điểm lấy từ profile user đã đăng nhập.
- Nếu user hỏi mã sinh viên khác, backend trả 403.
- Nếu account chưa có `student_code`, backend trả 403 và yêu cầu cập nhật mã sinh viên.

PostgreSQL cần biến môi trường:

```env
POSTGRES_URI=postgresql://lma_user:pass123@postgres:5432/lma_chatbot
```

Trong local ngoài Docker, host thường là `localhost`; trong Docker, host là `postgres`.

## 11. Upload file và hỏi trên file cá nhân

Hiện có 2 nhóm API file.

### File legacy dưới `/api/chat`

Code: `api/src/backend/api/file.py`.

Endpoint:

```text
POST   /api/chat/upload-file
POST   /api/chat/query-file
POST   /api/chat/multi-query-file
GET    /api/chat/file-info/{file_id}
GET    /api/chat/list-files
DELETE /api/chat/delete-file/{file_id}
```

Web `client/src/services/chatService.js` vẫn còn gọi các endpoint legacy này cho một số chức năng.

### File v2 dưới `/api/files`

Code: `api/src/backend/api/file_v2.py`.

Endpoint:

```text
POST   /api/files/upload
GET    /api/files/
DELETE /api/files/{file_id}
GET    /api/files/{file_id}/metadata
POST   /api/files/search?query=...&file_ids=...
GET    /api/files/{file_id}/content
GET    /api/files/download/{file_id}   # deprecated, trả 410
```

Mobile app đang dùng file v2.

File v2 hoạt động theo kiểu metadata + vector, không lưu binary file:

1. Upload file.
2. Lưu metadata vào MongoDB collection `files_metadata`.
3. Extract text bằng Docling/PyPDF2/python-docx fallback.
4. Chunk text bằng enhanced chunking.
5. Embed bằng Ollama `nomic-embed-text:latest`.
6. Lưu chunks + vector vào Milvus.
7. Update metadata `status=ready`, `embedding_count`.

Khi chat message có attachments:

1. `query_ai()` nhận `attachments: [file_id]`.
2. `AttachmentRAGService.build_context_from_attachments()` search Milvus.
3. Backend nối context vào query dạng `[DOCUMENT CONTEXT]`.
4. Agent thấy marker này thì không gọi RAG quy định KMA.
5. LLM trả lời dựa trên file upload, backend đảm bảo có footer `Nguồn`.

## 12. LLM và model switching

Module:

- `api/src/llm/model_manager.py`
- `api/src/llm/llm_factory.py`
- `api/src/llm/config.py`
- `api/src/backend/api/admin_model.py`
- `api/src/backend/api/models.py`

`get_llm()` gọi `LLMFactory.create_llm()`.

Thứ tự chọn model:

1. Runtime override trong `model_manager`.
2. Env `ACTIVE_MODEL_TYPE`.
3. Active model đã load từ MongoDB `llm_models`.
4. Env default `DEFAULT_MODEL_TYPE`.
5. Fallback thường về Gemini nếu type không hợp lệ.

Các type hỗ trợ:

- `ollama`
- `gemini`
- `huggingface`
- `other`/fallback

Env thường dùng:

```env
ACTIVE_MODEL_TYPE=ollama
DEFAULT_MODEL_TYPE=ollama
ACTIVE_OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
RAG_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```

Admin model API:

```text
GET  /api/admin/models/available
GET  /api/admin/models/current
POST /api/admin/models/custom
POST /api/admin/models/select
POST /api/admin/models/test
POST /api/admin/models/reset
```

## 13. Rate limit và upload limit

Rate limit code nằm ở:

- `api/src/backend/api/rate_limit.py`
- `api/src/backend/models/rate_limit.py`

Endpoint:

```text
GET    /api/rate-limits
POST   /api/rate-limits
PUT    /api/rate-limits
GET    /api/stats/user/rate-limits
GET    /api/admin/rate-limits/stats
GET    /api/admin/rate-limits/usage-summary
DELETE /api/admin/rate-limits/user/{user_id}
```

Chat flow dùng `check_rate_limit(user_id, estimated_tokens, count_as_request=...)`.

File upload limit code nằm ở:

- `api/src/backend/api/file_upload_limit.py`
- `api/src/backend/models/file_upload_limit.py`

Endpoint:

```text
GET  /api/file-upload-limits
POST /api/file-upload-limits
PUT  /api/file-upload-limits
GET  /api/file-upload-limits/user/{user_id}/stats
GET  /api/file-upload-limits/users
```

## 14. Admin RAG

Code: `api/src/backend/api/admin_rag.py`.

Admin có thể quản lý tài liệu training trong `api/data`.

Endpoint chính:

```text
GET    /api/admin/rag/list-training-files
POST   /api/admin/rag/upload-training-file
DELETE /api/admin/rag/delete-training-file/{filename}
POST   /api/admin/rag/rebuild-rag-index
POST   /api/admin/rag/rebuild-department-rag-index
GET    /api/admin/rag/list-departments
POST   /api/admin/rag/create-folder
POST   /api/admin/rag/create-subfolder
DELETE /api/admin/rag/delete-folder/{folder_name:path}
PUT    /api/admin/rag/rename-folder
GET    /api/admin/rag/download-file/{file_path:path}
GET    /api/admin/rag/get-file-content/{filename}
PUT    /api/admin/rag/edit-file
GET    /api/admin/rag/list-folders
```

Web service gọi các endpoint này trong `client/src/services/adminService.js`.

## 15. Frontend web

Main web app nằm ở `client/`.

API base URL:

```js
process.env.REACT_APP_API_BASE_URL ||
process.env.REACT_APP_API_URL ||
`${window.location.protocol}//${window.location.hostname}:8000`
```

File quan trọng:

- `client/src/utils/constants.js`: danh sách endpoint frontend dùng.
- `client/src/utils/httpClient.js`: fetch wrapper, JWT, refresh token.
- `client/src/services/authService.js`: login/register/me/refresh.
- `client/src/services/chatService.js`: conversation, message, streaming, file legacy, department query.
- `client/src/services/userService.js`: admin/user profile.
- `client/src/services/modelService.js`: model admin.
- `client/src/services/rateLimitService.js`: rate limit.
- `client/src/services/fileUploadLimitService.js`: upload limit.
- `client/src/components/admin/*`: admin dashboard.

Luồng chat web thường:

```text
User nhập message
  -> ChatInput/App state
  -> chatService.sendMessageStream() hoặc sendMessage()
  -> /api/chat/{conversation_id}/messages/stream
  -> render delta/status/done
```

Nếu chọn department cụ thể:

```text
chatService.sendMessage()
  -> queryDepartment()
  -> /api/chat/department-query?department=...
```

## 16. Mobile app

Mobile app nằm ở `mobile/`.

API base URL:

```js
EXPO_PUBLIC_API_BASE_URL || expoConfig.extra.apiBaseUrl || "http://192.168.0.102:8000"
```

Lưu ý: khi chạy trên điện thoại thật, không dùng `localhost`, phải dùng IP LAN của máy chạy backend.

File chính:

- `mobile/src/config.js`: endpoint config.
- `mobile/src/api.js`: auth/chat/model/file API wrapper.
- `mobile/src/storage.js`: token/session storage.
- `mobile/src/screens/*`: màn hình login/register/chat.
- `mobile/src/components/*`: chat UI, file upload, sidebar.

Mobile dùng:

- Auth: `/api/auth/login`, `/api/auth/me`.
- Conversation: `/api/chat/conversations`.
- Message: `/api/chat/{conversation_id}/messages`.
- File v2: `/api/files/upload`, `/api/files/`, `/api/files/{file_id}`, `/api/files/{file_id}/content`.

Mobile chặn admin login: nếu `role !== "user"`, app clear session và báo mobile chỉ dành cho user.

## 17. Cấu hình môi trường tối thiểu

`.env.example` hiện chưa đầy đủ so với biến code đọc. Với Docker compose hiện tại, các biến quan trọng:

```env
DB_NAME=lma_chatbot
DB_USER=lma_user
DB_PASSWORD=pass123
DB_PORT=5432

MONGO_USER=admin
MONGO_PASSWORD=password123

POSTGRES_URI=postgresql://lma_user:pass123@postgres:5432/lma_chatbot
MONGODB_URL=mongodb://admin:password123@mongodb:27017/lma_agent?authSource=admin

ACTIVE_MODEL_TYPE=ollama
DEFAULT_MODEL_TYPE=ollama
ACTIVE_OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
RAG_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest

MILVUS_HOST=milvus
MILVUS_PORT=19530
MILVUS_COLLECTION_NAME=file_embeddings

GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
JWT_SECRET_KEY=change-this-secret
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

Milvus Cloud mode dùng:

```env
MILVUS_CLOUD_ENDPOINT=...
MILVUS_CLOUD_TOKEN=...
MILVUS_COLLECTION_NAME=file_embeddings
```

## 18. Cách chạy từ đầu

### Docker

Windows:

```bat
start.bat
```

Linux/macOS/WSL:

```bash
chmod +x start.sh
./start.sh
```

Hoặc trực tiếp:

```bash
docker-compose up -d --build
```

Mở:

```text
Web:     http://localhost:3000
API:     http://localhost:8000
Swagger: http://localhost:8000/docs
Health:  http://localhost:8000/health
```

Kiểm tra container:

```bash
docker-compose ps
docker-compose logs -f api
```

Dừng:

```bash
docker-compose down
```

Xóa volume:

```bash
docker-compose down -v
```

### Backend thủ công

Chạy DB trước bằng Docker:

```bash
docker-compose up -d postgres mongodb milvus etcd minio ollama
```

Backend:

```bash
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Windows PowerShell:

```powershell
cd api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Web thủ công

```bash
cd client
npm install
npm start
```

### Mobile

Tạo `mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000
```

Chạy:

```bash
cd mobile
npm install
npm start
```

## 19. Cách xem từng endpoint API

Cách dễ nhất là Swagger:

```text
http://localhost:8000/docs
```

Thứ tự nên xem:

1. `GET /health`
2. `POST /api/users/`
3. `POST /api/auth/login`
4. `GET /api/auth/me`
5. `POST /api/chat/conversations`
6. `GET /api/chat/conversations`
7. `POST /api/chat/{conversation_id}/messages`
8. `POST /api/chat/{conversation_id}/messages/stream`
9. `GET /api/chat/messages/{conversation_id}`
10. `POST /api/files/upload`
11. `GET /api/files/`
12. `POST /api/files/search`
13. `GET /api/admin/models/current`
14. `GET /api/admin/rag/list-training-files`

Với endpoint auth login, Swagger phải dùng form data OAuth2, không phải JSON.

## 20. Collections và bảng dữ liệu

MongoDB collections thấy trong code:

- `users`
- `conversations`
- `messages`
- `conversation_stats`
- `rate_limits`
- `file_upload_limits`
- `file_upload_stats`
- `files_metadata`
- `llm_models`

PostgreSQL tables code đang query:

- `students`
- `subjects`
- `scores`

Milvus collection:

- Mặc định `file_embeddings`.
- Field kỳ vọng trong code:
  - `primary_key` hoặc auto id.
  - `vector` float vector, dimension 384.
  - dynamic fields: `file_id`, `chunk_index`, `text`.

## 21. Những điểm cần chú ý trước GA

Các điểm rủi ro/technical debt nhìn từ code hiện tại:

- `.env.example` chưa khớp đầy đủ với biến môi trường code thật sự dùng.
- README/terminal có dấu hiệu lỗi encoding tiếng Việt.
- `Makefile` có target bị lặp (`up`, `down`, `logs`, `clean`, `build`, `shell-api`, `shell-db`).
- `client` đang gọi cả file legacy `/api/chat/upload-file` và mobile dùng file v2 `/api/files/upload`; cần quyết định API file chính thức.
- `VectorStoreService` yêu cầu collection Milvus có sẵn; nếu collection chưa được tạo, upload file sẽ fail.
- `docker-compose.dev.yml` có service `redis` override nhưng `docker-compose.yml` không định nghĩa `redis`.
- `main.py` log Milvus Cloud nhưng Docker compose dùng Milvus standalone; message log có thể gây hiểu nhầm.
- `adminService.js` còn nhiều mock data cho stats/conversation/user cũ, trong khi repo có API thật ở các service khác.
- `chat.py` rất lớn, chứa nhiều helper bảo mật, normalize response, SSE, query, rate limit trong một file; trước GA nên tách service để dễ test.
- CORS đang `allow_origins=["*"]`; production nên giới hạn domain.
- Password hash đang dùng SHA-256 + salt thủ công; production nên dùng bcrypt/argon2.
- Một số text tiếng Việt trong file hiển thị mojibake khi đọc từ PowerShell; cần chuẩn hóa encoding UTF-8.
- `get_llm()` và `LLMFactory` đang có log critical/debug khá ồn.
- Streaming endpoint không stream token thật từ LLM; nó chờ `query_ai()` xong rồi chia nhỏ response thành delta.

## 22. Checklist học code cho người mới

Đọc theo thứ tự này sẽ dễ hiểu nhất:

1. `docker-compose.yml`: hiểu các service hệ thống.
2. `api/src/backend/main.py`: hiểu app startup.
3. `api/src/backend/api/__init__.py`: hiểu route tree.
4. `api/src/backend/api/auth.py` và `user.py`: hiểu user/JWT.
5. `api/src/backend/api/chat.py`: hiểu luồng conversation/message.
6. `api/src/agent/supervisor_agent.py`: hiểu agent quyết định đi student/RAG/file.
7. `api/src/rag/tool.py` và `api/src/rag/rag_graph.py`: hiểu tool RAG.
8. `api/src/graph_rag/department_graph_manager.py`: hiểu routing graph theo phòng ban.
9. `api/src/score/database.py`: hiểu truy vấn điểm.
10. `api/src/backend/api/file_v2.py` và `services/attachment_rag_service.py`: hiểu file upload/vector.
11. `client/src/services/chatService.js`: hiểu web gọi backend.
12. `mobile/src/api.js`: hiểu mobile gọi backend.

## 23. Luồng end-to-end mẫu

### Hỏi quy định đào tạo

```text
User: "Điều kiện tốt nghiệp là gì?"
Web -> /api/chat/{id}/messages/stream
Backend -> lưu user message
Agent -> chat_mode=document
Agent -> gọi search_kma_regulations
RAG -> semantic department routing chọn phongdaotao/document_graph
GraphRAG -> retrieve chunks
LLM -> sinh answer + nguồn
Backend -> lưu assistant message
Web -> render SSE done
```

### Hỏi điểm

```text
User chọn mode student: "Điểm kỳ gần nhất của em thế nào?"
Backend -> lấy student_code từ JWT user profile
Agent -> structured extraction ScoreQueryExtraction
PostgreSQL -> get_scores(student_code, semester latest)
Agent -> format bảng điểm + GPA
Backend -> lưu/trả response
```

### Hỏi file upload

```text
User upload PDF
/api/files/upload -> extract text -> chunk -> embedding -> Milvus
User hỏi kèm attachment file_id
/api/chat/{id}/messages -> build [DOCUMENT CONTEXT] từ Milvus
Agent thấy [DOCUMENT CONTEXT] -> không gọi RAG quy định
LLM trả lời dựa trên file upload + nguồn chunk/file
```

## 24. Kết luận

KMA Agent hiện là một monolith FastAPI + React/Mobile với các năng lực chính:

- Auth/JWT và quản lý user.
- Conversation chat có persistence.
- RAG/GraphRAG theo tài liệu phòng ban.
- Truy vấn điểm sinh viên trực tiếp từ PostgreSQL.
- Upload file cá nhân và hỏi đáp qua Milvus vector.
- Admin quản lý model, RAG data, user, rate limit, file upload limit.

Nếu chuẩn bị GA, việc cần làm không chỉ là test UI mà còn phải chuẩn hóa env, thống nhất file API, giảm mock, siết security, bổ sung test cho chat/student/file/RAG, và kiểm tra vận hành Milvus/Ollama/GraphRAG trên môi trường production.

---

## 25. Bản đồ API chi tiết theo router backend

Toàn bộ API backend được mount qua `api/src/backend/main.py`:

```python
app.include_router(api_router, prefix="/api", tags=["api"])
```

Nghĩa là mọi router trong `api/src/backend/api/__init__.py` đều có prefix `/api`.

### Router include thực tế

| Router | File | Prefix cuối cùng | Ghi chú |
| --- | --- | --- | --- |
| Chat | `api/src/backend/api/chat.py` | `/api/chat` | Conversation, message, stream, quick chat, department query |
| File legacy | `api/src/backend/api/file.py` | `/api/chat` | API file cũ nằm chung prefix chat |
| File v2 | `api/src/backend/api/file_v2.py` | `/api/files` | Upload/search/list/delete file metadata + Milvus |
| User | `api/src/backend/api/user.py` | `/api/users` | Register, profile, admin user |
| Auth | `api/src/backend/api/auth.py` | `/api/auth` | Login OAuth2 form, refresh, me |
| Rate limit | `api/src/backend/api/rate_limit.py` | `/api/rate-limits`, `/api/admin/rate-limits/*`, `/api/stats/user/rate-limits` | Không có prefix riêng trong include |
| File upload limit | `api/src/backend/api/file_upload_limit.py` | `/api/admin/file-upload-limits` | Prefix nằm trong router file |
| Models classic | `api/src/backend/api/models.py` | `/api/models` | CRUD/activate model trong Mongo |
| Admin RAG | `api/src/backend/api/admin_rag.py` | `/api/admin/rag` | Quản lý training files và rebuild graph |
| Admin model | `api/src/backend/api/admin_model.py` | `/api/admin/models` | Select/test/custom model |
| Dashboard stats | `api/src/backend/api/dashboard_stats.py` | `/api/admin/dashboard` | Stats/conversation log/test data |

Lưu ý quan trọng: phần overview cũ có nhắc `/api/admin/stats` và `/api/admin/conversations`. Theo code hiện tại, router thật là:

```text
GET  /api/admin/dashboard/stats
GET  /api/admin/dashboard/conversations
POST /api/admin/dashboard/conversation-stat
POST /api/admin/dashboard/test-data
```

Trong `client/src/utils/constants.js` vẫn có endpoint dashboard cũ ở một số chỗ, còn `client/src/components/admin/Dashboard.jsx` lại tự build URL. Đây là điểm cần rà trước GA vì frontend có thể gọi sai route nếu dùng constant cũ.

### Response envelope chung

Phần lớn endpoint trả về `BaseResponse` trong `api/src/backend/models/responses.py`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human readable message",
  "data": {}
}
```

Backend cũng có exception handler toàn cục trong `main.py`. Khi `HTTPException` xảy ra, response vẫn theo envelope trên, nhưng `success=false`, `statusCode` là HTTP status và `message` là detail lỗi.

## 26. Auth/JWT chi tiết theo code

### User schema

`api/src/backend/models/user.py` định nghĩa input/output chính.

`UserCreate`:

```json
{
  "username": "string",
  "password": "string",
  "student_code": "string | null",
  "student_name": "string | null",
  "student_class": "string | null",
  "role": "user",
  "email": "string | null"
}
```

`UserResponse`:

```json
{
  "_id": "mongo_object_id",
  "username": "string",
  "student_code": "string | null",
  "student_name": "string | null",
  "student_class": "string | null",
  "role": "user | admin",
  "email": "string | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Register call stack

Endpoint:

```text
POST /api/users/
```

Code path:

```text
api/user.py:create_user()
  -> check duplicate username
  -> check duplicate email nếu có
  -> check duplicate student_code nếu có
  -> hash_password()
  -> db.users.insert_one()
  -> public_user_data()
  -> BaseResponse[UserResponse]
```

Password hiện hash bằng SHA-256 + salt tự viết trong `api/user.py`. Cách này chạy được cho local/dev, nhưng trước production nên chuyển sang `bcrypt` hoặc `argon2`.

### Login call stack

Endpoint:

```text
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded
```

Body không phải JSON:

```text
username=...
password=...
```

Code path:

```text
api/auth.py:login_for_access_token()
  -> db.users.find_one({"username": form_data.username})
  -> verify_password()
  -> create_access_token({"sub": str(user["_id"])})
  -> create_refresh_token({"sub": str(user["_id"])})
  -> db.users.update_one(... last_login ...)
  -> BaseResponse[Token]
```

`Token` response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer"
}
```

### JWT payload

`api/src/backend/auth/jwt.py` tạo payload dạng:

```json
{
  "sub": "mongo_user_id",
  "token_type": "access | refresh",
  "exp": 1234567890
}
```

`get_current_user()` chỉ chấp nhận `token_type=access`. `validate_refresh_token()` chỉ chấp nhận `token_type=refresh`.

### Protected endpoint flow

Các endpoint cần đăng nhập dùng:

```python
current_user = Depends(require_auth)
```

Flow:

```text
require_auth()
  -> get_current_user()
      -> decode JWT
      -> validate token_type == access
      -> validate sub là ObjectId
      -> db.users.find_one({"_id": ObjectId(sub)})
      -> check is_active != false
      -> trả dict user public
```

Endpoint admin thường tự check:

```python
if current_user.get("role") != "admin":
    raise HTTPException(status_code=403)
```

Hoặc dùng `get_current_admin_user()` trong `auth/dependencies.py`.

## 27. MongoDB chi tiết

Mongo connection nằm ở `api/src/backend/db/mongodb.py`.

Env:

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=ai_chat
```

Trong Docker compose, `MONGODB_URL` thường có user/pass và host `mongodb`.

Code có singleton global:

```text
mongodb = MongoDB()
get_db() -> mongodb.ensure_connection() -> AsyncIOMotorDatabase
```

Khi connect, code tạo index unique:

```text
rate_limits.user_id unique
```

### Collections và shape dữ liệu thực tế

`users`:

```json
{
  "_id": "ObjectId",
  "username": "string",
  "password_hash": "string",
  "salt": "string",
  "student_code": "string | null",
  "student_name": "string | null",
  "student_class": "string | null",
  "role": "user | admin",
  "email": "string | null",
  "is_active": true,
  "created_at": "datetime",
  "updated_at": "datetime",
  "last_login": "datetime | null"
}
```

`conversations`:

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "title": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

`messages`:

```json
{
  "_id": "ObjectId",
  "conversation_id": "ObjectId",
  "content": "string",
  "is_user": true,
  "created_at": "datetime",
  "attachments": [
    {
      "file_id": "string",
      "filename": "string",
      "size": 123,
      "mime_type": "application/pdf",
      "status": "ready"
    }
  ]
}
```

`conversation_stats`:

```json
{
  "conversation_id": "string",
  "user_id": "string",
  "username": "string",
  "title": "string",
  "message_count": 2,
  "tokens_used": 1200,
  "status": "active",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

`files_metadata`:

```json
{
  "file_id": "uuid",
  "original_filename": "string",
  "file_size": 12345,
  "mime_type": "application/pdf",
  "user_id": "string | null",
  "conversation_id": "string | null",
  "status": "processing | ready | error",
  "embedding_count": 15,
  "last_indexed": "datetime",
  "created_at": "datetime"
}
```

`settings` dùng cho rate limit:

```json
{
  "type": "rate_limit",
  "settings": {
    "role_limits": {},
    "user_exceptions": []
  },
  "updated_at": "datetime"
}
```

`rate_limits`:

```json
{
  "user_id": "string",
  "username": "string",
  "requestsToday": 0,
  "tokensToday": 0,
  "requestsThisMonth": 0,
  "tokensThisMonth": 0,
  "dailyResetTime": "datetime",
  "monthlyResetTime": "datetime",
  "updatedAt": "datetime"
}
```

`llm_models`:

```json
{
  "_id": "ObjectId",
  "name": "model-name",
  "modelType": "ollama | gemini | huggingface | other",
  "isActive": true,
  "parameters": {},
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## 28. Chat endpoint chi tiết theo từng hàm

File `api/src/backend/api/chat.py` là file lớn nhất của backend chat. Nó vừa làm controller HTTP, vừa chứa helper bảo mật, normalize message, rate limit, attachment RAG và persistence.

### Helper quan trọng trong `chat.py`

| Hàm | Vai trò |
| --- | --- |
| `validate_object_id()` | Validate string có phải Mongo ObjectId |
| `normalize_message_content()` | Ép content từ nhiều dạng về string |
| `strip_thinking_content()` | Loại bỏ phần `<think>...</think>` nếu model trả reasoning |
| `strip_response_reasoning()` | Dọn reasoning/debug text trước khi lưu/trả |
| `extract_document_context_sources()` | Parse nguồn từ `[DOCUMENT CONTEXT]` |
| `ensure_uploaded_document_source_footer()` | Đảm bảo câu trả lời file upload có phần nguồn |
| `normalize_student_code()` | Chuẩn hóa mã sinh viên |
| `is_private_student_query()` | Nhận diện câu hỏi đụng dữ liệu cá nhân/điểm |
| `authorize_and_augment_student_query()` | Chặn xem mã sinh viên khác, inject mã SV từ JWT |
| `normalize_chat_mode()` | Chuẩn hóa `auto`, `document`, `student` |
| `build_student_mode_query()` | Ép query đi theo student mode |
| `sse_event()` | Format event SSE |
| `chunk_text()` | Chia response thành delta giả cho SSE |
| `estimate_token_count()` | Ước lượng token để ghi rate limit/stat |

### Khởi tạo agent

Ở đầu module `chat.py`, agent được tạo ở import time:

```text
agent = ReActGraph()
agent.create_graph()
agent.print_mermaid()
```

Điều này nghĩa là khi FastAPI import router chat, LangGraph đã được dựng sẵn. Nếu LLM/GraphRAG init chậm hoặc env thiếu, lỗi có thể xuất hiện ngay lúc server boot/import.

### `POST /api/chat/{conversation_id}/messages`

Input model: `MessageCreate`.

Payload đầy đủ:

```json
{
  "content": "string",
  "is_user": true,
  "department": "string | null",
  "attachments": ["file_id_1", "file_id_2"],
  "chat_mode": "auto | document | student"
}
```

Call stack chi tiết:

```text
query_ai(conversation_id, message, current_user)
  -> validate conversation_id
  -> db.conversations.find_one({"_id": ObjectId(conversation_id)})
  -> check conversation.user_id == current_user._id, trừ admin/all use case
  -> normalize_chat_mode(message.chat_mode)
  -> estimate token input ban đầu
  -> check_rate_limit(current_user._id, estimated_tokens, count_as_request=True)
  -> nếu mode student:
       build_student_mode_query()
  -> nếu mode auto và query là private student query:
       authorize_and_augment_student_query()
  -> nếu có attachments:
       FileManagementService + VectorStoreService + AttachmentRAGService
       build_context_from_attachments(query, attachment_ids, user_id)
       nối [DOCUMENT CONTEXT] vào prompt
  -> db.messages.insert_one(user message)
  -> db.messages.find({"conversation_id": ObjectId(...)}) để lấy history
  -> convert history sang LangChain HumanMessage/AIMessage
  -> agent.chat_with_memory(augmented_query, history, department, chat_mode)
  -> strip reasoning/thinking
  -> nếu attachment context thì ensure_uploaded_document_source_footer()
  -> db.messages.insert_one(assistant message)
  -> db.conversations.update_one(updated_at)
  -> update rate limit token thật hơn
  -> log/update conversation_stats
  -> BaseResponse[MessageResponse]
```

Điểm cần hiểu: `department` là scope RAG tài liệu, không phải quyền user. Còn quyền xem điểm sinh viên lấy từ JWT user profile.

### `POST /api/chat/{conversation_id}/messages/stream`

SSE endpoint không stream token thật từ LLM. Flow hiện tại:

```text
query_ai_stream()
  -> event_generator()
      -> yield status
      -> await query_ai(...)
      -> lấy full answer đã xong
      -> yield message_start
      -> chunk_text(full_answer)
      -> yield delta từng đoạn nhỏ
      -> yield done
```

Vì vậy nếu LLM/RAG mất 20 giây, client sẽ thấy status trước, nhưng delta nội dung chỉ bắt đầu sau khi `query_ai()` xử lý xong.

### Conversation APIs

| Endpoint | Hàm | Side effect |
| --- | --- | --- |
| `GET /api/chat/conversations/all` | `get_all_conversations()` | Admin xem tất cả conversation |
| `GET /api/chat/conversations` | `get_conversations_of_user()` | User xem conversation của mình; admin có thể filter |
| `POST /api/chat/conversations` | `create_conversation()` | Insert `conversations` |
| `PUT /api/chat/conversations/{id}` | `update_conversation()` | Update title/updated_at |
| `DELETE /api/chat/conversations/{id}` | `delete_conversation()` | Delete conversation và messages |
| `GET /api/chat/messages/{id}` | `get_messages_of_conversation()` | Read messages theo conversation |

### Non-persistent chat APIs

`POST /api/chat/quick-messages`:

```text
quick_chat()
  -> check rate limit
  -> agent.chat()
  -> update rate limit
  -> return QuickMessageResponse
```

`POST /api/chat/department-query?department=...`:

```text
department_specific_query()
  -> validate department scope
  -> agent.chat(message, department=department)
  -> return QuickMessageResponse
```

Hai endpoint này không lưu conversation/message.

## 29. Agent LangGraph chi tiết

Code chính: `api/src/agent/supervisor_agent.py`.

### Graph node

Graph có 3 bước chính:

```mermaid
flowchart LR
    A["contextualize"] --> B["agent"]
    B -->|tool needed| C["action ToolNode"]
    C --> B
    B -->|final answer| D["END"]
```

### Ý nghĩa từng node

`contextualize`:

- Nhận `messages`.
- Nếu câu hỏi là follow-up kiểu "còn cái đó thì sao", rewrite thành câu hỏi độc lập.
- Chỉ dùng tối đa khoảng 5 message gần nhất để tránh prompt quá dài.
- Bỏ qua rewrite nếu message có marker `[DOCUMENT CONTEXT]`, vì lúc đó prompt đã chứa context file upload.

`agent`:

- Nếu `chat_mode=student`, gọi student DB trực tiếp.
- Nếu không phải document mode, thử nhận diện câu hỏi điểm/thông tin sinh viên.
- Nếu là document/file/regulation query, ép gọi RAG tool.
- Nếu tool trả context/source, LLM sinh câu trả lời cuối.

`action`:

- Là `ToolNode`.
- Tool chính là `search_kma_regulations`.

### Khi nào đi student, khi nào đi RAG?

```text
chat_mode=student
  -> Student DB trực tiếp

chat_mode=auto + câu hỏi có dấu hiệu điểm/thông tin cá nhân
  -> Student DB nếu được authorize

có [DOCUMENT CONTEXT]
  -> LLM trả lời theo file upload, không gọi RAG quy định

chat_mode=document
  -> search_kma_regulations

còn lại
  -> fallback search_kma_regulations
```

Kết luận thực tế: Agent hiện không phải agent "tự do gọi tool bất kỳ". Code đang chủ động route bằng rule để tránh model hỏi lan man hoặc lộ dữ liệu sinh viên.

## 30. Student score flow chi tiết

Student score không dùng Milvus, không dùng GraphRAG. Nó query PostgreSQL trực tiếp.

### Các module

| File | Vai trò |
| --- | --- |
| `api/src/score/models.py` | Pydantic model cho extraction/plan/score |
| `api/src/score/database.py` | Query PostgreSQL |
| `api/src/score/student_tool.py` | Format kết quả thành text/table |
| `api/src/agent/supervisor_agent.py` | Nhận diện và gọi student flow |

### Security flow

Backend luôn ưu tiên mã sinh viên trong JWT:

```text
current_user.student_code
```

Không tin mã sinh viên client tự gửi trong prompt/header. Nếu prompt có mã sinh viên khác với account đang đăng nhập, `chat.py` sẽ chặn bằng 403.

### Extraction và query plan

LLM không được tự viết SQL. Nó chỉ trích xuất ý định vào schema kiểu:

```json
{
  "student_code": "ATxxxxxx",
  "semester": "string | null",
  "subject_name": "string | null",
  "subject_id": "string | null",
  "query_type": "score | gpa | student_info | ..."
}
```

Sau đó code tạo `ScoreQueryPlan`, rồi `database.py` query bảng:

```text
students
subjects
scores
```

Query thường join:

```text
scores.student_code -> students.student_code
scores.subject_id   -> subjects.subject_id
```

Filter phổ biến:

- `student_code`
- `semester`
- `subject_id`
- `subject_name`

### Output

`student_tool.py` format kết quả thành text tiếng Việt, thường gồm:

- Thông tin sinh viên.
- Danh sách môn.
- Điểm hệ 10.
- Điểm chữ hoặc grade point nếu có.
- GPA/tổng kết nếu query yêu cầu.

Điểm mạnh của thiết kế này: dữ liệu điểm là dữ liệu có cấu trúc, nên không đi qua vector search. RAG chỉ dành cho tài liệu/quy định.

## 31. File upload v2 chi tiết

Code chính:

- `api/src/backend/api/file_v2.py`
- `api/src/backend/services/file_service.py`
- `api/src/backend/services/attachment_rag_service.py`
- `api/src/backend/services/vector_store_service.py`

### Upload endpoint

```text
POST /api/files/upload
```

Auth là optional:

```text
get_optional_user()
```

Nghĩa là anonymous upload có thể chạy, nhưng nếu có JWT thì metadata gắn với `user_id` và check upload limit.

Query/body:

```text
file: UploadFile
conversation_id: optional query/form
```

Flow:

```text
upload_file()
  -> đọc bytes từ UploadFile
  -> check size <= 50MB
  -> check MIME type được hỗ trợ
  -> nếu có user: check_file_upload_limit()
  -> save_file_metadata(status="processing")
  -> AttachmentRAGService.process_file_attachment()
       -> extract text
       -> smart chunk
       -> embed từng chunk bằng OllamaEmbeddings
       -> VectorStoreService.store_embeddings_batch()
       -> update metadata status ready/error
  -> update_file_upload_stats()
  -> BaseResponse(data={file_id, status="processing", ...})
```

Lưu ý: code log kiểu "background processing", nhưng hiện tại flow upload đang gọi xử lý embedding ngay trong request. Response vẫn trả `status="processing"` dù embedding có thể đã chạy xong trong request.

### Extract text

`AttachmentRAGService._extract_file_text()` hỗ trợ nhiều fallback:

- PDF: Docling hoặc PyPDF2 tùy môi trường.
- DOCX: python-docx.
- Text/CSV/Markdown: decode text.
- Một số format khác tùy dependency cài được.

### Chunking

`_smart_chunk_text()` ưu tiên giữ cấu trúc:

- Heading/section.
- Paragraph.
- Table-like text nếu extract được.
- Fallback `_fallback_chunk_text()` theo chunk size.

### Embedding và Milvus

Embedding model mặc định:

```text
nomic-embed-text:latest
```

Vector store:

```text
MILVUS_HOST=milvus
MILVUS_PORT=19530
MILVUS_COLLECTION_NAME=file_embeddings
```

`VectorStoreService` giả định collection Milvus đã tồn tại và có schema tương thích. Dynamic fields thường gồm:

```json
{
  "file_id": "uuid",
  "chunk_index": 0,
  "text": "chunk text",
  "filename": "original filename",
  "user_id": "string | null",
  "conversation_id": "string | null"
}
```

Trước GA cần kiểm tra thật dimension của collection Milvus khớp embedding model. Trong tài liệu/comment có chỗ nhắc `384`, nhưng `nomic-embed-text` thường không nên bị assume cứng nếu collection được tạo bởi script khác.

### Search attachment khi chat

Khi message có `attachments`, `query_ai()` gọi:

```text
AttachmentRAGService.build_context_from_attachments()
  -> search_attachments(query, file_ids, user_id)
  -> VectorStoreService.search_similar()
  -> format:
       [Source 1]
       File: ...
       File ID: ...
       Chunk: ...
       Relevance: ...
       Content: ...
```

Sau đó backend gắn vào prompt:

```text
[DOCUMENT CONTEXT]
...
[/DOCUMENT CONTEXT]
```

Agent thấy marker này thì trả lời dựa trên context upload, không gọi `search_kma_regulations`.

## 32. RAG/GraphRAG call stack chi tiết

Phần RAG chính thức của KMA regulations đi qua LangChain tool:

```text
api/src/rag/tool.py:search_kma_regulations
```

Call stack:

```text
search_kma_regulations.invoke(query)
  -> process_kma_query_sync()
  -> process_kma_query()
  -> get_retriever()
  -> DepartmentGraphManager.query_smart()
  -> SemanticDepartmentDetector chọn department nếu cần
  -> DepartmentGraphManager.get_or_load_graph(department)
  -> GraphRoutedRetriever.retrieve()
  -> generate answer bằng prompt rag/prompts/generate.txt
  -> trả answer + source metadata
```

### Department routing

Nếu client truyền `department`, code cố gắng query đúng graph đó. Nếu không truyền, `SemanticDepartmentDetector` dựa trên nội dung câu hỏi và metadata để chọn graph phù hợp.

Ví dụ:

```text
"điều kiện tốt nghiệp" -> phongdaotao hoặc document_graph
"phúc khảo"            -> phongkhaothi
"nghiên cứu khoa học"  -> viennghiencuuvahoptacphattrien
```

### Graph assets

Graph đã build nằm trong:

```text
api/graphs/department_graphs/
```

Training data nằm trong:

```text
api/data/
```

Admin rebuild:

```text
POST /api/admin/rag/rebuild-department-rag-index
```

Rebuild full:

```text
POST /api/admin/rag/rebuild-rag-index
```

### Ba tham số GA bạn chuẩn bị tối ưu

Chi tiết riêng nằm ở `RAG_GA_TUNING_GUIDE.md`, nhưng liên hệ với overview:

| Tham số GA | Vị trí logic | Ý nghĩa |
| --- | --- | --- |
| `threshold` | build semantic graph | Ngưỡng similarity để nối cạnh semantic giữa chunk/node |
| `max_edges_per_node` | build graph | Giới hạn số cạnh semantic mỗi node để tránh graph quá dày |
| `top_k` | retriever runtime | Số chunk/node lấy về cho answer |

Các giá trị bạn định sweep:

```text
threshold: 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9
max_edges_per_node: 3..10
top_k: 3..10
```

Tổng số tổ hợp brute force:

```text
7 * 8 * 8 = 448
```

GA nên cache graph theo cặp `(threshold, max_edges_per_node)`, vì `top_k` chỉ ảnh hưởng truy xuất runtime, không cần rebuild graph.

## 33. Frontend web gọi API thế nào

### Base URL

`client/src/utils/constants.js`:

```js
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;
```

Nếu web chạy `localhost:3000`, API mặc định là `localhost:8000`.

### HTTP wrapper

`client/src/utils/httpClient.js` chịu trách nhiệm:

- Gắn `Authorization: Bearer <access_token>`.
- Nếu API trả 401, gọi refresh token.
- Queue các request đang chờ refresh để tránh nhiều refresh song song.
- Có helper `get`, `post`, `put`, `delete`, `upload`.

### Auth service

`client/src/services/authService.js`:

- Register gọi `/api/users/`.
- Login gọi trực tiếp `fetch` đến `/api/auth/login` vì endpoint dùng form-urlencoded.
- `getCurrentUser()` gọi `/api/auth/me`.
- Refresh gọi `/api/auth/refresh`.

### Chat service

`client/src/services/chatService.js` có hai nhánh quan trọng:

1. `sendMessageStream()`:

```text
fetch(`${API_BASE_URL}/api/chat/${conversationId}/messages/stream`)
```

Tự parse SSE event `status`, `message_start`, `delta`, `done`, `error`.

2. `sendMessage()`:

```text
nếu department khác default:
    queryDepartment() -> /api/chat/department-query
ngược lại:
    POST /api/chat/{conversationId}/messages
```

Điểm cần chú ý: department query không lưu message vào conversation. Nếu UI mong lịch sử đầy đủ, nên dùng conversation message endpoint với `department` trong payload thay vì gọi `department-query`.

### File UI

Web đang có cả hai dòng:

- Legacy: `chatService.uploadFile()` gọi `/api/chat/upload-file`.
- New file panel: `FileUploadPanel.jsx`, `FileManagement.jsx` gọi `/api/files/*`.

Trước GA nên chọn một API file chính thức. Nếu giữ v2, nên migrate các chỗ còn dùng legacy sang `/api/files/upload` và attachment flow trong chat message.

## 34. Mobile gọi API thế nào

`mobile/src/config.js` định nghĩa:

```js
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  "http://192.168.0.102:8000";
```

Các endpoint chính:

```text
login              -> /api/auth/login
register           -> /api/users/
me                 -> /api/auth/me
updateProfile      -> /api/users/me/profile
changePassword     -> /api/users/me/password
conversations      -> /api/chat/conversations
messages           -> /api/chat/messages
sendMessage(id)    -> /api/chat/{id}/messages
uploadFile         -> /api/files/upload
listFiles          -> /api/files/
deleteFile(id)     -> /api/files/{id}
currentModel       -> /api/admin/models/current
activeModel        -> /api/models/active
```

Mobile không dùng `localhost` nếu chạy trên điện thoại thật. Phải dùng IP LAN của máy đang chạy backend.

Mobile cũng có rule chặn admin login: nếu user role khác `user`, app clear session và báo app mobile chỉ dành cho user.

## 35. LLM/model switching chi tiết

### Runtime flow

Các module:

```text
api/src/llm/config.py
api/src/llm/llm_factory.py
api/src/llm/model_manager.py
```

Flow:

```text
get_llm()
  -> ModelManager.get_model_type()
      -> runtime override nếu vừa select model
      -> env ACTIVE_MODEL_TYPE
      -> active model từ Mongo llm_models
      -> env DEFAULT_MODEL_TYPE
  -> LLMFactory.create_llm(model_type)
      -> Ollama/Gemini/HuggingFace wrapper
```

### Admin model API

Hai cụm endpoint cùng tồn tại:

Classic model API:

```text
GET  /api/models/
GET  /api/models/active
POST /api/models/activate/{model_id}
PUT  /api/models/params/{model_id}
POST /api/models/upload
```

Admin model management:

```text
GET  /api/admin/models/available
GET  /api/admin/models/current
POST /api/admin/models/custom
POST /api/admin/models/select
POST /api/admin/models/test
POST /api/admin/models/reset
```

Web admin model management chủ yếu dùng nhóm `/api/admin/models/*`.

### Điểm cần cẩn thận

- Nếu dùng Ollama, phải đảm bảo model chat và embedding đã được pull.
- `RAG_MODEL`, `OLLAMA_MODEL`, `ACTIVE_OLLAMA_MODEL` cần thống nhất để tránh chat dùng model này, RAG dùng model khác ngoài ý muốn.
- Nếu chuyển Gemini, cần `GOOGLE_API_KEY`.
- Nếu model trả `<think>...</think>`, `chat.py` có helper strip trước khi lưu/trả nhưng vẫn nên test với model reasoning.

## 36. Rate limit và upload limit chi tiết

### Rate limit

Config endpoint:

```text
GET  /api/rate-limits
POST /api/rate-limits
PUT  /api/rate-limits
```

Usage endpoint:

```text
GET    /api/stats/user/rate-limits
GET    /api/rate-limits/stats
GET    /api/admin/rate-limits/stats
GET    /api/admin/rate-limits/usage-summary
DELETE /api/admin/rate-limits/user/{user_id}
```

`check_rate_limit(user_id, token_count, count_as_request)`:

```text
  -> load config từ settings(type="rate_limit")
  -> lấy role/user exception
  -> reset daily/monthly nếu qua kỳ
  -> kiểm tra requests/tokens
  -> update counters
  -> trả allowed/message
```

Chat gọi rate limit trước khi LLM chạy để chặn request sớm, sau đó cập nhật token ước lượng sau khi có response.

### File upload limit

Prefix thật:

```text
/api/admin/file-upload-limits
```

Endpoints:

```text
GET  /api/admin/file-upload-limits
POST /api/admin/file-upload-limits
PUT  /api/admin/file-upload-limits
GET  /api/admin/file-upload-limits/user/{user_id}/stats
GET  /api/admin/file-upload-limits/users
```

Upload flow v2 gọi:

```text
check_file_upload_limit()
update_file_upload_stats()
```

để enforce số file/dung lượng theo role/user exception.

## 37. Admin RAG chi tiết

`api/src/backend/api/admin_rag.py` quản lý file training trong `api/data`.

### Upload training file

```text
POST /api/admin/rag/upload-training-file
```

Flow:

```text
upload_training_file()
  -> check current_user
  -> check role admin
  -> validate folder/path
  -> save file vào api/data/<folder>
  -> trả metadata
```

Endpoint này chỉ đưa file vào training data. Muốn RAG dùng file mới, phải rebuild index/department graph.

### Rebuild full RAG

```text
POST /api/admin/rag/rebuild-rag-index
```

Dùng cho rebuild index tổng thể.

### Rebuild department RAG

```text
POST /api/admin/rag/rebuild-department-rag-index
```

Payload thường chỉ định department/folder. Flow build liên quan:

```text
api/src/build_department_graphs.py
  -> table_aware_chunking
  -> graph_builder
  -> lưu graph vào api/graphs/department_graphs
```

### File/folder management

Nhóm endpoint quản lý cây thư mục:

```text
GET    /api/admin/rag/list-training-files
GET    /api/admin/rag/list-folders
GET    /api/admin/rag/list-departments
POST   /api/admin/rag/create-folder
POST   /api/admin/rag/create-subfolder
PUT    /api/admin/rag/rename-folder
DELETE /api/admin/rag/delete-folder/{folder_name:path}
DELETE /api/admin/rag/delete-training-file/{filename}
GET    /api/admin/rag/download-file/{file_path:path}
GET    /api/admin/rag/get-file-content/{filename}
PUT    /api/admin/rag/edit-file
```

## 38. Setup từ đầu đến cuối để tự chạy và tự xem endpoint

Phần này viết theo hướng bạn tự làm, không cần agent chạy hộ.

### Bước 1: Kiểm tra tool cần có

Trên máy cần có:

```text
Docker Desktop
Docker Compose
Git
Node.js 18+ nếu chạy web thủ công
Python 3.10+ nếu chạy backend thủ công
```

Nếu chạy bằng Docker full stack, không cần tạo venv backend trước.

### Bước 2: Tạo `.env`

Copy từ `.env.example` nếu có, rồi bổ sung các biến tối thiểu:

```env
DB_NAME=lma_chatbot
DB_USER=lma_user
DB_PASSWORD=pass123
DB_PORT=5432

MONGO_USER=admin
MONGO_PASSWORD=password123
MONGODB_URL=mongodb://admin:password123@mongodb:27017/lma_agent?authSource=admin
MONGODB_DB_NAME=lma_agent

POSTGRES_URI=postgresql://lma_user:pass123@postgres:5432/lma_chatbot

ACTIVE_MODEL_TYPE=ollama
DEFAULT_MODEL_TYPE=ollama
ACTIVE_OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
RAG_MODEL=qwen3:4b-instruct-2507-q4_K_M
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest

MILVUS_HOST=milvus
MILVUS_PORT=19530
MILVUS_COLLECTION_NAME=file_embeddings

JWT_SECRET_KEY=change-this-secret
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

### Bước 3: Start full stack

Windows:

```bat
start.bat
```

Hoặc:

```bash
docker-compose up -d --build
```

### Bước 4: Kiểm tra service

```bash
docker-compose ps
docker-compose logs -f api
```

Mở:

```text
API health: http://localhost:8000/health
Swagger:    http://localhost:8000/docs
Web:        http://localhost:3000
```

### Bước 5: Pull Ollama models nếu thiếu

Vào container Ollama:

```bash
docker-compose exec ollama ollama pull qwen3:4b-instruct-2507-q4_K_M
docker-compose exec ollama ollama pull nomic-embed-text:latest
```

Nếu model name trong `.env` khác, pull đúng tên đó.

### Bước 6: Tạo user trong Swagger

Mở:

```text
http://localhost:8000/docs
```

Gọi:

```text
POST /api/users/
```

Body:

```json
{
  "username": "demo",
  "password": "demo123",
  "student_code": "AT000000",
  "student_name": "Demo User",
  "student_class": "AT00",
  "role": "user",
  "email": "demo@example.com"
}
```

### Bước 7: Login lấy token

Trong Swagger, gọi:

```text
POST /api/auth/login
```

Chọn `application/x-www-form-urlencoded`, nhập:

```text
username=demo
password=demo123
```

Copy `access_token`. Bấm nút `Authorize` của Swagger và nhập:

```text
Bearer <access_token>
```

### Bước 8: Tạo conversation

```text
POST /api/chat/conversations
```

Body:

```json
{
  "title": "Test RAG"
}
```

Copy `_id` của conversation.

### Bước 9: Test chat document mode

```text
POST /api/chat/{conversation_id}/messages
```

Body:

```json
{
  "content": "Điều kiện tốt nghiệp là gì?",
  "is_user": true,
  "department": "phongdaotao",
  "attachments": [],
  "chat_mode": "document"
}
```

Nếu lỗi ở bước này, kiểm tra:

- API logs.
- Ollama có model chưa.
- GraphRAG graph có trong `api/graphs/department_graphs`.
- Env `OLLAMA_BASE_URL` đúng chưa.

### Bước 10: Test student mode

```text
POST /api/chat/{conversation_id}/messages
```

Body:

```json
{
  "content": "Cho em xem điểm kỳ gần nhất",
  "is_user": true,
  "department": null,
  "attachments": [],
  "chat_mode": "student"
}
```

Nếu lỗi, kiểm tra:

- User có `student_code`.
- PostgreSQL có bảng `students`, `subjects`, `scores`.
- `POSTGRES_URI` đúng.

### Bước 11: Test upload file v2

```text
POST /api/files/upload
```

Upload PDF/DOCX/TXT nhỏ trước.

Sau đó:

```text
GET /api/files/
```

Copy `file_id`.

### Bước 12: Test hỏi theo file upload

```text
POST /api/chat/{conversation_id}/messages
```

Body:

```json
{
  "content": "Tóm tắt nội dung chính trong file này",
  "is_user": true,
  "department": null,
  "attachments": ["<file_id>"],
  "chat_mode": "auto"
}
```

Nếu lỗi:

- Milvus collection chưa có hoặc sai schema.
- Ollama embedding model chưa pull.
- File chưa extract được text.
- Metadata file chưa chuyển `ready`.

## 39. Checklist debug theo lỗi thường gặp

### API không lên

Kiểm tra:

```bash
docker-compose logs -f api
```

Các nguyên nhân phổ biến:

- Thiếu env.
- Mongo/Postgres chưa ready.
- Import `chat.py` khởi tạo agent lỗi.
- Ollama URL sai.

### Login được nhưng endpoint protected báo 401

Kiểm tra:

- Header có đúng `Authorization: Bearer <token>` không.
- Token có phải access token không, không dùng refresh token.
- `JWT_SECRET_KEY` có đổi giữa lúc login và lúc gọi API không.
- User trong Mongo có bị `is_active=false` không.

### Chat treo lâu

Kiểm tra:

- Ollama model có đang tải/chưa pull.
- RAG graph load lần đầu chậm.
- Query đang rebuild graph.
- SSE chỉ stream sau khi `query_ai()` xong, nên không thấy delta ngay không có nghĩa là chết.

### Upload file lỗi

Kiểm tra:

- File size <= 50MB.
- MIME type được phép.
- Milvus đang chạy.
- Collection `file_embeddings` tồn tại.
- Embedding dimension khớp.
- Ollama có `nomic-embed-text:latest`.

### RAG trả lời không đúng phòng ban

Kiểm tra:

- Payload có `department` không.
- Department name có đúng folder/graph name không.
- Graph department đã rebuild sau khi thêm tài liệu chưa.
- `SemanticDepartmentDetector` có chọn nhầm không.

### Dashboard admin không có data

Kiểm tra:

- Frontend gọi đúng `/api/admin/dashboard/stats`.
- `conversation_stats` có record chưa.
- User role có phải admin không.

## 40. Checklist đọc code theo debugger

Nếu muốn hiểu repo thật nhanh, đặt breakpoint theo thứ tự này:

1. `api/src/backend/main.py:startup_db_client()`  
   Xem app boot, Mongo, active model, Milvus, GraphRAG warmup.

2. `api/src/backend/api/auth.py:login_for_access_token()`  
   Xem login lấy user, verify password, tạo token.

3. `api/src/backend/auth/jwt.py:get_current_user()`  
   Xem protected endpoint decode JWT và load user.

4. `api/src/backend/api/chat.py:query_ai()`  
   Đây là breakpoint quan trọng nhất cho mọi chat message thường.

5. `api/src/agent/supervisor_agent.py:chat_with_memory()`  
   Xem backend chuyển từ HTTP sang agent.

6. `api/src/agent/supervisor_agent.py:call_model_no_human_loop()`  
   Xem rule route student/document/file.

7. `api/src/rag/tool.py`  
   Xem lúc agent gọi tool RAG.

8. `api/src/rag/rag_graph.py`  
   Xem RAG lấy retriever và generate answer.

9. `api/src/graph_rag/department_graph_manager.py`  
   Xem department routing và graph load.

10. `api/src/backend/services/attachment_rag_service.py:build_context_from_attachments()`  
    Xem file upload context được dựng thế nào.

11. `api/src/score/database.py`  
    Xem SQL/student score flow.

12. `client/src/services/chatService.js:sendMessageStream()`  
    Xem web nhận SSE và render delta.

## 41. Các điểm cần quyết định trước GA

Đây là các quyết định kỹ thuật nên chốt trước khi nói GA:

1. File API chính thức là legacy `/api/chat/upload-file` hay v2 `/api/files/upload`.
2. Dashboard endpoint frontend dùng `/api/admin/dashboard/*` hay constant cũ.
3. Milvus collection được tạo ở đâu, schema/dimension cố định bằng script nào.
4. Password hashing có chuyển sang bcrypt/argon2 không.
5. CORS production cho domain nào, không để `*`.
6. SSE có cần token streaming thật không hay chấp nhận stream giả sau khi full answer xong.
7. RAG graph rebuild là sync API hay background job.
8. `.env.example` cần cập nhật đầy đủ biến đang được code đọc.
9. Admin API nào bắt buộc role admin, API nào chỉ require auth.
10. Có cần migration seed dữ liệu Postgres/Mongo cho môi trường mới không.
