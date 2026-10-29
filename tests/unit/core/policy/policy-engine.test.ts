/**
 * tests/unit/core/policy/policy-engine.test.ts
 *
 * Policy Engine Unit Tests
 *
 * Tests privacy mode enforcement, request classification, and routing decisions.
 */

import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../../../src/core/policy/policy-engine.js';

describe('PolicyEngine', () => {
  describe('Privacy Mode Classification', () => {
    it('should classify cloud model requests correctly', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'model-request',
        providerClass: 'cloud',
        endpoint: 'https://api.anthropic.com/v1/messages',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('model-provider');
    });

    it('should classify local model requests correctly', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'model-request',
        providerClass: 'local',
        endpoint: 'http://localhost:11434/api/generate',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('model-provider');
    });

    it('should classify private network model requests correctly', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'model-request',
        providerClass: 'private-network',
        endpoint: 'https://internal-ai.company.com/v1/generate',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('model-provider');
    });

    it('should classify web search requests as supporting traffic', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'web-search',
        url: 'https://google.com/search?q=typescript',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('supporting');
    });

    it('should classify git operations as supporting traffic', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'git-operation',
        operation: 'fetch',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('supporting');
    });

    it('should classify package manager requests as supporting traffic', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'package-request',
        manager: 'npm',
        operation: 'install',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('supporting');
    });

    it('should classify documentation requests as supporting traffic', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const request = {
        type: 'docs-request',
        url: 'https://docs.python.org/3/library/stdtypes.html',
      };

      const classification = engine.classifyRequest(request);
      expect(classification).toBe('supporting');
    });
  });

  describe('Unrestricted Mode', () => {
    it('should allow all requests in unrestricted mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'unrestricted',
          cloudModelRequests: {
            default: 'allow',
          },
        },
      });

      const cloudRequest = {
        type: 'model-request',
        providerClass: 'cloud',
        endpoint: 'https://api.anthropic.com/v1/messages',
      };

      const decision = engine.routeRequest(cloudRequest);
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('should route cloud model requests directly in unrestricted mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'unrestricted',
          cloudModelRequests: {
            default: 'allow',
          },
        },
      });

      const cloudRequest = {
        type: 'model-request',
        providerClass: 'cloud',
        endpoint: 'https://api.anthropic.com/v1/messages',
      };

      const decision = engine.routeRequest(cloudRequest);
      expect(decision.action).toBe('proceed');
    });
  });

  describe('Guarded Mode', () => {
    it('should require approval for cloud model requests in guarded mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          cloudModelRequests: {
            default: 'require-confirmation',
          },
        },
      });

      const cloudRequest = {
        type: 'model-request',
        providerClass: 'cloud',
        endpoint: 'https://api.anthropic.com/v1/messages',
      };

      const decision = engine.routeRequest(cloudRequest);
      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(true);
    });

    it('should allow local model requests without approval in guarded mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          cloudModelRequests: {
            default: 'require-confirmation',
          },
        },
      });

      const localRequest = {
        type: 'model-request',
        providerClass: 'local',
        endpoint: 'http://localhost:11434/api/generate',
      };

      const decision = engine.routeRequest(localRequest);
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('should allow supporting traffic without approval in guarded mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          cloudModelRequests: {
            default: 'require-confirmation',
          },
        },
      });

      const docsRequest = {
        type: 'docs-request',
        url: 'https://docs.python.org/3/library/stdtypes.html',
      };

      const decision = engine.routeRequest(docsRequest);
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('should block cloud model requests when default is block', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          cloudModelRequests: {
            default: 'block',
          },
        },
      });

      const cloudRequest = {
        type: 'model-request',
        providerClass: 'cloud',
        endpoint: 'https://api.anthropic.com/v1/messages',
      };

      const decision = engine.routeRequest(cloudRequest);
      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(false);
    });
  });

  describe('Strict Mode', () => {
    it('should block all cloud model requests in strict mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'strict',
          cloudModelRequests: {
            default: 'block',
          },
        },
      });

      const cloudRequest = {
        type: 'model-request',
        providerClass: 'cloud',
        endpoint: 'https://api.anthropic.com/v1/messages',
      };

      const decision = engine.routeRequest(cloudRequest);
      expect(decision.allowed).toBe(false);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.blockedReason).toBeDefined();
    });

    it('should allow local model requests in strict mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'strict',
          cloudModelRequests: {
            default: 'block',
          },
        },
      });

      const localRequest = {
        type: 'model-request',
        providerClass: 'local',
        endpoint: 'http://localhost:11434/api/generate',
      };

      const decision = engine.routeRequest(localRequest);
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('should allow supporting traffic in strict mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'strict',
          cloudModelRequests: {
            default: 'block',
          },
        },
      });

      const gitRequest = {
        type: 'git-operation',
        operation: 'fetch',
      };

      const decision = engine.routeRequest(gitRequest);
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });
  });

  describe('Handoff Policy', () => {
    it('should enforce allowed handoff modes', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          handoff: {
            allowedModes: ['summary', 'none'],
            defaultMode: 'summary',
          },
        },
      });

      const fullHandoff = engine.canHandoff('full');
      expect(fullHandoff.allowed).toBe(false);

      const summaryHandoff = engine.canHandoff('summary');
      expect(summaryHandoff.allowed).toBe(true);

      const noneHandoff = engine.canHandoff('none');
      expect(noneHandoff.allowed).toBe(true);
    });

    it('should get default handoff mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          handoff: {
            allowedModes: ['full', 'summary', 'none'],
            defaultMode: 'summary',
          },
        },
      });

      const defaultMode = engine.getDefaultHandoffMode();
      expect(defaultMode).toBe('summary');
    });

    it('should block cloud-bound handoffs in strict mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'strict',
          handoff: {
            allowedModes: ['summary', 'none'],
            defaultMode: 'none',
          },
        },
      });

      const decision = engine.routeHandoff('summary', 'cloud');
      expect(decision.allowed).toBe(false);
      expect(decision.blockedReason).toContain('strict mode');
    });

    it('should allow local handoffs in strict mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'strict',
          handoff: {
            allowedModes: ['summary', 'none'],
            defaultMode: 'none',
          },
        },
      });

      const decision = engine.routeHandoff('summary', 'local');
      expect(decision.allowed).toBe(true);
    });
  });

  describe('Concurrency Policy', () => {
    it('should enforce concurrent mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'unrestricted',
          cloudModelRequests: {
            default: 'allow',
          },
        },
        concurrency: {
          default: 'concurrent',
          conflictAction: 'warn',
          supportsWorktrees: true,
          checkpointBeforeMutation: false,
        },
      });

      const policy = engine.getConcurrencyPolicy();
      expect(policy.default).toBe('concurrent');
      expect(policy.conflictAction).toBe('warn');
    });

    it('should enforce exclusive-writer mode', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'unrestricted',
          cloudModelRequests: {
            default: 'allow',
          },
        },
        concurrency: {
          default: 'exclusive-writer',
          conflictAction: 'block',
          supportsWorktrees: false,
          checkpointBeforeMutation: true,
        },
      });

      const policy = engine.getConcurrencyPolicy();
      expect(policy.default).toBe('exclusive-writer');
      expect(policy.conflictAction).toBe('block');
      expect(policy.checkpointBeforeMutation).toBe(true);
    });
  });

  describe('Policy Change Requirements', () => {
    it('should check confirmation requirement', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          policyChanges: {
            requireConfirmation: true,
            requireReason: false,
            revertAfterMinutes: null,
            requireSecondApprover: false,
          },
        },
      });

      const change = { mode: 'strict' };
      const requirements = engine.checkPolicyChangeRequirements(change);
      expect(requirements.requiresConfirmation).toBe(true);
      expect(requirements.requiresReason).toBe(false);
    });

    it('should check reason requirement', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          policyChanges: {
            requireConfirmation: true,
            requireReason: true,
            revertAfterMinutes: null,
            requireSecondApprover: false,
          },
        },
      });

      const change = { mode: 'strict' };
      const requirements = engine.checkPolicyChangeRequirements(change);
      expect(requirements.requiresConfirmation).toBe(true);
      expect(requirements.requiresReason).toBe(true);
    });

    it('should check second approval requirement', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'guarded',
          policyChanges: {
            requireConfirmation: true,
            requireReason: true,
            revertAfterMinutes: 60,
            requireSecondApprover: true,
          },
        },
      });

      const change = { mode: 'strict' };
      const requirements = engine.checkPolicyChangeRequirements(change);
      expect(requirements.requiresSecondApprover).toBe(true);
      expect(requirements.revertAfterMinutes).toBe(60);
    });
  });

  describe('Profile Governance', () => {
    it('should check if template is allowed', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'unrestricted',
          cloudModelRequests: {
            default: 'allow',
          },
        },
        profiles: {
          allowedTemplateIds: ['template-a', 'template-b'],
        },
      });

      expect(engine.isTemplateAllowed('template-a')).toBe(true);
      expect(engine.isTemplateAllowed('template-b')).toBe(true);
      expect(engine.isTemplateAllowed('template-c')).toBe(false);
    });

    it('should allow all templates if no restrictions', () => {
      const engine = new PolicyEngine({
        privacy: {
          mode: 'unrestricted',
          cloudModelRequests: {
            default: 'allow',
          },
        },
        profiles: {
          allowedTemplateIds: [],
        },
      });

      expect(engine.isTemplateAllowed('any-template')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request types', () => {
      const engine = new PolicyEngine({
  privacy: {
    mode: "unrestricted",
    cloudModelRequests: {
      default: "allow",
    },
  },
});

      const invalidRequest = {
        type: 'invalid-type',
      };

      expect(() => engine.classifyRequest(invalidRequest)).toThrow();
    });

    it('should handle invalid privacy modes', () => {
      expect(() => {
        new PolicyEngine({
          privacy: {
            mode: 'invalid-mode' as any,
            cloudModelRequests: {
              default: 'allow',
            },
          },
        });
      }).toThrow();
    });
  });
});
