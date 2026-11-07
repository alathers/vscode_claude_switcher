/**
 * src/utils/logger.ts
 *
 * Core Logger with Redaction
 *
 * Core logger with redaction support, no VS Code API imports.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface LoggerConfig {
  level: LogLevel;
  output?: (entry: LogEntry) => void;
  redaction?: {
    patterns: string[];
  };
  prefix?: string;
}

const DEFAULT_SECRET_KEYWORDS = [
  'authToken',
  'auth_token',
  'apiKey',
  'api_key',
  'secret',
  'password',
  'token',
  'credential',
];

export class Logger {
  private level: LogLevel;
  private output: (entry: LogEntry) => void;
  private redactionPatterns: string[];
  private prefix?: string;

  constructor(config: LoggerConfig) {
    this.level = config.level;
    this.output = config.output ?? this.defaultOutput;
    this.redactionPatterns = config.redaction?.patterns ?? DEFAULT_SECRET_KEYWORDS;
    this.prefix = config.prefix;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    const formattedMessage = this.formatMessage(message, context);
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: this.redactString(formattedMessage),
      context: context ? this.redactContext(context) : undefined,
    };

    this.output(entry);
  }

  private formatMessage(message: string, context?: Record<string, unknown>): string {
    if (!context) {
      return message;
    }

    let formatted = message;
    const matches = message.matchAll(/\{(\w+)\}/g);

    for (const match of matches) {
      const placeholder = match[0];
      const key = match[1];

      if (key in context) {
        formatted = formatted.replace(placeholder, String(context[key]));
      }
    }

    return formatted;
  }

  private redactContext(context: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      // Check if key EXACTLY matches a redaction pattern (for key-based redaction)
      const keyMatches = this.redactionPatterns.some((pattern) =>
        key.toLowerCase() === pattern.toLowerCase()
      );

      redacted[key] = keyMatches ? '[REDACTED]' : this.redactValue(value);
    }

    return redacted;
  }

  private redactValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.redactString(value);
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.redactValue(v));
    }

    if (typeof value === 'object') {
      // Preserve Error instances
      if (value instanceof Error) {
        const redactedError = new Error(value.message);
        redactedError.name = value.name;
        if (value.stack) {
          redactedError.stack = this.redactString(value.stack);
        }
        return redactedError;
      }
      return this.redactContext(value as Record<string, unknown>);
    }

    return value;
  }

  private redactString(str: string): string {
    let redacted = str;
    // Check for exact keyword matches (word boundaries)
    for (const keyword of this.redactionPatterns) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (regex.test(redacted)) {
        return '[REDACTED]';
      }
    }
    // Also redact actual secret values (API keys, tokens)
    const secretPatterns = [
      /sk-ant-[a-zA-Z0-9-_]+/g,
      /api[_-]?key["\s:]+["\']?[a-zA-Z0-9-_]+["\']?/gi,
      /bearer["\s:]+["\']?[a-zA-Z0-9-_=./]+["\']?/gi,
    ];
    for (const pattern of secretPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  private defaultOutput(entry: LogEntry): void {
    // Default output to console with color coding
    const levelStr = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const prefix = this.prefix ? `[${this.prefix}]` : '';

    // eslint-disable-next-line no-console
    console.log(`${prefix} ${timestamp} [${levelStr}] ${entry.message}`, entry.context ?? '');
  }

  public dispose(): void {
    // Clean up resources if needed
  }
}
