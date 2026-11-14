/**
 * Unit tests for Ollama (Harvey router) adapter
 *
 * Tests Harvey HTTP client communication and circuit breaker pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaAdapter,
  CircuitBreaker,
  HarveyRecommendation
} from '../../../../src/core/routing/ollama-adapter';
import { RoutingError } from '../../../../src/core/routing/routing-engine';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Ollama Adapter - Harvey HTTP Client', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter('http://localhost:11434');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getRecommendation', () => {
    it('returns parsed Harvey recommendation on success', async () => {
      const mockResponse: HarveyRecommendation = {
        routedTo: 'ollama',
        model: 'llama3.2',
        confidence: 0.9
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await adapter.getRecommendation('code-review', 200);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/route',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('code-review')
        })
      );
    });

    it('sends correct request body to Harvey', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routedTo: 'ollama', model: 'llama3.2', confidence: 0.85 })
      } as Response);

      await adapter.getRecommendation('generation', 200);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toEqual({
        taskType: 'generation',
        metadata: {
          features: ['language-detection']
        }
      });
    });

    it('throws RoutingError on connection refused', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      await expect(adapter.getRecommendation('code-review', 200))
        .rejects.toThrow(RoutingError);
      await expect(adapter.getRecommendation('code-review', 200))
        .rejects.toHaveProperty('code', 'HARVEY_UNREACHABLE');
    });

    it('throws RoutingError on timeout', async () => {
      adapter.resetCircuitBreaker();

      // Simulate AbortError (what happens when timeout triggers)
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      try {
        await adapter.getRecommendation('code-review', 200);
        throw new Error('Should have thrown timeout');
      } catch (error) {
        expect(error).toBeInstanceOf(RoutingError);
        expect((error as RoutingError).code).toBe('HARVEY_UNREACHABLE');
        expect((error as Error).message).toMatch(/timeout/);
      }
    });

    it('records circuit breaker success on valid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routedTo: 'ollama', model: 'llama3.2', confidence: 0.9 })
      } as Response);

      // Simulate some failures first to set circuit breaker to half-open
      adapter.resetCircuitBreaker();
      (adapter as any).circuitBreaker.state = 'half-open';

      await adapter.getRecommendation('code-review', 200);

      expect(adapter.getCircuitBreakerState()).toBe('closed');
    });

    it('handles HTTP 4xx/5xx responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(adapter.getRecommendation('code-review', 200))
        .rejects.toThrow(RoutingError);
      await expect(adapter.getRecommendation('code-review', 200))
        .rejects.toHaveProperty('code', 'HARVEY_UNREACHABLE');
    });

    it('uses default timeout of 200ms', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routedTo: 'ollama' })
      } as Response);

      await adapter.getRecommendation('code-review');

      // Verify no explicit timeout specified in call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('respects custom timeout parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routedTo: 'ollama' })
      } as Response);

      await adapter.getRecommendation('code-review', 300);

      // Verify call completed with custom timeout
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Circuit Breaker Pattern', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker();
  });

  describe('recordSuccess', () => {
    it('resets failure count to 0', () => {
      // Record some failures first
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe('closed');

      // Now record success
      circuitBreaker.recordSuccess();

      // State should be closed with no failures
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('sets state to closed', () => {
      circuitBreaker.state = 'half-open';
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('recordFailure', () => {
    it('increments failure count', () => {
      circuitBreaker.recordFailure();
      expect((circuitBreaker as any).failureCount).toBe(1);

      circuitBreaker.recordFailure();
      expect((circuitBreaker as any).failureCount).toBe(2);
    });

    it('opens circuit after 5 consecutive failures', () => {
      // Record 4 failures - circuit should remain closed
      for (let i = 0; i < 4; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe('closed');

      // 5th failure opens the circuit
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('open');
    });

    it('records last failure time', () => {
      const before = Date.now();
      circuitBreaker.recordFailure();
      const after = Date.now();

      const lastFailureTime = (circuitBreaker as any).lastFailureTime;
      expect(lastFailureTime).toBeGreaterThanOrEqual(before);
      expect(lastFailureTime).toBeLessThanOrEqual(after);
    });
  });

  describe('getState', () => {
    it('returns closed state initially', () => {
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('returns open state after threshold failures', () => {
      // Record 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe('open');
    });

    it('transitions to half-open after cooldown period', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe('open');

      // Manually set lastFailureTime to simulate cooldown elapsed (> 60 seconds)
      (circuitBreaker as any).lastFailureTime = Date.now() - 70000;

      expect(circuitBreaker.getState()).toBe('half-open');
    });

    it('remains open within cooldown period', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Set lastFailureTime to recent (within 60 second cooldown)
      (circuitBreaker as any).lastFailureTime = Date.now() - 30000;

      expect(circuitBreaker.getState()).toBe('open');
    });
  });

  describe('tryCircuitBreaker', () => {
    it('returns true when circuit is closed', () => {
      const result = circuitBreaker.tryCircuitBreaker();
      expect(result).toBe(true);
    });

    it('throws RoutingError when circuit is open', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe('open');

      try {
        circuitBreaker.tryCircuitBreaker();
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RoutingError);
        expect((error as RoutingError).code).toBe('HARVEY_UNREACHABLE');
        expect((error as Error).message).toContain('Circuit breaker open');
      }
    });

    it('allows requests when circuit is half-open', () => {
      // Open then transition to half-open
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      (circuitBreaker as any).lastFailureTime = Date.now() - 70000;

      expect(circuitBreaker.getState()).toBe('half-open');

      // Try should succeed in half-open state
      const result = circuitBreaker.tryCircuitBreaker();
      expect(result).toBe(true);
    });
  });

  describe('Integration with OllamaAdapter', () => {
    let adapter: OllamaAdapter;

    beforeEach(() => {
      adapter = new OllamaAdapter('http://localhost:11434');
      vi.clearAllMocks();
    });

    it('getCircuitBreakerState returns correct state', () => {
      expect(adapter.getCircuitBreakerState()).toBe('closed');

      // Simulate failures
      for (let i = 0; i < 5; i++) {
        (adapter as any).circuitBreaker.recordFailure();
      }

      expect(adapter.getCircuitBreakerState()).toBe('open');
    });

    it('resetCircuitBreaker resets to closed state', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        (adapter as any).circuitBreaker.recordFailure();
      }
      expect(adapter.getCircuitBreakerState()).toBe('open');

      // Reset it
      adapter.resetCircuitBreaker();
      expect(adapter.getCircuitBreakerState()).toBe('closed');
    });

    it('circuit breaker transitions from half-open to closed on success', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        (adapter as any).circuitBreaker.recordFailure();
      }

      // Transition to half-open (simulate cooldown)
      (adapter as any).circuitBreaker.lastFailureTime = Date.now() - 70000;
      expect(adapter.getCircuitBreakerState()).toBe('half-open');

      // Success should close the circuit
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routedTo: 'ollama' })
      } as Response);

      await adapter.getRecommendation('code-review', 200);
      expect(adapter.getCircuitBreakerState()).toBe('closed');
    });
  });
});
