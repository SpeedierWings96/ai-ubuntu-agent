# 🤖 AI Ubuntu Desktop Agent

A **production-ready**, self-hosted AI desktop agent that provides an autonomous workspace with real-time observation and action capabilities through a browser-based interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![Docker](https://img.shields.io/badge/docker-%3E%3D20.10-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0-blue.svg)

## 🎯 Features

- **🖥️ Full Ubuntu Desktop** - Complete Ubuntu XFCE desktop environment running in an isolated Docker container, accessible via browser
- **🪟 Windows Compatible** - Runs on Windows (via Docker Desktop), macOS, or Linux - Ubuntu runs separately in a container, not on your host OS
- **🤖 AI-Powered Automation** - Autonomous task execution with OpenRouter LLM integration
- **🔍 Real-time Observation** - Watch the AI work through live VNC or screenshot mode
- **🛡️ Safe by Default** - Sandboxed environment with approval mechanisms for risky actions
- **🚀 One-Command Setup** - Get running in minutes with `./setup.sh`
- **📊 Comprehensive Monitoring** - Built-in metrics, logging, and health checks
- **🔌 Extensible Tool System** - Easy to add new capabilities
- **💬 Interactive Chat** - Natural language interface to control the agent
- **📱 Responsive Web UI** - Modern React interface with dark mode support

## 📋 Prerequisites

- **OS**: Windows 10/11, Linux, or macOS
- **Docker**: 
  - **Windows**: Docker Desktop for Windows (includes WSL2)
  - **Linux/macOS**: Docker Engine 20.10+
- **Docker Compose**: Version 2.0+ (included with Docker Desktop)
- **OpenRouter API Key**: Get one at [openrouter.ai/keys](https://openrouter.ai/keys)

## 🪟 Important: How It Works on Windows

**The Ubuntu desktop runs completely isolated in a Docker container**, separate from your Windows host OS. This means:
- ✅ Your Windows system is unaffected
- ✅ Ubuntu runs in its own containerized environment
- ✅ Access everything through your web browser
- ✅ No dual-boot or VM required
- ✅ Easy to remove (just delete containers)

📖 **For detailed Windows setup, see [docs/WINDOWS.md](docs/WINDOWS.md)**

## 🚀 Quick Start

### For Windows Users

```powershell
# 1. Install Docker Desktop for Windows (if not installed)
# Download from: https://www.docker.com/products/docker-desktop

# 2. Clone the repository
git clone https://github.com/yourusername/ai-ubuntu-agent.git
cd ai-ubuntu-agent

# 3. Run PowerShell setup script (as Administrator recommended)
.\setup.ps1

# Or for non-interactive setup
.\setup.ps1 -NonInteractive
```

### For Linux/macOS Users

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-ubuntu-agent.git
cd ai-ubuntu-agent

# Make setup script executable
chmod +x setup.sh

# Run interactive setup
./setup.sh
```

### Non-Interactive Setup (Linux/macOS)

```bash
# For automated deployments
./setup.sh --non-interactive
```

### Development Mode

```bash
# Run with hot reload for development
./setup.sh --dev  # Linux/macOS
.\setup.ps1 -Development  # Windows
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (copy from `env.example`):

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
DESKTOP_VNC_PASSWORD=changeme

# Optional - Model Configuration
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_MAX_TOKENS=4096
OPENROUTER_TEMPERATURE=0.7

# Optional - Ports
AGENT_PORT=9991
WEB_PORT=9992
DESKTOP_HTTP_PORT=6080

# Optional - Security
ENABLE_AUTH=false
AUTH_USERNAME=admin
AUTH_PASSWORD=admin
```

### Available Models

The agent supports any model available through OpenRouter:

- `anthropic/claude-3.5-sonnet` (Recommended)
- `openai/gpt-4o`
- `anthropic/claude-3-haiku`
- `google/gemini-pro`
- And many more...

## 🎮 Usage

### Web Interface

1. Open http://localhost:9992 in your browser
2. The interface has three main sections:
   - **Chat Panel** - Interact with the AI agent
   - **Desktop Viewer** - See the Ubuntu desktop
   - **Task List** - Track running and completed tasks

### Creating Tasks

#### Via Chat
```
"Open Firefox and search for AI news"
"Create a Python script that calculates fibonacci numbers"
"Install and configure nginx web server"
```

#### Via API
```bash
curl -X POST http://localhost:9991/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Open a terminal and check system resources"}'
```

### Desktop Control

The agent can:
- **Take screenshots** - Observe the current desktop state
- **Click** - Mouse interactions at specific coordinates
- **Type** - Keyboard input and shortcuts
- **Execute commands** - Run shell commands
- **Manage files** - Create, read, update, delete files
- **Control applications** - Open, close, and interact with programs

## 📁 Project Structure

```
ai-ubuntu-agent/
├── agent/          # TypeScript agent server
├── web/            # React web UI
├── desktop/        # Desktop container config
├── docs/           # Documentation
├── docker-compose.yml
├── setup.sh        # Installation script
├── .env.example    # Environment template
└── README.md
```

## 🔒 Security

### Sandboxing Layers

1. **Container Isolation** - No privileged mode, user namespaces
2. **Network Security** - Internal Docker network, rate limiting
3. **Execution Security** - Command validation, path traversal prevention
4. **Access Control** - Optional authentication, JWT sessions

### Approval System

High-risk actions require approval:
- Shell command execution
- File system modifications
- Network requests
- System configuration changes

## 🛠️ Development

### Running Locally

```bash
# Install dependencies
cd agent && npm install
cd ../web && npm install

# Start in development mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Running Tests

```bash
# Agent tests
cd agent && npm test

# Web tests
cd web && npm test
```

### Building from Source

```bash
# Build all containers
docker compose build

# Build specific service
docker compose build agent
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:9991/health
```

### Metrics (Prometheus Format)
```bash
curl http://localhost:9090/metrics
```

### Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f agent
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to Docker" | Run `sudo usermod -aG docker $USER` and re-login |
| "Port already in use" | Change ports in `.env` file |
| "VNC connection refused" | Wait 30s for desktop to fully start |
| "API key invalid" | Check your OpenRouter API key in `.env` |
| "Out of memory" | Increase Docker memory limit in Docker Desktop settings |

## 📚 API Documentation

### Core Endpoints

- `POST /api/chat` - Send chat message
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task status
- `GET /api/tools` - List available tools
- `GET /api/desktop/screenshot` - Capture screenshot
- `WS /socket.io` - WebSocket connection

See [docs/API.md](docs/API.md) for complete API documentation.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [LinuxServer.io](https://www.linuxserver.io/) for the excellent webtop image
- [OpenRouter](https://openrouter.ai/) for unified LLM API access
- [noVNC](https://novnc.com/) for browser-based VNC client

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-ubuntu-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-ubuntu-agent/discussions)
- **Documentation**: [docs/](docs/)

## 🗺️ Roadmap

- [ ] Multi-agent collaboration
- [ ] Persistent memory/learning
- [ ] Plugin system for custom tools
- [ ] Voice control integration
- [ ] Computer vision capabilities
- [ ] Kubernetes deployment
- [ ] Cloud deployment options

---

Made with ❤️ by the AI Ubuntu Agent Team
