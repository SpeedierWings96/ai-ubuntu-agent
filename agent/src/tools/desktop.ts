import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import axios from 'axios';

const execAsync = promisify(exec);
const logger = createLogger('desktop-tools');

export class DesktopTools {
  private desktopHost: string;
  private desktopPort: number;

  constructor() {
    // In Docker network, the desktop container is accessible by its service name
    this.desktopHost = process.env.DESKTOP_HOST || 'desktop';
    this.desktopPort = parseInt(process.env.DESKTOP_PORT || '8082');
  }

  // Helper to execute commands in the desktop container
  private async execInDesktop(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      // Check if we're running in Docker
      const inDocker = process.env.DOCKER_CONTAINER === 'true';
      
      if (inDocker) {
        // Execute command in desktop container using docker exec
        const dockerCommand = `docker exec ai-desktop bash -c "${command.replace(/"/g, '\\"')}"`;
        logger.debug(`Executing via docker: ${dockerCommand}`);
        return execAsync(dockerCommand, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
      } else {
        // Local development - execute directly
        return execAsync(command, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
      }
    } catch (error: any) {
      logger.error(`Failed to execute in desktop: ${error.message}`);
      throw error;
    }
  }

  // Execute shell commands
  async executeCommand(command: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      logger.debug(`Executing command: ${command}`);
      const { stdout, stderr } = await this.execInDesktop(command);
      
      return {
        success: true,
        output: stdout || stderr,
      };
    } catch (error: any) {
      logger.error(`Command execution failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // File system operations
  async listDirectory(dirPath: string = '/'): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      const fullPath = path.resolve(dirPath);
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      const files = await Promise.all(
        items.map(async (item) => {
          const itemPath = path.join(fullPath, item.name);
          try {
            const stats = await fs.stat(itemPath);
            return {
              name: item.name,
              path: itemPath,
              type: item.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime,
              permissions: stats.mode,
            };
          } catch {
            return {
              name: item.name,
              path: itemPath,
              type: item.isDirectory() ? 'directory' : 'file',
            };
          }
        })
      );
      
      return { success: true, files };
    } catch (error: any) {
      logger.error(`Failed to list directory: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const fullPath = path.resolve(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error: any) {
      logger.error(`Failed to read file: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.resolve(filePath);
      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to write file: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async createDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.resolve(dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to create directory: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async deleteItem(itemPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.resolve(itemPath);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to delete item: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Process management
  async listProcesses(): Promise<{ success: boolean; processes?: any[]; error?: string }> {
    try {
      const command = 'ps aux --no-headers';
      const { stdout } = await this.execInDesktop(command);
      
      // Parse Linux ps output
      const lines = stdout.trim().split('\n');
      const processes = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          pid: parseInt(parts[1]),
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          vsz: parseInt(parts[4]),
          rss: parseInt(parts[5]),
          tty: parts[6],
          stat: parts[7],
          start: parts[8],
          time: parts[9],
          command: parts.slice(10).join(' '),
        };
      });
      return { success: true, processes }
    } catch (error: any) {
      logger.error(`Failed to list processes: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async killProcess(pid: number): Promise<{ success: boolean; error?: string }> {
    try {
      const command = `kill -9 ${pid}`;
      await this.execInDesktop(command);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to kill process: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // System information
  async getSystemInfo(): Promise<{ success: boolean; info?: any; error?: string }> {
    try {
      // Execute all commands in desktop container
      const [hostname, uptime, meminfo, cpuinfo, diskUsage] = await Promise.all([
        this.execInDesktop('hostname').then(r => r.stdout.trim()),
        this.execInDesktop('uptime').then(r => r.stdout.trim()),
        this.execInDesktop('free -h').then(r => r.stdout),
        this.execInDesktop('lscpu | head -20').then(r => r.stdout),
        this.execInDesktop('df -h').then(r => r.stdout),
      ]);
      
      return {
        success: true,
        info: {
          hostname,
          uptime,
          memory: meminfo,
          cpu: cpuinfo,
          disk: diskUsage,
          platform: 'linux',
          arch: 'x86_64',
        },
      };
    } catch (error: any) {
      logger.error(`Failed to get system info: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Desktop interaction (uses import or xwd as fallback)
  async screenshot(): Promise<{ success: boolean; image?: string; error?: string }> {
    try {
      const screenshotPath = '/tmp/screenshot.png';
      
      // Try different screenshot methods
      const methods = [
        `DISPLAY=:0 import -window root ${screenshotPath}`,  // ImageMagick
        `DISPLAY=:0 xwd -root -silent | convert xwd:- ${screenshotPath}`,  // xwd + convert
        `DISPLAY=:0 gnome-screenshot -f ${screenshotPath}`,  // GNOME
        `DISPLAY=:0 scrot ${screenshotPath}`,  // scrot as fallback
      ];
      
      let success = false;
      let lastError = '';
      
      for (const method of methods) {
        try {
          await this.execInDesktop(method);
          success = true;
          break;
        } catch (err: any) {
          lastError = err.message;
          continue;
        }
      }
      
      if (!success) {
        throw new Error(`All screenshot methods failed. Last error: ${lastError}`);
      }
      
      const imageBuffer = await fs.readFile(screenshotPath);
      const base64Image = imageBuffer.toString('base64');
      await fs.unlink(screenshotPath).catch(() => {}); // Clean up
      
      return {
        success: true,
        image: base64Image,
      };
    } catch (error: any) {
      logger.error(`Failed to take screenshot: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async click(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<{ success: boolean; error?: string }> {
    try {
      const buttonMap = { left: 1, middle: 2, right: 3 };
      await this.execInDesktop(`DISPLAY=:0 xdotool mousemove ${x} ${y} click ${buttonMap[button]}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to click: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async type(text: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Escape special characters for xdotool
      const escapedText = text.replace(/'/g, "'\\''");
      await this.execInDesktop(`DISPLAY=:0 xdotool type '${escapedText}'`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to type: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async key(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.execInDesktop(`DISPLAY=:0 xdotool key ${key}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to press key: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async openApplication(appName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try common application launchers
      const launchers = [
        `DISPLAY=:0 ${appName}`,
        `DISPLAY=:0 xdg-open ${appName}`,
        `DISPLAY=:0 gtk-launch ${appName}`,
      ];
      
      for (const launcher of launchers) {
        try {
          await this.execInDesktop(`${launcher} &`);
          return { success: true };
        } catch {
          // Try next launcher
        }
      }
      
      throw new Error(`Could not open application: ${appName}`);
    } catch (error: any) {
      logger.error(`Failed to open application: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export const desktopTools = new DesktopTools();