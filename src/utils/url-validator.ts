/**
 * src/utils/url-validator.ts
 *
 * URL Validator
 *
 * HTTP/HTTPS URL validation and normalization (no VS Code API imports).
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class URLValidator {
  /**
   * Validates a URL string.
   */
  public isValid(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);

      // Check protocol
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      // Check hostname exists
      if (!parsed.hostname) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalizes a URL string.
   *
   * @param urlString - The URL to normalize
   * @param options - Options for normalization
   * @returns Normalized URL string
   */
  public normalize(
    urlString: string,
    options: { addDefaultPorts?: boolean } = {}
  ): string {
    options.addDefaultPorts ??= false;

    try {
      // Check protocol before parsing to reject non-HTTP/HTTPS
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        throw new ValidationError(`Invalid URL: ${urlString} - Only HTTP and HTTPS protocols are supported`);
      }

      const parsed = new URL(urlString);

      // Remove trailing slash for consistency (URL.toString() adds it)
      let normalized = parsed.toString();
      if (normalized.endsWith('/') && !urlString.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }

      // If we need to add default port and no port exists, manually construct URL
      if (options.addDefaultPorts && !parsed.port) {
        const defaultPort = parsed.protocol === 'http:' ? '80' : '443';
        const hostPort = `${parsed.hostname}:${defaultPort}`;

        // Replace the host:port portion
        normalized = normalized.replace(
          /https?:\/\/[^/]+/,
          `${parsed.protocol}//${hostPort}`
        );
      }

      return normalized;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Invalid URL: ${urlString} - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validates that a URL is localhost-based (for Ollama).
   */
  public isLocalhost(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      const hostname = parsed.hostname.toLowerCase();

      // IPv4 localhost ranges
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('127.')) {
        return true;
      }

      // IPv6 localhost
      if (hostname === '::1' || hostname === '[::1]') {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Gets the port from a URL.
   */
  public getPort(urlString: string, defaultPort = 80): number | undefined {
    try {
      const parsed = new URL(urlString);
      if (parsed.port) {
        return parseInt(parsed.port, 10);
      }

      // Return default based on protocol
      if (parsed.protocol === 'https:') {
        return 443;
      }

      return defaultPort;
    } catch {
      return undefined;
    }
  }

  /**
   * Checks if URL has auth credentials.
   */
  public hasAuth(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      return parsed.username !== '' || parsed.password !== '';
    } catch {
      return false;
    }
  }
}
