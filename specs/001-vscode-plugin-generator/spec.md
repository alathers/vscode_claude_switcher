# Feature Specification: VS Code Claude Model Rotator

**Feature Branch**: `(to be determined)`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Simplified model rotator plugin that accepts URLs and auth tokens, manages Claude API connections, and provides seamless rotation between different endpoints without external routing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure model endpoints (Priority: P1)

Developers need to configure one or more Claude API endpoints (URL + auth token) to use their subscription allocation directly.

**Why this priority**: This is the core configuration step - without endpoints configured, the plugin has no function. It enables the primary value proposition of using models without external routing.

**Independent Test**: A developer opens VS Code config, adds one or more Claude endpoint URLs with auth tokens, and sees them listed as available. This demonstrates the core value independently of rotation or session management.

**Acceptance Scenarios**:

1. **Given** no configured endpoints, **when** the developer adds a Claude API URL (e.g., `https://api.anthropic.com`), auth token, and available models (e.g., `claude-sonnet-5-5` with alias "Sonnet 5.5"), **then** the endpoint is saved and listed as available.
2. **Given** a SSH-forwarded tunnel to localhost, **when** the developer adds a localhost URL (`http://localhost:11434`), no auth token, and models for Ollama (e.g., `llama3:latest` with alias "Llama 3"), **then** the endpoint is saved and listed as available without requiring auth.
3. **Given** multiple endpoints configured, **when** the developer views the endpoint list, **then** all configured endpoints are shown with their URL, auth status, and available models with their aliases.

---

### User Story 2 - Select active model endpoint with reload (Priority: P1)

Developers need to select which configured endpoint should receive Claude API calls and have the VS Code Claude Code interface reload/reconnect to use the new endpoint without manual restart.

**Why this priority**: Endpoint selection with reload is the core user action - without it, the plugin cannot route calls. This couples configuration with runtime behavior and requires managing the interface between VS Code's Claude Code panel and custom endpoints.

**Independent Test**: A developer with multiple endpoints configured selects one as active, the existing VS Code Claude Code panel reloads and reconnects to the new endpoint, and subsequent Claude API calls route to that endpoint. This demonstrates routing and reload works independently of persistence or UI polish.

**Acceptance Scenarios**:

1. **Given** multiple configured endpoints, **when** the developer selects endpoint A as active, **then** Claude API calls route to endpoint A and the VS Code Claude Code panel reloads to use endpoint A.
2. **Given** endpoint A is active with an open Claude Code panel, **when** the developer switches to endpoint B, **then** the panel reloads and reconnects to endpoint B, and all new Claude API calls route to endpoint B.
3. **Given** endpoint configuration changes (auth token updated or models changed), **when** the endpoint is active, **then** the panel reloads and the change takes effect immediately for subsequent calls.
4. **Given** an active Claude Code session in progress, **when** the developer switches endpoints, **then** the plugin prompts to: (1) continue the session with the new endpoint (reload panel), (2) keep the session as-is (switch applies to next session), or (3) start a new session with the new endpoint.

---

### User Story 3 - View endpoint status and connectivity (Priority: P2)

Developers need to see which endpoint is active and verify connectivity without making API calls that consume quota.

**Why this priority**: Visibility improves user experience by confirming configuration works and helping diagnose issues. This prioritizes visibility over blocking behavior.

**Independent Test**: A developer views the status bar showing the active endpoint and clicks to see all configured endpoints with their connectivity status (connected, untested, unreachable). This validates the status display independently of routing or switching features.

**Acceptance Scenarios**:

1. **Given** an active endpoint, **when** the developer views the status bar, **then** the active endpoint is displayed.
2. **Given** multiple configured endpoints, **when** the developer opens the endpoint picker, **then** all endpoints are shown with their URL, connectivity status, and available models with aliases.
3. **Given** an unreachable endpoint, **when** the developer attempts to activate it, **then** a warning is shown but activation proceeds.

---

## Edge Cases

- What happens when an endpoint URL is invalid? → The endpoint is saved but marked as unreachable; connectivity checks fail gracefully with clear diagnostics.
- How does the system handle missing auth tokens? → Endpoints requiring auth are marked as "missing token" and cannot be activated until token is provided.
- What occurs when an endpoint becomes unreachable during active use? → API calls fail; the user can switch endpoints; the plugin continues operation once a working endpoint is active again.
- How does the system handle concurrent sessions? → All Claude API calls use the globally active endpoint; per-session overrides are not supported (simplified scope).
- What happens if all endpoints are unreachable? → The plugin displays a global error state and prompts the user to configure or fix endpoints.
- What happens when panel reload fails after endpoint switch? → Configuration is updated but panel may remain using old endpoint; user is prompted to manually restart the panel or retry the reload operation.
- How does the system handle a panel that cannot be programmatically restarted? → The plugin updates configuration files and instructs the user to manually close and reopen the Claude Code panel with clear instructions.
- What occurs when an endpoint switch is triggered during an active Claude Code request? → The in-flight request completes on the old endpoint; subsequent new requests use the new endpoint; no request is interrupted mid-stream.
- How does the system handle Claude Code configuration file conflicts? → The plugin detects conflicts (e.g., manual edits by user) and offers to overwrite, merge, or abort the operation with clear conflict resolution options.
- What happens if the Claude Code panel is closed when an endpoint is switched? → The configuration is updated immediately; when the user reopens the panel, it will use the new endpoint.
- How does the system handle auth token rotation on the active endpoint? → The token is updated in SecretStorage, and the user is prompted to reload the panel to apply the new credentials; optionally, the plugin can offer automatic reload for this credential refresh scenario.

## Requirements *(mandatory)*

### Functional Requirements

#### Endpoint Configuration

- **FR-001**: The plugin MUST accept a list of Claude API endpoints, each containing a URL, optional auth token, and one or more models
- **FR-002**: Endpoint URLs MUST support any valid HTTP/HTTPS URL (including localhost for SSH tunnels)
- **FR-003**: Auth tokens MUST be stored securely using VS Code SecretStorage
- **FR-004**: Endpoint configuration MUST be persisted across VS Code restarts
- **FR-005**: Users MUST be able to add, edit, and remove endpoints through the plugin UI
- **FR-006**: Each model MUST have a canonical name (e.g., `claude-sonnet-5-5`) and an optional alias (e.g., "Sonnet 5.5")
- **FR-007**: Models MUST be scoped to endpoints (different endpoints may have different models)

#### Endpoint Selection and Routing

- **FR-010**: Users MUST be able to select which configured endpoint is active
- **FR-011**: Switching active endpoints MUST reload the VS Code Claude Code panel to use the new endpoint
- **FR-012**: All Claude API calls from VS Code MUST route to the active endpoint
- **FR-013**: Endpoint selection MUST take effect immediately for subsequent API calls
- **FR-014**: The plugin MUST display the currently active endpoint in the status bar
- **FR-015**: When an endpoint is switched while a Claude Code session is active, the plugin MUST prompt the user to: continue session with reload, keep session as-is, or start new session
- **FR-016**: The plugin MUST handle the interface between VS Code's Claude Code infrastructure and custom endpoints, ensuring API calls are properly routed
- **FR-017**: Endpoints MUST support Claude API v1 messages endpoint (`/v1/messages`) with streaming and tool use capabilities

#### Connectivity and Status

- **FR-020**: The plugin MUST perform basic connectivity checks on configured endpoints
- **FR-021**: Connectivity checks MUST NOT consume API quota (use lightweight endpoints like /health or /status if available)
- **FR-022**: Endpoint status MUST be displayed as: connected, untested, or unreachable
- **FR-023**: The plugin MUST retry automatic connectivity checks after configuration changes
- **FR-024**: Users MUST be able to manually trigger connectivity checks

#### Error Handling

- **FR-030**: API call failures MUST surface with clear error messages indicating the endpoint
- **FR-031**: The plugin must handle network errors gracefully without crashing
- **FR-032**: When the active endpoint is unreachable, the plugin MUST prompt the user to switch endpoints
- **FR-033**: Invalid endpoint URLs MUST be rejected during configuration

#### Configuration Management

- **FR-040**: Endpoint configuration MUST be external to the plugin (user provides URLs and tokens)
- **FR-045**: The plugin MUST provide a simple configuration interface (not automated/discovered)
- **FR-046**: Configuration MUST support both authenticated and unauthenticated endpoints
- **FR-047**: Auth tokens MUST be optional (for endpoints that don't require them)

### Non-Functional Requirements

- **NFR-001**: Endpoint switching MUST take effect within 1 second
- **NFR-002**: Status bar updates MUST reflect current endpoint accurately
- **NFR-003**: The plugin MUST support macOS and Linux
- **NFR-004**: Secret storage MUST use VS Code's secure secret management

### Key Entities

- **Endpoint**: Represents a Claude API connection point with URL, optional auth token, connectivity status, and one or more available models
- **Model**: Represents a specific AI model available at an endpoint, with a canonical name and optional display alias
- **Active Endpoint**: The currently selected endpoint receiving all Claude API calls
- **Connectivity Status**: The health state of an endpoint (connected, untested, unreachable)

## Success Criteria *(mandatory)*

1. **Endpoint Configuration Completeness**: Developers can configure one or more Claude API endpoints with URLs, optional auth tokens, and available models (with canonical names and optional aliases) through the plugin UI

2. **Endpoint Switching Success**: Developers can switch between active endpoints without restarting VS Code, with the new endpoint immediately receiving subsequent API calls

3. **Subscription Allocation Usage**: Developers can use their subscription allocation directly by configuring official Claude API endpoints without external routing

4. **Status Visibility**: Developers can see the currently active endpoint and the connectivity status of all configured endpoints through the status bar and endpoint picker

5. **Case Coverage**: The plugin handles configuration errors (invalid URLs), runtime errors (unreachable endpoints), and connectivity failures with clear, actionable error messages

## Assumptions

- The plugin manages routing by modifying Claude Code configuration files and triggering panel reloads when endpoints change, rather than implementing a full network-level proxy
- The plugin discovers and modifies Claude Code configuration files (settings.json, user preferences) to direct the Claude Code panel to use the specified endpoint URL
- Auth tokens are injected into Claude Code configuration via environment variables or secure credential mechanisms when the panel reloads
- Panel reload is achieved by closing and reopening the Claude Code webview or panel with updated configuration
- Session continuity during reload is preserved by Claude Code's own mechanisms; the plugin only changes the endpoint, not the conversation state
- The plugin handles the complexity of timing configuration updates before panel reload to avoid race conditions or invalid states
- Auth tokens follow the standard Claude API authentication model (Bearer token in Authorization header or API key header based on endpoint requirements)
- Connectivity checks will use minimal HTTP requests that don't consume API quota
- Users understand that all VS Code Claude API calls share the same active endpoint (no per-session routing)
- The plugin provides graceful degradation if panel reload fails: configuration is updated but user may need to manually restart the panel
