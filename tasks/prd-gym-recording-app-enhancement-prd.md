# Gym Recording App - Enhancement PRD

## Overview
This PRD defines enhancements to the gym recording app focusing on data management, improved metrics, PWA functionality, responsive design, and better UI organization.

## User Stories

### US-001: Delete Workouts

As a gym user, I want to delete workouts so that I can remove mistakes or outdated workouts from my training history.

**Acceptance Criteria:**
- [ ] Delete button available on workout detail page
- [ ] Confirmation dialog shown before deletion
- [ ] Workout permanently removed from database after confirmation
- [ ] Undo available for 30 seconds after deletion
- [ ] All associated exercises and sets cascade deleted
- [ ] Dashboard metrics updated to reflect deletion
- [ ] Error handling if deletion fails

### US-002: Edit Workout Metadata

As a gym user, I want to edit workout date, name, and notes so that I can correct errors or add context to my workouts.

**Acceptance Criteria:**
- [ ] Edit button available on workout detail page
- [ ] Date picker allows changing workout date
- [ ] Name field editable for workout title
- [ ] Notes field supports multi-line text
- [ ] Changes saved immediately (optimistic UI)
- [ ] Validation prevents empty workout dates
- [ ] Edit form accessible from modal or inline
- [ ] Cancel button discards unsaved changes

### US-003: Add Exercises to Workouts

As a gym user, I want to add exercises to existing workouts so that I can complete incomplete workout logs.

**Acceptance Criteria:**
- [ ] "Add Exercise" button available on workout page
- [ ] Exercise selector shows all available exercises
- [ ] Search/filter functionality in exercise selector
- [ ] Selected exercise added to workout
- [ ] New exercise appears with default empty sets
- [ ] Database updated with new exercise-workout relationship
- [ ] Workout volume recalculated
- [ ] No duplicate exercises allowed in same workout

### US-004: Remove Exercises from Workouts

As a gym user, I want to remove exercises from workouts so that I can correct mistakes or clean up my workout log.

**Acceptance Criteria:**
- [ ] Remove/delete button for each exercise in workout
- [ ] Confirmation dialog before removal
- [ ] All sets within exercise cascade deleted
- [ ] Exercise removed from workout view
- [ ] Workout volume recalculated
- [ ] Undo available for 30 seconds
- [ ] Error handling if removal fails

### US-005: Edit Exercise Properties

As a gym user, I want to edit exercise properties within workouts so that I can correct exercise entries.

**Acceptance Criteria:**
- [ ] Edit button for each exercise in workout
- [ ] Exercise name changeable (if not from library)
- [ ] Exercise notes editable
- [ ] Changes save immediately
- [ ] Validation for required fields
- [ ] Cancel option to discard changes
- [ ] Optimistic UI updates
- [ ] Error handling with retry

### US-006: Edit Individual Sets

As a gym user, I want to edit individual set properties (reps, weight, RPE) so that I can correct recording errors.

**Acceptance Criteria:**
- [ ] Each set has edit controls (reps, weight, RPE fields)
- [ ] Changes save on blur/enter
- [ ] Numeric validation (no negative values)
- [ ] RPE validation (1-10 range)
- [ ] Weight supports decimal values
- [ ] Optimistic UI updates
- [ ] Workout volume recalculated immediately
- [ ] Error handling on save failure

### US-007: Delete Individual Sets

As a gym user, I want to delete specific sets from exercises so that I can remove mistake recordings.

**Acceptance Criteria:**
- [ ] Delete button for each set
- [ ] Confirmation dialog before deletion
- [ ] Set removed from exercise view
- [ ] Exercise volume recalculated
- [ ] Workout volume recalculated
- [ ] Undo available for 30 seconds
- [ ] Empty exercise can be deleted if all sets removed
- [ ] Error handling if deletion fails

### US-008: Reorder Sets

As a gym user, I want to reorder sets within exercises so that my workout log reflects the actual order I performed them.

**Acceptance Criteria:**
- [ ] Drag handles available for each set
- [ ] Sets can be reordered via drag-and-drop
- [ ] Reorder also available via up/down buttons
- [ ] New order saved immediately
- [ ] Order persists on page refresh
- [ ] Visual feedback during drag
- [ ] Touch support for mobile
- [ ] Error handling on save failure

### US-009: View Daily Dashboard Metrics

As a gym user, I want to see daily training volume and workout count on the dashboard so that I can track my progress.

**Acceptance Criteria:**
- [ ] Dashboard displays total volume per day (kg × reps)
- [ ] Dashboard displays workout count per day
- [ ] Calendar view with at least 7 days visible
- [ ] Metrics accurate and not double-counted
- [ ] Zero-volume days shown with "0"
- [ ] Last workout date highlighted
- [ ] Metrics load within 500ms
- [ ] Empty state shown for new users

### US-010: View Weekly and Monthly Aggregates

As a gym user, I want to see weekly and monthly volume/workout totals so that I can understand my training patterns.

**Acceptance Criteria:**
- [ ] Weekly volume total displayed
- [ ] Weekly workout count displayed
- [ ] Monthly volume total displayed
- [ ] Monthly workout count displayed
- [ ] Trend indicator vs. previous period (up/down arrow + %)
- [ ] Period toggles (week/month) available
- [ ] Date range labels shown
- [ ] Accurate calculation across week/month boundaries

### US-011: Fix Dashboard Data Accuracy

As a gym user, I want dashboard metrics to be calculated correctly so that I can trust my progress tracking.

**Acceptance Criteria:**
- [ ] Volume calculation formula correct (weight × reps for all sets)
- [ ] Workout count counts each workout once
- [ ] No duplicate sets counted
- [ ] Timezone handling correct for daily metrics
- [ ] Data consistency verified across all views
- [ ] Edge cases handled (empty workouts, zero-weight sets)
- [ ] Test coverage for calculation logic
- [ ] Performance tests for metric queries

### US-012: Install PWA on Mobile Safari

As a mobile user, I want to install the app on my iOS device so that I can access it quickly from my home screen.

**Acceptance Criteria:**
- [ ] "Install App" prompt shows on mobile Safari when eligible
- [ ] App manifest correctly configured
- [ ] Proper icons for all iOS sizes (60x60 to 180x180)
- [ ] App name and short name configured
- [ ] Display mode set to "standalone"
- [ ] Installation instructions shown when prompt not auto-triggered
- [ ] App launches in standalone mode after install
- [ ] No browser chrome in standalone mode

### US-013: Use App Offline

As a mobile user, I want to use the app without internet connection so that I can track workouts at gyms with poor connectivity.

**Acceptance Criteria:**
- [ ] App shell cached for offline use
- [ ] Users can view existing workouts offline
- [ ] Users can add new workouts offline
- [ ] Users can edit/delete workouts offline
- [ ] Offline mode indicator shown in UI
- [ ] Network status detected and communicated
- [ ] Graceful error handling when network unavailable
- [ ] App responsive within 100ms offline

### US-014: Sync Data When Online

As a mobile user, I want my offline changes to sync automatically when I regain internet so that my data is always backed up.

**Acceptance Criteria:**
- [ ] Pending changes tracked in sync queue
- [ ] Auto-sync triggers when connection restored
- [ ] Background sync uses Service Worker Sync API when available
- [ ] Sync progress indicator shown
- [ ] Conflicts resolved (last write wins or user choice)
- [ ] Sync retries exponentially on failure
- [ ] Network error messages user-friendly
- [ ] Manual sync force button available

### US-015: View App on Small Screens

As a mobile user, I want the app layout to adapt to my small screen so that I can use all features on my phone.

**Acceptance Criteria:**
- [ ] All views responsive down to 320px width
- [ ] Layout adjusts for 375px, 414px, 768px breakpoints
- [ ] Tables convert to cards on mobile
- [ ] Horizontal scrolling eliminated where possible
- [ ] Text remains readable at all sizes
- [ ] Images/graphics scale appropriately
- [ ] No content cut off or hidden
- [ ] Touch targets minimum 44px

### US-016: Navigate Easily on Mobile

As a mobile user, I want touch-friendly navigation so that I can move between screens easily.

**Acceptance Criteria:**
- [ ] Bottom navigation bar on mobile
- [ ] Navigation items large enough for touch (44px min)
- [ ] Current page clearly indicated
- [ ] Swipe gestures supported for back navigation
- [ ] Collapsible menus for secondary navigation
- [ ] No z-index layering issues
- [ ] Navigation accessible one-handed
- [ ] Menu transitions smooth and animated

### US-017: Use Touch-Optimized Forms

As a mobile user, I want forms designed for touch input so that I can enter data easily on my phone.

**Acceptance Criteria:**
- [ ] Input fields at least 44px height
- [ ] Proper spacing between inputs (8px min)
- [ ] Touch-friendly number selectors for reps/weight
- [ ] Mobile-optimized date pickers
- [ ] Correct virtual keyboard type for each input
- [ ] Input validation messages clear
- [ ] Auto-focus appropriate fields
- [ ] Form layout follows thumb-friendly zones

### US-018: Access Data Management Features

As a gym user, I want access to import/export features through settings so that I can manage my data in one place.

**Acceptance Criteria:**
- [ ] "Settings" link/page available in main navigation
- [ ] "Data Management" section in settings
- [ ] Import functionality accessible from settings
- [ ] Export functionality accessible from settings
- [ ] Import/export buttons clear and labeled
- [ ] File format options shown
- [ ] Progress indicator during import/export
- [ ] Success/error messages displayed

### US-019: Configure App Preferences

As a gym user, I want to configure app preferences in settings so that the app works the way I prefer.

**Acceptance Criteria:**
- [ ] "App Preferences" section in settings
- [ ] Theme selection (light/dark/system)
- [ ] Measurement units (kg/lb, kg/miles-km)
- [ ] Data display options (decimal places, etc.)
- [ ] Preferences persist across sessions
- [ ] Clear labels for each preference
- [ ] Changes apply immediately
- [ ] Default values sensible

### US-020: Manage Account Settings

As a gym user, I want to manage my account in settings so that all account-related options are in one place.

**Acceptance Criteria:**
- [ ] "Account" section in settings
- [ ] Profile information editable (name, email)
- [ ] Notification preferences available
- [ ] Authentication settings accessible
- [ ] Account deletion option with warning
- [ ] Password change function (if applicable)
- [ ] Account status shown
- [ ] Logout button available

## Requirements

### 1. Edit and Delete Functionality

**Workout Management**
- Delete entire workouts with confirmation dialog
- Edit workout metadata: date, name, notes
- Add/remove exercises within existing workouts

**Exercise Management**
- Edit exercise properties within workouts
- Modify set-based exercise details
- Delete specific exercises from workouts

**Set Management**
- Edit individual set properties (reps, weight, rpe)
- Delete specific sets from exercises
- Reorder sets within exercises

**Technical Requirements**
- All mutations require optimistic UI updates
- Confirmation dialogs for destructive actions
- Undo capability for delete operations
- Transaction support for multi-item changes

### 2. Dashboard Metrics Enhancement

**Daily Metrics**
- Total training volume per day (weight × reps)
- Number of workouts completed per day
- Calendar view with visual indicators

**Aggregated Metrics**
- Weekly volume totals
- Monthly volume totals
- Weekly workout count
- Monthly workout count
- Trend indicators (vs. previous period)

**Data Accuracy Fixes**
- Correct volume calculation bugs
- Fix workout count display issues
- Ensure data consistency across all views

### 3. PWA Improvements

**Installation**
- Fix install prompt on mobile Safari
- Implement proper manifest configuration
- Add to home screen functionality
- App icons for all device types

**Offline Support**
- Service worker for offline caching
- Cache key resources (app shell, data)
- Offline data entry with sync queue
- Background sync when connection restored
- Conflict resolution for offline edits

**Technical Requirements**
- IndexedDB for offline data storage
- Sync queue for pending mutations
- Network-aware UI indicators
- Graceful degradation when offline

### 4. Mobile Responsiveness

**Layout Fixes**
- Responsive grid system for all views
- Touch-friendly component sizing (min 44px targets)
- Mobile-first approach for new components
- Breakpoints: 320px, 375px, 414px, 768px

**Navigation Improvements**
- Bottom navigation for mobile
- Collapsible menus
- Swipe gestures for navigation
- Proper z-index layering

**Component Adjustments**
- Responsive tables/cards for exercise data
- Touch-optimized forms
- Mobile-friendly date pickers
- Proper overflow handling

### 5. Settings Page Reorganization

**New Settings Sections**

**Account Settings**
- Profile information
- Account preferences
- Authentication settings

**App Preferences**
- Theme selection (light/dark/system)
- Measurement units (metric/imperial)
- Notification preferences
- Data display options

**Data Management**
- Import data functionality
- Export data functionality
- Backup creation/restore
- Data clearing/privacy settings

**Moved Features**
- Move import/export from main nav to Settings/Data Management
- Move theme toggle to Settings/App Preferences
- Consolidate all account-related settings

## Non-Functional Requirements

**Performance**
- Dashboard loads within 500ms on mobile
- Offline data sync completes within 30s when online
- Edit/delete operations respond within 200ms locally

**Accessibility**
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

**Compatibility**
- iOS Safari 14+
- Chrome for Android 90+
- Desktop browsers: Chrome, Firefox, Safari, Edge

## Success Criteria

- Users can edit/delete workouts, exercises, and sets with full granularity
- Dashboard accurately displays daily, weekly, and monthly metrics
- PWA installs correctly on mobile Safari and works offline
- App is fully responsive and functional on devices 320px-1920px
- Settings page contains all migrated management functions
- No regression in existing functionality

## Dependencies

- Existing data models support granular edits
- PWA infrastructure partially in place
- Service worker implementation capability
- IndexedDB support in target browsers

## Open Questions

None - requirements fully defined.