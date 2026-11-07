/**
 * src/core/routing/routing-engine.ts
 *
 * Routing Engine
 *
 * Active endpoint selection and management (no VS Code API imports).
 */

import {
  Endpoint,
  EndpointType,
  Model,
  CreateEndpointInput as EndpointRegistryCreateInput,
  EndpointRegistry,
} from '../endpoints/endpoint-registry.js';

export { EndpointType } from '../endpoints/endpoint-registry.js';

export enum SessionState {
  IDLE = 'idle',
  ACTIVE = 'active',
  LOADING = 'loading',
}

export enum ReloadAction {
  NO_RELOAD = 'no-reload',
  CONTINUE_RELOAD = 'continue-reload',
  NEW_SESSION = 'new-session',
  KEEP_UNCHANGED = 'keep-unchanged',
}

export class RoutingEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingEngineError';
  }
}

export interface ReloadFlowOptions {
  newSession?: boolean;
  keepUnchanged?: boolean;
}

export interface RegistryEndpoint {
  url: string;
  label?: string;
  hasAuth: boolean;
  type: EndpointType;
  models: Model[];
}

export interface GeneratedConfig {
  endpointUrl: string;
  requiresAuth: boolean;
  models: Array<{ name: string; alias?: string }>;
}

export interface SwitchValidation {
  canSwitch: boolean;
  reason?: string;
}

export class RoutingEngine {
  private registry: EndpointRegistry = new EndpointRegistry();
  private activeEndpointId: string | undefined;
  private sessionState: SessionState = SessionState.IDLE;
  private isReloadingFlag: boolean = false;
  private reloadProgress: number = 0;
  private reloadError: Error | undefined;

  /**
   * Registers endpoints.
   */
  public registerEndpoints(endpoints: Omit<Endpoint, 'id' | 'createdAt' | 'status'>[]): void {
    for (const ep of endpoints) {
      const input: EndpointRegistryCreateInput = {
        url: ep.url,
        label: ep.label,
        hasAuth: ep.hasAuth,
        type: ep.type,
        models: ep.models,
      };
      this.registry.create(input);
    }
  }

  /**
   * Gets an endpoint by ID.
   */
  public getEndpoint(id: string): Endpoint | undefined {
    return this.registry.getById(id);
  }

  /**
   * Gets endpoint by URL.
   */
  public getEndpointByUrl(url: string): Endpoint | undefined {
    return this.registry.getByUrl(url);
  }

  /**
   * Lists all endpoints.
   */
  public listEndpoints(): Endpoint[] {
    return this.registry.list();
  }

  /**
   *Gets endpoint count.
   */
  public getEndpointCount(): number {
    return this.registry.getCount();
  }

  /**
   * Sets active endpoint.
   */
  public setActiveEndpoint(id: string): { success: boolean } {
    if (!this.registry.exists(id)) {
      throw new RoutingEngineError(`Endpoint not found: ${id}`);
    }

    this.activeEndpointId = id;
    return { success: true };
  }

  /**
   * Gets active endpoint.
   */
  public getActiveEndpoint(): Endpoint | undefined {
    if (!this.activeEndpointId) {
      return undefined;
    }
    return this.registry.getById(this.activeEndpointId);
  }

  /**
   * Gets active endpoint ID.
   */
  public getActiveEndpointId(): string | undefined {
    return this.activeEndpointId;
  }

  /**
   * Checks if has active endpoint.
   */
  public hasActiveEndpoint(): boolean {
    return this.activeEndpointId !== undefined;
  }

  /**
   * Session State
   */

  /**
   * Gets current session state.
   */
  public getSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Sets session state.
   */
  public setSessionState(state: SessionState): void {
    this.sessionState = state;
  }

  /**
   * Detects session state.
   * Note: Real implementation would check Claude Code panel state.
   */
  public detectSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Clears session state.
   */
  public clearSessionState(): void {
    this.sessionState = SessionState.IDLE;
  }

  /**
   * Reload Action Determination
   */

  /**
   * Determines reload action based on session state and options.
   */
  public determineReloadAction(options: ReloadFlowOptions = {}): ReloadAction {
    // Explicitly requested new session
    if (options.newSession) {
      return ReloadAction.NEW_SESSION;
    }

    // Explicitly requested to keep unchanged
    if (options.keepUnchanged) {
      return ReloadAction.KEEP_UNCHANGED;
    }

    // Active session requires user action
    if (this.sessionState === SessionState.ACTIVE) {
      return ReloadAction.CONTINUE_RELOAD;
    }

    // Idle or loading states don't need reload
    return ReloadAction.NO_RELOAD;
  }

  /**
   * Reload Flow State Machine
   */

  /**
   * Starts reload flow.
   */
  public startReloadFlow(): void {
    this.isReloadingFlag = true;
    this.reloadProgress = 0;
    this.reloadError = undefined;
  }

  /**
   * Completes reload flow.
   */
  public completeReloadFlow(): void {
    this.isReloadingFlag = false;
    this.reloadError = undefined;
  }

  /**
   * Fails reload flow with error.
   */
  public failReloadFlow(error: Error): void {
    this.isReloadingFlag = false;
    this.reloadError = error;
  }

  /**
   * Checks if currently reloading.
   */
  public isReloading(): boolean {
    return this.isReloadingFlag;
  }

  /**
   * Updates reload progress (0-1).
   */
  public updateReloadProgress(progress: number): void {
    this.reloadProgress = Math.max(0, Math.min(1, progress));
  }

  /**
   * Gets reload progress.
   */
  public getReloadProgress(): number {
    return this.reloadProgress;
  }

  /**
   * Gets reload error.
   */
  public getReloadError(): Error | undefined {
    return this.reloadError;
  }

  /**
   * Configuration Template Generation
   */

  /**
   * Generates configuration for active endpoint.
   */
  public generateConfig(options: { includeAliases?: boolean; normalizeUrls?: boolean }={}): GeneratedConfig | undefined {
    const endpoint = this.getActiveEndpoint();
    if (!endpoint) {
      return undefined;
    }

    return {
      endpointUrl: endpoint.url,
      requiresAuth: endpoint.hasAuth,
      models: endpoint.models.map((m) => ({
        name: m.name,
        alias: options.includeAliases ? m.alias : undefined,
      })),
    };
  }

  /**
   * Endpoint Switching Validation
   */

  /**
   * Validates if endpoint can be switched to.
   */
  public canSwitchTo(endpointId: string): SwitchValidation {
    if (!this.registry.exists(endpointId)) {
      return {
        canSwitch: false,
        reason: 'Endpoint not found',
      };
    }

    if (this.activeEndpointId === endpointId) {
      return {
        canSwitch: false,
        reason: 'Endpoint is already active',
      };
    }

    return {
      canSwitch: true,
    };
  }

  /**
   * Utility Methods
   */

  /**
   * Checks if has any endpoints.
   */
  public hasEndpoints(): boolean {
    return this.registry.getCount() > 0;
  }

  /**
   * Clears all data.
   */
  public clear(): void {
    this.registry.clear();
    this.activeEndpointId = undefined;
    this.sessionState = SessionState.IDLE;
    this.isReloadingFlag = false;
    this.reloadProgress = 0;
    this.reloadError = undefined;
  }
}
