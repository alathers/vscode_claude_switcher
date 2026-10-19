# Workflows

## Select a profile

1. Developer opens a trusted workspace.
2. The extension loads repository policy/templates, local user profiles, secret references, and runtime overrides.
3. The developer selects a workspace default profile or per-conversation override.
4. The extension runs non-billable preflight validation.
5. The UI shows provider, model, trust zone, available capabilities, and detected configuration conflicts.
6. The selected profile becomes active for eligible new sessions without restarting VS Code.

## Switch a conversation

1. The developer selects another profile.
2. If the current agent is active, the extension prompts to wait, cancel and switch, or retain the existing session in the background.
3. The extension evaluates source and destination trust zones.
4. The developer chooses full transcript, reviewed summary, or no context.
5. A summary defaults to excluding code and sensitive data; the developer reviews allowed fields.
6. The extension uses the best available destination:
   - Direct native/in-panel switch if supported.
   - New Claude Code panel session with handoff.
   - Configuration-guided native session.
   - Managed terminal session.
   - Extension webview session.
7. The extension records local metadata about the handoff without retaining unapproved transferred content.

## Guarded and strict modes

1. A workspace is set to unrestricted, guarded, or strict mode.
2. Before a managed request is routed to a cloud model, policy checks the destination classification and proposed handoff payload.
3. Guarded mode requires explicit approval.
4. Strict mode blocks the request until the workspace policy changes.
5. Supporting network traffic remains allowed unless separate policy restricts it.
6. Policy changes may require confirmation, reason capture, timeout-based reversion, or second approval.

## Concurrent agents

1. A developer starts one or more sessions.
2. The activity ledger displays profile, state, known files, known commands, and recent workspace changes.
3. Before a mutation, the extension warns about overlapping paths or recent conflicting activity.
4. Workspace policy may allow concurrent mutation, require an exclusive writer, use an isolated worktree, enforce review-only mode, or create a checkpoint.
5. The extension does not claim to safely merge competing edits automatically.

## Profile validation

1. The developer creates or edits a profile.
2. Validation checks schema, policy, secret reference, endpoint/tunnel reachability, and declared capabilities without sending billable prompts by default.
3. Optional deeper validation requires affirmative approval and identifies potential cost and data egress.
4. Diagnostic output redacts secrets and identifies routing/precedence conflicts.
