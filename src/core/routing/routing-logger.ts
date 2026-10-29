/**
 * Routing Logger - Specialized logging for routing decisions
 *
 * Logs routing decisions in JSON format for debugging and cost analysis.
 *
 * Format per SC-003:
 * {
 *   correlationId: string,
 *   taskId: string,
 *   routedTo: 'subscription' | 'api-credits' | 'ollama',
 *   taskType: string,
 *   reason: string,
 *   latencyMs: number,
 *   timestamp: ISO 8601 string
 * }
 */

import type { Logger } from '../../utils/logger';
import type { RoutingDecision } from './routing-history';
import { LogLevel } from '../../utils/logger';

/**
 * Routing decision log entry
 */
export interface RoutingDecisionLogEntry {
  correlationId: string;
  taskId: string;
  routedTo: 'subscription' | 'api-credits' | 'ollama';
  taskType: string;
  reason: string;
  latencyMs?: number;
  timestamp: string;
}

/**
 * Log routing decision at specified level
 */
export function logRoutingDecision(
  logger: Logger,
  level: LogLevel.INFO | LogLevel.WARN | LogLevel.ERROR,
  decision: RoutingDecision,
  requestId?: string
): void {
  const entry: RoutingDecisionLogEntry = {
    correlationId: requestId ?? decision.id,
    taskId: decision.requestId ?? decision.id,
    routedTo: decision.routedTo,
    taskType: decision.taskType,
    reason: decision.reason,
    latencyMs: decision.performance?.latencyMs,
    timestamp: decision.timestamp
  };

  const logFn = level === LogLevel.INFO
    ? logger.info.bind(logger)
    : level === LogLevel.WARN
    ? logger.warn.bind(logger)
    : logger.error.bind(logger);

  logFn('RoutingDecision', JSON.stringify(entry), {
    correlationId: entry.correlationId,
    taskId: entry.taskId,
    routedTo: entry.routedTo,
    taskType: entry.taskType,
    reason: entry.reason,
    latencyMs: entry.latencyMs,
    timestamp: entry.timestamp
  });
}

/**
 * Log routing fallback (warning level)
 */
export function logRoutingFallback(
  logger: Logger,
  from: string,
  to: string,
  reason: string,
  requestId?: string
): void {
  const entry: RoutingDecisionLogEntry = {
    correlationId: requestId ?? '',
    taskId: requestId ?? '',
    routedTo: to as 'subscription' | 'api-credits' | 'ollama',
    taskType: 'fallback',
    reason: `Routing change: ${from} → ${to} (${reason})`,
    timestamp: new Date().toISOString()
  };

  logger.warn('RoutingFallback', JSON.stringify(entry), {
    correlationId: entry.correlationId,
    taskId: entry.taskId,
    routedTo: entry.routedTo,
    taskType: entry.taskType,
    reason: entry.reason,
    timestamp: entry.timestamp
  });
}

/**
 * Log configuration validation failure
 */
export function logConfigError(logger: Logger, errors: string[]): void {
  logger.error('RoutingConfig', `Configuration validation failed: ${errors.join('; ')}`, { errors });
}

/**
 * Log configuration validation warning
 */
export function logConfigWarning(logger: Logger, warnings: string[]): void {
  logger.warn('RoutingConfig', `Configuration validation warnings: ${warnings.join('; ')}`, {
    warnings
  });
}
