import OpenAI from 'openai';
import { Config } from '../config';
import { createLogger } from '../utils/logger';
import { recordLLMMetric } from '../utils/metrics';
import NodeCache from 'node-cache';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat';

const logger = createLogger('llm-client');

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export class LLMClient {
  private client: OpenAI;
  private cache: NodeCache;
  private config: Config;
  private fallbackModels: string[];
  private isConnected: boolean = false;
  
  constructor(config: Config) {
    this.config = config;
    
    // Initialize OpenAI client with OpenRouter configuration
    this.client = new OpenAI({
      apiKey: config.openRouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:9992',
        'X-Title': 'AI Ubuntu Desktop Agent',
      },
    });
    
    // Parse fallback models
    this.fallbackModels = config.openRouterFallbackModels
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);
    
    // Initialize cache with 5 minute TTL
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    
    this.testConnection();
  }
  
  private async testConnection() {
    try {
      // Simple test to verify API key is valid
      await this.client.models.list();
      this.isConnected = true;
      logger.info('Successfully connected to OpenRouter API');
    } catch (error) {
      logger.error('Failed to connect to OpenRouter API:', error);
      this.isConnected = false;
    }
  }
  
  isHealthy(): boolean {
    return this.isConnected;
  }
  
  async chat(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
    stream: boolean = false
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(messages, tools);
    
    // Check cache for identical queries
    if (!stream) {
      const cached = this.cache.get<LLMResponse>(cacheKey);
      if (cached) {
        logger.debug('Returning cached response');
        return cached;
      }
    }
    
    const models = [this.config.openRouterModel, ...this.fallbackModels];
    let lastError: any;
    
    for (const model of models) {
      try {
        logger.debug(`Attempting request with model: ${model}`);
        
        const completion = await this.client.chat.completions.create({
          model,
          messages,
          tools,
          max_tokens: this.config.openRouterMaxTokens,
          temperature: this.config.openRouterTemperature,
          stream,
        });
        
        if (stream) {
          // Handle streaming response (not cached)
          return this.handleStreamingResponse(completion as any, model, startTime);
        } else {
          // Handle non-streaming response
          const response = this.parseResponse(completion as any);
          
          // Record metrics
          const responseTime = (Date.now() - startTime) / 1000;
          const usage = (completion as any).usage;
          if (usage) {
            const cost = this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
            recordLLMMetric(
              model,
              'success',
              usage.prompt_tokens,
              usage.completion_tokens,
              responseTime,
              cost
            );
            
            response.usage = {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
              cost,
            };
          }
          
          // Cache the response
          this.cache.set(cacheKey, response);
          
          return response;
        }
      } catch (error: any) {
        logger.error(`Failed with model ${model}:`, error);
        lastError = error;
        
        // Record failure metric
        const responseTime = (Date.now() - startTime) / 1000;
        recordLLMMetric(model, 'failure', 0, 0, responseTime);
        
        // Check if we should retry with fallback
        if (this.shouldRetry(error)) {
          logger.info(`Retrying with next model...`);
          continue;
        }
        
        throw error;
      }
    }
    
    // All models failed
    throw new Error(`All models failed. Last error: ${lastError?.message}`);
  }
  
  private parseResponse(completion: any): LLMResponse {
    const message = completion.choices[0].message;
    
    const response: LLMResponse = {
      content: message.content || '',
    };
    
    if (message.tool_calls) {
      response.toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));
    }
    
    return response;
  }
  
  private async handleStreamingResponse(
    stream: AsyncIterable<any>,
    model: string,
    startTime: number
  ): Promise<LLMResponse> {
    const chunks: string[] = [];
    const toolCalls: ToolCall[] = [];
    let usage: any;
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0].delta;
      
      if (delta.content) {
        chunks.push(delta.content);
      }
      
      if (delta.tool_calls) {
        // Handle streaming tool calls
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = {
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: '',
            };
          }
          
          if (tc.function?.arguments) {
            toolCalls[tc.index].arguments += tc.function.arguments;
          }
        }
      }
      
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }
    
    // Parse tool call arguments
    const parsedToolCalls = toolCalls.map(tc => ({
      ...tc,
      arguments: tc.arguments ? JSON.parse(tc.arguments) : {},
    }));
    
    const response: LLMResponse = {
      content: chunks.join(''),
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
    };
    
    if (usage) {
      const responseTime = (Date.now() - startTime) / 1000;
      const cost = this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
      
      recordLLMMetric(
        model,
        'success',
        usage.prompt_tokens,
        usage.completion_tokens,
        responseTime,
        cost
      );
      
      response.usage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost,
      };
    }
    
    return response;
  }
  
  private shouldRetry(error: any): boolean {
    // Retry on rate limits and temporary failures
    const statusCode = error.status || error.response?.status;
    return statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503;
  }
  
  private getCacheKey(messages: any[], tools?: any[]): string {
    return JSON.stringify({ messages, tools, model: this.config.openRouterModel });
  }
  
  private estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    // Rough cost estimates per million tokens
    const costs: Record<string, { prompt: number; completion: number }> = {
      'anthropic/claude-3.5-sonnet': { prompt: 3, completion: 15 },
      'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
      'openai/gpt-4o': { prompt: 5, completion: 15 },
      'openai/gpt-4-turbo': { prompt: 10, completion: 30 },
      'openai/gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
    };
    
    const modelCost = costs[model] || { prompt: 1, completion: 2 };
    const promptCost = (promptTokens / 1_000_000) * modelCost.prompt;
    const completionCost = (completionTokens / 1_000_000) * modelCost.completion;
    
    return promptCost + completionCost;
  }
  
  async cleanup() {
    this.cache.flushAll();
    logger.info('LLM client cleaned up');
  }
}
