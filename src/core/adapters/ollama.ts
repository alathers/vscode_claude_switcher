/**
 * src/core/adapters/ollama.ts
 *
 * Ollama Adapter
 *
 * Integrates with local Ollama instance for running models locally.
 * Connects via HTTP to Ollama's API on localhost or configurable port.
 *
 * STUB: Full implementation in T103-T107
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
  AvailableModel,
} from './contract.js';

/**
 * Ollama adapter capabilities.
 *
 * Supports streaming and model discovery. Tools and file editing
 * depend on the specific model running in Ollama.
 */
const OLLAMA_CAPABILITIES: AdapterCapabilities = {
  streaming: true,
  tools: false,
  fileEdits: false,
  commands: false,
  modelDiscovery: true,
  transcriptObservable: false,
};

/**
 * Ollama adapter for local model management.
 */
export class OllamaAdapter implements ModelAdapter {
  capabilities: AdapterCapabilities = OLLAMA_CAPABILITIES;

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
      status: 'Connected to Ollama',
    };
  }

  async disconnect(): Promise<void> {
    // Stub: disconnect from Ollama
  }

  async listModels(_config: ProfileConfig): Promise<AvailableModel[]> {
    // Stub: list Ollama models
    return [];
  }

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options: MessageOptions,
  ): Promise<MessageResponse> {
    // Stub: send message to Ollama model
    return {
      content: '',
      timestamp: new Date(),
    };
  }
}
