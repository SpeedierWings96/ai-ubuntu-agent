# 🏗️ System Architecture

## Container-Based Isolation

The AI Ubuntu Agent uses **Docker containerization** to run a complete Ubuntu desktop environment that is **100% isolated from your host operating system**.

## How It Works

### Three-Container Architecture

```
Your Host OS (Windows/Mac/Linux)
    │
    ├── Docker Engine/Desktop
    │       │
    │       ├── Container 1: Ubuntu Desktop (linuxserver/webtop)
    │       │   ├── Full Ubuntu XFCE Desktop
    │       │   ├── VNC Server (port 5900)
    │       │   ├── noVNC Web Server (port 6080)
    │       │   └── Isolated filesystem at /workspace
    │       │
    │       ├── Container 2: AI Agent Server
    │       │   ├── Node.js/TypeScript application
    │       │   ├── OpenRouter LLM integration
    │       │   ├── WebSocket server
    │       │   ├── Tool execution engine
    │       │   └── Connects to Ubuntu via VNC protocol
    │       │
    │       └── Container 3: Web UI
    │           ├── React application
    │           ├── Real-time WebSocket client
    │           └── Nginx web server (port 9992)
    │
    └── Your Web Browser
        ├── Accesses Web UI at localhost:9992
        └── Shows Ubuntu desktop via iframe to localhost:6080
```

## Key Isolation Points

### 1. Operating System Isolation

- **Ubuntu runs in a container**, not on your host
- **No kernel sharing** between Ubuntu and Windows (WSL2 provides Linux kernel)
- **Completely separate process space**
- **Independent network stack**

### 2. Filesystem Isolation

```
Host Filesystem                  Container Filesystem
C:\ (Windows)          ←X→      /workspace (Ubuntu)
/Users (macOS)         ←X→      /home (Ubuntu)
/home (Linux host)     ←X→      /root (Ubuntu)

X = No access by default
```

### 3. Network Isolation

- Containers communicate via internal Docker network
- Only exposed ports are accessible from host:
  - `9992` → Web UI
  - `6080` → Desktop viewer
  - `9991` → Agent API
  - `9090` → Metrics

### 4. Resource Isolation

- **CPU**: Limited by Docker resource constraints
- **Memory**: Confined to allocated container memory
- **Disk**: Uses Docker volumes, separate from host filesystem

## What the AI Agent Can and Cannot Do

### ✅ CAN DO (Inside Container)

- Control the Ubuntu desktop
- Execute commands in Ubuntu
- Create/modify files in `/workspace`
- Install Ubuntu packages
- Browse the internet from Ubuntu
- Run any Linux application

### ❌ CANNOT DO (Blocked by Design)

- Access host OS files
- Execute commands on host OS
- See host OS processes
- Modify host system settings
- Access host network services (unless exposed)
- Break out of container isolation

## Security Boundaries

### Level 1: Container Isolation
- Docker/OCI runtime isolation
- Namespace separation
- Cgroup resource limits
- Seccomp profiles

### Level 2: Network Isolation
- Internal Docker network
- No host network access
- Firewall rules

### Level 3: Application Security
- Tool approval system
- Command validation
- Rate limiting
- Authentication (optional)

## Data Persistence

Data is stored in Docker volumes, which are:
- **Isolated from host filesystem**
- **Managed by Docker**
- **Persistent across container restarts**
- **Deletable with `docker compose down -v`**

```
Docker Volumes:
├── desktop-config     → Ubuntu desktop settings
├── desktop-workspace  → Ubuntu /workspace directory
└── agent-data        → Agent database and logs
```

## Windows-Specific Architecture

On Windows, an additional layer exists:

```
Windows Host
    └── WSL2 (Windows Subsystem for Linux)
        └── Docker Desktop Backend
            └── Docker Containers
                ├── Ubuntu Desktop
                ├── Agent
                └── Web UI
```

This means:
- Ubuntu container runs in WSL2's Linux environment
- Double isolation: WSL2 + Docker
- No direct Windows access whatsoever

## Removal is Clean and Complete

To completely remove the system:

```bash
# Stop and remove all containers
docker compose down -v

# Remove Docker images
docker rmi linuxserver/webtop:ubuntu-xfce

# Delete project directory
rm -rf ai-ubuntu-agent  # Linux/Mac
# OR
Remove-Item -Recurse -Force ai-ubuntu-agent  # Windows
```

**Your host OS remains exactly as it was before installation.**

## Why This Architecture?

### Safety
- **Complete isolation** from host OS
- **No risk** to your main system
- **Sandboxed** AI operations

### Portability
- **Same behavior** on Windows, Mac, Linux
- **No OS-specific code**
- **Easy deployment**

### Simplicity
- **One command** setup
- **No complex VM configuration**
- **Browser-based access**

### Performance
- **Lighter than traditional VMs**
- **Shared kernel efficiency** (Linux/WSL2)
- **Optimized container images**

## Network Flow

```
1. User → Browser → localhost:9992 (Web UI)
2. Web UI → WebSocket → localhost:9991 (Agent)
3. Agent → VNC Protocol → Container Network → Ubuntu Desktop
4. Agent → OpenRouter API → Internet (LLM)
5. Ubuntu Desktop → noVNC → localhost:6080 → Browser iframe
```

## FAQ

**Q: Is this a virtual machine?**
A: No, it's containerization. More efficient than VMs but same isolation benefits.

**Q: Can malware in the container affect my host?**
A: No, container isolation prevents this. The container has no access to your host OS.

**Q: What if I accidentally run `rm -rf /` in the container?**
A: It would only affect the Ubuntu container, not your host. Just rebuild the container.

**Q: Can I mount my host files into the container?**
A: Technically yes, but not recommended for security. The system works without any host mounts.

**Q: How is this different from WSL2 alone?**
A: WSL2 provides a Linux kernel on Windows. Our containers run inside Docker on top of WSL2, providing additional isolation.
