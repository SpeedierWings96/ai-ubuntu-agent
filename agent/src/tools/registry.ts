import { createLogger } from '../utils/logger';
import { recordToolMetric } from '../utils/metrics';
import { z } from 'zod';
import { desktopTools } from './desktop';

const logger = createLogger('tool-registry');

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  execute: (params: any, context: ExecutionContext) => Promise<ToolResult>;
  validate?: (params: any) => ValidationResult;
}

export interface ExecutionContext {
  userId?: string;
  sessionId?: string;
  taskId?: string;
  approved?: boolean;
  timeout?: number;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private desktopConnected: boolean = false;
  private vncConnection: any = null;
  
  constructor() {
    this.registerBuiltinTools();
  }
  
  async initialize() {
    // Initialize VNC connection and other services
    await this.connectToDesktop();
  }
  
  private async connectToDesktop() {
    try {
      // TODO: Implement actual VNC connection
      // For now, we'll simulate the connection
      this.desktopConnected = true;
      logger.info('Connected to desktop environment');
    } catch (error) {
      logger.error('Failed to connect to desktop:', error);
      this.desktopConnected = false;
    }
  }
  
  isDesktopConnected(): boolean {
    return this.desktopConnected;
  }
  
  registerTool(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }
    
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }
  
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  
  getToolCount(): number {
    return this.tools.size;
  }
  
  getToolsForLLM() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      },
    }));
  }
  
  async executeTool(
    name: string,
    params: any,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(name);
    
    if (!tool) {
      const error = `Tool not found: ${name}`;
      logger.error(error);
      recordToolMetric(name, 'failure', (Date.now() - startTime) / 1000);
      return { success: false, error };
    }
    
    try {
      // Validate parameters
      const parseResult = tool.parameters.safeParse(params);
      if (!parseResult.success) {
        const error = `Invalid parameters: ${parseResult.error.message}`;
        logger.error(`Tool ${name} validation failed:`, error);
        recordToolMetric(name, 'failure', (Date.now() - startTime) / 1000);
        return { success: false, error };
      }
      
      // Custom validation if provided
      if (tool.validate) {
        const validationResult = tool.validate(parseResult.data);
        if (!validationResult.valid) {
          const error = `Validation failed: ${validationResult.errors?.join(', ')}`;
          logger.error(`Tool ${name} custom validation failed:`, error);
          recordToolMetric(name, 'failure', (Date.now() - startTime) / 1000);
          return { success: false, error };
        }
      }
      
      // Check if approval is required and not provided
      if (tool.requiresApproval && !context.approved) {
        const error = 'Tool requires approval';
        logger.warn(`Tool ${name} requires approval`);
        recordToolMetric(name, 'failure', (Date.now() - startTime) / 1000);
        return { success: false, error };
      }
      
      // Execute the tool
      logger.debug(`Executing tool ${name} with params:`, parseResult.data);
      const result = await tool.execute(parseResult.data, context);
      
      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      recordToolMetric(name, result.success ? 'success' : 'failure', duration);
      
      logger.debug(`Tool ${name} completed in ${duration}s`);
      return result;
      
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error(`Tool ${name} execution failed:`, error);
      recordToolMetric(name, 'failure', duration);
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
  
  private zodToJsonSchema(schema: z.ZodSchema<any>): any {
    // Convert Zod schema to JSON Schema for OpenAI function calling
    // This is a simplified conversion, you might want to use a library like zod-to-json-schema
    const zodType = (schema as any)._def;
    
    if (zodType.typeName === 'ZodObject') {
      const shape = zodType.shape();
      const properties: any = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodSchema<any>;
        const fieldDef = (fieldSchema as any)._def;
        
        properties[key] = this.zodTypeToJsonSchema(fieldDef);
        
        if (!fieldDef.isOptional) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    
    return { type: 'object' };
  }
  
  private zodTypeToJsonSchema(def: any): any {
    switch (def.typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToJsonSchema(def.type._def),
        };
      case 'ZodOptional':
        return this.zodTypeToJsonSchema(def.innerType._def);
      case 'ZodEnum':
        return {
          type: 'string',
          enum: def.values,
        };
      default:
        return { type: 'string' };
    }
  }
  
  private registerBuiltinTools() {
    // Register desktop control tools
    this.registerTool({
      name: 'screenshot',
      description: 'Capture a screenshot of the desktop',
      parameters: z.object({}),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async () => {
        const result = await desktopTools.screenshot();
        return {
          success: result.success,
          data: result.image ? { image: result.image, timestamp: new Date().toISOString() } : undefined,
          error: result.error,
        };
      },
    });
    
    this.registerTool({
      name: 'click',
      description: 'Click at specific coordinates on the desktop',
      parameters: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        button: z.enum(['left', 'right', 'middle']).default('left'),
      }),
      requiresApproval: false,
      riskLevel: 'medium',
      execute: async (params) => {
        const result = await desktopTools.click(params.x, params.y, params.button);
        return {
          success: result.success,
          data: result.success ? { clicked: true, ...params } : undefined,
          error: result.error,
        };
      },
    });
    
    this.registerTool({
      name: 'type',
      description: 'Type text using the keyboard',
      parameters: z.object({
        text: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'medium',
      execute: async (params) => {
        const result = await desktopTools.type(params.text);
        return {
          success: result.success,
          data: result.success ? { typed: params.text } : undefined,
          error: result.error,
        };
      },
    });
    
    this.registerTool({
      name: 'exec',
      description: 'Execute a shell command',
      parameters: z.object({
        command: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'high',
      execute: async (params) => {
        const result = await desktopTools.executeCommand(params.command);
        return {
          success: result.success,
          data: result.success ? { output: result.output } : undefined,
          error: result.error,
        };
      },
    });
    
    this.registerTool({
      name: 'wait',
      description: 'Wait for a specified duration',
      parameters: z.object({
        seconds: z.number().positive().max(60),
      }),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async (params) => {
        await new Promise(resolve => setTimeout(resolve, params.seconds * 1000));
        return {
          success: true,
          data: { waited: params.seconds },
        };
      },
    });

    // File system tools
    this.registerTool({
      name: 'listDirectory',
      description: 'List files and directories in a specified path',
      parameters: z.object({
        path: z.string().default('/'),
      }),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async (params) => {
        const result = await desktopTools.listDirectory(params.path);
        return {
          success: result.success,
          data: result.files,
          error: result.error,
        };
      },
    });

    this.registerTool({
      name: 'readFile',
      description: 'Read the contents of a file',
      parameters: z.object({
        path: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async (params) => {
        const result = await desktopTools.readFile(params.path);
        return {
          success: result.success,
          data: result.content ? { content: result.content } : undefined,
          error: result.error,
        };
      },
    });

    this.registerTool({
      name: 'writeFile',
      description: 'Write content to a file',
      parameters: z.object({
        path: z.string(),
        content: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'medium',
      execute: async (params) => {
        const result = await desktopTools.writeFile(params.path, params.content);
        return {
          success: result.success,
          error: result.error,
        };
      },
    });

    this.registerTool({
      name: 'createDirectory',
      description: 'Create a new directory',
      parameters: z.object({
        path: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async (params) => {
        const result = await desktopTools.createDirectory(params.path);
        return {
          success: result.success,
          error: result.error,
        };
      },
    });

    this.registerTool({
      name: 'deleteItem',
      description: 'Delete a file or directory',
      parameters: z.object({
        path: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'high',
      execute: async (params) => {
        const result = await desktopTools.deleteItem(params.path);
        return {
          success: result.success,
          error: result.error,
        };
      },
    });

    // Process management tools
    this.registerTool({
      name: 'listProcesses',
      description: 'List running processes',
      parameters: z.object({}),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async () => {
        const result = await desktopTools.listProcesses();
        return {
          success: result.success,
          data: result.processes,
          error: result.error,
        };
      },
    });

    this.registerTool({
      name: 'killProcess',
      description: 'Terminate a process by PID',
      parameters: z.object({
        pid: z.number().int().positive(),
      }),
      requiresApproval: false,
      riskLevel: 'high',
      execute: async (params) => {
        const result = await desktopTools.killProcess(params.pid);
        return {
          success: result.success,
          error: result.error,
        };
      },
    });

    // System info tool
    this.registerTool({
      name: 'getSystemInfo',
      description: 'Get system information',
      parameters: z.object({}),
      requiresApproval: false,
      riskLevel: 'low',
      execute: async () => {
        const result = await desktopTools.getSystemInfo();
        return {
          success: result.success,
          data: result.info,
          error: result.error,
        };
      },
    });

    // Keyboard shortcuts
    this.registerTool({
      name: 'key',
      description: 'Press a keyboard key or key combination (e.g., "Return", "ctrl+c", "alt+Tab")',
      parameters: z.object({
        key: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'medium',
      execute: async (params) => {
        const result = await desktopTools.key(params.key);
        return {
          success: result.success,
          error: result.error,
        };
      },
    });

    // Open application
    this.registerTool({
      name: 'openApplication',
      description: 'Open an application by name',
      parameters: z.object({
        appName: z.string(),
      }),
      requiresApproval: false,
      riskLevel: 'medium',
      execute: async (params) => {
        const result = await desktopTools.openApplication(params.appName);
        return {
          success: result.success,
          error: result.error,
        };
      },
    });
  }
  
  async cleanup() {
    // Cleanup VNC connection and other resources
    if (this.vncConnection) {
      // TODO: Close VNC connection
      this.vncConnection = null;
    }
    
    this.desktopConnected = false;
    logger.info('Tool registry cleaned up');
  }
}
