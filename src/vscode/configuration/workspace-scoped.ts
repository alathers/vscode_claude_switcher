/**
 * src/vscode/configuration/workspace-scoped.ts
 *
 * Workspace Configuration Module
 *
 * Accesses VS Code workspace settings and configuration.
 * All VS Code API access is isolated in the vscode layer.
 *
 * This module CONTAINS VS Code API imports - part of the vscode layer.
 */

import * as vscode from 'vscode';

// ============================================================
// WORKSPACE CONFIGURATION TYPES
// ============================================================

/**
 * Configuration keys for the extension.
 */
export const CONFIGURATION_SECTION = 'claudeSwitcher';

/**
 * Workspace configuration values.
 */
export interface WorkspaceConfig {
  /** Default profile ID for the workspace */
  defaultProfileId: string | undefined;

  /** Whether the extension is enabled in this workspace */
  enabled: boolean;

  /** Privacy mode override for this workspace */
  privacyMode: 'unrestricted' | 'guarded' | 'strict' | undefined;

  /** Path to workspace policy file */
  policyFilePath: string | undefined;

  /** Path to repository profiles directory */
  profilesDirectory: string | undefined;

  /** Activity update interval in milliseconds */
  activityUpdateInterval: number;

  /** Whether to show activity status in status bar */
  showActivityStatus: boolean;
}

/**
 * Configuration change event information.
 */
export interface ConfigChangeEvent {
  /** Configuration key that changed */
  key: string;

  /** Old value (if known) */
  oldValue: unknown;

  /** New value */
  newValue: unknown;

  /** Whether this affects the active profile */
  affectsActiveProfile: boolean;
}

/**
 * Configuration change listener callback.
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

// ============================================================
// WORKSPACE CONFIGURATION MANAGER
// ============================================================

/**
 * Manages VS Code workspace configuration for the extension.
 *
 * Usage:
 * ```typescript
 * const config = new WorkspaceConfigurationManager();
 * const currentConfig = config.getConfig();
 *
 * // Listen for configuration changes
 * config.onDidChangeConfig((event) => {
 *   console.log(`Config changed: ${event.key}`);
 * });
 *
 * // Update configuration
 * await config.setConfig('defaultProfileId', 'my-profile');
 * ```
 *
 * This module isolates all VS Code workspace.getConfiguration() API access,
 * allowing core logic modules to remain free of VS Code imports.
 *
 * Configuration scope:
 * - Workspace settings apply to all users in the workspace
 * - User settings override workspace settings
 * - Default settings are provided for all configurations
 */
export class WorkspaceConfigurationManager {
  private readonly config: vscode.WorkspaceConfiguration;
  private disposables: vscode.Disposable[] = [];
  private listeners: Set<ConfigChangeListener> = new Set();

  /**
   * Default configuration values.
   *
   * These are used when no workspace or user configuration is set.
   */
  private static readonly DEFAULTS: WorkspaceConfig = {
    defaultProfileId: undefined,
    enabled: true,
    privacyMode: undefined,
    policyFilePath: undefined,
    profilesDirectory: undefined,
    activityUpdateInterval: 1000, // 1 second
    showActivityStatus: true,
  };

  constructor() {
    this.config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  }

  /**
   * Get current workspace configuration.
   *
   * Merges workspace, user, and default configuration values.
   *
   * @returns Current workspace configuration
   */
  getConfig(): WorkspaceConfig {
    return {
      defaultProfileId: this.get<string>('defaultProfileId') ?? WorkspaceConfigurationManager.DEFAULTS.defaultProfileId,
      enabled: this.get<boolean>('enabled', true) ?? WorkspaceConfigurationManager.DEFAULTS.enabled,
      privacyMode: this.get<'unrestricted' | 'guarded' | 'strict'>('privacyMode') ?? WorkspaceConfigurationManager.DEFAULTS.privacyMode,
      policyFilePath: this.get<string>('policyFilePath') ?? WorkspaceConfigurationManager.DEFAULTS.policyFilePath,
      profilesDirectory: this.get<string>('profilesDirectory') ?? WorkspaceConfigurationManager.DEFAULTS.profilesDirectory,
      activityUpdateInterval: this.get<number>('activityUpdateInterval', WorkspaceConfigurationManager.DEFAULTS.activityUpdateInterval) ?? WorkspaceConfigurationManager.DEFAULTS.activityUpdateInterval,
      showActivityStatus: this.get<boolean>('showActivityStatus', WorkspaceConfigurationManager.DEFAULTS.showActivityStatus) ?? WorkspaceConfigurationManager.DEFAULTS.showActivityStatus,
    };
  }

  /**
   * Get a specific configuration value.
   *
   * @param key - Configuration key (without section prefix)
   * @param defaultValue - Default value if configuration is not set
   * @returns Configuration value
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    if (defaultValue !== undefined) {
      return this.config.get<T>(key, defaultValue);
    }
    return this.config.get<T>(key);
  }

  /**
   * Check if a specific configuration key is set.
   *
   * @param key - Configuration key (without section prefix)
   * @returns true if configuration is explicitly set
   */
  has(key: string): boolean {
    return this.config.has(key);
  }

  /**
   * Set a configuration value.
   *
   * @param key - Configuration key (without section prefix)
   * @param value - Value to set
   * @param scope - Configuration scope (global, workspace, or workspaceFolder)
   * @returns Promise that resolves when configuration is updated
   */
  async set(key: string, value: unknown, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.config.update(key, value, scope);
  }

  /**
   * Set multiple configuration values at once.
   *
   * @param values - Object with key-value pairs
   * @param scope - Configuration scope (global, workspace, or workspaceFolder)
   * @returns Promise that resolves when configuration is updated
   */
  async setMultiple(values: Partial<WorkspaceConfig>, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await Promise.all(
      Object.entries(values).map(([key, value]) => this.set(key, value, scope)),
    );
  }

  /**
   * Get the default profile ID for the workspace.
   *
   * Returns undefined if no default profile is configured.
   *
   * @returns Default profile ID or undefined
   */
  getDefaultProfileId(): string | undefined {
    return this.get<string>('defaultProfileId');
  }

  /**
   * Set the default profile ID for the workspace.
   *
   * @param profileId - Profile ID to set as default
   * @param scope - Configuration scope
   * @returns Promise that resolves when configuration is updated
   */
  async setDefaultProfileId(profileId: string | undefined, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.set('defaultProfileId', profileId, scope);
  }

  /**
   * Get the privacy mode override for the workspace.
   *
   * Returns undefined if using policy-default.
   *
   * @returns Privacy mode or undefined
   */
  getPrivacyMode(): 'unrestricted' | 'guarded' | 'strict' | undefined {
    return this.get<'unrestricted' | 'guarded' | 'strict'>('privacyMode');
  }

  /**
   * Set the privacy mode override for the workspace.
   *
   * @param mode - Privacy mode or undefined to use policy-default
   * @param scope - Configuration scope
   * @returns Promise that resolves when configuration is updated
   */
  async setPrivacyMode(mode: 'unrestricted' | 'guarded' | 'strict' | undefined, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.set('privacyMode', mode, scope);
  }

  /**
   * Get the path to the workspace policy file.
   *
   * Returns undefined if not configured.
   *
   * @returns Policy file path or undefined
   */
  getPolicyFilePath(): string | undefined {
    return this.get<string>('policyFilePath');
  }

  /**
   * Set the path to the workspace policy file.
   *
   * @param path - Absolute path to policy file
   * @param scope - Configuration scope
   * @returns Promise that resolves when configuration is updated
   */
  async setPolicyFilePath(path: string | undefined, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.set('policyFilePath', path, scope);
  }

  /**
   * Get the path to repository profiles directory.
   *
   * Returns undefined if not configured.
   *
   * @returns Profiles directory path or undefined
   */
  getProfilesDirectory(): string | undefined {
    return this.get<string>('profilesDirectory');
  }

  /**
   * Set the path to repository profiles directory.
   *
   * @param path - Absolute path to profiles directory
   * @param scope - Configuration scope
   * @returns Promise that resolves when configuration is updated
   */
  async setProfilesDirectory(path: string | undefined, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.set('profilesDirectory', path, scope);
  }

  /**
   * Check if the extension is enabled in this workspace.
   *
   * @returns true if extension is enabled
   */
  isEnabled(): boolean {
    return this.get('enabled', true) ?? true;
  }

  /**
   * Enable or disable the extension in this workspace.
   *
   * @param enabled - Whether extension should be enabled
   * @param scope - Configuration scope
   * @returns Promise that resolves when configuration is updated
   */
  async setEnabled(enabled: boolean, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.set('enabled', enabled, scope);
  }

  /**
   * Register a listener for configuration changes.
   *
   * @param listener - Callback function to invoke on configuration changes
   * @returns Disposable to stop listening for changes
   */
  onDidChangeConfig(listener: ConfigChangeListener): vscode.Disposable {
    this.listeners.add(listener);

    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  /**
   * Watch for configuration changes in VS Code.
   *
   * This method should be called during extension activation to start
   * listening for configuration changes.
   *
   * @returns Disposable to stop watching
   */
  watchConfigurationChanges(): vscode.Disposable {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      // Check if this change affects our extension's configuration
      if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
        // Get changed keys by comparing old and new configuration
        this.notifyConfigListeners();
      }
    });

    this.disposables.push(disposable);
    return disposable;
  }

  /**
   * Notify all registered listeners of a configuration change.
   *
   * This method should be called when configuration is programmatically updated.
   */
  notifyConfigListeners(): void {
    const currentConfig = this.getConfig();

    this.listeners.forEach((listener) => {
      // For simplicity, we notify of all keys as changed
      // In a more sophisticated implementation, we would track individual key changes
      Object.keys(currentConfig).forEach((key) => {
        listener({
          key,
          oldValue: undefined,
          newValue: (currentConfig as unknown as Record<string, unknown>)[key],
          affectsActiveProfile: key === 'defaultProfileId' || key === 'privacyMode',
        });
      });
    });
  }

  /**
   * Get the workspace folder for the current context.
   *
   * If called from a workspace folder context, returns that folder.
   * Otherwise returns the first workspace folder.
   *
   * @returns Workspace folder URI or undefined
   */
  getWorkspaceFolder(): vscode.Uri | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    if (workspaceFolders.length === 1) {
      return workspaceFolders[0].uri;
    }

    // If multiple workspace folders, default to the first one
    // In a more sophisticated implementation, we would use the active text editor's workspace folder
    return workspaceFolders[0].uri;
  }

  /**
   * Dispose all resources.
   *
   * This method should be called during extension deactivation.
   */
  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.listeners.clear();
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get the workspace configuration manager instance.
 *
 * @returns Workspace configuration manager
 */
export function getWorkspaceConfigurationManager(): WorkspaceConfigurationManager {
  return new WorkspaceConfigurationManager();
}

/**
 * Get the default profile ID for the current workspace.
 *
 * @returns Default profile ID or undefined
 */
export function getDefaultWorkspaceProfileId(): string | undefined {
  const manager = new WorkspaceConfigurationManager();
  return manager.getDefaultProfileId();
}

/**
 * Check if the extension is enabled in the current workspace.
 *
 * @returns true if extension is enabled
 */
export function isExtensionEnabled(): boolean {
  const manager = new WorkspaceConfigurationManager();
  return manager.isEnabled();
}

/**
 * Get workspace configuration section prefix.
 *
 * @returns Configuration section string
 */
export function getConfigurationSection(): string {
  return CONFIGURATION_SECTION;
}
