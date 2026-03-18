# Zoom Analytics — Complete Implementation Guide

**Product:** Zoom Meeting & Webinar Analytics System  
**Platforms:** Zoom · n8n · GoHighLevel (GHL)  
**Version:** 1.0 — March 2026  

---

## Table of Contents

1. [System Overview](#1-system-overview)  
2. [Architecture & Data Flow](#2-architecture--data-flow)  
3. [Prerequisites](#3-prerequisites)  
4. [Module 1 — Zoom Retention Graph & AI Analytics Dashboard](#module-1--zoom-retention-graph--ai-analytics-dashboard)  
5. [Module 2 — Engagement Dashboard in GHL](#module-2--engagement-dashboard-in-ghl)  
6. [Module 3 — Zoom Leave Reminder Automation](#module-3--zoom-leave-reminder-automation)  
7. [Testing & Validation](#7-testing--validation)  
8. [Appendix](#8-appendix)  

---

## 1. System Overview

This system captures Zoom meeting/webinar events in real time and produces three deliverables:

| # | Module | Purpose |
|---|--------|---------|
| 1 | **Zoom Retention Graph & AI Analytics** | Per-meeting engagement graph (5-min intervals), peak/drop-off detection, AI transcript analysis, stored in Postgres |
| 2 | **GHL Engagement Dashboard** | Color-coded engagement categories (Red/Orange/Yellow/Green) with recency bands, at-risk lists, and live-call tracking inside GoHighLevel |
| 3 | **Zoom Leave Reminder** | When a participant leaves mid-meeting, automatically upsert them in GHL with the meeting link so a follow-up / rejoin reminder can fire |

All three modules run from a **single n8n webhook workflow** triggered by Zoom events.

---

## 2. Architecture & Data Flow

```
Zoom Webhook Events
        │
        ▼
┌──────────────────────┐
│  n8n Webhook Trigger  │  POST /webhook/analytics-dashboard
└──────────┬───────────┘
           │
     ┌─────┴──────────────────────────┐
     │         Switch on event         │
     ├────────┬────────┬──────────────┤
     │        │        │              │
  endpoint   meeting  meeting.      webinar.
  .url_      .ended   participant   participant
  validation          _left          _left
     │        │        │              │
     ▼        ▼        ▼              ▼
  Crypto    Module 1  Module 3      Module 3
  HMAC      + Module 2 (Meeting)   (Webinar)
  Response  (Analytics
            + GHL CRM
             update)
```

**Event routing (Switch node):**

| Zoom Event | Route | Modules Triggered |
|---|---|---|
| `endpoint.url_validation` | Output 0 | HMAC SHA-256 challenge response |
| `meeting.ended` | Output 1 | Module 1 (Retention Graph) + Module 2 (GHL CRM upsert & notes) |
| `meeting.participant_left` | Output 2 | Module 3 (Leave Reminder — meetings) |
| `webinar.participant_left` | Output 3 | Module 3 (Leave Reminder — webinars) |

---

## 3. Prerequisites

### 3.1 Zoom App

| Item | Detail |
|---|---|
| App type | **Server-to-Server OAuth** (Webhook-Only) |
| Required scopes | `meeting:read:admin`, `webinar:read:admin`, `report:read:admin`, `cloud_recording:read:admin`, `dashboard:read:admin` |
| Subscribed events | `meeting.ended`, `meeting.participant_left`, `webinar.participant_left` |
| Webhook URL | `https://<your-n8n-domain>/webhook/analytics-dashboard` |
| Validation secret | Store the **Secret Token** from Zoom — used for HMAC SHA-256 URL validation |

**Credentials needed from Zoom:**

- `Account ID`
- `Client ID`
- `Client Secret`
- The above are used to generate a Bearer token via `POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id=<ACCOUNT_ID>` with Basic Auth (`Client ID:Client Secret` base64-encoded).

### 3.2 n8n Instance

- Self-hosted n8n (or n8n Cloud) with webhook support enabled
- Credentials configured:
  - **HTTP Basic Auth** credential for Zoom OAuth (Client ID as username, Client Secret as password)
  - **Postgres** credential for the analytics database
  - **OpenAI** credential (for GPT-4o-mini transcript analysis)

### 3.3 GoHighLevel (GHL)

- A GHL sub-account with API access
- A **Private Integration API key** (Bearer token) with Contacts read/write scope
- The GHL `locationId` for the target sub-account

### 3.4 Postgres Database

A Postgres database with the `zoom_meeting_analytics` table (see Appendix A for the full CREATE TABLE statement).

---

## Module 1 — Zoom Retention Graph & AI Analytics Dashboard

### Purpose

After every Zoom meeting or webinar ends, automatically calculate engagement metrics, generate a time-series retention graph dataset, detect peaks and drop-offs, optionally analyze the transcript with AI, and store everything in Postgres for dashboard consumption.

### Trigger

Zoom `meeting.ended` event → Switch Output 1.

### Step-by-Step Implementation

#### Step 1: Acknowledge the Webhook

1. **Build Normal Event Body** (Set node) — Extract from `$json.body.payload.object`:
   - `meeting_id` → `.id`
   - `meeting_name` → `.topic`
   - `meeting_type` → `.type`
   - `meeting_id_uuid` → `.uuid`

2. **Respond 200 OK** (Respond to Webhook) — Immediately return 200 to Zoom so the webhook doesn't time out.

3. **Wait 2 Seconds** — Pause to let Zoom finalize the meeting report data before calling the Reports API.

#### Step 2: Determine Meeting vs Webinar

**Is Webinar?** (IF node) — Check `meeting_type`:

| Type Values | Classification |
|---|---|
| 5, 6, 9 | Webinar → use `/v2/report/webinars/{id}/participants` |
| All others | Meeting → use `/v2/report/meetings/{id}/participants` |

#### Step 3: Fetch Zoom Auth Token

**HTTP Request** → `POST https://zoom.us/oauth/token`

- Query params: `grant_type=account_credentials`, `account_id=<ACCOUNT_ID>`
- Header: `Authorization: Basic <base64(ClientID:ClientSecret)>`
- Use the HTTP Basic Auth credential configured in n8n

The response returns `access_token` to use in subsequent API calls.

#### Step 4: Paginate Participant Data

Both the Webinar and Meeting branches follow the same pagination loop pattern:

1. **Get First Page** — `GET /v2/report/{webinars|meetings}/{meeting_id}/participants?page_size=30`
   - Header: `Authorization: Bearer {access_token}`

2. **Accumulate Page** (Function node) — Store each page's response in `workflowStaticData("global")` under separate keys:
   - Webinar: `wf.webinarPages`
   - Meeting: `wf.meetingPages`
   - Extract `next_page_token` from the response.

3. **Has More Pages?** (IF node) — Check if `next_page_token` is not empty.
   - **True →** Get Next Page (same endpoint with `next_page_token` query param) → loop back to Accumulate
   - **False →** Return Pages (flush accumulated pages from static data)

4. **Return Pages** (Function node) — Read all pages from static data, clear the key, return as individual items.

#### Step 5: Calculate Engagement Analytics

**Code node** (JavaScript) — This is the core analytics engine. Input: all participant page items. Logic:

1. **Merge all participants** from all pages into a single array.

2. **Determine meeting duration** — Find the earliest `join_time` and latest `leave_time` across all participants.

3. **Generate time bins** — Create labels at 5-minute intervals (e.g., `00:00`, `00:05`, `00:10`, …) spanning the full meeting duration.

4. **Minute-by-minute active user tracking** — For each participant, mark every minute between their join and leave as "active."

5. **Per-segment calculations** (each 5-min bin):
   - `active_participants` — average active users in that segment
   - `engagement_rate` — (average active / total participants) × 100
   - `users_joined` — count of participants whose join falls in this segment
   - `users_left` — count of participants whose leave falls in this segment
   - `peak_active_users` — max active in that segment

6. **Detect peaks and drop-offs** — Compare each segment to the previous one:
   - Skip first 10 minutes (noisy join period) and last 20 minutes (natural ending)
   - If percentage change > +3% → **Peak**
   - If percentage change < −3% → **Drop-off**
   - Sort by magnitude, keep top 5 each

7. **User time report** — Aggregate per unique email:
   - `total_minutes`, `rejoins`, `sessions`, `first_name`, `last_name`, `phone`, `participant_id`, `attentiveness_score`

8. **Summary metrics:**
   - `engagement_score` — average (active / peak) across all segments × 100
   - `average_retention` — mean of all segment engagement rates
   - `peak_concurrent_users`, `final_active_users`, `total_joined`, `total_left`

**Output JSON shape:**

```json
{
  "success": true,
  "meeting_id": "...",
  "meeting_name": "...",
  "meeting_duration_minutes": 45,
  "engagement_score": 78.5,
  "average_retention": 65.2,
  "peak_concurrent_users": 120,
  "engagement_graph": {
    "labels": ["00:00", "00:05", "00:10", ...],
    "active_participants": [10, 45, 80, ...],
    "engagement_rate": [8, 37, 66, ...],
    "users_joined": [10, 35, 20, ...],
    "users_left": [0, 0, 2, ...]
  },
  "peaks": [{ "timeInterval": "00:15", "percentageChange": 12, ... }],
  "dropoffs": [{ "timeInterval": "00:35", "percentageChange": -8, ... }],
  "user_time_report": [{ "user_email": "...", "total_minutes": 30, ... }]
}
```

#### Step 6: Fetch Recordings & Transcript

1. **Get fresh auth token** (new token request — tokens are short-lived).

2. **Fetch Recordings** — `GET /v2/meetings/{meeting_id}/recordings?ttl=1`
   - `continueOnFail: true` (some meetings have no recordings)

3. **Extract Transcript Info** (Code node) — Look for a file with `file_type === 'TRANSCRIPT'` in `recording_files`. Extract `download_url`.

4. **Transcript Available?** (IF node) — Branch based on whether a transcript file was found.

#### Step 7: AI Transcript Analysis (if transcript available)

1. **Get fresh auth token** for downloading.

2. **Download Transcript** — `GET {transcript_download_url}` with Basic Auth (Zoom credentials), response format: text (VTT format).

3. **Build AI Prompt** (Code node) — If transcript is ≥100 chars, construct a structured prompt:
   - Role: Senior webinar engagement analyst
   - Task 1: 2–4 key insights in format "At MM:SS, engagement increased/decreased because..."
   - Task 2: 2–4 recommendations in format "Instead of what happened at MM:SS, the speaker should..."
   - Output: strict JSON `{ "key_insights": [...], "recommendations": [...] }`
   - If no usable transcript: return fallback JSON stating transcript wasn't available.

4. **Message a Model** (OpenAI node) — Send prompt to GPT-4o-mini.

5. **Parse AI Response** (Code node):
   - Extract JSON from response (strip markdown fences if present)
   - Match AI insights back to detected peaks/drop-offs by timestamp
   - Fill remaining empty peak/drop-off descriptions with data-based fallbacks

#### Step 8: Assemble & Store

1. **Assemble Final Payload** (Code node) — Merge all data into a single object with SQL-safe values:
   - Dollar-quote-escape all JSONB fields with unique tags (`$eg$`, `$pk$`, `$do$`, `$ai$`, `$ut$`, `$tx$`)
   - Single-quote-escape string fields

2. **Execute SQL Query** (Postgres node) — INSERT into `zoom_meeting_analytics` with `ON CONFLICT (client_name, meeting_id) DO UPDATE` for idempotency.

**Key columns stored:**

| Column | Type | Description |
|---|---|---|
| `engagement_graph` | JSONB | Time-series data for charting |
| `peaks` | JSONB | Top 5 engagement peaks with AI descriptions |
| `dropoffs` | JSONB | Top 5 engagement drop-offs with AI descriptions |
| `overall_ai_analysis` | JSONB | Full AI key_insights + recommendations |
| `user_time_report` | JSONB | Per-user attendance breakdown |
| `transcript` | TEXT | Full VTT transcript content |
| `engagement_score` | NUMERIC | Overall engagement score (0–100) |

---

## Module 2 — Engagement Dashboard in GHL

### Purpose

Track each contact's Zoom meeting attendance inside GoHighLevel, calculate an engagement score, assign a color-coded category, and display it all on a GHL dashboard with at-risk lists and recency bands.

### Part A: CRM Contact Updates (via n8n)

These run as a **parallel branch** off the same `meeting.ended` event, alongside Module 1.

#### Step 1: Build User Time Report

**Code node** (runs in parallel after Return Pages) — Same participant merge logic as Module 1's analytics, but focused on per-user output:

- Aggregate by email (deduplicate multiple join/leave records)
- Calculate `total_minutes` and `rejoins` per unique user
- Output: `{ total_users, user_time_report: [{ user_email, first_name, last_name, phone, total_minutes, rejoins, participant_id }] }`

**Split Out** node — Expand `user_time_report` array into individual items.

#### Step 2: Upsert Contact in GHL

**HTTP Request** → `POST https://services.leadconnectorhq.com/contacts/upsert`

Headers:
- `Authorization: Bearer <GHL_API_KEY>`
- `Version: 2021-07-28`
- `Content-Type: application/json`

Body:
```json
{
  "firstName": "{{first_name}}",
  "lastName": "{{last_name}}",
  "email": "{{user_email}}",
  "phone": "{{phone}}",
  "locationId": "<GHL_LOCATION_ID>",
  "customFields": [
    { "id": "last_live_call_attended_duration", "value": "{{total_minutes}}" },
    { "id": "last_live_call_id", "value": "{{meeting_id}}" },
    { "id": "last_live_call_title", "value": "{{meeting_name}}" }
  ]
}
```

**Rate limiting:** Batch size 90, interval 10 seconds. Retry on fail with 3-second wait.

**For webinars** (separate branch), use different field IDs:
- `zoom_attended_duration`
- `last_webinar_id`
- `last_webinar_title`

And a different `locationId` if webinars are tracked in a separate GHL sub-account.

#### Step 3: Add Contact Note in GHL

**Wait 2 minutes** (to avoid GHL rate limits after batch upserts).

**HTTP Request** → `POST https://services.leadconnectorhq.com/contacts/{contact_id}/notes`

Body:
```json
{
  "userId": "{{contact_id}}",
  "body": "Follow up on Zoom meeting attendance.\n\nMeeting ID: {{meeting_id}}\nMeeting/Webinar Title: {{meeting_name}}\nDate and time: {{start_time}}\nDuration: {{total_minutes}} min\nNumber of rejoins: {{rejoins}}"
}
```

### Part B: GHL Custom Fields Setup

Create these custom fields in GHL under **Settings → Custom Fields → Contact**:

| Field Name | Field Key (API ID) | Type | Description |
|---|---|---|---|
| Last Live Call Attended Duration | `last_live_call_attended_duration` | Number | Minutes spent in the most recent meeting |
| Last Live Call ID | `last_live_call_id` | Text | Meeting ID of last attended call |
| Last Live Call Title | `last_live_call_title` | Text | Topic of last attended call |
| Last Call Attempt Date | `last_call_attempt_date` | Date/Time | Date of most recent contact attempt |
| Date Of Attending Last Live Call >30 Mins | `date_attending_last_live_call_30_mins` | Date/Time | Timestamp if call was >30 min |
| Last Webinar Attended Date | `last_webinar_attended_date` | Date/Time | Date of last webinar attended |
| Last Webinar ID | `last_webinar_id` | Text | Webinar ID |
| Last Webinar Title | `last_webinar_title` | Text | Webinar topic |
| Date Of Attending Last Webinar | `date_attending_last_webinar` | Date/Time | Webinar attendance date |
| Total Zoom Time Attended | `total_zoom_time_attended` | Number | Cumulative minutes across all calls |
| Total Live Calls Attended | `total_live_calls_attended` | Number | Count of meetings attended |
| Total Cumulative Attended Duration Live Call | `total_cumulative_attended_duration_live_call` | Number | Running total of minutes |
| Zoom Rejoin Count | `zoom_rejoin_count` | Number | Times rejoined across meetings |
| Engagement Category | `engagement_category` | Text | RED / ORANGE / YELLOW / GREEN |
| Average Duration Per Live Call | `average_duration_per_live_call` | Number | Calculated average |
| Recency Band | `recency_band` | Text | "Last 7 days" / "8 to 14 days" / etc. |
| Leave Remainder Meeting ID | `leave_remainder_meeting_id` | Text | Used by Module 3 |
| Leave Remainder Meeting Name | `leave_remainder_meeting_name` | Text | Used by Module 3 |
| Leave Remainder Meeting Link | `leave_remainder_meeting_link` | Text | Used by Module 3 |

### Part C: GHL Automations (Workflow List)

Set up the following **5 GHL workflows** under the "Engagement Dashboard" folder:

#### Automation 1: Engagement Category with No Live Calls — RED

- **Trigger:** Contact field `Total Live Calls Attended` changes
- **Condition:** If `Total Live Calls Attended` = 0 AND field is not empty
- **Action:** Set `Engagement Category` = "RED"
- **Purpose:** Default new contacts with no attendance to RED

#### Automation 2: Engagement Score Calculator

- **Trigger:** Contact field `Total Cumulative Attended Duration Live Call` changes
- **Logic:**
  1. If `Total Live Calls Attended` > 0, continue; else set `Average Duration Per Live Call` = 0 and exit
  2. Calculate: `average = total_duration / total_calls / 60`
  3. Calculate: `quality_score = total_duration / 20`
  4. If average > 1 minute:
     - `score = (average / 60) × 40 + quality_score`
  5. Assign category based on score:
     - Score < 25 → **RED**
     - 25 ≤ Score < 50 → **ORANGE**
     - 50 ≤ Score < 75 → **YELLOW**
     - Score ≥ 75 → **GREEN**
  6. Update `Engagement Category` and `Engagement Category Changed Date`

#### Automation 3: Live Calls Attended Number Update

- **Trigger:** Contact field `Total Live Calls Attended` changes
- **Condition:** If field is empty (no value)
- **Action:** Set `Total Live Calls Attended` = 0
- **Purpose:** Initialize the field so engagement calculations don't break on null values

#### Automation 4: Recency Band Update

- **Trigger:** Scheduled — runs daily at midnight
- **Logic:** For each contact, check `Last Live Call Attended Date`:
  - 0–7 days ago → `Recency Band` = "Last 7 days"
  - 8–14 days ago → `Recency Band` = "8 to 14 days"
  - 15–28 days ago → `Recency Band` = "15 to 30 days"
  - 29+ days ago → `Recency Band` = "30+ days"
  - Never attended → `Recency Band` = "Never attended"

#### Automation 5: Update Total Live Calls to 0 for Empty Values

- **Trigger:** Contact field `Total Live Calls Attended` changes
- **Condition:** If field value is empty
- **Action:** Set to 0
- **Purpose:** Prevent null values in calculations

### Part D: GHL Dashboard Configuration

Create a dashboard called **"Engagement Dashboard"** with the following widgets:

**Row 1 — Summary Cards:**

| Card | Filter / Source |
|---|---|
| Total Contacts | All contacts count |
| 🔴 RED | Count where `Engagement Category` = RED |
| 🟠 ORANGE | Count where `Engagement Category` = ORANGE |
| 🟡 YELLOW | Count where `Engagement Category` = YELLOW |
| 🟢 GREEN | Count where `Engagement Category` = GREEN |

**Row 2 — Trend Cards:**

| Card | Filter |
|---|---|
| ✅ New Greens (last 7 days) | Contacts where `Engagement Category` changed to GREEN in last 7 days |
| ⚠️ Dropped to Red/Orange (last 7 days) | Contacts where category dropped in last 7 days |
| 🤧 Inactive 30+ days | Contacts where last attendance was 30+ days ago |
| 👋 Never Attended | Contacts where `Total Live Calls Attended` = 0 |

**Row 3 — Charts & Tables:**

| Widget | Description |
|---|---|
| Customer Engagement (Bar Chart) | Count of contacts per engagement category (GREEN, YELLOW, ORANGE, RED) |
| 📋 Last Live Call Attended Date | Table showing recent attendance dates |
| ⚠️ AT RISK LIST | Table: Contact Name, Email, Phone, Total Live Calls Attended, Total Cumulative Duration — filtered for RED + ORANGE contacts |

**Dashboard date range:** Last 30 Days (configurable).

---

## Module 3 — Zoom Leave Reminder Automation

### Purpose

When a participant leaves a meeting or webinar while it's still in progress, upsert their contact in GHL with the meeting details and rejoin link. This enables GHL automations to send SMS/email reminders to rejoin.

### Trigger

Zoom events:
- `meeting.participant_left` → Switch Output 2
- `webinar.participant_left` → Switch Output 3

### Step-by-Step Implementation

#### For Meetings (`meeting.participant_left`)

1. **Build Normal Event Body** (Set node) — Extract:
   - `meeting_id` → `$json.body.payload.object.id`
   - `meeting_name` → `$json.body.payload.object.topic`
   - `participant_mail` → `$json.body.payload.object.participant.email`
   - `meeting_type` → Webinar or Meeting (based on type 5/6/9)

2. **Respond to Webhook** — Return 200 OK immediately.

3. **Wait 1 second** — Brief pause before API call.

4. **Get Zoom Auth Token** — Same OAuth flow as Module 1.

5. **Get Meeting Details** — `GET /v2/meetings/{meeting_id}` to retrieve `join_url`.

6. **Wait** (Wait node) — Brief pause to space out API calls.

7. **Upsert Contact in GHL** — `POST /contacts/upsert`:

```json
{
  "locationId": "<GHL_LOCATION_ID>",
  "email": "{{participant_email}}",
  "customFields": [
    { "key": "leave_remainder_meeting_id", "value": "{{meeting_id}}" },
    { "key": "leave_remainder_meeting_name", "value": "{{meeting_name}}" },
    { "key": "leave_remainder_meeting_link", "value": "{{join_url}}" }
  ]
}
```

#### For Webinars (`webinar.participant_left`)

Same flow as meetings but uses:
- `GET /v2/metrics/webinars/{meeting_id}` to retrieve webinar details and `join_url`
- Different event body construction node

### GHL Follow-Up Automation (to be built in GHL)

- **Trigger:** `leave_remainder_meeting_id` field changes
- **Condition:** If the meeting is still in progress (check against meeting duration or end time)
- **Action:** Send SMS/Email with template:
  > "Hey {first_name}, we noticed you left '{leave_remainder_meeting_name}'. You can rejoin here: {leave_remainder_meeting_link}"
- **Delay:** Optional 2–5 minute wait before sending

---

## 7. Testing & Validation

### Test Checklist

| # | Test Case | Expected Result |
|---|---|---|
| 1 | Zoom URL validation event | n8n returns HMAC SHA-256 response; Zoom validates the endpoint |
| 2 | Meeting ends with <30 participants | Analytics calculated; single page; data stored in Postgres |
| 3 | Meeting ends with >30 participants | Pagination loop fetches all pages; all participants included |
| 4 | Webinar ends (type 5/6/9) | Routed to webinar participant API; correct GHL fields updated |
| 5 | Meeting with transcript | Transcript downloaded; AI analysis generated; peaks/dropoffs enriched |
| 6 | Meeting without transcript | Fallback AI response; analytics still stored successfully |
| 7 | GHL contact upsert | New contact created with correct custom fields; existing contact updated |
| 8 | GHL notes | Note added to contact with meeting details, duration, rejoins |
| 9 | Participant leaves mid-meeting | Leave reminder fields populated in GHL; follow-up automation fires |
| 10 | Engagement score calculation | Score correctly categorizes contact as RED/ORANGE/YELLOW/GREEN |
| 11 | Recency band update | Daily cron correctly categorizes contacts by last attendance date |
| 12 | Duplicate meeting.ended events | ON CONFLICT upsert handles idempotently; no duplicate rows |

### Validation Steps

1. **Trigger a test meeting** — Start and end a Zoom meeting with 2–3 participants.
2. **Check n8n execution** — Verify all nodes complete without errors.
3. **Check Postgres** — Query `SELECT * FROM zoom_meeting_analytics WHERE meeting_id = '...'` and verify all fields populated.
4. **Check GHL contacts** — Verify custom fields updated for each participant.
5. **Check GHL notes** — Verify attendance notes added.
6. **Test leave reminder** — Have a participant leave mid-meeting; verify GHL fields populated.
7. **Test engagement dashboard** — Verify dashboard widgets show correct counts and charts.

---

## 8. Appendix

### Appendix A: Postgres Table Schema

```sql
CREATE TABLE zoom_meeting_analytics (
    id                          BIGSERIAL PRIMARY KEY,
    client_name                 VARCHAR(100) NOT NULL,
    meeting_id                  VARCHAR(50) NOT NULL,
    meeting_name                TEXT,
    meeting_type                INTEGER,
    meeting_start_time          TIMESTAMPTZ,
    meeting_end_time            TIMESTAMPTZ,
    meeting_duration_minutes    INTEGER,
    interval_minutes            INTEGER DEFAULT 5,
    generated_at                TIMESTAMPTZ,
    data_source                 VARCHAR(50),

    total_unique_participants       INTEGER,
    total_participant_records       INTEGER,
    average_participation_minutes   NUMERIC(10,2),
    max_participation_minutes       NUMERIC(10,2),
    min_participation_minutes       NUMERIC(10,2),

    engagement_score            NUMERIC(10,2),
    average_retention           NUMERIC(10,2),
    peak_concurrent_users       INTEGER,
    final_active_users          INTEGER,
    total_joined                INTEGER,
    total_left                  INTEGER,

    engagement_graph            JSONB,
    peaks                       JSONB,
    dropoffs                    JSONB,
    overall_ai_analysis         JSONB,
    user_time_report            JSONB,

    transcript_available        BOOLEAN DEFAULT FALSE,
    transcript_download_url     TEXT,
    transcript                  TEXT,
    status                      VARCHAR(20) DEFAULT 'COMPLETED',

    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(client_name, meeting_id)
);

CREATE INDEX idx_zma_client ON zoom_meeting_analytics(client_name);
CREATE INDEX idx_zma_meeting ON zoom_meeting_analytics(meeting_id);
CREATE INDEX idx_zma_start ON zoom_meeting_analytics(meeting_start_time);
```

### Appendix B: Engagement Score Formula

```
IF total_live_calls_attended == 0:
    engagement_category = RED
    RETURN

average_duration = total_cumulative_duration / total_live_calls / 60

IF average_duration <= 1:
    engagement_category = RED
    RETURN

quality_score = total_cumulative_duration / 20
score = (average_duration / 60) * 40 + quality_score

IF score < 25   → RED
IF score < 50   → ORANGE
IF score < 75   → YELLOW
IF score >= 75  → GREEN
```

### Appendix C: n8n Node-to-Node Connection Map

```
Webhook Trigger
  → Switch
    [0] → Crypto1 → Format Validation Response → Respond Validation
    [1] → Build Normal Event Body1 → Respond 200 OK → Wait 2 Seconds → Is Webinar?
        [True]  → Auth Token → Get First Page (Webinar) → Accumulate → Has More Pages?
                    [Yes] → Get Next Page → Accumulate (loop)
                    [No]  → Return Pages → Calculate Engagement Analytics
                                         → Code in JavaScript3 (GHL branch)
        [False] → Auth Token → Get First Page (Meeting) → Accumulate → Has More Pages?
                    [Yes] → Get Next Page → Accumulate (loop)
                    [No]  → Return Pages → Calculate Engagement Analytics
                                         → Code in JavaScript2 (GHL branch)

    Calculate Engagement Analytics → Auth Token → Fetch Recordings
      → Extract Transcript Info → Transcript Available?
        [Yes] → Auth Token → Download Transcript → Build AI Prompt
               → Message a Model (GPT-4o-mini) → Parse AI Response
        [No]  → (skips to Assemble)
      → Assemble Final Payload → Execute SQL Query (Postgres)

    GHL Branch (Meeting): Code in JavaScript2 → Split Out → HTTP Upsert
      → Edit Fields → Wait 2 min → HTTP Add Note

    GHL Branch (Webinar): Code in JavaScript3 → Split Out1 → HTTP Upsert
      → Edit Fields1 → Wait 2 min → HTTP Add Note

    [2] → Build Normal Event Body → Respond → Wait 1s → Auth Token
        → Get Meeting Details → Wait → HTTP Upsert (Leave Reminder)

    [3] → Build Normal Event Body2 → Respond → Wait 1s → Auth Token
        → Get Webinar Details → Wait → HTTP Upsert (Leave Reminder)
```

### Appendix D: GHL API Endpoints Used

| Action | Method | Endpoint |
|---|---|---|
| Upsert Contact | POST | `https://services.leadconnectorhq.com/contacts/upsert` |
| Add Note | POST | `https://services.leadconnectorhq.com/contacts/{contactId}/notes` |

Required headers for all GHL API calls:
- `Authorization: Bearer <API_KEY>`
- `Content-Type: application/json`
- `Version: 2021-07-28`

### Appendix E: Zoom API Endpoints Used

| Action | Method | Endpoint |
|---|---|---|
| Get OAuth Token | POST | `https://zoom.us/oauth/token` |
| Meeting Participants Report | GET | `https://api.zoom.us/v2/report/meetings/{meetingId}/participants` |
| Webinar Participants Report | GET | `https://api.zoom.us/v2/report/webinars/{webinarId}/participants` |
| Meeting Recordings | GET | `https://api.zoom.us/v2/meetings/{meetingId}/recordings` |
| Meeting Details | GET | `https://api.zoom.us/v2/meetings/{meetingId}` |
| Webinar Metrics | GET | `https://api.zoom.us/v2/metrics/webinars/{webinarId}` |

---

*Document generated March 2026. Refer to the n8n workflow JSON for exact node configurations and code.*
