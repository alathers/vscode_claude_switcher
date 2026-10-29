/**
 * Routing Configuration - Parse and validate routing settings
 *
 * Reads routing configuration from VS Code settings and validates constraints.
 */

import type * as vscode from 'vscode';
import type { Logger } from '../../utils/logger';
import { logConfigError } from './routing-logger';

/**
 * Model source enum
 */
export type ModelSource = 'subscription' | 'api-credits' | 'ollama';

/**
 * Task type mapping: explicit routing or auto-detection
 */
export type TaskTypeMapping = Record<string, ModelSource | 'auto'>;

/**
 * Threshold alerts configuration
 */
export interface Thresholds {
  subscriptionAlertPercent: number;
  subscriptionFallbackPercent: number;
}

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  plan: 'pro' | 'max';
  dailyLimit: number;
  rollingWindowDays: number;
}

/**
 * Harvey configuration
 */
export interface HarveyConfig {
  baseUrl: string;
}

/**
 * Complete routing configuration
 */
export interface RoutingConfiguration {
  /**
   * Priority order for routing sources
   */
  priority: ModelSource[];

  /**
   * Task type to model source mapping
   */
  taskMappings: TaskTypeMapping;

  /**
   * Auto-fallback to Ollama when Claude exhausted
   */
  autoFallback: boolean;

  /**
   * Alert thresholds
   */
  thresholds: Thresholds;

  /**
   * Harvey router configuration
   */
  harvey: HarveyConfig;

  /**
   * Subscription quota configuration
   */
  subscription: SubscriptionConfig;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Load routing configuration from VS Code settings
 */
export async function loadConfiguration(
  workspaceConfig: vscode.WorkspaceConfiguration
): Promise<RoutingConfiguration> {
  const config = workspaceConfig as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  return {
    priority: config.priority ?? ['subscription', 'api-credits', 'ollama'],
    taskMappings: config.taskMappings ?? {},
    autoFallback: config.autoFallback !== undefined ? config.autoFallback : true,
    thresholds: {
      subscriptionAlertPercent: config.thresholds?.subscriptionAlertPercent ?? 80,
      subscriptionFallbackPercent: config.thresholds?.subscriptionFallbackPercent ?? 100
    },
    harvey: {
      baseUrl: config.harvey?.baseUrl ?? 'http://localhost:11434'
    },
    subscription: {
      plan: config.subscription?.plan ?? 'pro',
      dailyLimit: config.subscription?.dailyLimit ?? 30,
      rollingWindowDays: config.subscription?.rollingWindowDays ?? 7
    }
  };
}

/**
 * Validate routing configuration
 *
 * Returns validation result with any errors found.
 * Logs warnings/erors to supplied logger if provided.
 */
export function validateConfiguration(
  config: RoutingConfiguration,
  logger?: Logger
): ValidationResult {
  const errors: string[] = [];

  // Check 1: Ollama in priority requires Harvey baseUrl
  if (config.priority.includes('ollama') && !config.harvey.baseUrl) {
    errors.push(
      'Invalid configuration: ollama in priority but Harvey baseUrl is empty. Set harvey.baseUrl.'
    );
  }

  // Check 2: Fallback threshold >= Alert threshold
  if (config.thresholds.subscriptionFallbackPercent < config.thresholds.subscriptionAlertPercent) {
    errors.push(
      `Invalid configuration: Fallback threshold (${config.thresholds.subscriptionFallbackPercent}%) must be >= alert threshold (${config.thresholds.subscriptionAlertPercent}%)`
    );
  }

  // Check 3: Valid plan
  if (config.subscription.plan !== 'pro' && config.subscription.plan !== 'max') {
    errors.push(
      `Invalid configuration: subscription.plan must be 'pro' or 'max', got '${config.subscription.plan}'`
    );
  }

  // Check 4: Positive dailyLimit
  if (config.subscription.dailyLimit <= 0) {
    errors.push(
      `Invalid configuration: subscription.dailyLimit must be > 0, got ${config.subscription.dailyLimit}`
    );
  }

  // Check 5: Positive rollingWindowDays
  if (config.subscription.rollingWindowDays <= 0) {
    errors.push(
      `Invalid configuration: subscription.rollingWindowDays must be > 0, got ${config.subscription.rollingWindowDays}`
    );
  }

  // Log validation results if logger provided
  if (logger) {
    if (errors.length > 0) {
      logConfigError(logger, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format task mappings for settings display
 */
export function formatTaskMappings(mappings: TaskTypeMapping): string {
  return JSON.stringify(mappings, null, 2);
}

/**
 * Parse task mappings from settings
 */
export function parseTaskMappings(json: string): TaskTypeMapping | null {
  try {
    const parsed = JSON.parse(json);
    const validSources = ['subscription', 'api-credits', 'ollama', 'auto'];

    for (const [taskType, source] of Object.entries(parsed)) {
      if (!validSources.includes(source as string)) {
        console.warn(
          `Invalid task mapping for ${taskType}: ${source}. Must be one of: ${validSources.join(', ')}`
        );
        return null;
      }
    }

    return parsed as TaskTypeMapping;
  } catch (error) {
    console.error('Failed to parse task mappings:', error);
    return null;
  }
}
