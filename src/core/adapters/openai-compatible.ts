/**
 * src/core/adapters/openai-compatible.ts
 *
 * OpenAI-Compatible Adapter
 *
 * Integrates with any OpenAI-compatible HTTP API (OpenAI, Azure, local servers).
 * Uses standard OpenAI message format and tool calling conventions.
 *
 * STUB: Full implementation in T098-T102
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
  AvailableModel,
} from './contract.js';

/**
 * OpenAI-compatible adapter capabilities.
 *
 * Supports streaming and basic tools. File editing limited unless
 * model provider supports it natively.
 */
const OPENAI_CAPABILITIES: AdapterCapabilities = {
  streaming: true,
  tools: true,
  fileEdits: false,
  commands: false,
  modelDiscovery: true,
  transcriptObservable: false,
};

/**
 * OpenAI-compatible adapter for standard HTTP APIs.
 */
export class OpenAICompatibleAdapter implements ModelAdapter {
  capabilities: AdapterCapabilities = OPENAI_CAPABILITIES;

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
      status: 'Connected to OpenAI-compatible endpoint',
    };
  }

  async disconnect(): Promise<void> {
    // Stub: disconnect from endpoint
  }

  async listModels(_config: ProfileConfig): Promise<AvailableModel[]> {
    // Stub: list available models
    return [];
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
}
