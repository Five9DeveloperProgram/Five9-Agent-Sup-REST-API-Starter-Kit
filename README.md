# Overview

This is a work-in-progress collection of Five9 Agent and Supervisor REST API examples. Forked from [Andrew Willey](https://github.com/andrewawilley).

The main reference is [agent_VCC_boilerplate.html](agent_VCC_boilerplate.html). It includes a `Five9Session` client, endpoint wrappers, WebSocket events, and controls for common API actions. [usecase_samples](usecase_samples/) contains standalone examples for individual workflows.

## Local Setup

There is no build step or package installation. Each sample is self-contained HTML/JavaScript; some load UI libraries from CDNs.

1. Sign into Five9 and open the agent application in your browser. Live voice tests also require a connected agent station and the appropriate skills and permissions.
2. From this repository, run `python3 no_cache_server.py 8000`.
3. Open `http://localhost:8000/agent_VCC_boilerplate.html`, or a selected sample, in the **same browser profile/session**. A separate browser or private window will not automatically share the cookies.
4. Configure the selected sample's destinations, campaign names, dispositions, CAVs, and prompts for your test domain before using it. Embedded example numbers are not approved test destinations.

Authentication reuses Five9 session cookies with `credentials: "include"`. Do not copy cookies or tokens into source code, logs, or chat. Browser cookie/CORS policies can still prevent cross-origin access even after login.

The no-cache server binds to all network interfaces by default. Use it only on a trusted development machine/network; it is not a production server.

## Sample Behavior

Inspect a sample before opening it against an active session. Some act immediately, not only after a button click.

| Samples | Behavior and prerequisites |
| --- | --- |
| Agent Skill Dashboard; Queue Alert - OS Notifications | Read assigned skills and queue events. OS notifications require browser permission. |
| Warm transfer; conference transfer; disposition by name | Buttons affect an active call. Match the configured campaign, speed dial, number, and disposition to the test domain. Warm campaign transfer uses the inbound destination list, not outbound campaign configuration. The cold conference sample's DTMF links require access to the parent agent dial-pad DOM. |
| Cold Campaign Conference Example | Adds an inbound campaign participant with `warm: false`; it does not transfer call ownership. See the [guide](usecase_samples/Cold%20Campaign%20Conference%20Guide.md). |
| clickToCall button - vanillaJs | Uses `Five9Session` wrappers; clicking can dial an external number. `targetCampaign` selects the campaign; removing it enables campaign selection. |
| setCAVs form examples | Require matching writable CAVs and an active call. The plain Form Input example currently also adds `Transfer Campaign` after saving; its name does not imply CAV-only behavior. |
| setCAVs on load; playPrompt examples | Can update CAVs or play audio on load and/or call events. Check the configured CAVs and prompt names first. |
| Initiate Conference on Connect; Stop Recording On Connect | Can add an external participant or stop recording when loaded during a call. Check the actual startup logic and adapter placeholders, not just the filename. |
| Force Agent Options | Can change agent options on load. Record the original options before testing and restore them afterward. |
| Set Salesforce ID on Call Arrival | Requires the configured `Salesforce.id` CAV and a call event; submitting the dialog writes to the call. |
| adt_iframe; custom toast; web2campaign_sample_form | Different interfaces, not Agent REST session clients. Web2Campaign submits list/contact data and needs its own domain/list configuration. Do not embed authentication secrets in a public browser page. |

## Verification

Optional offline checks use Node.js built-ins only:

```shell
node --test tests/sample-regressions.cjs
```

These tests do not connect to Five9 or simulate a login. They check script syntax, jQuery/token-log removal, reconnect handler retention, socket replacement, request construction, and action failure guards using isolated fixtures.

Authenticated checks performed on a test domain on 2026-11-05 and 2026-11-06:

- Localhost cookie authentication, agent/skills/campaign/current-call reads, and WebSocket reception succeeded.
- The complete dashboard displayed a queued call and its wait time after the selector fix.
- All five migrated call-action pages handled the no-active-call case without unhandled errors.
- Salesforce metadata initialization and CAV retrieval succeeded; this domain lacks the configured `Salesforce.id` CAV, so its write flow remains unverified.
- Agent readiness changes succeeded with a selectable Not Ready reason code. The agent was returned to Not Ready. No call was offered during the observation window.
- After a call was connected manually, internal campaign conferencing succeeded. Events confirmed the participant ringing, joining, and leaving after the destination campaign's prompt. A separate attempt successfully removed the participant while preserving the original call.
- The warm-transfer handler successfully started an internal campaign transfer. Cancellation succeeded; the original call remained on hold until an explicit `unhold` request restored it to TALKING.
- The disposition page rejected a missing name without writing, then successfully ended the test call using the available `No Disposition` entry (ID `0`). No active calls remained afterward.
- Both new Cold Campaign pages loaded their destinations and handled the no-active-call case. Dynamic speed-dial labels were verified to render as text rather than injected HTML.

### Disposition Eligibility

Get the current call's `campaignId`, then request `GET /orgs/{orgId}/campaigns/{campaignId}/dispositions`. A matching name is not enough: inspect each entry's `channelTypes.CALL.filters` for the intended operation.

- Ending a call requires `VOICE_DISPOSE_CALL_OR_VOICEMAIL`.
- Leaving a conference requires `VOICE_END_CONFERENCE`.
- A transfer-only disposition can be rejected for these operations even when it appears in the response. In the test domain, `Transferred To 3rd Party` (`-23`) was rejected with HTTP 435; `No Disposition` (`0`) permitted ending the call. Do not infer eligibility from the sign of the ID or the disposition's general `type`.
- Respect `MUST_CONFIRM` when present. The disposition-by-name button now asks for confirmation when required.

External dialing was excluded by the test operator. Successful warm-transfer completion and leaving a conference still require end-to-end checks; the attempted conference completion used an ineligible disposition before operation filtering was added. Direct prompt playback, CAV writes, recording changes, and forced options also remain unverified. Offline tests are not evidence that these live workflows have passed.

Known follow-up areas in older samples include CAV form error recovery, automatic-action configuration, and empty-response handling in older request wrappers. The reference Form Input example should not be treated as a fully validated template simply because it already uses a session class.

## Using the Five9 Agent/Supervisor REST API 

Consult the current Agent/Supervisor REST reference in the [Five9 Documentation Center](https://documentation.five9.com/category/apis-rest); older direct PDF links may redirect to its landing page. Using the VCC REST API endpoints follows this pattern:

* Obtain session metadata from [https://app.five9.com/appsvcs/rs/svc/auth/metadata](https://app.five9.com/appsvcs/rs/svc/auth/metadata)
* Build the base api url (API domain:port)
* Determine the appropriate context path for the endpoint
* Invoke the method with the fully formed path

# DISCLAIMER

This repository contains sample code which is **not an official Five9 resource**. It is intended solely for educational and illustrative purposes to demonstrate possible ways to interact with Five9 APIs.

Under the MIT License:

- This is **not** officially endorsed or supported software by Five9.
- Any customizations, modifications, or deployments made with this code are done at your **own risk** and **sole responsibility**.
- The code may not account for all use cases or meet specific requirements without further development.
- Five9 assumes **no liability** and provides **no support** for issues arising from the use of this code.

For production-ready tailored implementations, we strongly recommend working with Five9’s Professional Services and Technical Account Management teams.

