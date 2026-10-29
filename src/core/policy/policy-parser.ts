/**
 * src/core/policy/policy-parser.ts
 *
 * Policy Parser
 *
 * Workspace policy YAML parsing and validation logic.
 * This file contains NO VS Code API imports - pure TypeScript logic.
 */

import YAML from 'yaml';
import { WorkspacePolicy, HandoffMode } from './policy-engine.js';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Validation error.
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Parse result.
 */
export interface ParseResult {
  success: boolean;
  policy?: WorkspacePolicy;
  errors?: ValidationError[];
}

/**
 * Concurrency default enum.
 */
type ConcurrencyDefault = 'concurrent' | 'exclusive-writer';

/**
 * Conflict action enum.
 */
type ConflictAction = 'warn' | 'block';

// ============================================================
// VALIDATION CONSTANTS
// ============================================================

/**
 * Supported schema versions.
 */
const SUPPORTED_SCHEMA_VERSIONS = [1];

/**
 * Valid privacy modes.
 */
const VALID_PRIVACY_MODES: Set<string> = new Set([
  'unrestricted',
  'guarded',
  'strict',
]);

/**
 * Valid cloud model request default actions.
 */
const VALID_CLOUD_MODEL_REQUEST_ACTIONS: Set<string> = new Set([
  'require-confirmation',
  'block',
  'allow',
]);

/**
 * Valid handoff modes.
 */
const VALID_HANDOFF_MODES: Set<string> = new Set([
  'full',
  'summary',
  'none',
]);

/**
 * Valid concurrency defaults.
 */
const VALID_CONCURRENCY_DEFAULTS: Set<string> = new Set([
  'concurrent',
  'exclusive-writer',
]);

/**
 * Valid conflict actions.
 */
const VALID_CONFLICT_ACTIONS: Set<string> = new Set(['warn', 'block']);

// ============================================================
// POLICY PARSER CLASS
// ============================================================

/**
 * Policy Parser
 *
 * Parses and validates workspace policy YAML files.
 *
 * Key responsibilities:
 * - Parse YAML strings into workspace policy objects
 * - Validate schema version
 * - Validate privacy mode and cloud model request default action
 * - Validate handoff configuration (allowed modes, default mode)
 * - Validate concurrency configuration (default, conflict action)
 * - Validate profile restrictions (allowed template IDs)
 * - Provide detailed validation errors for debugging
 *
 * Per-user visibility only - no cross-user tracking per FR-044 clarification.
 */
export class PolicyParser {
  /**
   * Parse workspace policy from YAML string.
   *
   * @param yamlString - YAML string to parse
   * @returns Parse result with policy or errors
   */
  parse(yamlString: string): WorkspacePolicy {
    let parsed: unknown;

    try {
      parsed = YAML.parse(yamlString);
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML: expected object');
    }

    // Validate type
    const obj = parsed as Record<string, unknown>;

    // Validate required top-level fields
    this.validateSchemaVersion(obj);

    const privacy = this.validatePrivacySection(obj);
    const concurrency = obj.concurrency ? this.validateConcurrencySection(obj.concurrency) : undefined;
    const profiles = obj.profiles ? this.validateProfilesSection(obj.profiles) : undefined;

    return {
      privacy,
      concurrency,
      profiles,
    };
  }

  /**
   * Serializes workspace policy to YAML string.
   *
   * @param policy - Workspace policy to serialize
   * @returns YAML string
   */
  serialize(policy: WorkspacePolicy): string {
    return YAML.stringify(policy);
  }

  // ============================================================
  // VALIDATION METHODS
  // ============================================================

  /**
   * Validate schema version.
   *
   * @param obj - Parsed YAML object
   * @throws Error if invalid
   */
  private validateSchemaVersion(obj: Record<string, unknown>): void {
    const schemaVersion = obj.schemaVersion;

    if (schemaVersion === undefined || schemaVersion === null) {
      throw new Error('Required field "schemaVersion" is missing');
    }

    if (typeof schemaVersion !== 'number') {
      throw new Error(`Invalid schema version: expected number, got ${typeof schemaVersion}`);
    }

    if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
      throw new Error(
        `Unsupported schema version: ${schemaVersion}. Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`,
      );
    }
  }

  /**
   * Validate privacy section.
   *
   * @param obj - Parsed YAML object
   * @returns Validated privacy section
   * @throws Error if invalid
   */
  private validatePrivacySection(obj: Record<string, unknown>): Required<WorkspacePolicy>['privacy'] {
    const privacy = obj.privacy;

    if (privacy === undefined || privacy === null) {
      throw new Error('Required field "privacy" is missing');
    }

    if (typeof privacy !== 'object') {
      throw new Error(`Invalid privacy section: expected object, got ${typeof privacy}`);
    }

    const privacyObj = privacy as Record<string, unknown>;

    // Validate mode
    const mode = this.validatePrivacyMode(privacyObj);

    // Validate cloudModelRequests
    const cloudModelRequests = this.validateCloudModelRequests(privacyObj);

    // Validate optional handoff section
    const handoff = privacyObj.handoff ? this.validateHandoffSection(privacyObj.handoff) : undefined;

    // Validate optional policyChanges section
    const policyChanges = privacyObj.policyChanges
      ? this.validatePolicyChangesSection(privacyObj.policyChanges)
      : undefined;

    return {
      mode,
      cloudModelRequests,
      handoff,
      policyChanges,
    };
  }

  /**
   * Validate privacy mode.
   *
   * @param privacyObj - Privacy section object
   * @returns Valid privacy mode
   * @throws Error if invalid
   */
  private validatePrivacyMode(privacyObj: Record<string, unknown>): Required<WorkspacePolicy>['privacy']['mode'] {
    const mode = privacyObj.mode;

    if (mode === undefined || mode === null) {
      throw new Error('Required field "privacy.mode" is missing');
    }

    if (typeof mode !== 'string') {
      throw new Error(`Invalid privacy mode: expected string, got ${typeof mode}`);
    }

    if (!VALID_PRIVACY_MODES.has(mode)) {
      throw new Error(
        `Invalid privacy mode: "${mode}". Valid modes: ${Array.from(VALID_PRIVACY_MODES).join(', ')}`,
      );
    }

    return mode as Required<WorkspacePolicy>['privacy']['mode'];
  }

  /**
   * Validate cloud model requests section.
   *
   * @param privacyObj - Privacy section object
   * @returns Validated cloudModelRequests section
   * @throws Error if invalid
   */
  private validateCloudModelRequests(
    privacyObj: Record<string, unknown>,
  ): Required<WorkspacePolicy>['privacy']['cloudModelRequests'] {
    const cloudModelRequests = privacyObj.cloudModelRequests;

    if (cloudModelRequests === undefined || cloudModelRequests === null) {
      throw new Error('Required field "privacy.cloudModelRequests" is missing');
    }

    if (typeof cloudModelRequests !== 'object') {
      throw new Error(
        `Invalid cloudModelRequests: expected object, got ${typeof cloudModelRequests}`,
      );
    }

    const cmrObj = cloudModelRequests as Record<string, unknown>;

    const defaultAction = cmrObj.default;

    if (defaultAction === undefined || defaultAction === null) {
      throw new Error('Required field "privacy.cloudModelRequests.default" is missing');
    }

    if (typeof defaultAction !== 'string') {
      throw new Error(
        `Invalid cloud model request default action: expected string, got ${typeof defaultAction}`,
      );
    }

    if (!VALID_CLOUD_MODEL_REQUEST_ACTIONS.has(defaultAction)) {
      throw new Error(
        `Invalid cloud model request default action: "${defaultAction}". Valid actions: ${Array.from(
          VALID_CLOUD_MODEL_REQUEST_ACTIONS,
        ).join(', ')}`,
      );
    }

    return {
      default: defaultAction as Required<WorkspacePolicy>['privacy']['cloudModelRequests']['default'],
    };
  }

  /**
   * Validate handoff section.
   *
   * @param handoffObj - Handoff section object
   * @returns Validated handoff section
   * @throws Error if invalid
   */
  private validateHandoffSection(handoffObj: unknown): Required<WorkspacePolicy>['privacy']['handoff'] {
    if (typeof handoffObj !== 'object') {
      throw new Error(`Invalid handoff: expected object, got ${typeof handoffObj}`);
    }

    const handoff = handoffObj as Record<string, unknown>;

    // Validate allowedModes if present
    const allowedModes: string[] = [];
    if (handoff.allowedModes !== undefined && handoff.allowedModes !== null) {
      if (!Array.isArray(handoff.allowedModes)) {
        throw new Error(
          `Invalid handoff.allowedModes: expected array, got ${typeof handoff.allowedModes}`,
        );
      }

      for (const mode of handoff.allowedModes) {
        if (typeof mode !== 'string') {
          throw new Error(`Invalid handoff allowed mode: expected string, got ${typeof mode}`);
        }

        if (!VALID_HANDOFF_MODES.has(mode)) {
          throw new Error(
            `Invalid handoff mode: "${mode}". Valid modes: ${Array.from(VALID_HANDOFF_MODES).join(', ')}`,
          );
        }

        allowedModes.push(mode);
      }
    }

    // Validate defaultMode if present
    let defaultMode: HandoffMode = 'none';
    const defaultModeRaw = handoff.defaultMode;
    if (defaultModeRaw !== undefined && defaultModeRaw !== null) {
      if (typeof defaultModeRaw !== 'string') {
        throw new Error(
          `Invalid handoff.defaultMode: expected string, got ${typeof defaultModeRaw}`,
        );
      }

      if (!VALID_HANDOFF_MODES.has(defaultModeRaw)) {
        throw new Error(
          `Invalid handoff default mode: "${defaultModeRaw}". Valid modes: ${Array.from(
            VALID_HANDOFF_MODES,
          ).join(', ')}`,
        );
      }

      // Check if default mode is in allowed modes
      if (allowedModes.length > 0 && !allowedModes.includes(defaultModeRaw)) {
        throw new Error(
          `Invalid handoff default mode: "${defaultModeRaw}" is not in allowed modes [${allowedModes.join(', ')}]`,
        );
      }

      defaultMode = defaultModeRaw as HandoffMode;
    }

    return {
      allowedModes: allowedModes.length > 0 ? allowedModes as HandoffMode[] : undefined,
      defaultMode,
    };
  }

  /**
   * Validate policy changes section.
   *
   * @param policyChangesObj - Policy changes section object
   * @returns Validated policy changes section
   * @throws Error if invalid
   */
  private validatePolicyChangesSection(
    policyChangesObj: unknown,
  ): Required<WorkspacePolicy>['privacy']['policyChanges'] {
    if (typeof policyChangesObj !== 'object') {
      throw new Error(
        `Invalid policyChanges: expected object, got ${typeof policyChangesObj}`,
      );
    }

    const policyChanges = policyChangesObj as Record<string, unknown>;

    return {
      requireConfirmation: policyChanges.requireConfirmation === true,
      requireReason: policyChanges.requireReason === true,
      revertAfterMinutes:
        typeof policyChanges.revertAfterMinutes === 'number' && policyChanges.revertAfterMinutes > 0
          ? policyChanges.revertAfterMinutes
          : null,
      requireSecondApprover: policyChanges.requireSecondApprover === true,
    };
  }

  /**
   * Validate concurrency section.
   *
   * @param concurrencyObj - Concurrency section object
   * @returns Validated concurrency section
   * @throws Error if invalid
   */
  private validateConcurrencySection(concurrencyObj: unknown): WorkspacePolicy['concurrency'] {
    if (typeof concurrencyObj !== 'object') {
      throw new Error(
        `Invalid concurrency: expected object, got ${typeof concurrencyObj}`,
      );
    }

    const concurrency = concurrencyObj as Record<string, unknown>;

    // Validate default if present
    let defaultVal: ConcurrencyDefault = 'concurrent';
    const defaultRaw = concurrency.default;
    if (defaultRaw !== undefined && defaultRaw !== null) {
      if (typeof defaultRaw !== 'string') {
        throw new Error(
          `Invalid concurrency.default: expected string, got ${typeof defaultRaw}`,
        );
      }

      if (!VALID_CONCURRENCY_DEFAULTS.has(defaultRaw)) {
        throw new Error(
          `Invalid concurrency default: "${defaultRaw}". Valid values: ${Array.from(
            VALID_CONCURRENCY_DEFAULTS,
          ).join(', ')}`,
        );
      }

      defaultVal = defaultRaw as ConcurrencyDefault;
    }

    // Validate conflictAction if present
    let conflictAction: ConflictAction = 'warn';
    const conflictActionRaw = concurrency.conflictAction;
    if (conflictActionRaw !== undefined && conflictActionRaw !== null) {
      if (typeof conflictActionRaw !== 'string') {
        throw new Error(
          `Invalid concurrency.conflictAction: expected string, got ${typeof conflictActionRaw}`,
        );
      }

      if (!VALID_CONFLICT_ACTIONS.has(conflictActionRaw)) {
        throw new Error(
          `Invalid conflict action: "${conflictActionRaw}". Valid values: ${Array.from(
            VALID_CONFLICT_ACTIONS,
          ).join(', ')}`,
        );
      }

      conflictAction = conflictActionRaw as ConflictAction;
    }

    return {
      default: defaultVal,
      conflictAction,
      supportsWorktrees: concurrency.supportsWorktrees === true,
      checkpointBeforeMutation: concurrency.checkpointBeforeMutation === true,
    };
  }

  /**
   * Validate profiles section.
   *
   * @param profilesObj - Profiles section object
   * @returns Validated profiles section
   * @throws Error if invalid
   */
  private validateProfilesSection(profilesObj: unknown): WorkspacePolicy['profiles'] {
    if (typeof profilesObj !== 'object') {
      throw new Error(`Invalid profiles: expected object, got ${typeof profilesObj}`);
    }

    const profiles = profilesObj as Record<string, unknown>;

    // Validate allowedTemplateIds if present
    const allowedTemplateIds: string[] = [];
    if (profiles.allowedTemplateIds !== undefined && profiles.allowedTemplateIds !== null) {
      if (!Array.isArray(profiles.allowedTemplateIds)) {
        throw new Error(
          `Invalid profiles.allowedTemplateIds: expected array, got ${typeof profiles.allowedTemplateIds}`,
        );
      }

      for (const templateId of profiles.allowedTemplateIds) {
        if (typeof templateId !== 'string') {
          throw new Error(
            `Invalid profile template ID: expected string, got ${typeof templateId}`,
          );
        }

        allowedTemplateIds.push(templateId);
      }
    }

    return {
      allowedTemplateIds,
    };
  }
}

