/**
 * Quota Cache - In-memory quota state management
 *
 * Tracks subscription quota and API credits balance with derived field calculations
 * and caching to minimize API calls.
 */

import type * as vscode from 'vscode';
import type { QuotaSnapshot } from '../routing/routing-engine';
import { fetchAPIBalance } from './quota-provider';

/**
 * Subscription quota state (user-manual tracking per research finding)
 */
export interface SubscriptionQuotaState {
  plan: 'pro' | 'max';
  dailyLimit: number;
  rollingWindowDays: number;
  rollingWindowStart: string; // ISO 8601 date
  rollingWindowEnd: string; // ISO 8601 date
  currentUsage: number;
  remainingQuota: number; // Derived: dailyLimit * rollingWindowDays - currentUsage
  percentUsed: number; // Derived: (currentUsage / (dailyLimit * rollingWindowDays)) * 100
  lastFetchTime: number; // Unix timestamp (ms)
  stale: boolean;
}

/**
 * API credits balance state
 */
export interface APICreditsBalance {
  balance: number;
  lastFetchTime: number; // Unix timestamp (ms)
  stale: boolean;
  authenticated: boolean;
}

/**
 * Ollama/Harvey availability state
 */
export interface OllamaState {
  available: boolean;
  harveyReachable: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}

/**
 * Quota cache - Tracks all quota states
 */
export interface QuotaCache {
  subscription: SubscriptionQuotaState;
  apiCredits: APICreditsBalance;
  ollama: OllamaState;
}

/**
 * Create quota snapshot for display/status bar
 */
export function quotaSnapshot(_cache: QuotaCache): QuotaSnapshot {
  // Implementation to be completed after QuotaSnapshot type is defined in routing-engine.ts
  throw new Error('quotaSnapshot not implemented yet - depends on routing-engine.ts exports');
}

// ============================================================
// APICreditsBalance Manager
// ============================================================

/**
 * Initialize API credits balance from SecretStorage
 */
export async function initializeAPICredits(
  secretStorage: vscode.SecretStorage
): Promise<APICreditsBalance> {
  const apiKey = await secretStorage.get('claude.api-key');
  const authenticated = apiKey !== undefined;

  try {
    const balance = await fetchAPIBalance(secretStorage);

    if (balance !== null) {
      return {
        balance,
        authenticated,
        stale: false,
        lastFetchTime: Date.now()
      };
    }

    // No balance data available (stub returns null)
    return {
      balance: 0,
      authenticated,
      stale: false,
      lastFetchTime: Date.now()
    };
  } catch {
    // On error, return unauthenticated state
    return {
      balance: 0,
      authenticated: false,
      stale: false,
      lastFetchTime: 0
    };
  }
}

/**
 * Decrement API credits balance by token count
 */
export function decrementBalance(
  state: APICreditsBalance,
  tokens: number
): APICreditsBalance {
  const newBalance = Math.max(0, state.balance - tokens);

  return {
    ...state,
    balance: newBalance
  };
}

/**
 * Refresh balance from provider
 */
export async function refreshBalance(
  state: APICreditsBalance,
  secretStorage: vscode.SecretStorage
): Promise<APICreditsBalance> {
  if (!state.authenticated) {
    return state;
  }

  try {
    const balance = await fetchAPIBalance(secretStorage);

    if (balance !== null) {
      return {
        ...state,
        balance,
        stale: false,
        lastFetchTime: Date.now()
      };
    }

    return state;
  } catch {
    // On refresh error, mark as stale but keep existing balance
    return {
      ...state,
      stale: true
    };
  }
}

/**
 * Check if API credits are exhausted
 */
export function isCreditsExhausted(state: APICreditsBalance): boolean {
  return state.balance <= 0;
}

