# Problem Resolution Core Audit

## Scope
- Module audited: `src/14-reasoning-and-generation-layer/problem-resolution-core`
- Date: 2026-04-27

## Pipeline audit (before hardening)
- `task-reasoning-classifier`: present, returns `ReasoningNeed`, consumed by builder/orchestrator.
- `problem-representation-builder`: present, generated baseline representation but without formal fields for budget/observation/mapping/proof.
- `constraint-ledger`: present, consumed by closure checker; mostly heuristic text checks.
- `invariant-tracker`: present, consumed by closure checker; mostly heuristic textual checks.
- `scenario-enumerator`: present, consumed by orchestrator/step guard.
- `step-completion-guard`: present, consumed by closure checker.
- `logical-closure-checker`: present, consumed by orchestrator.
- `answer-draft-repair-planner`: present, consumed by orchestrator and bridge.
- `problem-resolution-layer-bridge`: present, injects state in processing pipeline.

## Main findings

### Sufficient modules
- `task-reasoning-classifier.ts`
- `scenario-enumerator.ts` (base behavior existed)
- `problem-resolution-layer-bridge.ts` (integration point existed)

### Incomplete modules (hardened)
- `problem-resolution-types.ts`: missing formal contracts for action/observation/mapping/proof/scenario coverage/assignment consistency.
- `problem-representation-builder.ts`: lacked extraction and assembly of formal fields.
- `constraint-ledger.ts`: formal fields not prioritized over heuristics.
- `invariant-tracker.ts`: formal fields not prioritized over heuristics.
- `step-completion-guard.ts`: missing explicit checks for incomplete case closure, elimination without alternatives, action-budget repeat instructions, and mapping-form output requirement.
- `logical-closure-checker.ts`: did not fail explicitly for scenario coverage, assignment consistency and proof-obligation failures.
- `answer-draft-repair-planner.ts`: no `repairMode` and weak differentiation between light patch vs regenerate.

### Missing responsibilities (implemented as new modules)
- `action-budget-extractor.ts`
- `observation-limit-extractor.ts`
- `domain-variable-mapper.ts`
- `proof-obligation-builder.ts`
- `scenario-coverage-validator.ts`
- `assignment-consistency-checker.ts`

### Operator gap
- Core had no explicit operator file pattern. Added:
  - `operators/problem-resolution-core-operator.ts`

## Data-flow and field audit
- Pre-hardening: several closure/risk fields were generated heuristically but not backed by formal typed sources.
- Post-hardening: formal fields are produced in representation and consumed through ledger/invariant/completion/closure and repair planning.

## Type fields added
- `LogicalProblemKind`
- `ActionBudget`
- `ObservationLimit`
- `DomainMapping`
- `ScenarioBranch`
- `ProofObligation`
- `ScenarioCoverageResult`
- `AssignmentConsistencyResult`
- `ProofObligationEvaluation`
- `DraftRepairPlan.repairMode` (optional)
- `ProblemRepresentation` optional formal fields:
  - `logicalProblemKind`, `actionBudget`, `observationLimits`, `domainMapping`, `scenarioBranches`, `closureRequirements`, `proofObligations`, `assignmentConsistency`, `scenarioCoverage`
- `ProblemResolutionState` optional formal fields:
  - `logicalProblemKind`, `actionBudget`, `observationLimits`, `domainMapping`, `scenarioBranches`, `closureRequirements`, `proofObligations`, `scenarioCoverage`, `assignmentConsistency`, `proofEvaluation`
- `LogicalClosureAssessment.missingProofObligations` (optional)

## Residual stubs / semi-active points
- No dead exported function found in this module after hardening.
- Heuristic fallback paths remain intentionally active when formal fields are absent.

