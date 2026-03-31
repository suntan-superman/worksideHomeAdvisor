# Workside Home Advisor — Guided Workflow State Engine Spec
## Codex-Ready Implementation

Version: 1.0

Purpose:
Define how the guided workflow system automatically:
- tracks progress
- completes steps
- unlocks next steps
- updates sidebar + checklist
- calculates market-ready status

This is the logic layer behind the UX copy + workflow plan.

---

# 1. Core Concept

The system is **state-driven**, not manual.

Users should NOT:
- mark steps complete manually (except optional cases)
- think about progress

Instead:
👉 The system observes data and updates state automatically

---

# 2. State Model

## Workflow State

```ts
type WorkflowState = {
  propertyId: string
  role: 'seller' | 'agent'
  currentPhase: PhaseKey
  currentStep: StepKey
  completionPercent: number
  marketReadyScore: number
  steps: StepState[]
}
```

---

## Step State

```ts
type StepState = {
  key: StepKey
  phase: PhaseKey
  status: 'locked' | 'available' | 'in_progress' | 'complete' | 'blocked'
  isRequired: boolean
  completedAt?: string
}
```

---

# 3. Step Status Rules

## locked
User cannot access yet

## available
User can start

## in_progress
User started but not complete

## complete
System confirms completion

## blocked
Missing dependency

---

# 4. State Transitions

## Example Flow

```text
Create account -> complete profile -> add property -> add details
```

Rules:

- Step B unlocks when Step A = complete
- Step becomes "complete" when required data exists
- Step becomes "in_progress" when partially filled

---

# 5. Completion Rules (CRITICAL)

Each step must define **auto-completion logic**

---

## Example: Property Details Step

```ts
complete if:
  bedrooms != null
  bathrooms != null
  sqft != null
```

---

## Example: Photos Step

```ts
complete if:
  photoCount >= requiredRoomsCount
```

---

## Example: Report Step

```ts
complete if:
  reportGenerated == true
```

---

# 6. Step Definitions (Sample)

```ts
const steps = [
  {
    key: 'account_created',
    required: true,
    completeIf: (ctx) => ctx.user.exists
  },
  {
    key: 'profile_complete',
    required: true,
    completeIf: (ctx) => ctx.user.name && ctx.user.phone
  },
  {
    key: 'property_added',
    required: true,
    completeIf: (ctx) => ctx.property.address
  },
  {
    key: 'photos_uploaded',
    required: true,
    completeIf: (ctx) => ctx.photos.count >= 5
  },
]
```

---

# 7. Unlock Logic

```ts
function unlockNextSteps(steps) {
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].status === 'complete') {
      steps[i+1].status = 'available'
    }
  }
}
```

---

# 8. Progress Calculation

## Completion %

```ts
completionPercent = completedSteps / totalRequiredSteps
```

---

## Market Ready Score

Weighted:

```ts
score =
  profileComplete * 10 +
  propertyDetails * 20 +
  photos * 20 +
  checklist * 15 +
  providers * 10 +
  report * 15 +
  brochure * 10
```

---

# 9. Recommended Next Step Engine

```ts
function getNextStep(steps) {
  return steps.find(s => s.status === 'available')
}
```

Display:
👉 “Next step: Upload photos”

---

# 10. Real-Time Recalculation

Trigger recalculation on:

- property update
- photo upload
- checklist change
- provider request
- report generation

---

# 11. API Design

## Get workflow
GET /api/workflows/:propertyId

## Update step (optional manual override)
PUT /api/workflows/:propertyId/steps/:stepKey

## Recalculate
POST /api/workflows/:propertyId/recalculate

---

# 12. Frontend Behavior

## On Load
- fetch workflow
- render sidebar + checklist

## On Action
- update backend
- recalc workflow
- refresh UI

---

# 13. Edge Cases

## Missing required data
→ status = blocked

## Skipped optional step
→ mark complete manually

## Deleted data
→ revert step to in_progress

---

# 14. Performance

- cache workflow state
- debounce recalculations
- avoid full recompute when possible

---

# 15. Acceptance Criteria

System works when:

- steps auto-complete correctly
- next step always visible
- progress updates instantly
- no manual tracking needed
- sidebar always reflects truth

---

# 16. Final Principle

👉 The user should NEVER ask:

“What do I do next?”

The system must always answer that automatically.
