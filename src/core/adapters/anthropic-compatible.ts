/**
 * src/core/adapters/anthropic-compatible.ts
 *
 * Anthropic-Compatible Adapter
 *
 * Integrates with Anthropic's Claude API (claude.ai) via HTTP.
 * Supports standard OpenAI-compatible or Anthropic-specific endpoint.
 *
 * STUB: Full implementation in T088-T092
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
} from './contract.js';

/**
 * Anthropic-compatible adapter capabilities.
 *
 * Supports streaming, tools, and file editing. Does not support
 * command execution or native model discovery.
 */
const ANTHROPIC_CAPABILITIES: AdapterCapabilities = {
  streaming: true,
  tools: true,
  fileEdits: true,
  commands: false,
  modelDiscovery: false,
  transcriptObservable: false,
};

/**
 * Anthropic-compatible adapter for standard APIs.
 */
export class AnthropicCompatibleAdapter implements ModelAdapter {
  capabilities: AdapterCapabilities = ANTHROPIC_CAPABILITIES;

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
      status: 'Connected to Anthropic-compatible endpoint',
    };
  }

  async disconnect(): Promise<void> {
    // Stub: disconnect from endpoint
  }

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options: MessageOptions,
  ): Promise<MessageResponse> {
    // Stub: send message to API
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
    // Stub: edit files via model
    return [];
  }
}
