/**
 * src/core/adapters/contract.ts
 *
 * Abstract Adapter Interface
 *
 * All provider adapters (native-claude, anthropic-compatible, openai-compatible,
 * ollama, generic-command) must implement this interface. The extension uses this
 * contract to interact with different AI model providers uniformly.
 *
 * Adapters declare their capabilities at construction time, enabling the UI to
 * enable/disable features appropriately (FR-021).
 *
 * This file contains NO VS Code API imports - pure TypeScript types and interfaces.
 */

// ============================================================
// CAPABILITIES DECLARATION
// ============================================================

/**
 * Declares which capabilities this adapter supports.
 *
 * The UI uses these declarations to enable/disable features (e.g., streaming checkbox,
 * file editing controls, transcript retrieval options). Runtime validation ensures
 * adapters truthfully declare capabilities (FR-021).
 */
export interface AdapterCapabilities {
  /**
   * Supports streaming responses.
   *
   * If false, sendMessage should throw if options.streaming = true.
   * The UI can disable the "streaming response" setting for this profile.
   */
  streaming: boolean;

  /**
   * Supports tool/function calling.
   *
   * If false, the executeTool method is not available and the model cannot
   * request tool execution. The UI can disable tool permission settings.
   */
  tools: boolean;

  /**
   * Supports direct file editing.
   *
   * If false, the editFile method is not available. File edits must go through
   * the tool interface if supported. The UI can warn about file edit limitations.
   */
  fileEdits: boolean;

  /**
   * Supports command execution.
   *
   * If false, the executeCommand method is not available. The generic-command
   * adapter should set this to true. The UI can disable command permission settings.
   */
  commands: boolean;

  /**
   * Supports model discovery (list models).
   *
   * If false, the listModels method is not available. The UI must show a warning
   * if the model ID in the profile doesn't match known models from the provider.
   */
  modelDiscovery: boolean;

  /**
   * Supports transcript retrieval from active sessions.
   *
   * If false, the getTranscript method is not available. The handoff "full transcript"
   * mode is disabled for this provider. The UI must show the limitation and offer
   * user-mediated alternatives (export/import, summary, no-context).
   */
  transcriptObservable: boolean;
}

// ============================================================
// CONFIGURATION TYPES
// ============================================================

/**
 * Subset of ProfileConfig needed for adapter methods.
 *
 * Extracted from complete profile YAML after loading and merging. This is the
 * primary interface adapter implementations receive during validation and activation.
 */
export interface ProfileConfig {
  /** Unique profile identifier */
  id: string;

  /** Type of provider adapter (must match one of adapter implementations) */
  adapter: 'native-claude' | 'anthropic-compatible' | 'openai-compatible' | 'ollama' | 'generic-command';

  /** Model identifier */
  model: string;

  /** Base URL for HTTP-based providers (optional) */
  baseUrl?: string;

  /** Credential configuration */
  credential: {
    mode: 'none' | 'secretRef' | 'environment' | 'subscription' | 'multi-key';
    secretRef?: string | null;
    /** Multiple secret references (for multi-key authentication, e.g., Max accounts) */
    secretRefs?: string[] | null;
    /** Key rotation strategy (round-robin, weighted-random, sequential) */
    keyRotationStrategy?: 'round-robin' | 'weighted-random' | 'sequential' | null;
  };

 /** SSH tunnel configuration (optional) */
  tunnel?: {
    enabled: boolean;
    sshHostAlias?: string | null;
    localPort?: number | null;
  };

  /** Token limits (optional) */
  limits?: {
    contextTokens?: number | null;
    maxOutputTokens?: number | null;
  };

  /** Workspace permissions */
  permissions: {
    mode: 'review-only' | 'edit-only' | 'edit-and-command';
    workspacePaths?: string[];
  };

  /** Network classification for policy enforcement */
  network: {
    providerClass: 'local' | 'private-network' | 'cloud';
    supportingNetwork: 'allowed' | 'blocked';
  };

  /** Custom model instructions (optional) */
  instructions?: string | null;

  /** Environment variable references (for generic-command adapter) */
  environmentRefs?: string[];

  /** Health check endpoint (for validation) */
  healthCheck?: {
    url?: string | null;
    method?: 'GET' | 'POST' | null;
  };

  /** Read-only capability declarations (validated at runtime) */
  capabilities: Readonly<AdapterCapabilities>;
}

// ============================================================
// MESSAGE TYPES
// ============================================================

/**
 * Context for sending messages to the model.
 */
export interface MessageContext {
  /** File references to include in context */
  files?: FileReference[];

  /** Conversation history (previous turns) */
  history?: ConversationTurn[];

  /** Current workspace path (for file resolution) */
  workspacePath?: string;

  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * File reference for including in message context.
 */
export interface FileReference {
  /** File URI or absolute path */
  path: string;

  /** Optional range within file */
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };

  /** File content if already loaded (optional) */
  content?: string;
}

/**
 * A single conversation turn.
 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/**
 * Options for sendMessage.
 */
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

/**
 * Response from sendMessage.
 *
 * When streaming is requested and enabled, sendMessage returns AsyncIterable<string>
 * instead of this type.
 */
export interface MessageResponse {
  /** Generated response content */
  content: string;

  /** Tool calls requested by the model (if tools enabled) */
  toolCalls?: ToolCall[];

  /** File edits performed by the model (if file edits enabled) */
  fileEdits?: FileEdit[];

  /** Command executions requested by the model (if commands enabled) */
  commands?: CommandExecution[];

  /** Metadata about the response (tokens used, finish reason, etc.) */
  metadata?: Record<string, unknown>;

  /** Timestamp when response was generated */
  timestamp: Date;
}

// ============================================================
// TOOL TYPES
// ============================================================

/**
 * A tool/function call requested by the model or invoked by the extension.
 */
export interface ToolCall {
  /** Tool name or identifier */
  name: string;

  /** Arguments for the tool call */
  arguments: Record<string, unknown>;

  /** Call ID for streaming responses */
  id?: string;
}

/**
 * Result of tool execution.
 */
export interface ToolResult {
  /** Result of tool execution */
  result: unknown;

  /** Whether execution was successful */
  success: boolean;

  /** Error message if execution failed */
  error?: string;

  /** Metadata about execution */
  metadata?: Record<string, unknown>;
}

// ============================================================
// FILE EDIT TYPES
// ============================================================

/**
 * A file edit to apply.
 */
export interface FileEdit {
  /** File to edit (URI or path) */
  file: string;

  /** Type of edit: create, modify, delete */
  type: 'create' | 'modify' | 'delete';

  /** For type=modify or create: file content. For type=delete: omitted. */
  content?: string;

  /** Range for type=modify. For type=create or delete: omitted. */
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * Result of a file edit operation.
 */
export interface FileEditResult {
  /** File that was edited */
  file: string;

  /** Whether edit was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Diff representation (if available) */
  diff?: string;

  /** Line numbers affected */
  affectedLines?: {
    start: number;
    end: number;
  };
}

// ============================================================
// COMMAND TYPES
// ============================================================

/**
 * Command execution request.
 */
export interface CommandExecution {
  /** Command to execute (including arguments) */
  command: string;

  /** Working directory for command */
  cwd?: string;

  /** Environment variables for command (sanitized) */
  env?: Record<string, string>;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of command execution.
 */
export interface CommandResult {
  /** Exit code */
  exitCode: number;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Whether command succeeded (exit code 0) */
  success: boolean;

  /** Execution time in milliseconds */
  duration: number;
}

// ============================================================
// VALIDATION TYPES
// ============================================================

/**
 * Result of profile configuration validation.
 */
export interface ValidationResult {
  /** Whether validation passed completely */
  valid: boolean;

  /** Array of errors (blocking) */
  errors: ValidationError[];

  /** Array of warnings (non-blocking) */
  warnings: ValidationWarning[];
}

/**
 * A validation error (blocking).
 */
export interface ValidationError {
  /** Field or path with error */
  field: string;

  /** Error message */
  message: string;

  /** Suggested fix if available */
  suggestion?: string;
}

/**
 * A validation warning (non-blocking).
 */
export interface ValidationWarning {
  /** Field or path with warning */
  field: string;

  /** Warning message */
  message: string;
}

/**
 * Connection status after connect() or during operation.
 */
export interface ConnectionStatus {
  /** Whether connection is successful */
  connected: boolean;

  /** Status message */
  status: string;

  /** Diagnostics information */
  diagnostics?: Record<string, unknown>;
}

// ============================================================
// MODEL DISCOVERY TYPES
// ============================================================

/**
 * A model available from the provider.
 */
export interface AvailableModel {
  /** Model identifier */
  id: string;

  /** Human-readable model name */
  name: string;

  /** Model context token limit (optional) */
  contextTokens?: number;

  /** Max output token limit (optional) */
  maxOutputTokens?: number;

  /** Supported capabilities (optional) */
  capabilities?: Partial<AdapterCapabilities>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================
// TRANSCRIPT TYPES
// ============================================================

/**
 * Complete conversation transcript for handoff.
 *
 * The extension redacts secrets from content before storing or logging.
 * Only transcript metadata is retained in audit logs (not content).
 */
export interface Transcript {
  /** Transcript unique identifier */
  id: string;

  /** Profile ID for this session */
  profileId: string;

  /** Conversation turns (user and assistant messages) */
  turns: ConversationTurn[];

  /** File edits made during session */
  fileEdits?: FileEdit[];

  /** Commands executed during session */
  commands?: CommandExecution[];

  /** Session start timestamp */
  startTime: Date;

  /** Session end timestamp (if completed) */
  endTime?: Date;

  /** Metadata about the transcript */
  metadata?: Record<string, unknown>;
}

// ============================================================
// MAIN ADAPTER INTERFACE
// ============================================================

/**
 * Abstract Adapter Interface
 *
 * All adapters must implement these methods to provide a consistent
 * integration surface for the extension.
 *
 * This is the core contract that enables multiple provider support.
 * The profile registry, policy engine, validation modules, and handoff
 * logic all work against this interface.
 */
export interface ModelAdapter {
  // ========== Capabilities Declaration ==========

  /**
   * Declares which capabilities this adapter supports.
   *
   * Used to enable/disable UI features accordingly (FR-021).
   * This property is set during adapter construction and should be
   * treated as read-only after initialization.
   */
  capabilities: AdapterCapabilities;

  // ========== Connection & Lifecycle ==========

  /**
   * Validate that the profile configuration is valid before activation.
   *
   * Should NOT make billable API calls by default (FR-071). This method
   * should perform:
   * - Schema validation (already done before this is called)
   * - Policy compatibility checks
   * - Secret reference existence (via SecretStorage wrapper in vscode layer)
   * - Endpoint reachability (health check if configured)
   * - Capability declaration validation
   *
   * @param config - Profile configuration to validate
   * @returns Validation status with any errors or warnings
   */
  validate(config: ProfileConfig): Promise<ValidationResult>;

  /**
   * Establish connection to the model provider.
   *
   * Called during profile activation. This method should:
   * - Resolve secrets from credential.secretRef (via SecretStorage wrapper)
   * - For SSH tunnel profiles: establish tunnel connection
   * - Verify endpoint is reachable
   * - Initialize any adapter-specific state
   *
   * @param config - Profile configuration to activate
   * @returns Connection status with any diagnostics
   */
  connect(config: ProfileConfig): Promise<ConnectionStatus>;

  /**
   * Close connection and cleanup resources.
   *
   * Called during profile deactivation or extension shutdown. This method
   * should:
   * - Close any open connections
   * - Clean up SSH tunnels (if managed by adapter)
   * - Release adapter-specific state
   */
  disconnect(): Promise<void>;

  // ========== Model Discovery (Optional) ==========

  /**
   * List available models from this provider.
   *
   * Only supported if capabilities.modelDiscovery is true. The adapter
   * should throw an error if this method is called when the capability
   * is false.
   *
   * @param config - Profile configuration
   * @returns List of available models
   * @throws Error if capabilities.modelDiscovery is false
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
   *
   * Only supported if capabilities.tools is true. The adapter should
   * throw an error if this method is called when the capability is false.
   *
   * Can be called by extension or by model during sendMessage (if model
   * requests tool use via toolCalls in MessageResponse).
   *
   * @param toolCall - Tool call to execute
   * @param context - Execution context
   * @returns Result of tool execution
   * @throws Error if capabilities.tools is false
   */
  executeTool?(toolCall: ToolCall, context: MessageContext): Promise<ToolResult>;

  /**
   * Edit a file directly (model-side file editing).
   *
   * Only supported if capabilities.fileEdits is true. The adapter should
   * throw an error if this method is called when the capability is false.
   *
   * @param fileEdits - List of file edits to apply
   * @returns Results including success/failure for each edit
   * @throws Error if capabilities.fileEdits is false
   */
  editFile?(fileEdits: FileEdit[]): Promise<FileEditResult[]>;

  /**
   * Execute a shell command.
   *
   * Only supported if capabilities.commands is true. The adapter should
   * throw an error if this method is called when the capability is false.
   *
   * For generic-command adapter, this is the primary mode (sendMessage
   * may delegate to executeCommand).
   *
   * For other adapters, commands may be executed by model tools via
   * executeTool if the tool implementation calls this.
   *
   * @param command - Command execution request
   * @returns Result of command execution
   * @throws Error if capabilities.commands is false
   */
  executeCommand?(command: CommandExecution): Promise<CommandResult>;

  // ========== Transcript Retrieval (Optional) ==========

  /**
   * Retrieve the conversation transcript from this session.
   *
   * Only supported if capabilities.transcriptObservable is true. The
   * adapter should throw an error if this method is called when the
   * capability is false.
   *
   * Returns transcript with metadata. Content is returned for
   * handoff processing; extension redacts secrets before log (FR-054).
   *
   * @returns Complete conversation transcript
   * @throws Error if capabilities.transcriptObservable is false
   */
  getTranscript?(): Promise<Transcript>;
}
