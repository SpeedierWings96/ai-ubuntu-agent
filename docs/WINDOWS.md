# 🪟 Running AI Ubuntu Agent on Windows

## Overview

The AI Ubuntu Agent runs a **complete Ubuntu desktop environment inside a Docker container** on your Windows machine. This means:

- **Your Windows OS is completely unaffected** - Ubuntu runs isolated in a container
- **No dual-boot or traditional VM needed** - Docker handles everything
- **Access via web browser** - No special software required beyond Docker
- **Easy to remove** - Just stop and delete the Docker containers

## Architecture on Windows

```
┌──────────────────────────────────────────┐
│          Your Windows Host OS            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │     Docker Desktop for Windows     │  │
│  │         (Using WSL2 Backend)       │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │   Ubuntu Desktop Container   │  │  │
│  │  │   (Isolated Environment)     │  │  │
│  │  │   - Full Ubuntu XFCE Desktop │  │  │
│  │  │   - Runs independently       │  │  │
│  │  │   - No access to Windows     │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │     Agent Container          │  │  │
│  │  │   - Controls Ubuntu Desktop  │  │  │
│  │  │   - Runs AI automation      │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │      Web UI Container        │  │  │
│  │  │   - React interface          │  │  │
│  │  │   - Accessed via browser     │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Your Browser: http://localhost:9992     │
└──────────────────────────────────────────┘
```

## Prerequisites

### 1. System Requirements

- **Windows 10** version 2004 or higher (Build 19041 or higher)
- **Windows 11** (any version)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 20GB free space
- **CPU**: Virtualization enabled in BIOS

### 2. Enable Virtualization

Check if virtualization is enabled:
1. Open Task Manager (Ctrl+Shift+Esc)
2. Go to Performance tab
3. Select CPU
4. Check "Virtualization: Enabled"

If not enabled, you need to enable it in BIOS/UEFI settings.

### 3. Install Docker Desktop

1. Download Docker Desktop for Windows from [docker.com](https://www.docker.com/products/docker-desktop)
2. Run the installer
3. During installation, ensure "Use WSL 2 instead of Hyper-V" is selected
4. Restart your computer when prompted
5. Start Docker Desktop and wait for it to be ready

Docker Desktop automatically installs and configures WSL2 for you.

## Installation Steps

### Step 1: Clone the Repository

Open PowerShell or Windows Terminal and run:

```powershell
git clone https://github.com/SpeedierWings96/ai-ubuntu-agent.git
cd ai-ubuntu-agent
```

### Step 2: Run Setup Script

Run the PowerShell setup script:

```powershell
# Run as Administrator (recommended)
.\setup.ps1

# Or with options
.\setup.ps1 -NonInteractive  # Skip prompts
.\setup.ps1 -Development      # Development mode
```

### Step 3: Configure API Key

During setup, you'll be prompted for:
1. **OpenRouter API Key** - Get from [openrouter.ai/keys](https://openrouter.ai/keys)
2. **VNC Password** - For desktop access (default: changeme)

### Step 4: Access the System

Once setup completes, access the services:

- **Web UI**: http://localhost:9992
- **Ubuntu Desktop**: http://localhost:6080
- **API**: http://localhost:9991

## Common Windows-Specific Issues

### Issue: "Docker Desktop - WSL 2 installation is incomplete"

**Solution**:
1. Open PowerShell as Administrator
2. Run: `wsl --update`
3. Run: `wsl --set-default-version 2`
4. Restart Docker Desktop

### Issue: "Cannot connect to Docker daemon"

**Solution**:
1. Ensure Docker Desktop is running (check system tray)
2. Wait for Docker to fully start (can take 1-2 minutes)
3. Try running PowerShell as Administrator

### Issue: "Ports already in use"

**Solution**:
1. Check what's using the ports:
   ```powershell
   netstat -ano | findstr :9992
   netstat -ano | findstr :6080
   netstat -ano | findstr :9991
   ```
2. Either stop the conflicting service or change ports in `.env`

### Issue: "VirtualizationFirmwareEnabled is false"

**Solution**:
1. Enable virtualization in BIOS/UEFI
2. For Hyper-V conflicts, run:
   ```powershell
   bcdedit /set hypervisorlaunchtype off
   ```
3. Restart computer

### Issue: Performance Issues

**Solution**:
1. Allocate more resources in Docker Desktop:
   - Settings → Resources → Advanced
   - Increase CPUs and Memory
2. Ensure Windows Power Plan is set to "High Performance"
3. Disable Windows Defender real-time scanning for Docker folders

## Docker Desktop Settings for Optimal Performance

1. Open Docker Desktop Settings
2. Go to **Resources** → **Advanced**:
   - **CPUs**: Allocate at least 4 CPUs
   - **Memory**: Allocate at least 6GB
   - **Swap**: 2GB
   - **Disk image size**: 60GB

3. Go to **Resources** → **WSL Integration**:
   - Enable integration with your default WSL2 distro

4. Go to **Docker Engine**:
   - Add to daemon.json:
   ```json
   {
     "features": {
       "buildkit": true
     },
     "max-concurrent-downloads": 10,
     "max-concurrent-uploads": 5
   }
   ```

## Using the System

### Starting the Services

```powershell
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Accessing Ubuntu Desktop

1. Open browser to http://localhost:6080
2. Click "Connect"
3. Enter VNC password when prompted
4. You now have full Ubuntu desktop access

### Managing Data

All data is stored in Docker volumes and the `data/` directory:
- `data/agent/` - Agent data and logs
- `data/desktop/` - Desktop configuration
- `data/web/` - Web UI data

To completely reset:
```powershell
docker compose down -v
Remove-Item -Recurse -Force data
.\setup.ps1
```

## Security Notes

### Container Isolation

- The Ubuntu container has **no access to your Windows files** unless explicitly mounted
- Network isolation prevents containers from accessing Windows services
- All actions happen within the containerized Ubuntu environment

### Safe Removal

To completely remove the system:

```powershell
# Stop and remove containers
docker compose down -v

# Remove images
docker rmi linuxserver/webtop:ubuntu-xfce
docker rmi ai-ubuntu-agent/agent
docker rmi ai-ubuntu-agent/web

# Delete project folder
cd ..
Remove-Item -Recurse -Force ai-ubuntu-agent
```

Your Windows system remains completely unchanged.

## Tips for Windows Users

### Using Windows Terminal

For better experience, use Windows Terminal:
1. Install from Microsoft Store
2. Set PowerShell as default profile
3. Enable "Use Acrylic" for transparency

### File Transfers

To transfer files between Windows and Ubuntu container:

```powershell
# Copy file to container
docker cp myfile.txt ai-desktop:/workspace/

# Copy from container
docker cp ai-desktop:/workspace/result.txt .
```

### Firewall Configuration

If Windows Firewall blocks access:
1. Windows Security → Firewall & network protection
2. Allow an app → Docker Desktop
3. Check both Private and Public networks

### Antivirus Exceptions

Add Docker directories to antivirus exceptions:
- `C:\ProgramData\Docker`
- `C:\Program Files\Docker`
- Your project directory

## FAQ

**Q: Will this affect my Windows installation?**
A: No, everything runs in isolated Docker containers. Your Windows system remains untouched.

**Q: Can I access Windows files from Ubuntu?**
A: No, by default the Ubuntu container is isolated. You must explicitly mount Windows directories if needed.

**Q: How much disk space does this use?**
A: Approximately 5-10GB for the containers and images, plus any data you create.

**Q: Can I run this alongside WSL2?**
A: Yes, Docker Desktop uses WSL2 as its backend, so they work together seamlessly.

**Q: Is this like running a VM?**
A: Similar concept but more efficient. Docker containers share the host kernel through WSL2, using fewer resources than a traditional VM.

**Q: Can the AI agent access my Windows files?**
A: No, the AI agent only operates within the containerized Ubuntu environment unless you explicitly mount Windows directories (not recommended for security).
