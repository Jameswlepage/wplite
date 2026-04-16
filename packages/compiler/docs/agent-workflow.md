# Agent Workflow Contract

This doc is the deeper, task-oriented companion to [`../AGENTS.md`](../AGENTS.md).

## Operating Modes

- **Scaffold mode**: create a new site source tree from a brief.
- **Build/sync mode**: compile files and apply to local WordPress runtime.
- **Audit mode**: run static checks before commit/deploy.
- **Round-trip mode**: pull runtime edits back into files.

## Scaffold Mode

Command:

```bash
wp-lite init --brief brief.json --json
```

Expected outcome:

- Contract directories created (`app`, `content`, `theme`, optional `admin` / `blocks`).
- Site-local `AGENTS.md` created with workflow + guardrails.
- Minimal block-theme files generated.
- Seed singleton/content files generated.

## Build/Sync Mode

Command:

```bash
wp-lite apply --json
```

Expected outcome:

- Compiler emits `generated/` plugin + theme + schema artifacts.
- Local runtime starts/reuses existing instance.
- Site is seeded.

## Audit Mode

Command:

```bash
wp-lite verify --json
```

Current checks include:

- Required source files/dirs.
- Route and template consistency.
- `frontPage` / `postsPage` references.
- Legacy runtime markers (hard-fail).
- Content sync mismatch signals.
- Singleton literal duplication in theme files (warning).

## Round-Trip Mode

Command:

```bash
wp-lite pull --json
```

Expected outcome:

- Pulls supported collections/pages/singletons into source files.
- Preserves source IDs where possible.

## Deterministic Agent Loop

Use this exact loop for autonomous operation:

1. `init` (if site not scaffolded)
2. edit files
3. `apply`
4. `verify`
5. optional manual runtime edits
6. `pull`
7. commit
