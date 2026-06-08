#!/bin/bash

echo ""
echo "========================================"
echo "  LMA Agent - Docker Startup"
echo "========================================"
echo ""

if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    exit 1
fi

echo "Cleaning up old containers..."
docker-compose down --remove-orphans 2>/dev/null

echo "Building and starting services..."
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start services!"
    exit 1
fi

echo ""
echo "========================================"
echo "   Services Started!"
echo "========================================"
echo ""
echo "API:    http://localhost:8000"
echo "Client: http://localhost:3000"
echo ""
echo "Docs:   http://localhost:8000/docs"
echo ""
echo "Use 'docker-compose ps' to check service status"
echo "Use 'docker-compose logs -f' to view logs"
echo ""
