import { Express, Request, Response, NextFunction } from 'express';
import { LLMClient } from '../llm/client';
import { ToolRegistry } from '../tools/registry';
import { Planner } from '../planner/react';
import { createLogger } from '../utils/logger';
import { httpMetricsMiddleware } from '../utils/metrics';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const logger = createLogger('api-routes');

// Request schemas
const chatRequestSchema = z.object({
  message: z.string().min(1),
  context: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  stream: z.boolean().default(false),
});

const taskRequestSchema = z.object({
  instruction: z.string().min(1),
  context: z.record(z.any()).optional(),
  constraints: z.array(z.string()).optional(),
  timeout: z.number().positive().optional(),
});

const approvalRequestSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

// Rate limiter
const createRateLimiter = (windowMs: number = 60000, max: number = 60) =>
  rateLimit({
    windowMs,
    max,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

// Authentication middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  if (!config.enableAuth) {
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, config.jwtSecret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = user;
    next();
  });
  return;
};

// Request validation middleware
const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: result.error.errors,
      });
    }
    req.body = result.data;
    next();
    return;
  };
};

export function setupRoutes(
  app: Express,
  services: {
    llmClient: LLMClient;
    toolRegistry: ToolRegistry;
    planner: Planner;
  }
) {
  const { llmClient, toolRegistry, planner } = services;
  
  // Add metrics middleware
  app.use(httpMetricsMiddleware);
  
  // Apply rate limiter to all routes
  app.use('/api', createRateLimiter(60000, config.rateLimitRequestsPerMin));
  
  // Authentication endpoint
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    if (username === config.authUsername && password === config.authPassword) {
      const token = jwt.sign(
        { username, timestamp: Date.now() },
        config.jwtSecret,
        { expiresIn: '24h' }
      );
      
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
  
  // Chat endpoint
  app.post(
    '/api/chat',
    authenticateToken,
    validateRequest(chatRequestSchema),
    async (req: Request, res: Response) => {
      try {
        const { message, context, tools, stream } = req.body;
        
        // Build messages array
        const messages = [
          { role: 'system' as const, content: 'You are a helpful AI assistant.' },
          ...(context || []).map((msg: string) => ({ role: 'assistant' as const, content: msg })),
          { role: 'user' as const, content: message },
        ];
        
        // Get tools if requested
        const availableTools = tools 
          ? toolRegistry.getToolsForLLM().filter((t: any) => tools.includes(t.function.name))
          : undefined;
        
        if (stream) {
          // Set up SSE
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          
          // Stream response
          try {
            const response = await llmClient.chat(messages, availableTools, true);
            res.write(`data: ${JSON.stringify(response)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          } catch (error: any) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
          }
        } else {
          // Non-streaming response
          const response = await llmClient.chat(messages, availableTools, false);
          res.json({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls,
            usage: response.usage,
          });
        }
      } catch (error: any) {
        logger.error('Chat error:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );
  
  // Task endpoints
  app.post(
    '/api/tasks',
    authenticateToken,
    validateRequest(taskRequestSchema),
    async (req: Request, res: Response) => {
      try {
        const taskRequest = req.body;
        
        // Start task execution
        const taskGenerator = planner.executeTask(taskRequest);
        const steps = [];
        let task;
        
        // Collect first few steps synchronously
        for await (const step of taskGenerator) {
          steps.push(step);
          if (steps.length >= 3) break; // Return after first 3 steps
        }
        
        // Get the task
        task = await taskGenerator.return(undefined as any);
        
        res.json({
          id: task.value?.id,
          status: task.value?.status,
          steps,
          instruction: task.value?.instruction,
        });
        
        // Continue execution in background
        (async () => {
          for await (const _step of taskGenerator) {
            // Steps will be sent via WebSocket
          }
        })();
        
      } catch (error: any) {
        logger.error('Task creation error:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );
  
  app.get('/api/tasks/:taskId', authenticateToken, (_req: Request, res: Response) => {
    const task = planner.getTask(_req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  });
  
  app.get('/api/tasks', authenticateToken, (_req: Request, res: Response) => {
    const tasks = planner.getAllTasks();
    res.json(tasks);
  });
  
  // Approval endpoints
  app.get('/api/approvals', authenticateToken, (_req: Request, res: Response) => {
    const approvals = planner.getApprovalQueue();
    res.json(approvals);
  });
  
  app.post(
    '/api/approvals/:approvalId',
    authenticateToken,
    validateRequest(approvalRequestSchema),
    (req: Request, res: Response) => {
      const { approved, reason } = req.body;
      const { approvalId } = req.params;
      
      let success;
      if (approved) {
        success = planner.approveAction(approvalId);
      } else {
        success = planner.denyAction(approvalId, reason);
      }
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Approval request not found' });
      }
    }
  );
  
  // Tool endpoints
  app.get('/api/tools', authenticateToken, (_req: Request, res: Response) => {
    const tools = toolRegistry.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
      riskLevel: tool.riskLevel,
    }));
    
    res.json(tools);
  });
  
  app.post(
    '/api/tools/:toolName/execute',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { toolName } = req.params;
        const parameters = req.body;
        
        const result = await toolRegistry.executeTool(
          toolName,
          parameters,
          { approved: true }
        );
        
        res.json(result);
      } catch (error: any) {
        logger.error('Tool execution error:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );
  
  // Desktop screenshot endpoint
  app.get('/api/desktop/screenshot', authenticateToken, async (_req: Request, res: Response) => {
    try {
      const result = await toolRegistry.executeTool(
        'screenshot',
        {},
        { approved: true }
      );
      
      if (result.success && result.data?.image) {
        res.json({
          image: result.data.image,
          width: result.data.width,
          height: result.data.height,
          timestamp: result.data.timestamp,
        });
      } else {
        res.status(500).json({ error: result.error || 'Failed to capture screenshot' });
      }
    } catch (error: any) {
      logger.error('Screenshot error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // System info endpoint
  app.get('/api/system/info', authenticateToken, async (_req: Request, res: Response) => {
    try {
      const result = await toolRegistry.executeTool(
        'system_info',
        {},
        { approved: true }
      );
      
      res.json(result.data || {});
    } catch (error: any) {
      logger.error('System info error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  logger.info('API routes configured');
}
