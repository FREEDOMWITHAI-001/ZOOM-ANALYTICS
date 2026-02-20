# Zoom Analytics Dashboard

A full-stack **Next.js 14** application for analyzing Zoom meeting/webinar engagement data. Provides real-time attendance tracking, retention graphs, AI-powered transcript analysis, and actionable insights — all in a single deployable container.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Docker Deployment](#docker-deployment)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Architecture Overview](#architecture-overview)

---

## Features

- **Attendance Tracking** — Visualize participant join/leave patterns over time
- **Retention Graphs** — Line, area, and bar charts with configurable time intervals (1, 2, 5, 10, 15 min)
- **Peak & Drop-off Detection** — Automatically identifies significant engagement spikes and drops
- **AI-Powered Insights** — OpenAI GPT-4o-mini analyzes transcripts to explain _why_ engagement changed
- **Full Transcript Analysis** — Upload VTT/SRT captions or fetch stored transcripts for deep analysis
- **Comparison Mode** — Side-by-side comparison of two webinar sessions
- **CSV Upload** — Import Zoom attendance reports directly
- **Dark/Light Theme** — Toggle between themes with persistent preference
- **Export** — Download analytics data as CSV

---

## Tech Stack

| Layer        | Technology                                     |
| ------------ | ---------------------------------------------- |
| Framework    | Next.js 14 (App Router)                        |
| Language     | TypeScript                                     |
| UI           | React 18, Tailwind CSS, shadcn/ui (new-york)   |
| Charts       | Recharts                                       |
| Animations   | Framer Motion                                  |
| Database     | PostgreSQL (via `pg` connection pool)           |
| AI           | OpenAI GPT-4o-mini (server-side API routes)    |
| Deployment   | Docker (node:20-alpine, standalone output)      |

---

## Project Structure

```
ZOOM-ANALYTICS/
├── zoom-analytics/              # Main Next.js application
│   ├── app/
│   │   ├── page.tsx             # Single-page app (landing → upload → results)
│   │   ├── layout.tsx           # Root layout with ThemeProvider
│   │   └── api/                 # API routes (8 endpoints)
│   │       ├── health/
│   │       ├── recordings/
│   │       ├── analytics-with-insights/[meetingId]/
│   │       ├── transcript-direct/[meetingId]/
│   │       ├── insights/generate/
│   │       ├── ai/analyze-transcript/
│   │       ├── ai/analyze-full-transcript/
│   │       └── analysis/simple/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui component library
│   │   ├── results/             # Results sub-components
│   │   ├── graph/               # Chart components (BaseGraph, controls)
│   │   ├── upload/              # Upload sub-components
│   │   └── *.tsx                # Top-level components
│   ├── lib/
│   │   ├── db.ts                # PostgreSQL connection pool
│   │   ├── csv/                 # CSV parsing & metrics utilities
│   │   ├── captions/            # VTT/SRT caption parser
│   │   ├── theme-provider.tsx   # Dark/light theme context
│   │   └── utils.ts             # Shared utilities
│   ├── services/                # OpenAI service & logging
│   ├── Dockerfile               # Multi-stage Docker build
│   ├── docker-compose.yml       # Docker Compose configuration
│   ├── next.config.js           # Next.js config (standalone output)
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── tsconfig.json            # TypeScript configuration
│   └── package.json             # Dependencies & scripts
```

---

## Prerequisites

- **Node.js** >= 20.x
- **npm** >= 9.x
- **PostgreSQL** database with the `zoom_meeting_analytics` table
- **OpenAI API Key** (for AI-powered analysis features)
- **Docker** & **Docker Compose** (for containerized deployment)

---

## Environment Variables

Create a `.env.local` file inside `zoom-analytics/`:

```env
# PostgreSQL Database
DB_HOST=140.245.206.162
DB_PORT=5432
DB_NAME=devdb
DB_USER=devuser
DB_PASSWORD=dev@2026

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

| Variable         | Required | Default       | Description                        |
| ---------------- | -------- | ------------- | ---------------------------------- |
| `DB_HOST`        | Yes      | —             | PostgreSQL host address            |
| `DB_PORT`        | No       | `5432`        | PostgreSQL port                    |
| `DB_NAME`        | Yes      | —             | Database name                      |
| `DB_USER`        | Yes      | —             | Database username                  |
| `DB_PASSWORD`    | Yes      | —             | Database password                  |
| `OPENAI_API_KEY` | Yes      | —             | OpenAI API key for AI features     |
| `OPENAI_MODEL`   | No       | `gpt-4o-mini` | OpenAI model to use                |

---

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd ZOOM-ANALYTICS/zoom-analytics

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your database and OpenAI credentials
```

---

## Running Locally

### Development Mode (with hot reload)

```bash
cd zoom-analytics
npm run dev
```

The app will be available at **http://localhost:3000**

### Production Build

```bash
cd zoom-analytics
npm run build
npm start
```

### Available Scripts

| Script        | Command        | Description                     |
| ------------- | -------------- | ------------------------------- |
| `npm run dev` | `next dev`     | Start dev server with hot reload |
| `npm run build` | `next build` | Create production build          |
| `npm start`   | `next start`   | Start production server          |
| `npm run lint` | `next lint`   | Run ESLint                       |

---

## Docker Deployment

### Ports

| Service          | Container Port | Host Port | Description             |
| ---------------- | -------------- | --------- | ----------------------- |
| zoom-analytics   | **3000**       | **3005**  | Next.js application     |
| PostgreSQL (ext) | —              | **5432**  | External database       |

### Using Docker Compose (Recommended)

```bash
cd zoom-analytics

# Set your OpenAI API key in the environment
export OPENAI_API_KEY=your-openai-api-key-here

# Build and start the container
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The app will be available at **http://localhost:3005**

### Using Docker Directly

```bash
cd zoom-analytics

# Build the image
docker build -t zoom-analytics .

# Run the container
docker run -d \
  --name zoom-analytics \
  -p 3005:3000 \
  -e DB_HOST=140.245.206.162 \
  -e DB_PORT=5432 \
  -e DB_NAME=devdb \
  -e DB_USER=devuser \
  -e DB_PASSWORD=dev@2026 \
  -e OPENAI_API_KEY=your-openai-api-key-here \
  -e OPENAI_MODEL=gpt-4o-mini \
  --restart unless-stopped \
  zoom-analytics
```

### Docker Build Details

The Dockerfile uses a **multi-stage build** for a minimal production image:

1. **Stage 1 (deps)** — Installs Node.js dependencies
2. **Stage 2 (builder)** — Builds the Next.js app with `output: 'standalone'`
3. **Stage 3 (runner)** — Copies only the standalone output (~minimal image size)
   - Base image: `node:20-alpine`
   - Runs as non-root user (`nextjs:nodejs`)
   - Exposes port `3000`

---

## API Endpoints

### Health Check

| Method | Endpoint       | Description          |
| ------ | -------------- | -------------------- |
| GET    | `/api/health`  | Service health check |

**Response:**
```json
{
  "status": "UP",
  "service": "zoom-dashboard"
}
```

---

### Recordings

| Method | Endpoint           | Description                      |
| ------ | ------------------ | -------------------------------- |
| GET    | `/api/recordings`  | List all available meetings      |

**Response:**
```json
{
  "success": true,
  "total_records": 3,
  "meetings": [
    {
      "id": "uuid",
      "meeting_id": "123456789",
      "topic": "Weekly Webinar",
      "start_time": "2025-01-15T10:00:00Z",
      "duration": 60,
      "total_participants": 150,
      "recording_count": 1,
      "total_size": 0,
      "type": "webinar",
      "status": "completed",
      "recording_files": [{ "file_type": "ANALYTICS", "status": "completed" }]
    }
  ]
}
```

---

### Analytics with Insights

| Method | Endpoint                                    | Description                              |
| ------ | ------------------------------------------- | ---------------------------------------- |
| GET    | `/api/analytics-with-insights/{meetingId}`  | Full analytics data for a specific meeting |

**Query Parameters:**

| Param      | Type   | Description                |
| ---------- | ------ | -------------------------- |
| `interval` | number | Time interval in minutes   |

**Response:**
```json
{
  "meeting_id": "123456789",
  "success": true,
  "interval_minutes": 5,
  "meeting_duration": 90,
  "total_participants": 150,
  "engagement_graph": {
    "labels": ["00:00", "00:05", "00:10"],
    "active_participants": [50, 120, 110],
    "engagement_rate": [33.3, 80.0, 73.3]
  },
  "peaks": [{ "timeInterval": "00:05", "count": 120, "percentageChange": 12 }],
  "dropoffs": [{ "timeInterval": "00:30", "count": 80, "percentageChange": -25 }],
  "participant_details": [],
  "user_timelines": [],
  "peak_retention": 120,
  "average_retention": 75.3,
  "transcript_available": true,
  "overall_ai_analysis": {
    "key_insights": ["..."],
    "recommendations": ["..."]
  },
  "data_source": "postgresql"
}
```

---

### Transcript

| Method | Endpoint                                  | Description                         |
| ------ | ----------------------------------------- | ----------------------------------- |
| GET    | `/api/transcript-direct/{meetingId}`      | Fetch raw VTT transcript content    |

**Response (success):**
```json
{
  "success": true,
  "meeting_id": "123456789",
  "transcript_available": true,
  "has_content": true,
  "content": "WEBVTT\n00:00:01.000 --> 00:00:05.000\nHello everyone...",
  "content_length": 45232
}
```

**Response (not found):**
```json
{
  "success": false,
  "meeting_id": "123456789",
  "transcript_available": false,
  "error": "No transcript content available for this meeting"
}
```

---

### AI: Generate Insights

| Method | Endpoint                  | Description                                      |
| ------ | ------------------------- | ------------------------------------------------ |
| POST   | `/api/insights/generate`  | AI-generated explanations for peaks & drop-offs   |

**Request Body:**
```json
{
  "peaks": [
    {
      "timeInterval": "00:15",
      "count": 120,
      "percentageChange": 12,
      "transcriptContext": "relevant transcript text..."
    }
  ],
  "dropoffs": [
    {
      "timeInterval": "00:30",
      "count": 80,
      "percentageChange": -25,
      "transcriptContext": "relevant transcript text..."
    }
  ]
}
```

**Response:**
```json
{
  "peak-00:15": "At 00:15, engagement increased because the speaker introduced a live product demo.",
  "dropoff-00:30": "At 00:30, engagement decreased because the content shifted to dense technical details."
}
```

---

### AI: Analyze Single Transcript Segment

| Method | Endpoint                        | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| POST   | `/api/ai/analyze-transcript`    | Structured analysis of a single time point |

**Request Body:**
```json
{
  "time": "00:15",
  "participants": 120,
  "transcript": "segment text..."
}
```

**Response:**
```json
{
  "time": "00:15",
  "content_quality": {
    "clarity_1to5": 4,
    "structure_1to5": 3,
    "specificity_1to5": 5
  },
  "engagement_potential": {
    "energy_1to5": 3,
    "interactivity_1to5": 2,
    "actionability_1to5": 4
  },
  "evidence_phrases": ["exact phrase 1", "exact phrase 2"],
  "one_line_summary": "Speaker demonstrated the product with concrete examples.",
  "one_improvement": "Add a poll or question to increase audience interaction."
}
```

---

### AI: Analyze Full Transcript

| Method | Endpoint                            | Description                                        |
| ------ | ----------------------------------- | -------------------------------------------------- |
| POST   | `/api/ai/analyze-full-transcript`   | Full transcript analysis with insights & recommendations |

**Request Body:**
```json
{
  "transcript": "WEBVTT\n00:00:01.000 --> 00:00:05.000\nHello everyone..."
}
```

> Minimum transcript length: 100 characters

**Response:**
```json
{
  "key_insights": [
    "At 00:10, engagement increased because the speaker shifted from abstract concepts to concrete examples.",
    "At 00:35, engagement decreased because the monologue extended for 8 minutes without interaction."
  ],
  "recommendations": [
    "Instead of presenting slides at 00:35, the speaker should ask the audience a question.",
    "Instead of explaining the architecture diagram at 00:50, the speaker should show a live demo."
  ]
}
```

---

### Simple Analysis (Rule-Based Fallback)

| Method | Endpoint                | Description                              |
| ------ | ----------------------- | ---------------------------------------- |
| POST   | `/api/analysis/simple`  | Rule-based analytics (no AI required)    |

**Request Body:**
```json
{
  "totalAttendees": 150,
  "averageRetention": 72.4,
  "peaks": [{ "timeInterval": "00:15", "count": 120, "percentageChange": 12 }],
  "dropoffs": [{ "timeInterval": "00:30", "count": 80, "percentageChange": -25 }]
}
```

**Response:**
```json
{
  "success": true,
  "insights": [
    "Total attendance was 150 with average retention of 72.4%.",
    "Highest engagement occurred at 00:15 with 120 participants.",
    "Largest drop-off of 25% occurred at 00:30."
  ],
  "recommendations": [
    "Reduce long monologues during drop-off segments.",
    "Improve pacing when engagement declines.",
    "Add interactive elements to maintain audience interest."
  ]
}
```

---

## Database Schema

The application uses a single PostgreSQL table: **`zoom_meeting_analytics`**

| Column                       | Type      | Description                                |
| ---------------------------- | --------- | ------------------------------------------ |
| `id`                         | SERIAL    | Primary key                                |
| `meeting_id`                 | TEXT      | Zoom meeting identifier                    |
| `meeting_name`               | TEXT      | Meeting topic/name                         |
| `meeting_start_time`         | TIMESTAMP | Meeting start time                         |
| `meeting_duration_minutes`   | INTEGER   | Duration in minutes                        |
| `meeting_type`               | TEXT      | Meeting type (webinar, meeting, etc.)      |
| `status`                     | TEXT      | Meeting status                             |
| `total_unique_participants`  | INTEGER   | Total unique attendees                     |
| `peak_concurrent_users`      | INTEGER   | Maximum concurrent participants            |
| `final_active_users`         | INTEGER   | Participants at meeting end                |
| `average_retention`          | FLOAT     | Average retention percentage               |
| `engagement_score`           | INTEGER   | Computed engagement score (0-100)          |
| `interval_minutes`           | INTEGER   | Data interval granularity                  |
| `engagement_graph`           | JSONB     | `{ labels, active_participants, engagement_rate }` |
| `peaks`                      | JSONB     | Array of peak event objects                |
| `dropoffs`                   | JSONB     | Array of drop-off event objects            |
| `user_time_report`           | JSONB     | Per-user attendance timeline data          |
| `overall_ai_analysis`        | JSONB     | `{ key_insights, recommendations }`       |
| `transcript`                 | TEXT      | VTT transcript content                    |
| `transcript_available`       | BOOLEAN   | Whether transcript exists                  |
| `transcript_download_url`    | TEXT      | URL for transcript download                |
| `generated_at`               | TIMESTAMP | Record creation timestamp                  |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Landing   │→│  Upload  │→│   Results     │  │
│  │  Section   │ │  Section │ │   Dashboard   │  │
│  └────────────┘ └──────────┘ └───────────────┘  │
└────────────────────────┬─────────────────────────┘
                         │ Relative /api/* calls
                         ▼
┌──────────────────────────────────────────────────┐
│           Next.js 14 (App Router)                │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │            API Routes (server-side)         │ │
│  │                                             │ │
│  │  /api/recordings                            │ │
│  │  /api/analytics-with-insights/[meetingId]   │ │
│  │  /api/transcript-direct/[meetingId]         │ │
│  │  /api/insights/generate          ──────┐    │ │
│  │  /api/ai/analyze-transcript      ──────┤    │ │
│  │  /api/ai/analyze-full-transcript ──────┤    │ │
│  │  /api/analysis/simple                  │    │ │
│  │  /api/health                           │    │ │
│  └────────────────┬───────────────────────┘    │ │
│                   │                       │      │
│                   ▼                       ▼      │
│           ┌──────────────┐     ┌──────────────┐  │
│           │  PostgreSQL  │     │   OpenAI     │  │
│           │  (pg Pool)   │     │  GPT-4o-mini │  │
│           └──────────────┘     └──────────────┘  │
│                                                  │
│           Port: 3000 (container)                 │
│           Port: 3005 (host via docker-compose)   │
└──────────────────────────────────────────────────┘
```

### Data Flow

1. **Landing** — User sees feature overview, clicks "Start Analysis"
2. **Upload** — App fetches available recordings from `/api/recordings` (PostgreSQL). User selects a recording or uploads a CSV file
3. **Results** — App fetches full analytics from `/api/analytics-with-insights/{meetingId}`, displays retention graph, statistics, peaks/drop-offs
4. **AI Analysis** — On demand, transcript is fetched via `/api/transcript-direct/{meetingId}` and sent to OpenAI through server-side API routes for insights generation

---

## License

This project is proprietary. All rights reserved.
