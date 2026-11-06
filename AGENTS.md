# AGENTS.md — AI Agent Guidance for Five9-Agent-Sup-REST-API-Starter-Kit

## Project overview

This repository is a starter kit for the **Five9 Agent/Supervisor REST API**. It shows Five9
Developer Program members (partner and customer developers building custom agent- or
supervisor-desktop UIs) how to call the Agent/Supervisor REST endpoints and consume the
real-time WebSocket event stream from plain HTML/JavaScript — no build tooling, framework, or
backend required. The centerpiece is a single self-contained HTML file
(`agent_VCC_boilerplate.html`) that authenticates against an active Five9 browser session,
opens the agent WebSocket, and exposes buttons/links for the most commonly implemented API
actions (get current calls, transfer, set CAVs, disposition, etc.). `usecase_samples/` holds
further worked, copy-pasteable examples of narrower real-world scenarios.

## Disclaimer (read this before doing anything else)

Per `README.md`: this repository contains **sample code that is not an official, supported
Five9 resource**. It is MIT-licensed and provided solely for educational/illustrative purposes.

- Nothing here is endorsed or supported by Five9.
- Any customization, modification, or deployment is done at the user's own risk.
- Five9 assumes no liability and provides no support for issues arising from this code.
- For a production-ready, tailored implementation, users should engage **Five9 Professional
  Services and/or their Technical Account Manager (TAM)**, not deploy this sample kit as-is.

AI agents working in this repo should carry this disclaimer forward: if a user's request implies
shipping this to production agents/supervisors, say so explicitly and point them at Professional
Services/TAM (see "Safety guardrails" below).

## Environment & setup quickstart

There is no build step, package manager, or dependency install — this is static HTML/JS plus one
small Python helper script. Verified steps (from `README.md` and the code itself):

1. **Serve the files locally** (recommended so the browser treats them as `http://` rather than
   `file://`, and so nothing is cached while iterating):
   ```
   python no_cache_server.py [port]
   ```
   Defaults to port 8000 if no argument is given (`no_cache_server.py` prints
   `Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/)...`). It's a subclass of
   `http.server.SimpleHTTPRequestHandler` that adds `Cache-Control: no-store, no-cache,
   must-revalidate`, `Pragma: no-cache`, and `Expires: 0` headers to every response.
2. **Log into a Five9 domain in one browser tab** (e.g. `https://app.five9.com`, or a
   trial/sandbox domain) using a real agent or supervisor account — this is what establishes the
   session cookie the boilerplate depends on.
3. **Open `agent_VCC_boilerplate.html` in another tab of the same browser** (e.g.
   `http://localhost:8000/agent_VCC_boilerplate.html`). On load it calls
   `Five9Session.getSessionMetadata()`, which does
   `fetch("https://app.five9.com/appsvcs/rs/svc/auth/metadata", { credentials: "include" })`.
   There is no login form and no place to type a password in this file — auth is entirely
   piggybacked on the existing browser session cookie for `app.five9.com`. If that fetch fails,
   the console logs "You must be logged into Five9 in another browser tab for this to work" and
   the UI shows a "Failed to connect" status.
4. Once metadata is fetched, the code extracts the per-datacenter API host/port from
   `metadataResponse.metadata.dataCenters[0].apiUrls[0]`, builds `base_api_url` /
   `base_websocket_api_url_agent`, and opens the WebSocket
   (`connectAgentWebsocket()` → `connectSocket()`), sending a `"ping"` frame every 15 seconds to
   keep it alive.
5. Files under `usecase_samples/` follow the same pattern independently — each is a standalone
   HTML file you can open the same way (via the local server + an already-authenticated Five9
   tab).

There are no other environment variables, config files, or secrets to set up. Do not invent an
`npm install`, `.env`, or API-key-based auth flow — none exists in this codebase.

## Architecture map

- **`agent_VCC_boilerplate.html`** — the main reference implementation. Single file containing:
  - Head: loads Tailwind CSS, Alpine.js, and SweetAlert2 from CDNs (no local/bundled JS
    dependencies).
  - `class f9socketEvent` — wraps a named event with a handler function and `this` context.
  - `class Five9Session` — the core client: `freedomMetadataURL`, `contextPaths` (agent/sup REST
    and websocket paths), `getSessionMetadata()`, `connectSocket()` /
    `connectAgentWebsocket()`, `reinitializeWebSocket()` (used on domain migration, see below),
    and one method per REST call (e.g. `getCampaignInfo`, `getCurrentCalls`,
    `getContactFields`).
  - `f9socketEventHandlers` — a plain object keyed by numeric WebSocket `eventId` (e.g. `4` =
    `EVENT_CALL_UPDATED`, `5` = `EVENT_CALL_DELETED`), each value a `new f9socketEvent(name,
    handlerFn, context)`.
  - `function f9Interface()` — the Alpine.js component backing the buttons/cards in the body
    (session info display, WebSocket event log, API method buttons grouped by category such as
    "Call Management").
  - An `onDocumentReady(...)` bootstrap at the bottom that creates the `Five9Session`, calls
    `getSessionMetadata()`, and on success connects the WebSocket and updates the UI.
- **`no_cache_server.py`** — trivial local dev HTTP server (see quickstart above). Not meant for
  production hosting; just avoids stale cached copies of the HTML while you iterate.
- **`Websockets_and_MGR_events.md`** — documents the Five9 "MGR" (data-center
  migration/maintenance) event sequence on the WebSocket: `eventId: 70` (`STARTED`) → `eventId:
  1002` (`Domain Migrated, please use MetadataAPI to reload client`, payload contains new
  `dataCenters` metadata) → `eventId: 73` (`COMPLETED`, after which the *original* socket is
  dead except for `PING`). This is exactly what `Five9Session.commonSocketEventHanders[1002]`
  and `[73]` implement — read this doc before touching migration/reconnect logic.
- **`usecase_samples/`** — ~20 standalone HTML files, each a focused, runnable example built on
  the same `Five9Session`/WebSocket pattern (some samples use an older jQuery-based variant with
  `$.get(freedomMetadataURL, ...)` instead of `fetch`). Representative examples:
  - `Call Warm Transfer Example.html`, `Call Conference Transfer Example.html`,
    `Call Conference Transfer Example - Dynamic SpeedDials.html`, `cold_conference_transfer_sample.html`
  - `setCAVs and Transfer.html`, `setCAVs on load with websockets.html`,
    `setCAVs from Form Input.html`, `setCAVs from Form Input - Enhanced Picker.html`,
    `setCAVs from Form Input and initiate Conference.html` — setting Call Attached Variables
  - `Set Salesforce ID on Call Arrival - SweetAlert.html` — CRM-style screen-pop pattern
  - `Queue Alert - OS Notifications.html` — uses the browser `Notification` API
    (`showQueueNotification()`) driven by queue-metric WebSocket events
  - `Disposition Call with specific Disposition Name.html`, `Stop Recording On Connect.html`,
    `Force Agent Options.html`, `Initiate Conference on Connect.html`
  - `playPrompt on load with websockets.html`, `playPrompt and setCav on load with websockets.html`
  - `clickToCall button - vanillaJs.html`, `web2campaign_sample_form.html`, `adt_iframe.html`,
    `Agent Skill Dashboard.html`, `custom toast.html`
  - When asked to "add a new usecase sample," copy the closest existing file rather than
    starting from the boilerplate — they're already trimmed to one scenario.
- **`scratch/`** — a gitignored scratch/WIP area (`.gitignore` excludes `scratch/`); do not treat
  files there as canonical examples.
- **`.github/`** — currently empty; this doc plus `CLAUDE.md` are the first files placed here.

## Common tasks

**1. Add a new WebSocket event handler (e.g. react to a new `eventId`).**
Find the `f9socketEventHandlers = { ... }` object near the bottom of the relevant HTML file
(boilerplate: search for `4: new f9socketEvent("EVENT_CALL_UPDATED", ...)`). Add a new numeric
key with `new f9socketEvent("YOUR_EVENT_NAME", function (eventData) { ... }, this)`. The handler
receives the full parsed message (`eventData.context` + `eventData.payLoad`). To find unhandled
event IDs during development, open the page with `?verbose=true` in the URL — `connectSocket()`
logs every `eventId`/`eventReason` pair to the console when that query param is present, and
auto-registers an "Unhandled Socket Event" logger for IDs with no handler.

**2. Wire up a new usecase sample.**
Copy the standalone HTML file closest to the desired scenario from `usecase_samples/` (e.g. copy
`setCAVs from Form Input.html` to add a new CAV-driven screen-pop). Keep the same
`Five9Session`/metadata-fetch/WebSocket bootstrap at the top and bottom of the file — only the
UI and the specific REST calls / event handlers in the middle should change. Test it the same way
as the boilerplate: serve with `no_cache_server.py`, open alongside an authenticated Five9 tab.

**3. Debug a WebSocket connection that won't connect or drops.**
- If `getSessionMetadata()` fails, the user is not logged into the target Five9 domain in the
  same browser — that's not a code bug.
- If the socket connects then goes silent, check for an `eventId: 70` → `1002` → `73` sequence in
  the console (MGR/data-center migration) — see `Websockets_and_MGR_events.md`. After `73`
  ("COMPLETED"), the *original* socket only answers `PING`; the client must reconnect using the
  metadata captured from the `1002` payload (`session.newMetadata`), which
  `reinitializeWebSocket()` already does automatically for the boilerplate's default handlers.
- Confirm the ping loop (`f9Socket.send("ping")` every 15s in `connectSocket()`) is running; a
  missing/cleared `pingIntervalHandle` can let idle connections time out.

**4. Add a new REST call / button to the boilerplate.**
Add a method to `class Five9Session` (mirror the JSDoc-style comment block above existing methods
like `getCampaignInfo`/`getCurrentCalls`, which document the HTTP method, path, and a sample JSON
response), then call it from a new method on `f9Interface()` and a new button in the matching
category card in the body (e.g. under "Call Management"). Use `this.defaultXhrOptions`
(`credentials: "include"`, JSON content type) for the fetch call so the session cookie is sent.

## Conventions actually used in this code

- Every file is self-contained: no npm/build step, no bundler, no shared JS module — CDN
  `<script>` tags (Tailwind, Alpine.js, SweetAlert2) plus inline `<script>` blocks.
- Auth is always cookie-based via `credentials: "include"` against
  `https://app.five9.com/appsvcs/rs/svc/auth/metadata` — never a hardcoded username/password or
  API key in these files.
- WebSocket event handlers are registered in a flat object keyed by numeric `eventId`, wrapped in
  `new f9socketEvent(name, handlerFn, context)`.
- REST methods on `Five9Session` are documented with a JSDoc comment giving the HTTP verb+path and
  a sample JSON response — follow that documentation style when adding methods.
- `?verbose=true` in the page URL is the built-in debug switch for WebSocket traffic.
- Newer samples use `fetch`; a few older ones use jQuery's `$.get`. Match whichever style the file
  you're editing already uses rather than mixing both.
- `scratch/` and `client_scripts/`/`dni/`/`private/`/`settings/` are gitignored — don't rely on
  anything under those paths being committed or shared.

## Safety guardrails for AI agents

- **Never commit, log, or print credentials/secrets**, and never ask the user to paste a Five9
  username/password (or any credential) into chat. This kit intentionally has no login form —
  keep it that way; auth rides on the user's own already-authenticated browser session.
- **Treat any connected Five9 domain as potentially production.** Get explicit user confirmation
  before taking any action that affects live agent or call state (transfers, dispositions,
  forcing agent state/skills, playing prompts, setting CAVs on a live call, etc.), even when just
  demonstrating a usecase sample.
- **Prefer testing against a sandbox/trial Five9 domain** over a live production domain whenever
  one is available or can be requested.
- **Flag production-deployment requests.** If a user's request implies deploying this kit (or a
  derivative of it) as a real agent/supervisor tool in production, say so explicitly and recommend
  they engage **Five9 Professional Services and/or their TAM** instead of shipping unmodified
  sample code — per the repository's own disclaimer in `README.md`.

## Where to get help

- Official Five9 API reference: the VCC Agent + Supervisor REST API Reference Guide linked from
  `README.md`
  (`https://webapps.five9.com/assets/files/for_customers/documentation/apis/vcc-agent+supervisor-rest-api-reference-guide.pdf`).
- For anything beyond sample/educational use: **Five9 Professional Services** and/or your
  **Five9 Technical Account Manager (TAM)** — this repo explicitly disclaims production support.
- This repo is unsupported/community sample code (MIT License, `LICENSE` file); there is no
  official Five9 support channel for it.
