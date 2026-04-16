// backend/utils/logger.js
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Error log file
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error' 
    }),
    // All logs file
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log') 
    }),
    // Console for development
    new winston.transports.Console({ 
      format: winston.format.simple() 
    })
  ]
});

// Helper to log AI requests
logger.logAI = (action, data) => {
  logger.info({
    type: 'AI_INTERACTION',
    action,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Helper to log security events
logger.logSecurity = (event, details) => {
  logger.warn({
    type: 'SECURITY_EVENT',
    event,
    ...details
  });
};

export default logger;