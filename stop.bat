@echo off
echo.
echo Stopping containers...
docker-compose down --remove-orphans

echo.
echo Done! All services stopped.
echo.
pause
