# CLAUDE.md

Full AI-agent guidance for this repository lives in `AGENTS.md` — read it first.

@AGENTS.md

## Claude-specific notes

- To preview `agent_VCC_boilerplate.html` or any file in `usecase_samples/`, run
  `python no_cache_server.py [port]` from the repo root and open the file over `http://`
  (e.g. `http://localhost:8000/agent_VCC_boilerplate.html`) rather than via `file://` — the
  server exists specifically to avoid stale cached copies while iterating.
- These pages only work if the user is already logged into a real Five9 domain in another tab of
  the same browser; Claude cannot authenticate on the user's behalf and should not attempt to
  simulate, mock, or bypass that login.
- Always ask for explicit confirmation before running or suggesting the user run anything against
  a live/connected Five9 domain that could affect real agents or calls (transfers, dispositions,
  forced agent state, CAV changes, prompt playback, etc.) — see the Safety guardrails section in
  `AGENTS.md`.
- When editing or adding a `usecase_samples/*.html` file, keep changes scoped to that single
  self-contained file — there's no shared build or module system to update.
