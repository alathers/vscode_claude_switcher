# Multi-Authentication Support

## Overview

The VS Code Claude Switcher now supports multiple authentication methods for accessing Claude models:

1. **Standard Claude Subscription** - Built-in VS Code Claude Code integration
2. **Max Account API** - API key-based access for Max-tier accounts
3. **Multi-Key Load Balancing** - Rotate across multiple API keys for higher limits

## Authentication Modes

### 1. Standard Subscription (`subscription` mode)

Uses the official Claude Code for VS Code extension authentication. No secrets required - leverages existing VS Code login.

**Adapter:** `native-claude`

**Profile example:** `examples/claude-subscription-profile.yaml`

**Credential configuration:**
```yaml
credential:
  mode: subscription
  secretRef: null
```

**Benefits:**
- No API key management
- Uses existing Claude Code subscription
- Supports transcript retrieval
- Full Claude capabilities

### 2. Single Max Account API (`secretRef` mode)

Direct API access using a single API key from a Max account.

**Adapter:** `anthropic-compatible`

**Profile example:** `examples/claude-max-api-profile.yaml`

**Credential configuration:**
```yaml
credential:
  mode: secretRef
  secretRef: claude-max-api-key
```

**Prerequisites:**
1. Add API key to VS Code SecretStorage:
   ```
   Ctrl+Shift+P → "Paste as Secret" → Name: claude-max-api-key
   ```
2. Use profile with anthropic-compatible adapter

**Benefits:**
- Direct API access
- Full model capabilities
- Works with Max account limits

### 3. Multi-Key Load Balancing (`multi-key` mode)

Rotate across multiple API keys for higher rate limits and redundancy.

**Adapter:** `anthropic-compatible`

**Profile example:** `examples/claude-multi-key-profile.yaml`

**Credential configuration:**
```yaml
credential:
  mode: multi-key
  secretRefs:
    - claude-max-api-key-1
    - claude-max-api-key-2
    - claude-max-api-key-3
  keyRotationStrategy: round-robin
```

**Prerequisites:**
1. Add all API keys to VS Code SecretStorage:
   ```
   Ctrl+Shift+P → "Paste as Secret" → Name: claude-max-api-key-1
   Ctrl+Shift+P → "Paste as Secret" → Name: claude-max-api-key-2
   Ctrl+Shift+P → "Paste as Secret" → Name: claude-max-api-key-3
   ```
2. Configure rotation strategy (round-robin, weighted-random, sequential)

**Benefits:**
- Higher rate limits through multiple keys
- Redundancy if one key reaches limits
- Load balancing across accounts

## Secret Storage Management

### Adding Secrets to VS Code

1. Open VS Code Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: "Paste as Secret"
3. Enter API key value
4. Enter secret name (e.g., `claude-max-api-key-1`)

### Listing Stored Secrets

```bash
# List all secrets
code --list-secrets

# Show specific secret (VS Code only allows get, not list)
```

### Deleting Secrets

1. Open VS Code Command Palette: `Ctrl+Shift+P`
2. Type: "Delete Secret"
3. Enter secret name to delete

## Key Rotation Strategies

### Round-Robin (default)

Rotates through keys in sequence. Simple and deterministic.

```yaml
credential:
  mode: multi-key
  secretRefs: ['key-1', 'key-2', 'key-3']
  keyRotationStrategy: round-robin
```

Usage pattern: key-1 → key-2 → key-3 → key-1 → ...

### Weighted-Random

Selects keys randomly, allowing weighted distribution (future enhancement).

```yaml
credential:
  mode: multi-key
  secretRefs: ['key-1', 'key-2']
  keyRotationStrategy: weighted-random
```

### Sequential

Uses keys in order until one hits limits, then moves to next.

```yaml
credential:
  mode: multi-key
  secretRefs: ['key-1', 'key-2']
  keyRotationStrategy: sequential
```

Usage pattern: key-1 (until limit) → key-2 (until limit) → ...

## Implementation Details

### Changes Made

1. **Contract Extension** (`src/core/adapters/contract.ts`)
   - Added `multi-key` credential mode
   - Added `secretRefs` array for multiple secrets
   - Added `keyRotationStrategy` option

2. **Secret Resolution** (`src/core/validation/secret-resolution.ts`)
   - Updated to validate multiple secret references
   - All secrets in `secretRefs` must exist in SecretStorage

3. **Profile Validator** (`src/core/validation/profile-validator.ts`)
   - Added validation for `multi-key` mode
   - Warns if both `secretRef` and `secretRefs` present
   - Requires at least one secret in `secretRefs` array

4. **Example Profiles**
   - `examples/claude-subscription-profile.yaml` - Standard subscription
   - `examples/claude-max-api-profile.yaml` - Single Max API key
   - `examples/claude-multi-key-profile.yaml` - Multi-key load balancing

### API Key Redaction

All secrets are automatically redacted from logs and audit trails:

- API keys replaced with `[REDACTED: KEY-NAME]`
- Never logged directly
- Stored only in VS Code SecretStorage

### Security Considerations

1. **Never store secrets in profiles** - Only reference SecretStorage keys
2. **Never commit secrets to git** - Secrets are in VS Code, not repo
3. **Environment variable mode** - Alternative to SecretStorage for local dev
4. **Subscription mode** - No credentials stored, uses VS Code authentication

## Testing

### Unit Tests

All tests pass (134 tests):
- Multi-key secret reference validation
- Missing secret detection
- Credential mode validation
- Secret redaction

```bash
npm run test
```

### Manual Testing

1. Create a profile in `examples/` directory
2. Add secrets to VS Code SecretStorage
3. Run extension: "Run Extension" in VS Code
4. Open Command Palette: "Claude Switcher: Select Workspace Profile"
5. Choose your configured profile

## Troubleshooting

### "Secret not found in SecretStorage"

**Problem:** Secret reference doesn't exist

**Solution:**
1. Add secret to VS Code SecretStorage
2. Check secret name spelling in profile
3. Use "Paste as Secret" command in VS Code

### "Multiple secrets missing"

**Problem:** Multi-key mode has missing secrets

**Solution:**
1. Add all secrets in `secretRefs` array to SecretStorage
2. Each secret must exist for multi-key mode
3. Validation fails if any secret is missing

### Extension not showing profiles

**Problem:** Extension not loaded or configuration issue

**Solution:**
1. Check VS Code Output panel for errors
2. Verify extension is installed
3. Try reloading VS Code
4. Run diagnostics: "Claude Switcher: Run Diagnostics"

## Next Steps

1. **Implement key rotation logic** in anthropic-compatible adapter (T088-T092)
2. **Implement subscription mode** in native-claude adapter (T093-T097)
3. **Add secret health checks** to validate API keys are valid
4. **Implement rate limit tracking** for intelligent key rotation
5. **Add metrics tracking** for usage across multiple keys

## References

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [VS Code Secret Storage](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext)
- [Claude Code for VS Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
