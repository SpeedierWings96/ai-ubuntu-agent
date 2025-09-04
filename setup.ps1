# AI Ubuntu Agent Setup Script for Windows
# Run this in PowerShell as Administrator

param(
    [switch]$NonInteractive = $false,
    [switch]$SkipDockerCheck = $false,
    [switch]$Development = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Banner
function Show-Banner {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host "   🤖 AI Ubuntu Agent Setup for Windows  " -ForegroundColor Blue
    Write-Host "==========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Info "This will set up a completely isolated Ubuntu desktop"
    Write-Info "running in a Docker container on your Windows machine."
    Write-Host ""
}

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check Docker Desktop
function Test-Docker {
    if ($SkipDockerCheck) {
        Write-Warning "Skipping Docker check"
        return
    }

    Write-Info "Checking Docker Desktop installation..."
    
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Success "✓ Docker is installed: $dockerVersion"
            
            # Check if Docker is running
            docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Docker Desktop is installed but not running."
                Write-Info "Please start Docker Desktop and wait for it to be ready."
                
                if (-not $NonInteractive) {
                    Read-Host "Press Enter when Docker Desktop is running"
                    
                    # Check again
                    docker info 2>&1 | Out-Null
                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker Desktop is still not running"
                    }
                }
                else {
                    throw "Docker Desktop is not running"
                }
            }
            
            Write-Success "✓ Docker Desktop is running"
            
            # Check for WSL2
            Write-Info "Checking WSL2..."
            $wslVersion = wsl --status 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✓ WSL2 is installed"
            }
            else {
                Write-Warning "WSL2 might not be properly configured"
                Write-Info "Docker Desktop should have set this up automatically"
            }
        }
    }
    catch {
        Write-Error "Docker Desktop is not installed or not accessible"
        Write-Info ""
        Write-Info "Please install Docker Desktop for Windows:"
        Write-Info "1. Download from: https://www.docker.com/products/docker-desktop"
        Write-Info "2. Run the installer"
        Write-Info "3. Restart your computer"
        Write-Info "4. Start Docker Desktop"
        Write-Info "5. Run this setup script again"
        Write-Info ""
        Write-Info "Docker Desktop will automatically set up WSL2 for you."
        exit 1
    }
}

# Create .env file
function New-EnvFile {
    Write-Info "Setting up environment configuration..."
    
    if (Test-Path .env) {
        Write-Warning ".env file already exists"
        
        if (-not $NonInteractive) {
            $backup = Read-Host "Backup existing .env file? (y/n)"
            if ($backup -eq 'y') {
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                Copy-Item .env ".env.backup.$timestamp"
                Write-Success "Backed up existing .env file"
            }
        }
        else {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            Copy-Item .env ".env.backup.$timestamp"
        }
    }
    
    # Copy template
    if (Test-Path env.example) {
        Copy-Item env.example .env
    }
    else {
        Write-Error "env.example file not found"
        exit 1
    }
    
    if (-not $NonInteractive) {
        Write-Host ""
        Write-Info "OpenRouter API key is required for AI functionality"
        Write-Info "Get your API key from: https://openrouter.ai/keys"
        $apiKey = Read-Host "Enter your OpenRouter API Key"
        
        if ($apiKey) {
            $content = Get-Content .env -Raw
            $content = $content -replace 'OPENROUTER_API_KEY=.*', "OPENROUTER_API_KEY=$apiKey"
            Set-Content .env $content -NoNewline
        }
        else {
            Write-Warning "No API key provided. You'll need to update .env manually."
        }
        
        Write-Host ""
        $vncPass = Read-Host "Enter VNC Password (press Enter for default changeme)"
        if (-not $vncPass) { $vncPass = "changeme" }
        
        $content = Get-Content .env -Raw
        $content = $content -replace "DESKTOP_VNC_PASSWORD=.*", "DESKTOP_VNC_PASSWORD=$vncPass"
        Set-Content .env $content -NoNewline
    }
    
    Write-Success "✓ Environment configuration complete"
}

# Create required directories
function New-Directories {
    Write-Info "Creating required directories..."
    
    $dirs = @(
        "data",
        "data\agent",
        "data\desktop", 
        "data\web",
        "data\logs"
    )
    
    foreach ($dir in $dirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Success "✓ Directories created"
}

# Pull Docker images
function Get-DockerImages {
    Write-Info "Pulling Docker images (this may take a few minutes)..."
    
    docker pull linuxserver/webtop:ubuntu-xfce
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to pull Docker images"
    }
    
    Write-Success "✓ Docker images pulled"
}

# Build and start services
function Start-Services {
    Write-Info "Building and starting services..."
    
    if ($Development) {
        Write-Info "Starting in development mode..."
        docker compose -f docker-compose.yml up --build
    }
    else {
        Write-Info "Building containers..."
        docker compose build
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build containers"
        }
        
        Write-Info "Starting services in background..."
        docker compose up -d
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to start services"
        }
        
        Write-Success "✓ Services started"
        
        # Wait for services to be healthy
        Write-Info "Waiting for services to be ready..."
        Start-Sleep -Seconds 10
        
        $maxAttempts = 30
        $attempt = 0
        
        while ($attempt -lt $maxAttempts) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:9991/health" -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) {
                    Write-Success "✓ Agent service is ready"
                    break
                }
            }
            catch {
                $attempt++
                if ($attempt -eq $maxAttempts) {
                    Write-Warning "Services are taking longer than expected to start"
                    Write-Info "Check logs with: docker compose logs"
                }
                else {
                    Write-Host "." -NoNewline
                    Start-Sleep -Seconds 2
                }
            }
        }
    }
}

# Show final status
function Show-Status {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Success "   ✅ Setup Complete!"
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Info "The Ubuntu desktop is running in an isolated Docker container."
    Write-Info "Your Windows system is completely separate and unaffected."
    Write-Host ""
    Write-Success "Services are available at:"
    Write-Host "  • Web UI:        " -NoNewline; Write-Host "http://localhost:9992" -ForegroundColor Cyan
    Write-Host "  • Ubuntu Desktop: " -NoNewline; Write-Host "http://localhost:6080" -ForegroundColor Cyan
    Write-Host "  • Agent API:     " -NoNewline; Write-Host "http://localhost:9991" -ForegroundColor Cyan
    Write-Host "  • Metrics:       " -NoNewline; Write-Host "http://localhost:9090/metrics" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "Useful commands:"
    Write-Host "  • View logs:     docker compose logs -f"
    Write-Host "  • Stop services: docker compose down"
    Write-Host "  • Restart:       docker compose restart"
    Write-Host "  • Remove all:    docker compose down -v"
    Write-Host ""
    Write-Warning "Remember to configure your OpenRouter API key in .env if not done!"
    Write-Host ""
    Write-Success "Open http://localhost:9992 in your browser to get started!"
    Write-Host ""
}

# Main execution
function Main {
    Show-Banner
    
    # Check if running as admin (recommended but not required)
    if (-not (Test-Administrator)) {
        Write-Warning "Not running as Administrator"
        Write-Info "Some Docker operations may work better with admin privileges"
        Write-Host ""
    }
    
    try {
        Test-Docker
        New-EnvFile
        New-Directories
        Get-DockerImages
        Start-Services
        Show-Status
    }
    catch {
        Write-Error "Setup failed: $_"
        Write-Info "Cleaning up..."
        docker compose down 2>$null
        exit 1
    }
}

# Run main function
Main
