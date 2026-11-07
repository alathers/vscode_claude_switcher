/**
 * tests/unit/core/status/status-tracker.test.ts
 *
 * Status Tracker Unit Tests
 *
 * Tests endpoint connectivity status tracking, latency monitoring (no VS Code API imports).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EndpointStatus,
  StatusTracker,
  ConnectivityResult,
} from '../../../../src/core/status/status-tracker.js';

describe('StatusTracker', () => {
  let tracker: StatusTracker;

  beforeEach(() => {
    tracker = new StatusTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  describe('Status Management', () => {
    it('should initialize endpoint as untested', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const status = tracker.getStatus(endpointId);
      expect(status).toBe('untested');
    });

    it('should update status to connected', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);
      tracker.updateStatus(endpointId, 'connected');

      const status = tracker.getStatus(endpointId);
      expect(status).toBe('connected');
    });

    it('should update status to unreachable', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);
      tracker.updateStatus(endpointId, 'unreachable');

      const status = tracker.getStatus(endpointId);
      expect(status).toBe('unreachable');
    });

    it('should return untested for non-existent endpoint', () => {
      const status = tracker.getStatus('non-existent');
      expect(status).toBe('untested');
    });

    it('should list all statuses', () => {
      tracker.initialize('ep-1');
      tracker.initialize('ep-2');
      tracker.updateStatus('ep-1', 'connected');

      const statuses = tracker.getAllStatuses();

      expect(statuses).toEqual({
        'ep-1': 'connected',
        'ep-2': 'untested',
      });
    });

    it('should return empty object when no statuses tracked', () => {
      const statuses = tracker.getAllStatuses();
      expect(statuses).toEqual({});
    });
  });

  describe('Latency Tracking', () => {
    it('should record latency for endpoint', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);
      tracker.recordLatency(endpointId, 123);

      const latency = tracker.getLatency(endpointId);
      expect(latency).toBe(123);
    });

    it('should return undefined for endpoint with no latency', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const latency = tracker.getLatency(endpointId);
      expect(latency).toBeUndefined();
    });

    it('should handle latency below 1ms', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);
      tracker.recordLatency(endpointId, 0.5);

      const latency = tracker.getLatency(endpointId);
      expect(latency).toBe(0.5);
    });

    it('should handle large latency values', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);
      tracker.recordLatency(endpointId, 5000);

      const latency = tracker.getLatency(endpointId);
      expect(latency).toBe(5000);
    });
  });

  describe('Connectivity Check Simulation', () => {
    it('should simulate successful connectivity check', async () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const mockCheck = vi.fn().mockResolvedValue({
        success: true,
        latency: 45,
      });

      const result = await tracker.checkConnectivity(endpointId, mockCheck);

      expect(result.success).toBe(true);
      expect(result.latency).toBe(45);
      expect(tracker.getStatus(endpointId)).toBe('connected');
      expect(tracker.getLatency(endpointId)).toBe(45);
    });

    it('should simulate failed connectivity check', async () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const mockCheck = vi.fn().mockResolvedValue({
        success: false,
        error: 'Connection refused',
      });

      const result = await tracker.checkConnectivity(endpointId, mockCheck);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(tracker.getStatus(endpointId)).toBe('unreachable');
    });

    it('should handle connectivity check exceptions', async () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const mockCheck = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await tracker.checkConnectivity(endpointId, mockCheck);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(tracker.getStatus(endpointId)).toBe('unreachable');
    });
  });

  describe('Latency History', () => {
    it('should record latency history', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      tracker.recordLatency(endpointId, 100);
      tracker.recordLatency(endpointId, 150);
      tracker.recordLatency(endpointId, 125);

      const history = tracker.getLatencyHistory(endpointId);

      expect(history).toEqual([100, 150, 125]);
    });

    it('should return empty array for no history', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const history = tracker.getLatencyHistory(endpointId);
      expect(history).toEqual([]);
    });

    it('should limit history size', () => {
      const endpointId = 'ep-123';
      const limitedTracker = new StatusTracker({ historySize: 3 });
      limitedTracker.initialize(endpointId);

      limitedTracker.recordLatency(endpointId, 10);
      limitedTracker.recordLatency(endpointId, 20);
      limitedTracker.recordLatency(endpointId, 30);
      limitedTracker.recordLatency(endpointId, 40);
      limitedTracker.recordLatency(endpointId, 50);

      const history = limitedTracker.getLatencyHistory(endpointId);

      expect(history).toEqual([30, 40, 50]); // Only last 3
    });

    it('should calculate average latency', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      tracker.recordLatency(endpointId, 100);
      tracker.recordLatency(endpointId, 200);
      tracker.recordLatency(endpointId, 150);

      const avg = tracker.getAverageLatency(endpointId);

      expect(avg).toBe(150);
    });

    it('should return undefined for average when no history', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const avg = tracker.getAverageLatency(endpointId);
      expect(avg).toBeUndefined();
    });
  });

  describe('Timestamping', () => {
    it('should record last check timestamp', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const beforeMs = Date.now();
      tracker.updateStatus(endpointId, 'connected');
      const afterMs = Date.now();

      const timestamp = tracker.getLastChecked(endpointId);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp!.getTime()).toBeGreaterThanOrEqual(beforeMs);
      expect(timestamp!.getTime()).toBeLessThanOrEqual(afterMs);
    });

    it('should return undefined for untracked endpoint', () => {
      const timestamp = tracker.getLastChecked('non-existent');
      expect(timestamp).toBeUndefined();
    });

    it('should update timestamp on latency recording', () => {
      const endpointId = 'ep-123';
      tracker.initialize(endpointId);

      const beforeMs = Date.now();
      tracker.recordLatency(endpointId, 123);
      const afterMs = Date.now();

      const timestamp = tracker.getLastChecked(endpointId);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp!.getTime()).toBeGreaterThanOrEqual(beforeMs);
      expect(timestamp!.getTime()).toBeLessThanOrEqual(afterMs);
    });
  });

  describe('Batch Operations', () => {
    it('should check all endpoints', async () => {
      tracker.initialize('ep-1');
      tracker.initialize('ep-2');
      tracker.initialize('ep-3');

      const mockCheck = vi.fn() // Simulate mixed success
        .mockResolvedValueOnce({ success: true, latency: 100 })
        .mockResolvedValueOnce({ success: false, error: 'Timeout' })
        .mockResolvedValueOnce({ success: true, latency: 200 });

      const results = await tracker.checkAll(['ep-1', 'ep-2', 'ep-3'], mockCheck);

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should handle empty endpoint list in bulk check', async () => {
      const results = await tracker.checkAll([], () => Promise.resolve({ success: true }));
      expect(results).toEqual([]);
    });

    it('should get summary of all endpoints', () => {
      tracker.initialize('ep-1');
      tracker.initialize('ep-2');
      tracker.updateStatus('ep-1', 'connected');
      tracker.updateStatus('ep-2', 'unreachable');
      tracker.recordLatency('ep-1', 100);

      const summary = tracker.getSummary();

      expect(summary.total).toBe(2);
      expect(summary.connected).toBe(1);
      expect(summary.unreachable).toBe(1);
      expect(summary.untested).toBe(0);
    });
  });

  describe('Caching and Expiration', () => {
    it('should cache status results', () => {
      tracker.initialize('ep-1');
      tracker.updateStatus('ep-1', 'connected');

      const cached = tracker.getStatus('ep-1');
      expect(cached).toBe('connected');
    });

    it('should invalidate cache after TTL', async () => {
      const trackerWithTTL = new StatusTracker({ cacheTTL: 100 }); // 100ms TTL
      trackerWithTTL.initialize('ep-1');
      trackerWithTTL.updateStatus('ep-1', 'connected');

      // Immediately should still be cached
      expect(trackerWithTTL.getStatus('ep-1')).toBe('connected');

      // After TTL, should be untested again
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(trackerWithTTL.getStatus('ep-1')).toBe('untested');
    });

    it('should handle TTL of 0 (no caching)', () => {
      const trackerNoCache = new StatusTracker({ cacheTTL: 0 });
      trackerNoCache.initialize('ep-1');
      trackerNoCache.updateStatus('ep-1', 'connected');

      // With 0 TTL, status is still accessible immediately
      expect(trackerNoCache.getStatus('ep-1')).toBe('connected');
    });
  });

  describe('Utility Methods', () => {
    it('should check if endpoint is connected', () => {
      tracker.initialize('ep-1');
      tracker.updateStatus('ep-1', 'connected');

      expect(tracker.isConnected('ep-1')).toBe(true);
      expect(tracker.isConnected('ep-2')).toBe(false);
    });

    it('should check if endpoint is unreachable', () => {
      tracker.initialize('ep-1');
      tracker.updateStatus('ep-1', 'unreachable');

      expect(tracker.isUnreachable('ep-1')).toBe(true);
      expect(tracker.isUnreachable('ep-2')).toBe(false);
    });

    it('should check if endpoint is untested', () => {
      tracker.initialize('ep-1');

      expect(tracker.isUntested('ep-1')).toBe(true);
      expect(tracker.isUntested('ep-2')).toBe(false);
    });

    it('should clear all tracked data', () => {
      tracker.initialize('ep-1');
      tracker.initialize('ep-2');
      tracker.updateStatus('ep-1', 'connected');

      tracker.clear();

      expect(tracker.getStatus('ep-1')).toBe('untested');
      expect(tracker.getAllStatuses()).toEqual({});
    });

    it('should remove specific endpoint from tracking', () => {
      tracker.initialize('ep-1');
      tracker.initialize('ep-2');
      tracker.updateStatus('ep-1', 'connected');

      tracker.remove('ep-1');

      expect(tracker.getStatus('ep-1')).toBe('untested');
      expect(tracker.getStatus('ep-2')).toBe('untested');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid status updates', () => {
      tracker.initialize('ep-1');

      // Should not throw, just ignore invalid status
      expect(() => {
        tracker.updateStatus('ep-1', 'invalid-status' as EndpointStatus);
      }).not.toThrow();
    });

    it('should handle negative latency values', () => {
      tracker.initialize('ep-1');

      tracker.recordLatency('ep-1', -10);

      // Should store negative value (implementation choice)
      expect(tracker.getLatency('ep-1')).toBe(-10);
    });
  });
});
