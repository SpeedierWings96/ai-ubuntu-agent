import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('desktop-api');

export class DesktopAPI {
  private baseUrl: string;
  
  constructor() {
    // Command server default port is 8090
    const host = process.env.DESKTOP_HOST || 'desktop';
    const port = process.env.DESKTOP_API_PORT || '8090';
    this.baseUrl = `http://${host}:${port}`;
  }
  
  async executeCommand(command: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      logger.debug(`Sending command to desktop: ${command}`);
      
      // Try to execute via HTTP API if available
      const response = await axios.post(`${this.baseUrl}/execute`, {
        command,
        timeout: 30000,
      }, {
        timeout: 35000,
        validateStatus: () => true,
      });
      
      if (response.status === 200) {
        return {
          success: true,
          output: response.data.output || response.data.stdout,
        };
      } else {
        return {
          success: false,
          error: response.data.error || `Command failed with status ${response.status}`,
        };
      }
    } catch (error: any) {
      // If API is not available, fall back to local execution
      logger.warn(`Desktop API not available, falling back to local execution: ${error.message}`);
      
      // Import exec utilities
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout, stderr } = await execAsync(command, {
          env: { ...process.env, DISPLAY: ':0' },
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        });
        
        return {
          success: true,
          output: stdout || stderr,
        };
      } catch (execError: any) {
        return {
          success: false,
          error: execError.message,
        };
      }
    }
  }
  
  async takeScreenshot(): Promise<{ success: boolean; image?: string; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/screenshot`, {
        timeout: 10000,
        validateStatus: () => true,
      });
      
      if (response.status === 200) {
        return {
          success: true,
          image: response.data.image,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to take screenshot',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Screenshot API error: ${error.message}`,
      };
    }
  }
}

export const desktopAPI = new DesktopAPI();