/**
 * tests/unit/core/state/activity-tracker.test.ts
 *
 * Activity Tracker Unit Tests
 *
 * Tests concurrent session tracking and conflict detection logic.
 */

import { describe, it, expect } from 'vitest';
import { ActivityTracker } from '../../../../src/core/state/activity-tracker.js';

describe('ActivityTracker', () => {
  describe('Session Registration', () => {
    it('should register a new session', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      const session = tracker.getSession('session-1');
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('session-1');
      expect(session.profileId).toBe('profile-a');
      expect(session.state).toBe('active');
    });

    it('should track initial state as initializing', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'initializing',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      const session = tracker.getSession('session-1');
      expect(session.state).toBe('initializing');
    });

    it('should update session state', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'initializing',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateSessionState('session-1', 'active');

      const session = tracker.getSession('session-1');
      expect(session.state).toBe('active');
    });

    it('should update active files for a session', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);

      const session = tracker.getSession('session-1');
      expect(session.activeFiles).toEqual(['src/main.ts', 'src/utils.ts']);
    });

    it('should update active commands for a session', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveCommands('session-1', ['npm test', 'npm build']);

      const session = tracker.getSession('session-1');
      expect(session.activeCommands).toEqual(['npm test', 'npm build']);
    });

    it('should update last activity timestamp', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      const timestamp = Date.now();
      tracker.updateActivity('session-1', timestamp);

      const session = tracker.getSession('session-1');
      expect(session.lastActivity).toBe(timestamp);
    });

    it('should update conflict risk level', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateConflictRisk('session-1', 'medium');

      const session = tracker.getSession('session-1');
      expect(session.conflictRisk).toBe('medium');
    });

    it('should unregister a session', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.unregisterSession('session-1');

      expect(() => tracker.getSession('session-1')).toThrow();
    });

    it('should throw error when registering duplicate session ID', () => {
      const tracker = new ActivityTracker();

      const sessionData = {
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed' as const,
        state: 'active' as const,
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local' as const,
      };

      tracker.registerSession(sessionData);

      expect(() => tracker.registerSession(sessionData)).toThrow();
    });
  });

  describe('Conflict Detection', () => {
    it('should detect no conflict when sessions have no overlapping files', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);
      tracker.updateActiveFiles('session-2', ['src/config.ts', 'src/helpers.ts']);

      const conflicts = tracker.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflict when sessions have overlapping files', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);
      tracker.updateActiveFiles('session-2', ['src/config.ts', 'src/main.ts']);

      const conflicts = tracker.detectConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].sessions).toEqual(['session-1', 'session-2']);
      expect(conflicts[0].conflictingFiles).toEqual(['src/main.ts']);
    });

    it('should detect multiple conflicts with different file sets', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-3',
        profileId: 'profile-c',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);
      tracker.updateActiveFiles('session-2', ['src/config.ts', 'src/main.ts', 'src/helpers.ts']);
      tracker.updateActiveFiles('session-3', ['src/helpers.ts', 'src/validators.ts']);

      const conflicts = tracker.detectConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(2);
      expect(conflicts.some((c) => c.conflictingFiles.includes('src/main.ts'))).toBe(true);
      expect(conflicts.some((c) => c.conflictingFiles.includes('src/helpers.ts'))).toBe(true);
    });

    it('should ignore idle sessions in conflict detection', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'idle',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);
      tracker.updateActiveFiles('session-2', ['src/main.ts', 'src/config.ts']);

      const conflicts = tracker.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should ignore terminated sessions in conflict detection', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'terminated',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);
      tracker.updateActiveFiles('session-2', ['src/main.ts', 'src/config.ts']);

      const conflicts = tracker.detectConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Conflict Risk Level Calculation', () => {
    it('should calculate low risk when no file overlaps', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts']);

      const risk = tracker.calculateConflictRisk('session-1');
      expect(risk).toBe('low');
    });

    it('should calculate medium risk when some file overlaps exist', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts', 'src/config.ts']);
      tracker.updateActiveFiles('session-2', ['src/helpers.ts', 'src/main.ts']);

      const risk = tracker.calculateConflictRisk('session-1');
      expect(risk).toBe('medium');
    });

    it('should calculate high risk when significant file overlaps exist', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts', 'src/utils.ts', 'src/config.ts']);
      tracker.updateActiveFiles('session-2', ['src/main.ts', 'src/utils.ts', 'src/config.ts']);

      const risk = tracker.calculateConflictRisk('session-1');
      expect(risk).toBe('high');
    });

    it('should return low risk for session with no active files', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      const risk = tracker.calculateConflictRisk('session-1');
      expect(risk).toBe('low');
    });
  });

  describe('Activity Ledger', () => {
    it('should generate activity ledger for all sessions', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'external',
        state: 'idle',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'private-network',
      });

      tracker.updateActiveFiles('session-1', ['src/main.ts']);
      tracker.updateActiveCommands('session-1', ['npm test']);
      tracker.updateConflictRisk('session-1', 'low');

      const ledger = tracker.getActivityLedger();

      expect(ledger).toHaveLength(2);
      expect(ledger[0].sessionId).toBe('session-1');
      expect(ledger[0].state).toBe('active');
      expect(ledger[0].knownFiles).toEqual(['src/main.ts']);
      expect(ledger[0].knownCommands).toEqual(['npm test']);
      expect(ledger[0].conflictRisk).toBe('low');
      expect(ledger[1].sessionId).toBe('session-2');
      expect(ledger[1].state).toBe('idle');
    });

    it('should filter activity ledger by state', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.registerSession({
        sessionId: 'session-2',
        profileId: 'profile-b',
        sessionType: 'managed',
        state: 'idle',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      const activeLedger = tracker.getActivityLedger({ states: ['active'] });

      expect(activeLedger).toHaveLength(1);
      expect(activeLedger[0].sessionId).toBe('session-1');
    });

    it('should track recent changes for a session', () => {
      const tracker = new ActivityTracker();

      tracker.registerSession({
        sessionId: 'session-1',
        profileId: 'profile-a',
        sessionType: 'managed',
        state: 'active',
        startTime: Date.now(),
        lastActivity: Date.now(),
        providerClass: 'local',
      });

      tracker.recordChange('session-1', {
        filePath: 'src/main.ts',
        changeType: 'modify',
        timestamp: Date.now(),
      });

      const session = tracker.getSession('session-1');
      expect(session.recentChanges).toHaveLength(1);
      expect(session.recentChanges[0].filePath).toBe('src/main.ts');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when updating unknown session', () => {
      const tracker = new ActivityTracker();

      expect(() => tracker.updateSessionState('unknown', 'active')).toThrow();
      expect(() => tracker.updateActiveFiles('unknown', [])).toThrow();
      expect(() => tracker.updateActiveCommands('unknown', [])).toThrow();
    });

    it('should throw error when getting unknown session', () => {
      const tracker = new ActivityTracker();

      expect(() => tracker.getSession('unknown')).toThrow();
    });

    it('should throw error when unregistering unknown session', () => {
      const tracker = new ActivityTracker();

      expect(() => tracker.unregisterSession('unknown')).toThrow();
    });
  });
});
