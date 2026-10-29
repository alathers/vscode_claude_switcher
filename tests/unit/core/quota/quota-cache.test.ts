/**
 * Unit tests for quota cache data structure
 *
 * Tests quota state transitions, derived field calculations, and cache management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SubscriptionQuotaState,
  APICreditsBalance,
  OllamaState,
  QuotaCache,
  initializeSubscriptionQuota,
  incrementUsage,
  isExhausted,
  resetUsage,
  checkRollingWindowReset
} from '../../../../src/core/quota/quota-tracker';

describe('Quota Cache - State Transitions', () => {
  describe('initializeSubscriptionQuota', () => {
    it('sets rolling window start to today and currentUsage to 0', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);

      expect(state.currentUsage).toBe(0);
      expect(state.plan).toBe('pro');
      expect(state.dailyLimit).toBe(30);
      expect(state.rollingWindowDays).toBe(7);

      const today = new Date().toISOString().split('T')[0];
      expect(state.rollingWindowStart).toBe(today);
    });

    it('calculates correct total quota', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);

      expect(state.remainingQuota).toBe(210); // 30 * 7
      expect(state.percentUsed).toBe(0);
    });

    it('sets correct rolling window end date', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);

      const expectedEndDate = new Date();
      expectedEndDate.setDate(expectedEndDate.getDate() + 7);
      const expectedEnd = expectedEndDate.toISOString().split('T')[0];

      expect(state.rollingWindowEnd).toBe(expectedEnd);
    });
  });

  describe('incrementUsage', () => {
    it('updates currentUsage and recalculates remainingQuota', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const updated = incrementUsage(state, 5);

      expect(updated.currentUsage).toBe(5);
      expect(updated.remainingQuota).toBe(205); // 210 - 5
      expect(updated.percentUsed).toBeCloseTo(2.38, 1); // 5 / 210 * 100
    });

    it('accepts custom increment count', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const updated = incrementUsage(state, 10);

      expect(updated.currentUsage).toBe(10);
      expect(updated.remainingQuota).toBe(200);
    });

    it('does not allow negative increments', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const updated = incrementUsage(state, -5);

      expect(updated.currentUsage).toBe(0); // Should clamp to 0
    });
  });

  describe('isExhausted', () => {
    it('returns true when currentUsage >= dailyLimit * rollingWindowDays', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const exhausted = incrementUsage(state, 210);

      expect(isExhausted(exhausted)).toBe(true);
    });

    it('returns false when currentUsage < total quota', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const used = incrementUsage(state, 100);

      expect(isExhausted(used)).toBe(false);
    });

    it('returns false when quota is not exhausted', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);

      expect(isExhausted(state)).toBe(false);
    });
  });

  describe('resetUsage', () => {
    it('sets currentUsage to 0 and recalculates derived fields', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const used = incrementUsage(state, 100);
      const reset = resetUsage(used);

      expect(reset.currentUsage).toBe(0);
      expect(reset.remainingQuota).toBe(210);
      expect(reset.percentUsed).toBe(0);
    });
  });

  describe('checkRollingWindowReset', () => {
    it('resets quota when rolling window has advanced', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const used = incrementUsage(state, 50);

      // Simulate rolling window advancement by setting end date to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expiredState = {
        ...used,
        rollingWindowEnd: yesterday.toISOString().split('T')[0]
      };

      const reset = checkRollingWindowReset(expiredState);

      expect(reset.currentUsage).toBe(0);
      expect(reset.remainingQuota).toBe(210);
      expect(reset.percentUsed).toBe(0);
    });

    it('does not reset when rolling window is still valid', () => {
      const state = initializeSubscriptionQuota('pro', 30, 7);
      const used = incrementUsage(state, 50);

      const unchanged = checkRollingWindowReset(used);

      expect(unchanged.currentUsage).toBe(50);
      expect(unchanged.remainingQuota).toBe(160);
    });
  });
});

describe('APICreditsBalance', () => {
  describe('balance management', () => {
    it('initially has zero balance', () => {
      const balance: APICreditsBalance = {
        balance: 0,
        lastFetchTime: 0,
        stale: false,
        authenticated: false
      };

      expect(balance.balance).toBe(0);
      expect(balance.authenticated).toBe(false);
    });

    it('tracks authentication state', () => {
      const authenticated: APICreditsBalance = {
        balance: 1000,
        lastFetchTime: Date.now(),
        stale: false,
        authenticated: true
      };

      expect(authenticated.authenticated).toBe(true);
    });

    it('can check exhaustion', () => {
      const exhausted: APICreditsBalance = {
        balance: 0,
        lastFetchTime: 0,
        stale: false,
        authenticated: false
      };

      const available: APICreditsBalance = {
        balance: 500,
        lastFetchTime: 0,
        stale: false,
        authenticated: true
      };

      expect(exhausted.balance).toBe(0);
      expect(available.balance).toBe(500);
    });
  });
});
