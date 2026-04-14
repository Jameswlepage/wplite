# AGENTS

This document defines the agent-facing contract for `@wplite/compiler`.

## Goal

Enable deterministic, file-first WordPress site development where agents can:

1. author site state in files,
2. compile/sync into WordPress runtime,
3. pull editable state back into files,
4. keep all changes reviewable in git.

## Canonical CLI Loop

Use these commands in sequence:

1. `wp-light init --brief <brief.json> --json` (once per new site)
2. `wp-light apply --json` (compile + sync + seed)
3. `wp-light verify --json` (fail on contract errors)
4. `wp-light pull --json` (when runtime edits should become files)

## Command Contract

- `init`: scaffold site source contract and `AGENTS.md` for the site.
- `build`: compile source into `generated/`.
- `apply`: compile + run runtime + seed content.
- `seed`: reseed runtime content without full authoring changes.
- `dev`: watch source and continuously rebuild/reseed.
- `pull`: export eligible runtime state back into source files.
- `verify`: static contract checks for agent safety and consistency.
- `eject`: mark a site as leaving the light layer.

When `--json` is passed, commands emit a structured JSON object to stdout:

```json
{
  "ok": true,
  "command": "verify",
  "summary": "Verify passed with 0 warning(s).",
  "data": {}
}
```

Errors use the same shape with `"ok": false` and an `"error"` field.

## Source-Of-Truth Rules

- Treat `app/`, `content/`, `theme/`, `blocks/`, `admin/` as authored inputs.
- Treat `generated/` as compiler output.
- Keep frontend as native block theme files under `theme/`.
- Keep editable content modeled once in `app/` + `content/`.
- Avoid hardcoding in theme files values already modeled in content/singletons.

## Agent Guardrails

- Prefer deterministic edits over manual wp-admin changes.
- Run `verify` before finalizing.
- If runtime edits are made, run `pull` before commit.
- Do not depend on legacy `portfolio_*` naming in new site source.
