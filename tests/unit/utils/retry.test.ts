/**
 * tests/unit/utils/retry.test.ts
 *
 * Unit tests for retry.ts
 * Tests retry logic with exponential backoff, jitter, and error handling.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  retry,
  retryOnError,
  retryNetwork,
  createRetryable,
  sleep,
  DEFAULT_RETRY_CONFIG,
  RetryError,
  type RetryConfig,
} from '@src/utils/retry';

describe('retry', () => {
  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have default maxAttempts of 3', () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
    });

    it('should have default initialDelay of 1000ms', () => {
      expect(DEFAULT_RETRY_CONFIG.initialDelay).toBe(1000);
    });

    it('should have default multiplier of 2', () => {
      expect(DEFAULT_RETRY_CONFIG.multiplier).toBe(2);
    });

    it('should have default maxDelay of 10000ms', () => {
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(10000);
    });

    it('should have default jitterFactor of 0.1', () => {
      expect(DEFAULT_RETRY_CONFIG.jitterFactor).toBe(0.1);
    });
  });

  describe('retry with successful function', () => {
    it('should return result on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return result with no config', async () => {
      const fn = vi.fn().mockResolvedValue(42);

      const result = await retry(fn);

      expect(result).toBe(42);
    });

    it('should work with different return types', async () => {
      const stringFn = vi.fn().mockResolvedValue('string result');
      const numberFn = vi.fn().mockResolvedValue(123);
      const objectFn = vi.fn().mockResolvedValue({ key: 'value' });
      const arrayFn = vi.fn().mockResolvedValue([1, 2, 3]);

      await expect(retry(stringFn)).resolves.toBe('string result');
      await expect(retry(numberFn)).resolves.toBe(123);
      await expect(retry(objectFn)).resolves.toEqual({ key: 'value' });
      await expect(retry(arrayFn)).resolves.toEqual([1, 2, 3]);
    });
  });

  describe('retry with failures', () => {
    it('should retry on error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times before success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should return final error after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(retry(fn, { maxAttempts: 3 })).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw RetryError with correct message', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));

      try {
        await retry(fn, { maxAttempts: 2 });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryError);
        expect((error as RetryError).message).toContain('Failed after');
        expect((error as RetryError).attempt).toBe(2);
        expect((error as RetryError).lastError).toBeInstanceOf(Error);
      }
    });

    it('should include last error in RetryError', async () => {
      const originalError = new Error('Original error');
      const fn = vi.fn().mockRejectedValue(originalError);

      try {
        await retry(fn, { maxAttempts: 2 });
        fail('Should have thrown');
      } catch (error) {
        expect((error as RetryError).lastError).toBe(originalError);
      }
    });
  });

  describe('retry with custom config', () => {
    it('should use custom maxAttempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Error'));

      await expect(retry(fn, { maxAttempts: 5, initialDelay: 10, jitterFactor: 0 })).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(5);
    }, 10000);

    it('should use custom initialDelay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retry(fn, { initialDelay: 10, jitterFactor: 0 });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(100); // Allow some margin
    });

    it('should use custom multiplier', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retry(fn, {
        initialDelay: 10,
        multiplier: 2,
        jitterFactor: 0,
      });

      const elapsed = Date.now() - startTime;
      // First retry: 10ms, Second retry: 20ms = 30ms total
      expect(elapsed).toBeGreaterThanOrEqual(30);
      expect(elapsed).toBeLessThan(100);
    });

    it('should cap delay at maxDelay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retry(fn, {
        initialDelay: 100,
        multiplier: 10,
        maxDelay: 50,
        jitterFactor: 0,
      });

      const elapsed = Date.now() - startTime;
      // First retry: 50ms (capped), Second retry: 50ms (capped) = 100ms total
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);
    });

    it('should apply jitter when configured', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValue('success');

      // Run twice to test randomness
      const delay1 = Date.now();
      await retry(fn, {
        initialDelay: 50,
        jitterFactor: 0.5,
      });
      const elapsed1 = Date.now() - delay1;

      const delay2 = Date.now();
      await retry(fn, {
        initialDelay: 50,
        jitterFactor: 0.5,
      });
      const elapsed2 = Date.now() - delay2;

      // With 50% jitter, delays should be different (with high probability)
      expect(elapsed1).not.toBe(elapsed2);
    });
  });

  describe('retry with shouldRetry predicate', () => {
    it('should retry when shouldRetry returns true', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Retryable error'))
        .mockResolvedValue('success');

      const result = await retry(fn, {
        shouldRetry: () => true,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry when shouldRetry returns false', async () => {
      const error = new Error('Non-retryable error');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retry(fn, {
        shouldRetry: () => false,
      })).rejects.toThrow(RetryError);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use shouldRetry with error type checking', async () => {
      const networkError = new Error('ECONNRESET');
      const fn = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await retry(fn, {
        shouldRetry: (error) => error instanceof Error && error.message.includes('ECONNRESET'),
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying on non-retryable error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Retryable'))
        .mockRejectedValueOnce(new Error('Non-retryable'))
        .mockResolvedValue('success');

      await expect(retry(fn, {
        shouldRetry: (error) => error instanceof Error && error.message === 'Retryable',
      })).rejects.toThrow(RetryError);

      expect(fn).toHaveBeenCalledTimes(2); // First retryable, second non-retryable stops
    });
  });

  describe('retryOnError', () => {
    it('should wrap retry with isErrorRetryable predicate', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await retryOnError(
        fn,
        (error) => error instanceof Error && error.message.includes('Network'),
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass config through to retry', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const result = await retryOnError(
        fn,
        () => true,
        { maxAttempts: 5 },
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    });
  });

  describe('retryNetwork', () => {
    it('should retry on ECONNRESET error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ETIMEDOUT error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNREFUSED error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ENOTFOUND error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ENOTFOUND'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ENETUNREACH error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ENETUNREACH'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on fetch failed error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on NetworkError', async () => {
      const error = new Error('NetworkError');
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-network errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(retryNetwork(fn)).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass config through', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await retryNetwork(fn, { maxAttempts: 5 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('createRetryable', () => {
    it('should create a retryable function wrapper', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const retryableFn = createRetryable(fn);
      const result = await retryableFn();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to wrapped function', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const retryableFn = createRetryable(fn);
      await retryableFn('arg1', 'arg2', 123);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should handle async functions correctly', async () => {
      const asyncFn = async (data: string) => {
        if (data === 'fail') throw new Error('Failed');
        return `Processed: ${data}`;
      };

      const retryableFn = createRetryable(asyncFn);
      const result = await retryableFn('success');

      expect(result).toBe('Processed: success');
    });

    it('should preserve function signature', async () => {
      interface DataProcessor {
        (input: number): Promise<number>;
      }

      const processor: DataProcessor = async (n: number) => n * 2;
      const retryableProcessor = createRetryable(processor);

      const result = await retryableProcessor(5);
      expect(result).toBe(10);
    });

    it('should pass config to createRetryable', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const retryableFn = createRetryable(fn, { maxAttempts: 5, initialDelay: 10, jitterFactor: 0 });
      const result = await retryableFn();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(4);
    }, 10000);
  });

  describe('sleep', () => {
    it('should sleep for specified milliseconds', async () => {
      const startTime = Date.now();
      await sleep(50);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(100);
    });

    it('should sleep for 0 milliseconds', async () => {
      const startTime = Date.now();
      await sleep(0);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10);
    });

    it('should resolve after sleep', async () => {
      const result = await sleep(10);
      expect(result).toBeUndefined();
    });
  });

  describe('RetryError', () => {
    it('should create RetryError with message', () => {
      const error = new RetryError('Test message', new Error('Original'), 3);

      expect(error.message).toBe('Test message');
      expect(error.name).toBe('RetryError');
    });

    it('should store lastError', () => {
      const originalError = new Error('Original error');
      const retryError = new RetryError('Failed', originalError, 2);

      expect(retryError.lastError).toBe(originalError);
    });

    it('should store attempt count', () => {
      const retryError = new RetryError('Failed', new Error(), 5);

      expect(retryError.attempt).toBe(5);
    });

    it('should be instanceof Error', () => {
      const retryError = new RetryError('Failed', null, 1);

      expect(retryError).toBeInstanceOf(Error);
    });
  });

  describe('integration tests', () => {
    it('should handle real-world retry scenario', async () => {
      let attempts = 0;
      const flakyFn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Service unavailable');
        }
        return 'success';
      });

      const result = await retry(flakyFn, {
        maxAttempts: 5,
        initialDelay: 10,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(flakyFn).toHaveBeenCalledTimes(3);
    });

    it('should handle config merging', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const partialConfig: Partial<RetryConfig> = {
        maxAttempts: 1,
        initialDelay: 50,
      };

      await retry(fn, partialConfig);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle empty config object', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await retry(fn, {});

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined config', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await retry(fn);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle maxAttempts of 1 (no retry)', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Error'));

      await expect(retry(fn, { maxAttempts: 1 })).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle very large maxAttempts', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retry(fn, { maxAttempts: 100 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle zero initialDelay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const result = await retry(fn, {
        initialDelay: 0,
        jitterFactor: 0,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle jitterFactor of 0 (no jitter)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retry(fn, {
        initialDelay: 10,
        jitterFactor: 0,
      });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(20); // 10 + 10
    });

    it('should handle jitterFactor of 1 (max jitter)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const delay1 = Date.now();
      await retry(fn, {
        initialDelay: 100,
        jitterFactor: 1,
      });
      const elapsed1 = Date.now() - delay1;

      // With 100% jitter, delay should vary between 0 and 200
      expect(elapsed1).toBeGreaterThanOrEqual(0);
      expect(elapsed1).toBeLessThan(200);
    });
  });
});
