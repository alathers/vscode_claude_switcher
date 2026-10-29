# Feature Specification: Model Cost Optimization

**Feature Branch**: `[002-model-cost-optimization]`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "I'd like to ensure we maximize the value of the claude subscription, and any other models we use as all. Also, I'd like to use the local ollama instance as needed for locally hosted models that might be able to help as well:

Separate budgets, two different products:

Claude.ai subscription (Pro/Max) — flat monthly fee, usage limits that reset on a rolling window. Covers claude.ai app, desktop/mobile, and Claude Code when you log in with your subscription.
API credits (Console) — prepaid, pay-per-token. Drawn down only when you call the API directly or run Claude Code authenticated with an API key instead of your subscription.

Nothing is shared between them. Using one doesn't reduce the other, and unused subscription allowance doesn't convert to credits.

To max value: exhaust the subscription first (already paid, effectively free marginal cost), and fall back to API credits when you hit a rate limit or need something the subscription can't do (your own scripts, automation, batch jobs). In Claude Code, /login picks which one you're billing to — check it's on the subscription for everyday work.

Exact limits and plan details change; current specifics are at https://support.claude.com (subscription) and https://docs.claude.com (API)."

## Clarifications

### Session 2026-10-28

- Q: How long should routing decision records be retained for historical analysis? → A: 30 days of detailed records, then monthly rollup summaries
- Q: How should the system determine which requests are suitable for Ollama routing? → A: Hybrid: user configures mappings for known types, automatic detection for everything else; automatically fails over to local models when Claude is over budget
- Q: How frequently should subscription quota data be refreshed to support multiple sessions? → A: Check quota on every request for session consistency
- Q: How should the extension integrate with the existing Harvey router layer for Ollama routing? → A: Call Harvey as a separate local HTTP service
- Q: What's the acceptable added latency per request from quota checking? → A: Under 200ms maximum added latency

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Model Cost Preferences (Priority: P1)

A developer wants to set up cost-optimized routing for their LLM usage, preferring their already-paid Claude subscription first, falling back to API credits when subscription limits are reached, and using local Ollama models for suitable tasks.

**Why this priority**: This is the foundational capability that enables all other cost optimization features. Without configuration, no cost decisions can be made.

**Independent Test**: Can be fully tested by setting preferences in the extension configuration and verifying they are persisted and read correctly, without requiring any actual model calls or external dependencies.

**Acceptance Scenarios**:

1. **Given** the user has Claude Code installed, **when** they open extension settings, **then** they see configuration options for model priority preferences
2. **Given** the user wants to prioritize their Claude subscription, **when** they set the routing preference to "subscription-first", **then** the system routes requests to the subscription endpoint until limits are reached
3. **Given** the user has set up API credits as fallback, **when** subscription limits are reached, **then** the system automatically routes requests to API credits without user intervention
4. **Given** the user wants to use local Ollama, **when** they set the Ollama base URL, **then** the system can route suitable tasks to local models

---

### User Story 2 - Monitor Usage and Track Limits (Priority: P2)

A developer wants visibility into their current Claude subscription usage to ensure they're maximizing their paid subscription before falling back to API credits.

**Why this priority**: Users need visibility to trust the optimization is working and to make informed decisions about their usage patterns.

**Independent Test**: Can be tested by displaying usage statistics in a status bar item or view panel, with mock data simulating various usage states.

**Acceptance Scenarios**:

1. **Given** the user has completed model requests via their subscription, **when** they view usage information, **then** they see current usage and remaining allowance for their subscription tier
2. **Given** the user is approaching their subscription limit, **when** usage reaches a configurable threshold, **then** the system notifies the user and prepares to switch to API credits
3. **Given** the subscription limit is reached, **when** the next request is made, **then** the system automatically routes to API credits and displays this routing decision

---

### User Story 3 - Automatic Failover to API Credits (Priority: P2)

A developer wants uninterrupted service when their subscription limits are reached, with automatic fallback to API credits.

**Why this priority**: Maintains workflow continuity when subscription limits are temporarily exhausted, leveraging prepaid credits.

**Independent Test**: Can be tested by simulating subscription limit conditions and verifying requests are rerouted to API credits with proper error handling and user notification.

**Acceptance Scenarios**:

1. **Given** the user has exhausted their subscription quota, **when** they initiate a model request, **then** the request is sent to the API credits endpoint and returns results successfully
2. **Given** the system has switched to API credits, **when** a notification is displayed, **then** the notification clearly indicates the routing change and the reason
3. **Given** the subscription resets after the rolling window, **when** the new cycle begins, **then** the system resumes routing to the subscription

---

### User Story 4 - Use Local Ollama for Suitable Tasks (Priority: P3)

A developer wants to use their local Ollama instance for tasks where model capabilities are sufficient, saving quota for requests that require Claude's capabilities.

**Why this priority**: Provides additional cost savings by leveraging free local compute when appropriate, particularly valuable for high-volume, lower-complexity tasks.

**Independent Test**: Can be tested by configuring a task type to use Ollama and verifying the request is routed to the local instance and handled correctly.

**Acceptance Scenarios**:

1. **Given** the user has configured a local Ollama instance and it is reachable, **when** a request is initiated for a suitable task type, **then** the request is routed to Ollama and returns results
2. **Given** the request payload indicates capabilities beyond local models, **when** the request is initiated, **then** the system routes to Claude instead of Ollama
3. **Given** the Ollama endpoint is unreachable or returns connection errors, **when** a local-routed request is made, **then** the system fails over to Claude and notifies the user
4. **Given** both Claude subscription and API credits are exhausted, **when** a request is made, **then** the system automatically routes to local Ollama if suitable for the task type

---

### Edge Cases

- What happens when both subscription and API credits are exhausted?
- How does the system handle rate limit errors from the subscription that temporarily block requests (vs. quota exhaustion)?
- What happens when both Claude is exhausted and Ollama is unavailable simultaneously?
- How does the system behave when the user changes preferences mid-session?
- What if subscription quota tracking data becomes unavailable or inaccurate?
- How does the system handle API credit balance queries that fail?
- What if the user has multiple Claude Code sessions running simultaneously? (Resolved: Quota checked on every request for consistency)
- How does hybrid routing (user config + auto detection) behave when configured mappings conflict with automatic detection?
- How does the system handle when the Harvey HTTP service is unreachable or returns errors?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide configuration options for model routing preferences (subscription, API credits, local Ollama)
- **FR-002**: System MUST respect user-specified routing priority preferences and route requests accordingly
- **FR-003**: System MUST track Claude subscription usage against the current plan's rolling window limits by checking quota on every request to ensure consistency across multiple simultaneous Claude Code sessions
- **FR-004**: System MUST display current subscription usage and remaining allowance to users
- **FR-005**: System MUST automatically failover from subscription to API credits when subscription limits are reached
- **FR-006**: System MUST notify users when routing changes from subscription to API credits occurs
- **FR-007**: System MUST route suitable tasks to local Ollama by calling Harvey as a separate local HTTP service when configured and available
- **FR-008**: System MUST provide options for users to manually override automatic routing decisions
- **FR-009**: System MUST persist routing configuration in user settings and reload it on extension startup
- **FR-010**: System MUST configure Ollama connection via user-provided base URL
- **FR-011**: System MUST handle connection failures and errors from Ollama gracefully with fallback
- **FR-012**: System MUST determine request suitability for local Ollama models using a hybrid approach: user-configured task type mappings for known use cases, automatic detection for others, with automatic fallback to local models when Claude budgets (subscription and API credits) are exhausted
- **FR-013**: System MUST verify Ollama endpoint connectivity and configuration validity (reachable base URL, required models available) before routing requests

### Key Entities *(include if feature involves data)*

- **Routing Configuration**: Stores user preferences for model priority and fallback behavior, including primary model sources, thresholds, and task type mappings
- **Usage Tracking**: Records subscription usage data including current consumption, remaining quota, and rolling window details
- **Ollama Settings**: Stores local Ollama instance connection parameters and availability status
- **Routing Decision**: Captures metadata about why a specific request was routed to a particular model source for transparency; retains detailed records for 30 days, then maintains monthly rollup summaries for historical cost analysis

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure model routing preferences in under 2 minutes through VS Code settings
- **SC-002**: System achieves 95% uptime for model requests during subscription quota transitions (subscription → API credits)
- **SC-003**: Routing decisions automatically adapt within 1 second when subscription limits are reached, with quota checking added latency under 200ms per request
- **SC-004**: 90% of users report satisfaction that subscription usage is maximized before API credits are consumed
- **SC-005**: Local Ollama usage reduces subscription/API credit costs by at least 30% for configured task types

## Assumptions

- Users have a Claude.ai subscription (Pro or Max) that they want to maximize for cost efficiency
- Users understand the difference between subscription usage and API credits pricing models
- Subscription plan details and rate limits can be retrieved from Claude's public documentation or APIs
- Ollama is already set up and running locally for users who want to use it
- The extension can make network requests to track subscription usage (through official APIs or user-provided endpoints)
- Users primarily interact through the VS Code extension interface, not directly through API calls
- Task complexity/type determination can be made sufficiently accurate to route appropriate requests to Ollama

### External Dependencies

- **Harvey Router**: An existing Ollama router layer that runs as a separate local HTTP service and handles routing decisions between Claude and local Ollama models based on task requirements
- **Hermes**: Custom model configuration system referenced for understanding available local model options and capabilities

### Performance Requirements

- Quota checking operations must complete in under 200ms to ensure routing decisions adapt within 1-second target when subscription limits change
