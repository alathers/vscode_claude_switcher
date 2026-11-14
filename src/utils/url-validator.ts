/**
 * src/utils/url-validator.ts
 *
<<<<<<< HEAD
 * URL Validator
 *
 * HTTP/HTTPS URL validation and normalization (no VS Code API imports).
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
=======
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
>>>>>>> origin/main
}

export class URLValidator {
  /**
<<<<<<< HEAD
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

=======
   * Validates if a string is a valid URL.
   */
  public isValid(url: string): boolean {
    try {
      new URL(url);
>>>>>>> origin/main
      return true;
    } catch {
      return false;
    }
  }

  /**
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
    } catch {
      return false;
    }
  }

  /**
<<<<<<< HEAD
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
=======
   * Extracts the port from a URL, or undefined if not present.
   */
  public getPort(url: string): number | undefined {
    try {
      const parsed = new URL(url);
      return parsed.port ? parseInt(parsed.port, 10) : undefined;
>>>>>>> origin/main
    } catch {
      return undefined;
    }
  }

  /**
<<<<<<< HEAD
   * Checks if URL has auth credentials.
   */
  public hasAuth(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
=======
   * Detects if a URL has authentication (username/password).
   */
  public hasAuth(url: string): boolean {
    try {
      const parsed = new URL(url);
>>>>>>> origin/main
      return parsed.username !== '' || parsed.password !== '';
    } catch {
      return false;
    }
  }
<<<<<<< HEAD
=======

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
>>>>>>> origin/main
}
