# Cold Campaign Conference Guide

This guide explains how to test and implement a Five9 Cold Campaign Conference. It adds an inbound campaign as a participant on an active call. It does not transfer the call to a DNIS or other external number.

The runnable example is [Cold Campaign Conference Example.html](Cold%20Campaign%20Conference%20Example.html).

The current [Cold Campaign Transfer Example.html](Cold%20Campaign%20Transfer%20Example.html) has the same implementation. Despite that filename, it creates a conference, not a transfer. Use the Conference example as the canonical reference.

The standalone example includes a campaign selector so a developer can test different campaign configurations. The application being implemented must not ask the agent to select a campaign. Its destination campaign ID must be configured by the application for each Five9 environment.

## Before You Start

The following must be true:

- The user is logged into Five9 as an agent. 
- The custom page is open in the same browser session as the logged-in Five9 agent so it can use the existing Five9 session cookie.
- The agent has an active voice call.
- The destination is a running inbound campaign configured with the IVR or audio flow that should handle the conference participant.
- The destination campaign is available to the agent.
- The agent has the `CAN_CREATE_CONFERENCE_WITH_CAMPAIGN` permission.

## Operator Test Procedure

1. Start the destination inbound campaign in Five9.
2. Sign in to the Five9 adapter as an agent who has access to that campaign.
3. Establish an active test call for the agent.
4. Serve this repository locally:

   ```shell
   python3 no_cache_server.py 8000
   ```

5. In another tab of the same browser, open:

   ```text
   http://localhost:8000/usecase_samples/Cold%20Campaign%20Conference%20Example.html
   ```

6. Wait for the page to show **Ready**.
7. Select the configured destination campaign. This selection is required only by the standalone test page; the implemented application will supply its configured campaign ID automatically.
8. Click **Start cold campaign conference**.
9. Read the confirmation carefully, then confirm the action.
10. Verify that the destination campaign's IVR or audio flow runs as configured.

The button affects the active call immediately after confirmation.

## Jira Implementation Details

### Goal

Allow a signed-in Five9 agent with an active call to add the application's configured inbound campaign as a conference participant in cold mode. The agent does not choose the destination campaign.

### Application Configuration

Define an environment-specific application setting such as:

```text
destinationCampaignId=1234567
```

The value must be the Five9 campaign ID, not a campaign name or DNIS. Campaign IDs may differ between development, test, and production domains, so configure the value separately in each environment. Do not hardcode one domain's campaign ID into shared application logic.

### API Sequence

#### 1. Get the Agent Session

```http
GET https://app.five9.com/appsvcs/rs/svc/auth/metadata
Credentials: include
```

Use the returned user ID as `{agentId}`. Use the first API host and port returned under `metadata.dataCenters[0].apiUrls[0]` to construct the Agent REST base URL:

```text
https://{host}:{port}/appsvcs/rs/svc
```

Do not add a username, password, API key, or login form. Authentication uses the agent's existing Five9 browser session.

#### 2. Validate the Configured Campaign Destination

```http
GET /agents/{agentId}/campaigns
```

This returns inbound campaigns that can receive a call. Use the response only to validate the application's configured campaign ID.

Confirm that the configured `destinationCampaignId` exists in this response before enabling the conference action. Do not display a campaign selector or accept an agent-entered DNIS, campaign name, or campaign ID. If the configured campaign is unavailable to the agent, stop and show an error without changing the active call.

#### 3. Get the Active Call

```http
GET /agents/{agentId}/interactions/calls
```

Select the active call and retain its `id` as `{callId}`. If no active call is returned, do not send the conference request.

#### 4. Start the Cold Campaign Conference

```http
POST /agents/{agentId}/interactions/calls/{callId}/add_campaign_to_conference
Content-Type: application/json
```

Request body:

```json
{
   "campaignId": "CONFIGURED_DESTINATION_CAMPAIGN_ID",
  "warm": false
}
```

The request body contains exactly the application's configured destination campaign ID and the conference mode. Setting `warm` to `false` adds the campaign participant immediately in cold mode. The campaign IVR determines who or what is connected to the conference.

Do not use either of these external-number operations:

```text
add_external_to_conference
transfer_to_external_number
```

### Expected Five9 Events

Five9 documents the following event sequence after adding a campaign participant:

1. `EVENT_CALL_CREATED` with state `CONFERENCE_PARTICIPANT_RINGING` in cold mode.
2. If the participant connects, `EVENT_CALL_UPDATED` with reason `CONFERENCE_PARTICIPANT_ADDED` and state `CONFERENCE_PARTICIPANT_TALKING`.
3. If the participant does not connect, `EVENT_CALL_DELETED` with reason `DISCONNECTED_BY_CALLER`.

A client may monitor these events through the agent WebSocket when the product needs progress or completion feedback. The basic HTML sample initiates the conference but does not display WebSocket events.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The page says it cannot connect | Confirm the user is logged into Five9 as an agent in another tab of the same browser. |
| The configured campaign is unavailable | Confirm `destinationCampaignId` contains the correct ID for this environment and that the *running* inbound campaign is available to the logged-in agent. |
| The API returns a permissions error | Confirm the agent has `CAN_CREATE_CONFERENCE_WITH_CAMPAIGN`. |
| The page reports no active call | Establish an active voice call before starting the conference. |
| The conference starts but the expected audio does not play | Check the destination campaign's IVR and audio configuration. The campaign controls that behavior. |
| The participant does not connect | Monitor the agent WebSocket for the documented conference events and inspect the browser developer console and API response. |

## Support and Production Use

This repository contains unsupported sample code for educational and illustrative use. It is not an official supported Five9 resource. Any production implementation should be reviewed with Five9 Professional Services and/or the customer's Technical Account Manager.
