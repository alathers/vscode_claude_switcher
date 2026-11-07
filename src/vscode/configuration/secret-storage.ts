/**
 * src/vscode/configuration/secret-storage.ts
 *
 * Secret Storage
 *
 * VS Code SecretStorage wrapper for auth tokens (isolates VS Code API access).
 */

export interface SecretStorageAdapter {
  getSecret(key: string): Promise<string | undefined>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

export class SecretStorage {
  private adapter: SecretStorageAdapter;
  private keyPrefix = 'claudeSwitcher.authToken.';

  constructor(adapter: SecretStorageAdapter) {
    this.adapter = adapter;
  }

  /**
   * Gets auth token for endpoint.
   */
  public async getAuthToken(endpointId: string): Promise<string | undefined> {
    const key = this.getSecretKey(endpointId);
    return this.adapter.getSecret(key);
  }

  /**
   * Sets auth token for endpoint.
   */
  public async setAuthToken(endpointId: string, token: string): Promise<void> {
    const key = this.getSecretKey(endpointId);
    await this.adapter.setSecret(key, token);
  }

  /**
   * Deletes auth token for endpoint.
   */
  public async deleteAuthToken(endpointId: string): Promise<void> {
    const key = this.getSecretKey(endpointId);
    await this.adapter.deleteSecret(key);
  }

  /**
   * Gets all auth tokens (keys only for security).
   */
  public async getAuthTokenKeys(): Promise<string[]> {
    // Implementation would need to track registered endpoint IDs
    // This is a limitation - VS Code SecretStorage doesn't support listing keys
    return [];
  }

  /**
   * Checks if auth token exists for endpoint.
   */
  public async hasAuthToken(endpointId: string): Promise<boolean> {
    const token = await this.getAuthToken(endpointId);
    return token !== undefined;
  }

  /**
   * Gets generic secret.
   */
  public async getSecret(key: string): Promise<string | undefined> {
    return this.adapter.getSecret(key);
  }

  /**
   * Sets generic secret.
   */
  public async setSecret(key: string, value: string): Promise<void> {
    await this.adapter.setSecret(key, value);
  }

  /**
   * Deletes generic secret.
   */
  public async deleteSecret(key: string): Promise<void> {
    await this.adapter.deleteSecret(key);
  }

  private getSecretKey(endpointId: string): string {
    return `${this.keyPrefix}${endpointId}`;
  }
}

/**
 * Creates a mock secret storage adapter for testing.
 */
export function createMockSecretStorageAdapter(): SecretStorageAdapter {
  const storage = new Map<string, string>();

  return {
    async getSecret(key: string): Promise<string | undefined> {
      return storage.get(key);
    },

    async setSecret(key: string, value: string): Promise<void> {
      // Short delay to simulate async behavior
      await new Promise((resolve) => setTimeout(resolve, 1));
      storage.set(key, value);
    },

    async deleteSecret(key: string): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 1));
      storage.delete(key);
    },
  };
}
