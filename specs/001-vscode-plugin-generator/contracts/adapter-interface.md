# Adapter Interface Contract

**Project**: VS Code Model Profile Orchestrator
**Version**: 1.0
**Date**: 2026-10-17
**Purpose**: Abstract interface for implementing model provider adapters

## Overview

All provider adapters must implement this interface. The extension uses this contract to interact with different AI model providers uniformly, including Claude Code (native), Anthropic-compatible APIs, OpenAI-compatible APIs, Ollama, and generic command-line interfaces.

Adapters declare their capabilities at construction time, enabling the UI to enable/disable features appropriately.

## Adapter Interface

```typescript
/**
 * Abstract Adapter Interface
 *
 * All adapters must implement these methods to provide a consistent
 * integration surface for the extension.
 */
export interface ModelAdapter {
  // ========== Capabilities Declaration ==========

  /**
   * Declares which capabilities this adapter supports.
   * Used to enable/disable UI features accordingly (FR-021).
   */
  capabilities: AdapterCapabilities;

  // ========== Connection & Lifecycle ==========

  /**
   * Validate that the profile configuration is valid before activation.
   * Should not make billable API calls by default (FR-071).
   *
   * Returns validation status with any errors or warnings.
   */
  validate(config: ProfileConfig): Promise<ValidationResult>;

  /**
   * Establish connection to the model provider.
   * Called during profile activation.
   *
   * Returns connection status with any diagnostics.
   */
  connect(config: ProfileConfig): Promise<ConnectionStatus>;

  /**
   * Close connection and cleanup resources.
   * Called during profile deactivation or extension shutdown.
   */
  disconnect(): Promise<void>;

  // ========== Model Discovery (Optional) ==========

  /**
   * List available models from this provider.
   * Only supported if capabilities.modelDiscovery is true.
   *
   * Throws if modelDiscovery is false.
   */
  listModels?(config: ProfileConfig): Promise<AvailableModel[]>;

  // ========== Messaging ==========

  /**
   * Send a message to the model and receive the response.
   *
   * @param message - The user message to send
   * @param context - Additional context (file references, history, etc.)
   * @param options - Streaming, tool use, file editing options
   *
   * Returns response. If streaming requested via streaming option,
   * returns AsyncIterable<string> for stream chunks.
   *
   * Throws if capabilities.streaming is false and streaming requested.
   */
  sendMessage(
    message: string,
    context: MessageContext,
    options: MessageOptions
  ): Promise<MessageResponse | AsyncIterable<string>>;

  // ========== Tool & File Operations (Optional) ==========

  /**
   * Execute a tool/function call.
   * Only supported if capabilities.tools is true.
   *
   * Can be called by extension or by model during sendMessage.
   */
  executeTool?(toolCall: ToolCall, context: MessageContext): Promise<ToolResult>;

  /**
   * Edit a file directly (model-side file editing).
   * Only supported if capabilities.fileEdits is true.
   *
   * @param fileEdits - List of file edits to apply
   * @returns Results including success/failure for each edit
   */
  editFile?(fileEdits: FileEdit[]): Promise<FileEditResult[]>;

  /**
   * Execute a shell command.
   * Only supported if capabilities.commands is true.
   *
   * For generic-command adapter, this is the primary mode.
   * For other adaptors, commands may be executed by model tools.
   */
  executeCommand?(command: CommandExecution): Promise<CommandResult>;

  // ========== Transcript Retrieval (Optional) ==========

  /**
   * Retrieve the conversation transcript from this session.
   * Only supported if capabilities.transcriptObservable is true.
   *
   * Returns transcript with metadata. Content is returned for
   * handoff processing; extension redacts secrets before log.
   *
   * Throws if capabilities.transcriptObservable is false.
   */
  getTranscript?(): Promise<Transcript>;
}
```

## Type Definitions

### Adapter Capabilities

```typescript
export interface AdapterCapabilities {
  /**
   * Supports streaming responses.
   *
   * If false, sendMessage throws if options.streaming = true.
   * UI can disable "streaming response" setting.
   */
  streaming: boolean;

  /**
   * Supports tool/function calling.
   *
   * If false, executeTool method is not available.
   * Model cannot request tool execution.
   * UI can disable tool permission settings.
   */
  tools: boolean;

  /**
   * Supports direct file editing.
   *
   * If false, editFile method is not available.
   * File edits must go through tool interface if supported.
   * UI can warn about file edit limitations.
   */
  fileEdits: boolean;

  /**
   * Supports command execution.
   *
   * If false, executeCommand method is not available.
   * Generic-command adapter should set this to true.
   * UI can disable command permission settings.
   */
  commands: boolean;

  /**
   * Supports model discovery (list models).
   *
   * If false, listModels method is not available.
   * UI must show warning if model ID in profile doesn't match known models.
   */
  modelDiscovery: boolean;

  /**
   * Supports transcript retrieval.
   *
   * If false, getTranscript method is not available.
   * Handoff "full transcript" mode is disabled for this provider.
   * UI must show limitation and offer alternatives.
   */
  transcriptObservable: boolean;
}
```

### Configuration

```typescript
/**
 * Subset of ProfileConfig needed for adapter methods.
 * Extracted from complete profile YAML after loading and merging.
 */
export interface ProfileConfig {
  id: string;
  adapter: 'native-claude' | 'anthropic-compatible' | 'openai-compatible' | 'ollama' | 'generic-command';
  model: string;
  baseUrl?: string;
  credential: {
    mode: 'none' | 'secretRef' | 'environment' | 'subscription';
    secretRef?: string | null;
  };
  tunnel?: {
    enabled: boolean;
    sshHostAlias?: string | null;
    localPort?: number | null;
  };
  limits?: {
    contextTokens?: number | null;
    maxOutputTokens?: number | null;
  };
  permissions: {
    mode: 'review-only' | 'edit-only' | 'edit-and-command';
    workspacePaths?: string[];
  };
  network: {
    providerClass: 'local' | 'private-network' | 'cloud';
    supportingNetwork: 'allowed' | 'blocked';
  };
  instructions?: string | null;
  environmentRefs?: string[];
  healthCheck?: {
    url?: string | null;
    method?: 'GET' | 'POST' | null;
  };
  capabilities: Readonly<AdapterCapabilities>;
}
```

### Message Types

```typescript
export interface MessageContext {
  /**
   * File references to include in context.
   */
  files?: FileReference[];

  /**
   * Conversation history (previous turns).
   */
  history?: ConversationTurn[];

  /**
   * Current workspace path (for file resolution).
   */
  workspacePath?: string;

  /**
   * Additional context metadata.
   */
  metadata?: Record<string, unknown>;
}

export interface FileReference {
  /**
   * File URI or absolute path.
   */
  path: string;

  /**
   * Optional range within file.
   */
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };

  /**
   * File content if already loaded (optional).
   */
  content?: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface MessageOptions {
  /**
   * Enable streaming responses.
   * Requires capabilities.streaming = true.
   */
  streaming?: boolean;

  /**
   * Enable tool/function calling.
   * Requires capabilities.tools = true.
   */
  useTools?: boolean;

  /**
   * Enable direct file editing.
   * Requires capabilities.fileEdits = true.
   */
  allowFileEdits?: boolean;

  /**
   * Enable command execution.
   * Requires capabilities.commands = true.
   */
  allowCommands?: boolean;

  /**
   * Custom model parameters (temperature, max_tokens, etc.).
   * Adapter-specific; may not be supported by all providers.
   */
  modelParams?: Record<string, unknown>;
}

export interface MessageResponse {
  /**
   * Generated response content.
   */
  content: string;

  /**
   * If model requested tools, these are included.
   * Extension is responsible for executing and sending results back.
   */
  toolCalls?: ToolCall[];

  /**
   * If model performed file edits, these are included.
   */
  fileEdits?: FileEdit[];

  /**
   * If model requested command execution, this is included.
   */
  commands?: CommandExecution[];

  /**
   * Metadata about the response (tokens used, finish reason, etc.).
   */
  metadata?: Record<string, unknown>;

  /**
   * Timestamp when response was generated.
   */
  timestamp: Date;
}
```

### Tool Types

```typescript
export interface ToolCall {
  /**
   * Tool name or identifier.
   */
  name: string;

  /**
   * Arguments for the tool call.
   */
  arguments: Record<string, unknown>;

  /**
   * Call ID for streaming responses.
   */
  id?: string;
}

export interface ToolResult {
  /**
   * Result of tool execution.
   */
  result: unknown;

  /**
   * Whether execution was successful.
   */
  success: boolean;

  /**
   * Error message if execution failed.
   */
  error?: string;

  /**
   * Metadata about execution.
   */
  metadata?: Record<string, unknown>;
}
```

### File Edit Types

```typescript
export interface FileEdit {
  /**
   * File to edit (URI or path).
   */
  file: string;

  /**
   * Type of edit: create, modify, delete.
   */
  type: 'create' | 'modify' | 'delete';

  /**
   * For type=modify or create: file content.
   * For type=delete: omitted.
   */
  content?: string;

  /**
   * Range for type=modify.
   * For type=create or delete: omitted.
   */
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface FileEditResult {
  /**
   * File that was edited.
   */
  file: string;

  /**
   * Whether edit was successful.
   */
  success: boolean;

  /**
   * Error message if failed.
   */
  error?: string;

  /**
   * Diff representation (if available).
   */
  diff?: string;

  /**
   * Line numbers affected.
   */
  affectedLines?: {
    start: number;
    end: number;
  };
}
```

### Command Types

```typescript
export interface CommandExecution {
  /**
   * Command to execute (including arguments).
   */
  command: string;

  /**
   * Working directory for command.
   */
  cwd?: string;

  /**
   * Environment variables for command (sanitized).
   */
  env?: Record<string, string>;

  /**
   * Timeout in milliseconds.
   */
  timeout?: number;
}

export interface CommandResult {
  /**
   * Exit code.
   */
  exitCode: number;

  /**
   * Standard output.
   */
  stdout: string;

  /**
   * Standard error.
   */
  stderr: string;

  /**
   * Whether command succeeded (exit code 0).
   */
  success: boolean;

  /**
   * Execution time in milliseconds.
   */
  duration: number;
}
```

### Validation

```typescript
export interface ValidationResult {
  /**
   * Whether validation passed.
   */
  valid: boolean;

  /**
   * Array of errors (blocking).
   */
  errors: ValidationError[];

  /**
   * Array of warnings (non-blocking).
   */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  /**
   * Field or path with error.
   */
  field: string;

  /**
   * Error message.
   */
  message: string;

  /**
   * Suggested fix if available.
   */
  suggestion?: string;
}

export interface ValidationWarning {
  /**
   * Field or path with warning.
   */
  field: string;

  /**
   * Warning message.
   */
  message: string;
}

export interface ConnectionStatus {
  /**
   * Whether connection is successful.
   */
  connected: boolean;

  /**
   * Status message.
   */
  status: string;

  /**
   * Diagnostics information.
   */
  diagnostics?: Record<string, unknown>;
}
```

### Model Discovery

```typescript
export interface AvailableModel {
  /**
   * Model identifier.
   */
  id: string;

  /**
   * Human-readable model name.
   */
  name: string;

  /**
   * Model context token limit.
   */
  contextTokens?: number;

  /**
   * Max output token limit.
   */
  maxOutputTokens?: number;

  /**
   * Supported capabilities.
   */
  capabilities?: Partial<AdapterCapabilities>;

  /**
   * Additional metadata.
   */
  metadata?: Record<string, unknown>;
}
```

### Transcript

```typescript
export interface Transcript {
  /**
   * Transcript unique identifier.
   */
  id: string;

  /**
   * Profile ID for this session.
   */
  profileId: string;

  /**
   * Conversation turns.
   */
  turns: ConversationTurn[];

  /**
   * File edits made during session.
   */
  fileEdits?: FileEdit[];

  /**
   * Commands executed during session.
   */
  commands?: CommandExecution[];

  /**
   * Session start timestamp.
   */
  startTime: Date;

  /**
   * Session end timestamp (if completed).
   */
  endTime?: Date;

  /**
   * Metadata about the transcript.
   */
  metadata?: Record<string, unknown>;
}
```

## Adapter Implementation Guidelines

### Capability Honest Declarations (FR-021)

Adapters MUST truthfully declare capabilities. The adapter interface is type-safe but runtime checks validate compliance:

- If `capabilities.streaming = false`, adapter may throw when streaming requested
- If `capabilities.tools = false`, adapter must not invoke tools
- If `capabilities.fileEdits = false`, adapter must not perform direct file edits
- If `capabilities.commands = false`, adapter must not execute shell commands
- If `capabilities.modelDiscovery = false`, adapter must not implement `listModels`
- If `capabilities.transcriptObservable = false`, adapter must not implement `getTranscript`

### Error Handling

Adapters SHOULD throw errors with descriptive messages for:

- Invalid configuration (missing required fields, impossible combinations)
- Connection failures (network errors, authentication failures)
- Unsupported operations (capability requested but not supported)
- Rate limiting or quota exceeded (if applicable)
- Malformed responses from provider

### Environment Sandboxing (FR-023)

For `generic-command` adapter:

- Sanitize environment to profile-specific variables only (profile.environmentRefs)
- Limit PATH to minimal set, prepend profile-specific paths from environmentRefs
- Set working directory to safe location (temp dir or user-controlled path)
- Enforce timeout to prevent runaway processes
- Do not expose sensitive environment variables or OS secrets

### Secret Resolution

For credentials:

- Native Claude adapter uses `credential.mode = 'subscription'` (no SecretStorage lookup)
- Other adapters use `credential.mode = 'secretRef'` (lookup in VS Code SecretStorage)
- `credential.mode = 'environment'` resolves from OS environment variables
- Adapter must NOT log secrets or include them in error messages

## Testing Requirements

All adapters MUST have unit tests covering:

1. **Capability Compliance**: For each false capability, verify operation throws or is disabled
2. **Configuration Validation**: validate() detects invalid configs with specific errors
3. **Connection Lifecycle**: connect(), disconnect() succeed/fail appropriately
4. **Permission Modes**: respect `review-only`, `edit-only`, `edit-and-command` settings
5. **Network Errors**: Connection failures, timeouts, rate limits

Implementation adapters (anthropic-compatible, openai-compatible, ollama, generic-command) MUST also have integration tests:

1. **Real Endpoint**: Minimal integration test with actual provider (if accessible in CI)
2. **Model Discovery**: listModels() returns valid models (if supported)
3. **Message Send-Receive**: sendMessage() produces valid responses
4. **Streaming**: Streaming responses work (if supported)
5. **Transcript Retrieval**: getTranscript() returns usable data (if supported)

## Future Extensibility

New adapter types may be added by:

1. Implementing `ModelAdapter` interface
2. Updating `ProfileConfig.adapter` type union
3. Adding validation for new adapter type
4. Updating UI to support new adapter's unique configuration needs
5. Testing per guidelines above

Interface changes require:

1. Major version bump in contract
2. All adapters updated to implement new interface
3. Backward compatibility consideration for existing extensions
