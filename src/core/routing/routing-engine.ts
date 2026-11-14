/**
 * src/core/routing/routing-engine.ts
 *
 * Routing Engine
 *
 * Active endpoint selection and management (no VS Code API imports).
 */

<<<<<<< HEAD
import {
  Endpoint,
  EndpointType,
  Model,
  CreateEndpointInput as EndpointRegistryCreateInput,
  EndpointRegistry,
} from '../endpoints/endpoint-registry.js';
=======
import type { RoutingConfiguration } from './routing-config';
import type { QuotaCache } from '../quota/quota-cache';
import { OllamaAdapter } from './ollama-adapter';
import type { HarveyRecommendation } from './ollama-adapter';
import type { RoutingHistoryManager } from './routing-history';
>>>>>>> origin/main

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

<<<<<<< HEAD
export class RoutingEngineError extends Error {
  constructor(message: string) {
=======
/**
 * Quota snapshot for display/status bar
 */
export interface QuotaSnapshot {
  subscription: {
    plan: 'pro' | 'max';
    dailyLimit: number;
    rollingWindowDays: number;
    currentUsage: number;
    remainingQuota: number;
    percentUsed: number;
    rollingWindowStart: string;
    rollingWindowEnd: string;
  };

  apiCredits: {
    balance: number;
    authenticated: boolean;
    stale: boolean;
    lastFetchTime: number;
  };

  ollama: {
    available: boolean;
    harveyReachable: boolean;
    circuitBreakerState: 'closed' | 'open' | 'half-open';
    autoFallbackTriggered: boolean;
  };
}

/**
 * Routing error
 */
export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_AVAILABLE_SOURCES' | 'HARVEY_UNREACHABLE' | 'INVALID_CONFIGURATION'
  ) {
>>>>>>> origin/main
    super(message);
    this.name = 'RoutingEngineError';
  }
}

export interface ReloadFlowOptions {
  newSession?: boolean;
  keepUnchanged?: boolean;
}

<<<<<<< HEAD
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
=======
/**
 * Routing Engine Implementation
 *
 * Pure logic module for routing decisions based on quota state and configuration.
 */
export class RoutingEngine implements IRoutingEngine {
  private config: RoutingConfiguration;
  private quotaCache: QuotaCache;
  private ollamaAdapter: OllamaAdapter | null = null;
  private routingHistory: RoutingHistoryManager | null = null;

  constructor(
    config: RoutingConfiguration,
    quotaCache: QuotaCache,
    routingHistory?: RoutingHistoryManager
  ) {
    this.config = config;
    this.quotaCache = quotaCache;

    // Initialize Ollama adapter if Harvey is in priority or auto-fallback is enabled
    if (config.priority.includes('ollama') || config.autoFallback) {
      this.ollamaAdapter = new OllamaAdapter(config.harvey.baseUrl);
    }

    // Store routing history manager if provided
    this.routingHistory = routingHistory ?? null;
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = performance.now();
    let harveyRecommendation: HarveyRecommendation | null = null;
>>>>>>> origin/main

export class RoutingEngine {
  private registry: EndpointRegistry = new EndpointRegistry();
  private activeEndpointId: string | undefined;
  private sessionState: SessionState = SessionState.IDLE;
  private isReloadingFlag: boolean = false;
  private reloadProgress: number = 0;
  private reloadError: Error | undefined;

<<<<<<< HEAD
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
=======
      if (isAvailable) {
        const decision = {
          source: explicitRoute,
          reason: `Explicit mapping for task type '${request.taskType}' to ${explicitRoute}`,
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          }
        };

        // T035: Write routing decision to history
        await this.writeDecisionToHistory(decision, request.taskType, request.requestId);

        return decision;
      }

      // Continue to fallback logic if explicit route not available
    }

    // Step 2: Harvey recommendation (T047)
    // Call Harvey for recommendation only when task mapping is 'auto' OR when no mapping exists and ollama is in priority
    const shouldCallHarvey: boolean =
      !!this.ollamaAdapter &&
      (this.config.taskMappings[request.taskType] === 'auto' ||
        (this.config.taskMappings[request.taskType] === undefined &&
         this.config.priority.includes('ollama')));

    if (shouldCallHarvey) {
      try {
        harveyRecommendation = await this.ollamaAdapter!.getRecommendation(request.taskType, 200);

        // Update Ollama state based on Harvey availability
        this.quotaCache.ollama.harveyReachable = true;
        this.quotaCache.ollama.circuitBreakerState = this.ollamaAdapter!.getCircuitBreakerState();
      } catch (error) {
        // Harvey unreachable, update circuit breaker state
        if (error instanceof RoutingError && error.code === 'HARVEY_UNREACHABLE') {
          this.quotaCache.ollama.harveyReachable = false;
          this.quotaCache.ollama.circuitBreakerState = this.ollamaAdapter?.getCircuitBreakerState() ?? 'open';
        }
        // Continue to fallback logic
      }
    }

    // Step 3: Build priority array, influenced by Harvey recommendation if available
    let priority = this.config.priority || ['subscription', 'api-credits', 'ollama'];

    // If Harvey recommends a source and has high confidence, prioritize it first
    if (harveyRecommendation?.routedTo && harveyRecommendation.confidence && harveyRecommendation.confidence >= 0.7) {
      const recommendedSource: ModelSource = harveyRecommendation.routedTo;
      // Remove recommended source from its original position and add to front
      priority = [recommendedSource, ...priority.filter(s => s !== recommendedSource)];
    }

    // Step 4: Check each source in priority order, return first available
    for (const source of priority) {
      // Measure quota check latency specifically
      const quotaCheckStart = performance.now();
      const isAvailable = await this.isAvailable(source);
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (isAvailable) {
        const decision = {
          source,
          reason: `Priority fallback: ${source}`,
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          },
          harveyRecommendation: undefined as { model: string; confidence: number } | undefined
        };

        // Attach Harvey recommendation if available
        if (harveyRecommendation?.model && harveyRecommendation.confidence !== undefined) {
          decision.harveyRecommendation = {
            model: harveyRecommendation.model,
            confidence: harveyRecommendation.confidence
          };
        }

        // T035: Write routing decision to history
        await this.writeDecisionToHistory(decision, request.taskType, request.requestId);

        return decision;
      }
    }

    // Step 5: Auto-fallback to Ollama (T048)
    // If all sources exhausted and auto-fallback enabled, try Ollama
    if (
      this.config.autoFallback &&
      this.quotaCache.subscription.remainingQuota <= 0 &&
      this.quotaCache.apiCredits.balance <= 0
    ) {
      const quotaCheckStart = performance.now();
      const ollamaAvailable = await this.isAvailable('ollama');
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (ollamaAvailable) {
        const decision: RoutingDecision = {
          source: 'ollama',
          reason: 'Auto-fallback to local Ollama (Claude budgets exhausted)',
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          }
        };

        // T048: Set auto-fallback triggered flag
        this.quotaCache.ollama.autoFallbackTriggered = true;

        // T035: Write routing decision to history
        await this.writeDecisionToHistory(decision, request.taskType, request.requestId);

        return decision;
      }
    }

    // Step 6: No sources available - throw error
    throw new RoutingError(
      'No available model sources: subscription exhausted, API credits exhausted, Ollama unavailable',
      'NO_AVAILABLE_SOURCES'
    );
  }

  /**
   * Write routing decision to history (T035)
   *
   * Converts routing-engine RoutingDecision to routing-history RoutingDecision
   * and persists to global storage.
   */
  private async writeDecisionToHistory(
    decision: RoutingDecision,
    taskType: string,
    requestId?: string
  ): Promise<void> {
    if (!this.routingHistory) {
      return;
    }

    // Get before/after quota values
    const quotaBefore = this.quotaCache.subscription.currentUsage;
    const quotaAfter = quotaBefore + 1; // Assuming increment by 1 per request

    try {
      // Convert routing-engine decision to routing-history format
      await this.routingHistory.writeDecision({
        routedTo: decision.source,
        taskType,
        requestId,
        quotaBefore,
        quotaAfter,
        reason: decision.reason,
        performance: decision.performance
      });
    } catch (error) {
      // Log error but don't fail the routing decision
      console.error('Failed to write routing decision to history:', error);
    }
  }

  async isAvailable(source: ModelSource): Promise<boolean> {
    switch (source) {
      case 'subscription':
        return this.quotaCache.subscription.remainingQuota > 0;

      case 'api-credits':
        return (
          this.quotaCache.apiCredits.balance > 0 &&
          this.quotaCache.apiCredits.authenticated
        );

      case 'ollama':
        return (
          this.quotaCache.ollama.available &&
          this.quotaCache.ollama.harveyReachable &&
          this.quotaCache.ollama.circuitBreakerState !== 'open'
        );

      default:
        return false;
>>>>>>> origin/main
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
   * Constants for progress range (T061 code cleanup).
   */
  private static readonly PROGRESS_MIN = 0;
  private static readonly PROGRESS_MAX = 1;

  /**
   * Updates reload progress (PROGRESS_MIN-PROGRESS_MAX).
   */
  public updateReloadProgress(progress: number): void {
    this.reloadProgress = Math.max(RoutingEngine.PROGRESS_MIN, Math.min(RoutingEngine.PROGRESS_MAX, progress));
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
<<<<<<< HEAD
      endpointUrl: endpoint.url,
      requiresAuth: endpoint.hasAuth,
      models: endpoint.models.map((m) => ({
        name: m.name,
        alias: options.includeAliases ? m.alias : undefined,
      })),
=======
      subscription: {
        plan: this.quotaCache.subscription.plan,
        dailyLimit: this.quotaCache.subscription.dailyLimit,
        rollingWindowDays: this.quotaCache.subscription.rollingWindowDays,
        currentUsage: this.quotaCache.subscription.currentUsage,
        remainingQuota: this.quotaCache.subscription.remainingQuota,
        percentUsed: this.quotaCache.subscription.percentUsed,
        rollingWindowStart: this.quotaCache.subscription.rollingWindowStart,
        rollingWindowEnd: this.quotaCache.subscription.rollingWindowEnd
      },
      apiCredits: {
        balance: this.quotaCache.apiCredits.balance,
        authenticated: this.quotaCache.apiCredits.authenticated,
        stale: this.quotaCache.apiCredits.stale,
        lastFetchTime: this.quotaCache.apiCredits.lastFetchTime
      },
      ollama: {
        available: this.quotaCache.ollama.available,
        harveyReachable: this.quotaCache.ollama.harveyReachable,
        circuitBreakerState: this.quotaCache.ollama.circuitBreakerState,
        autoFallbackTriggered: this.quotaCache.ollama.autoFallbackTriggered
      }
>>>>>>> origin/main
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
