# Makora

Named after [Mahoraga](https://jujutsu-kaisen.fandom.com/wiki/Eight-Handled_Sword_Divergent_Sila_Divine_General_Mahoraga) — the strongest shikigami from Jujutsu Kaisen that adapts to any attack it survives. Once Mahoraga sees a technique, it develops a counter and never falls for it again.

Makora works the same way for code reviews. It starts as a general-purpose AI reviewer, but every time you rate a finding — thumbs up or thumbs down — it learns. It extracts patterns from your feedback, consolidates similar rules, and injects them into future reviews. The more you use it, the more it aligns with your team's standards, style, and priorities.

## Features

- **AI-powered code review** — Analyzes git diffs and produces findings with severity levels, code snippets, file locations, and suggested fixes
- **Human-in-the-loop learning** — Rate each finding (thumbs up/down + optional comment). After enough ratings, Makora synthesizes rules and few-shot examples that shape future reviews
- **Rule consolidation** — Similar rules are automatically clustered and merged so the prompt stays focused
- **Guidance files** — Upload coding standards, anti-pattern docs, or CLAUDE.md files to steer reviews from day one
- **Two AI providers** — Local Claude CLI (agentic, can explore repo files) or Vertex API (faster, direct API calls via Scapula/Foundry)
- **Live streaming** — SSE-based progress with real-time activity log, chunk progress, and findings as they arrive
- **Rule sharing** — Export/import learned rules as JSON across teams

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- At least one AI provider:
  - **Claude CLI** — [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated, or
  - **Vertex API** — A Vertex-compatible endpoint (e.g. Scapula) with an auth token

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Go to **Settings > AI Provider** and verify at least one provider
2. Enter a repo path, select branches, and start a review

## How It Works

1. **Start a review** — Pick a repo, select the branch to review and the base branch to diff against. Choose your AI provider.
2. **AI reviews the diff** — The diff is split into chunks (15 files each) and reviewed in parallel. Findings stream in as they're produced.
3. **Rate findings** — Thumbs up for useful findings, thumbs down for noise. Add comments to explain why.
4. **Makora learns** — Hit "Learn from Ratings" and the learning pipeline extracts patterns into rules. Similar rules are automatically clustered (Jaccard similarity) and merged by the AI.
5. **Future reviews improve** — Learned rules, few-shot examples from your past ratings, and guidance files are all injected into the system prompt for subsequent reviews.

## Project Structure

```
src/
  app/                  # Next.js pages and API routes
    api/
      reviews/          # Review session CRUD, SSE streaming, cancellation
      ratings/          # Submit ratings for review items
      rules/            # Rule CRUD, export/import
      guidance/         # Guidance file upload/toggle/delete
      settings/         # Provider config, skip extensions, custom prompt
      git/              # Repo info and file browser
      learn/            # Trigger learning pipeline
    review/[sessionId]/ # Live review session page
    settings/           # Rules, guidance, file filters, AI provider config
    history/            # Past review sessions
  lib/
    ai/                 # Orchestrator, providers (Claude CLI + Vertex), prompt builder, SSE
    db/                 # SQLite schema, connection, CRUD modules, settings
    git/                # Git diff and repo operations
    learning/           # Feedback-to-rules pipeline (synthesis + consolidation)
  components/
    review/             # ReviewItemCard, RatingControls, DiffSnippet, SeverityBadge
    layout/             # Sidebar navigation
```

## Rule Sharing

Export your learned rules as JSON and share them with your team:

1. Go to **Settings > Learned Rules**
2. Click **Export** to download `makora-rules.json`
3. Share the file — others click **Import** to load your rules

Imported rules are deduplicated by title, so re-importing the same file is safe.
