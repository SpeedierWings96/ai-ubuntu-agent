import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('desktop-tools');

export class DesktopTools {
  // Execute shell commands
  async executeCommand(command: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      logger.debug(`Executing command: ${command}`);
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      
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
      // Use a more cross-platform compatible approach
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'tasklist /fo csv' : 'ps aux --no-headers';
      const { stdout } = await execAsync(command);
      
      if (isWindows) {
        // Parse Windows tasklist CSV output
        const lines = stdout.trim().split('\n').slice(1); // Skip header
        const processes = lines.map(line => {
          const parts = line.split('","').map(p => p.replace(/"/g, ''));
          return {
            name: parts[0],
            pid: parseInt(parts[1]),
            sessionName: parts[2],
            sessionNum: parts[3],
            memUsage: parts[4],
          };
        });
        return { success: true, processes };
      } else {
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
        return { success: true, processes };
      }
    } catch (error: any) {
      logger.error(`Failed to list processes: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async killProcess(pid: number): Promise<{ success: boolean; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
      await execAsync(command);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to kill process: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // System information
  async getSystemInfo(): Promise<{ success: boolean; info?: any; error?: string }> {
    try {
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        // Windows system info
        const [hostname, meminfo] = await Promise.all([
          execAsync('hostname').then(r => r.stdout.trim()),
          execAsync('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value').then(r => r.stdout),
        ]);
        
        return {
          success: true,
          info: {
            hostname,
            memory: meminfo,
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
          },
        };
      } else {
        // Linux system info
        const [hostname, uptime, meminfo, cpuinfo, diskUsage] = await Promise.all([
          execAsync('hostname').then(r => r.stdout.trim()),
          execAsync('uptime').then(r => r.stdout.trim()),
          execAsync('free -h').then(r => r.stdout),
          execAsync('lscpu | head -20').then(r => r.stdout),
          execAsync('df -h').then(r => r.stdout),
        ]);
        
        return {
          success: true,
          info: {
            hostname,
            uptime,
            memory: meminfo,
            cpu: cpuinfo,
            disk: diskUsage,
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
          },
        };
      }
    } catch (error: any) {
      logger.error(`Failed to get system info: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Desktop interaction (requires xdotool in the desktop container)
  async screenshot(): Promise<{ success: boolean; image?: string; error?: string }> {
    try {
      const screenshotPath = '/tmp/screenshot.png';
      await execAsync(`DISPLAY=:0 scrot ${screenshotPath}`);
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
      await execAsync(`DISPLAY=:0 xdotool mousemove ${x} ${y} click ${buttonMap[button]}`);
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
      await execAsync(`DISPLAY=:0 xdotool type '${escapedText}'`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to type: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async key(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(`DISPLAY=:0 xdotool key ${key}`);
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
          await execAsync(`${launcher} &`);
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