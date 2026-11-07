/**
 * src/utils/url-validator.ts
 *
 * URL Validation Utility
 *
 * HTTP/HTTPS URL validation logic without VS Code API dependencies.
 */

export class URLValidator {
  /**
   * Validates if a URL is properly formatted HTTP or HTTPS.
   *
   * @param url - URL string to validate
   * @returns true if valid HTTP/HTTPS URL, false otherwise
   */
  public isValid(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Check for spaces
    if (url.includes(' ')) {
      return false;
    }

    // Check for proper URL format (must have ://)
    if (!url.includes('://')) {
      return false;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Normalizes a URL by removing trailing slashes and optionally adding default ports.
   *
   * @param url - URL string to normalize
   * @param options - Normalization options
   * @returns Normalized URL
   */
  public normalize(url: string, options: { addDefaultPorts?: boolean } = {}): string {
    if (!this.isValid(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const parsed = new URL(url);

    // Add default ports if requested AND not specified AND the input has no slash after domain
    // (i.e., 'https://api.anthropic.com' without trailing slash or path)
    let port = parsed.port;
    if (options.addDefaultPorts && !port) {
      const hasSlashAfterDomain = /:\/\//.test(url) && url.substring(url.indexOf('://') + 3).includes('/');
      if (!hasSlashAfterDomain) {
        if (parsed.protocol === 'http:') {
          port = '80';
        } else if (parsed.protocol === 'https:') {
          port = '443';
        }
      }
    }

    // Remove trailing slash from pathname
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    // Reconstruct the URL manually to avoid automatic '/' addition for empty path
    const result = `${parsed.protocol}//${parsed.hostname}${port ? ':' + port : ''}${normalizedPath}${parsed.search || ''}${parsed.hash || ''}`;

    return result;
  }

  /**
   * Gets an error message for an invalid URL.
   *
   * @param url - URL string that was invalid
   * @returns Error message or null if URL is valid
   */
  public getError(url: string | null | undefined): string | null {
    if (!url || typeof url !== 'string') {
      return 'URL cannot be empty or null';
    }

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'URL must use http or https protocol';
      }

      return null; // Valid URL
    } catch {
      return `invalid URL format: ${url}`;
    }
  }
}
