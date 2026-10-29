/**
 * tests/unit/core/state/state-machine.test.ts
 *
 * State Machine Unit Tests
 *
 * Tests session state transitions and handoff state machine logic.
 */

import { describe, it, expect } from 'vitest';
import { StateMachine } from '../../../../src/core/state/state-machine.js';

describe('StateMachine', () => {
  describe('Session State Transitions', () => {
    it('should transition from initializing to active', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');

      expect(machine.getSessionState(sessionId)).toBe('active');
    });

    it('should transition from active to idle', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');

      // Simulate idle timeout
      machine.markSessionIdle(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('idle');
    });

    it('should transition from idle back to active on new activity', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');
      machine.markSessionIdle(sessionId);

      // Simulate new activity
      machine.markSessionActive(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('active');
    });

    it('should transition from active to switching on profile change', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');

      // Initiate profile change
      machine.beginProfileSwitch(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('switching');
    });

    it('should transition from switching to active after handoff completes', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');
      machine.beginProfileSwitch(sessionId);

      // Handoff completes
      machine.completeProfileSwitch(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('active');
    });

    it('should transition from active to terminated', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');

      // Session terminated
      machine.terminateSession(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('terminated');
    });

    it('should transition from idle to terminated', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');
      machine.markSessionIdle(sessionId);

      // Session terminated
      machine.terminateSession(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('terminated');
    });

    it('should transition from switching to terminated', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');
      machine.beginProfileSwitch(sessionId);

      // Session terminated during switch
      machine.terminateSession(sessionId);
      expect(machine.getSessionState(sessionId)).toBe('terminated');
    });

    it('should reject invalid state transitions', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');

      // Cannot transition from initializing to terminated directly
      const result = machine.tryTransition(sessionId, 'terminated');
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid state transition'))).toBe(true);
    });

    it('should track multiple sessions with independent states', () => {
      const machine = new StateMachine();

      const session1 = 'session-1';
      const session2 = 'session-2';

      machine.transitionSessionState(session1, 'initializing');
      machine.transitionSessionState(session2, 'initializing');

      machine.transitionSessionState(session1, 'active');
      machine.transitionSessionState(session2, 'active');

      machine.markSessionIdle(session1);

      expect(machine.getSessionState(session1)).toBe('idle');
      expect(machine.getSessionState(session2)).toBe('active');
    });
  });

  describe('Handoff State Machine', () => {
    it('should transition from initiating to pending', () => {
      const machine = new StateMachine();

      const handoffId = 'handoff-1';
      machine.beginHandoff(handoffId, 'session-1', 'profile-a', 'profile-b');

      expect(machine.getHandoffState(handoffId)).toBe('initiating');
    });

    it('should transition from initiating to pending on profile selection', () => {
      const machine = new StateMachine();

      const handoffId = 'handoff-1';
      machine.beginHandoff(handoffId, 'session-1', 'profile-a', 'profile-b');
      machine.selectHandoffMode(handoffId, 'summary');

      expect(machine.getHandoffState(handoffId)).toBe('pending');
    });

    it('should transition from pending to in-progress', () => {
      const machine = new StateMachine();

      const handoffId = 'handoff-1';
      machine.beginHandoff(handoffId, 'session-1', 'profile-a', 'profile-b');
      machine.selectHandoffMode(handoffId, 'summary');
      machine.generateHandoffContent(handoffId);

      expect(machine.getHandoffState(handoffId)).toBe('in-progress');
    });

    it('should transition from in-progress to completed on success', () => {
      const machine = new StateMachine();

      const handoffId = 'handoff-1';
      machine.beginHandoff(handoffId, 'session-1', 'profile-a', 'profile-b');
      machine.selectHandoffMode(handoffId, 'summary');
      machine.generateHandoffContent(handoffId);
      machine.completeHandoff(handoffId);

      expect(machine.getHandoffState(handoffId)).toBe('completed');
    });

    it('should transition from in-progress to failed on error', () => {
      const machine = new StateMachine();

      const handoffId = 'handoff-1';
      machine.beginHandoff(handoffId, 'session-1', 'profile-a', 'profile-b');
      machine.selectHandoffMode(handoffId, 'summary');
      machine.generateHandoffContent(handoffId);
      machine.failHandoff(handoffId, 'content generation failed');

      expect(machine.getHandoffState(handoffId)).toBe('failed');
      expect(machine.getHandoffError(handoffId)).toContain('content generation failed');
    });

    it('should track handoff metadata', () => {
      const machine = new StateMachine();

      const handoffId = 'handoff-1';
      const handoff = machine.beginHandoff(handoffId, 'session-1', 'profile-a', 'profile-b');

      expect(handoff.sourceSessionId).toBe('session-1');
      expect(handoff.sourceProfileId).toBe('profile-a');
      expect(handoff.destinationProfileId).toBe('profile-b');
      expect(handoff.state).toBe('initiating');
    });

    it('should support multiple concurrent handoffs', () => {
      const machine = new StateMachine();

      const handoff1 = 'handoff-1';
      const handoff2 = 'handoff-2';

      machine.beginHandoff(handoff1, 'session-1', 'profile-a', 'profile-b');
      machine.beginHandoff(handoff2, 'session-2', 'profile-c', 'profile-d');

      expect(machine.getHandoffState(handoff1)).toBe('initiating');
      expect(machine.getHandoffState(handoff2)).toBe('initiating');
    });
  });

  describe('Session History', () => {
    it('should record state transition history', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');
      machine.transitionSessionState(sessionId, 'active');
      machine.markSessionIdle(sessionId);
      machine.markSessionActive(sessionId);

      const history = machine.getSessionHistory(sessionId);

      expect(history.length).toBe(4);
      expect(history[0].fromState).toBeUndefined();
      expect(history[0].toState).toBe('initializing');
      expect(history[1].fromState).toBe('initializing');
      expect(history[1].toState).toBe('active');
      expect(history[2].fromState).toBe('active');
      expect(history[2].toState).toBe('idle');
      expect(history[3].fromState).toBe('idle');
      expect(history[3].toState).toBe('active');
    });

    it('should include timestamps in history', () => {
      const machine = new StateMachine();

      const sessionId = 'session-1';
      machine.transitionSessionState(sessionId, 'initializing');

      const history = machine.getSessionHistory(sessionId);

      expect(history[0].timestamp).toBeDefined();
      expect(typeof history[0].timestamp).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown session', () => {
      const machine = new StateMachine();

      const result = machine.tryTransition('unknown-session', 'active');
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('session') && e.toLowerCase().includes('not found'))).toBe(true);
    });

    it('should throw error for unknown handoff', () => {
      const machine = new StateMachine();

      expect(() => machine.getHandoffState('unknown-handoff')).toThrow(/handoff/i);
    });
  });
});
