# Makora

Makora is an adaptive AI code reviewer that studies your feedback and evolves its review style over time — like Mahoraga, once it sees a pattern, it never misses it again.

Point it at a git repo, pick a branch, and get an AI-powered code review. Rate each finding with thumbs up/down, and Makora learns your preferences to improve future reviews.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a repo path, select branches, and start a review.

## How It Works

1. **Start a review** — Pick a repo, select the branch to review and the base branch to diff against
2. **AI reviews the diff** — Claude analyzes the changes, producing findings with severity, code snippets, and suggested fixes
3. **Rate findings** — Thumbs up for useful findings, thumbs down for unhelpful ones. Add optional comments explaining why.
4. **Makora learns** — After 5+ ratings, the learning pipeline extracts patterns into rules. Similar rules are automatically consolidated.
5. **Future reviews improve** — Learned rules and few-shot examples are injected into subsequent review prompts

## Project Structure

```
src/
  app/                  # Next.js pages and API routes
    api/
      reviews/          # Review session CRUD, SSE streaming, cancellation
      ratings/          # Submit ratings
      rules/            # Rule CRUD, export, import
      guidance/         # Guidance file management
      settings/         # App settings (skip extensions)
      git/              # Repo info endpoint
      learn/            # Trigger learning pipeline
    review/[sessionId]/ # Live review session page
    settings/           # Rules, guidance, and file filter management
    history/            # Past review sessions
  lib/
    ai/                 # Orchestrator, Claude provider, prompt builder, SSE
    db/                 # SQLite schema, connection, CRUD modules
    git/                # Git diff operations
    learning/           # Feedback → rules pipeline
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
