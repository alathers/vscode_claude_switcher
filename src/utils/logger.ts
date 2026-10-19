/**
 * Pure logic logging utility
 *
 * Constitution requirement: MUST NOT import vscode module
 * Uses Node.js built-ins only
 */

/**
 * Log levels
 */
export enum LogLevel {
 DEBUG = 0,
 INFO = 1,
 WARN = 2,
 ERROR = 3,
}

/**
 * Log entry structure
 */
export interface LogEntry {
 timestamp: Date;
 level: LogLevel;
 category: string;
 message: string;
 metadata?: Record<string, unknown>;
}

/**
 * Pure logic logger interface
 * Logs are collected but not displayed directly (VS Code output channel handled by integration layer)
 */
export class Logger {
 private entries: LogEntry[] = [];
 private minLevel: LogLevel;

 constructor(minLevel: LogLevel = LogLevel.INFO) {
  this.minLevel = minLevel;
 }

 /**
  * Log a message at the specified level
  */
 private log(level: LogLevel, category: string, message: string, metadata?: Record<string, unknown>): void {
  if (level < this.minLevel) {
   return;
  }

  const entry: LogEntry = {
   timestamp: new Date(),
   level,
   category,
   message,
   metadata,
  };

  this.entries.push(entry);
 }

 /**
  * Log debug message
  */
 debug(category: string, message: string, metadata?: Record<string, unknown>): void {
  this.log(LogLevel.DEBUG, category, message, metadata);
 }

 /**
  * Log info message
  */
 info(category: string, message: string, metadata?: Record<string, unknown>): void {
  this.log(LogLevel.INFO, category, message, metadata);
 }

 /**
  * Log warning message
  */
 warn(category: string, message: string, metadata?: Record<string, unknown>): void {
  this.log(LogLevel.WARN, category, message, metadata);
 }

 /**
  * Log error message
  */
 error(category: string, message: string, metadata?: Record<string, unknown>): void {
  this.log(LogLevel.ERROR, category, message, metadata);
 }

 /**
  * Get all log entries
  */
 getEntries(): LogEntry[] {
  return [...this.entries];
 }

 /**
  * Get entries filtered by level
  */
 getEntriesByLevel(level: LogLevel): LogEntry[] {
  return this.entries.filter((entry) => entry.level === level);
 }

 /**
  * Get entries filtered by category
  */
 getEntriesByCategory(category: string): LogEntry[] {
  return this.entries.filter((entry) => entry.category === category);
 }

 /**
  * Clear all log entries
  */
 clear(): void {
  this.entries = [];
 }

 /**
  * Get entry count
  */
 getEntryCount(): number {
  return this.entries.length;
 }

 /**
  * Set minimum log level
  */
 setMinLevel(level: LogLevel): void {
  this.minLevel = level;
 }

 /**
  * Get current minimum log level
  */
 getMinLevel(): LogLevel {
  return this.minLevel;
 }
}

/**
 * Format log entry as string
 */
export function formatLogEntry(entry: LogEntry): string {
 const timestamp = entry.timestamp.toISOString();
 const level = LogLevel[entry.level].padEnd(5);
 const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
 return `[${timestamp}] [${level}] [${entry.category}] ${entry.message}${metadata}`;
}

/**
 * Create a new logger with the specified minimum level
 */
export function createLogger(minLevel: LogLevel = LogLevel.INFO): Logger {
 return new Logger(minLevel);
}
