#!/bin/bash

# AI Ubuntu Agent Setup Script
# Enhanced setup with better error handling and options

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
INSTALL_DIR="${PWD}"
NON_INTERACTIVE=false
SKIP_DOCKER_CHECK=false
DEVELOPMENT_MODE=false
VERBOSE=false

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

show_help() {
    cat << EOF
AI Ubuntu Agent Setup Script

Usage: ./setup.sh [OPTIONS]

Options:
    -h, --help              Show this help message
    -n, --non-interactive   Run without prompts (use defaults)
    -s, --skip-docker       Skip Docker installation check
    -d, --dev               Run in development mode
    -v, --verbose           Verbose output
    --dir PATH              Installation directory (default: current directory)

Examples:
    ./setup.sh                  # Interactive setup
    ./setup.sh -n               # Non-interactive with defaults
    ./setup.sh -d               # Development mode with hot reload
    ./setup.sh --dir /opt/agent # Install in specific directory

EOF
}

check_requirements() {
    log "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        warning "Windows detected. Please use WSL2 for best compatibility."
    fi
    
    # Check for required commands
    local missing_deps=()
    
    for cmd in curl git; do
        if ! command -v $cmd &> /dev/null; then
            missing_deps+=($cmd)
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        info "Please install missing dependencies and try again."
        exit 1
    fi
    
    log "System requirements satisfied ✓"
}

check_docker() {
    if [[ "$SKIP_DOCKER_CHECK" == true ]]; then
        warning "Skipping Docker check"
        return
    fi
    
    log "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        warning "Docker not found. Installing Docker..."
        
        if [[ "$NON_INTERACTIVE" == true ]]; then
            curl -fsSL https://get.docker.com | sh
        else
            read -p "Docker is not installed. Install now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                curl -fsSL https://get.docker.com | sh
                
                # Add user to docker group
                if [[ -n "${SUDO_USER:-}" ]]; then
                    usermod -aG docker $SUDO_USER
                    info "Added $SUDO_USER to docker group. Please log out and back in."
                fi
            else
                error "Docker is required to run this application"
                exit 1
            fi
        fi
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        if ! docker-compose version &> /dev/null; then
            error "Docker Compose is not installed"
            exit 1
        fi
        warning "Using legacy docker-compose command"
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        DOCKER_COMPOSE_CMD="docker compose"
    fi
    
    log "Docker is installed and running ✓"
}

create_env_file() {
    log "Setting up environment configuration..."
    
    if [[ -f .env ]]; then
        warning ".env file already exists"
        if [[ "$NON_INTERACTIVE" == false ]]; then
            read -p "Backup existing .env file? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
                log "Backed up existing .env file"
            fi
        else
            cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        fi
    fi
    
    # Copy template
    if [[ -f env.example ]]; then
        cp env.example .env
    else
        error "env.example file not found"
        exit 1
    fi
    
    # Configure API key
    if [[ "$NON_INTERACTIVE" == false ]]; then
        echo
        info "OpenRouter API key is required for LLM functionality"
        info "Get your API key from: https://openrouter.ai/keys"
        read -p "Enter your OpenRouter API Key: " api_key
        
        if [[ -n "$api_key" ]]; then
            # Use | as delimiter since API keys might contain /
            sed -i.bak "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$api_key|" .env
            rm -f .env.bak
        else
            warning "No API key provided. You'll need to update .env manually."
        fi
        
        echo
        read -p "Enter VNC Password (press Enter for default 'changeme'): " vnc_pass
        vnc_pass=${vnc_pass:-changeme}
        sed -i.bak "s|DESKTOP_VNC_PASSWORD=.*|DESKTOP_VNC_PASSWORD=$vnc_pass|" .env
        rm -f .env.bak
        
        echo
        info "Would you like to configure advanced settings?"
        read -p "Configure advanced settings? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            configure_advanced_settings
        fi
    fi
    
    log "Environment configuration complete ✓"
}

configure_advanced_settings() {
    echo
    info "Advanced Configuration"
    echo "------------------------"
    
    read -p "Enable authentication? (y/n) [n]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sed -i.bak "s|ENABLE_AUTH=.*|ENABLE_AUTH=true|" .env
        
        read -p "Username [admin]: " auth_user
        auth_user=${auth_user:-admin}
        sed -i.bak "s|AUTH_USERNAME=.*|AUTH_USERNAME=$auth_user|" .env
        
        read -sp "Password: " auth_pass
        echo
        if [[ -n "$auth_pass" ]]; then
            sed -i.bak "s|AUTH_PASSWORD=.*|AUTH_PASSWORD=$auth_pass|" .env
        fi
        rm -f .env.bak
    fi
    
    read -p "Agent port [9991]: " agent_port
    if [[ -n "$agent_port" ]]; then
        sed -i.bak "s|AGENT_PORT=.*|AGENT_PORT=$agent_port|" .env
    fi
    
    read -p "Web UI port [9992]: " web_port
    if [[ -n "$web_port" ]]; then
        sed -i.bak "s|WEB_PORT=.*|WEB_PORT=$web_port|" .env
    fi
    
    read -p "Desktop VNC port [6080]: " desktop_port
    if [[ -n "$desktop_port" ]]; then
        sed -i.bak "s|DESKTOP_HTTP_PORT=.*|DESKTOP_HTTP_PORT=$desktop_port|" .env
    fi
    
    rm -f .env.bak
}

setup_directories() {
    log "Creating required directories..."
    
    mkdir -p data/{agent,desktop,web}
    mkdir -p data/logs
    
    # Set permissions
    chmod 755 data/*
    
    log "Directories created ✓"
}

pull_images() {
    log "Pulling Docker images..."
    
    if [[ "$VERBOSE" == true ]]; then
        docker pull linuxserver/webtop:ubuntu-xfce
    else
        docker pull linuxserver/webtop:ubuntu-xfce > /dev/null 2>&1
    fi
    
    log "Docker images pulled ✓"
}

build_and_start() {
    log "Building and starting services..."
    
    if [[ "$DEVELOPMENT_MODE" == true ]]; then
        info "Starting in development mode with hot reload..."
        
        # Create docker-compose.dev.yml if it doesn't exist
        if [[ ! -f docker-compose.dev.yml ]]; then
            create_dev_compose
        fi
        
        $DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml up --build
    else
        info "Building containers..."
        
        if [[ "$VERBOSE" == true ]]; then
            $DOCKER_COMPOSE_CMD build
        else
            $DOCKER_COMPOSE_CMD build --quiet
        fi
        
        info "Starting services in background..."
        $DOCKER_COMPOSE_CMD up -d
        
        # Wait for services to be healthy
        wait_for_services
    fi
}

create_dev_compose() {
    cat > docker-compose.dev.yml << 'EOF'
version: '3.9'

services:
  agent:
    build:
      context: ./agent
      target: development
    volumes:
      - ./agent/src:/app/src
      - ./agent/node_modules:/app/node_modules
    command: npm run dev
    environment:
      - NODE_ENV=development

  web:
    build:
      context: ./web
      target: development
    volumes:
      - ./web/src:/app/src
      - ./web/node_modules:/app/node_modules
    command: npm run dev
    environment:
      - NODE_ENV=development
EOF
}

wait_for_services() {
    log "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:${AGENT_PORT:-9991}/health > /dev/null 2>&1; then
            log "Agent service is ready ✓"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            error "Services failed to start. Check logs with: docker compose logs"
            exit 1
        fi
        
        sleep 2
        echo -n "."
    done
    echo
}

show_status() {
    echo
    echo "=========================================="
    echo -e "${GREEN}✅ AI Ubuntu Agent Setup Complete!${NC}"
    echo "=========================================="
    echo
    echo "Services are running at:"
    echo -e "  • Web UI:        ${BLUE}http://localhost:${WEB_PORT:-9992}${NC}"
    echo -e "  • Desktop (VNC): ${BLUE}http://localhost:${DESKTOP_HTTP_PORT:-6080}${NC}"
    echo -e "  • Agent API:     ${BLUE}http://localhost:${AGENT_PORT:-9991}${NC}"
    echo -e "  • Metrics:       ${BLUE}http://localhost:${METRICS_PORT:-9090}/metrics${NC}"
    echo
    echo "Useful commands:"
    echo "  • View logs:     docker compose logs -f"
    echo "  • Stop services: docker compose down"
    echo "  • Restart:       docker compose restart"
    echo "  • Update:        git pull && docker compose up -d --build"
    echo
    
    if [[ -f .env ]]; then
        source .env
        if [[ "$ENABLE_AUTH" == "true" ]]; then
            echo "Authentication is enabled"
            echo "  Username: ${AUTH_USERNAME:-admin}"
            echo
        fi
    fi
    
    warning "Remember to configure your OpenRouter API key in .env if not done already!"
    echo
}

cleanup_on_error() {
    error "Setup failed. Cleaning up..."
    $DOCKER_COMPOSE_CMD down 2>/dev/null || true
    exit 1
}

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        -n|--non-interactive) NON_INTERACTIVE=true ;;
        -s|--skip-docker) SKIP_DOCKER_CHECK=true ;;
        -d|--dev) DEVELOPMENT_MODE=true ;;
        -v|--verbose) VERBOSE=true ;;
        --dir) INSTALL_DIR="$2"; shift ;;
        *) error "Unknown option: $1"; show_help; exit 1 ;;
    esac
    shift
done

# Main execution
main() {
    clear
    echo "=========================================="
    echo -e "${BLUE}🤖 AI Ubuntu Agent Setup${NC}"
    echo "=========================================="
    echo
    
    # Set trap for cleanup on error
    trap cleanup_on_error ERR
    
    # Change to installation directory
    cd "$INSTALL_DIR"
    
    # Run setup steps
    check_requirements
    check_docker
    create_env_file
    setup_directories
    pull_images
    build_and_start
    
    # Show final status
    show_status
    
    log "Setup completed successfully!"
}

# Run main function
main
