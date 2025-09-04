@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo   AI Ubuntu Agent Setup for Windows
echo ==========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker Desktop is not installed or not on PATH.
  echo - Download: https://www.docker.com/products/docker-desktop
  exit /b 1
)

for /f "usebackq tokens=*" %%i in (`docker info 2^>nul ^| findstr /c:"Server"`) do set DOCKER_OK=1
if not defined DOCKER_OK (
  echo ERROR: Docker Desktop appears to be not running.
  echo Please start Docker Desktop and try again.
  exit /b 1
)

if not exist .env (
  if exist env.example (
    copy /y env.example .env >nul
  ) else (
    echo ERROR: env.example not found. Cannot create .env
    exit /b 1
  )
)

echo Creating required directories...
if not exist data mkdir data
if not exist data\agent mkdir data\agent
if not exist data\desktop mkdir data\desktop
if not exist data\web mkdir data\web
if not exist data\logs mkdir data\logs

echo Pulling base Docker images (may take a few minutes)...
docker pull linuxserver/webtop:ubuntu-xfce
if errorlevel 1 (
  echo ERROR: Failed to pull Docker images.
  exit /b 1
)

echo Building containers...
docker compose build
if errorlevel 1 (
  echo ERROR: Failed to build containers.
  exit /b 1
)

echo Starting services in background...
docker compose up -d
if errorlevel 1 (
  echo ERROR: Failed to start services.
  exit /b 1
)

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo Services:
  echo - Web UI:         http://localhost:9992
  echo - Ubuntu Desktop: http://localhost:6080
  echo - Agent API:      http://localhost:9991
  echo - Metrics:        http://localhost:9090/metrics

echo.
echo Useful commands:
  echo - View logs:      docker compose logs -f
  echo - Stop services:  docker compose down
  echo - Restart:        docker compose restart
  echo - Remove all:     docker compose down -v

endlocal
exit /b 0
