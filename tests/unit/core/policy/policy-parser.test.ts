/**
 * tests/unit/core/policy/policy-parser.test.ts
 *
 * Policy Parser Unit Tests
 *
 * Tests workspace policy YAML parsing and validation logic.
 */

import { describe, it, expect } from 'vitest';
import { PolicyParser } from '../../../../src/core/policy/policy-parser.js';

describe('PolicyParser', () => {
  describe('Parse Valid Workspace Policies', () => {
    it('should parse minimal workspace policy', () => {
      const yaml = `
schemaVersion: 1

privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.mode).toBe('unrestricted');
      expect(policy.privacy.cloudModelRequests.default).toBe('allow');
    });

    it('should parse workspace policy with handoff configuration', () => {
      const yaml = `
schemaVersion: 1

privacy:
  mode: guarded
  cloudModelRequests:
    default: require-confirmation
  handoff:
    allowedModes:
      - summary
      - none
    defaultMode: summary
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.mode).toBe('guarded');
      expect(policy.privacy.handoff?.allowedModes).toEqual(['summary', 'none']);
      expect(policy.privacy.handoff?.defaultMode).toBe('summary');
    });

    it('should parse workspace policy with concurrency configuration', () => {
      const yaml = `
schemaVersion: 1

privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow

concurrency:
  default: concurrent
  conflictAction: warn
  supportsWorktrees: true
  checkpointBeforeMutation: false
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.concurrency?.default).toBe('concurrent');
      expect(policy.concurrency?.conflictAction).toBe('warn');
      expect(policy.concurrency?.supportsWorktrees).toBe(true);
    });

    it('should parse workspace policy with profile restrictions', () => {
      const yaml = `
schemaVersion: 1

privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow

profiles:
  allowedTemplateIds:
    - template-a
    - template-b
    - template-c
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.profiles?.allowedTemplateIds).toEqual([
        'template-a',
        'template-b',
        'template-c',
      ]);
    });

    it('should parse complete workspace policy', () => {
      const yaml = `
schemaVersion: 1

privacy:
  mode: strict
  cloudModelRequests:
    default: block
  handoff:
    allowedModes:
      - none
    defaultMode: none
  policyChanges:
    requireConfirmation: true
    requireReason: true
    revertAfterMinutes: 60
    requireSecondApprover: true

concurrency:
  default: exclusive-writer
  conflictAction: block
  supportsWorktrees: false
  checkpointBeforeMutation: true

profiles:
  allowedTemplateIds:
    - local-only
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.mode).toBe('strict');
      expect(policy.privacy.cloudModelRequests.default).toBe('block');
      expect(policy.privacy.handoff?.allowedModes).toEqual(['none']);
      expect(policy.privacy.policyChanges?.requireConfirmation).toBe(true);
      expect(policy.privacy.policyChanges?.requireSecondApprover).toBe(true);
      expect(policy.concurrency?.default).toBe('exclusive-writer');
      expect(policy.profiles?.allowedTemplateIds).toEqual(['local-only']);
    });
  });

  describe('Privacy Mode Validation', () => {
    it('should accept unrestricted mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.mode).toBe('unrestricted');
    });

    it('should accept guarded mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: guarded
  cloudModelRequests:
    default: require-confirmation
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.mode).toBe('guarded');
    });

    it('should accept strict mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: strict
  cloudModelRequests:
    default: block
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.mode).toBe('strict');
    });

    it('should reject invalid privacy mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: invalid-mode
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/invalid.*privacy mode/i);
    });
  });

  describe('Cloud Model Request Default Action Validation', () => {
    it('should accept require-confirmation action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: guarded
  cloudModelRequests:
    default: require-confirmation
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.cloudModelRequests.default).toBe('require-confirmation');
    });

    it('should accept block action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: strict
  cloudModelRequests:
    default: block
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.cloudModelRequests.default).toBe('block');
    });

    it('should accept allow action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.cloudModelRequests.default).toBe('allow');
    });

    it('should reject invalid default action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: invalid-action
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/invalid.*cloud model request.*default/i);
    });
  });

  describe('Handoff Mode Validation', () => {
    it('should accept full handoff mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
  handoff:
    allowedModes:
      - full
      - summary
      - none
    defaultMode: summary
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.handoff?.allowedModes).toContain('full');
    });

    it('should accept summary handoff mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
  handoff:
    allowedModes:
      - summary
      - none
    defaultMode: summary
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.handoff?.allowedModes).toContain('summary');
    });

    it('should accept none handoff mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
  handoff:
    allowedModes:
      - none
    defaultMode: none
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.privacy.handoff?.allowedModes).toContain('none');
    });

    it('should reject invalid handoff mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
  handoff:
    allowedModes:
      - invalid-mode
    defaultMode: invalid-mode
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/invalid.*handoff mode/i);
    });

    it('should reject default mode not in allowed modes', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
  handoff:
    allowedModes:
      - none
    defaultMode: full
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/Invalid handoff default mode.*not in allowed/i);
    });
  });

  describe('Concurrency Configuration Validation', () => {
    it('should accept concurrent concurrency mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
concurrency:
  default: concurrent
  conflictAction: warn
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.concurrency?.default).toBe('concurrent');
    });

    it('should accept exclusive-writer concurrency mode', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
concurrency:
  default: exclusive-writer
  conflictAction: block
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.concurrency?.default).toBe('exclusive-writer');
    });

    it('should accept warn conflict action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
concurrency:
  default: concurrent
  conflictAction: warn
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.concurrency?.conflictAction).toBe('warn');
    });

    it('should accept block conflict action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
concurrency:
  default: exclusive-writer
  conflictAction: block
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(policy.concurrency?.conflictAction).toBe('block');
    });

    it('should reject invalid concurrency default', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
concurrency:
  default: invalid-mode
  conflictAction: warn
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/invalid.*concurrency.*default/i);
    });

    it('should reject invalid conflict action', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
concurrency:
  default: concurrent
  conflictAction: invalid-action
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/invalid.*conflict action/i);
    });
  });

  describe('Schema Version Validation', () => {
    it('should require schema version', () => {
      const yaml = `
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/Required field "schemaVersion".*missing/i);
    });

    it('should reject unsupported schema version', () => {
      const yaml = `
schemaVersion: 999
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/unsupported.*schema version/i);
    });

    it('should accept schema version 1', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
`;

      const parser = new PolicyParser();
      const policy = parser.parse(yaml);

      expect(() => parser.parse(yaml)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid YAML syntax', () => {
      const yaml = `
schemaVersion: 1
privacy:
  mode: unrestricted
  cloudModelRequests:
    default: allow
    invalid yaml structure {
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/yaml/i);
    });

    it('should handle missing required fields', () => {
      const yaml = `
schemaVersion: 1
`;

      const parser = new PolicyParser();

      expect(() => parser.parse(yaml)).toThrow(/required field/i);
    });
  });
});
