# Open Questions and Discovery Spikes

## Architecture validation

1. Does a documented/public integration surface exist for another VS Code extension to control an active Claude Code panel session?
2. Can a third-party extension obtain native session transcript content through a supported route?
3. Which Claude Code settings can be isolated per session and which are global?
4. What is the supported, user-mediated export/import path for full transcript handoff if programmatic access is unavailable?
5. Can the official panel route directly to non-Anthropic-compatible/OpenAI-compatible providers, or must those use managed terminal/webview sessions?
6. Which Ollama, Anthropic-compatible, and OpenAI-compatible servers provide sufficient tool/file/command behavior for coding-agent use?

## Product decisions

1. License and distribution: private extension, open source with private configuration, or VS Code Marketplace.
2. Default retention and encryption approach for local transcript/handoff storage.
3. Whether team-visible audit export is needed beyond local troubleshooting metadata.
4. Whether a second approval workflow is needed, and how approvers are authenticated.
5. Whether Windows, WSL, dev containers, Remote SSH, and Codespaces are next-release platforms.
6. Sensitive-content detection and redaction approach, including whether an LLM may participate.
7. Whether generic-command sessions can participate in transcript/handoff workflows beyond metadata.

## Recommended first spikes

1. Build a minimal VS Code extension that detects Claude Code and documents only supported integration routes.
2. Create adapter conformance tests for Ollama, one Anthropic-compatible service, and one OpenAI-compatible service.
3. Prototype a policy decision engine that classifies direct cloud-model requests separately from supporting network traffic.
4. Prototype local transcript/handoff metadata storage, retention, export, and deletion.
5. Prototype activity-ledger, overlapping-path warning, checkpoint, and worktree workflows.
