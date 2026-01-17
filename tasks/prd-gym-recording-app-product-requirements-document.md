# Gym Recording App - Product Requirements Document

## Overview
A progressive web app (PWA) single-page application for personal workout tracking. The app focuses on pre-workout planning with real-time logging during sessions, comprehensive progress visualization, and complete local data storage with backup capabilities.

## Target User
Primary: Personal use for individual fitness enthusiasts who want to track workouts, monitor progress, and analyze performance trends over time.

## Core Features

### 1. Exercise Management
**Status:** Must Have
- Pre-loaded database of common exercises (bench press, squat, deadlift, overhead press, rows, pull-ups, bicep curls, tricep extensions, leg press, lunges, etc.)
- Categories: Compound (multi-joint), Isolation (single-joint), Cardio, Mobility
- Muscle group tagging (Chest, Back, Legs, Shoulders, Arms, Core, Full Body)
- Custom exercise creation by users
- Exercise details: name, category, primary muscle group, secondary muscle groups, equipment needed
- Search and filter exercises

### 2. Workout Planning
**Status:** Must Have
- Create workout routines/templates for different training days (Push Day, Pull Day, Legs, etc.)
- Add exercises to workouts with target sets, reps, and weight
- Copy/paste workouts for easy routine creation
- Save multiple workout routines
- Preview complete workout before starting
- Estimated time calculation (based on set durations)

### 3. Session Logging
**Status:** Must Have
- Start active workout from planned routine
- Log actual sets, reps, weight during workout
- Mark sets as complete with checkbox
- Note field for comments per exercise
- Rest timer between sets
- Finish session to save all data
- Session timestamping (start time, end time)

### 4. Data Storage
**Status:** Must Have
- IndexedDB for local persistence
- Store: exercises, workouts, sessions, settings
- Automatic save after each interaction
- No backend required - completely client-side
- Data schema versioning for future migrations

### 5. Backup & Restore
**Status:** Must Have
- Export all data to JSON file
- Import data from JSON backup
- Validation of backup data before import
- Conflict resolution for duplicates on import
- Timestamp on backup files

### 6. Progress Analytics
**Status:** Must Have
- Per-exercise weight progression graphs over time
- Per-exercise volume tracking (total weight × reps) charts
- Personal Records (PR) detection and display
- PR notifications when beaten
- Workout frequency calendar
- Total sessions tracked
- Muscle group breakdown (pie chart showing exercise distribution)

### 7. PWA Capabilities
**Status:** Must Have
- Service worker for offline functionality
- Installable as home screen app
- Responsive design for mobile and desktop
- Touch-friendly interface
- Fast loading and interactions

## User Stories

### US-001: Browse and Search Exercises
**As a** fitness enthusiast  
**I want to** browse and search through available exercises  
**So that** I can quickly find the exercises I want to include in my workout

**Acceptance Criteria:**
- [ ] User can view a list of all available exercises
- [ ] User can search exercises by name
- [ ] User can filter exercises by category (compound, isolation, cardio, mobility)
- [ ] User can filter exercises by primary muscle group
- [ ] User can see exercise details including name, category, muscle groups, and equipment
- [ ] Search results update in real-time as user types
- [ ] Empty state is displayed when no exercises match search criteria

### US-002: Create Custom Exercises
**As a** fitness enthusiast  
**I want to** create my own custom exercises  
**So that** I can track movements that aren't in the default database

**Acceptance Criteria:**
- [ ] User can create a new exercise with a required name field
- [ ] User can select category from dropdown (compound, isolation, cardio, mobility)
- [ ] User can select primary muscle group from dropdown
- [ ] User can add multiple secondary muscle groups
- [ ] User can enter equipment text
- [ ] Custom exercises are marked and distinguished from pre-loaded exercises
- [ ] Custom exercises appear in exercise list immediately after creation
- [ ] Validation prevents creating exercises without required fields

### US-003: Create Workout Routine
**As a** fitness enthusiast  
**I want to** create workout routines with multiple exercises  
**So that** I can plan my workouts in advance

**Acceptance Criteria:**
- [ ] User can create a new workout with a required name
- [ ] User can search and select exercises to add to the workout
- [ ] User can set target sets, reps, and weight for each exercise
- [ ] User can reorder exercises in the workout list
- [ ] User can remove exercises from the workout
- [ ] User can add notes to the workout
- [ ] Workout automatically saves after changes
- [ ] User can preview the complete workout before starting

### US-004: Copy Workout Routine
**As a** fitness enthusiast  
**I want to** duplicate an existing workout routine  
**So that** I can create variations without starting from scratch

**Acceptance Criteria:**
- [ ] User can access a "Copy" option on any saved workout
- [ ] Copying creates a new workout with all exercises and settings from the original
- [ ] Copied workout has "(Copy)" appended to the name initially
- [ ] User can immediately edit the copied workout
- [ ] Original workout remains unchanged
- [ ] Copied workout appears in workout list immediately

### US-005: Start Workout Session
**As a** fitness enthusiast  
**I want to** start an active workout session from a planned routine  
**So that** I can track my actual performance during the workout

**Acceptance Criteria:**
- [ ] User can select a saved workout to start
- [ ] Session starts when user confirms and the start time is recorded
- [ ] Active session displays all exercises with planned sets, reps, and weight
- [ ] User cannot edit the workout structure once session starts
- [ ] User can end the session at any time
- [ ] Session is saved when completed with end time recorded
- [ ] In-progress sessions persist if app is closed and can be resumed

### US-006: Log Sets During Workout
**As a** fitness enthusiast  
**I want to** log actual sets, reps, and weight during my workout  
**So that** I can track my real performance

**Acceptance Criteria:**
- [ ] User can input reps and weight for each set
- [ ] User can mark each set as complete with a checkbox
- [ ] User can add notes to individual sets
- [ ] Data saves automatically after each set is completed
- [ ] User can edit previously logged sets before finishing the session
- [ ] User can see progress for current exercise (completed sets vs total sets)

### US-007: Use Rest Timer
**As a** fitness enthusiast  
**I want to** have a rest timer between sets  
**So that** I can maintain consistent rest intervals

**Acceptance Criteria:**
- [ ] Rest timer automatically starts after completing a set
- [ ] Timer displays countdown visually and with remaining time
- [ ] User can pause and resume the timer
- [ ] User can manually adjust the timer duration
- [ ] Timer emits sound or vibration when time is complete
- [ ] User can skip the rest timer and move to next set
- [ ] Timer duration is configurable in settings

### US-008: View Workout History
**As a** fitness enthusiast  
**I want to** view a list of all my past workout sessions  
**So that** I can see my training history

**Acceptance Criteria:**
- [ ] User can view all completed workout sessions in reverse chronological order
- [ ] Each session shows workout name, date, duration, and summary
- [ ] User can click on any session to view full details
- [ ] Session detail view shows all exercises with logged sets
- [ ] User can filter sessions by workout type or date range
- [ ] Pagination or infinite scroll handles large lists
- [ ] Empty state is shown when no sessions exist

### US-009: Export Workout Data
**As a** fitness enthusiast  
**I want to** export all my workout data to a JSON file  
**So that** I can back up my data and transfer it to other devices

**Acceptance Criteria:**
- [ ] User can access export option from settings menu
- [ ] Export generates a JSON file containing all exercises, workouts, and sessions
- [ ] Export includes timestamp in the filename
- [ ] Export shows confirmation message when complete
- [ ] File downloads automatically to user's default download location
- [ ] Exported data is human-readable JSON format
- [ ] Large exports complete with progress indicator

### US-010: Import Backup Data
**As a** fitness enthusiast  
**I want to** import workout data from a backup file  
**So that** I can restore my data or move to a new device

**Acceptance Criteria:**
- [ ] User can select a JSON file to import
- [ ] System validates the file format before importing
- [ ] Conflicting data (duplicate IDs) prompts user for resolution (replace, skip, merge)
- [ ] Import shows progress indicator for large files
- [ ] Import shows success/failure summary after completion
- [ ] User can cancel import mid-process with confirmation
- [ ] Invalid files show clear error messages

### US-011: View Exercise Progress Graphs
**As a** fitness enthusiast  
**I want to** see weight progression graphs for each exercise  
**So that** I can visualize my improvement over time

**Acceptance Criteria:**
- [ ] User can select an exercise to view its progression graph
- [ ] Graph shows weight on Y-axis and dates on X-axis
- [ ] Each logged session is represented as a data point
- [ ] User can toggle between different metrics (weight, volume, reps)
- [ ] Graph shows trend line to indicate progress direction
- [ ] User can zoom in on specific date ranges
- [ ] Empty state is shown when exercise has no logged sessions

### US-012: Track Personal Records
**As a** fitness enthusiast  
**I want to** see my personal records for each exercise  
**So that** I can celebrate my achievements and set new goals

**Acceptance Criteria:**
- [ ] System automatically detects PRs (highest weight for given rep range)
- [ ] PRs are displayed prominently on exercise view
- [ ] When a user beats a PR during a session, a notification is shown
- [ ] PRs are organized by rep range (e.g., 1RM, 5RM, 8RM, 10RM)
- [ ] User can view all PRs in a dedicated PR dashboard
- [ ] PR history shows when each record was achieved
- [ ] PRs are calculated from all historical session data

### US-013: View Workout Analytics Dashboard
**As a** fitness enthusiast  
**I want to** see overall analytics about my training  
**So that** I can understand my workout patterns and trends

**Acceptance Criteria:**
- [ ] Dashboard shows total number of sessions completed
- [ ] Dashboard shows total training time
- [ ] Dashboard shows workout frequency calendar (which days user worked out)
- [ ] Dashboard shows muscle group breakdown pie chart
- [ ] Dashboard shows volume trends over time
- [ ] User can filter dashboard by date range (week, month, year, custom)
- [ ] Dashboard updates in real-time as new sessions are logged

### US-014: Install as PWA
**As a** fitness enthusiast  
**I want to** install the app on my device  
**So that** I can access it easily and use it offline

**Acceptance Criteria:**
- [ ] App is installable as PWA on supported browsers
- [ ] App displays install prompt when criteria are met
- [ ] When installed, app launches as standalone window
- [ ] Installed app works completely offline
- [ ] App icon appears on device home screen
- [ ] App has appropriate name and description in app store
- [ ] Service worker caches all static assets for offline use

## Data Model

### Exercise
```
{
  id: string (UUID),
  name: string,
  category: "compound" | "isolation" | "cardio" | "mobility",
  primary_muscle: "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full-body",
  secondary_muscles: string[],
  equipment: string,
  is_custom: boolean
}
```

### Workout
```
{
  id: string (UUID),
  name: string,
  created_at: timestamp,
  exercises: [
    {
      exercise_id: string,
      target_sets: number,
      target_reps: string (e.g., "8-10"),
      target_weight: number,
      order: number
    }
  ],
  notes: string
}
```

### Session
```
{
  id: string (UUID),
  workout_id: string,
  workout_name: string,
  started_at: timestamp,
  completed_at: timestamp,
  exercises: [
    {
      exercise_id: string,
      exercise_name: string,
      sets: [
        {
          reps: number,
          weight: number,
          completed: boolean,
          notes: string
        }
      ]
    }
  ],
  total_volume: number,
  total_sets: number
}
```

### Settings
```
{
  backup_reminder_frequency: number (days),
  rest_timer_duration: number (seconds),
  preferred_units: "kg" | "lbs"
}
```

## Technical Stack

### Frontend
- Framework: SvelteKit (Svelte 5)
- Styling: Tailwind CSS
- State Management: Svelte 5 Runes ($state, $derived)
- Charts: Chart.js or Plotly.js
- Icons: Lucide Svelte
- PWA: Vite PWA Plugin

### Storage
- IndexedDB via Dexie.js wrapper
- LocalStorage for user preferences

### Build Tools
- Vite
- TypeScript
- ESLint, Prettier

## Non-Functional Requirements

### Performance
- Initial load time: < 3 seconds
- Interaction response: < 100ms
- Offline-first architecture
- Efficient IndexedDB queries

### Usability
- Mobile-first responsive design
- Large touch targets (min 44px)
- Clear visual hierarchy
- Dark mode support
- Intuitive navigation (max 3 taps to any action)

### Reliability
- Data integrity checks on import/export
- Graceful error handling
- Auto-save functionality
- No data loss on page refresh

### Security
- All data stored locally (privacy-focused)
- No external API calls
- No tracking/analytics

## MVP Feature Prioritization

### Phase 1 - Foundation (Week 1-2)
1. Basic exercise management (CRUD)
2. Simple workout creation
3. Session logging with sets/reps/weight
4. IndexedDB storage implementation
5. Basic PWA setup

### Phase 2 - Core Tracking (Week 3-4)
1. Pre-loaded exercise database
2. Workout templates
3. Rest timer
4. Session history view
5. JSON import/export

### Phase 3 - Analytics (Week 5-6)
1. Exercise progression graphs
2. Volume tracking charts
3. PR detection and display
4. Session list with filters
5. Muscle group breakdown

### Phase 4 - Polish (Week 7-8)
1. Dark mode
2. Offline caching refinement
3. Performance optimization
4. Bug fixes and edge cases
5. User testing and feedback

## Success Metrics
- Successfully log and retrieve 100+ workout sessions without performance degradation
- Import/export data accurately across different devices/browsers
- Complete a workout session from start to finish in under 5 minutes
- Load app and navigate to any section in under 2 seconds offline

## Out of Scope
- Cloud synchronization (future consideration)
- Social sharing features
- Nutrition tracking
- Meal planning
- Wearable device integration
- Video demonstrations
- Community features

## Success Criteria
- Users can plan a workout routine in under 5 minutes
- Users can log a workout session in real-time without friction
- Users can visualize progress trends for any exercise
- All data is stored locally and can be backed up/restored
- App works completely offline and installs as PWA