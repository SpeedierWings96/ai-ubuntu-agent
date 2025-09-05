import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configuration schema
const configSchema = z.object({
  // Node environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  
  // OpenRouter configuration
  openRouterApiKey: z.string().min(1).optional(),
  openRouterModel: z.string().default('anthropic/claude-3.5-sonnet'),
  openRouterMaxTokens: z.number().int().positive().default(4096),
  openRouterTemperature: z.number().min(0).max(2).default(0.7),
  openRouterFallbackModels: z.string().default('openai/gpt-4o,anthropic/claude-3-haiku'),
  
  // Desktop configuration
  desktopHost: z.string().default('desktop'),
  desktopVncPort: z.number().int().default(5900),
  desktopHttpPort: z.number().int().default(6080),
  desktopPassword: z.string().default('changeme'),
  
  // Server configuration
  agentPort: z.number().int().default(3000),
  metricsPort: z.number().int().default(9090),
  
  // Security configuration
  enableAuth: z.boolean().default(false),
  authUsername: z.string().default('admin'),
  authPassword: z.string().default('admin'),
  jwtSecret: z.string().default('change-in-production'),
  rateLimitRequestsPerMin: z.number().int().positive().default(60),
  
  // Resource limits
  maxFileSizeMB: z.number().positive().default(10),
  maxExecTimeSec: z.number().positive().default(30),
  maxConcurrentTasks: z.number().int().positive().default(3),
  
  // Logging configuration
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logFormat: z.enum(['json', 'pretty']).default('json'),
  
  // Monitoring
  enableMetrics: z.boolean().default(true),
  
  // Desktop settings
  desktopResolution: z.string().regex(/^\d+x\d+$/).default('1920x1080'),
  desktopColorDepth: z.number().int().default(24),
  vncQuality: z.number().int().min(1).max(9).default(7),
  
  // Storage paths
  databasePath: z.string().default('/data/agent.db'),
  cacheDir: z.string().default('/data/cache'),
  tempDir: z.string().default('/tmp'),
  
  // Advanced
  debug: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  nodeExtraCaCerts: z.string().optional(),
});

// Parse and validate configuration
const parseConfig = () => {
  try {
    const rawConfig = {
      nodeEnv: process.env.NODE_ENV,
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.OPENROUTER_MODEL,
      openRouterMaxTokens: process.env.OPENROUTER_MAX_TOKENS ? parseInt(process.env.OPENROUTER_MAX_TOKENS) : undefined,
      openRouterTemperature: process.env.OPENROUTER_TEMPERATURE ? parseFloat(process.env.OPENROUTER_TEMPERATURE) : undefined,
      openRouterFallbackModels: process.env.OPENROUTER_FALLBACK_MODELS,
      desktopHost: process.env.DESKTOP_HOST,
      desktopVncPort: process.env.DESKTOP_VNC_PORT ? parseInt(process.env.DESKTOP_VNC_PORT) : undefined,
      desktopHttpPort: process.env.DESKTOP_HTTP_PORT ? parseInt(process.env.DESKTOP_HTTP_PORT) : undefined,
      desktopPassword: process.env.DESKTOP_VNC_PASSWORD,
      agentPort: process.env.AGENT_PORT ? parseInt(process.env.AGENT_PORT) : undefined,
      metricsPort: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : undefined,
      enableAuth: process.env.ENABLE_AUTH === 'true',
      authUsername: process.env.AUTH_USERNAME,
      authPassword: process.env.AUTH_PASSWORD,
      jwtSecret: process.env.JWT_SECRET,
      rateLimitRequestsPerMin: process.env.RATE_LIMIT_REQUESTS_PER_MIN ? parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MIN) : undefined,
      maxFileSizeMB: process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : undefined,
      maxExecTimeSec: process.env.MAX_EXEC_TIME_SEC ? parseInt(process.env.MAX_EXEC_TIME_SEC) : undefined,
      maxConcurrentTasks: process.env.MAX_CONCURRENT_TASKS ? parseInt(process.env.MAX_CONCURRENT_TASKS) : undefined,
      logLevel: process.env.LOG_LEVEL,
      logFormat: process.env.LOG_FORMAT,
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      desktopResolution: process.env.DESKTOP_RESOLUTION,
      desktopColorDepth: process.env.DESKTOP_COLOR_DEPTH ? parseInt(process.env.DESKTOP_COLOR_DEPTH) : undefined,
      vncQuality: process.env.VNC_QUALITY ? parseInt(process.env.VNC_QUALITY) : undefined,
      databasePath: process.env.DATABASE_PATH,
      cacheDir: process.env.CACHE_DIR,
      tempDir: process.env.TEMP_DIR,
      debug: process.env.DEBUG === 'true',
      webhookUrl: process.env.WEBHOOK_URL,
      nodeExtraCaCerts: process.env.NODE_EXTRA_CA_CERTS,
    };

    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const config = parseConfig();

// Type export for TypeScript
export type Config = z.infer<typeof configSchema>;
