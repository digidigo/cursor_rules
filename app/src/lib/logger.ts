import { format } from 'date-fns';

class Logger {
  private static instance: Logger;
  private logDir: string;
  private currentLogFile: string;
  private isServer: boolean;

  private constructor() {
    this.isServer = typeof window === 'undefined';
    
    if (this.isServer) {
      // Only setup file logging on server
      const fs = require('fs');
      const path = require('path');
      this.logDir = path.join(process.cwd(), 'logs');
      this.ensureLogDirectory(fs);
      this.currentLogFile = this.getLogFilePath(path);
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirectory(fs: any) {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath(path: any): string {
    const date = format(new Date(), 'yyyy-MM-dd');
    return path.join(this.logDir, `crm-${date}.log`);
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const dataStr = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${dataStr}\n`;
  }

  private writeToFile(message: string) {
    if (!this.isServer) return;

    // Dynamic import on server side
    const fs = require('fs');
    const path = require('path');

    // Check if we need to rotate to a new log file
    const newLogFile = this.getLogFilePath(path);
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
    }

    fs.appendFileSync(this.currentLogFile, message);
  }

  public debug(message: string, data?: any) {
    const formattedMessage = this.formatMessage('DEBUG', message, data);
    console.debug(formattedMessage);
    if (this.isServer) {
      this.writeToFile(formattedMessage);
    }
  }

  public info(message: string, data?: any) {
    const formattedMessage = this.formatMessage('INFO', message, data);
    console.info(formattedMessage);
    if (this.isServer) {
      this.writeToFile(formattedMessage);
    }
  }

  public warn(message: string, data?: any) {
    const formattedMessage = this.formatMessage('WARN', message, data);
    console.warn(formattedMessage);
    if (this.isServer) {
      this.writeToFile(formattedMessage);
    }
  }

  public error(message: string, error?: any, data?: any) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      ...data
    } : data;
    
    const formattedMessage = this.formatMessage('ERROR', message, errorData);
    console.error(formattedMessage);
    if (this.isServer) {
      this.writeToFile(formattedMessage);
    }
  }

  public request(method: string, url: string, data?: any) {
    this.info(`HTTP ${method} ${url}`, data);
  }

  public response(method: string, url: string, status: number, data?: any) {
    this.info(`HTTP ${method} ${url} ${status}`, data);
  }
}

export const logger = Logger.getInstance(); 
