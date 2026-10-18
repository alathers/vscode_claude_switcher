
## `technical-context.md`

```md
# Technical Context

## Platforms

- VS Code extension.
- macOS and Linux in version one.
- Official Claude Code VS Code panel is the priority integration.
- Managed terminal and extension webview are fallback session surfaces.
- Optional companion Python and Bash tools support setup, diagnosis, policy/template installation, and uninstall.

## Integration constraints

- Treat third-party control over the active Claude Code panel session as unverified until a documented/public integration surface is validated.
- Preserve native Claude Code subscription authentication; never access its stored credentials.
- Isolate routing/configuration by profile/session. Do not use repeated global-settings rewrites as the switching mechanism.
- Use VS Code Secret Storage for extension-owned secrets and symbolic references in configuration.
- Use SSH configuration aliases and SSH-agent-managed keys rather than private keys in profiles.
- Respect VS Code Workspace Trust and disable execution-capable behaviors in untrusted workspaces.

## Adapter contract

Each adapter must provide:

- Schema validation.
- Non-billable health validation.
- Capability declaration and compatibility result.
- Model identity resolution where available.
- Session launch or routing strategy.
- Sanitized environment construction.
- Transcript observability declaration.
- Trust-zone and policy classification.

## Validation model

Default non-billable checks:

- Profile schema and policy validation.
- Secret-reference availability, without displaying secret values.
- Endpoint reachability and safe health endpoints.
- SSH-tunnel startup/readiness/lifecycle checks.
- Model metadata where available without an inference prompt.
- Routing and inherited-config conflict detection.

Explicitly authorized checks may:

- Send a small prompt.
- Test streaming.
- Test tool invocation.
- Test file editing or command capability.

The UI must disclose potential charges and data egress before these tests.

## Security boundary

The extension can control only requests, processes, and sessions that it launches or manages. It cannot stop unrelated processes, extensions, browsers, model servers, or user shells from making network requests.

Supporting network access remains allowed by default. Policy specifically governs direct cloud-model egress and cloud-bound handoff content.
