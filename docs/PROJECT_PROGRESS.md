# TimeTracker — Project Progress & Context Document

> Last updated: 2026-03-08
> Purpose: Full context for continuing development across sessions/chats.

---

## 1. Project Overview

**TimeTracker** is a cross-platform time-tracking app built with:
- **Expo SDK 54** (`expo@54.0.33`)
- **React Native 0.81.5**
- **React 19.1.0**
- **Expo Router v6** (file-based routing)
- **expo-sqlite** for native storage, **localStorage** for web storage
- **TypeScript**, **react-native-safe-area-context**, **react-native-reanimated 4.1.1**

The app runs primarily on **web** (`npx expo start --web` → `localhost:8082`) but is built to support iOS/Android too.

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

**Typography:**
- Labels: `11px`, uppercase, `letterSpacing: 2`, `fontWeight: 700`, color `#7aa3b8`
- Headings: `22–26px`, `fontWeight: 700`, white
- Body: `15–16px`, white or `#7aa3b8`
- Timer: `80px`, `fontWeight: 200`, white

**Layout:**
- Horizontal margins: `20px`
- Border radius: `14px` (cards/buttons), `12px` (smaller elements), `100px` (badges/pills)
- All cards: `backgroundColor: #233d4d`, `borderWidth: 1`, `borderColor: #2d4f62`
- Buttons use `shadowColor` matching button color for glow effect

**SafeAreaView:** Use from `react-native-safe-area-context` (NOT from `react-native` — deprecated).

---

## 3. File Structure

```
TimeTracker/
├── app/
│   ├── _layout.tsx          # Stack navigator, dark header, pumpkin tint
│   ├── index.tsx            # Home: today total, Clock In + Analytics buttons, recent sessions
│   ├── clock-in.tsx         # Project selector + add/edit project forms
│   ├── working.tsx          # Active session: timer, Take a Break, Resume, Clock Out
│   ├── session-recap.tsx    # Post-session notes screen (after Clock Out)
│   ├── history.tsx          # All sessions grouped by day
│   └── stats.tsx            # Analytics: donut pie chart, daily/weekly/monthly tabs
├── components/
│   ├── Timer.tsx            # Displays net work time (excludes breaks)
│   ├── ProjectCard.tsx      # Project row with colored accent + edit button
│   └── SessionItem.tsx      # Session row, expandable notes
├── database/
│   ├── types.ts             # Project, Session interfaces
│   ├── storage.d.ts         # TypeScript declarations (resolves .native.ts/.web.ts)
│   ├── storage.web.ts       # localStorage implementation
│   ├── storage.native.ts    # SQLite implementation (expo-sqlite)
│   ├── db.ts
│   └── queries.ts
├── utils/
│   └── time.ts              # formatDuration, formatMinutes, formatTime, formatDate, getElapsedSeconds
└── docs/
    └── PROJECT_PROGRESS.md  # This file
```

---

## 4. Data Models

### `Project`
```ts
interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;   // Added: short project description
}
```

### `Session`
```ts
interface Session {
  id: number;
  project_id: number;
  start_time: string;           // ISO string
  end_time: string | null;      // null = active session
  duration_minutes: number | null; // net work time (excl. breaks)
  break_start: string | null;   // ISO string when current break started
  total_break_seconds: number;  // accumulated past break time
  notes?: string;               // post-session recap note
  project_name?: string;        // joined from projects
  project_color?: string;       // joined from projects
}
```

---

## 5. Storage Functions

Both `storage.web.ts` and `storage.native.ts` export the same API (declared in `storage.d.ts`):

| Function | Description |
|---|---|
| `initDb()` | Initialize DB + run migrations |
| `getProjects()` | All projects sorted by name |
| `createProject(name, color)` | Create new project |
| `updateProject(id, name, color, description)` | Edit project |
| `getActiveSession()` | Returns session with `end_time = null`, with project info joined |
| `clockIn(projectId)` | Start a new session |
| `clockOut(sessionId)` | End session, compute net duration (minus breaks) |
| `startBreak(sessionId)` | Set `break_start = now()` |
| `endBreak(sessionId)` | Add break duration to `total_break_seconds`, clear `break_start` |
| `saveSessionNotes(sessionId, notes)` | Save recap note to session |
| `getTodaySessions()` | Completed sessions for today |
| `getAllSessions()` | All completed sessions, most recent first |
| `getTodayTotalMinutes()` | Sum of today's `duration_minutes` |
| `getSessionsInRange(from, to)` | Sessions between two ISO strings (for analytics) |

### Native Migrations (SQLite)
Run on every `initDb()` call, fail silently if column exists:
```sql
ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN break_start TEXT;
ALTER TABLE sessions ADD COLUMN total_break_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN notes TEXT;
```

---

## 6. Screen-by-Screen Details

### `index.tsx` — Home
- Hero section: "Today's Total" + formatted minutes
- Two buttons in a row: **Clock In** (pumpkin, flex) + **Analytics** (charcoal outline)
- **Recent Sessions** card with FlatList of `SessionItem`
- "See all" link → `/history`
- On focus: checks for active session → redirects to `/working` if found

### `clock-in.tsx` — Project Selection
- Lists all projects as `ProjectCard` components
- Each card has a colored left accent bar, name, description/hint, edit button (✎)
- "+ New Project" dashed button at the bottom
- Mode state: `'list' | 'add' | 'edit'`
- Add/Edit form: name input, description multiline input, color palette picker
- Color palette: `['#fe7f2d', '#e91e63', '#4caf50', '#00bcd4', '#9c27b0', '#ffb300']`
- Selecting a project → `clockIn(project.id)` → navigate to `/working`

### `working.tsx` — Active Session
- Shows project badge (pill with color dot + project name)
- Timer showing net work time
- **Working state:** "Take a Break" (pumpkin filled) + "Clock Out" (red)
- **Break state:** "On Break" label, "Timer paused" pumpkin badge, "Resume" (pumpkin) + "Clock Out" (red)
- Clock Out: `window.confirm` on web, `Alert.alert` on native
- After clock out: navigates to `/session-recap?sessionId=X`

### `session-recap.tsx` — Post-Session Notes
- No header (fullscreen)
- Pumpkin ✓ icon, "Session Complete" heading
- "What did you accomplish in this session?" prompt
- Large multiline TextInput (autofocused)
- **Save & Finish** (pumpkin, dimmed when empty) → saves notes → `/`
- **Skip for now** (muted) → `/` without saving

### `history.tsx` — Full History
- `SectionList` grouped by day
- Section headers: date left, total time right (pumpkin)
- Uses `SessionItem` component

### `stats.tsx` — Analytics (IN PROGRESS — SVG ISSUE)
- Period tabs: Today / This Week / This Month
- Custom SVG donut chart (react-native-svg)
- Legend: project name, color dot, time (pumpkin), percentage
- **STATUS: Broken on web** — `react-native-svg` module resolution error

---

## 7. Components

### `Timer.tsx`
```ts
Props: { startTime: string; totalBreakSeconds: number; breakStart: string | null }
```
- Computes net work seconds every 1s: `totalElapsed - totalBreakSeconds - currentBreakDuration`
- Timer freezes during breaks (currentBreakDuration cancels out elapsed time)

### `ProjectCard.tsx`
```ts
Props: { project: Project; onSelect: (p: Project) => void; onEdit: (p: Project) => void }
```
- Colored left bar accent, project name, description (orange) or "Tap to start tracking" (muted)
- Edit button (✎) on the right — calls `onEdit`

### `SessionItem.tsx`
- Shows project name, time range, duration (pumpkin)
- If session has `notes`: shows ▼ indicator, tap to expand notes inline
- Notes shown under "SESSION NOTES" label in `#a8c4d0`

---

## 8. Known Issues & TODOs

### CURRENT BLOCKER: `react-native-svg` on Web
**Error:** `Cannot resolve react-native-svg lib/module/index.js` on web.
**Root cause:** Metro on web doesn't resolve `react-native-svg` correctly.
**Solutions to try (in order):**
1. Add Metro resolver alias in `metro.config.js` to map `react-native-svg` → `react-native-svg/lib/commonjs/index.js` on web
2. Or rewrite `stats.tsx` DonutChart using platform-specific files:
   - `components/DonutChart.web.tsx` — use native browser `<svg>` via React Native Web
   - `components/DonutChart.native.tsx` — use react-native-svg
3. Or replace react-native-svg entirely with a pure View/CSS approach using `conic-gradient` on web

**Recommended fix:** Platform-specific component approach (option 2) — most robust.

### Other TODOs
- [ ] Fix `react-native-svg` / stats screen on web (see above)
- [ ] Add ability to delete a project
- [ ] Add ability to delete a session
- [ ] Consider adding push notifications for long sessions
- [ ] Consider adding a "goals" feature (target hours per project per week)

---

## 9. Dependency Notes

### Fixed in this session
| Issue | Fix |
|---|---|
| `Cannot find module 'react-native-worklets/plugin'` | Downgraded `react-native-worklets` from `0.7.4` → `0.5.1` (Expo 54 compatible) |
| `react` version mismatch | Downgraded from `19.1.5` → `19.1.0` |
| `react-dom` version mismatch | Changed to `19.1.0` |

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
"expo-router": "~6.0.23"
```

### `storage.d.ts` pattern
TypeScript can't auto-resolve `storage.native.ts` / `storage.web.ts` platform extensions.
**Fix:** `database/storage.d.ts` declares all exported functions. Metro still uses the correct platform file at runtime.

---

## 10. Running the Project

```bash
cd C:\Users\chegl\TimeTracker

# Start web
npx expo start --web

# Start with cache cleared (after dependency changes)
npx expo start --clear

# Install missing dependencies
npm install --legacy-peer-deps
```

---

## 11. Metro Config (`metro.config.js`)

Custom resolver to fix `VirtualizedList` resolution on web:
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
// Custom resolveRequest for react-native-web VirtualizedList fix
module.exports = config;
```

---

## 12. Git Status

The project has **no git repository** initialized. All changes are local file edits only.
