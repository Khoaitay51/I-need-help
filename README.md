# LMA Agent

LMA Agent là hệ thống chatbot cho Học viện Kỹ thuật Mật mã, gồm web app, mobile app và backend AI. Hệ thống hỗ trợ hỏi đáp quy định/tài liệu bằng GraphRAG, hỏi điểm sinh viên bằng truy vấn CSDL, upload tài liệu cá nhân để hỏi đáp, quản trị người dùng, giới hạn lượt dùng, quản lý mô hình LLM và quản lý kho tài liệu RAG.

## Thành phần chính

```text
lma_agent/
├── api/                         Backend FastAPI
│   ├── src/backend/              API, auth, MongoDB, upload file, admin
│   ├── src/agent/                LangGraph supervisor agent
│   ├── src/rag/                  RAG pipeline, prompt sinh câu trả lời
│   ├── src/graph_rag/            GraphRAG, community routing, BM25 rerank
│   ├── src/score/                Truy vấn điểm sinh viên từ PostgreSQL
│   ├── data/                     Tài liệu nguồn theo thư mục/phòng ban
│   └── graphs/department_graphs/ Graph đã build sẵn cho GraphRAG
├── client/                       Web app React 18
├── mobile/                       Mobile app Expo/React Native
├── docker-compose.yml            Postgres, MongoDB, Milvus, API, client
├── docker-compose.dev.yml        Override cho môi trường dev
├── Makefile                      Lệnh tiện ích Docker/dev
└── .env.example                  Mẫu biến môi trường
```

## Công nghệ

- Backend: FastAPI, LangChain, LangGraph, Pydantic, Motor/MongoDB, asyncpg/PostgreSQL.
- Frontend web: React 18, react-scripts, axios, react-markdown.
- Mobile: Expo, React Native.
- RAG: tài liệu trong `api/data`, graph theo phòng ban trong `api/graphs/department_graphs`, semantic routing, community detection, graph expansion, BM25-style reranking.
- LLM: Gemini, Ollama hoặc HuggingFace, chọn qua biến môi trường hoặc màn hình quản trị model.
- Vector/file upload: Milvus standalone hoặc Milvus Cloud qua `VectorStoreService`.

## Yêu cầu

- Docker Desktop và Docker Compose.
- Node.js 20+ nếu chạy web/mobile ngoài Docker.
- Python 3.12 nếu chạy backend ngoài Docker.
- Ollama nếu dùng embedding/model local. GraphRAG đang gọi embedding qua `OLLAMA_BASE_URL`, mặc định `http://localhost:11434`, model embedding mặc định `nomic-embed-text:latest`.
- API key tương ứng nếu dùng Gemini/HuggingFace.

## Cấu hình môi trường

Tạo file `.env` ở thư mục gốc:

```bash
cp .env.example .env
```

Các biến quan trọng:

```env
# MongoDB dùng cho user, auth, conversation, message, model config
MONGODB_URL=mongodb://admin:password123@localhost:27017/lma_agent?authSource=admin
MONGODB_DB_NAME=ai_chat

# PostgreSQL dùng cho dữ liệu điểm sinh viên
DB_NAME=lma_chatbot
DB_USER=lma_user
DB_PASSWORD=secure_password_123
DB_PORT=5432
POSTGRES_URI=postgresql://lma_user:secure_password_123@localhost:5432/lma_chatbot

# JWT
JWT_SECRET_KEY=change-this-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# LLM
DEFAULT_MODEL_TYPE=gemini
GOOGLE_API_KEY=your_google_api_key
GEMINI_MODEL=gemini-2.0-flash

# Ollama, dùng cho embedding GraphRAG và có thể dùng làm LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
OLLAMA_MODEL=llama3

# Milvus cho upload/search file cá nhân
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_COLLECTION_NAME=file_embeddings
```

Lưu ý: `.env.example` hiện chưa liệt kê đủ mọi biến mà code đang đọc. Nếu chạy chức năng điểm, bắt buộc có `POSTGRES_URI`. Nếu chạy bằng Docker, các service nội bộ dùng host theo tên container, ví dụ `postgres`, `mongodb`, `milvus`.

## Chạy nhanh bằng Docker

Windows:

```bat
start.bat
```

Linux/macOS:

```bash
chmod +x start.sh stop.sh
./start.sh
```

Hoặc dùng Docker Compose trực tiếp:

```bash
docker-compose up -d --build
```

Nếu máy chỉ có Docker Compose v2, dùng `docker compose` thay cho `docker-compose`. Khi đó các script `.bat/.sh` có thể cần sửa cùng kiểu lệnh.

Mở:

- Web: http://localhost:3000
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Dừng hệ thống:

```bash
docker-compose down
```

Xóa cả volume dữ liệu:

```bash
docker-compose down -v
```

## Chạy môi trường dev bằng Docker

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Hoặc:

```bash
make up
```

Theo `docker-compose.dev.yml`, API chạy reload bằng:

```bash
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Web được map ra `http://localhost:3000`.

## Chạy thủ công backend

Khởi động trước các service phụ thuộc, tối thiểu MongoDB. Nếu dùng Docker cho DB:

```bash
docker-compose up -d postgres mongodb milvus
```

Cài thư viện và chạy API:

```bash
cd api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Linux/macOS dùng:

```bash
source venv/bin/activate
```

Backend khi startup sẽ:

- Kết nối MongoDB.
- Load model active từ MongoDB nếu có, nếu không dùng cấu hình môi trường.
- Kiểm tra Milvus nếu có cấu hình.
- Warm up GraphRAG cache từ `api/graphs/department_graphs`.

## Chạy web frontend

```bash
cd client
npm install
npm start
```

Mặc định web tự gọi API theo host hiện tại với port `8000`. Có thể override bằng:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

Build production:

```bash
cd client
npm run build
```

## Chạy mobile app

Mobile dùng Expo. Tạo `mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:8000
```

Không dùng `localhost` khi chạy trên điện thoại thật, vì `localhost` là chính điện thoại. Ví dụ:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.102:8000
```

Chạy:

```bash
cd mobile
npm install
npm start
```

Sau đó mở Expo Go và quét QR. Backend phải chạy với `--host 0.0.0.0` và firewall phải cho thiết bị trong cùng Wi-Fi truy cập cổng `8000`.

## Luồng xử lý câu hỏi

### Hỏi tài liệu/quy định

1. Web/mobile gửi message tới backend, thường qua `POST /api/chat/{conversation_id}/messages/stream`.
2. Backend lưu user message vào MongoDB và lấy lịch sử hội thoại.
3. `ReActGraph.chat_with_memory()` nhận history, câu hỏi mới, `department` và `chat_mode`.
4. Node `contextualize` dùng LLM rewrite câu hỏi mới thành câu hỏi độc lập nếu có history. Chỉ dùng 5 message gần nhất và cắt mỗi message tối đa 1200 ký tự.
5. Với `chat_mode=document`, agent ép gọi tool `search_kma_regulations`.
6. Tool gọi `process_kma_query_sync()`.
7. `DepartmentGraphManager` chọn graph phù hợp bằng semantic department routing. Nếu không có phòng ban cụ thể, hệ thống có thể dùng `document_graph`/graph chung.
8. `GraphRoutedRetriever` chọn community liên quan, mở rộng node theo cạnh graph, tính semantic score, BM25-style score và rerank.
9. RAG ghép context có metadata nguồn rồi gọi LLM sinh câu trả lời.
10. Backend lưu assistant message và stream kết quả về client.

### Hỏi điểm sinh viên

1. Backend inject mã sinh viên đã xác thực vào query.
2. Trước ReAct/tool RAG, agent gọi LLM structured extraction để hiểu câu hỏi điểm tự nhiên.
3. LLM sinh `ScoreQueryPlan`, gồm kỳ học, kỳ gần nhất, môn học, yêu cầu GPA hệ 4, điểm chữ, điểm trung bình hoặc bảng chi tiết.
4. Code truy vấn trực tiếp PostgreSQL qua `ScoreFilter` và `global_db.db.get_scores`.
5. Agent tính điểm trung bình hệ 10, GPA hệ 4 theo tín chỉ, hiển thị điểm chữ và bảng môn học.

Luồng điểm không dùng keyword để hiểu ý định tính điểm. Keyword còn tồn tại ở một số nhánh legacy cho routing tài liệu, không phải cho tính điểm.

### Hỏi trên tài liệu upload

Nếu message chứa `[DOCUMENT CONTEXT]`, agent không ép gọi `search_kma_regulations`. LLM trả lời trực tiếp dựa trên context tài liệu upload và phải trích nguồn theo metadata có trong context.

## API chính

Health:

- `GET /`
- `GET /health`
- `GET /health/milvus`
- `GET /db-check`

Auth/user:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/users/`
- `PUT /api/users/me/profile`
- `PUT /api/users/me/password`

Chat:

- `GET /api/chat/conversations`
- `POST /api/chat/conversations`
- `PUT /api/chat/conversations/{conversation_id}`
- `DELETE /api/chat/conversations/{conversation_id}`
- `GET /api/chat/messages/{conversation_id}`
- `POST /api/chat/{conversation_id}/messages`
- `POST /api/chat/{conversation_id}/messages/stream`
- `POST /api/chat/department-query`

File:

- `POST /api/chat/upload-file`
- `POST /api/chat/query-file`
- `POST /api/chat/multi-query-file`
- `GET /api/chat/list-files`
- `DELETE /api/chat/delete-file/{file_id}`
- `POST /api/files/upload`
- `GET /api/files/`
- `POST /api/files/search`
- `GET /api/files/{file_id}/content`

Admin:

- `GET /api/admin/models/current`
- `GET /api/admin/models/available`
- `POST /api/admin/models/select`
- `POST /api/admin/models/test`
- `GET /api/admin/rag/list-training-files`
- `POST /api/admin/rag/upload-training-file`
- `POST /api/admin/rag/rebuild-rag-index`
- `POST /api/admin/rag/rebuild-department-rag-index`
- `GET /api/admin/rag/list-departments`
- `GET /api/admin/stats`
- `GET /api/admin/conversations`

Xem đầy đủ schema tại `http://localhost:8000/docs`.

## Dữ liệu và GraphRAG

- Tài liệu nguồn đặt trong `api/data`.
- Mỗi thư mục con thường đại diện một nhóm tài liệu/phòng ban, ví dụ `phongdaotao`, `phongkhaothi`, `viennghiencuuvahoptacphattrien`.
- Graph đã build nằm trong `api/graphs/department_graphs`.
- Khi admin upload hoặc sửa tài liệu, dùng màn quản trị hoặc endpoint rebuild để build lại index/graph.
- GraphRAG dùng Ollama embedding, vì vậy nếu rebuild hoặc query cần embedding mới, Ollama phải chạy và có model `nomic-embed-text:latest` hoặc model được cấu hình trong `OLLAMA_EMBEDDING_MODEL`.

## Lệnh tiện ích

```bash
make up          # chạy docker-compose dev
make down        # dừng container
make logs        # xem log
make ps          # xem container
make build       # build image
make clean       # dừng và xóa volume/cache Python
make shell-api   # vào container API
make shell-db    # vào PostgreSQL
make npm-build   # build frontend
```

Trên Windows nếu `make` không có sẵn, dùng trực tiếp `docker-compose` hoặc các file `.bat`.

## Kiểm tra nhanh

Backend:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/db-check
```

Frontend:

```bash
cd client
npm run build
```

Python syntax cho file agent:

```bash
cd api
python -m py_compile src/agent/supervisor_agent.py
```

RAG test script có sẵn:

```bash
run_rag_test.bat
```

hoặc:

```bash
./run_rag_test.sh
```

## Troubleshooting

### Backend không start vì MongoDB

Kiểm tra MongoDB:

```bash
docker-compose ps mongodb
docker-compose logs mongodb
```

Kiểm tra biến:

```env
MONGODB_URL=mongodb://admin:password123@localhost:27017/lma_agent?authSource=admin
MONGODB_DB_NAME=ai_chat
```

### Hỏi tài liệu bị lỗi embedding/Ollama

Kiểm tra Ollama:

```bash
ollama list
ollama pull nomic-embed-text:latest
```

Nếu backend chạy trong Docker nhưng Ollama chạy trên máy host, cần cấu hình `OLLAMA_BASE_URL` sao cho container truy cập được host.

### Hỏi điểm bị lỗi `POSTGRES_URI environment variable is not set`

Thêm vào `.env`:

```env
POSTGRES_URI=postgresql://lma_user:secure_password_123@localhost:5432/lma_chatbot
```

Nếu backend chạy trong Docker:

```env
POSTGRES_URI=postgresql://lma_user:secure_password_123@postgres:5432/lma_chatbot
```

### Mobile không gọi được API

- Dùng IP LAN của máy chạy backend, không dùng `localhost`.
- Backend phải chạy `--host 0.0.0.0`.
- Mở firewall cho cổng `8000`.
- Trên điện thoại thử mở `http://YOUR_COMPUTER_LAN_IP:8000/health`.

### Port đã bị chiếm

Đổi port trong `.env` hoặc dừng process đang dùng port:

- API: `8000`
- Web: `3000`
- PostgreSQL: `5432`
- MongoDB: `27017`
- Milvus: `19530`, `9091`

## Ghi chú hiện trạng

- Đây là kiến trúc một supervisor agent với tool/module RAG và score handler, chưa phải hệ multi-agent độc lập.
- Conversation history được lưu trong MongoDB, nhưng agent chỉ đưa 5 message gần nhất vào contextualizer để tránh quá tải prompt.
- Tên model active có thể lấy từ MongoDB qua admin model API; nếu không có model active, hệ thống fallback về biến môi trường.
- `libre/` là một codebase frontend riêng/nhánh tham khảo, không phải client chính đang chạy trong `docker-compose.yml`.
