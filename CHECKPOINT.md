# Zoom Analytics — Project Checkpoint

## Project Overview

A Next.js 14 (App Router) web application for analyzing Zoom webinar attendance, engagement, and retention patterns. Features admin dashboard, multi-client support, AI-powered insights, and real-time engagement graphs.

- **Stack:** Next.js 14, React 18, TypeScript, PostgreSQL (pg), Tailwind CSS, shadcn/ui, Recharts, Framer Motion, OpenAI API
- **Database:** PostgreSQL at 140.245.206.162 (zoomanalytics)
- **Deployment:** Vercel (zoom-analytics.vercel.app) + Docker (for self-hosted)
- **Repo:** FREEDOMWITHAI-001 on GitHub

---

## Phase 1 — Initial Setup (Feb 19, 2026)

**Commit:** `e3684639` — Next.js Zoom Analytics app — single container replacing Spring Boot + Vite

- Migrated from a Spring Boot backend + React/Vite frontend to a single Next.js 14 App Router application
- Created core file structure: `app/`, `components/`, `lib/`, `services/`
- Set up Dockerfile for single-container deployment (node:20-alpine, standalone output)
- Implemented CSV upload and parsing for attendance data
- Built retention graph with Recharts
- Created UploadSection and ResultsSection components

## Phase 2 — Documentation (Feb 20, 2026)

**Commit:** `87bb7cca` — Add comprehensive README

- Added detailed README with installation, Docker, API docs, and architecture documentation

## Phase 3 — Multi-Client & Database (Feb 21, 2026)

**Commits:** `c5ada1b6`, `ce020505` — Multi-client and multi-DB support

- Added PostgreSQL integration via `pg` Pool (`lib/db.ts`)
- Created `zoom_meeting_analytics` table with JSONB columns for engagement data
- Implemented per-client data isolation using `client_name` column
- Built `/api/recordings` endpoint to list meetings from DB
- Built `/api/analytics-with-insights/[meetingId]` endpoint for full analytics data
- Created `/api/clients` endpoint

## Phase 4 — Authentication (Feb 25, 2026)

**Commits:** `749308f5`, `9f338c11`, `55ec4475` — Auth system

- Implemented JWT-based authentication using `jose` library
- Created `client_credentials` table with bcrypt password hashing
- Built `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` endpoints
- Added Edge-compatible middleware (`middleware.ts`) for route protection
- Cookie-based session with `zoom-auth-token` (httpOnly, secure, sameSite: lax)
- Fixed secure cookie handling for HTTP deployments
- Updated port configuration

## Phase 5 — Admin Dashboard & Role-Based Access (Mar 11–12, 2026)

**Commits:** `7ba56c40`, `39f19b0d`, `84945a0a` — Admin panel

- Built full admin dashboard (`app/admin/page.tsx`) with tabs: Overview, Clients, Activity, Workflow
- Implemented role-based access control (admin vs user roles)
- Admin users auto-redirect to `/admin`, regular users to upload page
- Created admin API routes:
  - `POST /api/admin/impersonate` — admin can "View As" any client
  - `GET /api/admin/stats` — system-wide statistics
  - `GET/POST /api/admin/clients` — CRUD for client accounts
  - `GET/PUT/DELETE /api/admin/clients/[id]` — individual client management
  - `POST /api/admin/test-ai-key` — validate AI API keys
  - `GET/PUT /api/admin/workflow-template` — n8n workflow template management
  - `GET /api/admin/clients/[id]/download-workflow` — download client-specific workflow JSON
- Client management: create, edit, delete, activate/deactivate
- Integration fields per client: Zoom credentials, GHL token, AI provider/key, n8n webhook
- Middleware enforces admin-only access on `/admin` and `/api/admin/*` routes

## Phase 6 — Admin Panel Enhancements (Mar 18, 2026)

**Commits:** `9d895d8c`, `bbaade6d`, `b40eb408`, `66c20a16` — Final features

- Added JSON download feature for workflow templates
- Enhanced admin panel with collapsible integration sections
- Added AI key testing functionality in client setup
- Implemented "View As" (impersonate) button in clients list
- Added workflow status indicators per client
- Final polish: loading states, error handling, form validation
- Deployed to Vercel via CLI (zoom-analytics.vercel.app)

## Phase 7 — Critical Bug Fix: Client-Side Crash on Analysis (Mar 24, 2026)

**Issue:** After impersonating a client and clicking "Start Analysis", the app crashed with "Application error: a client-side exception has occurred."

**Root Cause:** `TypeError: Cannot read properties of undefined (reading 'split')` in `components/graph/useGraphConfiguration.ts`

The window aggregation module (`lib/csv/window-aggregation.ts`) produces time labels in range format `"HH:MM-HH:MM"` (e.g., `"00:00-00:05"`). The graph configuration code assumed that any time string containing `-` was in date format `"MM-DD HH:MM"` (space-separated). When it called `time.split(' ')[1]` on `"00:00-00:05"`, it returned `undefined`, then crashed calling `.split(':')` on `undefined` inside a `useMemo` → `reduce` → `some` chain.

**Diagnosis method:** Playwright browser automation to reproduce the full flow (login → impersonate → select recording → start analysis → capture console errors).

**Files fixed:**

1. **`components/graph/useGraphConfiguration.ts`**
   - Added module-level `safeGetMinutes()` helper that correctly handles range format (`HH:MM-HH:MM`), date format (`MM-DD HH:MM`), and plain format (`HH:MM`)
   - Rewrote `formatTimeLabel()` to detect range format via regex before other formats
   - Replaced all unsafe `.split(':')` calls in significant points filtering with `safeGetMinutes()`
   - Fixed peak/drop caption analysis to use safe time parsing

2. **`components/InsightsTable.tsx`**
   - Added `extractStartTime()` helper to safely extract start time from range format before splitting
   - Updated `normalizeTime()` and `getTranscriptContext()` to use safe extraction

3. **`components/results/GraphSection.tsx`**
   - Removed fallback call to non-existent `/api/transcript-simple/` endpoint (was causing 404 errors)

4. **`.vercelignore`** (new) — Added to prevent uploading node_modules/build artifacts to Vercel

**Verification:** Full Playwright test suite — 17/17 tests passed:
- Admin login and redirect
- Admin dashboard rendering
- Client list loading
- Impersonation API
- User upload page with recordings
- Recording selection (50 recordings loaded)
- Start Analysis (analytics API 200)
- Results page renders with graph, statistics, insights
- No client-side errors, no network errors
- Direct user login

## Phase 8 — Fix Misleading "Processing AI" Status for Harsh Client (Mar 27, 2026)

**Issue:** Harsh's client reported that all meetings showed "Processing AI..." but no data or AI insights were visible. The client was confused thinking the system was still working.

**Root Cause:** 59 out of 60 meetings for Harsh (`connect@daveharsh.com`) had `status = TRANSCRIPT_PENDING` because transcripts were never ingested (likely Zoom transcription wasn't enabled). The UI displayed "Processing AI..." for any non-COMPLETED status, which was misleading — the engagement data (graphs, statistics, peaks/dropoffs) was fully available; only transcripts and AI analysis were missing.

**Database findings:**
- Only 1 meeting (`97008198124` — "My Meeting") had a transcript (4,340 chars) and AI analysis
- 59 meetings had engagement graphs but no transcript and no AI analysis
- 2 meetings were also stored with `client_name = 'Harsh'` instead of `connect@daveharsh.com` (minor data inconsistency, invisible to user via `resolveDbClientName`)

**Files fixed:**

1. **`components/UploadSection.tsx`**
   - Changed recording dropdown badge: ~~"Processing AI..."~~ → **"Transcript Missing"** (orange color)
   - Changed selected recording detail badge: same label update
   - Added informational note below selected recording when transcript is missing: *"Transcript not available — engagement data and attendance graph are still viewable."*

2. **`components/AIAnalysisPanel.tsx`**
   - Updated disabled-button message: ~~"Transcript is not available for this meeting."~~ → **"Transcript is missing for this meeting. Engagement data and attendance graph are still available above."**

3. **`next.config.js`**
   - Re-added `output: 'standalone'` which was missing, causing Docker build failures (`/app/.next/standalone: not found`)

**Verification:**
- Docker build succeeded, deployed to localhost:8020
- Recordings API returns 60 meetings (1 COMPLETED, 59 TRANSCRIPT_PENDING)
- Analytics API returns engagement data for both meeting types
- Built JS confirmed: "Transcript Missing" present, "Processing AI" fully removed
- Admin impersonation → Harsh client flow tested end-to-end

---

## Phase 9 — Admin-Editable AI Prompts (Mar 30, 2026)

**Issue:** All AI analysis prompts were hardcoded in the API route files, making it impossible to tweak prompt wording without a code change and redeployment.

**Solution:** Built a full prompt management system — prompts are now stored in the database (`system_settings` table) and editable from a new "Prompts" tab in the admin panel.

**New files:**

1. **`lib/prompts.ts`** — Central prompt management module
   - Defines 4 prompt keys: `segment_analysis`, `full_transcript`, `insight_with_context`, `insight_no_context`
   - Stores default prompts (matching original hardcoded values) with template variables (`{{time}}`, `{{transcript}}`, etc.)
   - `loadPrompts()` — loads from DB, falls back to defaults for any missing keys
   - `savePrompts()` — persists to `system_settings` table (key: `ai_prompts`)
   - `renderPrompt()` — replaces `{{variable}}` placeholders with runtime values
   - `PROMPT_META` — label, description, and available variables per prompt (shown in admin UI)

2. **`app/api/admin/prompts/route.ts`** — Admin API for prompt management
   - `GET` — returns current prompts, defaults, and metadata
   - `PUT` — saves updated prompts to database
   - Protected by middleware (admin-only, `force-dynamic`)

**Modified files:**

3. **`app/api/ai/analyze-transcript/route.ts`** — Now calls `loadPrompts()` + `renderPrompt()` instead of building prompt string inline
4. **`app/api/ai/analyze-full-transcript/route.ts`** — Same: loads prompt from DB, renders with `{{transcript}}`
5. **`app/api/insights/generate/route.ts`** — Uses two DB-stored prompts (`insight_with_context` and `insight_no_context`), renders with `{{type}}`, `{{time}}`, `{{changeType}}`, `{{transcriptContext}}`, `{{count}}`, `{{percentageChange}}`
6. **`app/admin/page.tsx`** — Added "Prompts" tab to admin dashboard:
   - Accordion-style editors for all 4 AI prompts
   - Template variable chips showing available variables per prompt
   - "Modified" badge when a prompt differs from its default
   - Per-prompt "Reset to Default" button
   - Global "Reset All to Defaults", "Reload", and "Save All" buttons
   - Character count display per prompt

**Verification — Full test suite (local + production):**

| Category | Tests | Result |
|----------|-------|--------|
| Health & auth flow | Login, /me, logout, invalid creds | All pass |
| Middleware protection | Unauth→401, user→403 on admin, user→200 on normal | All pass |
| Admin API (stats, clients, prompts) | GET/PUT prompts, client CRUD, impersonation | All pass |
| AI endpoints with DB prompts | Segment analysis, full transcript, insights generate | All pass |
| Custom prompt → AI uses it | Saved `rating` schema, AI returned `rating` field | Pass |
| Restore defaults → AI uses defaults | Restored, AI returned `content_quality` schema | Pass |
| Edge cases | Missing fields, short transcript, empty arrays, invalid payloads | All handled |
| Frontend pages | Login, admin, main page, admin JS bundle contains prompts code | All pass |
| Production (zoom-analytics-nu.vercel.app) | All above tests repeated on live deployment | All pass |

**Deployment:** Vercel production at `https://zoom-analytics-nu.vercel.app` (scope: `sudarshans-projects-cb08fdb2`). Environment variables configured via `vercel env add` (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, OPENAI_API_KEY).

---

## Current Architecture

```
app/
├── page.tsx                          # Main page (upload → results flow)
├── login/page.tsx                    # Login page
├── admin/page.tsx                    # Admin dashboard (tabs: overview/clients/activity/workflow/prompts)
├── layout.tsx                        # Root layout with ThemeProvider
└── api/
    ├── auth/login/route.ts           # POST — JWT login
    ├── auth/logout/route.ts          # POST — clear session
    ├── auth/me/route.ts              # GET — current user info
    ├── recordings/route.ts           # GET — list meetings for client
    ├── analytics-with-insights/[meetingId]/route.ts  # GET — full analytics
    ├── transcript-direct/[meetingId]/route.ts        # GET — transcript content
    ├── ai/analyze-transcript/route.ts                # POST — AI analysis of time point
    ├── ai/analyze-full-transcript/route.ts           # POST — full transcript AI analysis
    ├── insights/generate/route.ts                    # POST — generate AI insights
    ├── analysis/simple/route.ts                      # POST — simple analysis
    ├── clients/route.ts                              # GET — client list
    ├── health/route.ts                               # GET — health check
    └── admin/
        ├── stats/route.ts                            # GET — system stats
        ├── clients/route.ts                          # GET/POST — manage clients
        ├── clients/[id]/route.ts                     # GET/PUT/DELETE — single client
        ├── clients/[id]/download-workflow/route.ts   # GET — workflow JSON
        ├── impersonate/route.ts                      # POST — admin impersonation
        ├── prompts/route.ts                          # GET/PUT — AI prompt management
        ├── test-ai-key/route.ts                      # POST — validate AI key
        └── workflow-template/route.ts                # GET/PUT — workflow template

components/
├── UploadSection.tsx                 # File upload + Zoom recording selector
├── ResultsSection.tsx                # Main results orchestrator
├── InsightsTable.tsx                 # Peaks/dropoffs table with AI descriptions
├── RetentionGraph.tsx                # Recharts graph wrapper
├── graph/
│   ├── GraphControls.tsx             # Graph type toggle, settings
│   └── useGraphConfiguration.ts      # Graph data processing, significant points detection
├── results/
│   ├── ResultsDataProcessor.tsx      # CSV data processing hook
│   ├── GraphSection.tsx              # Graph + transcript panel
│   ├── StatisticsSection.tsx         # Stats cards
│   ├── InsightsSection.tsx           # Insights wrapper
│   ├── AISection.tsx                 # AI analysis panel
│   └── ...                           # Other result sub-components
└── ui/                               # shadcn/ui components

lib/
├── db.ts                             # PostgreSQL connection pool
├── auth.ts                           # JWT sign/verify (server-side)
├── auth-edge.ts                      # JWT verify (edge/middleware)
├── prompts.ts                        # AI prompt defaults, DB load/save, template rendering
├── csv/
│   ├── window-aggregation.ts         # Minute-level → N-minute bucket aggregation
│   └── ...                           # CSV parsing utilities
└── captions/
    └── caption-parser.ts             # VTT transcript parser

middleware.ts                          # Auth guard, role-based routing, header injection
```

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| DB_HOST | PostgreSQL host |
| DB_PORT | PostgreSQL port (5432) |
| DB_NAME | Database name (zoomanalytics) |
| DB_USER | Database user |
| DB_PASSWORD | Database password |
| OPENAI_API_KEY | OpenAI API key for AI insights |
| OPENAI_MODEL | OpenAI model (gpt-4o-mini) |
| JWT_SECRET | JWT signing secret |
