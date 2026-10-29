/**
 * Quota Tracker - User-manual subscription quota tracking
 *
 * No official subscription API available per research finding.
 * This module provides manual tracking for Pro/Max plans with rolling windows.
 */

import type { SubscriptionQuotaState } from './quota-cache';
import type { Logger } from '../../utils/logger';

// Logger instance for quota tracking (will be set by extension)
let quotaLogger: Logger | null = null;

/**
 * Set logger for quota tracking
 */
export function setQuotaLogger(logger: Logger): void {
  quotaLogger = logger;
}

/**
 * Get logger instance
 */
export function getQuotaLogger(): Logger | null {
  return quotaLogger;
}

/**
 * Initialize subscription quota state
 */
export function initializeSubscriptionQuota(
  plan: 'pro' | 'max',
  dailyLimit: number,
  rollingWindowDays: number
): SubscriptionQuotaState {
  const today = new Date().toISOString().split('T')[0];
  const rollingWindowEnd = new Date();
  rollingWindowEnd.setDate(rollingWindowEnd.getDate() + rollingWindowDays);
  const end = rollingWindowEnd.toISOString().split('T')[0];

  const totalQuota = dailyLimit * rollingWindowDays;

  return {
    plan,
    dailyLimit,
    rollingWindowDays,
    rollingWindowStart: today,
    rollingWindowEnd: end,
    currentUsage: 0,
    remainingQuota: totalQuota,
    percentUsed: 0,
    lastFetchTime: Date.now(),
    stale: false
  };
}

/**
 * Increment usage tracking
 */
export function incrementUsage(state: SubscriptionQuotaState, count: number = 1): SubscriptionQuotaState {
  const newUsage = Math.max(0, state.currentUsage + count);
  const totalQuota = state.dailyLimit * state.rollingWindowDays;

  if (quotaLogger) {
    quotaLogger.info('QuotaTracker', `Incremented usage by ${count}`, {
      plan: state.plan,
      previousUsage: state.currentUsage,
      newUsage,
      remainingQuota: totalQuota - newUsage,
      percentUsed: Math.round((newUsage / totalQuota) * 100)
    });
  }

  return {
    ...state,
    currentUsage: newUsage,
    remainingQuota: totalQuota - newUsage,
    percentUsed: (newUsage / totalQuota) * 100,
    lastFetchTime: Date.now(),
    stale: false
  };
}

/**
 * Check if quota is exhausted
 */
export function isExhausted(state: SubscriptionQuotaState): boolean {
  return state.currentUsage >= state.dailyLimit * state.rollingWindowDays;
}

/**
 * Reset quota (manual reset or rolling window reset)
 */
export function resetUsage(state: SubscriptionQuotaState): SubscriptionQuotaState {
  const totalQuota = state.dailyLimit * state.rollingWindowDays;

  if (quotaLogger) {
    quotaLogger.info('QuotaTracker', 'Reset quota usage to 0', {
      plan: state.plan,
      previousUsage: state.currentUsage,
      remainingQuota: totalQuota
    });
  }

  return {
    ...state,
    currentUsage: 0,
    remainingQuota: totalQuota,
    percentUsed: 0,
    lastFetchTime: Date.now()
  };
}

/**
 * Check and handle rolling window reset
 * Call on extension startup and before each routing decision
 */
export function checkRollingWindowReset(state: SubscriptionQuotaState): SubscriptionQuotaState {
  const today = new Date().toISOString().split('T')[0];

  if (today > state.rollingWindowEnd) {
    // Rolling window has advanced, reset quota
    if (quotaLogger) {
      quotaLogger.info('QuotaTracker', 'Rolling window advanced, resetting quota', {
        plan: state.plan,
        previousWindowEnd: state.rollingWindowEnd,
        newWindowStart: today,
        previousUsage: state.currentUsage
      });
    }
    return resetUsage({
      ...state,
      rollingWindowStart: today,
      rollingWindowEnd: new Date(
        new Date(today).getTime() + state.rollingWindowDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0]
    });
  }

  return state;
}
