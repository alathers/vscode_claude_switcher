/**
 * Ollama Adapter - Harvey router HTTP client
 *
 * Manages communication with Harvey router service for Ollama routing.
 * Implements circuit breaker pattern for fault tolerance.
 */

import { RoutingError } from './routing-engine';

/**
 * Harvey recommendation response
 */
export interface HarveyRecommendation {
  routedTo: 'subscription' | 'api-credits' | 'ollama' | null;
  model?: string;
  confidence?: number;
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker for Harvey availability
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly cooldownMs = 60000; // 60 seconds

  getState(): CircuitBreakerState {
    // Check if cooldown period has elapsed
    if (this.state === 'open' && Date.now() - this.lastFailureTime > this.cooldownMs) {
      this.state = 'half-open';
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  tryCircuitBreaker(): boolean {
    const state = this.getState();
    if (state === 'open') {
      throw new RoutingError(
        'Circuit breaker open - too many failures, waiting for cooldown',
        'HARVEY_UNREACHABLE'
      );
    }
    return true;
  }
}

/**
 * Ollama adapter for Harvey router communication
 */
export class OllamaAdapter {
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(private readonly baseUrl: string) {}

  /**
   * Get routing recommendation from Harvey
   *
   * @param taskType - The type of task to route
   * @param timeoutMs - Request timeout (default 200ms per SC-003)
   */
  async getRecommendation(
    taskType: string,
    timeoutMs: number = 200
  ): Promise<HarveyRecommendation> {
    try {
      this.circuitBreaker.tryCircuitBreaker();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.baseUrl}/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskType,
          metadata: {
            features: ['language-detection']
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Record success on circuit breaker
      this.circuitBreaker.recordSuccess();

      return data as HarveyRecommendation;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const message = `Harvey request timeout after ${timeoutMs}ms (exceeds SC-003 target of 200ms)`;
        this.circuitBreaker.recordFailure();
        throw new RoutingError(message, 'HARVEY_UNREACHABLE');
      }

      if (error instanceof RoutingError) {
        this.circuitBreaker.recordFailure();
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.circuitBreaker.recordFailure();
      throw new RoutingError(`Harvey connection failed: ${message}`, 'HARVEY_UNREACHABLE');
    }
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker for testing
   */
  resetCircuitBreaker(): void {
    (this.circuitBreaker as any).state = 'closed';
    (this.circuitBreaker as any).failureCount = 0;
    (this.circuitBreaker as any).lastFailureTime = 0;
  }
}
