/**
 * src/core/validation/secret-resolution.ts
 *
 * Secret Resolution Module
 *
 * Validates secret reference existence and resolves secrets into configuration.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 * Actual SecretStorage access is isolated to the vscode layer (K384-K388).
 */

import {
  ProfileConfig,
  ValidationError,
  ValidationWarning,
} from '../adapters/contract.js';

// ============================================================
// SECRET REFERENCE TYPES
// ============================================================

/**
 * A secret reference that needs to be resolved.
 *
 * Secret references in profiles point to secrets stored in VS Code SecretStorage.
 * The vscode wrapper resolves these before passing to adapter implementations.
 */
export interface SecretRef {
  /**
   * Reference identifier (key in SecretStorage).
   */
  key: string;

  /**
   * Resolved secret value.
   * Null means secret not found or not yet resolved.
   */
  value: string | null;

  /**
   * Whether the reference should be redacted from logs.
   */
  redacted: boolean;
}

/**
 * Result of secret resolution.
 *
 * Secrets are resolved by the vscode layer's SecretStorage wrapper
 * and passed to this layer for validation and redaction.
 */
export interface SecretResolution {
  /**
   * Map of secret keys to their values.
   */
  secrets: Record<string, SecretRef>;

  /**
   * Whether all required secrets were found.
   */
  complete: boolean;

  /** Missing secrets (blocking) */
  errors: ValidationError[];

  /** Non-blocking secret warnings */
  warnings: ValidationWarning[];
}

// ============================================================
// SECRET RESOLUTION VALIDATOR
// ============================================================

/**
 * Validates secret references in profile configuration.
 *
 * Usage:
 * ```typescript
 * const validator = new SecretRefValidator();
 * const result = validator.validateSecretRefs(profileConfig, secrets);
 *
 * if (!result.complete) {
 *   result.errors.forEach(error => console.error(error.message));
 * }
 * ```
 *
 * Secret resolution workflow (K384-K388):
 * 1. Parse profile YAML for credential.secretRef fields
 * 2. Query SecretStorage for each ref key
 * 3. Resolve secrets into ProfileConfig (clone and substitute)
 * 4. Apply redaction to logs (secret values never logged directly)
 * 5. Pass resolved secrets to adapters during connect()
 *
 * This module validates that secret refs exist and are properly formatted.
 * Actual SecretStorage queries happen in the vscode layer.
 */
export class SecretRefValidator {
  /**
   * Validate that all secret references in a profile exist.
   *
   * @param config - Profile configuration to validate
   * @param secrets - Map of resolved secrets (from vscode layer)
   * @returns Secret resolution result
   */
  validateSecretRefs(
    config: ProfileConfig,
    secrets: Record<string, string | null>,
  ): SecretResolution {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const requiredSecrets: SecretRef[] = [];

    // 1. Extract required secrets based on credential mode
    this.extractRequiredSecrets(config, requiredSecrets);

    // 2. Validate each required secret exists
    requiredSecrets.forEach(secret => {
      const resolved = secrets[secret.key];

      if (!resolved || resolved === null) {
        errors.push({
          field: `credential.secretRef (${secret.key})`,
          message: `Secret "${secret.key}" not found in SecretStorage`,
          suggestion: 'Add the secret via VS Code SecretStorage or update profile to use different credential mode',
        });
      }
    });

    // 3. Check for unused secrets in Secrets map
    const resolvedKeys = Object.keys(secrets);
    const requiredKeys = requiredSecrets.map(s => s.key);
    const unusedKeys = resolvedKeys.filter(k => !requiredKeys.includes(k));

    if (unusedKeys.length > 0) {
      warnings.push({
        field: 'credential',
        message: `SecretStorage has secrets not referenced by profile: ${unusedKeys.join(', ')}`,
      });
    }

    const complete = errors.length === 0;

    // 4. Build SecretRef map
    const secretRefs: Record<string, SecretRef> = {};
    requiredSecrets.forEach(secret => {
      secretRefs[secret.key] = {
        key: secret.key,
        value: secrets[secret.key] ?? null,
        redacted: true, // Always redact from logs
      };
    });

    return {
      secrets: secretRefs,
      complete,
      errors: [...errors],
      warnings: [...warnings],
    };
  }

  /**
   * Extract required secret references from profile configuration.
   *
   * @param config - Profile configuration
   * @param secrets - Array to collect required secrets
   */
  private extractRequiredSecrets(
    config: ProfileConfig,
    secrets: SecretRef[],
  ): void {
    const credential = config.credential;

    // SecretRef mode requires a secret in SecretStorage
    if (credential.mode === 'secretRef' && credential.secretRef) {
      secrets.push({
        key: credential.secretRef,
        value: null, // Not resolved yet
        redacted: true,
      });
    }

    // Environment mode resolves vars at runtime, not SecretStorage
    // but we may need to validate environment refs exist
    if (credential.mode === 'environment' && config.environmentRefs) {
      config.environmentRefs.forEach(envRef => {
        secrets.push({
          key: envRef,
          value: null, // Should be in process.env at adapter connect time
          redacted: true,
        });
      });
    }
  }
}

// ============================================================
// SECRET REDACTION UTILITIES
// ============================================================

/**
 * Redaction markers for different secret types.
 *
 * When secrets appear in logs or audit trails, they are replaced
 * with these redaction markers rather than the actual values.
 */
export const REDACTION_MARKERS = {
  /**
   * Default redaction marker for generic secrets.
   */
  SECRET: '[REDACTED: SECRET]',

  /**
   * Redaction marker for API keys.
   */
  API_KEY: '[REDACTED: API_KEY]',

  /**
   * Redaction marker for authentication tokens.
   */
  AUTH_TOKEN: '[REDACTED: AUTH_TOKEN]',

  /**
   * Redaction marker for passwords.
   */
  PASSWORD: '[REDACTED: PASSWORD]',

  /**
   * Redaction marker for SSH keys.
   */
  SSH_KEY: '[REDACTED: SSH_KEY]',
} as const;

/**
 * Redactor for secrets in log messages and audit trails.
 *
 * Uses deterministic redaction so the same secret consistently
 * produces the same redaction marker (for audit consistency).
 */
export class SecretRedactor {
  private secretPatterns: Map<string, RegExp>;
  private secretMarkers: Map<string, string>;

  constructor() {
    this.secretPatterns = new Map();
    this.secretMarkers = new Map();
  }

  /**
   * Register a secret for redaction.
   *
   * @param secretValue - The secret value to redact
   * @param marker - Redaction marker to use (defaults to generic)
   */
  registerSecret(
    secretValue: string,
    marker: string = REDACTION_MARKERS.SECRET,
  ): void {
    if (!secretValue) {
      return;
    }

    // Escape special regex characters in the secret
    const escaped = secretValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a case-sensitive regex pattern
    this.secretPatterns.set(secretValue, new RegExp(escaped, 'g'));
    // Store the custom marker for this secret
    this.secretMarkers.set(secretValue, marker);
  }

  /**
   * Redact secrets from a message string.
   *
   * @param message - Message to redact
   * @returns Redacted message
   */
  redact(message: string): string {
    let redacted = message;

    this.secretPatterns.forEach((pattern, secret) => {
      const marker = this.secretMarkers.get(secret) ?? REDACTION_MARKERS.SECRET;
      redacted = redacted.replace(pattern, marker);
    });

    return redacted;
  }

  /**
   * Redact secrets from an object (recursive).
   *
   * @param obj - Object to redact
   * @returns Redacted object (new instance)
   */
  redactObject<T extends Record<string, unknown>>(
    obj: T
  ): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.redact(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'string' ? this.redact(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Clear all registered secrets.
   *
   * Useful after a session ends or when secrets are rotated.
   */
  clear(): void {
    this.secretPatterns.clear();
    this.secretMarkers.clear();
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Validate secret references in a profile.
 *
 * @param config - Profile configuration
 * @param secrets - Resolved secrets from SecretStorage
 * @returns Secret resolution result
 */
export function validateSecretReferences(
  config: ProfileConfig,
  secrets: Record<string, string | null>,
): SecretResolution {
  const validator = new SecretRefValidator();
  return validator.validateSecretRefs(config, secrets);
}

/**
 * Create a redactor instance from a map of resolved secrets.
 *
 * @param secrets - Map of secret key to secret value
 * @returns Configured SecretRedactor instance
 */
export function createSecretRedactor(
  secrets: Record<string, string | null>,
): SecretRedactor {
  const redactor = new SecretRedactor();

  Object.entries(secrets).forEach(([key, value]) => {
    if (value) {
      redactor.registerSecret(value, `[REDACTED: ${key.toUpperCase()}]`);
    }
  });

  return redactor;
}
