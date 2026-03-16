# TimeTracker — Project Progress & Context Document

> Last updated: 2026-03-10
> Purpose: Full context for continuing development across sessions/chats.
> Audience: Internal tool — personal use only (single user + invited teammates).

---

## 1. Project Overview

**TimeTracker** (CLOCKEAPP) is a cross-platform time-tracking app with team collaboration, built with:
- **Expo SDK 54** (`expo@54.0.33`)
- **React Native 0.81.5**
- **React 19.1.0**
- **Expo Router v6** (file-based routing)
- **Supabase** — auth, database, RLS (replaces local storage entirely)
- **TypeScript**, **react-native-safe-area-context**, **react-native-reanimated 4.1.1**

The app runs primarily on **web** (`npx expo start --web` → `localhost:8081`) and on **iOS/Android** via Expo Go.

---

## 2. Design System

**Color Palette (Pumpkin + Charcoal theme):**
| Token | Hex | Usage |
|---|---|---|
| Pumpkin | `#fe7f2d` | Primary actions, highlights, durations |
| Charcoal | `#233d4d` | Cards, headers, secondary backgrounds |
| Dark BG | `#1e3545` | Page backgrounds |
| Border | `#2d4f62` | Card borders, dividers |
| Text Primary | `#ffffff` | Headings, project names |
| Text Muted | `#7aa3b8` | Labels, hints, secondary info |
| Text Faint | `#4a6d80` | Placeholders, very muted |
| Red | `#EF4444` | Clock Out / destructive actions |
| Green | `#4ade80` | Live Now indicator, Achieved outcome |

**Typography:**
- Labels: `11px`, uppercase, `letterSpacing: 2`, `fontWeight: 700`, color `#7aa3b8`
- Headings: `22–26px`, `fontWeight: 700`, white
- Body: `15–16px`, white or `#7aa3b8`
- Timer (working screen): `80px`, `fontWeight: 200`, white
- Live timer (home hero): `44px`, `fontWeight: 200`, pumpkin orange

**Layout:**
- Horizontal padding: `16px`
- Section spacing: `12px`
- Card padding: `16px`
- Border radius: `16px` (cards/buttons), `12px` (smaller elements), `100px` (badges/pills)
- All cards: `backgroundColor: #233d4d`, `borderWidth: 1`, `borderColor: #2d4f62`
- Buttons use `shadowColor` matching button color for glow effect

**SafeAreaView:** Use from `react-native-safe-area-context` (NOT from `react-native` — deprecated).

---

## 3. File Structure

```
TimeTracker/
├── app/
│   ├── _layout.tsx          # Stack navigator + auth guard; headerShown: false on main screens
│   ├── index.tsx            # Home: context-aware hero, Live Now, tabs (Your/Team Sessions), fixed bottom bar
│   ├── login.tsx            # "TURN TIME INTO PROGRESS." + clock illustration
│   ├── register.tsx         # Sign-up + optional team code (stored in user_metadata)
│   ├── clock-in.tsx         # Multi-step picker: combos → client → project → activity → objectives
│   ├── working.tsx          # Active session: timer, checklist toggle, Take a Break, Clock Out
│   ├── session-recap.tsx    # Post-session: checklist review + auto-suggested outcome + notes
│   ├── edit-session.tsx     # Edit notes on a completed session (from history)
│   ├── history.tsx          # All team sessions grouped by day; objectives loaded per session
│   ├── stats.tsx            # Analytics: donut charts + by-client + by-activity horizontal bars
│   ├── profile.tsx          # User info + team switcher + members + clients + activity types + logout
│   └── create-team.tsx      # Create a new team and get its code
├── components/
│   ├── Timer.tsx            # Displays net work time (excludes breaks)
│   ├── ProjectCard.tsx      # Project row with colored accent + edit button
│   ├── SessionItem.tsx      # Session row: project + client · activity meta + expand: checklist → outcome → notes
│   ├── Navbar.tsx           # Responsive navbar: desktop 3-col / mobile hamburger dropdown
│   ├── TickingClock.tsx     # Animated overlay on session start (2.5s fade-out)
│   └── MilestoneConfetti.tsx # 8-particle burst at 60-min milestone (fires once per session)
├── contexts/
│   └── AuthContext.tsx      # Auth + multi-team state; syncs profiles.full_name on login
├── database/
│   ├── types.ts             # Team, Client, ActivityType, RecentCombo, Project, Session, SessionObjective
│   ├── storage.d.ts         # TypeScript declarations for platform storage modules
│   ├── storage.web.ts       # Supabase implementation (team-scoped queries)
│   └── storage.native.ts    # Identical to storage.web.ts (both use Supabase)
├── lib/
│   └── supabase.ts          # Supabase client (URL + anon key)
├── utils/
│   ├── time.ts              # formatDuration, formatMinutes, formatTime, formatDate, getElapsedSeconds
│   └── sounds.ts            # Web Audio API: playClockInSound(), playClockOutSound()
└── docs/
    └── PROJECT_PROGRESS.md  # This file
```

---

## 4. Data Models

### `Team`
```ts
interface Team {
  id: string;           // UUID
  name: string;
  code: string;         // 8-char uppercase invite code
  created_by: string | null;
}
```

### `Client`
```ts
interface Client {
  id: string;           // UUID
  name: string;
  team_id: string;      // UUID
  is_internal: boolean;
  created_by?: string;
  created_at: string;
}
```

### `ActivityType`
```ts
interface ActivityType {
  id: string;           // UUID
  name: string;
  color: string;
  team_id: string;
}
```

### `RecentCombo`
```ts
interface RecentCombo {
  client_id: string;
  project_id: number;
  activity_type_id: string;
  client_name: string;
  project_name: string;
  project_color: string;
  activity_name: string;
  activity_color: string;
}
```

### `Project`
```ts
interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;
  team_id?: string;
  client_id?: string;       // FK → clients.id
  client_name?: string;     // denormalized for display
  status: 'active' | 'archived';
}
```

### `Session`
```ts
interface Session {
  id: number;
  user_id: string;
  project_id: number;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  break_start: string | null;
  total_break_seconds: number;
  notes?: string;
  objective?: string;           // legacy single-text (backward compat)
  outcome?: 'achieved' | 'partial' | 'missed';
  is_billable: boolean;
  // denormalized for display
  project_name?: string;
  project_color?: string;
  user_full_name?: string;
  client_id?: string;
  client_name?: string;
  activity_type_id?: string;
  activity_name?: string;
}
```

### `SessionObjective`
```ts
interface SessionObjective {
  id: string;           // UUID
  session_id: number;
  text: string;
  completed: boolean;
  position: number;
  created_at: string;
}
```

### `SessionInterval`
```ts
interface SessionInterval {
  id: string;           // UUID
  session_id: number;
  start_time: string;
  end_time: string | null;
}
```

---

## 5. Supabase Schema

### Tables
| Table | Key Columns |
|---|---|
| `auth.users` | Supabase managed |
| `profiles` | `id`, `full_name`, `team_id` (legacy), `active_team_id` |
| `teams` | `id`, `name`, `code`, `created_by` |
| `team_members` | `user_id`, `team_id`, `joined_at` |
| `clients` | `id`, `name`, `team_id`, `is_internal`, `created_by`, `created_at` |
| `activity_types` | `id`, `name`, `color`, `team_id`, `created_at` |
| `projects` | `id`, `name`, `color`, `description`, `team_id`, `user_id`, `client_id`, `status` |
| `sessions` | `id`, `user_id`, `project_id`, `start_time`, `end_time`, `duration_minutes`, `break_start`, `total_break_seconds`, `notes`, `objective`, `outcome`, `client_id`, `activity_type_id`, `is_billable` |
| `session_objectives` | `id`, `session_id`, `text`, `completed`, `position`, `created_at` |
| `session_intervals` | `id`, `session_id`, `start_time`, `end_time` |

### RLS Policies
- **clients**: Team members can CRUD via `team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())`
- **activity_types**: Same as clients
- **projects**: SELECT/INSERT for team members; UPDATE for team members
- **sessions**: own sessions full CRUD; teammates' sessions SELECT if project in shared team
- **session_objectives**: owner full CRUD; teammates SELECT
- **profiles**: own profile always; teammates' profiles SELECT via `get_teammate_ids()` security definer

### Security Definer Functions
```sql
-- Returns all user_ids in teams shared with p_user_id
CREATE OR REPLACE FUNCTION get_teammate_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM team_members
  WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = p_user_id);
$$;

-- Server-side clock out
CREATE OR REPLACE FUNCTION clock_out_session(p_session_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ ... $$;

-- Admin flush sessions
CREATE OR REPLACE FUNCTION admin_flush_sessions(p_cutoff TIMESTAMPTZ, p_team_id UUID)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ ... $$;
```

### Full SQL Migration (cumulative — run in order)

**Step 1 — Original schema** (sessions objective/outcome, triggers, RLS, session_objectives):
See previous versions of this doc.

**Step 2 — Client → Activity hierarchy (Mar 11, 2026):**
```sql
-- clients table
CREATE TABLE clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  is_internal boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can CRUD clients" ON clients FOR ALL
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- activity_types table
CREATE TABLE activity_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#7aa3b8',
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can CRUD activity_types" ON activity_types FOR ALL
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- projects: add client_id + status
ALTER TABLE projects
  ADD COLUMN client_id uuid REFERENCES clients(id),
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived'));

-- sessions: add client/activity/billable columns
ALTER TABLE sessions
  ADD COLUMN client_id uuid REFERENCES clients(id),
  ADD COLUMN activity_type_id uuid REFERENCES activity_types(id),
  ADD COLUMN is_billable boolean NOT NULL DEFAULT true;

-- Seed existing teams (run once)
DO $$
DECLARE
  r RECORD;
  v_client_id uuid;
BEGIN
  FOR r IN SELECT id FROM teams LOOP
    INSERT INTO clients (name, team_id, is_internal, created_at)
    VALUES ('General', r.id, false, now()) RETURNING id INTO v_client_id;
    INSERT INTO clients (name, team_id, is_internal, created_at)
    VALUES ('Internal', r.id, true, now());
    UPDATE projects SET client_id = v_client_id
    WHERE team_id = r.id AND client_id IS NULL;
    INSERT INTO activity_types (name, color, team_id) VALUES
      ('Development', '#60a5fa', r.id), ('Debugging', '#f87171', r.id),
      ('Design', '#c084fc', r.id), ('Research', '#fbbf24', r.id),
      ('Planning', '#4ade80', r.id), ('Meeting', '#fe7f2d', r.id),
      ('Automation', '#34d399', r.id), ('Marketing', '#fb923c', r.id);
  END LOOP;
END $$;
```

---

## 6. Storage Functions

Both `storage.web.ts` and `storage.native.ts` export the same Supabase-backed API.

All session queries use `SESSION_SELECT` constant:
```
'*, projects!project_id(name, color), clients!client_id(name), activity_types!activity_type_id(name, color)'
```
And `mapSession()` helper to flatten nested join data into flat `Session` fields.

| Function | Scope | Description |
|---|---|---|
| `initDb()` | — | No-op |
| `getClients()` | Team | All clients for active team, ordered by name |
| `createClient(name, isInternal?)` | Team | Insert client with team_id |
| `getActivityTypes()` | Team | All activity types for active team, ordered by name |
| `createActivityType(name, color?)` | Team | Insert activity type |
| `getRecentCombos()` | Own | Last 5 unique (client, project, activity) combos from user's sessions |
| `getProjects(clientId?)` | Team | Active projects, optionally filtered by client; joins client_name |
| `createProject(name, color, description?, clientId?)` | Team | Insert with team_id, user_id, client_id |
| `updateProject(id, name, color, description)` | Team | Edit any team project |
| `getActiveSession()` | Own | Session with `end_time = null` for current user |
| `clockIn(projectId, activityTypeId?, opts?)` | Own | Start session with client_id, activity_type_id, is_billable |
| `clockOut(sessionId)` | Own | Calls `clock_out_session` RPC |
| `startBreak(sessionId)` | Own | Set `break_start = now()` |
| `endBreak(sessionId)` | Own | Accumulate break time, clear `break_start` |
| `saveSessionNotes(sessionId, notes)` | Own | Save recap note |
| `saveSessionOutcome(sessionId, outcome)` | Own | Save outcome |
| `deleteSession(sessionId)` | Own | Delete own session |
| `getTodaySessions()` | Team | Today's completed sessions, enriched with user_full_name |
| `getAllSessions()` | Team | All completed sessions for team |
| `getTodayTotalMinutes()` | Own | Personal total minutes today |
| `getSessionsInRange(from, to)` | Team | Team sessions in date range |
| `getActiveSessions()` | Team | Active sessions for entire team (Live Now) |
| `createSessionObjectives(sessionId, texts[])` | Own | Bulk-insert checklist items |
| `toggleObjectiveComplete(objectiveId, completed)` | Own | Mark checklist item done/undone |
| `getSessionObjectives(sessionId)` | Own | Fetch checklist for one session |
| `getObjectivesForSessions(sessionIds[])` | Team | Batch-fetch objectives |
| `resumeSession(sessionId, breakSeconds)` | Own | Reopens closed session; adds gap to `total_break_seconds`; inserts new interval |
| `getIntervalsForSessions(sessionIds[])` | Own | Batch-fetch work intervals for history display |

---

## 7. Auth & Multi-Team (AuthContext)

```ts
interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeTeamId: string | null;
  userTeams: Team[];
  switchTeam: (teamId) => void;
  signIn, signOut,
  signUp(email, password, fullName, teamCode?),
  joinTeam,
  createTeam,
}
```

### `loadTeamsForUser` logic (runs on every login)
1. Fetches `profiles.team_id` (legacy) + `profiles.active_team_id` + `profiles.full_name`
2. **Syncs full_name**: if null but `user_metadata.full_name` exists → writes to profiles
3. Fetches all `team_members` rows joined with `teams`
4. **Auto-join pending**: if no teams and `user_metadata.pending_team_code` → insert into `team_members`
5. **Auto-migrate legacy**: if no teams and `profiles.team_id` → insert into `team_members`
6. **Auto-assign active**: if `active_team_id` null and teams exist → set first team as active

---

## 8. Screen-by-Screen Details

### `_layout.tsx`
- Stack navigator; `headerShown: false` for index, working, session-recap, history, stats, profile

### `index.tsx` (Home)
- **Context-aware hero**: idle → today total; clocked in → live `HH:MM:SS` timer
- **Live Now card** — teammates' active sessions; filtered to exclude own session
- **Tabbed sessions**: "Your Sessions" / "Team Sessions" with badge counts; always 4 rows
- **Skeleton loading**: shimmer animation while data loads
- **Fixed bottom action bar**: Clock In / Clock Out with press depth animation

### `clock-in.tsx`
Multi-step flow with modes: `combos | client | project | activity | objective | add-client | add-project | edit-project | add-activity`

**Combos screen (default):**
- Shows last 5 recent (client, project, activity) combos → tap to go to **Objectives step** with project/activity pre-filled
- "New Session" button → starts full picker

**Full picker flow:**
1. `client` — list of team clients + "Add new client"
2. `project` — projects filtered by selected client + "Add new project" + inline edit
3. `activity` — activity types + billable toggle + "Add new activity type"
4. `objective` — checklist builder (optional); breadcrumb shows project · activity
5. Calls `clockIn(projectId, activityTypeId, { clientId, isBillable })`

### `working.tsx`
- `TickingClock` overlay on mount (2.5s)
- `MilestoneConfetti` at 60-minute mark (fires once)
- Scrollable: timer + objectives checklist (tap to toggle)
- Fixed bottom: Take a Break / Resume + Clock Out (with press depth animation)
- `playClockOutSound()` called before `await clockOut()`

### `session-recap.tsx`
- Auto-suggests outcome based on checklist completion ratio
- Read-only checklist card; falls back to legacy `sessions.objective` text

### `history.tsx`
- SectionList grouped by day
- Batch-fetches objectives via `getObjectivesForSessions`
- Own sessions show `⋯` → Edit Notes / Delete

### `stats.tsx`
- **Search bar** — text input at top; filters all charts/metrics reactively (matches project, client, activity name, or session notes)
- **Period selector** — Today / This Week / This Month
- **Overview metrics row** — 4 cards: Total Time, Sessions, Avg Session, Projects (personal, period-scoped)
- **Work Distribution card** — donut chart (my sessions) with `Project | Client | Activity` dimension toggle
- **Last 7 Days trend** — View-based bar chart, no SVG; Today highlighted in orange
- **Top Projects** — horizontal bar list, top 5 (all team sessions)
- **By Client** — horizontal bar list (all team sessions)
- **By Activity** — horizontal bar list (all team sessions)
- All aggregations via `useMemo`; search + dimension changes never trigger a new network request
- Fixed bottom Clock In button

### `profile.tsx`
- Team info, role, members list (admin: remove button)
- Team switcher (multi-team support)
- **Clients card** — collapsible; list + add new client
- **Activity Types card** — collapsible; list with color dots + add new with color picker
- Admin: rename team, delete team, session log flush
- Logout

### `session-recap.tsx`
- Auto-suggests outcome based on checklist completion ratio
- Read-only checklist card; falls back to legacy `sessions.objective` text
- **"Continue Session" button** — shown when any objective is incomplete; calculates gap since clock-out, calls `resumeSession`, navigates back to `/working`

### `history.tsx`
- SectionList grouped by day
- Batch-fetches objectives + intervals in parallel via `Promise.all`
- Own sessions show `⋯` → **Resume Session** / Edit Notes / Delete

### `SessionItem` component
- Props: `session`, `hideMember?`, `prominentMember?`, `onActions?`, `onResume?`, `objectives?`, `intervals?`
- Shows: project name → `client_name · activity_name` (orange) → date/time → member name
- Expands when session has checklist objectives, legacy objective text, notes, multiple work intervals, or `onResume` is provided
- **"Work Periods" section** — shown only for resumed sessions (intervals.length > 1); lists each period with start–end times
- **"↩ Resume Session" button** — green bordered button at bottom of expanded section; shown when `onResume` prop is passed

---

## 9. Known Issues & TODOs

- [ ] `session_intervals` RLS: add teammate SELECT policy (currently owner-only)
- [ ] Delete a project
- [ ] Archive a project (set `status = 'archived'`)
- [ ] "Leave team" feature in profile
- [ ] Push notifications for long sessions
- [ ] Pagination on `getAllSessions` (currently returns all rows)
- [ ] Reduce storage query waterfall: `getActiveTeamId()` + `getTeamProjectIds()` are separate round-trips
- [ ] `stats.tsx` donut chart broken on web — `react-native-svg` Metro resolution issue on web (fix: `DonutChart.web.tsx` using native `<svg>`)

---

## 10. Dependency Notes

### Key package versions
```json
"expo": "~54.0.0",
"react-native": "0.81.5",
"react": "19.1.0",
"react-dom": "^19.1.0",
"react-native-reanimated": "~4.1.1",
"react-native-worklets": "0.5.1",
"react-native-svg": "15.12.1",
"expo-sqlite": "~16.0.10",
"expo-router": "~6.0.23",
"@supabase/supabase-js": "latest"
```

### Historical fixes
| Issue | Fix |
|---|---|
| `react-native-worklets` plugin error | Downgraded `0.7.4` → `0.5.1` |
| `react` version mismatch | Pinned to `19.1.0` |
| `storage.d.ts` pattern | `.d.ts` declares types for platform-specific modules |
| `team_members` didn't exist | Created table + RLS + backfilled from `profiles.team_id` |
| `profiles.active_team_id` null | Backfilled from `profiles.team_id` via SQL |
| `projects.created_by` not found | Column is `user_id`; fixed insert |
| Logout button disabled | Was tied to profile `loading` state — removed |
| New user team join failed at signup | Deferred via `user_metadata.pending_team_code`, applied on first login |
| Teammate names not showing | `profiles.full_name` was null; fixed with SQL UPDATE + AuthContext sync |
| Teammate profiles RLS blocked | Fixed with `get_teammate_ids` SECURITY DEFINER function |
| Clock out broken after refactor | `clock_out_session` RPC must exist in Supabase |
| `duration_minutes` computed client-side | Moved to Postgres trigger `trg_session_duration` |
| `session_objectives` schema cache error | Table not yet created in Supabase |
| Keyboard stuck on mobile (objective input) | `blurOnSubmit={true}` + `returnKeyType="done"` |
| PL/pgSQL `client_id` ambiguous in DO block | Renamed variable to `v_client_id` |
| New project not appearing after add | `createProject` wasn't saving `client_id`; fixed by adding optional `clientId` param |

---

## 11. Running the Project

```bash
cd C:\Users\chegl\TimeTracker

# Start web
npx expo start --web

# Start with cache cleared
npx expo start --web --clear

# Install missing dependencies
npm install --legacy-peer-deps
```

---

## 12. Deployment

### Vercel Setup
- App is deployed to Vercel via GitHub repo `cheloman04/clockea_v1`
- Local code also pushed to `cheloman04/Clockea` (source of truth)
- Two git remotes configured:
  ```
  origin  → https://github.com/cheloman04/Clockea.git       (source)
  vercel  → https://github.com/cheloman04/clockea_v1.git    (Vercel watches this)
  ```
- Deploy command: `git push origin main && git push vercel main`
- **IMPORTANT:** Always push to BOTH remotes. Vercel only watches `clockea_v1` — if you only push to `origin` (Clockea), the deploy won't trigger.
- `.npmrc` contains `legacy-peer-deps=true` to fix Vercel `npm install` peer-dep failures
- `vercel.json`: `buildCommand: "npm install --legacy-peer-deps && npx expo export --platform web"`, `outputDirectory: "dist"`, SPA rewrites

---

## 13. Changes — Mar 11, 2026 (Client → Project → Activity Refactor)

### Data Model
New 4-level tracking hierarchy: **Client → Project → Activity Type → Session**

**New tables:** `clients`, `activity_types`
**New columns on `projects`:** `client_id` (FK → clients), `status` ('active'|'archived')
**New columns on `sessions`:** `client_id`, `activity_type_id`, `is_billable`

All session queries now use `SESSION_SELECT` with joins on all three related tables, and `mapSession()` flattens the nested data.

### New Storage Functions
- `getClients()`, `createClient(name, isInternal?)`
- `getActivityTypes()`, `createActivityType(name, color?)`
- `getRecentCombos()` — last 5 unique (client, project, activity) combos
- `getProjects(clientId?)` — now filters by `status='active'`, optional clientId
- `createProject(name, color, description?, clientId?)` — now saves `client_id`
- `clockIn(projectId, activityTypeId?, opts?)` — now accepts activityTypeId, clientId, isBillable

### `app/clock-in.tsx` — Full Rewrite
Replaced single project-list screen with multi-step picker:
- **Combos screen**: tap any recent combo to instant clock-in
- **Client → Project → Activity → Objectives** step flow
- Inline add forms for client, project (with client_id), activity type
- Billable toggle on activity step
- Back navigation between all steps

### `components/SessionItem.tsx`
- Added `client_name · activity_name` secondary line (orange, `#fe7f2d`) below project name

### `app/profile.tsx`
- Added collapsible **Clients** card: list + add new client
- Added collapsible **Activity Types** card: list with color dots + add with color picker
- Both visible to all team members (not admin-only)

### `app/stats.tsx`
- Added **By Client** horizontal bar chart (all team sessions)
- Added **By Activity** horizontal bar chart (all team sessions)
- Both use `HorizontalBarList` component with color dot + name + duration + fill bar

**Further rewritten Mar 12, 2026 — see section 15.**

---

## 15. Changes — Mar 12, 2026 (Analytics Dashboard Upgrade)

### `app/stats.tsx` — Full rewrite

**Architecture:**
- Single `allSessions` state loaded once per period; all derived data via `useMemo`
- `applySearch(sessions, query)` — composable text filter (project, client, activity name, notes)
- `buildStats(sessions, dimension)` — unified aggregation replacing separate `buildProjectStats` / `buildClientStats` / `buildActivityStats`; groups by `'project' | 'client' | 'activity'`
- `buildDailyTrend(sessions)` — groups my sessions by day for the last 7 days

**New UI sections:**
- **Search bar** — live text filter; all charts + metrics update via `useMemo`, no re-fetch
- **Overview metrics row** — `MetricCard` component; 4 KPIs: Total Time, Sessions, Avg Session, Projects
- **Work Distribution card** — donut chart with `Project | Client | Activity` toggle (`Dimension` type)
- **Last 7 Days trend** — `DailyTrendChart` component using `View`-based bars (no SVG; web-safe)
- **Top Projects** — `HorizontalBarList` limited to 5 rows
- **By Client** and **By Activity** panels kept, now share same `buildStats()` function

**Key types:**
```ts
type Dimension = 'project' | 'client' | 'activity';
interface Stat { key: string; name: string; color: string; total_minutes: number; percentage: number; }
interface DayTrend { label: string; minutes: number; }
```

**Reactive derivation chain:**
```
allSessions + searchQuery → filtered
filtered + user.id       → mySessions (for donut + metrics + trend)
filtered                 → projectBreakdown, clientBreakdown, activityBreakdown (team-wide)
mySessions + dimension   → donutStats
```

---

## 14. Changes — Mar 10–11, 2026 (UX Polish + Navbar)

### New Components
- **`components/Navbar.tsx`** — Responsive navbar
  - Desktop/Tablet ≥768px: 3-column flex `[CLOCKEAPP] [Analytics · Logs] [Profile]`
  - Mobile: brand + hamburger `☰/✕`, dropdown menu
- **`components/TickingClock.tsx`** — Animated overlay on session start (2.5s)
- **`components/MilestoneConfetti.tsx`** — 8-particle burst at 60-minute mark

### New Utils
- **`utils/sounds.ts`** — `playClockInSound()` (880Hz) + `playClockOutSound()` (440Hz)
  - Must be called **before** first `await` to satisfy browser gesture policy

### UX Micro-interactions
- Press depth animation on Clock In and Clock Out buttons (scale 0.96 on press)
- Skeleton loading on dashboard while Supabase data loads

### Bug Fixes
- Break timer not pausing on dashboard → now subtracts ongoing `break_start` duration
- Sound not firing in browser → moved sound call before first `await`

### App Name
- Renamed **Clockea** → **CLOCKEAPP** in all visible UI

---

## 17. Changes — Mar 10, 2026 (Resume from Dashboard + History; Combos → Objectives step)

### Resume Session — available everywhere
Users can now resume any closed session from the **home screen** and **history screen**, not just immediately after clock-out.

**Home screen (`index.tsx`):**
- Each session row in "Your Sessions" tab is now expandable (even without notes)
- Expanded view shows green **"↩ Resume Session"** button
- If already clocked in: shows alert blocking double-session
- Calculates `breakSeconds = now - session.end_time`, calls `resumeSession()`, navigates to `/working`

**History screen (`history.tsx`):**
- Tap `⋯` menu on any own session → first option is **"Resume Session"**
- Same `resumeSession()` + navigate flow

**Both flows preserve:**
- Cumulative work time (gap counted as `total_break_seconds`)
- Existing notes, outcome, objectives
- Work Periods log in history (new interval inserted each resume)

### Clock-in Combos → Objectives step
**Before:** tapping a recent combo instantly clocked in (skipped objectives)
**After:** tapping a combo pre-fills project/activity and navigates to the **Objectives** step first
- User can add tasks, then "Start Session" — or tap "Skip objectives" for instant start (same as before)
- `handleComboStart` now sets `selectedClient`, `selectedProject`, `selectedActivity` from combo data and sets `mode = 'objective'`

---

## 16. Changes — Mar 10, 2026 (Resume Session + Work Intervals)

### New Feature: Resume Session
Allows users to reopen a completed session when objectives are still incomplete, preserving cumulative work time.

**UX flow:**
1. Clock Out → `session-recap` shows **"Continue Session"** button (green, bordered) when any objective is unchecked
2. Tapping it calls `resumeSession(sessionId, breakSeconds)`:
   - Calculates gap = `Date.now() - endTime` (endTime passed as route param from `working.tsx`)
   - Adds gap to `sessions.total_break_seconds`
   - Sets `sessions.end_time = null` (reopens session)
   - Inserts new row into `session_intervals`
3. Navigates to `/working` — timer resumes showing cumulative net work time

**Timer accuracy:** `elapsed = (now - start_time) - total_break_seconds` — the gap is counted as break, so display is always correct regardless of how many resumes occur.

### New Supabase Table: `session_intervals`
```sql
CREATE TABLE session_intervals (
  id uuid default gen_random_uuid() primary key,
  session_id integer not null references sessions(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz
);
ALTER TABLE session_intervals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session intervals owner" ON session_intervals
  USING (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()));
```

### Storage Changes
- `clockIn()` — also inserts first interval record after creating session
- `clockOut()` — after RPC, closes current open interval with `end_time = now()`
- `resumeSession(sessionId, breakSeconds)` — NEW: reopens session + inserts new interval
- `getIntervalsForSessions(sessionIds[])` — NEW: batch-fetch for history display

### UI Changes
- **`session-recap.tsx`**: accepts `endTime` route param; derives `canResume` from incomplete objectives; new "Continue Session" button style
- **`working.tsx`**: passes `endTime: String(Date.now())` to session-recap route params
- **`components/SessionItem.tsx`**: new `intervals?` prop; shows **"Work Periods"** section in expanded view when `intervals.length > 1` (only for resumed sessions)
- **`app/history.tsx`**: batch-loads intervals alongside objectives using `Promise.all`
