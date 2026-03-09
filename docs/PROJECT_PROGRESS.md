# TimeTracker — Project Progress & Context Document

> Last updated: 2026-03-09
> Purpose: Full context for continuing development across sessions/chats.
> Audience: Internal tool — personal use only (single user + invited teammates).

---

## 1. Project Overview

**TimeTracker** (Clockea) is a cross-platform time-tracking app with team collaboration, built with:
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
│   ├── _layout.tsx          # Stack navigator + auth guard + CLOCKEA logo + profile icon in header
│   ├── index.tsx            # Home: context-aware hero, Live Now, tabs (Your/Team Sessions), fixed bottom bar
│   ├── login.tsx            # "TURN TIME INTO PROGRESS." + clock illustration
│   ├── register.tsx         # Sign-up + optional team code (stored in user_metadata)
│   ├── clock-in.tsx         # Project selector → checklist builder → session start
│   ├── working.tsx          # Active session: ← Dashboard, timer, checklist toggle, Take a Break, Clock Out
│   ├── session-recap.tsx    # Post-session: checklist review + auto-suggested outcome + notes
│   ├── edit-session.tsx     # Edit notes on a completed session (from history)
│   ├── history.tsx          # All team sessions grouped by day; objectives loaded per session
│   ├── stats.tsx            # Analytics: vertical donut charts (My + Team Sessions) + fixed bottom bar
│   ├── profile.tsx          # User info + team switcher + members list + join/create team + logout
│   └── create-team.tsx      # Create a new team and get its code
├── components/
│   ├── Timer.tsx            # Displays net work time (excludes breaks)
│   ├── ProjectCard.tsx      # Project row with colored accent + edit button
│   └── SessionItem.tsx      # Session row with expand: checklist (✔/✘) → outcome badge → notes
│                              Props: hideMember?, prominentMember?, onActions?, objectives?
├── contexts/
│   └── AuthContext.tsx      # Auth + multi-team state; syncs profiles.full_name on login
├── database/
│   ├── types.ts             # Team, Project, Session, SessionObjective interfaces
│   ├── storage.d.ts         # TypeScript declarations for platform storage modules
│   ├── storage.web.ts       # Supabase implementation (team-scoped queries)
│   └── storage.native.ts    # Identical to storage.web.ts (both use Supabase)
├── lib/
│   └── supabase.ts          # Supabase client (URL + anon key)
├── utils/
│   └── time.ts              # formatDuration, formatMinutes, formatTime, formatDate, getElapsedSeconds
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

### `Project`
```ts
interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;
  team_id?: string;     // UUID — which team owns this project
}
```

### `Session`
```ts
interface Session {
  id: number;
  user_id: string;              // UUID — who worked
  project_id: number;
  start_time: string;           // ISO string
  end_time: string | null;      // null = active session
  duration_minutes: number | null; // net work time (excl. breaks) — computed by DB trigger
  break_start: string | null;   // ISO string when current break started
  total_break_seconds: number;  // accumulated past break time
  notes?: string;               // post-session recap note
  objective?: string;           // legacy single-text objective (backward compat)
  outcome?: 'achieved' | 'partial' | 'missed';
  project_name?: string;        // joined from projects
  project_color?: string;       // joined from projects
  user_full_name?: string;      // joined from profiles (teammate visibility)
}
```

### `SessionObjective`
```ts
interface SessionObjective {
  id: string;           // UUID
  session_id: number;   // FK → sessions.id ON DELETE CASCADE
  text: string;
  completed: boolean;
  position: number;     // display order
  created_at: string;
}
```

---

## 5. Supabase Schema

### Tables
| Table | Key Columns |
|---|---|
| `auth.users` | Supabase managed |
| `profiles` | `id` (= auth.users.id), `full_name`, `team_id` (legacy), `active_team_id` |
| `teams` | `id`, `name`, `code`, `created_by` |
| `team_members` | `user_id`, `team_id`, `joined_at` — **N:N relationship** |
| `projects` | `id`, `name`, `color`, `description`, `team_id`, `user_id` |
| `sessions` | `id`, `user_id`, `project_id`, `start_time`, `end_time`, `duration_minutes`, `break_start`, `total_break_seconds`, `notes`, `objective` (legacy), `outcome` |
| `session_objectives` | `id`, `session_id`, `text`, `completed`, `position`, `created_at` |

### RLS Policies
- **team_members**: SELECT + INSERT for own `user_id`; DELETE for own row OR team admin
- **projects**: SELECT/INSERT for team members; UPDATE for team members (via `team_members` join)
- **sessions**: own sessions full CRUD; teammates' sessions SELECT if project is in shared team
- **session_objectives**: owner (via session) full CRUD; teammates SELECT
- **profiles**: own profile always; teammates' profiles SELECT via `get_teammate_ids()` security definer function

### Security Definer Functions
```sql
-- Returns all user_ids in teams shared with p_user_id (bypasses team_members RLS)
CREATE OR REPLACE FUNCTION get_teammate_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM team_members
  WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = p_user_id);
$$;

-- Server-side clock out: sets end_time = NOW(), finalises breaks, triggers duration calc
CREATE OR REPLACE FUNCTION clock_out_session(p_session_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_break_start        timestamptz;
  v_total_break_secs   int;
BEGIN
  SELECT break_start, total_break_seconds
    INTO v_break_start, v_total_break_secs
    FROM sessions WHERE id = p_session_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found or unauthorized'; END IF;
  IF v_break_start IS NOT NULL THEN
    v_total_break_secs := COALESCE(v_total_break_secs, 0)
      + EXTRACT(EPOCH FROM (NOW() - v_break_start))::int;
  END IF;
  UPDATE sessions
     SET end_time = NOW(), break_start = NULL, total_break_seconds = v_total_break_secs
   WHERE id = p_session_id AND user_id = auth.uid();
END;
$$;
```

### Full SQL applied to Supabase (cumulative)
```sql
-- sessions: objective + outcome columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS outcome  TEXT;
ALTER TABLE sessions ADD CONSTRAINT sessions_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('achieved', 'partial', 'missed'));

-- Server-side duration trigger
CREATE OR REPLACE FUNCTION compute_session_duration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND OLD.end_time IS NULL THEN
    NEW.duration_minutes := GREATEST(0,
      EXTRACT(EPOCH FROM (NEW.end_time::timestamptz - NEW.start_time::timestamptz)) / 60.0
      - COALESCE(NEW.total_break_seconds, 0) / 60.0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_session_duration ON sessions;
CREATE TRIGGER trg_session_duration
  BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION compute_session_duration();

-- RLS: sessions UPDATE + DELETE
DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
CREATE POLICY "Users can update own sessions" ON sessions FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions" ON sessions FOR DELETE
  USING (user_id = auth.uid());

-- RLS: projects UPDATE
DROP POLICY IF EXISTS "Team members can update team projects" ON projects;
CREATE POLICY "Team members can update team projects" ON projects FOR UPDATE
  USING  (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- RLS: team_members DELETE
DROP POLICY IF EXISTS "Admins can remove team members" ON team_members;
CREATE POLICY "Admins can remove team members" ON team_members FOR DELETE
  USING (user_id = auth.uid()
    OR team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()));

-- session_objectives table + RLS
CREATE TABLE session_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE session_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON session_objectives FOR ALL
  USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_objectives.session_id AND sessions.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_objectives.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "teammate_select" ON session_objectives FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sessions s
    JOIN team_members tm ON tm.team_id = (SELECT active_team_id FROM profiles WHERE id = auth.uid())
    WHERE s.id = session_objectives.session_id AND s.user_id = tm.user_id
  ));
```

---

## 6. Storage Functions

Both `storage.web.ts` and `storage.native.ts` export the same Supabase-backed API:

| Function | Scope | Description |
|---|---|---|
| `initDb()` | — | No-op |
| `getProjects()` | Team | Projects for `active_team_id` |
| `createProject(name, color, description?)` | Team | Insert with `team_id`, `user_id` |
| `updateProject(id, name, color, description)` | Team | Edit any team project |
| `getActiveSession()` | Own | Session with `end_time = null` for current user |
| `clockIn(projectId, objective?)` | Own | Start a new session (objective param kept for legacy; new sessions use `createSessionObjectives`) |
| `clockOut(sessionId)` | Own | Calls `clock_out_session` RPC — server sets `end_time = NOW()`, trigger computes `duration_minutes` |
| `startBreak(sessionId)` | Own | Set `break_start = now()` |
| `endBreak(sessionId)` | Own | Accumulate break time, clear `break_start` |
| `saveSessionNotes(sessionId, notes)` | Own | Save recap note |
| `saveSessionOutcome(sessionId, outcome)` | Own | Save outcome; enforces `user_id` ownership |
| `deleteSession(sessionId)` | Own | Delete own session |
| `getTodaySessions()` | Team | All teammates' sessions today, enriched with `user_full_name` |
| `getAllSessions()` | Team | All completed sessions for team, enriched with `user_full_name` |
| `getTodayTotalMinutes()` | Own | Personal total minutes today |
| `getSessionsInRange(from, to)` | Team | Team sessions in date range |
| `getActiveSessions()` | Team | Active sessions for entire team (Live Now feature) |
| `createSessionObjectives(sessionId, texts[])` | Own | Bulk-insert checklist items for a session |
| `toggleObjectiveComplete(objectiveId, completed)` | Own | Mark a checklist item done/undone |
| `getSessionObjectives(sessionId)` | Own | Fetch checklist items for one session (ordered by position) |
| `getObjectivesForSessions(sessionIds[])` | Team | Batch-fetch objectives for many sessions → `Record<sessionId, SessionObjective[]>` |

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
2. **Syncs full_name**: if `profiles.full_name` null but `user_metadata.full_name` exists → writes to profiles
3. Fetches all `team_members` rows joined with `teams`
4. **Auto-join pending**: if no teams and `user_metadata.pending_team_code` exists → insert into `team_members`
5. **Auto-migrate legacy**: if no teams and `profiles.team_id` exists → insert into `team_members`
6. **Auto-assign active**: if `active_team_id` null and teams exist → set first team as active

---

## 8. Screen-by-Screen Details

### `_layout.tsx`
- Stack navigator with `CLOCKEA` logo (`headerLeft`) and profile icon (`headerRight`) on index screen only
- Registered routes include `edit-session` (title: "Edit Notes")

### `index.tsx` (Home)
- **Context-aware hero**: idle → today total; clocked in → live `HH:MM:SS` timer + "View details →" pill
- **Live Now card** — teammates' active sessions; single shared `setInterval`; filtered to exclude own session
- **Tabbed sessions**: "Your Sessions" / "Team Sessions" with badge counts
- **Fixed bottom action bar**: Clock In / Clock Out with spring animation

### `clock-in.tsx`
- **Step 1** — project list (or add/edit project form)
- **Step 2 — Objectives** (`'objective'` mode): multi-item checklist builder
  - TextInput + **Add** button (or press Done on keyboard)
  - Keyboard: `returnKeyType="done"`, `blurOnSubmit={true}` → adds item + dismisses keyboard
  - Added items shown as removable rows with `×` button
  - **Start Session** → `clockIn(projectId)` + `createSessionObjectives(sessionId, items)` if items exist
  - **Skip objectives** → `clockIn(projectId)` with no checklist

### `working.tsx`
- **← Dashboard** back nav at top
- Scrollable middle: large timer + objectives checklist (if any)
  - Each item: tap to toggle ✓/✗; optimistic update; strikethrough on completed
  - Progress counter "X / Y" (turns green when all done)
- Fixed bottom: Take a Break / Resume + Clock Out

### `session-recap.tsx`
- Loads `getSessionObjectives(sessionId)` on mount
- **Auto-suggests outcome** based on completion ratio:
  - 100% → pre-selects "Achieved"
  - ≥50% → pre-selects "Partially Achieved"
  - <50% → pre-selects "Not Achieved"
  - Outcome row shows "· auto-suggested" label; user can override
- Read-only checklist card (✔/✗ per item + "X / Y completed")
- Falls back to legacy `sessions.objective` text for old sessions without checklist
- Notes TextInput (always optional)
- `Save & Finish` disabled only when outcome picker is shown but nothing selected

### `edit-session.tsx`
- Simple notes editor; receives `{ id, notes }` params; auto-focuses keyboard

### `history.tsx`
- SectionList grouped by day
- Batch-fetches objectives via `getObjectivesForSessions` after loading sessions
- Passes `objectives={objectivesMap[item.id]}` to each `SessionItem`
- Own sessions show `⋯` → Edit Notes / Delete

### `stats.tsx` (Analytics)
- Period selector: Today / This Week / This Month
- Two vertical cards: "My Sessions" + "Team Sessions" with donut charts
- Fixed bottom action bar

### `profile.tsx`
- Team info from AuthContext; role: Admin or Participant
- Members list via `get_teammate_ids` RPC; admin "Remove" button
- Logout always enabled

### `SessionItem` component
- Props: `session`, `hideMember?`, `prominentMember?`, `onActions?`, `objectives?`
- Expands when session has checklist objectives, legacy objective text, or notes
- Expanded order: **Checklist** (✔/✗ + count) → **Outcome badge** → **Session Notes**
- Backward compat: shows legacy `session.objective` text if no checklist objectives

---

## 9. Known Issues & TODOs

- [ ] Delete a project
- [ ] "Leave team" feature in profile
- [ ] Push notifications for long sessions
- [ ] Pagination on `getAllSessions` (currently returns all rows)
- [ ] Reduce storage query waterfall: `getActiveTeamId()` + `getTeamProjectIds()` are separate round-trips
- [ ] `stats.tsx` donut chart broken on web — `react-native-svg` doesn't resolve via Metro on web (fix: platform-specific `DonutChart.web.tsx` using native `<svg>`)

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
| Teammate names not showing | `profiles.full_name` was null; fixed with SQL UPDATE + AuthContext sync on login |
| Teammate profiles RLS blocked | `team_members` RLS blocked JOIN in profiles policy; fixed with `get_teammate_ids` SECURITY DEFINER function |
| Clock out broken after refactor | `clock_out_session` RPC must be created in Supabase before the app can call it |
| `duration_minutes` computed client-side | Moved to Postgres trigger `trg_session_duration`; `clockOut` now calls RPC |
| `session_objectives` schema cache error | Table not yet created in Supabase; run SQL migration first |
| Keyboard stuck open on mobile (objective input) | `blurOnSubmit={true}` + `returnKeyType="done"` on checklist TextInput |

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
