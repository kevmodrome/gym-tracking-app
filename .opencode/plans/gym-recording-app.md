# Gym Recording App

## Overview
A client-side SPA for tracking workouts, exercises, and progress. Uses React + Vite, shadcn/ui for components, and persists all data to localStorage/IndexedDB with full PWA support.

## Tasks

- [x] **Set up React SPA project structure**
  - Initialize Vite + React project
  - Install and configure shadcn/ui
  - Set up PWA configuration (vite-plugin-pwa: manifest, service worker)
  - Install dependencies (React hooks, local storage utilities)

- [x] **Create data models and types**
  - Define TypeScript interfaces for Workout, Exercise, Set, etc.
  - Implement localStorage/IndexedDB persistence utilities
  - Create custom hooks for data management (useWorkouts, useLocalStorage)
  - Set up data migration/versioning strategy

- [ ] **Build exercise library**
  - Create exercise database/common exercises
  - Build exercise selection interface with shadcn components (dialog, combobox)
  - Add ability to add custom exercises with shadcn forms

- [ ] **Implement workout logging**
  - Create workout session interface
  - Build set tracking (weight, reps, RPE) using shadcn inputs and forms
  - Add timer functionality for rest periods
  - Implement workout completion and save to client storage

- [ ] **Create workout history view**
  - Build workout list view with shadcn cards/table
  - Implement workout detail view
  - Add filtering and sorting options with shadcn dropdowns

- [ ] **Add progress tracking**
  - Create exercise progress visualization (charts)
  - Build personal records tracking
  - Implement progress trends over time

- [ ] **Configure PWA features**
  - Configure vite-plugin-pwa with manifest and service worker
  - Set up offline caching strategies for SPA
  - Add install prompt UI with shadcn components
  - Configure app icons and splash screens

- [ ] **Polish UI/UX**
  - Implement responsive SPA routing (React Router)
  - Add dark/light mode theme support (next-themes)
  - Optimize mobile and PWA experience
  - Add loading states and error handling