# Gym Recording App - Error Fixes & E2E Testing PRD

## Overview
This PRD defines the work required to achieve a clean `svelte-check` output (zero errors and zero warnings) and establish comprehensive E2E test coverage for all application pages.

## Current State Analysis

### svelte-check Results
- **Errors:** 0
- **Warnings:** 28
- **Affected Files:** 8 components/pages

### Warning Categories

| Category | Count | Description |
|----------|-------|-------------|
| `a11y_label_has_associated_control` | 12 | Labels not properly associated with form controls |
| `a11y_click_events_have_key_events` | 3 | Click handlers without keyboard event handlers |
| `a11y_no_noninteractive_element_interactions` | 3 | Non-interactive elements with mouse/keyboard listeners |
| `a11y_autofocus` | 4 | Usage of autofocus attribute |
| `a11y_no_static_element_interactions` | 2 | Static elements with drag/mouse handlers |
| `state_referenced_locally` | 2 | State captured at initialization instead of reactively |
| `non_reactive_update` | 1 | Variable updated without $state declaration |

### Affected Files

| File | Warning Count |
|------|---------------|
| `src/lib/components/EditWorkoutModal.svelte` | 7 |
| `src/routes/workout/+page.svelte` | 5 |
| `src/lib/components/CreateWorkoutModal.svelte` | 4 |
| `src/lib/components/ImportBackupModal.svelte` | 4 |
| `src/lib/components/CreateExerciseModal.svelte` | 3 |
| `src/lib/components/RestTimer.svelte` | 2 |
| `src/routes/progress/+page.svelte` | 1 |
| `src/routes/settings/+page.svelte` | 1 |

## User Stories

### US-001: Fix Label-Control Associations

As a developer, I want all form labels to be properly associated with their controls so that the application passes accessibility audits and screen readers can correctly announce form fields.

**Acceptance Criteria:**
- [ ] All `<label>` elements have a corresponding `for` attribute matching an input `id`
- [ ] Dynamic labels in loops use unique generated IDs
- [ ] svelte-check reports 0 `a11y_label_has_associated_control` warnings
- [ ] Screen readers correctly announce label text when focusing inputs

**Affected Components:**
- `CreateWorkoutModal.svelte` (line 281)
- `EditWorkoutModal.svelte` (lines 161, 199, 210, 221)
- `ImportBackupModal.svelte` (lines 181, 262, 282, 302, 322)
- `workout/+page.svelte` (lines 1166, 1177, 1189)

### US-002: Fix Modal Click Event Accessibility

As a developer, I want modal components to handle both mouse and keyboard interactions so that keyboard-only users can interact with modal content.

**Acceptance Criteria:**
- [ ] Modal content divs that stop click propagation also handle keyboard events
- [ ] Use `role="dialog"` instead of `role="document"` where appropriate
- [ ] Add `onkeydown` handlers for escape key dismissal
- [ ] svelte-check reports 0 `a11y_click_events_have_key_events` warnings
- [ ] svelte-check reports 0 `a11y_no_noninteractive_element_interactions` warnings

**Affected Components:**
- `CreateExerciseModal.svelte` (line 79)
- `CreateWorkoutModal.svelte` (line 106)
- `EditWorkoutModal.svelte` (line 126)

### US-003: Remove or Justify Autofocus Usage

As a developer, I want to either remove autofocus attributes or explicitly suppress the warnings where autofocus is intentional so that the codebase follows accessibility best practices.

**Acceptance Criteria:**
- [ ] Evaluate each autofocus usage for necessity
- [ ] Remove autofocus where not essential for UX
- [ ] For intentional autofocus, add `<!-- svelte-ignore a11y_autofocus -->` with justification comment
- [ ] svelte-check reports 0 `a11y_autofocus` warnings (or all are intentionally suppressed)

**Affected Components:**
- `CreateExerciseModal.svelte` (line 111)
- `CreateWorkoutModal.svelte` (line 135)
- `EditWorkoutModal.svelte` (line 155)
- `settings/+page.svelte` (line 763)

### US-004: Fix Drag-and-Drop Accessibility

As a developer, I want drag-and-drop elements to have proper ARIA roles so that assistive technologies can understand the interactive nature of these elements.

**Acceptance Criteria:**
- [ ] Draggable elements have `role="listitem"` or appropriate ARIA role
- [ ] Parent containers have `role="list"` where applicable
- [ ] Add `aria-grabbed` and `aria-dropeffect` attributes for drag state
- [ ] Provide keyboard alternatives for reordering (already present via buttons)
- [ ] svelte-check reports 0 `a11y_no_static_element_interactions` warnings

**Affected Components:**
- `workout/+page.svelte` (lines 1115, 1157)

### US-005: Fix RestTimer State Reactivity

As a developer, I want the RestTimer component to properly reference reactive state so that duration changes are reflected in the timer behavior.

**Acceptance Criteria:**
- [ ] `timeLeft` initialization references `duration` reactively (use `$derived` or closure)
- [ ] `customDuration` initialization references `duration` reactively
- [ ] Timer resets correctly when `duration` prop changes
- [ ] svelte-check reports 0 `state_referenced_locally` warnings for RestTimer

**Affected Components:**
- `RestTimer.svelte` (lines 8, 12)

### US-006: Fix Progress Page Canvas Reactivity

As a developer, I want the chartCanvas reference to be properly reactive so that Svelte can track updates to the canvas element.

**Acceptance Criteria:**
- [ ] `chartCanvas` declared with `$state()` or use `bind:this` pattern correctly
- [ ] Chart renders correctly on initial load
- [ ] Chart updates correctly when data changes
- [ ] svelte-check reports 0 `non_reactive_update` warnings

**Affected Components:**
- `progress/+page.svelte` (line 15)

### US-007: Setup Playwright E2E Testing Infrastructure

As a developer, I want Playwright configured in the project so that E2E tests can be written and run against all application pages.

**Acceptance Criteria:**
- [ ] Playwright installed as dev dependency
- [ ] `playwright.config.ts` configured for SvelteKit
- [ ] Test directory structure created (`tests/e2e/`)
- [ ] npm scripts added for running E2E tests
- [ ] CI-compatible configuration (headless mode)
- [ ] Base fixtures created for common test utilities

### US-008: E2E Tests for Home Page

As a developer, I want E2E tests for the home/landing page so that core navigation and initial render are verified.

**Acceptance Criteria:**
- [ ] Test: Page loads without errors
- [ ] Test: Main navigation elements are visible
- [ ] Test: Key call-to-action buttons are interactive
- [ ] Test: Page renders correctly on mobile viewport
- [ ] All tests pass consistently

### US-009: E2E Tests for Dashboard Page

As a developer, I want E2E tests for the dashboard page so that workout metrics display correctly.

**Acceptance Criteria:**
- [ ] Test: Dashboard page loads without errors
- [ ] Test: Workout statistics section renders
- [ ] Test: Recent activity section renders
- [ ] Test: Navigation to other pages works
- [ ] All tests pass consistently

### US-010: E2E Tests for Workout Page

As a developer, I want E2E tests for the workout page so that the workout recording flow is verified.

**Acceptance Criteria:**
- [ ] Test: Workout page loads without errors
- [ ] Test: Exercise list renders (or empty state)
- [ ] Test: Can interact with workout controls
- [ ] Test: Set entry inputs are accessible
- [ ] Test: Navigation flow works correctly
- [ ] All tests pass consistently

### US-011: E2E Tests for History Page

As a developer, I want E2E tests for the history page so that workout history display is verified.

**Acceptance Criteria:**
- [ ] Test: History page loads without errors
- [ ] Test: Workout history list renders (or empty state)
- [ ] Test: Filtering/sorting controls work
- [ ] Test: Can navigate to workout details
- [ ] All tests pass consistently

### US-012: E2E Tests for Progress Page

As a developer, I want E2E tests for the progress page so that progress charts and metrics are verified.

**Acceptance Criteria:**
- [ ] Test: Progress page loads without errors
- [ ] Test: Chart canvas element renders
- [ ] Test: Exercise selector works
- [ ] Test: Date range controls function
- [ ] All tests pass consistently

### US-013: E2E Tests for PR (Personal Records) Page

As a developer, I want E2E tests for the PR page so that personal record tracking is verified.

**Acceptance Criteria:**
- [ ] Test: PR page loads without errors
- [ ] Test: PR list renders (or empty state)
- [ ] Test: PR categories/filters work
- [ ] Test: PR details are accessible
- [ ] All tests pass consistently

### US-014: E2E Tests for Settings Page

As a developer, I want E2E tests for the settings page so that user preferences and data management are verified.

**Acceptance Criteria:**
- [ ] Test: Settings page loads without errors
- [ ] Test: Settings sections render correctly
- [ ] Test: Toggle/input controls are interactive
- [ ] Test: Import/export functionality is accessible
- [ ] All tests pass consistently

## Requirements

### 1. Accessibility Fixes

**Label-Control Association**
- Add unique `id` attributes to all form inputs
- Add corresponding `for` attributes to all labels
- Use index-based or context-based ID generation in loops

**Modal Accessibility**
- Replace `role="document"` with `role="dialog"` on modal content
- Add `aria-modal="true"` to modal containers
- Implement keyboard event handlers alongside click handlers
- Consider using `<dialog>` element for native modal behavior

**Autofocus Handling**
- Document justification for each autofocus usage
- Use Svelte ignore comments with explanatory notes
- Alternatively, implement focus management via `onMount`

**Drag-and-Drop Accessibility**
- Add `role="listitem"` to draggable set containers
- Add `role="list"` to parent container
- Ensure keyboard reorder buttons remain as primary interaction method

### 2. Svelte 5 Reactivity Fixes

**RestTimer Component**
- Use `$derived` for computed values based on props
- Or use `$effect` to reset state when props change
- Ensure timer state synchronizes with duration prop changes

**Progress Page Canvas**
- Declare `chartCanvas` with `$state<HTMLCanvasElement | null>(null)`
- Ensure Chart.js integration works with reactive canvas reference

### 3. E2E Testing Infrastructure

**Playwright Setup**
```bash
npm install -D @playwright/test
npx playwright install
```

**Configuration Requirements**
- SvelteKit dev server integration
- Multiple browser support (Chromium, Firefox, WebKit)
- Viewport configurations for responsive testing
- Screenshot on failure
- Trace collection for debugging

**Test Structure**
```
tests/
  e2e/
    home.spec.ts
    dashboard.spec.ts
    workout.spec.ts
    history.spec.ts
    progress.spec.ts
    pr.spec.ts
    settings.spec.ts
    fixtures/
      test-utils.ts
```

**npm Scripts**
```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:debug": "playwright test --debug"
}
```

## Non-Functional Requirements

**Code Quality**
- Zero svelte-check errors
- Zero svelte-check warnings (or all intentionally suppressed with documentation)
- All E2E tests pass on CI

**Test Coverage**
- Every route has at least one E2E test
- Core user flows are covered
- Error states and edge cases tested where applicable

**Performance**
- E2E test suite completes within 5 minutes
- No flaky tests (tests pass consistently)

**Maintainability**
- Tests use page object pattern or similar abstraction
- Common utilities extracted to fixtures
- Clear test descriptions and organization

## Success Criteria

1. `npm run check` reports 0 errors and 0 warnings (or documented suppressions only)
2. `npm run test:e2e` passes with all tests green
3. E2E tests cover all 7 application pages:
   - `/` (Home)
   - `/dashboard`
   - `/workout`
   - `/history`
   - `/progress`
   - `/pr`
   - `/settings`
4. Tests run successfully in CI environment
5. No accessibility regressions introduced

## Implementation Priority

### Phase 1: Critical Fixes (Warnings)
1. US-005: Fix RestTimer State Reactivity
2. US-006: Fix Progress Page Canvas Reactivity
3. US-001: Fix Label-Control Associations

### Phase 2: Accessibility Compliance
4. US-002: Fix Modal Click Event Accessibility
5. US-004: Fix Drag-and-Drop Accessibility
6. US-003: Remove or Justify Autofocus Usage

### Phase 3: E2E Test Infrastructure
7. US-007: Setup Playwright E2E Testing Infrastructure

### Phase 4: E2E Test Implementation
8. US-008: E2E Tests for Home Page
9. US-009: E2E Tests for Dashboard Page
10. US-010: E2E Tests for Workout Page
11. US-011: E2E Tests for History Page
12. US-012: E2E Tests for Progress Page
13. US-013: E2E Tests for PR Page
14. US-014: E2E Tests for Settings Page

## Dependencies

- Svelte 5 (current: ^5.45.6)
- SvelteKit 2 (current: ^2.49.1)
- Playwright (to be installed)
- Existing Vitest setup for unit tests

## Open Questions

None - requirements fully defined based on current svelte-check output and page structure.

## Appendix: Current Warning Details

### File: CreateExerciseModal.svelte
```
Line 79: a11y_click_events_have_key_events
Line 79: a11y_no_noninteractive_element_interactions
Line 111: a11y_autofocus
```

### File: CreateWorkoutModal.svelte
```
Line 106: a11y_click_events_have_key_events
Line 106: a11y_no_noninteractive_element_interactions
Line 135: a11y_autofocus
Line 281: a11y_label_has_associated_control
```

### File: EditWorkoutModal.svelte
```
Line 126: a11y_click_events_have_key_events
Line 126: a11y_no_noninteractive_element_interactions
Line 155: a11y_autofocus
Line 161: a11y_label_has_associated_control
Line 199: a11y_label_has_associated_control
Line 210: a11y_label_has_associated_control
Line 221: a11y_label_has_associated_control
```

### File: ImportBackupModal.svelte
```
Line 181: a11y_label_has_associated_control
Line 262: a11y_label_has_associated_control
Line 282: a11y_label_has_associated_control
Line 302: a11y_label_has_associated_control
Line 322: a11y_label_has_associated_control
```

### File: RestTimer.svelte
```
Line 8: state_referenced_locally (duration -> timeLeft)
Line 12: state_referenced_locally (duration -> customDuration)
```

### File: progress/+page.svelte
```
Line 15: non_reactive_update (chartCanvas)
```

### File: settings/+page.svelte
```
Line 763: a11y_autofocus
```

### File: workout/+page.svelte
```
Line 1115: a11y_no_static_element_interactions (drag handlers)
Line 1157: a11y_no_static_element_interactions (mousedown handler)
Line 1166: a11y_label_has_associated_control
Line 1177: a11y_label_has_associated_control
Line 1189: a11y_label_has_associated_control
```
