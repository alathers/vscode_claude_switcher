# VS Code Model Profile Orchestrator

## Purpose

Build a VS Code extension for a small trusted team that dynamically selects and coordinates AI coding-agent model profiles while VS Code remains open.

The primary user experience is the official Claude Code VS Code panel. Integrated-terminal, profile-managed CLI, and extension-webview sessions are secondary fallbacks. A profile may use a native Claude Code subscription, a local model, an SSH-tunneled model, a remote HTTPS endpoint, or a configured command adapter.

The product must make switching feel as close as possible to changing models in one conversation while preserving explicit privacy boundaries, reliable endpoint isolation, and user control over context transfer.

## Users

- Developers working in a shared repository with local, private-network, and cloud model providers.
- A small trusted team sharing non-secret templates and workspace policy, while each developer retains their own credentials.

## Success statement

The first release is successful when a small team can select and switch among approved local, private, and cloud coding-agent profiles during an open VS Code session, continue work through an explicit handoff workflow, and prevent unintended direct disclosure of workspace data to cloud model providers.

## Product principles

1. Native-first: preserve the official Claude Code panel as the primary experience wherever supported.
2. No credential interception: never read, store, proxy, or expose Claude subscription credentials.
3. Local control: profiles, privacy policy, and handoff content are visible and explainable.
4. Least disclosure: default handoff summaries omit code and sensitive data.
5. Provider isolation: each managed session has profile-specific routing and credential resolution.
6. Concurrent by default: multiple agents may work simultaneously, with transparent activity and conflict safeguards.
7. Policy scope is explicit: state that extension policy applies only to managed sessions and requests.

## In scope

- Dynamic profile selection without restarting VS Code.
- Workspace default profile plus per-conversation override.
- User profiles, repository-shared non-secret templates, workspace policy, and temporary runtime overrides.
- Native Claude Code subscription, Anthropic-compatible, OpenAI-compatible, Ollama, generic command, remote HTTPS, and SSH-tunneled profiles.
- Capability checks that avoid billable model calls by default.
- Guarded and strict cloud-model egress policies.
- Full transcript, reviewed-summary, and no-context handoff choices.
- Native-first UI with progressive fallback when official-panel control is unavailable.
- Concurrent-agent activity tracking, warnings, optional exclusive-writer rules, worktree isolation, and automatic checkpoints.
- macOS and Linux installation, validation, and removal documentation/tools.

## Out of scope

- Replacing Claude Code with a custom coding-agent chat UI.
- Reading, altering, or proxying private credentials owned by Claude Code or another provider client.
- A mandatory shared secrets service or cloud control plane.
- A custom third-party provider SDK in the first release.
- Guaranteeing arbitrary compatible HTTP endpoints support coding-agent tools.

## Key product decision

A profile switch supports three handoff choices:

- Full transcript.
- Reviewed summary.
- No context.

The extension should make full transcript handoff available where the source session is observable through a supported adapter or native integration. If the official Claude Code panel does not expose a supported way to retrieve a live transcript or alter a live session, the extension must present the limitation and offer a safe fallback: a new native session, user-mediated export/import, a reviewed summary, an integrated-terminal session, or an extension-managed webview session.
