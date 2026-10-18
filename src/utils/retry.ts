/**
 * Pure logic retry utility
 *
 * Constitution requirement: MUST NOT import vscode module
 * Pure logic utilities only
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
 /**
  * Maximum number of retry attempts
  */
 maxAttempts: number;
 /**
  * Initial delay in milliseconds (exponentially grows)
  */
 initialDelay: number;
 /**
  * Multiplier for exponential backoff (e.g., 2 doubles each time)
  */
 multiplier: number;
 /**
  * Maximum delay cap in milliseconds
  */
 maxDelay: number;
 /**
  * Jitter randomness factor (0-1) to avoid thundering herd
  * 0 = no jitter, 0.5 = 50% random variation
  */
 jitterFactor: number;
 /**
  * Whether to retry on specific error types
  * Returns true if error is retryable
  */
 shouldRetry?: (error: unknown) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
 maxAttempts: 3,
 initialDelay: 1000,
 multiplier: 2,
 maxDelay: 10000,
 jitterFactor: 0.1,
};

/**
 * Retry error with attempt count
 */
export class RetryError extends Error {
 constructor(
  message: string,
  public readonly lastError: unknown,
  public readonly attempt: number,
 ) {
  super(message);
  this.name = 'RetryError';
 }
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
 const exponentialDelay = config.initialDelay * Math.pow(config.multiplier, attempt - 1);
 const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

 // Add jitter: delay ± jitterFactor * delay
 const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
 return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Sleep for specified milliseconds (pure logic simulation)
 * In real implementation, this would use setTimeout, but for pure logic we simulate timing
 */
export async function sleep(ms: number): Promise<void> {
 await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result of successful execution
 * @throws RetryError if all attempts fail
 */
export async function retry<T>(
 fn: () => Promise<T>,
 config: Partial<RetryConfig> = {},
): Promise<T> {
 const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
 let lastError: unknown;

 for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
  try {
   return await fn();
  } catch (error) {
   lastError = error;
   const isRetryable = finalConfig.shouldRetry ? finalConfig.shouldRetry(error) : true;

   if (attempt === finalConfig.maxAttempts || !isRetryable) {
    throw new RetryError(
     `Failed after ${attempt} attempt${attempt > 1 ? 's' : ''}`,
     lastError,
     attempt,
    );
   }

   const delay = calculateDelay(attempt, finalConfig);
   await sleep(delay);
  }
 }

 throw new RetryError(
  `Failed after ${finalConfig.maxAttempts} attempts`,
  lastError,
  finalConfig.maxAttempts,
 );
}

/**
 * Execute function with retry for specific error conditions
 *
 * @param fn - Async function to execute
 * @param isErrorRetryable - Predicate to check if error is retryable
 * @param config - Retry configuration
 * @returns Result of successful execution
 * @throws RetryError if all attempts fail
 */
export async function retryOnError<T>(
 fn: () => Promise<T>,
 isErrorRetryable: (error: unknown) => boolean,
 config: Partial<RetryConfig> = {},
): Promise<T> {
 return retry(fn, { ...config, shouldRetry: isErrorRetryable });
}

/**
 * Execute function with retry for network-related errors
 */
export async function retryNetwork<T>(
 fn: () => Promise<T>,
 config: Partial<RetryConfig> = {},
): Promise<T> {
 return retryOnError(fn, (error): boolean => {
  if (error instanceof Error) {
   // Retry on network-related errors
   const retryablePatterns = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ENETUNREACH',
    'fetch failed',
    'NetworkError',
    'timeout',
   ];
   return retryablePatterns.some((pattern) => error.name.includes(pattern) || error.message.includes(pattern));
  }
  return false;
 }, config);
}

/**
 * Create a retryable function wrapper
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
 fn: T,
 config: Partial<RetryConfig> = {},
): T {
 return (async (...args: unknown[]) => retry(() => fn(...args), config)) as T;
}
