.PHONY: up down logs clean build ps help

help:
	@echo "LMA Agent - Quick Commands"
	@echo ""
	@echo "Core:"
	@echo "  make up       - Start all services"
	@echo "  make down     - Stop all services"
	@echo "  make build    - Build images"
	@echo "  make rebuild  - Rebuild images (no cache)"
	@echo "  make logs     - View logs (tail -f)"
	@echo "  make ps       - Show containers"
	@echo "  make clean    - Remove containers & volumes"

up:
	@DOCKER_BUILDKIT=1 docker-compose up -d --build

down:
	@docker-compose down

build:
	@DOCKER_BUILDKIT=1 docker-compose build

rebuild:
	@DOCKER_BUILDKIT=1 docker-compose build --no-cache

logs:
	@docker-compose logs -f

ps:
	@docker-compose ps

clean:
	@docker-compose down -v

shell-api:
	@docker-compose exec api /bin/bash

shell-db:
	@docker-compose exec postgres psql -U lma_user -d lma_chatbot

up:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

build-api:
	docker-compose -f docker-compose.yml build api

build-client:
	docker-compose -f docker-compose.yml build client

install:
	cd api && pip install -r requirements.txt

lint:
	cd api && pylint src/

format:
	cd api && black src/ && isort src/

test:
	docker-compose run --rm api pytest tests/

npm-install:
	cd client && npm install

npm-build:
	cd client && npm run build

shell-api:
	docker-compose exec api /bin/bash

shell-db:
	docker-compose exec postgres psql -U lma_user -d lma_chatbot_dev

ps:
	docker-compose ps

status:
	@docker-compose ps
	@echo ""
	@docker-compose exec api curl -s http://localhost:8000/health || echo "API is not responding"

validate:
	@echo "Validating Docker setup..."
	@docker --version || (echo "Docker not found"; exit 1)
	@docker-compose --version || (echo "Docker Compose not found"; exit 1)
	@echo "Docker setup is valid ✓"

redis-cli:
	docker-compose exec redis redis-cli

prod-up:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
