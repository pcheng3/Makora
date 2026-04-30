# Yubel

AI-powered code review web app with human-in-the-loop learning. Reviews git diffs via Claude CLI, lets users rate each finding (thumbs up/down + optional comment), and learns from feedback to improve future reviews.

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- SQLite via better-sqlite3 (single file at `data/review.db`)
- AI invocation via Claude Code CLI (`claude -p --bare --json-schema`)
- simple-git for git operations
- SSE (Server-Sent Events) for streaming review progress

## Architecture

### `src/lib/db/` — Database layer
- `connection.ts` — SQLite connection (auto-creates `data/review.db`)
- `schema.ts` — Table definitions + migrations (sessions, review_items, ratings, rules, guidance_files, rule_source_ratings, settings)
- `sessions.ts` — Session CRUD, distinct repos list
- `review-items.ts` — Review item insert/query
- `ratings.ts` — Rating upsert, few-shot example queries
- `rules.ts` — Rule CRUD, relevance scoring (`getRelevantRules`), bulk operations
- `guidance.ts` — Guidance file metadata CRUD
- `settings.ts` — Key-value settings (skip_extensions, etc.)

### `src/lib/ai/` — AI & review orchestration
- `orchestrator.ts` — Core review loop: diff → chunk → parallel AI calls → SSE events. Supports cancellation via AbortController.
- `provider.ts` — Claude CLI provider (spawns `claude` subprocess with `--bare --json-schema`)
- `prompt-builder.ts` — Builds system prompt from rules, guidance files, and few-shot examples
- `sse.ts` — SSE pub/sub for streaming review progress to the client (uses `globalThis` for cross-route persistence)

### `src/lib/git/` — Git operations
- `diff.ts` — Diff stats, commit hash, repo info, branch detection (via simple-git)

### `src/lib/learning/` — Feedback learning pipeline
- `pipeline.ts` — Processes rated items into rules via Claude CLI, consolidates similar rules via Jaccard clustering + AI merge, extracts file extensions for relevance filtering

### `src/app/api/` — REST API routes
- `reviews/` — Create session + start review (POST), get session (GET), cancel (POST), SSE stream
- `ratings/` — Submit rating for a review item
- `rules/` — CRUD, export (GET JSON download), import (POST JSON upload)
- `guidance/` — Upload/delete/toggle guidance files
- `settings/skip-extensions/` — GET/PUT skip extension list
- `git/` — Repo info endpoint
- `learn/` — Trigger learning pipeline

### `src/components/review/` — Review UI components
- `ReviewItemCard.tsx` — Single review finding card with severity, code snippet, rating controls
- `RatingControls.tsx` — Thumbs up/down + comment input
- `DiffSnippet.tsx` — Syntax-highlighted code display
- `SeverityBadge.tsx` — Color-coded severity label

### `src/app/` — Pages
- `page.tsx` — Home: repo picker (with saved repos), branch selection, start review
- `review/[sessionId]/page.tsx` — Live review session with SSE streaming, progress bar, stop button, rotating quips
- `settings/page.tsx` — Rules (add/edit/toggle/delete/export/import), Guidance files (upload/drag-drop/toggle), File Filters (skip extensions)
- `history/page.tsx` — Past review sessions list

## Key Design Decisions
- Reviews invoked via `claude -p --bare --json-schema` subprocess (no API keys needed — uses local Claude CLI auth)
- Large diffs split into chunks of 15 files, processed in parallel batches (MAX_PARALLEL = 3)
- `globalThis` pattern used for SSE listeners and active review controllers to survive Next.js module re-evaluation
- Relevance scoring: `extensionMatch * 0.4 + confidence * 0.4 + usage * 0.2` (manual rules always score 1.0)
- Few-shot examples: rated items injected as concrete good/bad examples, prioritizing items with user comments and matching file extensions
- Rule consolidation: Jaccard word similarity clusters similar rules, Claude merges them
- File extension filtering: configurable skip list (default: .meta, .prefab, .asset, .unity, .mat, .lighting)
- Ratings are 1-per-item (upsert). Learning triggers after every 5 ratings.
- Guidance files stored on disk (`data/guidance/`), metadata in DB
- Rules exportable as JSON for sharing across teams

## Data Storage
- `data/review.db` — SQLite database (gitignored)
- `data/guidance/` — Uploaded guidance files (gitignored)
- Both directories have `.gitkeep` files committed

## Running
```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build
```
