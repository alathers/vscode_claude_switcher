/**
 * src/core/state/profile-registry.ts
 *
 * Profile Registry
 *
 * Handles profile loading from YAML, merging defaults, validation logic,
 * and template overlay (repository template + user overlay).
 *
 * This file contains NO VS Code API imports - pure TypeScript logic.
 */

import { parse as parseYaml } from 'yaml';
import type { ProfileConfig as AdapterProfileConfig } from '../adapters/contract.js';

// ============================================================
// ERROR TYPES
// ============================================================

/**
 * Error thrown when profile loading fails (invalid YAML, missing required fields, etc.).
 */
export class ProfileLoadError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ProfileLoadError';
  }
}

/**
 * Error thrown when profile validation fails.
 */
export class ProfileValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ProfileValidationError';
  }
}

/**
 * Validation error detail.
 */
export interface ValidationError {
  path: string;
  message: string;
}

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Complete profile configuration including fields not sent to adapters.
 *
 * This extends the adapter-facing ProfileConfig with additional metadata fields
 * used by the registry and validation layers (schemaVersion, label, etc.).
 */
export interface ProfileConfig extends AdapterProfileConfig {
  /** Schema version for profile evolution */
  schemaVersion: number;
  /** Human-readable profile label */
  label: string;
  /** Schema version for profile evolution */
}

/**
 * Result of loading a profile or template from YAML.
 */
export interface ProfileLoadResult<T> {
  success: boolean;
  profile: T | null;
  errors: ValidationError[];
}

/**
 * Result of template overlay operation.
 */
export interface TemplateOverlayResult {
  success: boolean;
  mergedProfile: ProfileConfig | null;
  errors: ValidationError[];
}

/**
 * Default values that can be merged into partial profiles.
 */
export interface ProfileMergeDefaults {
  schemaVersion: number;
  label: string;
  tunnel: {
    enabled: boolean;
    sshHostAlias: string | null;
    localPort: number | null;
  };
  limits: {
    contextTokens?: number | null;
    maxOutputTokens?: number | null;
  } | undefined;
  instructions: string | null;
  environmentRefs: string[];
  healthCheck: {
    url?: string | null;
    method?: 'GET' | 'POST' | null;
  } | undefined;
}

/**
 * Raw profile schema from YAML (before type conversion).
 */
export interface RawProfileSchema {
  schemaVersion?: number;
  id?: string;
  label?: string;
  adapter?: string;
  model?: string;
  baseUrl?: string;
  credential?: {
    mode?: string;
    secretRef?: string | null;
    secretRefs?: string[] | null;
    keyRotationStrategy?: string | null;
  };
  tunnel?: {
    enabled?: boolean;
    sshHostAlias?: string | null;
    localPort?: number | null;
  };
  limits?: {
    contextTokens?: number | null;
    maxOutputTokens?: number | null;
  };
  permissions?: {
    mode?: string;
    workspacePaths?: string[];
  };
  network?: {
    providerClass?: string;
    supportingNetwork?: string;
  };
  instructions?: string | null;
  environmentRefs?: string[];
  healthCheck?: {
    url?: string | null;
    method?: string | null;
  };
  capabilities?: {
    streaming?: boolean;
    tools?: boolean;
    fileEdits?: boolean;
    commands?: boolean;
    modelDiscovery?: boolean;
    transcriptObservable?: boolean;
  };
}

// ============================================================
// PROFILE REGISTRY CLASS
// ============================================================

/**
 * Profile Registry
 *
 * Manages profile loading, validation, and template overlay operations.
 *
 * Key responsibilities:
 * - Load profiles and templates from YAML strings
 * - Validate profile structure and field values
 * - Merge default values into partial profiles
 * - Overlay user profiles onto repository templates
 * - Enforce template security (no secretRef in templates)
 */
export class ProfileRegistry {
  /**
   * Load a user profile from YAML string.
   *
   * @param id - Profile ID (for error reporting and validation)
   * @param yaml - YAML content to parse
   * @returns Load result with profile or errors
   */
  loadUserProfile(id: string, yaml: string): ProfileLoadResult<ProfileConfig> {
    return this._loadYamlProfile(id, yaml, false);
  }

  /**
   * Load a repository template from YAML string.
   *
   * Templates have stricter validation: they MUST NOT contain credential.secretRef values
   * per FR-005 (security requirement).
   *
   * @param id - Template ID (for error reporting and validation)
   * @param yaml - YAML content to parse
   * @returns Load result with template or errors
   */
  loadTemplate(id: string, yaml: string): ProfileLoadResult<ProfileConfig> {
    const result = this._loadYamlProfile(id, yaml, true);

    if (!result.success) {
      return result;
    }

    // Template-specific validation: no secretRef allowed (FR-005)
    if (result.profile?.credential.mode === 'secretRef' && result.profile.credential.secretRef) {
      return {
        success: false,
        profile: null,
        errors: [
          {
            path: 'credential.secretRef',
            message:
              'Templates must not contain credential.secretRef values (profiles should use user overlays for secrets per FR-005)',
          },
        ],
      };
    }

    return result;
  }

  /**
   * Merge default values into a partial profile.
   *
   * User-provided values override defaults for non-null fields.
   *
   * @param partial - Partial profile with user values
   * @param defaults - Default values to merge
   * @returns Complete profile with defaults applied
   */
  mergeDefaults(partial: ProfileConfig, defaults: ProfileMergeDefaults): ProfileConfig {
    return {
      ...partial,
      schemaVersion: defaults.schemaVersion,
      label: partial.label ?? defaults.label,
      tunnel: partial.tunnel ?? defaults.tunnel,
      limits: partial.limits ?? defaults.limits,
      instructions: partial.instructions ?? defaults.instructions,
      environmentRefs: partial.environmentRefs ?? defaults.environmentRefs,
      healthCheck: partial.healthCheck ?? defaults.healthCheck,
    };
  }

  /**
   * Overlay user profile onto repository template.
   *
   * The user profile (overlay) takes precedence over the template for all fields except
   * security-specific validations. This enables team defaults with user-specific overrides.
   *
   * @param userProfile - User-provided profile overlay
   * @param template - Repository template (null if standalone profile)
   * @returns Merged profile with template and user values
   */
  overlayTemplate(
    userProfile: ProfileConfig,
    template: ProfileConfig | null,
  ): TemplateOverlayResult {
    if (!template) {
      return {
        success: true,
        mergedProfile: { ...userProfile },
        errors: [],
      };
    }

    // Validate ID match (user overlay ID must match template ID)
    if (userProfile.id !== template.id) {
      return {
        success: false,
        mergedProfile: null,
        errors: [
          {
            path: 'id',
            message: `Overlay ID mismatch: user profile has ID '${userProfile.id}' but template has ID '${template.id}'`,
          },
        ],
      };
    }

    // Merge template and user profile (user values take precedence)
    const merged: ProfileConfig = {
      // Template fields (baseline)
      id: template.id,
      adapter: userProfile.adapter ?? template.adapter,
      model: userProfile.model ?? template.model,
      baseUrl: userProfile.baseUrl ?? template.baseUrl,

      // User overlay takes precedence for credentials
      credential: userProfile.credential,

      // Merge tunnel with user preference
      tunnel: {
        enabled: userProfile.tunnel?.enabled ?? template.tunnel?.enabled ?? false,
        sshHostAlias: userProfile.tunnel?.sshHostAlias ?? template.tunnel?.sshHostAlias ?? null,
        localPort: userProfile.tunnel?.localPort ?? template.tunnel?.localPort ?? null,
      },

      // Merge limits with user preference
      limits: {
        contextTokens: userProfile.limits?.contextTokens ?? template.limits?.contextTokens,
        maxOutputTokens: userProfile.limits?.maxOutputTokens ?? template.limits?.maxOutputTokens,
      },

      // Merge permissions with user preference
      permissions: {
        mode: userProfile.permissions.mode,
        workspacePaths: userProfile.permissions.workspacePaths ?? template.permissions.workspacePaths,
      },

      // Network classification (user override)
      network: {
        providerClass: userProfile.network.providerClass,
        supportingNetwork: userProfile.network.supportingNetwork,
      },

      // Instructions (user override or template)
      instructions: userProfile.instructions ?? template.instructions,

      // Environment refs (user override or template)
      environmentRefs: userProfile.environmentRefs ?? template.environmentRefs ?? [],

      // Health check (user override or template)
      healthCheck: userProfile.healthCheck ?? template.healthCheck,

      // Capabilities (user override with validation)
      capabilities: {
        streaming: userProfile.capabilities.streaming ?? template.capabilities.streaming,
        tools: userProfile.capabilities.tools ?? template.capabilities.tools,
        fileEdits: userProfile.capabilities.fileEdits ?? template.capabilities.fileEdits,
        commands: userProfile.capabilities.commands ?? template.capabilities.commands,
        modelDiscovery:
          userProfile.capabilities.modelDiscovery ?? template.capabilities.modelDiscovery,
        transcriptObservable:
          userProfile.capabilities.transcriptObservable ??
          template.capabilities.transcriptObservable,
      },

      // Schema and label from user if provided
      schemaVersion: userProfile.schemaVersion ?? template.schemaVersion ?? 1,
      label: userProfile.label ?? template.label ?? '',
    };

    return {
      success: true,
      mergedProfile: merged,
      errors: [],
    };
  }

  /**
   * Validate profile configuration.
   *
   * Checks:
   * - All required fields present
   * - Valid enum values for fields with constraints
   * - ID format (lowercase alphanumeric with hyphens)
   * - Self-consistency (e.g., tunnel enabled requires sshHostAlias)
   *
   * @param profile - Profile configuration to validate
   * @returns Validation result with status and errors
   */
  validateProfileConfig(profile: ProfileConfig): {
    valid: boolean;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    // Validate ID format (lowercase alphanumeric with hyphens)
    if (!profile.id || !/^[a-z0-9-]+$/.test(profile.id)) {
      errors.push({
        path: 'id',
        message: 'Profile ID must be lowercase alphanumeric with hyphens only',
      });
    }

    // Validate adapter type
    const validAdapters = [
      'native-claude',
      'anthropic-compatible',
      'openai-compatible',
      'ollama',
      'generic-command',
    ] as const;
    if (!validAdapters.includes(profile.adapter)) {
      errors.push({
        path: 'adapter',
        message: `Invalid adapter type '${profile.adapter}'. Must be one of: ${validAdapters.join(', ')}`,
      });
    }

    // Validate credential mode
    const validCredentialModes = ['none', 'secretRef', 'environment', 'subscription', 'multi-key'];
    if (!validCredentialModes.includes(profile.credential.mode)) {
      errors.push({
        path: 'credential.mode',
        message: `Invalid credential mode '${profile.credential.mode}'. Must be one of: ${validCredentialModes.join(', ')}`,
      });
    }

    // Validate secretRef present when mode is secretRef
    if (profile.credential.mode === 'secretRef' && !profile.credential.secretRef) {
      errors.push({
        path: 'credential.secretRef',
        message: 'secretRef must be provided when credential.mode is secretRef',
      });
    }

    // Validate tunnel self-consistency
    if (profile.tunnel?.enabled && !profile.tunnel.sshHostAlias) {
      errors.push({
        path: 'tunnel.sshHostAlias',
        message: 'sshHostAlias must be provided when tunnel.enabled is true',
      });
    }

    // Validate permissions mode
    const validPermissionModes = ['review-only', 'edit-only', 'edit-and-command'];
    if (!validPermissionModes.includes(profile.permissions.mode)) {
      errors.push({
        path: 'permissions.mode',
        message: `Invalid permission mode '${profile.permissions.mode}'. Must be one of: ${validPermissionModes.join(', ')}`,
      });
    }

    // Validate network provider class
    const validProviderClasses = ['local', 'private-network', 'cloud'];
    if (!validProviderClasses.includes(profile.network.providerClass)) {
      errors.push({
        path: 'network.providerClass',
        message: `Invalid providerClass '${profile.network.providerClass}'. Must be one of: ${validProviderClasses.join(', ')}`,
      });
    }

    // Validate network supporting network
    const validSupportingNetwork = ['allowed', 'blocked'];
    if (!validSupportingNetwork.includes(profile.network.supportingNetwork)) {
      errors.push({
        path: 'network.supportingNetwork',
        message: `Invalid supportingNetwork '${profile.network.supportingNetwork}'. Must be one of: ${validSupportingNetwork.join(', ')}`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Parse YAML and convert to ProfileConfig with validation.
   */
  private _loadYamlProfile(
    _id: string,
    yaml: string,
    _isTemplate: boolean,
  ): ProfileLoadResult<ProfileConfig> {
    const errors: ValidationError[] = [];

    // Parse YAML
    let raw: RawProfileSchema;
    try {
      raw = parseYaml(yaml) as RawProfileSchema;
      if (!raw || typeof raw !== 'object') {
        return {
          success: false,
          profile: null,
          errors: [{ path: '', message: 'YAML content is not an object' }],
        };
      }
    } catch (err) {
      return {
        success: false,
        profile: null,
        errors: [{ path: '', message: `YAML parsing failed: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }

    // Validate required fields
    if (!raw.id) {
      errors.push({ path: 'id', message: 'Required field missing' });
    }
    if (!raw.adapter) {
      errors.push({ path: 'adapter', message: 'Required field missing' });
    }
    if (!raw.model) {
      errors.push({ path: 'model', message: 'Required field missing' });
    }
    if (!raw.credential?.mode) {
      errors.push({ path: 'credential.mode', message: 'Required field missing' });
    }
    if (!raw.permissions?.mode) {
      errors.push({ path: 'permissions.mode', message: 'Required field missing' });
    }
    if (!raw.network?.providerClass) {
      errors.push({ path: 'network.providerClass', message: 'Required field missing' });
    }
    if (!raw.network?.supportingNetwork) {
      errors.push({ path: 'network.supportingNetwork', message: 'Required field missing' });
    }
    if (!raw.capabilities) {
      errors.push({ path: 'capabilities', message: 'Required field missing' });
    }

    if (errors.length > 0) {
      return { success: false, profile: null, errors };
    }

    // Convert raw profile to typed ProfileConfig
    const profile: ProfileConfig = {
      id: raw.id!,
      adapter: raw.adapter! as ProfileConfig['adapter'],
      model: raw.model!,
      baseUrl: raw.baseUrl,
      credential: {
        mode: raw.credential!.mode! as ProfileConfig['credential']['mode'],
        secretRef: raw.credential!.secretRef ?? null,
        secretRefs: raw.credential!.secretRefs ?? null,
        keyRotationStrategy: (raw.credential!.keyRotationStrategy ??
          null) as ProfileConfig['credential']['keyRotationStrategy'],
      },
      tunnel: raw.tunnel
        ? {
            enabled: raw.tunnel.enabled ?? false,
            sshHostAlias: raw.tunnel.sshHostAlias ?? null,
            localPort: raw.tunnel.localPort ?? null,
          }
        : undefined,
      limits: raw.limits
        ? {
            contextTokens: raw.limits.contextTokens ?? null,
            maxOutputTokens: raw.limits.maxOutputTokens ?? null,
          }
        : undefined,
      permissions: {
        mode: raw.permissions!.mode! as ProfileConfig['permissions']['mode'],
        workspacePaths: raw.permissions!.workspacePaths,
      },
      network: {
        providerClass: raw.network!.providerClass! as ProfileConfig['network']['providerClass'],
        supportingNetwork: raw.network!.supportingNetwork! as ProfileConfig['network']['supportingNetwork'],
      },
      instructions: raw.instructions ?? null,
      environmentRefs: raw.environmentRefs ?? [],
      healthCheck: raw.healthCheck
        ? {
            url: raw.healthCheck.url ?? null,
            method: raw.healthCheck.method && ['GET', 'POST'].includes(raw.healthCheck.method)
              ? (raw.healthCheck.method as 'GET' | 'POST')
              : 'GET',
          }
        : undefined,
      capabilities: {
        streaming: raw.capabilities!.streaming ?? false,
        tools: raw.capabilities!.tools ?? false,
        fileEdits: raw.capabilities!.fileEdits ?? false,
        commands: raw.capabilities!.commands ?? false,
        modelDiscovery: raw.capabilities!.modelDiscovery ?? false,
        transcriptObservable: raw.capabilities!.transcriptObservable ?? false,
      },
      schemaVersion: raw.schemaVersion ?? 1,
      label: raw.label ?? raw.id!,
    };

    return {
      success: true,
      profile,
      errors: [],
    };
  }
}
