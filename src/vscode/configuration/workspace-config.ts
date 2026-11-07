/**
 * src/vscode/configuration/workspace-config.ts
 *
 * Workspace Configuration
 *
 * VS Code workspace configuration persistence (isolates VS Code API access).
 */

import type { WorkspaceConfiguration } from 'vscode';
import { ConfigurationTarget } from 'vscode';

export interface WorkspaceConfigAdapter {
  getConfiguration(): WorkspaceConfiguration;
  update(key: string, value: unknown, target?: ConfigurationTarget): Promise<void>;
}

const DEFAULT_CONFIG_KEY = 'claudeSwitcher';
const DEFAULT_ACTIVE_ENDPOINT_KEY = 'claudeSwitcher.activeEndpointId';

export class WorkspaceConfig {
  private adapter: WorkspaceConfigAdapter;

  constructor(adapter: WorkspaceConfigAdapter) {
    this.adapter = adapter;
  }

  /**
   * Gets endpoint configuration from workspace.
   */
  public getEndpointsConfig(): Record<string, unknown>[] {
    const config = this.adapter.getConfiguration();
    const endpoints = config.get<Record<string, unknown>[]>(`${DEFAULT_CONFIG_KEY}.endpoints`, []);
    return [...endpoints];
  }

  /**
   * Sets endpoint configuration in workspace.
   */
  public async setEndpointsConfig(
    endpoints: Record<string, unknown>[],
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Promise<void> {
    await this.adapter.update(`${DEFAULT_CONFIG_KEY}.endpoints`, endpoints, target);
  }

  /**
   * Gets active endpoint ID.
   */
  public getActiveEndpointId(): string | undefined {
    const config = this.adapter.getConfiguration();
    return config.get<string>(DEFAULT_ACTIVE_ENDPOINT_KEY);
  }

  /**
   * Sets active endpoint ID.
   */
  public async setActiveEndpointId(
    endpointId: string,
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Promise<void> {
    await this.adapter.update(DEFAULT_ACTIVE_ENDPOINT_KEY, endpointId, target);
  }

  /**
   * Clears active endpoint ID.
   */
  public async clearActiveEndpointId(
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Promise<void> {
    await this.adapter.update(DEFAULT_ACTIVE_ENDPOINT_KEY, undefined, target);
  }

  /**
   * Gets all configuration.
   */
  public getAllConfig(): Record<string, unknown> {
    const config = this.adapter.getConfiguration();
    const claudeSwitcherConfig = config.get<Record<string, unknown>>('claudeSwitcher', {});

    return { ...claudeSwitcherConfig };
  }

  /**
   * Sets configuration value.
   */
  public async setConfigValue(
    key: string,
    value: unknown,
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Promise<void> {
    const fullKey = `${DEFAULT_CONFIG_KEY}.${key}`;
    await this.adapter.update(fullKey, value, target);
  }

  /**
   * Clears all configuration.
   */
  public async clearAllConfig(
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Promise<void> {
    await this.adapter.update(DEFAULT_CONFIG_KEY, undefined, target);
  }
}

/**
 * Creates a mock config adapter for testing.
 */
export function createMockConfigAdapter(
  config: Record<string, unknown> = {}
): WorkspaceConfigAdapter {
  return {
    getConfiguration(): WorkspaceConfiguration {
      return {
        get: (key: string) => {
          const keys = key.split('.');
          let value: unknown = config;
          for (const k of keys) {
            value = (value as Record<string, unknown>)[k];
            if (value === undefined) return undefined;
          }
          return value;
        },
        has: () => true,
        inspect: () => ({ key: '', defaultValue: '', globalValue: '', workspaceValue: '' }),
        update: () => Promise.resolve(),
      } as WorkspaceConfiguration;
    },
    update: async (key: string, value: unknown) => {
      const keys = key.split('.');
      let target: Record<string, unknown> = config;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!Object.prototype.hasOwnProperty.call(target, k)) {
          (target as Record<string, unknown>)[k] = {};
        }
        target = (target as Record<string, unknown>)[k] as Record<string, unknown>;
      }
      target[keys[keys.length - 1]] = value;
    },
  };
}
