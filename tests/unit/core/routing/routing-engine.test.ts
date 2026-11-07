/**
 * tests/unit/core/routing/routing-engine.test.ts
 *
 * Routing Engine Unit Tests
 *
 * Tests active endpoint selection and management (no VS Code API imports).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RoutingEngine,
  RoutingEngineError,
  SessionState,
  Endpoint,
  ReloadAction,
} from '../../../../src/core/routing/routing-engine.js';

describe('RoutingEngine', () => {
  let engine: RoutingEngine;

  const sampleEndpoints: Omit<Endpoint, 'id' | 'createdAt' | 'status'>[] = [
    {
      url: 'https://api.anthropic.com',
      label: 'Claude Official',
      hasAuth: true,
      models: [
        { name: 'claude-sonnet-5-5', alias: 'Sonnet 5.5' },
        { name: 'claude-haiku-5-5', alias: 'Haiku 5.5' },
      ],
    },
    {
      url: 'http://localhost:11434',
      label: 'Ollama Local',
      hasAuth: false,
      models: [
        { name: 'llama3.2', alias: 'Llama 3.2' },
      ],
    },
    {
      url: 'https://custom.endpoint.com',
      label: 'Custom Endpoint',
      hasAuth: true,
      models: [
        { name: 'custom-model' },
      ],
    },
  ];

  beforeEach(() => {
    engine = new RoutingEngine();
  });

  afterEach(() => {
    engine.clear();
  });

  describe('Endpoint Registration', () => {
    it('should register endpoints', () => {
      engine.registerEndpoints(sampleEndpoints);

      const count = engine.getEndpointCount();
      expect(count).toBe(3);
    });

    it('should retrieve endpoint by ID', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      const endpoint = engine.getEndpoint(endpoints[0].id);
      expect(endpoint).toBeDefined();
      expect(endpoint?.url).toBe(sampleEndpoints[0].url);
    });

    it('should return undefined for non-existent endpoint', () => {
      const endpoint = engine.getEndpoint('non-existent');
      expect(endpoint).toBeUndefined();
    });

    it('should list all registered endpoints', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0].url).toBe(sampleEndpoints[0].url);
      expect(endpoints[1].url).toBe(sampleEndpoints[1].url);
      expect(endpoints[2].url).toBe(sampleEndpoints[2].url);
    });
  });

  describe('Active Endpoint Selection', () => {
    it('should set active endpoint by ID', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      const result = engine.setActiveEndpoint(endpoints[0].id);

      expect(result.success).toBe(true);
      expect(engine.getActiveEndpoint()?.id).toBe(endpoints[0].id);
    });

    it('should throw when setting non-existent endpoint as active', () => {
      expect(() => {
        engine.setActiveEndpoint('non-existent');
      }).toThrow(RoutingEngineError);
    });

    it('should get active endpoint', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[1].id);
      const active = engine.getActiveEndpoint();

      expect(active).toBeDefined();
      expect(active?.id).toBe(endpoints[1].id);
      expect(active?.url).toBe(sampleEndpoints[1].url);
    });

    it('should return undefined when no active endpoint set', () => {
      const active = engine.getActiveEndpoint();
      expect(active).toBeUndefined();
    });

    it('should get active endpoint ID', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);
      const activeId = engine.getActiveEndpointId();

      expect(activeId).toBe(endpoints[0].id);
    });

    it('should return undefined for active ID when none set', () => {
      const activeId = engine.getActiveEndpointId();
      expect(activeId).toBeUndefined();
    });
  });

  describe('Session State Management', () => {
    it('should detect no session as idle', () => {
      const sessionState = engine.detectSessionState();
      expect(sessionState).toBe(SessionState.IDLE);
    });

    it('should set active session state', () => {
      engine.setSessionState(SessionState.ACTIVE);
      expect(engine.getSessionState()).toBe(SessionState.ACTIVE);
    });

    it('should set loading session state', () => {
      engine.setSessionState(SessionState.LOADING);
      expect(engine.getSessionState()).toBe(SessionState.LOADING);
    });

    it('should transition between session states', () => {
      engine.setSessionState(SessionState.ACTIVE);
      expect(engine.getSessionState()).toBe(SessionState.ACTIVE);

      engine.setSessionState(SessionState.LOADING);
      expect(engine.getSessionState()).toBe(SessionState.LOADING);

      engine.setSessionState(SessionState.IDLE);
      expect(engine.getSessionState()).toBe(SessionState.IDLE);
    });

    it('should clear session state', () => {
      engine.setSessionState(SessionState.ACTIVE);
      engine.clearSessionState();

      expect(engine.getSessionState()).toBe(SessionState.IDLE);
    });
  });

  describe('Reload Action Determination', () => {
    it('should recommend continue-reload when active session exists', () => {
      engine.setSessionState(SessionState.ACTIVE);
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const action = engine.determineReloadAction();

      expect(action).toBe(ReloadAction.CONTINUE_RELOAD);
    });

    it('should recommend no-reload when idle', () => {
      engine.setSessionState(SessionState.IDLE);
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const action = engine.determineReloadAction();

      expect(action).toBe(ReloadAction.NO_RELOAD);
    });

    it('should recommend new-session when explicitly requested', () => {
      engine.setSessionState(SessionState.ACTIVE);
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const action = engine.determineReloadAction({ newSession: true });

      expect(action).toBe(ReloadAction.NEW_SESSION);
    });

    it('should recommend keep-unchanged when session and user chooses keep', () => {
      engine.setSessionState(SessionState.ACTIVE);
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const action = engine.determineReloadAction({ keepUnchanged: true });

      expect(action).toBe(ReloadAction.KEEP_UNCHANGED);
    });
  });

  describe('Reload Flow State Machine', () => {
    it('should start reload flow', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);
      engine.startReloadFlow();

      expect(engine.isReloading()).toBe(true);
    });

    it('should complete reload flow', () => {
      engine.startReloadFlow();
      engine.completeReloadFlow();

      expect(engine.isReloading()).toBe(false);
    });

    it('should fail reload flow with error', () => {
      engine.startReloadFlow();
      engine.failReloadFlow(new Error('Reload failed'));

      expect(engine.isReloading()).toBe(false);

      const error = engine.getReloadError();
      expect(error).toBeDefined();
      expect(error?.message).toBe('Reload failed');
    });

    it('should track reload progress', () => {
      engine.startReloadFlow();
      engine.updateReloadProgress(0.5); // 50%

      const progress = engine.getReloadProgress();
      expect(progress).toBe(0.5);
    });

    it('should reset progress on new reload flow', () => {
      engine.startReloadFlow();
      engine.updateReloadProgress(0.8);
      engine.startReloadFlow();

      const progress = engine.getReloadProgress();
      expect(progress).toBe(0);
    });
  });

  describe('Configuration Template Generation', () => {
    it('should generate configuration for active endpoint', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const config = engine.generateConfig();

      expect(config).toBeDefined();
      expect(config?.endpointUrl).toBe(sampleEndpoints[0].url);
      expect(config?.requiresAuth).toBe(true);
    });

    it('should include models in configuration', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const config = engine.generateConfig();

      expect(config?.models).toBeDefined();
      expect(config?.models.length).toBe(2);
      expect(config?.models[0].name).toBe('claude-sonnet-5-5');
    });

    it('should return undefined when no active endpoint', () => {
      const config = engine.generateConfig();
      expect(config).toBeUndefined();
    });

    it('should generate configuration with custom options', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      const targetEp = endpoints.find((e) => e.label === 'Ollama Local')!;
      engine.setActiveEndpoint(targetEp.id);

      const config = engine.generateConfig({ includeAliases: true, normalizeUrls: true });

      expect(config?.endpointUrl).toBeDefined();
      expect(config?.requiresAuth).toBe(false);
      expect(config?.models[0]?.alias).toBe('Llama 3.2');
    });
  });

  describe('Endpoint Switching Validation', () => {
    it('should validate endpoint switch to same endpoint (no-op)', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const validation = engine.canSwitchTo(endpoints[0].id);

      expect(validation.canSwitch).toBe(false);
      expect(validation.reason).toContain('already active');
    });

    it('should validate endpoint switch to different endpoint', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const validation = engine.canSwitchTo(endpoints[1].id);

      expect(validation.canSwitch).toBe(true);
    });

    it('should reject switch to non-existent endpoint', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id);

      const validation = engine.canSwitchTo('non-existent');

      expect(validation.canSwitch).toBe(false);
      expect(validation.reason).toContain('not found');
    });

    it('should validate switch when no active endpoint set', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      const validation = engine.canSwitchTo(endpoints[0].id);

      expect(validation.canSwitch).toBe(true); // First endpoint can always be set
    });
  });

  describe('Utility Methods', () => {
    it('should check if has any endpoints', () => {
      expect(engine.hasEndpoints()).toBe(false);

      engine.registerEndpoints(sampleEndpoints);
      expect(engine.hasEndpoints()).toBe(true);
    });

    it('should check if has active endpoint', () => {
      expect(engine.hasActiveEndpoint()).toBe(false);

      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();
      engine.setActiveEndpoint(endpoints[0].id);

      expect(engine.hasActiveEndpoint()).toBe(true);
    });

    it('should get endpoint by URL', () => {
      engine.registerEndpoints(sampleEndpoints);

      const endpoint = engine.getEndpointByUrl('https://api.anthropic.com');
      expect(endpoint).toBeDefined();
      expect(endpoint?.url).toBe('https://api.anthropic.com');
    });

    it('should return undefined for URL not found', () => {
      engine.registerEndpoints(sampleEndpoints);

      const endpoint = engine.getEndpointByUrl('https://unknown.com');
      expect(endpoint).toBeUndefined();
    });

    it('should clear all data', () => {
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();
      engine.setActiveEndpoint(endpoints[0].id);
      engine.setSessionState(SessionState.ACTIVE);

      engine.clear();

      expect(engine.getEndpointCount()).toBe(0);
      expect(engine.hasActiveEndpoint()).toBe(false);
      expect(engine.getSessionState()).toBe(SessionState.IDLE);
    });
  });

  describe('Error Handling', () => {
    it('should handle setting active endpoint during reload', () => {
      engine.startReloadFlow();
      engine.registerEndpoints(sampleEndpoints);
      const endpoints = engine.listEndpoints();

      engine.setActiveEndpoint(endpoints[0].id); // Should work

      expect(engine.isReloading()).toBe(true);
    });

    it('should handle invalid session state', () => {
      expect(() => {
        engine.setSessionState('invalid-state' as SessionState);
      }).not.toThrow(); // Implementation should handle gracefully
    });

    it('should handle invalid reload action request', () => {
      engine.setSessionState(SessionState.ACTIVE);
      engine.registerEndpoints(sampleEndpoints);

      // Should not throw with invalid options
      expect(() => {
        engine.determineReloadAction({} as any);
      }).not.toThrow();
    });
  });
});
