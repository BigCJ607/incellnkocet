# Refactor Data Layer for Backend Readiness

This plan outlines the steps to restructure the application's data layer, extracting static mock data imports into a structured service layer and centralized context to ensure seamless backend integration in the future.

## User Review Required

Please review the proposed structure for the Services and Context. Let me know if you prefer a specific state management library (like Zustand or Redux) instead of standard React Context for the global state (auth, team, etc.).

## Proposed Changes

---

### Mocks Layer
Move all mock data to a dedicated folder and ensure strict TypeScript interfaces matching the expected backend schema.

#### [NEW] `src/mocks/types.ts`
- Define full TypeScript interfaces: `User`, `Team`, `EventData`, `ScheduleDay`, `Session`, `Speaker`, `Message`, `Submission`, `UserTicket`.

#### [NEW] `src/mocks/data.ts`
- Migrate existing mock data (`mockEvents`, `pastEvents`, `userTickets`) from `src/data/mockEvents.ts`.
- Add new mock datasets for `users`, `teams`, `messages`, and `submissions`.

#### [DELETE] `src/data/mockEvents.ts`
- Remove the old unstructured mock data file.

---

### Service Layer
Introduce a thin API layer. These services will initially return the mock data using Promises (with simulated network delays) but will eventually be swapped to use `fetch` or `axios`.

#### [NEW] `src/services/authService.ts`
- `login(email, password)`: Returns a `User` session.
- `register(name, email, password)`
- `logout()`
- `getCurrentUser()`

#### [NEW] `src/services/eventService.ts`
- `getEvents()`: Returns upcoming events.
- `getEventById(id)`
- `getPastEvents()`
- `getUserTickets(userId)`
- `registerForEvent(eventId, userId, ...details)`

#### [NEW] `src/services/teamService.ts`
- `getTeam(teamId)`
- `createTeam(name, members)`
- `sendTeamInvite(teamId, email)`

#### [NEW] `src/services/chatService.ts`
- `getMessages(teamId)`
- `sendMessage(teamId, message)`

#### [NEW] `src/services/submissionService.ts`
- `submitCode(teamId, eventId, repoUrl, description)`
- `getSubmissions(eventId)`

---

### State Management
Consolidate global state (like active user session, user's team, and UI state) into a unified context so it doesn't rely on scattered `useState`.

#### [NEW] `src/context/AppContext.tsx`
- Create `AppProvider` and `useApp` hook.
- State: `user` (active session), `tickets` (user's registrations).
- Actions: `login`, `logout`, `refreshTickets`.

#### [MODIFY] `src/App.tsx`
- Wrap the application tree with `<AppProvider>`.

---

### Component Refactoring
Update pages and components to stop importing static mock data and instead fetch it through the new service layer.

#### [MODIFY] `src/pages/AuthPage.tsx`
- Connect to `authService.login()` and update the global `AppContext` user state.

#### [MODIFY] `src/pages/EventsListingPage.tsx`
- Fetch events using `eventService.getEvents()` in a `useEffect`.

#### [MODIFY] `src/pages/EventDetailPage.tsx`
- Fetch single event using `eventService.getEventById(id)` in a `useEffect`.

#### [MODIFY] `src/pages/MyTicketsPage.tsx`
- Fetch tickets using `eventService.getUserTickets(user.id)`.

#### [MODIFY] `src/components/layout/RegistrationPanel.tsx`
- Refactor the form submission to use `eventService.registerForEvent()`.

---

### Documentation

#### [NEW] `API_CONTRACT.md`
- Document the exact REST/GraphQL API shape expected by the frontend based on the defined services, including request bodies and response schemas.

## Verification Plan
### Automated Tests
- Run `npm run build` and `npm run lint` to ensure type safety is maintained and no imports are broken.

### Manual Verification
- Navigate through the app (Home, Details, Auth, Tickets).
- Ensure data loads correctly (with a slight simulated delay).
- Verify the Auth flow correctly updates global context state.
