/**
 * src/core/state/state-machine.ts
 *
 * State Machine
 *
 * Handles session state transitions and handoff state machine logic.
 * This file contains NO VS Code API imports - pure TypeScript logic.
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Session state enum.
 */
export type SessionState = 'initializing' | 'active' | 'idle' | 'switching' | 'terminated';

/**
 * Handoff state enum.
 */
export type HandoffState = 'initiating' | 'pending' | 'in-progress' | 'completed' | 'failed';

/**
 * Handoff mode enum.
 */
export type HandoffMode = 'full' | 'summary' | 'none';

/**
 * Conflict risk level enum.
 */
export type ConflictRisk = 'low' | 'medium' | 'high';

/**
 * State transition record for session history.
 */
export interface StateTransition {
  fromState: SessionState | undefined;
  toState: SessionState;
  timestamp: number;
}

/**
 * Handoff metadata.
 */
export interface HandoffMetadata {
  handoffId: string;
  sourceSessionId: string;
  sourceProfileId: string;
  destinationProfileId: string;
  state: HandoffState;
  mode: HandoffMode | null;
  error: string | null;
  timestamp: number;
}

/**
 * Transition result.
 */
export interface TransitionResult {
  success: boolean;
  errors: string[];
}

// ============================================================
// VALIDATION RULES
// ============================================================

/**
 * Valid state transitions for sessions.
 */
const VALID_SESSION_TRANSITIONS: Record<SessionState, SessionState[]> = {
  initializing: ['active'],
  active: ['idle', 'switching', 'terminated'],
  idle: ['active', 'terminated'],
  switching: ['active', 'terminated'],
  terminated: [] as never[],
};

// ============================================================
// STATE MACHINE CLASS
// ============================================================

/**
 * State Machine
 *
 * Manages session state transitions and handoff state machine logic.
 *
 * Key responsibilities:
 * - Track session states (initializing, active, idle, switching, terminated)
 * - Enforce valid state transitions
 * - Track handoff state machine (initiating → pending → in-progress → completed/failed)
 * - Record state transition history for debugging and audit
 */
export class StateMachine {
  private sessions = new Map<string, SessionState>();
  private sessionHistory = new Map<string, StateTransition[]>();
  private handoffs = new Map<string, HandoffMetadata>();

  // ============================================================
  // SESSION STATE MANAGEMENT
  // ============================================================

  /**
   * Transition a session to a new state.
   *
   * @param sessionId - Session identifier
   * @param newState - Target state
   * @throws Error if transition is invalid or session not found
   */
  transitionSessionState(sessionId: string, newState: SessionState): void {
    const result = this.tryTransition(sessionId, newState);
    if (!result.success) {
      throw new Error(result.errors.join('; '));
    }
  }

  /**
   * Attempt to transition session to a new state without throwing.
   *
   * @param sessionId - Session identifier
   * @param newState - Target state
   * @returns Transition result with success status and/or errors
   */
  tryTransition(sessionId: string, newState: SessionState): TransitionResult {
    const currentState = this.sessions.get(sessionId);

    if (currentState === undefined) {
      // Allow first transition (from undefined to initializing)
      if (newState === 'initializing') {
        this.recordTransition(sessionId, undefined, newState);
        this.sessions.set(sessionId, newState);
        return { success: true, errors: [] };
      }

      return {
        success: false,
        errors: [`Session '${sessionId}' not found (must start with 'initializing' state)`],
      };
    }

    // Validate transition
    const validTransitions = VALID_SESSION_TRANSITIONS[currentState];
    if (!validTransitions.includes(newState)) {
      return {
        success: false,
        errors: [
          `Invalid state transition: ${currentState} → ${newState}. Valid transitions: ${validTransitions.join(', ')}`,
        ],
      };
    }

    this.recordTransition(sessionId, currentState, newState);
    this.sessions.set(sessionId, newState);
    return { success: true, errors: [] };
  }

  /**
   * Get the current state of a session.
   *
   * @param sessionId - Session identifier
   * @returns Current session state
   * @throws Error if session not found
   */
  getSessionState(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (state === undefined) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    return state;
  }

  /**
   * Mark a session as idle (simulates idle timeout).
   *
   * @param sessionId - Session identifier
   */
  markSessionIdle(sessionId: string): void {
    this.transitionSessionState(sessionId, 'idle');
  }

  /**
   * Mark a session as active (simulates new activity in idle session).
   *
   * @param sessionId - Session identifier
   */
  markSessionActive(sessionId: string): void {
    this.transitionSessionState(sessionId, 'active');
  }

  /**
   * Begin profile switch for a session (transitions to switching state).
   *
   * @param sessionId - Session identifier
   */
  beginProfileSwitch(sessionId: string): void {
    // Ensure session is in active state before switching
    const currentState = this.getSessionState(sessionId);
    if (currentState !== 'active') {
      throw new Error(
        `Cannot begin profile switch: session must be in 'active' state, but is in '${currentState}' state`,
      );
    }

    this.transitionSessionState(sessionId, 'switching');
  }

  /**
   * Complete profile switch for a session (transitions back to active state).
   *
   * @param sessionId - Session identifier
   */
  completeProfileSwitch(sessionId: string): void {
    // Ensure session is in switching state
    const currentState = this.getSessionState(sessionId);
    if (currentState !== 'switching') {
      throw new Error(
        `Cannot complete profile switch: session must be in 'switching' state, but is in '${currentState}' state`,
      );
    }

    this.transitionSessionState(sessionId, 'active');
  }

  /**
   * Terminate a session (transitions to terminated state).
   *
   * @param sessionId - Session identifier
   */
  terminateSession(sessionId: string): void {
    this.transitionSessionState(sessionId, 'terminated');
  }

  /**
   * Get state transition history for a session.
   *
   * @param sessionId - Session identifier
   * @returns Array of state transitions
   */
  getSessionHistory(sessionId: string): StateTransition[] {
    const history = this.sessionHistory.get(sessionId);
    if (!history) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    return history;
  }

  // ============================================================
  // HANDOFF STATE MANAGEMENT
  // ============================================================

  /**
   * Begin a new handoff operation.
   *
   * @param handoffId - Handoff identifier
   * @param sourceSessionId - Source session identifier
   * @param sourceProfileId - Source profile identifier
   * @param destinationProfileId - Destination profile identifier
   * @returns Handoff metadata
   */
  beginHandoff(
    handoffId: string,
    sourceSessionId: string,
    sourceProfileId: string,
    destinationProfileId: string,
  ): HandoffMetadata {
    const metadata: HandoffMetadata = {
      handoffId,
      sourceSessionId,
      sourceProfileId,
      destinationProfileId,
      state: 'initiating',
      mode: null,
      error: null,
      timestamp: Date.now(),
    };

    this.handoffs.set(handoffId, metadata);
    return metadata;
  }

  /**
   * Select handoff mode (full, summary, or none).
   *
   * @param handoffId - Handoff identifier
   * @param mode - Handoff mode
   */
  selectHandoffMode(handoffId: string, mode: HandoffMode): void {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }

    if (handoff.state !== 'initiating') {
      throw new Error(
        `Cannot select handoff mode: handoff must be in 'initiating' state, but is in '${handoff.state}' state`,
      );
    }

    handoff.mode = mode;
    handoff.state = 'pending';
  }

  /**
   * Generate handoff content (transitions to in-progress).
   *
   * @param handoffId - Handoff identifier
   */
  generateHandoffContent(handoffId: string): void {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }

    if (handoff.state !== 'pending') {
      throw new Error(
        `Cannot generate handoff content: handoff must be in 'pending' state, but is in '${handoff.state}' state`,
      );
    }

    handoff.state = 'in-progress';
  }

  /**
   * Complete a handoff operation successfully.
   *
   * @param handoffId - Handoff identifier
   */
  completeHandoff(handoffId: string): void {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }

    if (handoff.state !== 'in-progress') {
      throw new Error(
        `Cannot complete handoff: handoff must be in 'in-progress' state, but is in '${handoff.state}' state`,
      );
    }

    handoff.state = 'completed';
  }

  /**
   * Fail a handoff operation.
   *
   * @param handoffId - Handoff identifier
   * @param error - Error message
   */
  failHandoff(handoffId: string, error: string): void {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }

    if (handoff.state !== 'in-progress') {
      throw new Error(
        `Cannot fail handoff: handoff must be in 'in-progress' state, but is in '${handoff.state}' state`,
      );
    }

    handoff.state = 'failed';
    handoff.error = error;
  }

  /**
   * Get the current state of a handoff.
   *
   * @param handoffId - Handoff identifier
   * @returns Current handoff state
   * @throws Error if handoff not found
   */
  getHandoffState(handoffId: string): HandoffState {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }
    return handoff.state;
  }

  /**
   * Get handoff metadata.
   *
   * @param handoffId - Handoff identifier
   * @returns Handoff metadata
   * @throws Error if handoff not found
   */
  getHandoffMetadata(handoffId: string): HandoffMetadata {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }
    return handoff;
  }

  /**
   * Get handoff error message.
   *
   * @param handoffId - Handoff identifier
   * @returns Error message or null if no error
   * @throws Error if handoff not found
   */
  getHandoffError(handoffId: string): string | null {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff '${handoffId}' not found`);
    }
    return handoff.error;
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Record a state transition in session history.
   *
   * @param sessionId - Session identifier
   * @param fromState - Previous state
   * @param toState - New state
   */
  private recordTransition(
    sessionId: string,
    fromState: SessionState | undefined,
    toState: SessionState,
  ): void {
    const transition: StateTransition = {
      fromState,
      toState,
      timestamp: Date.now(),
    };

    let history = this.sessionHistory.get(sessionId);
    if (!history) {
      history = [];
      this.sessionHistory.set(sessionId, history);
    }

    history.push(transition);
  }
}
