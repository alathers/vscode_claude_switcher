/**
 * src/core/adapters/generic-command.ts
 *
 * Generic Command Adapter
 *
 * Executes arbitrary shell commands via configured command templates.
 * Uses sanitized environment variables from profile configuration.
 *
 * SECURITY: Commands run with reduced permissions and sanitized env.
 *
 * STUB: Full implementation in T108-T112
 */

import {
  ModelAdapter,
  AdapterCapabilities,
  ProfileConfig,
  ValidationResult,
  ConnectionStatus,
  MessageContext,
  MessageOptions,
  MessageResponse,
  CommandExecution,
  CommandResult,
} from './contract.js';

/**
 * Generic command adapter capabilities.
 *
 * Supports command execution only. Streaming works via command output
 * reading. No tools, file edits, or model discovery.
 */
const GENERIC_COMMAND_CAPABILITIES: AdapterCapabilities = {
  streaming: true,
  tools: false,
  fileEdits: false,
  commands: true,
  modelDiscovery: false,
  transcriptObservable: false,
};

/**
 * Generic command adapter for shell-based AI systems.
 */
export class GenericCommandAdapter implements ModelAdapter {
  capabilities: AdapterCapabilities = GENERIC_COMMAND_CAPABILITIES;

  async validate(_config: ProfileConfig): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  async connect(_config: ProfileConfig): Promise<ConnectionStatus> {
    return {
      connected: true,
      status: 'Generic command adapter ready',
    };
  }

  async disconnect(): Promise<void> {
    // Stub: cleanup command processes
  }

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options: MessageOptions,
  ): Promise<MessageResponse> {
    // Stub: execute configured command with message input
    return {
      content: '',
      timestamp: new Date(),
    };
  }

  async executeCommand(_command: CommandExecution): Promise<CommandResult> {
    // Stub: execute command with sanitized environment
    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
      success: false,
      duration: 0,
    };
  }
}
