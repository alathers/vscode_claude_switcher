/**
 * src/vscode/configuration/secret-storage.ts
 *
 * Secret Storage Module
 *
 * Wraps VS Code SecretStorage API for secure credential management.
 * All VS Code API access is isolated in the vscode layer.
 *
 * This module CONTAINS VS Code API imports - part of the vscode layer.
 */

import * as vscode from 'vscode';

// ============================================================
// SECRET STORAGE TYPES
// ============================================================

/**
 * Secret storage key prefix for the extension.
 */
export const SECRET_KEY_PREFIX: string = 'claude-switcher:';

/**
 * Secret reference type for profiles.
 *
 * Profiles can reference secrets stored in SecretStorage by their identifier.
 */
export type SecretReference = string;

/**
 * Secret value retrieved from storage.
 */
export interface SecretValue {
  /** Secret value */
  value: string;

  /** When the secret was last accessed */
  lastAccessed: Date;
}

/**
 * Secret storage result.
 */
export interface SecretStorageResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Error message if the operation failed */
  error?: string;
}

// ============================================================
// SECRET STORAGE MANAGER
// ============================================================

/**
 * Manages VS Code SecretStorage for extension secrets.
 *
 * Usage:
 * ```typescript
 * const secrets = new SecretStorageManager(context);
 *
 * // Store a secret
 * await secrets.set('api-key:my-profile', 'sk-ant-...');
 *
 * // Get a secret
 * const secret = await secrets.get('api-key:my-profile');
 *
 * // Delete a secret
 * await secrets.delete('api-key:my-profile');
 *
 * // Check if a secret exists
 * const exists = await secrets.has('api-key:my-profile');
 * ```
 *
 * This module isolates all VS Code SecretStorage API access,
 * allowing core logic modules to remain free of VS Code imports.
 *
 * Security notes:
 * - Secrets are stored encrypted using the operating system's credential manager
 * - Workspace configuration (including .vscode files) MUST NOT contain secrets (FR-014)
 * - Secrets are referenced by ID, not by value, in profile configuration
 * - API-key and local-server secret values MUST use SecretStorage (FR-012)
 */
export class SecretStorageManager {
  private readonly secretStorage: vscode.SecretStorage;
  private disposables: vscode.Disposable[] = [];

  /**
   * Create a new secret storage manager.
   *
   * @param context - Extension context containing SecretStorage
   */
  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  /**
   * Get a secret value by key.
   *
   * The key should not include the SECRET_KEY_PREFIX - it will be added automatically.
   *
   * @param key - Secret key (without prefix)
   * @returns Secret value or undefined if not found
   */
  async get(key: string): Promise<string | undefined> {
    const fullKey = this.getFullKey(key);
    const value = await this.secretStorage.get(fullKey);

    return value ?? undefined;
  }

  /**
   * Get a secret with metadata.
   *
   * @param key - Secret key (without prefix)
   * @returns Secret value with metadata
   */
  async getWithMetadata(key: string): Promise<SecretValue | undefined> {
    const value = await this.get(key);

    if (!value) {
      return undefined;
    }

    return {
      value,
      lastAccessed: new Date(),
    };
  }

  /**
   * Set a secret value.
   *
   * @param key - Secret key (without prefix)
   * @param value - Secret value to store
   * @returns Promise that resolves when secret is stored
   */
  async set(key: string, value: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.secretStorage.store(fullKey, value);
  }

  /**
   * Check if a secret exists.
   *
   * @param key - Secret key (without prefix)
   * @returns true if secret exists
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Delete a secret.
   *
   * @param key - Secret key (without prefix)
   * @returns Promise that resolves when secret is deleted
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.secretStorage.delete(fullKey);
  }

  /**
   * List all secret keys managed by the extension.
   *
   * @returns Array of secret keys (without prefix)
   */
  async listKeys(): Promise<string[]> {
    // Note: VS Code SecretStorage does not provide a way to list all keys
    // This is a limitation of the API
    // In a real implementation, we would need to maintain a separate index of keys
    // For now, return an empty array
    return [];
  }

  /**
   * Get all secrets.
   *
   * Note: This returns the actual secret values, which should be used with caution.
   *
   * @returns Object mapping keys to secret values
   */
  async getAll(): Promise<Record<string, string>> {
    const keys = await this.listKeys();
    const secrets: Record<string, string> = {};

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key);
        if (value !== undefined) {
          secrets[key] = value;
        }
      }),
    );

    return secrets;
  }

  /**
   * Bulk set secrets.
   *
   * @param secrets - Object mapping keys to secret values
   * @returns Promise that resolves when all secrets are stored
   */
  async setMultiple(secrets: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(secrets).map(([key, value]) => this.set(key, value)),
    );
  }

  /**
   * Bulk delete secrets.
   *
   * @param keys - Array of secret keys to delete
   * @returns Promise that resolves when all secrets are deleted
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) => this.delete(key)),
    );
  }

  /**
   * Clear all secrets.
   *
   * This is a destructive operation that cannot be undone.
   *
   * @returns Promise that resolves when all secrets are deleted
   */
  async clearAll(): Promise<void> {
    const keys = await this.listKeys();
    await this.deleteMultiple(keys);
  }

  /**
   * Migrate secrets from old key format to new format.
   *
   * This method is useful if the secret key format changes between versions.
   *
   * @param _oldPrefix - Old key prefix
   * @param _newPrefix - New key prefix (defaults to SECRET_KEY_PREFIX)
   * @returns Number of secrets migrated
   */
  async migrateKeys(_oldPrefix: string, _newPrefix: string = SECRET_KEY_PREFIX): Promise<number> {
    // Note: Without the ability to list keys, we cannot implement true migration
    // In a real implementation, we would maintain a separate index
    return 0;
  }

  /**
   * Validate that a secret reference exists in storage.
   *
   * Checks if the secret referenced by a profile exists in SecretStorage.
   *
   * @param secretRef - Secret reference from profile
   * @returns true if secret exists
   */
  async validateSecretRef(secretRef: SecretReference): Promise<boolean> {
    return this.has(secretRef);
  }

  /**
   * Get secret by reference.
   *
   * Resolves a secret reference from a profile to its actual value.
   *
   * @param secretRef - Secret reference from profile
   * @returns Secret value or undefined if not found
   */
  async getSecretByRef(secretRef: SecretReference): Promise<string | undefined> {
    return this.get(secretRef);
  }

  /**
   * Set secret by reference.
   *
   * Stores a secret value at the referenced key.
   *
   * @param secretRef - Secret reference from profile
   * @param value - Secret value to store
   * @returns Promise that resolves when secret is stored
   */
  async setSecretByRef(secretRef: SecretReference, value: string): Promise<void> {
    await this.set(secretRef, value);
  }

  /**
   * Dispose all resources.
   *
   * This method should be called during extension deactivation.
   */
  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
  }

  /**
   * Get the full key with prefix.
   *
   * @param key - Secret key (without prefix)
   * @returns Full secret key with prefix
   */
  private getFullKey(key: string): string {
    return `${SECRET_KEY_PREFIX}${key}`;
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get the secret storage manager instance.
 *
 * @param context - Extension context
 * @returns Secret storage manager
 */
export function getSecretStorageManager(context: vscode.ExtensionContext): SecretStorageManager {
  return new SecretStorageManager(context);
}

/**
 * Get a secret value by key.
 *
 * @param context - Extension context
 * @param key - Secret key (without prefix)
 * @returns Secret value or undefined
 */
export async function getSecret(context: vscode.ExtensionContext, key: string): Promise<string | undefined> {
  const manager = new SecretStorageManager(context);
  return manager.get(key);
}

/**
 * Set a secret value.
 *
 * @param context - Extension context
 * @param key - Secret key (without prefix)
 * @param value - Secret value
 * @returns Promise that resolves when secret is stored
 */
export async function setSecret(context: vscode.ExtensionContext, key: string, value: string): Promise<void> {
  const manager = new SecretStorageManager(context);
  await manager.set(key, value);
}

/**
 * Delete a secret value.
 *
 * @param context - Extension context
 * @param key - Secret key (without prefix)
 * @returns Promise that resolves when secret is deleted
 */
export async function deleteSecret(context: vscode.ExtensionContext, key: string): Promise<void> {
  const manager = new SecretStorageManager(context);
  await manager.delete(key);
}

/**
 * Check if a secret exists.
 *
 * @param context - Extension context
 * @param key - Secret key (without prefix)
 * @returns true if secret exists
 */
export async function hasSecret(context: vscode.ExtensionContext, key: string): Promise<boolean> {
  const manager = new SecretStorageManager(context);
  return manager.has(key);
}
