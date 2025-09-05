@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   AI Ubuntu Agent Complete Setup
echo ==========================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running or not installed.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo This script will set up your AI Ubuntu Agent with all configurations.
echo.
echo Press Ctrl+C to cancel or
pause

REM Create config directory
if not exist "config" mkdir config

echo.
echo ==========================================
echo   DESKTOP CONFIGURATION
echo ==========================================
echo.

REM Desktop credentials
set /p DESKTOP_USER="Enter username for desktop access (default: admin): "
if "%DESKTOP_USER%"=="" set DESKTOP_USER=admin

set /p DESKTOP_PASS="Enter password for desktop access (default: admin123): "
if "%DESKTOP_PASS%"=="" set DESKTOP_PASS=admin123

echo.
echo ==========================================
echo   AI AGENT CONFIGURATION
echo ==========================================
echo.

REM API Provider Selection
echo Select your AI provider:
echo 1. OpenAI
echo 2. Anthropic (Claude)
echo 3. Google (Gemini)
echo 4. Local (Ollama)
set /p PROVIDER_CHOICE="Enter choice (1-4): "

if "%PROVIDER_CHOICE%"=="1" (
    set LLM_PROVIDER=openai
    set /p OPENAI_API_KEY="Enter your OpenAI API key: "
    set API_KEY=!OPENAI_API_KEY!
    
    echo Select OpenAI model:
    echo 1. gpt-4
    echo 2. gpt-4-turbo
    echo 3. gpt-3.5-turbo
    set /p MODEL_CHOICE="Enter choice (1-3): "
    
    if "!MODEL_CHOICE!"=="1" set LLM_MODEL=gpt-4
    if "!MODEL_CHOICE!"=="2" set LLM_MODEL=gpt-4-turbo
    if "!MODEL_CHOICE!"=="3" set LLM_MODEL=gpt-3.5-turbo
    
) else if "%PROVIDER_CHOICE%"=="2" (
    set LLM_PROVIDER=anthropic
    set /p ANTHROPIC_API_KEY="Enter your Anthropic API key: "
    set API_KEY=!ANTHROPIC_API_KEY!
    
    echo Select Claude model:
    echo 1. claude-3-opus-20240229
    echo 2. claude-3-sonnet-20240229
    echo 3. claude-3-haiku-20240307
    set /p MODEL_CHOICE="Enter choice (1-3): "
    
    if "!MODEL_CHOICE!"=="1" set LLM_MODEL=claude-3-opus-20240229
    if "!MODEL_CHOICE!"=="2" set LLM_MODEL=claude-3-sonnet-20240229
    if "!MODEL_CHOICE!"=="3" set LLM_MODEL=claude-3-haiku-20240307
    
) else if "%PROVIDER_CHOICE%"=="3" (
    set LLM_PROVIDER=google
    set /p GOOGLE_API_KEY="Enter your Google API key: "
    set API_KEY=!GOOGLE_API_KEY!
    set LLM_MODEL=gemini-pro
    
) else if "%PROVIDER_CHOICE%"=="4" (
    set LLM_PROVIDER=ollama
    set /p OLLAMA_HOST="Enter Ollama host (default: http://host.docker.internal:11434): "
    if "!OLLAMA_HOST!"=="" set OLLAMA_HOST=http://host.docker.internal:11434
    set /p LLM_MODEL="Enter Ollama model name (e.g., llama2, mistral): "
    set API_KEY=not_required
)

echo.
echo ==========================================
echo   SECURITY CONFIGURATION
echo ==========================================
echo.

set /p ENABLE_AUTH="Enable authentication for API? (y/n, default: y): "
if "%ENABLE_AUTH%"=="" set ENABLE_AUTH=y

if /i "%ENABLE_AUTH%"=="y" (
    set ENABLE_AUTH=true
    set /p API_USERNAME="Enter API username (default: apiuser): "
    if "!API_USERNAME!"=="" set API_USERNAME=apiuser
    
    set /p API_PASSWORD="Enter API password (default: apipass123): "
    if "!API_PASSWORD!"=="" set API_PASSWORD=apipass123
    
    REM Generate random JWT secret
    for /f "tokens=* usebackq" %%f in (`powershell -command "[System.Web.Security.Membership]::GeneratePassword(32, 0)"`) do set JWT_SECRET=%%f
    if "!JWT_SECRET!"=="" set JWT_SECRET=default_jwt_secret_change_me_in_production
) else (
    set ENABLE_AUTH=false
    set API_USERNAME=
    set API_PASSWORD=
    set JWT_SECRET=
)

echo.
echo ==========================================
echo   NETWORK CONFIGURATION
echo ==========================================
echo.

set /p WEB_PORT="Enter port for web interface (default: 3001): "
if "%WEB_PORT%"=="" set WEB_PORT=3001

set /p AGENT_PORT="Enter port for agent API (default: 3002): "
if "%AGENT_PORT%"=="" set AGENT_PORT=3002

set /p DESKTOP_PORT="Enter port for desktop access (default: 3000): "
if "%DESKTOP_PORT%"=="" set DESKTOP_PORT=3000

echo.
echo ==========================================
echo   ADVANCED OPTIONS
echo ==========================================
echo.

set /p MAX_TOKENS="Enter max tokens for AI responses (default: 2048): "
if "%MAX_TOKENS%"=="" set MAX_TOKENS=2048

set /p TEMPERATURE="Enter AI temperature 0-1 (default: 0.7): "
if "%TEMPERATURE%"=="" set TEMPERATURE=0.7

set /p LOG_LEVEL="Enter log level (debug/info/warn/error, default: info): "
if "%LOG_LEVEL%"=="" set LOG_LEVEL=info

set /p ENABLE_METRICS="Enable Prometheus metrics? (y/n, default: n): "
if /i "%ENABLE_METRICS%"=="y" (
    set ENABLE_METRICS=true
    set /p METRICS_PORT="Enter metrics port (default: 9090): "
    if "!METRICS_PORT!"=="" set METRICS_PORT=9090
) else (
    set ENABLE_METRICS=false
    set METRICS_PORT=9090
)

echo.
echo ==========================================
echo   Creating Configuration Files...
echo ==========================================
echo.

REM Create .env file
echo Creating .env file...
(
    echo # AI Ubuntu Agent Configuration
    echo # Generated on %date% %time%
    echo.
    echo # Desktop Configuration
    echo CUSTOM_USER=%DESKTOP_USER%
    echo PASSWORD=%DESKTOP_PASS%
    echo.
    echo # LLM Configuration
    echo LLM_PROVIDER=%LLM_PROVIDER%
    echo LLM_MODEL=%LLM_MODEL%
    if "%LLM_PROVIDER%"=="openai" echo OPENAI_API_KEY=%API_KEY%
    if "%LLM_PROVIDER%"=="anthropic" echo ANTHROPIC_API_KEY=%API_KEY%
    if "%LLM_PROVIDER%"=="google" echo GOOGLE_API_KEY=%API_KEY%
    if "%LLM_PROVIDER%"=="ollama" echo OLLAMA_HOST=%OLLAMA_HOST%
    echo LLM_MAX_TOKENS=%MAX_TOKENS%
    echo LLM_TEMPERATURE=%TEMPERATURE%
    echo.
    echo # Security
    echo ENABLE_AUTH=%ENABLE_AUTH%
    if "%ENABLE_AUTH%"=="true" (
        echo AUTH_USERNAME=%API_USERNAME%
        echo AUTH_PASSWORD=%API_PASSWORD%
        echo JWT_SECRET=%JWT_SECRET%
    )
    echo.
    echo # Network Ports
    echo WEB_PORT=%WEB_PORT%
    echo AGENT_PORT=%AGENT_PORT%
    echo DESKTOP_PORT=%DESKTOP_PORT%
    echo.
    echo # Monitoring
    echo ENABLE_METRICS=%ENABLE_METRICS%
    echo METRICS_PORT=%METRICS_PORT%
    echo.
    echo # Logging
    echo LOG_LEVEL=%LOG_LEVEL%
    echo NODE_ENV=production
) > .env

echo .env file created successfully!

REM Create docker-compose.override.yml for custom settings
echo Creating docker-compose.override.yml...
(
    echo version: '3.8'
    echo.
    echo services:
    echo   desktop:
    echo     environment:
    echo       - PUID=1000
    echo       - PGID=1000
    echo       - TZ=America/New_York
    echo       - CUSTOM_USER=${CUSTOM_USER}
    echo       - PASSWORD=${PASSWORD}
    echo     ports:
    echo       - "${DESKTOP_PORT}:3000"
    echo.
    echo   web:
    echo     ports:
    echo       - "${WEB_PORT}:80"
    echo     environment:
    echo       - REACT_APP_API_URL=http://localhost:${AGENT_PORT}
    echo       - REACT_APP_DESKTOP_URL=http://localhost:${DESKTOP_PORT}
    echo.
    echo   agent:
    echo     ports:
    echo       - "${AGENT_PORT}:3000"
    if "%ENABLE_METRICS%"=="true" (
        echo       - "${METRICS_PORT}:9090"
    )
    echo     env_file:
    echo       - .env
    echo     environment:
    echo       - NODE_ENV=${NODE_ENV:-production}
    echo       - LOG_LEVEL=${LOG_LEVEL}
) > docker-compose.override.yml

echo docker-compose.override.yml created successfully!

echo.
echo ==========================================
echo   Building and Starting Containers...
echo ==========================================
echo.

REM Stop any running containers
echo Stopping any existing containers...
docker-compose down 2>nul

REM Pull latest base images
echo Pulling base Docker images...
docker pull linuxserver/webtop:ubuntu-xfce

REM Build containers
echo Building containers...
docker-compose build --no-cache

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to build containers.
    echo Please check the error messages above.
    pause
    exit /b 1
)

REM Start containers
echo Starting containers...
docker-compose up -d

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start containers.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Waiting for Services to Start...
echo ==========================================
echo.

timeout /t 10 /nobreak >nul

REM Check container status
docker-compose ps

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo Your AI Ubuntu Agent is now running with:
echo.
echo Desktop Access:
echo   URL: http://localhost:%DESKTOP_PORT%
echo   Username: %DESKTOP_USER%
echo   Password: %DESKTOP_PASS%
echo.
echo Web Interface:
echo   URL: http://localhost:%WEB_PORT%
echo.
echo Agent API:
echo   URL: http://localhost:%AGENT_PORT%
if "%ENABLE_AUTH%"=="true" (
    echo   Username: %API_USERNAME%
    echo   Password: %API_PASSWORD%
)
echo.
if "%ENABLE_METRICS%"=="true" (
    echo Metrics:
    echo   URL: http://localhost:%METRICS_PORT%/metrics
    echo.
)
echo LLM Provider: %LLM_PROVIDER%
echo LLM Model: %LLM_MODEL%
echo.
echo ==========================================
echo   Quick Commands:
echo ==========================================
echo.
echo View logs:        docker-compose logs -f
echo Stop all:         docker-compose down
echo Restart all:      docker-compose restart
echo Check status:     docker-compose ps
echo.
echo Configuration saved in:
echo   - .env (main configuration)
echo   - docker-compose.override.yml (Docker overrides)
echo.
echo To reconfigure, run this script again.
echo.

REM Create a quick-start script
echo Creating quick-start.bat for future use...
(
    echo @echo off
    echo docker-compose up -d
    echo echo Containers started!
    echo docker-compose ps
) > quick-start.bat

REM Create a quick-stop script
echo Creating quick-stop.bat...
(
    echo @echo off
    echo docker-compose down
    echo echo Containers stopped!
) > quick-stop.bat

echo Helper scripts created: quick-start.bat and quick-stop.bat
echo.

pause