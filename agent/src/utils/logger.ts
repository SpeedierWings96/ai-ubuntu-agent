import winston from 'winston';
import { config } from '../config';

const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  pretty: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  )
};

export const logger = winston.createLogger({
  level: config.logLevel,
  format: formats[config.logFormat],
  transports: [
    new winston.transports.Console(),
    ...(config.nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: '/data/logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: '/data/logs/combined.log',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      })
    ] : [])
  ],
  exitOnError: false,
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
