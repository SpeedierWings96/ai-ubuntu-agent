import { LLMClient, ToolCall } from '../llm/client';
import { ToolRegistry, ExecutionContext, ToolResult } from '../tools/registry';
import { SYSTEM_PROMPTS } from '../llm/prompts';
import { createLogger } from '../utils/logger';
import { recordTaskMetric } from '../utils/metrics';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

const logger = createLogger('planner');

export interface PlanStep {
  id: string;
  thought: string;
  action?: string;
  actionInput?: any;
  observation?: string;
  result?: any;
  approved?: boolean;
  timestamp: number;
  error?: string;
}

export interface Task {
  id: string;
  instruction: string;
  status: 'queued' | 'running' | 'pending_approval' | 'completed' | 'failed';
  steps: PlanStep[];
  result?: any;
  error?: string;
  context?: Record<string, any>;
  constraints?: string[];
  timeout?: number;
  createdAt: number;
  completedAt?: number;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  tool: string;
  parameters: any;
  riskLevel: string;
  timestamp: number;
  callback: (approved: boolean, reason?: string) => void;
}

export class Planner extends EventEmitter {
  private llmClient: LLMClient;
  private toolRegistry: ToolRegistry;
  private tasks: Map<string, Task> = new Map();
  private approvalQueue: Map<string, ApprovalRequest> = new Map();
  private maxIterations: number = 15;
  private memoryWindow: number = 10;
  private concurrentTasks: number = 0;
  private maxConcurrentTasks: number = 3;
  
  constructor(llmClient: LLMClient, toolRegistry: ToolRegistry) {
    super();
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
  }
  
  async *executeTask(taskRequest: {
    instruction: string;
    context?: Record<string, any>;
    constraints?: string[];
    timeout?: number;
  }): AsyncGenerator<PlanStep, Task, unknown> {
    const task: Task = {
      id: uuidv4(),
      instruction: taskRequest.instruction,
      status: 'queued',
      steps: [],
      context: taskRequest.context,
      constraints: taskRequest.constraints,
      timeout: taskRequest.timeout || 300,
      createdAt: Date.now(),
    };
    
    this.tasks.set(task.id, task);
    this.emit('task:created', task);
    
    // Check concurrent task limit
    if (this.concurrentTasks >= this.maxConcurrentTasks) {
      task.status = 'failed';
      task.error = 'Maximum concurrent tasks reached';
      this.emit('task:failed', task);
      recordTaskMetric('failed');
      return task;
    }
    
    this.concurrentTasks++;
    task.status = 'running';
    this.emit('task:started', task);
    
    const startTime = Date.now();
    
    try {
      // Execute the ReAct loop
      let iteration = 0;
      let isComplete = false;
      
      while (!isComplete && iteration < this.maxIterations) {
        iteration++;
        
        // Check timeout
        if (Date.now() - startTime > task.timeout * 1000) {
          throw new Error('Task execution timeout');
        }
        
        // Generate next step
        const step = await this.generateNextStep(task);
        task.steps.push(step);
        
        yield step;
        
        // Check if task is complete
        isComplete = await this.isTaskComplete(task);
        
        // Update task in storage
        this.tasks.set(task.id, task);
        this.emit('task:step', { task, step });
      }
      
      if (iteration >= this.maxIterations) {
        throw new Error('Maximum iterations reached');
      }
      
      // Task completed successfully
      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = this.extractResult(task);
      
      const duration = (task.completedAt - task.createdAt) / 1000;
      recordTaskMetric('succeeded', duration);
      
      this.emit('task:completed', task);
      logger.info(`Task ${task.id} completed in ${duration}s`);
      
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = Date.now();
      
      const duration = (task.completedAt - task.createdAt) / 1000;
      recordTaskMetric('failed', duration);
      
      this.emit('task:failed', task);
      logger.error(`Task ${task.id} failed:`, error);
      
    } finally {
      this.concurrentTasks--;
      this.tasks.set(task.id, task);
    }
    
    return task;
  }
  
  private async generateNextStep(task: Task): Promise<PlanStep> {
    const step: PlanStep = {
      id: uuidv4(),
      thought: '',
      timestamp: Date.now(),
    };
    
    try {
      // Build conversation history
      const messages = this.buildMessages(task);
      
      // Get available tools
      const tools = this.toolRegistry.getToolsForLLM();
      
      // Call LLM to generate next action
      const response = await this.llmClient.chat(messages, tools);
      
      // Parse response
      if (response.content) {
        // Extract thought from response
        const thoughtMatch = response.content.match(/THOUGHT:(.*?)(?:ACTION:|$)/s);
        if (thoughtMatch) {
          step.thought = thoughtMatch[1].trim();
        } else {
          step.thought = response.content.trim();
        }
      }
      
      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCall = response.toolCalls[0]; // Process first tool call
        step.action = toolCall.name;
        step.actionInput = toolCall.arguments;
        
        // Execute the tool
        const toolResult = await this.executeTool(
          task.id,
          toolCall.name,
          toolCall.arguments
        );
        
        step.result = toolResult.data;
        step.observation = this.formatObservation(toolResult);
        
        if (!toolResult.success) {
          step.error = toolResult.error;
        }
      }
      
    } catch (error: any) {
      step.error = error.message;
      step.observation = `Error: ${error.message}`;
      logger.error('Failed to generate step:', error);
    }
    
    return step;
  }
  
  private buildMessages(task: Task): any[] {
    const messages: any[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPTS.planner,
      },
      {
        role: 'user',
        content: this.formatTaskInstruction(task),
      },
    ];
    
    // Add recent steps to context (memory window)
    const recentSteps = task.steps.slice(-this.memoryWindow);
    for (const step of recentSteps) {
      // Add thought as assistant message
      if (step.thought) {
        messages.push({
          role: 'assistant',
          content: `THOUGHT: ${step.thought}${step.action ? `\nACTION: ${step.action}` : ''}`,
        });
      }
      
      // Add observation as system message
      if (step.observation) {
        messages.push({
          role: 'system',
          content: `OBSERVATION: ${step.observation}`,
        });
      }
    }
    
    // Add prompt for next action
    messages.push({
      role: 'system',
      content: 'Based on the observations so far, what is your next thought and action? Use the ReAct format.',
    });
    
    return messages;
  }
  
  private formatTaskInstruction(task: Task): string {
    let instruction = `Task: ${task.instruction}`;
    
    if (task.context && Object.keys(task.context).length > 0) {
      instruction += `\n\nContext:\n${JSON.stringify(task.context, null, 2)}`;
    }
    
    if (task.constraints && task.constraints.length > 0) {
      instruction += `\n\nConstraints:\n${task.constraints.map(c => `- ${c}`).join('\n')}`;
    }
    
    return instruction;
  }
  
  private async executeTool(
    taskId: string,
    toolName: string,
    parameters: any
  ): Promise<ToolResult> {
    const tool = this.toolRegistry.getTool(toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }
    
    // Check if approval is required
    if (tool.requiresApproval) {
      const approved = await this.requestApproval(taskId, toolName, parameters, tool.riskLevel);
      
      if (!approved) {
        return {
          success: false,
          error: 'Tool execution denied by user',
        };
      }
    }
    
    // Execute the tool
    const context: ExecutionContext = {
      taskId,
      approved: true,
    };
    
    return await this.toolRegistry.executeTool(toolName, parameters, context);
  }
  
  private async requestApproval(
    taskId: string,
    tool: string,
    parameters: any,
    riskLevel: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const approvalRequest: ApprovalRequest = {
        id: uuidv4(),
        taskId,
        tool,
        parameters,
        riskLevel,
        timestamp: Date.now(),
        callback: (approved: boolean) => {
          this.approvalQueue.delete(approvalRequest.id);
          resolve(approved);
        },
      };
      
      this.approvalQueue.set(approvalRequest.id, approvalRequest);
      this.emit('approval:requested', approvalRequest);
      
      // Set timeout for approval
      setTimeout(() => {
        if (this.approvalQueue.has(approvalRequest.id)) {
          this.approvalQueue.delete(approvalRequest.id);
          logger.warn(`Approval timeout for tool ${tool}`);
          resolve(false);
        }
      }, 30000); // 30 second timeout
    });
  }
  
  approveAction(approvalId: string): boolean {
    const request = this.approvalQueue.get(approvalId);
    if (request) {
      request.callback(true);
      this.emit('approval:granted', { approvalId });
      return true;
    }
    return false;
  }
  
  denyAction(approvalId: string, reason?: string): boolean {
    const request = this.approvalQueue.get(approvalId);
    if (request) {
      request.callback(false, reason);
      this.emit('approval:denied', { approvalId, reason });
      return true;
    }
    return false;
  }
  
  private formatObservation(result: ToolResult): string {
    if (!result.success) {
      return `Failed: ${result.error}`;
    }
    
    if (typeof result.data === 'string') {
      return result.data;
    }
    
    // Format complex data nicely
    return JSON.stringify(result.data, null, 2);
  }
  
  private async isTaskComplete(task: Task): Promise<boolean> {
    // Check if the last step indicates completion
    const lastStep = task.steps[task.steps.length - 1];
    
    if (lastStep?.thought?.toLowerCase().includes('task complete') ||
        lastStep?.thought?.toLowerCase().includes('successfully completed')) {
      return true;
    }
    
    // Check if there were multiple consecutive errors
    const recentErrors = task.steps.slice(-3).filter(s => s.error).length;
    if (recentErrors >= 3) {
      throw new Error('Too many consecutive errors');
    }
    
    return false;
  }
  
  private extractResult(task: Task): any {
    // Extract the final result from the task steps
    const lastSuccessfulStep = [...task.steps]
      .reverse()
      .find(s => s.result && !s.error);
    
    return lastSuccessfulStep?.result || {
      summary: 'Task completed',
      steps: task.steps.length,
    };
  }
  
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }
  
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
  
  getApprovalQueue(): ApprovalRequest[] {
    return Array.from(this.approvalQueue.values());
  }
}
