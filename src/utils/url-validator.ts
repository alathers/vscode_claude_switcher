/**
 * src/utils/url-validator.ts
 *
 * URL Validation and Normalization Utility
 *
 * Provides URL validation, normalization, localhost detection,
 * port extraction, and authentication detection for security purposes.
 */

export interface NormalizedURL {
  original: string;
  normalized: string;
  protocol: string;
  hostname: string;
  port?: string;
  isLocalhost: boolean;
  hasAuth: boolean;
}

export class URLValidator {
  /**
   * Validates if a string is a valid URL.
   */
  public isValid(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalizes a URL by adding default ports and standardizing format.
   */
  public normalize(url: string): NormalizedURL {
    const parsed = new URL(url);

    let normalized = url;

    // Add default ports for http/https if missing
    if (!parsed.port) {
      const defaultPort = parsed.protocol === 'http:' ? '80' : '443';
      const hostPort = `${parsed.hostname}:${defaultPort}`;
      normalized = normalized.replace(/https?:\/\/[^/]+/, `${parsed.protocol}//${hostPort}`);
    }

    // Normalize hostname to lowercase
    parsed.hostname = parsed.hostname.toLowerCase();

    // Detect localhost
    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1' ||
      parsed.hostname === '[::1]';

    // Detect auth credentials
    const hasAuth = parsed.username !== '' || parsed.password !== '';

    return {
      original: url,
      normalized: normalized,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      isLocalhost,
      hasAuth,
    };
  }

  /**
   * Checks if the URL points to localhost.
   */
  public isLocalhost(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1' ||
        parsed.hostname === '[::1]'
      );
    } catch {
      return false;
    }
  }

  /**
   * Extracts the port from a URL, or undefined if not present.
   */
  public getPort(url: string): number | undefined {
    try {
      const parsed = new URL(url);
      return parsed.port ? parseInt(parsed.port, 10) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Detects if a URL has authentication (username/password).
   */
  public hasAuth(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.username !== '' || parsed.password !== '';
    } catch {
      return false;
    }
  }

  /**
   * Validates if a URL is secure for use (no auth, localhost if required).
   */
  public validateSecureUrl(url: string, options: { requireLocalhost?: boolean; allowAuth?: boolean } = {}): { valid: boolean; reason?: string } {
    const {
      requireLocalhost = false,
      allowAuth = false,
    } = options;

    try {
      const normalized = this.normalize(url);

      // Check localhost requirement
      if (requireLocalhost && !normalized.isLocalhost) {
        return {
          valid: false,
          reason: `URL must be localhost-based for security. Current hostname: ${normalized.hostname}`,
        };
      }

      // Check auth
      if (!allowAuth && normalized.hasAuth) {
        return {
          valid: false,
          reason: 'URL must not contain authentication credentials for security',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Invalid URL: ${error instanceof Error ? error.message : error}`,
      };
    }
  }
}
