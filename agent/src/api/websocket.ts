import { Server, Socket } from 'socket.io';
import { LLMClient } from '../llm/client';
import { ToolRegistry } from '../tools/registry';
import { Planner } from '../planner/react';
import { createLogger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { config } from '../config';
import jwt from 'jsonwebtoken';

const logger = createLogger('websocket');

interface AuthenticatedSocket extends Socket {
  user?: {
    username: string;
    timestamp: number;
  };
  taskSubscriptions: Set<string>;
}

export function setupWebSocket(
  io: Server,
  services: {
    llmClient: LLMClient;
    toolRegistry: ToolRegistry;
    planner: Planner;
  }
) {
  const { llmClient, toolRegistry, planner } = services;
  
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    if (!config.enableAuth) {
      socket.taskSubscriptions = new Set();
      return next();
    }
    
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    jwt.verify(token, config.jwtSecret, (err: any, user: any) => {
      if (err) {
        return next(new Error('Invalid token'));
      }
      
      socket.user = user;
      socket.taskSubscriptions = new Set();
      next();
    });
  });
  
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);
    metrics.websocketConnectionsActive.inc();
    
    // Send initial connection confirmation
    socket.emit('connected', {
      id: socket.id,
      user: socket.user,
      timestamp: Date.now(),
    });
    
    // Handle task subscriptions
    socket.on('task:subscribe', (taskId: string) => {
      const task = planner.getTask(taskId);
      
      if (!task) {
        socket.emit('error', { message: 'Task not found' });
        return;
      }
      
      socket.taskSubscriptions.add(taskId);
      socket.join(`task:${taskId}`);
      
      // Send current task state
      socket.emit('task:update', task);
      
      logger.debug(`Client ${socket.id} subscribed to task ${taskId}`);
    });
    
    socket.on('task:unsubscribe', (taskId: string) => {
      socket.taskSubscriptions.delete(taskId);
      socket.leave(`task:${taskId}`);
      logger.debug(`Client ${socket.id} unsubscribed from task ${taskId}`);
    });
    
    // Handle task creation
    socket.on('task:start', async (data) => {
      try {
        const taskGenerator = planner.executeTask(data);
        let task: any;
        
        // Process task steps
        for await (const step of taskGenerator) {
          // Send step update to subscribed clients
          io.to(`task:${step.taskId || ''}`).emit('task:step', step);
          
          // Also send to the requesting client
          socket.emit('task:step', step);
        }
        
        // Get final task result
        task = await taskGenerator.return(undefined as any);
        
        // Send completion
        io.to(`task:${task.id}`).emit('task:completed', task);
        socket.emit('task:completed', task);
        
      } catch (error: any) {
        logger.error('Task execution error:', error);
        socket.emit('task:error', {
          error: error.message,
          taskId: data.id,
        });
      }
    });
    
    // Handle task control
    socket.on('task:pause', (taskId: string) => {
      // TODO: Implement task pausing
      socket.emit('task:paused', { taskId });
    });
    
    socket.on('task:resume', (taskId: string) => {
      // TODO: Implement task resuming
      socket.emit('task:resumed', { taskId });
    });
    
    socket.on('task:cancel', (taskId: string) => {
      // TODO: Implement task cancellation
      socket.emit('task:cancelled', { taskId });
    });
    
    // Handle approvals
    socket.on('action:approve', ({ actionId }) => {
      const success = planner.approveAction(actionId);
      
      if (success) {
        socket.emit('action:approved', { actionId });
        io.emit('approval:update', planner.getApprovalQueue());
      } else {
        socket.emit('error', { message: 'Approval request not found' });
      }
    });
    
    socket.on('action:deny', ({ actionId, reason }) => {
      const success = planner.denyAction(actionId, reason);
      
      if (success) {
        socket.emit('action:denied', { actionId, reason });
        io.emit('approval:update', planner.getApprovalQueue());
      } else {
        socket.emit('error', { message: 'Approval request not found' });
      }
    });
    
    // Handle desktop control
    socket.on('desktop:click', async (data) => {
      try {
        const result = await toolRegistry.executeTool(
          'click',
          data,
          { approved: true }
        );
        
        socket.emit('desktop:click:result', result);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('desktop:type', async (data) => {
      try {
        const result = await toolRegistry.executeTool(
          'type',
          data,
          { approved: true }
        );
        
        socket.emit('desktop:type:result', result);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('desktop:key', async (data) => {
      try {
        const result = await toolRegistry.executeTool(
          'key',
          data,
          { approved: true }
        );
        
        socket.emit('desktop:key:result', result);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('desktop:screenshot', async () => {
      try {
        const result = await toolRegistry.executeTool(
          'screenshot',
          {},
          { approved: true }
        );
        
        if (result.success) {
          socket.emit('desktop:screenshot', result.data);
        } else {
          socket.emit('error', { message: result.error });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });
    
    // Handle chat messages
    socket.on('chat:message', async (data) => {
      try {
        const { message, context, tools } = data;
        
        const messages = [
          { role: 'system' as const, content: 'You are a helpful AI assistant.' },
          ...(context || []).map((msg: string) => ({ role: 'assistant' as const, content: msg })),
          { role: 'user' as const, content: message },
        ];
        
        const availableTools = tools 
          ? toolRegistry.getToolsForLLM().filter((t: any) => tools.includes(t.function.name))
          : undefined;
        
        // Stream response chunks
        socket.emit('chat:start', { id: Date.now() });
        
        const response = await llmClient.chat(messages, availableTools, true);
        
        socket.emit('chat:message', {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
          usage: response.usage,
        });
        
        socket.emit('chat:end', { id: Date.now() });
        
      } catch (error: any) {
        logger.error('Chat error:', error);
        socket.emit('chat:error', { error: error.message });
      }
    });
    
    // Handle metrics requests
    socket.on('metrics:get', () => {
      const systemMetrics = {
        tasksActive: planner.getAllTasks().filter(t => t.status === 'running').length,
        tasksTotal: planner.getAllTasks().length,
        approvalssPending: planner.getApprovalQueue().length,
        connectionsActive: io.engine.clientsCount,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      };
      
      socket.emit('metrics:update', systemMetrics);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
      metrics.websocketConnectionsActive.dec();
      
      // Clean up subscriptions
      socket.taskSubscriptions.clear();
    });
    
    // Handle errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${socket.id}:`, error);
    });
  });
  
  // Set up planner event forwarding
  planner.on('task:created', (task) => {
    io.emit('task:created', task);
  });
  
  planner.on('task:started', (task) => {
    io.to(`task:${task.id}`).emit('task:started', task);
  });
  
  planner.on('task:step', ({ task, step }) => {
    io.to(`task:${task.id}`).emit('task:step', { task, step });
  });
  
  planner.on('task:completed', (task) => {
    io.to(`task:${task.id}`).emit('task:completed', task);
  });
  
  planner.on('task:failed', (task) => {
    io.to(`task:${task.id}`).emit('task:failed', task);
  });
  
  planner.on('approval:requested', (approval) => {
    io.emit('action:pending', approval);
  });
  
  planner.on('approval:granted', ({ approvalId }) => {
    io.emit('action:approved', { approvalId });
  });
  
  planner.on('approval:denied', ({ approvalId, reason }) => {
    io.emit('action:denied', { approvalId, reason });
  });
  
  // Periodic metrics broadcast
  setInterval(() => {
    const systemMetrics = {
      tasksActive: planner.getAllTasks().filter(t => t.status === 'running').length,
      tasksTotal: planner.getAllTasks().length,
      approvalsPending: planner.getApprovalQueue().length,
      connectionsActive: io.engine.clientsCount,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
    
    io.emit('metrics:update', systemMetrics);
  }, 5000); // Every 5 seconds
  
  logger.info('WebSocket server configured');
}
