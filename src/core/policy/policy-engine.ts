/**
 * src/core/policy/policy-engine.ts
 *
 * Policy Engine
 *
 * Privacy mode enforcement, request classification, and routing decisions.
 * This file contains NO VS Code API imports - pure TypeScript logic.
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Privacy mode enum.
 */
export type PrivacyMode = 'unrestricted' | 'guarded' | 'strict';

/**
 * Cloud model request default action enum.
 */
export type CloudModelRequestAction = 'require-confirmation' | 'block' | 'allow';

/**
 * Handoff mode enum.
 */
export type HandoffMode = 'full' | 'summary' | 'none';

/**
 * Concurrency default enum.
 */
export type ConcurrencyDefault = 'concurrent' | 'exclusive-writer';

/**
 * Conflict action enum.
 */
export type ConflictAction = 'warn' | 'block';

/**
 * Traffic classification enum.
 */
export type TrafficClassification = 'model-provider' | 'supporting';

/**
 * Provider class enum.
 */
export type ProviderClass = 'local' | 'private-network' | 'cloud';

/**
 * Cloud destination enum.
 */
export type CloudDestination = 'cloud' | 'local';

/**
 * Workspace policy configuration.
 */
export interface WorkspacePolicy {
  privacy: {
    mode: PrivacyMode;
    cloudModelRequests: {
      default: CloudModelRequestAction;
    };
    handoff?: {
      allowedModes?: HandoffMode[];
      defaultMode?: HandoffMode;
    };
    policyChanges?: {
      requireConfirmation?: boolean;
      requireReason?: boolean;
      revertAfterMinutes?: number | null;
      requireSecondApprover?: boolean;
    };
  };
  concurrency?: {
    default?: ConcurrencyDefault;
    conflictAction?: ConflictAction;
    supportsWorktrees?: boolean;
    checkpointBeforeMutation?: boolean;
  };
  profiles?: {
    allowedTemplateIds?: string[];
  };
}

/**
 * Request classification result.
 */
export interface RequestClassification {
  classification: TrafficClassification;
  providerClass?: ProviderClass;
}

/**
 * Routing decision result.
 */
export interface RoutingDecision {
  allowed: boolean;
  requiresApproval: boolean;
  action: 'proceed' | 'require-approval' | 'block';
  blockedReason?: string;
}

/**
 * Handoff check result.
 */
export interface HandoffCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Handoff routing result.
 */
export interface HandoffRouting {
  allowed: boolean;
  blockedReason?: string;
}

/**
 * Policy change requirements.
 */
export interface PolicyChangeRequirements {
  requiresConfirmation: boolean;
  requiresReason: boolean;
  revertAfterMinutes?: number | null;
  requiresSecondApprover: boolean;
}

/**
 * Concurrency policy.
 */
export interface ConcurrencyPolicy {
  default: ConcurrencyDefault;
  conflictAction: ConflictAction;
  supportsWorktrees: boolean;
  checkpointBeforeMutation: boolean;
}

/**
 * Request type tracking.
 */
export type RequestType =
  | 'model-request'
  | 'web-search'
  | 'git-operation'
  | 'package-request'
  | 'docs-request';

/**
 * Request interface.
 */
export interface Request {
  type: RequestType;
  providerClass?: ProviderClass;
  endpoint?: string;
  url?: string;
  operation?: string;
  manager?: string;
}

/**
 * Policy change request.
 */
export interface PolicyChangeRequest {
  mode?: PrivacyMode;
  cloudModelRequests?: {
    default?: CloudModelRequestAction;
  };
  handoff?: {
    allowedModes?: HandoffMode[];
    defaultMode?: HandoffMode;
  };
}

// ============================================================
// POLICY ENGINE CLASS
// ============================================================

/**
 * Policy Engine
 *
 * Enforces privacy mode, classifies requests, and makes routing decisions.
 *
 * Key responsibilities:
 * - Classify requests into model-provider vs supporting traffic
 * - Enforce privacy mode restrictions (unrestricted, guarded, strict)
 * - Route requests based on policy configuration
 * - Handoff policy enforcement and validation
 * - Concurrency policy management
 * - Profile governance (allowed template IDs)
 * - Policy change requirements checking
 *
 * Per-user visibility only - no cross-user tracking per FR-044 clarification.
 */
export class PolicyEngine {
  private policy: WorkspacePolicy;

  /**
   * Create a new policy engine with the given workspace policy.
   *
   * @param policy - Workspace policy configuration
   */
  constructor(policy: WorkspacePolicy) {
    this.validatePrivacyMode(policy.privacy.mode);
    this.policy = this.normalizePolicy(policy);
  }

  // ============================================================
  // REQUEST CLASSIFICATION
  // ============================================================

  /**
   * Classify a request as model-provider or supporting traffic.
   *
   * Model-provider requests: Direct AI model requests
   * Supporting traffic: Web search, git, package managers, docs, etc.
   *
   * @param request - Request to classify
   * @returns Classification result
   * @throws Error if request type is unknown
   */
  classifyRequest(request: Request): TrafficClassification {
    switch (request.type) {
      case 'model-request':
        return 'model-provider';
      case 'web-search':
      case 'git-operation':
      case 'package-request':
      case 'docs-request':
        return 'supporting';
      default:
        throw new Error(`Unknown request type: ${request.type as string}`);
    }
  }

  /**
   * Get provider class from request.
   *
   * @param request - Request to extract provider class from
   * @returns Provider class (defaults to 'local' if not specified)
   */
  getProviderClass(request: Request): ProviderClass {
    return request.providerClass ?? 'local';
  }

  // ============================================================
  // ROUTING DECISIONS
  // ============================================================

  /**
   * Make routing decision for a request based on privacy mode and policy.
   *
   * @param request - Request to route
   * @returns Routing decision
   */
  routeRequest(request: Request): RoutingDecision {
    const classification = this.classifyRequest(request);

    // Supporting traffic always proceeds regardless of mode
    if (classification === 'supporting') {
      return {
        allowed: true,
        requiresApproval: false,
        action: 'proceed',
      };
    }

    // Model-provider traffic depends on privacy mode
    const providerClass = this.getProviderClass(request);

    // Local and private-network models always proceed
    if (providerClass === 'local' || providerClass === 'private-network') {
      return {
        allowed: true,
        requiresApproval: false,
        action: 'proceed',
      };
    }

    // Cloud model requests are subject to privacy mode
    if (providerClass === 'cloud') {
      return this.routeCloudModelRequest();
    }

    return {
      allowed: false,
      requiresApproval: false,
      action: 'block',
      blockedReason: 'Unknown provider class',
    };
  }

  /**
   * Route cloud model request based on privacy mode.
   *
   * @returns Routing decision
   */
  private routeCloudModelRequest(): RoutingDecision {
    const mode = this.policy.privacy.mode;
    const defaultAction = this.policy.privacy.cloudModelRequests.default;

    if (mode === 'unrestricted') {
      return {
        allowed: true,
        requiresApproval: false,
        action: 'proceed',
      };
    }

    if (mode === 'guarded') {
      if (defaultAction === 'allow') {
        return {
          allowed: true,
          requiresApproval: false,
          action: 'proceed',
        };
      }

      if (defaultAction === 'require-confirmation') {
        return {
          allowed: false,
          requiresApproval: true,
          action: 'require-approval',
        };
      }

      if (defaultAction === 'block') {
        return {
          allowed: false,
          requiresApproval: false,
          action: 'block',
          blockedReason: 'Guarded mode blocking cloud model requests',
        };
      }
    }

    if (mode === 'strict') {
      return {
        allowed: false,
        requiresApproval: false,
        action: 'block',
        blockedReason: 'Strict mode blocking all cloud model requests',
      };
    }

    return {
      allowed: false,
      requiresApproval: false,
      action: 'block',
      blockedReason: 'Unknown privacy mode',
    };
  }

  // ============================================================
  // HANDOFF POLICY
  // ============================================================

  /**
   * Check if a handoff mode is allowed.
   *
   * @param mode - Handoff mode to check
   * @returns Handoff check result
   */
  canHandoff(mode: HandoffMode): HandoffCheck {
    const allowedModes = this.policy.privacy.handoff?.allowedModes;

    if (!allowedModes || allowedModes.length === 0) {
      // No restrictions - all modes allowed
      return { allowed: true };
    }

    const allowed = allowedModes.includes(mode);
    return {
      allowed,
      reason: allowed ? undefined : `Mode '${mode}' not in allowed modes`,
    };
  }

  /**
   * Get the default handoff mode.
   *
   * @returns Default handoff mode (defaults to 'none' if not specified)
   */
  getDefaultHandoffMode(): HandoffMode {
    return this.policy.privacy.handoff?.defaultMode ?? 'none';
  }

  /**
   * Route handoff based on privacy mode and destination.
   *
   * @param mode - Handoff mode
   * @param destination - Handoff destination (cloud or local)
   * @returns Handoff routing result
   */
  routeHandoff(mode: HandoffMode, destination: CloudDestination): HandoffRouting {
    // Check if mode is allowed
    const modeCheck = this.canHandoff(mode);
    if (!modeCheck.allowed) {
      return {
        allowed: false,
        blockedReason: modeCheck.reason,
      };
    }

    // In strict mode, block cloud-bound handoffs
    if (this.policy.privacy.mode === 'strict' && destination === 'cloud') {
      return {
        allowed: false,
        blockedReason: 'strict mode blocking cloud-bound handoffs',
      };
    }

    return {
      allowed: true,
    };
  }

  // ============================================================
  // CONCURRENCY POLICY
  // ============================================================

  /**
   * Get concurrency policy.
   *
   * @returns Concurrency policy
   */
  getConcurrencyPolicy(): ConcurrencyPolicy {
    return {
      default: this.policy.concurrency?.default ?? 'concurrent',
      conflictAction: this.policy.concurrency?.conflictAction ?? 'warn',
      supportsWorktrees: this.policy.concurrency?.supportsWorktrees ?? true,
      checkpointBeforeMutation: this.policy.concurrency?.checkpointBeforeMutation ?? false,
    };
  }

  // ============================================================
  // POLICY CHANGE REQUIREMENTS
  // ============================================================

  /**
   * Check requirements for a policy change.
   *
   * @param change - Policy change request
   * @returns Policy change requirements
   */
  checkPolicyChangeRequirements(_change: PolicyChangeRequest): PolicyChangeRequirements {
    const policyChanges = this.policy.privacy.policyChanges ?? {};

    return {
      requiresConfirmation: policyChanges.requireConfirmation ?? false,
      requiresReason: policyChanges.requireReason ?? false,
      revertAfterMinutes: policyChanges.revertAfterMinutes ?? null,
      requiresSecondApprover: policyChanges.requireSecondApprover ?? false,
    };
  }

  // ============================================================
  // PROFILE GOVERNANCE
  // ============================================================

  /**
   * Check if a profile template is allowed.
   *
   * @param templateId - Template ID to check
   * @returns True if template is allowed
   */
  isTemplateAllowed(templateId: string): boolean {
    const allowedIds = this.policy.profiles?.allowedTemplateIds;

    // No restrictions - all templates allowed
    if (!allowedIds || allowedIds.length === 0) {
      return true;
    }

    return allowedIds.includes(templateId);
  }

  /**
   * Update the workspace policy.
   *
   * @param newPolicy - New workspace policy
   */
  updatePolicy(newPolicy: WorkspacePolicy): void {
    this.validatePrivacyMode(newPolicy.privacy.mode);
    this.policy = this.normalizePolicy(newPolicy);
  }

  /**
   * Get current workspace policy.
   *
   * @returns Current workspace policy
   */
  getPolicy(): WorkspacePolicy {
    return { ...this.policy };
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Validate privacy mode.
   *
   * @param mode - Privacy mode to validate
   * @throws Error if mode is invalid
   */
  private validatePrivacyMode(mode: PrivacyMode): void {
    const validModes: PrivacyMode[] = ['unrestricted', 'guarded', 'strict'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid privacy mode: ${mode}`);
    }
  }

  /**
   * Normalize policy by setting defaults.
   *
   * @param policy - Policy to normalize
   * @returns Normalized policy
   */
  private normalizePolicy(policy: WorkspacePolicy): WorkspacePolicy {
    return {
      ...policy,
      privacy: {
        ...policy.privacy,
        handoff: policy.privacy.handoff ?? {
          allowedModes: ['full', 'summary', 'none'],
          defaultMode: 'none',
        },
        policyChanges: policy.privacy.policyChanges ?? {
          requireConfirmation: false,
          requireReason: false,
          revertAfterMinutes: null,
          requireSecondApprover: false,
        },
      },
      concurrency: policy.concurrency ?? {
        default: 'concurrent',
        conflictAction: 'warn',
        supportsWorktrees: true,
        checkpointBeforeMutation: false,
      },
      profiles: policy.profiles ?? {
        allowedTemplateIds: [],
      },
    };
  }
}
