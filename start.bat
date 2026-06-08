@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   LMA Agent - Docker Startup
echo ========================================
echo.

REM Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    exit /b 1
)

echo Cleaning up old containers...
docker-compose down --remove-orphans 2>nul

echo Building and starting services (this may take 5-10 minutes on first run)...
echo.
set DOCKER_BUILDKIT=1
set COMPOSE_DOCKER_CLI_BUILD=1

docker-compose up -d --build

if errorlevel 1 (
    echo ERROR: Failed to start services!
    echo.
    echo Troubleshooting:
    echo - Check Docker is running: docker info
    echo - Check logs: docker-compose logs api
    echo - Clean and retry: docker-compose down -v
    exit /b 1
)

echo.
echo ========================================
echo   Success! Services Running
echo ========================================
echo.
echo API:      http://localhost:8000
echo Client:   http://localhost:3000
echo Database: localhost:5432
echo.
echo View logs: docker-compose logs -f
echo Stop:      docker-compose down
echo.
echo Opening browser... Waiting 10 seconds for services to be ready
timeout /t 10 /nobreak
start http://localhost:3000
