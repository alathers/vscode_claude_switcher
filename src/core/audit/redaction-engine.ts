/**
 * src/core/audit/redaction-engine.ts
 *
 * Redaction Engine Module
 *
 * Redacts secrets and internal content from logs and output.
 * Provides deterministic redaction for audit compliance.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 */

// ============================================================
// REDACTION TYPES
// ============================================================

/**
 * Redaction rule configuration.
 */
export interface RedactionRule {
  /** Rule identifier */
  id: string;

  /** Description of what this rule redacts */
  description: string;

  /** Regex pattern to match content for redaction */
  pattern: RegExp | string;

  /** Replacement text */
  replacement: string;

  /** Priority (higher rules apply first) */
  priority: number;

  /** Whether this rule is enabled */
  enabled: boolean;
}

/**
 * Result of redaction operation.
 */
export interface RedactionResult {
  /** Original content */
  original: string;

  /** Redacted content */
  redacted: string;

  /** Pattern IDs that matched and were redacted */
  matchedPatterns: string[];

  /** Number of redactions performed */
  redactionCount: number;
}

/**
 * Content type for specialized redaction.
 */
export type ContentType = 'text' | 'code' | 'json' | 'url' | 'header';

// ============================================================
// PREDEFINED REDACTION RULES
// ============================================================

/**
 * Built-in redaction rules for common sensitive patterns.
 */
export const BUILTIN_RULES: RedactionRule[] = [
  {
    id: 'api-key-anthropic',
    description: 'Redact Anthropic API keys (sk-ant-...)',
    pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
    replacement: '[REDACTED: API_KEY]',
    priority: 110,
    enabled: true,
  },
  {
    id: 'api-key-openai',
    description: 'Redact OpenAI API keys (sk-...)',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    replacement: '[REDACTED: API_KEY]',
    priority: 110,
    enabled: true,
  },
  {
    id: 'jwt-token',
    description: 'Redact JWT tokens',
    pattern: /Bearer\s+eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
    replacement: 'Bearer [REDACTED: JWT]',
    priority: 100,
    enabled: true,
  },
  {
    id: 'ssh-key',
    description: 'Redact SSH private keys',
    pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    replacement: '-----REDACTED SSH PRIVATE KEY-----',
    priority: 100,
    enabled: true,
  },
  {
    id: 'bearer-token',
    description: 'Redact bearer tokens',
    pattern: /Bearer\s+[a-zA-Z0-9._+=-]{20,}/gi,
    replacement: 'Bearer [REDACTED: TOKEN]',
    priority: 90,
    enabled: true,
  },
  {
    id: 'password-param',
    description: 'Redact password in URL parameters',
    pattern: /([?&]password=)[^&]*/gi,
    replacement: '$1[REDACTED]',
    priority: 95,
    enabled: true,
  },
  {
    id: 'password-flag',
    description: 'Redact passwords in command line flags',
    pattern: /(--password|-p)[=\s]+[^\s]+/gi,
    replacement: '$1 [REDACTED]',
    priority: 95,
    enabled: true,
  },
  {
    id: 'email-address',
    description: 'Redact email addresses',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED: EMAIL]',
    priority: 50,
    enabled: false, // Disabled by default - enable for PII redaction
  },
  {
    id: 'ip-address-v4',
    description: 'Redact IPv4 addresses',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[REDACTED: IPV4]',
    priority: 40,
    enabled: false, // Disabled by default
  },
  {
    id: 'personal-name',
    description: 'Redact PII patterns (names in context)',
    pattern: /\b(my name is|i am|i'm|my email is|my password is)\s+[^\s,.\n]+/gi,
    replacement: '$1 [REDACTED: PII]',
    priority: 60,
    enabled: true,
  },
];

// ============================================================
// REDACTION ENGINE CLASS
// ============================================================

/**
 * Redacts sensitive content from logs and output.
 *
 * Usage:
 * ```typescript
 * const engine = new RedactionEngine();
 * engine.enablePIIRedaction();
 * const result = engine.redact(content);
 * ```
 *
 * Redaction principles:
 * 1. Deterministic: Same input always produces same output
 * 2. Safe: Default to redacting when unsure
 * 3. Minimal: Only redact what's necessary for compliance
 * 4. Audit-safe: Never leaks sensitive data in redacted output
 *
 * Content types supported:
 * - text: Plain text redaction
 * - code: Code-aware redaction (preserves structure)
 * - json: JSON-safe redaction (valid JSON output)
 * - url: URL query parameter redaction
 * - header: HTTP header value redaction
 *
 * NOTE: This module does NOT guarantee perfect redaction. It provides
 * best-effort pattern matching. For production security, combine with
 * additional layers of protection (encryption, access controls, etc.).
 */
export class RedactionEngine {
  private rules: RedactionRule[];
  private customRules: Map<string, RedactionRule>;

  /**
   * Whether PII redaction is enabled.
   */
  piiEnabled: boolean;

  constructor() {
    // Clone builtin rules to avoid mutations affecting global
    this.rules = BUILTIN_RULES.map(rule => ({ ...rule }));
    this.customRules = new Map();
    this.piiEnabled = false;
  }

  /**
   * Redact content using configured rules.
   *
   * @param content - Content to redact
   * @param contentType - Content type for specialized handling
   * @returns Redaction result
   */
  redact(
    content: string,
    contentType: ContentType = 'text',
  ): RedactionResult {
    let redacted = content;
    const matchedPatterns: Set<string> = new Set();
    let redactionCount = 0;

    // Apply content-type specific preprocessing
    if (contentType === 'json') {
      redacted = this.redactJSON(redacted);
    } else if (contentType === 'url') {
      redacted = this.redactURL(redacted);
    } else if (contentType === 'header') {
      redacted = this.redactHeader(redacted);
    } else if (contentType === 'code') {
      redacted = this.redactCode(redacted);
    }

    // Get enabled rules sorted by priority (highest first)
    const enabledRules = [...this.rules, ...this.customRules.values()]
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    // Apply each rule
    enabledRules.forEach(rule => {
      const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'g') : rule.pattern;

      const matches = this.countMatches(redacted, pattern);
      if (matches > 0) {
        redacted = redacted.replace(pattern, rule.replacement);
        matchedPatterns.add(rule.id);
        redactionCount += matches;
      }
    });

    return {
      original: content,
      redacted,
      matchedPatterns: Array.from(matchedPatterns),
      redactionCount,
    };
  }

  /**
   * Redact JSON string safely.
   *
   * Preserves valid JSON structure while redacting string values.
   *
   * @param jsonString - JSON string to redact
   * @returns Redacted JSON string
   */
  private redactJSON(jsonString: string): string {
    try {
      const parsed = JSON.parse(jsonString);
      const redacted = this.redactObject(parsed);
      return JSON.stringify(redacted, null, 2);
    } catch (err) {
      // If not valid JSON, fall back to text redaction
      return jsonString;
    }
  }

  /**
   * Recursively redact object values.
   *
   * @param obj - Object to redact
   * @returns Redacted object
   */
  private redactObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.redact(obj).redacted;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.redactObject(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Redact URL query parameters.
   *
   * Focuses on common sensitive parameters (password, token, etc.).
   *
   * @param url - URL string to redact
   * @returns Redacted URL string
   */
  private redactURL(url: string): string {
    let redacted = url;

    // Redact common sensitive URL parameters
    const sensitiveParams = ['password', 'passwd', 'token', 'key', 'api_key', 'secret', 'auth'];

    sensitiveParams.forEach(param => {
      const regex = new RegExp(`([?&]${param}=)[^&]*`, 'gi');
      redacted = redacted.replace(regex, '$1[REDACTED]');
    });

    return redacted;
  }

  /**
   * Redact HTTP header values.
   *
   * Focuses on sensitive headers (Authorization, Cookie, etc.).
   *
   * @param header - Header line (format: "Name: Value")
   * @returns Redacted header line
   */
  private redactHeader(header: string): string {
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'api-key'];

    for (const sensitive of sensitiveHeaders) {
      const regex = new RegExp(`^(${sensitive}:[ \t*]+).*$`, 'gim');
      if (regex.test(header)) {
        return header.replace(regex, `$1[REDACTED]`);
      }
    }

    return header;
  }

  /**
   * Redact code content with awareness of code structure.
   *
   * Preserves comments that might be needed for debugging,
   * but redacts string literals that might contain secrets.
   *
   * @param code - Code string to redact
   * @returns Redacted code string
   */
  private redactCode(code: string): string {
    // Simple code-aware redaction:
    // 1. Redact string literals (both single and double quoted)
    // 2. Redact template literals
    // 3. Keep其他内容 intact

    let redacted = code;

    // Redact string literals
    redacted = redacted.replace(/'([^']*)'/g, (match, content) => {
      if (this.looksLikeSecret(content)) {
        return "'[REDACTED]'";
      }
      return match;
    });

    redacted = redacted.replace(/"([^"]*)"/g, (match, content) => {
      if (this.looksLikeSecret(content)) {
        return '"[REDACTED]"';
      }
      return match;
    });

    redacted = redacted.replace(/`([^`]*)`/g, (match, content) => {
      if (this.looksLikeSecret(content)) {
        return '`[REDACTED]`';
      }
      return match;
    });

    return redacted;
  }

  /**
   * Check if a string looks like it might contain a secret.
   */
  private looksLikeSecret(str: string): boolean {
    // Check length
    if (str.length < 20 || str.length > 200) {
      return false;
    }

    // Check for common API key patterns
    const secretPatterns = [
      /^sk-/,
      /^sk-ant-/,
      /^Bearer /i,
      /apikey/i,
      /secret/i,
      /^.{20,}$/, // Long random-looking strings
    ];

    return secretPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Count matches of a pattern in a string.
   */
  private countMatches(str: string, pattern: RegExp): number {
    const matches = str.match(pattern);
    return matches ? matches.length : 0;
  }

  // ============================================================
  // RULE MANAGEMENT
  // ============================================================

  /**
   * Add a custom redaction rule.
   *
   * @param rule - Custom redaction rule
   */
  addCustomRule(rule: RedactionRule): void {
    this.customRules.set(rule.id, rule);
  }

  /**
   * Remove a custom redaction rule.
   *
   * @param ruleId - Rule ID to remove
   */
  removeCustomRule(ruleId: string): void {
    this.customRules.delete(ruleId);
  }

  /**
   * Enable or disable a rule by ID.
   *
   * @param ruleId - Rule ID
   * @param enabled - Whether rule should be enabled
   */
  enableRule(ruleId: string, enabled: boolean): void {
    // Check custom rules
    if (this.customRules.has(ruleId)) {
      const rule = this.customRules.get(ruleId);
      if (rule) {
        rule.enabled = enabled;
      }
      return;
    }

    // Check built-in rules
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Enable PII redaction rules.
   */
  enablePIIRedaction(): void {
    this.piiEnabled = true;
    this.rules.forEach(rule => {
      if (rule.id.includes('email') || rule.id.includes('ip') || rule.id.includes('name')) {
        rule.enabled = true;
      }
    });
  }

  /**
   * Disable PII redaction rules.
   */
  disablePIIRedaction(): void {
    this.piiEnabled = false;
    this.rules.forEach(rule => {
      if (rule.id.includes('email') || rule.id.includes('ip') || rule.id.includes('name')) {
        rule.enabled = false;
      }
    });
  }

  /**
   * Get all configured rules.
   */
  getRules(): RedactionRule[] {
    return [...this.rules, ...this.customRules.values()];
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Redact sensitive content from a string.
 *
 * @param content - Content to redact
 * @param contentType - Content type
 * @returns Redacted content
 */
export function redactSensitiveContent(
  content: string,
  contentType: ContentType = 'text',
): string {
  const engine = new RedactionEngine();
  return engine.redact(content, contentType).redacted;
}

/**
 * Redact content and return full result.
 *
 * @param content - Content to redact
 * @param contentType - Content type
 * @returns Redaction result
 */
export function redactWithResult(
  content: string,
  contentType: ContentType = 'text',
): RedactionResult {
  const engine = new RedactionEngine();
  return engine.redact(content, contentType);
}
