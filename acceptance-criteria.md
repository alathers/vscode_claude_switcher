# Acceptance Criteria

## Profiles

- Given a trusted workspace with an allowed template and user overlay, when a developer selects it, VS Code remains open and the resolved provider, model, trust zone, and capability state are shown.
- Given a missing secret reference, when a profile is selected, launch is blocked with a redacted and actionable diagnostic.
- Given a repository template, no secret value can be added through the template schema or generated workspace files.

## Privacy

- Given strict mode, when a managed session attempts direct cloud-model routing, the extension blocks the request before transmitting model input or handoff payload.
- Given guarded mode, when a managed session targets a cloud model, the extension requires explicit approval before dispatch.
- Given guarded or strict mode, allowed supporting-network operations are not blocked merely because they use the network.
- Given a summary handoff under default policy, code and sensitive data are excluded unless the developer explicitly approves inclusion.

## Handoff

- Given an observable source transcript, when full handoff is selected, only the approved destination receives the transcript and the audit record contains metadata but not transcript text.
- Given a native source with no supported transcript API, when a handoff is requested, the UI states that limitation and presents supported user-mediated alternatives.
- Given a no-context handoff, no transcript or summary payload is sent to the destination.

## Concurrent agents

- Given two sessions that indicate overlapping edits, when either begins a mutation, the extension displays conflict warning and activity information.
- Given an exclusive-writer workspace policy, when another session tries a mutation, it is blocked or made read-only according to policy.
- Given checkpoint-before-mutation is enabled, a configured checkpoint is created before an eligible agent modifies the workspace.

## Validation

- Given a newly created profile, default validation makes no inference request that could incur a model charge or send workspace content.
- Given explicit authorization for deeper validation, the UI identifies the potential cost and destination before the request occurs.

## Installation and removal

- Given macOS or Linux, installation helpers preview all changes and require confirmation before writing files.
- Given uninstall, the tool removes only selected extension-managed artifacts and does not delete unrelated SSH configuration, provider credentials, or global Claude Code settings.
