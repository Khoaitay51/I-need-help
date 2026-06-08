@echo off
echo.
echo WARNING: This will delete all containers, volumes, and images!
echo.
pause

echo Stopping containers...
docker-compose down -v

echo Removing images...
docker rmi lma_agent-api lma_agent-client 2>nul

echo.
echo Done! Docker cleaned.
echo.
pause
