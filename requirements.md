# Requirements

## Profile management

- FR-001: The extension shall support user-level profiles, repository-committed non-secret profile templates, workspace policy, and runtime session overrides.
- FR-002: A workspace shall have a default profile; each conversation/session may override it.
- FR-003: A profile shall support provider/protocol adapter, base URL, model ID, credential reference, SSH tunnel definition, context/output limits, tool permissions, privacy classification, network allowlist, environment-variable references, model instructions, path restrictions, health check, and capability declaration.
- FR-004: Not-applicable fields shall use typed semantics such as omitted, `null`, or `enabled: false`. Empty strings shall only be accepted where an adapter explicitly defines their meaning.
- FR-005: Repository templates may contain endpoint/model/protocol details, SSH host aliases, privacy rules, and model-provider allowlists, but never secret values, passwords, access tokens, private keys, or personal connection strings.

## Credentials

- FR-010: Native Claude subscription profiles shall use the official Claude Code login already established on the developer’s machine.
- FR-011: The extension shall never read, store, relay, proxy, or log Claude subscription credentials.
- FR-012: API-key and local-server secret values shall use VS Code Secret Storage or a declared environment-variable reference.
- FR-013: SSH profiles shall use `~/.ssh/config`, SSH-agent support, and OS-managed keys.
- FR-014: Workspace configuration, including `.vscode` files, shall never contain secrets.

## Endpoint adapters

- FR-020: Version one shall support native Claude Code subscription, Anthropic-compatible, OpenAI-compatible, Ollama, generic command, and reusable SSH-tunnel transport.
- FR-021: Each adapter shall declare streaming, tool use, file-edit, command-execution, model-discovery, and transcript-observability capabilities.
- FR-022: Unsupported capabilities shall be disabled or prominently warned about rather than assumed.
- FR-023: Generic command profiles shall run with a sanitized profile-specific environment.

## Session and UI behavior

- FR-030: Users shall select a workspace default profile through a visible selector and override it per conversation.
- FR-031: Switching profiles shall not require restarting VS Code.
- FR-032: The extension shall attempt in-panel/native switching only where a documented or validated integration proves it safe.
- FR-033: When direct official-panel control is unavailable, the extension shall progressively offer: new panel session with handoff, configuration-guided new session, then terminal or webview fallback.
- FR-034: The UI shall disclose the integration mode and fallback currently in use.
- FR-035: Profiles shall display provider, resolved model, trust zone, and configurable cost, latency, availability, and identity-mismatch indicators.

## Privacy and routing

- FR-040: The policy engine shall distinguish model-provider traffic from supporting network traffic.
- FR-041: Guarded mode shall block direct cloud-model requests unless the user explicitly approves the request or destination.
- FR-042: Strict mode shall block direct cloud-model requests and cloud-bound handoffs until workspace policy changes.
- FR-043: Supporting traffic, including web research, source control, package/documentation access, and other approved traffic, shall remain allowed by default unless separately restricted.
- FR-044: The extension shall state that enforcement applies only to extension-managed requests and sessions.
- FR-045: Policy changes shall support configurable confirmation, reason capture, timed reversion, and optional second approval. Confirmation is the default.

## Handoff and transcripts

- FR-050: At a provider boundary, the extension shall offer full transcript, reviewed summary, and no-context handoff choices.
- FR-051: Default summaries shall exclude code and sensitive data.
- FR-052: Summary generation shall support source-model generation and a locally configured summarizer; a deterministic local outline shall be available as a fallback.
- FR-053: Policy shall configure whether summaries may include tool calls/results, paths, code snippets, diffs, command output, attachments, and sensitive-content redaction.
- FR-054: The extension shall retain local cross-profile handoff metadata according to configured retention settings.
- FR-055: If native panel transcript access is unavailable, the UI shall identify the limitation and offer user-mediated export/import or user-supplied summary options.
- FR-056: Users shall be able to delete a conversation or handoff packet, set retention, and manually export a sanitized handoff package.

## Concurrent agents

- FR-060: Multiple agents shall be allowed concurrently by default.
- FR-061: The extension shall display an activity ledger showing profile, state, intended paths/commands where known, and recent changes.
- FR-062: Potentially conflicting edits or commands shall warn without blocking by default.
- FR-063: Workspace policy shall support exclusive-writer mode, profile-level command denial, review-only mode, optional worktree isolation, and automatic pre-edit checkpoints.

## Validation and diagnostics

- FR-070: Adding or editing a profile shall support automatic and on-demand validation.
- FR-071: Default validation shall avoid billable model calls and test configuration, secret-reference existence, endpoint reachability, SSH tunnel lifecycle, policy compatibility, and declared capabilities.
- FR-072: Prompt, tool, or agent tests that may incur charges require explicit authorization.
- FR-073: Diagnostics shall detect conflicting inherited endpoint/authentication configuration and redact all secret values.

## Delivery and audit

- FR-080: Version one shall support macOS and Linux.
- FR-081: Provide installation, upgrade, diagnostics, team-template/policy setup, and uninstall documentation.
- FR-082: Optional Python and Bash helpers shall preview changes and require confirmation before modifying files.
- FR-083: Local audit metadata shall record profile selections, policy decisions, handoff mode, validation result, and session lifecycle, but never prompts, transcript content, source code, tokens, or raw secrets.
