@echo off
echo ==========================================
echo   AI Ubuntu Agent Quick Setup
echo ==========================================
echo.

REM Check Docker
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo Setting up with default configuration...
echo.
echo Desktop credentials:
echo   Username: admin
echo   Password: admin123
echo.

REM Create .env file with defaults
(
    echo CUSTOM_USER=admin
    echo PASSWORD=admin123
    echo DESKTOP_VNC_PASSWORD=admin123
    echo # Add your OpenRouter API key below if you want AI features:
    echo # OPENROUTER_API_KEY=your-api-key-here
) > .env

REM Stop existing containers
docker-compose -f docker-compose.simple.yml down 2>nul

REM Build and start
echo Building containers...
docker-compose -f docker-compose.simple.yml build

echo.
echo Starting containers...
docker-compose -f docker-compose.simple.yml up -d

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo Desktop: http://localhost:3000
echo   Username: admin
echo   Password: admin123
echo.
echo Web Interface: http://localhost:3001
echo Agent API: http://localhost:3002
echo.
echo To check logs: docker-compose -f docker-compose.simple.yml logs -f
echo To stop: docker-compose -f docker-compose.simple.yml down
echo.
pause