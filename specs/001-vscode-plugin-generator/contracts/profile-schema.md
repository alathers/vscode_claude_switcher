# Profile Schema Contract

**Project**: VS Code Model Profile Orchestrator
**Version**: 1.0
**Date**: 2026-10-17
**Purpose**: YAML schema for Profile, ProfileTemplate, and WorkspacePolicy entities

## Overview

This document defines the JSON Schema for validating Profile, ProfileTemplate, and WorkspacePolicy YAML files. The schema enforces type safety, required fields, validation rules, and prevents secrets from being stored in repository-committed templates.

All schema versions start at 1.0 and increment according to semantic versioning:
- **MAJOR**: Previously valid schemas become invalid (breaking change)
- **MINOR**: New optional fields added (backward compatible)
- **PATCH**: Fixes, clarifications, tweaks (no structural change)

## Schema Version 1.0

### Common Fields

All entities share these common fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `schemaVersion` | number | Yes | - | Schema version, must be 1 |
| `$schema` | string | No | - | URI to this schema for validation tools |

### Profile Schema

```yaml
$schema: https://example.com/schemas/profile-1.0.json
schemaVersion: 1

# REQUIRED: Profile identifiers
id: string                      # Pattern: ^[a-z0-9-]+$
label: string                   # Non-empty

# REQUIRED: Adapter configuration
adapter: enum                   # [native-claude, anthropic-compatible, openai-compatible, ollama, generic-command]
model: string                   # Non-empty

# OPTIONAL: Endpoint configuration
baseUrl: string | null          # Valid URL format if provided

# REQUIRED: Credential configuration
credential:
  mode: enum                    # [none, secretRef, environment, subscription]
  secretRef: string | null      # Required only if mode=secretRef

# OPTIONAL: SSH tunnel configuration
tunnel:
  enabled: boolean
  sshHostAlias: string | null   # Required if enabled=true
  localPort: number | null      # 1-65535 if enabled=true

# OPTIONAL: Usage limits
limits:
  contextTokens: number | null   # > 0 if provided
  maxOutputTokens: number | null # > 0 if provided

# REQUIRED: Permissions
permissions:
  mode: enum                    # [review-only, edit-only, edit-and-command]
  workspacePaths: string[]      # Path restrictions

# REQUIRED: Network classification
network:
  providerClass: enum           # [local, private-network, cloud]
  supportingNetwork: enum      # [allowed, blocked]

# OPTIONAL: Model instructions
instructions: string | null

# OPTIONAL: Environment variable references
environmentRefs: string[]       # Variable names

# OPTIONAL: Health check
healthCheck:
  url: string | null            # URL path if provided
  method: enum | null           # [GET, POST] if provided

# REQUIRED: Capabilities declaration
capabilities:
  streaming: boolean
  tools: boolean
  fileEdits: boolean
  commands: boolean
  modelDiscovery: boolean
  transcriptObservable: boolean
```

### Profile Template Schema

Same as Profile schema, with additional constraints:

```yaml
$schema: https://example.com/schemas/profile-template-1.0.json
schemaVersion: 1

# Same fields as Profile

# CONSTRAINT: credential.secretRef MUST be null or omitted
credential:
  mode: enum
  secretRef: null               # MUST be null in templates
```

### Workspace Policy Schema

```yaml
$schema: https://example.com/schemas/workspace-policy-1.0.json
schemaVersion: 1

# REQUIRED: Privacy configuration
privacy:
  mode: enum                    # [unrestricted, guarded, strict]

  cloudModelRequests:
    default: enum                # [require-confirmation, block, allow]

  handoff:
    allowedModes: enum[]        # Subset of: [full, summary, none]
    defaultMode: enum           # One of allowedModes
    summaryDefault:
      includeCode: boolean
      includeSensitiveData: boolean
      includeToolOutput: boolean
      includeDiffs: boolean
      includeCommandOutput: boolean
      includePaths: boolean

  policyChanges:
    requireConfirmation: boolean
    requireReason: boolean
    revertAfterMinutes: number | null # > 0 if provided
    requireSecondApprover: boolean

# REQUIRED: Concurrency configuration
concurrency:
  default: enum                  # [concurrent, exclusive-writer]
  conflictAction: enum           # [warn, block]
  supportsWorktrees: boolean
  checkpointBeforeMutation: boolean

# REQUIRED: Profile governance
profiles:
  allowedTemplateIds: string[]   # Template IDs
```

## Enum Values

### Adapter Types

- `native-claude`: Claude Code CLI + config manipulation
- `anthropic-compatible`: Anthropic API-compatible HTTP endpoint
- `openai-compatible`: OpenAI Chat Completions API-compatible HTTP endpoint
- `ollama`: Ollama HTTP API (typically http://localhost:11434)
- `generic-command`: Shell command execution with sanitized environment

### Credential Modes

- `none`: No credential required (local model)
- `secretRef`: Credential stored in VS Code SecretStorage (credential.secretRef provides reference)
- `environment`: Credential from OS environment variable
- `subscription`: Native Claude subscription (credential.secretRef not required)

### Permission Modes

- `review-only`: Model can read but not modify workspace
- `edit-only`: Model can edit files but not execute commands
- `edit-and-command`: Model can edit files and execute commands

### Provider Classes

- `local`: Model running on localhost (Ollama, generic command)
- `private-network`: Model accessible via SSH tunnel or corporate network (VPN, VPC)
- `cloud`: Model hosted by public provider (Anthropic, OpenAI, etc.)

### Privacy Modes

- `unrestricted`: No restrictions on cloud model requests
- `guarded`: Require explicit approval for cloud model requests
- `strict`: Block all cloud model requests and cloud-bound handoffs until policy changes

### Handoff Modes

- `full`: Transfer complete transcript (if supported by adapter)
- `summary`: Transfer summarized context (local summarizer default, source-model opt-in)
- `none`: No context transfer

## Validation Rules

### Type Enforcement

- All `string` fields: Non-empty unless optional with "null" option
- All `number` fields: Must be > 0 if provided
- `enum` fields: Must be one of allowed values
- `boolean` fields: Must be true or false, not undefined or truthy/falsy values

### Field Interdependencies

1. **Credential**: `credential.secretRef` is required if `credential.mode === 'secretRef'`
2. **Tunnel**: `tunnel.sshHostAlias` and `tunnel.localPort` required if `tunnel.enabled === true`
3. **Handoff Modes**: `privacy.handoff.defaultMode` must be in `privacy.handoff.allowedModes`
4. **Template Constraint**: In Profile Template, `credential.secretRef` MUST be null or omitted (FR-005)

### Pattern Validation

- `id`: Must match `^[a-z0-9-]+$` (lowercase letters, numbers, hyphens)
- `baseUrl`: Must be valid URL (e.g., `https://api.example.com/v1` or `http://localhost:11434`)
- `sshHostAlias`: Must exist in `~/.ssh/config` (validated at runtime, not schema)

### Security Constraints

1. **No Secrets in Templates**: ProfileTemplate schema enforces `credential.secretRef: null`
2. **No Inline Secrets**: Schema does not allow `credential.value` field; references only
3. **Path Restrictions**: `permissions.workspacePaths` entries must be valid paths (checked at runtime)

### Capability Declaration Validation

At runtime, adapter MUST validate declared capabilities:
- If `capabilities.transcriptObservable: false`, adapter must not implement `getTranscript`
- If `capabilities.fileEdits: false`, adapter must not perform direct file edits
- If `capabilities.commands: false`, adapter must not execute shell commands
- etc. (see [Adapter Interface Contract](./adapter-interface.md))

## Examples

### Minimal Local Profile (Ollama)

```yaml
schemaVersion: 1
id: laptop-ollama-qwen
label: Laptop Ollama - Qwen Coder

adapter: ollama
model: qwen-coder
baseUrl: http://127.0.0.1:11434

credential:
  mode: none

tunnel:
  enabled: false

permissions:
  mode: edit-and-command
  workspacePaths: []

network:
  providerClass: local
  supportingNetwork: allowed

healthCheck:
  url: /api/tags
  method: GET

capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: true
  modelDiscovery: true
  transcriptObservable: false
```

### Cloud Profile with Secret Reference

```yaml
schemaVersion: 1
id: openai-gpt4
label: OpenAI GPT-4

adapter: openai-compatible
model: gpt-4-turbo
baseUrl: https://api.openai.com/v1

credential:
  mode: secretRef
  secretRef: api-key:openai-main

permissions:
  mode: edit-and-command
  workspacePaths: ["src/", "test/"]

network:
  providerClass: cloud
  supportingNetwork: allowed

capabilities:
  streaming: true
  tools: true
  fileEdits: false
  commands: false
  modelDiscovery: true
  transcriptObservable: false
```

### SSH-Tunneled Private Network Profile

```yaml
schemaVersion: 1
id: company-vpc-anthropic
label: Company VPC - Claude 3.5

adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
baseUrl: https://anthropic.internal/v1

credential:
  mode: secretRef
  secretRef: api-key:internal-anthropic

tunnel:
  enabled: true
  sshHostAlias: company-gateway
  localPort: 8080

limitations:
  contextTokens: 200000
  maxOutputTokens: 4096

permissions:
  mode: edit-and-command
  workspacePaths: []

network:
  providerClass: private-network
  supportingNetwork: allowed

capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: true
  modelDiscovery: false
  transcriptObservable: false
```

### Generic Command Profile

```yaml
schemaVersion: 1
id: custom-cli-tool
label: Custom NLP CLI

adapter: generic-command
model: default

credential:
  mode: environment

environmentRefs:
  - CUSTOM_CLI_PATH
  - CUSTOM_MODEL_CONFIG

permissions:
  mode: edit-only
  workspacePaths: []

network:
  providerClass: local
  supportingNetwork: allowed

capabilities:
  streaming: false
  tools: false
  fileEdits: false
  commands: true
  modelDiscovery: false
  transcriptObservable: false
```

### Profile Template (No Secrets)

```yaml
schemaVersion: 1
id: template-anthropic-models
label: Anthropic-Compatible Template

adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
baseUrl: https://api.anthropic.com

credential:
  mode: secretRef
  secretRef: null                        # MUST be null in template

permissions:
  mode: edit-and-command
  workspacePaths: []

network:
  providerClass: cloud
  supportingNetwork: allowed

capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
```

### Workspace Policy (Guarded Mode)

```yaml
schemaVersion: 1

privacy:
  mode: guarded

  cloudModelRequests:
    default: require-confirmation

  handoff:
    allowedModes: [full, summary, none]
    defaultMode: summary
    summaryDefault:
      includeCode: false
      includeSensitiveData: false
      includeToolOutput: false
      includeDiffs: false
      includeCommandOutput: false
      includePaths: true

  policyChanges:
    requireConfirmation: true
    requireReason: true
    revertAfterMinutes: 60
    requireSecondApprover: false

concurrency:
  default: concurrent
  conflictAction: warn
  supportsWorktrees: true
  checkpointBeforeMutation: false

profiles:
  allowedTemplateIds: []
```

## Integration with TypeScript/Zod

For TypeScript implementation, schema maps to Zod validation schemas:

```typescript
// Example: Profile config type
import { z } from 'zod';

export const ProfileConfigSchema = z.object({
  schemaVersion: z.number().int().min(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  adapter: z.enum(['native-claude', 'anthropic-compatible', 'openai-compatible', 'ollama', 'generic-command']),
  model: z.string().min(1),
  baseUrl: z.string().url().nullable().optional(),
  credential: z.object({
    mode: z.enum(['none', 'secretRef', 'environment', 'subscription']),
    secretRef: z.string().nullable(),
  }),
  // ... (full schema)
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
```

## Migration Notes

### Schema Version Evolution

When incrementing schemaVersion:

1. **Minor Update** (1.1): Add new optional fields, old profiles remain valid
2. **Major Update** (2.0): Breaking changes, migration required
   - Add migration pipeline: 1.0 → 2.0
   - Plan migration logic for existing profiles
   - Update documentation and CHANGELOG.md

### Migration Example

If schema 2.0 adds new required field `apiVersion`:

```yaml
# 1.0 profile (before migration)
schemaVersion: 1
id: my-profile
label: My Profile
adapter: anthropic-compatible
model: claude-3
# ... (no apiVersion field)

# 2.0 profile (after migration)
schemaVersion: 2
id: my-profile
label: My Profile
adapter: anthropic-compatible
model: claude-3
apiVersion: "2023-06-01"  # New required field
# ...
```

Migration logic during extension startup:
1. Detect `schemaVersion < 2`
2. Apply migration (default `apiVersion` based on adapter versioning convention)
3. Increment `schemaVersion` to 2
4. Log migration in audit log

## Security Considerations

### Secret Prevention

Schema enforces FR-005: Repository templates cannot contain secrets:

1. **Template constraint**: `credential.secretRef` MUST be null
2. **No value field**: Schema does not allow inline credential values
3. **Reference only**: Only reference identifiers, never actual secrets

### Path Injection Prevention

1. **Workspace paths**: `permissions.workspacePaths` validated at runtime to ensure paths are within workspace
2. **SSH aliases**: `tunnel.sshHostAlias` must exist in `~/.ssh/config` ; no arbitrary hostname injection
3. **Environment variables**: `environmentRefs` only allows variable names, not `VAR=value` assignments

### Command Injection Prevention (Generic Command Adapter)

1. **Sanitized environment**: Environment variables limited to profile.environmentRefs plus minimal PATH
2. **Working directory**: Restricted to user-controlled paths (temp dir, workspace root)
3. **Timeout Enforcement**: Commands timeout after configurable duration to prevent hanging

## Error Codes

Schema validation errors return codes:

| Code | Meaning |
|------|---------|
| `SCHEMA_VERSION_INVALID` | schemaVersion not recognized |
| `MISSING_REQUIRED_FIELD` | Required field missing |
| `INVALID_TYPE` | Field has wrong type |
| `INVALID_VALUE` | Field value not in allowed set |
| `INVALID_PATTERN` | String does not match required pattern |
| `INVALID_URL` | URL is malformed |
| `SECURITY_VIOLATION` | Forbidden operation (e.g., secret in template) |
| `DEPENDENCY_ERROR` | Field interdependency violated |

Each error includes:
- Field path (e.g., `credential.secretRef`)
- Detailed message (e.g., "credential.secretRef must be null in templates")
- Suggestion (e.g., "Remove secretRef field or use user profile overlay")
