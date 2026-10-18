/**
 * src/core/adapters/native-claude.ts
 *
 * Native Claude Adapter
 *
 * Integrates with VS Code's built-in Claude provider via the native extension API.
 * This adapter uses the official Claude Code for VS Code integration.
 *
 * STUB: Full implementation in T093-T097
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
  ToolCall,
  ToolResult,
  FileEdit,
  FileEditResult,
  Transcript,
} from './contract.js';

/**
 * Native Claude adapter capabilities.
 *
 * Native Claude supports most capabilities except generic command execution.
 */
const NATIVE_CLAUDE_CAPABILITIES: AdapterCapabilities = {
  streaming: true,
  tools: true,
  fileEdits: true,
  commands: false,
  modelDiscovery: false,
  transcriptObservable: true,
};

/**
 * Native Claude adapter for VS Code's built-in Claude integration.
 */
export class NativeClaudeAdapter implements ModelAdapter {
  capabilities: AdapterCapabilities = NATIVE_CLAUDE_CAPABILITIES;

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
      status: 'Connected to native Claude',
    };
  }

  async disconnect(): Promise<void> {
    // Stub: disconnect from Claude
  }

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options: MessageOptions,
  ): Promise<MessageResponse> {
    // Stub: send message to native Claude
    return {
      content: '',
      timestamp: new Date(),
    };
  }

  async executeTool(_toolCall: ToolCall, _context: MessageContext): Promise<ToolResult> {
    // Stub: execute tool
    return {
      result: null,
      success: false,
      error: 'Not implemented',
    };
  }

  async editFile(_fileEdits: FileEdit[]): Promise<FileEditResult[]> {
    // Stub: edit files
    return [];
  }

  async getTranscript(): Promise<Transcript> {
    // Stub: retrieve transcript
    return {
      id: '',
      profileId: '',
      turns: [],
      startTime: new Date(),
    };
  }
}
