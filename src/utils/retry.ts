/**
 * src/utils/retry.ts
 *
 * Retry Logic
 *
 * Retry logic for endpoint checks, no VS Code API imports.
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay?: number;
  backoffFactor?: number;
  timeoutMs?: number;
  jitter?: boolean;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (info: { attemptNumber: number; error: Error; delay: number }) => void;
  onComplete?: (result: RetryResult<unknown>) => void;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
}

type AsyncResult<T> = RetryResult<T>;

function calculateDelay(
  attempt: number,
  initialDelay: number,
  config: RetryConfig
): number {
  const backoffFactor = config.backoffFactor ?? 2;
  const maxDelay = config.maxDelay ?? 30000;
  let delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
  delay = Math.min(delay, maxDelay);

  // Add jitter if enabled
  if (config.jitter) {
    const jitterAmount = delay * 0.1; // 10% jitter
    delay = delay - jitterAmount / 2 + Math.random() * jitterAmount;
  }

  return delay;
}

export class RetryUtils {
  /**
   * Executes an async operation with retry logic.
   *
   * @param operation - Async function to execute
   * @param config - Retry configuration
   * @returns Result of the operation
   */
  public static async retry<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<AsyncResult<T>> {
    let lastError: Error | undefined;
    let actualAttempts = 0;
    // Reserved for future duration tracking
    const startTime = Date.now();
    void startTime; // Suppress unused warning



    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      actualAttempts = attempt;
      try {
        let resultPromise = operation();

        // Apply timeout if configured
        if (config.timeoutMs) {
          resultPromise = Promise.race([
            resultPromise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error('Operation timeout')), config.timeoutMs)
            ),
          ]) as Promise<T>;
        }

        const value = await resultPromise;

        const result: AsyncResult<T> = {
          success: true,
          value,
          attempts: attempt,
        };

        config.onComplete?.(result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (
          config.shouldRetry &&
          !config.shouldRetry(lastError)
        ) {
          break;
        }

        // Don't retry after last attempt
        if (attempt >= config.maxAttempts) {
          break;
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt, config.initialDelay, config);

        config.onRetry?.({
          attemptNumber: attempt,
          error: lastError,
          delay,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const failureResult: AsyncResult<T> = {
      success: false,
      error: lastError,
      attempts: actualAttempts,
    };

    config.onComplete?.(failureResult);
    return failureResult;
  }

  /**
   * Creates a default retry configuration.
   */
  public static createDefaultConfig(overrides?: Partial<RetryConfig>): RetryConfig {
    return {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 2,
      maxDelay: 30000,
      jitter: true,
      shouldRetry: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        return !msg.includes('ETIMEDOUT'); // Don't retry timeouts
      },
      ...overrides,
    };
  }

  /**
   * Creates a no-retry configuration (single attempt, no delay).
   */
  public static createNoRetryConfig(): RetryConfig {
    return {
      maxAttempts: 1,
      initialDelay: 0,
    };
  }

  /**
   * Creates an aggressive retry configuration (many attempts, short delays).
   */
  public static createAggressiveConfig(): RetryConfig {
    return {
      maxAttempts: 5,
      initialDelay: 200,
      backoffFactor: 1.5,
      maxDelay: 5000,
      jitter: true,
    };
  }
}
