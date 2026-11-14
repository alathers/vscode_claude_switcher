# Adversarial Review Summary

## Review Findings

Review of Phase 6 (T035, T046-T048) and Phase 7 (T056-T057, T060) implementation.

### Critical Issues (2)

#### 1. **T047: Harvey recommendation not used** 🔴 CRITICAL
- **File**: `src/core/routing/routing-engine.ts:197-214`, 238-244
- **Bug**: Harvey is called and recommendation stored, but never used to make routing decisions
- **Requirement violation**: Task says "if result.routedTo is 'ollama' ... decide route" - this logic is missing
- **Impact**: Wastes 200ms latency per request on unused HTTP call, core feature non-functional
- **Current**: Harvey recommendation only attached to decision AFTER routing choice already made
- **Required**: Actually use Harvey's result to influence/source routing

#### 2. **T056: Monthly rollup not implemented** 🔴 CRITICAL
- **File**: `src/core/routing/routing-history.ts:132-150`
- **Bug**: createMonthlyRollup() returns empty structure with TODO comment
- **Impact**: Deletes daily records after creating empty rollups - **DATA LOSS**
- **Requirement**: "30-day detailed records + monthly rollups" for cost analysis
- **Current**: totalRequests=0, all usage=0, empty rollup created before deletion

### High Issues (1)

#### 3. **T048/T050: autoFallbackTriggered field missing from initializations** 🟠 HIGH
- **Files**: `src/vscode/views/quota-status-bar.ts:48-52`, `src/vscode/views/quota-dashboard.ts`
- **Bug**: OllamaState interface has 4 fields, but initializations only set 3 (missing autoFallbackTriggered)
- **Impact**: Field undefined, potential runtime issues when tracking auto-fallback state
- **Required**: Add `autoFallbackTriggered: false` to all OllamaState initializations

### Low Issues (2)

#### 4. **T056: Delete key method uncertain** 🟡 LOW
- **File**: `src/core/routing/routing-history.ts:184`
- **Question**: `globalState.update(key, undefined)` may not delete keys from VS Code storage
- **Impact**: Storage bloat if old keys not actually deleted
- **Note**: Task description mentions `fs.unlinkSync` but implementation uses globalState API (correct for VS Code)

#### 5. **T057: Type incompatibility** 🟡 LOW
- **Files**: `src/core/routing/routing-engine.ts:42-63`, `src/core/routing/routing-history.ts:35-48`
- **Bug**: Two different RoutingDecision interfaces exist with incompatible fields
- **Impact**: logRoutingDecision() can't accept routing-engine's RoutingDecision return type
- **Note**: Not currently blocking - logRoutingDecision() only used in tests, not production code

### Verified Correct (4)

#### ✅ T035: Routing record writing
- All three decision return paths correctly call writeDecisionToHistory()

#### ✅ T046: Harvey availability check
- isAvailable('ollama') checks all required conditions

#### ✅ T057: Logging field extensions
- RoutingDecisionLogEntry correctly extended with quotaBefore, quotaAfter, estimatedCost

#### ✅ T060: Documentation
- README.md has comprehensive Model Cost Optimization section
- package.json description updated

## Recommendation

**Do NOT merge** until T047 and T056 are fixed:

1. **T047** - Harvey recommendations collected but ignored - core routing algorithm incomplete
2. **T056** - Data loss risk from empty monthly rollups before deleting daily records

Quick wins:
- T048 autoFallbackTriggered initialization (1-line fix in 2 files)
- T057 type incompatibility (needs design decision: unify interfaces vs add converter)

## Files Modified in This Session

- `README.md` - Added Model Cost Optimization documentation
- `package.json` - Updated description to mention routing
- `src/core/quota/quota-cache.ts` - Added autoFallbackTriggered to OllamaState
- `src/core/routing/routing-engine.ts` - Added T035 writeDecisionToHistory calls, T046-T048 integration
- `src/core/routing/routing-history.ts` - Implemented cleanupOldRecords (T056-2/2)
- `src/core/routing/routing-logger.ts` - Extended RoutingDecisionLogEntry (T057-1/2)
- `specs/002-model-cost-optimization/tasks.md` - Marked T035, T046-T048, T056-T057, T060 complete

## Task Status Updates Required

Unmark these as complete until bugs fixed:
- [ ] T047 - Harvey recommendation logic incorrect
- [ ] T056 - Monthly rollup not implemented (data loss risk)

These can remain complete with caveats:
- [X] T048 - Implementation correct, but missing field initialization in status-bar/dashboard
- [X] T057 - Fields extended correctly, but type incompatibility exists

Last compiled: TypeScript compilation successful (no errors detected)

---

Full detailed review: `adversarial-review-findings.md`
