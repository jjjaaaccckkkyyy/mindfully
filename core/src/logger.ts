import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, name, ...meta }) => {
    const prefix = name ? `[${name}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${prefix} ${message}${metaStr}`;
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

export function createLogger(name: string): winston.Logger {
  return winston.createLogger({
    level: logLevel,
    silent: isTest,
    format: isProduction ? prodFormat : devFormat,
    defaultMeta: { name },
    transports: [new winston.transports.Console()],
  });
}
