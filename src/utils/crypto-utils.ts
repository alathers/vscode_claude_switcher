/**
 * src/utils/crypto-utils.ts
 *
 * Crypto Utilities
 *
 * Hash and redaction helpers for secrets (no VS Code API imports).
 */

export class CryptoUtils {
  /**
   * Hashes a secret string using a simple hash function.
   * Not cryptographically secure, suitable for logging/tracing only.
   *
   * @param secret - Secret string to hash
   * @returns Hashed string representation
   */
  public static hashSecret(secret: string): string {
    if (secret === null || secret === undefined) {
      return '[null]';
    }

    const str = String(secret);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive and encode in hex-like format
    const positiveHash = Math.abs(hash);
    return Buffer.from(positiveHash.toString()).toString('base64').slice(0, 16);
  }

  /**
   * Redacts a secret string.
   *
   * @param secret - Secret string to redact (unused but kept for API consistency)
   * @param placeholder - Custom placeholder (default: '[REDACTED]')
   * @returns Redacted string
   */
  public static redactSecret(_secret: string | null | undefined, placeholder?: string): string {
    return placeholder ?? '[REDACTED]';
  }

  /**
   * Redacts secrets from a string using regex patterns.
   *
   * @param text - Text to redact from
   * @param patterns - Array of regex patterns to match
   * @param placeholder - Custom placeholder (default: '[REDACTED]')
   * @returns Text with redacted secrets
   */
  public static redactFromString(
    text: string,
    patterns: RegExp[],
    placeholder?: string
  ): string {
    const ph = placeholder ?? '[REDACTED]';
    let result = text;

    for (const pattern of patterns) {
      result = result.replace(pattern, ph);
    }

    return result;
  }

  /**
   * Deep redacts secrets from an object.
   *
   * @param obj - Object to redact
   * @param secretKeys - Array of keys (or string values) that are secrets
   * @param placeholder - Custom placeholder (default: '[REDACTED]')
   * @returns Object with redacted secrets
   */
  public static redactFromObject(
    obj: Record<string, unknown>,
    secretKeys: string[],
    placeholder?: string
  ): Record<string, unknown> {
    const ph = placeholder ?? '[REDACTED]';
    const result = this.deepClone(obj);

    const processValue = (value: unknown): unknown => {
      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value === 'string') {
        if (secretKeys.includes(value)) {
          return ph;
        }
        return value;
      }

      if (Array.isArray(value)) {
        return value.map((v) => processValue(v));
      }

      if (typeof value === 'object') {
        const processed: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          if (secretKeys.includes(key)) {
            processed[key] = ph;
          } else {
            processed[key] = processValue(val);
          }
        }
        return processed;
      }

      return value;
    };

    for (const key of Object.keys(result)) {
      if (secretKeys.includes(key)) {
        result[key] = ph;
      } else {
        result[key] = processValue(result[key]);
      }
    }

    return result;
  }

  /**
   * Gets common secret patterns for redaction.
   *
   * @returns Array of regex patterns for common secrets
   */
  public static getCommonSecretPatterns(): RegExp[] {
    return [
      // API keys: sk-ant-api03-xxx, Bearer tokens, etc.
      /sk-ant-[a-zA-Z0-9-_]+/g,
      /api[_-]?key["\s:]+["\']?[a-zA-Z0-9-_]+["\']?/gi,
      /bearer["\s:]+["\']?[a-zA-Z0-9-_=./]+["\']?/gi,
      // Token-like strings
      /[a-zA-Z0-9]{32,}/g,
    ];
  }

  /**
   * Deep clones an object.
   */
  private static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as unknown as T;
    }

    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this.deepClone((obj as Record<string, unknown>)[key]);
    }

    return cloned as T;
  }
}
