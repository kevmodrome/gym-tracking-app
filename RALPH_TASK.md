---
task: Build a Gym‑Session PWA  
test_command: "npm run test"
---

# Task: Gym‑Session Progressive Web App

Create a mobile‑first PWA that lets users record gym sessions (exercise → sets, reps, weight), shows the last entered values for each exercise, provides a calendar for navigation, and stores **all data only in `localStorage`**. The UI must be built with **shadcn/ui** (React + Tailwind) and the app must be installable/offline‑ready.

## Success Criteria

- [ ] **PWA Manifest & Service Worker** – correct manifest, service worker caches assets, offline fallback works, install prompt appears.  
- [ ] **Calendar View** – month grid, tappable days, indicator for saved workouts, swipe/month navigation, mobile‑friendly touch targets.  
- [ ] **Session (Day) Page** – header with date, add‑exercise dialog, set add/remove, weight/reps inputs, “last value” hints, save button with toast, undo toast for deletions.  
- [ ] **LocalStorage Persistence** – data saved under a single key, re‑hydrated on start, debounced writes, graceful error handling, never leaves the device.  
- [ ] **Context / State Management** – `WorkoutContext` with CRUD helpers, `useWorkout(date)` hook, automatic persistence.  
- [ ] **Responsive & Accessible UI** – shadcn/ui components, dark‑mode toggle, ARIA labels, keyboard navigation, layout adapts to tablets.  
- [ ] **Testing** – unit tests for storage & context, component tests, integration/e2e tests (offline, calendar navigation), all pass (`npm run test`).  
- [ ] **Documentation & Release** – README with install guide & privacy statement, Lighthouse ≥ 90, deployed over HTTPS, installable from URL.

---

## Implementation Checklist

### 1️⃣ Project Planning & Requirements
- [ ] Define core user‑flows (new session, edit session, calendar navigation, quick add).  
- [ ] Write a feature spec document (functional & non‑functional).  
- [ ] Sketch low‑fidelity mobile mock‑ups (Figma/figjam).  
- [ ] Choose tech stack (React 18 + Vite, TypeScript, shadcn/ui, Tailwind, localStorage).  
- [ ] Draft data model (JSON schema) for workouts.  
- [ ] Set up a project board (Backlog → To Do → In Progress → Review → Done).

### 2️⃣ Repository & Tooling Setup
- [ ] Create Git repository with branch protection & PR template.  
- [ ] Initialise Vite‑React + TypeScript (`npm create vite@latest`).  
- [ ] Install TailwindCSS & configure `tailwind.config.js`.  
- [ ] Add shadcn/ui components (`npx shadcn-ui@latest init`).  
- [ ] Configure ESLint, Prettier, and husky pre‑commit hooks.  
- [ ] Add Vitest + React Testing Library for unit tests.  
- [ ] Install `vite-plugin-pwa` (or equivalent) for service‑worker generation.  
- [ ] Write a lightweight `useLocalStorage` hook (type‑safe JSON handling).  
- [ ] Set up GitHub Actions CI: lint → test → build → (optional) deploy.

### 3️⃣ Architecture & Global State
- [ ] Create `WorkoutContext` (React context) with state & mutation functions.  
- [ ] Persist context changes to localStorage (debounced, e.g., 300 ms).  
- [ ] Implement re‑hydration logic on app start (read from storage, fallback to empty).  
- [ ] Write date‑utility functions (`formatDate`, `parseDate`, `getTodayKey`).  
- [ ] Register service worker via the PWA plugin.  
- [ ] Build custom hook `useWorkout(date)` that returns day data + mutation helpers.

### 4️⃣ UI Components (shadcn/ui)

#### 4.1 Global Layout
- [ ] Build `AppShell` component (header, main content, optional footer).  
- [ ] Add mobile meta viewport tag.  
- [ ] Implement dark‑mode toggle (Tailwind `dark:` classes).  

#### 4.2 Calendar View
- [ ] Use shadcn/ui **Calendar** component to render month grid.  
- [ ] Make each day a large button (≥ 44 px) linking to that day’s session.  
- [ ] Show dot/indicator for days with saved workouts.  
- [ ] Add swipe gestures for month navigation (`react-swipeable`).  
- [ ] Add “Today” shortcut button.  
- [ ] Implement year navigation (dropdown or arrows).  

#### 4.3 Session (Day) Page
- [ ] Header with selected date and back‑to‑calendar button.  
- [ ] Exercise list: each exercise in a **Collapsible** card.  
- [ ] Inside each card:  
  - [ ] Input fields for Weight & Reps (type=number).  
  - [ ] “Add Set” button → adds a new set row with auto‑incremented set number.  
  - [ ] Delete set button (trash icon).  
  - [ ] “Last value” hint beneath each input (pulled from context).  
- [ ] “Add Exercise” button opens a **Dialog** with searchable dropdown/free‑text entry.  
- [ ] Sticky “Save” button at bottom → updates context & shows toast confirmation.  
- [ ] Auto‑focus first empty field when adding a set/exercise.  
- [ ] Numeric keypad on mobile for weight/reps inputs.  
- [ ] Responsive layout: vertical list on phones, table‑like grid on tablets.  
- [ ] Undo toast after deletions (with “Undo” action).  

#### 4.4 Settings / Help (Optional)
- [ ] “Clear all data” button with confirmation dialog.  
- [ ] PWA install prompt handling (`beforeinstallprompt`).  
- [ ] Short FAQ about offline usage & privacy.

### 5️⃣ Persistence – LocalStorage Implementation
- [ ] Define storage key constant (`const STORAGE_KEY = 'gym-pwa:workouts'`).  
- [ ] Write `loadWorkouts()` & `saveWorkouts(data)` utilities with error handling.  
- [ ] Add version field to stored JSON for future migrations.  
- [ ] Implement a placeholder migration function (run on load).  
- [ ] Guard against quota‑exceeded errors → show toast notification.  
- [ ] Ensure no network requests are made anywhere in the code.  
- [ ] Add unit tests for storage utilities (Vitest).

### 6️⃣ PWA Specific Tasks
- [ ] Create `manifest.json` (name, icons, start_url, display, colors, orientation).  
- [ ] Configure `vite-plugin-pwa` with:  
  - `registerType: 'autoUpdate'`  
  - Cache‑first strategy for assets, network‑only for any external request (none).  
- [ ] Build `offline.html` fallback page with friendly offline message.  
- [ ] Write service‑worker install & fetch listeners to pre‑cache and serve from cache.  
- [ ] Test installability on Android & iOS browsers.  
- [ ] Verify full offline operation (add/edit workouts with network disabled).  
- [ ] Run Lighthouse PWA audit and fix any issues.  
- [ ] Add maskable app icons (192 px & 512 px).  
- [ ] Ensure deployment over HTTPS (required for PWA).

### 7️⃣ Quality Assurance
- [ ] Write component unit tests for Calendar, Exercise card, Dialog, Toast, etc.  
- [ ] Write integration/e2e tests covering: create session → verify persistence after reload → offline usage.  
- [ ] Perform manual UI review on multiple devices (iPhone, Android, tablet, Chrome responsive).  
- [ ] Run Lighthouse audit; aim for ≥ 90 in all categories.  
- [ ] Conduct accessibility audit (ARIA, focus order, color contrast).  
- [ ] Test storage edge cases (large data, corrupted JSON, quota exceeded).  
- [ ] Verify keyboard navigation works for all interactive elements.  
- [ ] Check bundle size (< 150 KB gzipped) and enable gzip/brotli compression.  

### 8️⃣ Documentation & Release
- [ ] Write a comprehensive README (project description, dev/run/build commands, PWA install guide, privacy statement).  
- [ ] Add a Changelog (Keep a Changelog format).  
- [ ] Include FAQ / privacy note: “All data stays in your browser; we never send it anywhere.”  
- [ ] Deploy to a static host with HTTPS (GitHub Pages, Netlify, Vercel, etc.).  
- [ ] Tag the first production release (`v1.0.0`).  
- [ ] Set up post‑release monitoring (storage quota, console errors).  
- [ ] Provide a simple feedback mechanism (mailto link) – no server needed.

### 9️⃣ Optional Future Enhancements
- [ ] Export / Import JSON backup feature.  
- [ ] Workout templates for common routines.  
- [ ] Statistics / charts (weekly volume).  
- [ ] Multiple local profiles (different storage keys).  
- [ ] Auto‑increment weight suggestion based on previous session.  
- [ ] Voice input for adding sets (Web Speech API).  

---  

When **all** checkboxes above are ticked and the test suite passes (`npm run test` exits with status 0), the Gym‑Session PWA is considered complete, installable, fully functional offline, and ready for users to record their workouts securely on their own devices. 🚀
