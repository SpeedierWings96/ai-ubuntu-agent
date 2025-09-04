import { Express } from 'express';
import promClient from 'prom-client';
import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('metrics');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const metrics = {
  // Task metrics
  tasksTotal: new promClient.Counter({
    name: 'tasks_total',
    help: 'Total number of tasks created',
    labelNames: ['status'],
    registers: [register],
  }),
  
  tasksSucceeded: new promClient.Counter({
    name: 'tasks_succeeded',
    help: 'Number of successfully completed tasks',
    registers: [register],
  }),
  
  tasksFailed: new promClient.Counter({
    name: 'tasks_failed',
    help: 'Number of failed tasks',
    registers: [register],
  }),
  
  taskDurationSeconds: new promClient.Histogram({
    name: 'task_duration_seconds',
    help: 'Task execution duration in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    registers: [register],
  }),
  
  // Tool metrics
  toolCallsTotal: new promClient.Counter({
    name: 'tool_calls_total',
    help: 'Total number of tool calls',
    labelNames: ['tool', 'status'],
    registers: [register],
  }),
  
  toolCallDurationSeconds: new promClient.Histogram({
    name: 'tool_call_duration_seconds',
    help: 'Tool call execution duration in seconds',
    labelNames: ['tool'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),
  
  toolApprovalsPending: new promClient.Gauge({
    name: 'tool_approvals_pending',
    help: 'Number of pending tool approvals',
    registers: [register],
  }),
  
  // LLM metrics
  llmRequestsTotal: new promClient.Counter({
    name: 'llm_requests_total',
    help: 'Total number of LLM requests',
    labelNames: ['model', 'status'],
    registers: [register],
  }),
  
  llmTokensUsed: new promClient.Counter({
    name: 'llm_tokens_used',
    help: 'Total number of tokens used',
    labelNames: ['model', 'type'], // type: prompt, completion
    registers: [register],
  }),
  
  llmResponseTimeSeconds: new promClient.Histogram({
    name: 'llm_response_time_seconds',
    help: 'LLM response time in seconds',
    labelNames: ['model'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [register],
  }),
  
  llmCostDollars: new promClient.Counter({
    name: 'llm_cost_dollars',
    help: 'Total LLM cost in dollars',
    labelNames: ['model'],
    registers: [register],
  }),
  
  // System metrics
  containerCpuUsagePercent: new promClient.Gauge({
    name: 'container_cpu_usage_percent',
    help: 'Container CPU usage percentage',
    registers: [register],
  }),
  
  containerMemoryUsageBytes: new promClient.Gauge({
    name: 'container_memory_usage_bytes',
    help: 'Container memory usage in bytes',
    registers: [register],
  }),
  
  websocketConnectionsActive: new promClient.Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
    registers: [register],
  }),
  
  httpRequestDuration: new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),
};

// Middleware to track HTTP metrics
export const httpMetricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    
    metrics.httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
};

// Update system metrics periodically
const updateSystemMetrics = () => {
  const memUsage = process.memoryUsage();
  metrics.containerMemoryUsageBytes.set(memUsage.rss);
  
  const cpuUsage = process.cpuUsage();
  const totalCpu = cpuUsage.user + cpuUsage.system;
  const cpuPercent = (totalCpu / 1000000) / process.uptime() * 100;
  metrics.containerCpuUsagePercent.set(cpuPercent);
};

// Setup metrics endpoint
export const setupMetrics = (app: Express) => {
  // Update system metrics every 10 seconds
  setInterval(updateSystemMetrics, 10000);
  
  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).end();
    }
  });
  
  logger.info('Metrics endpoint configured at /metrics');
};

// Helper functions for recording metrics
export const recordTaskMetric = (status: 'created' | 'succeeded' | 'failed', duration?: number) => {
  metrics.tasksTotal.labels(status).inc();
  
  if (status === 'succeeded') {
    metrics.tasksSucceeded.inc();
  } else if (status === 'failed') {
    metrics.tasksFailed.inc();
  }
  
  if (duration !== undefined) {
    metrics.taskDurationSeconds.observe(duration);
  }
};

export const recordToolMetric = (tool: string, status: 'success' | 'failure', duration: number) => {
  metrics.toolCallsTotal.labels(tool, status).inc();
  metrics.toolCallDurationSeconds.labels(tool).observe(duration);
};

export const recordLLMMetric = (
  model: string,
  status: 'success' | 'failure',
  promptTokens: number,
  completionTokens: number,
  responseTime: number,
  cost?: number
) => {
  metrics.llmRequestsTotal.labels(model, status).inc();
  metrics.llmTokensUsed.labels(model, 'prompt').inc(promptTokens);
  metrics.llmTokensUsed.labels(model, 'completion').inc(completionTokens);
  metrics.llmResponseTimeSeconds.labels(model).observe(responseTime);
  
  if (cost !== undefined) {
    metrics.llmCostDollars.labels(model).inc(cost);
  }
};
