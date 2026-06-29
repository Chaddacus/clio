# Clio MCP server

Gives the wren/openclaw agent access to Clio's end-to-end tracing, the support
queue, and health — so it can ground a user's reported issue against real
observability data and drive the self-heal loop. The gateway mediates access
(only wren reaches this server).

## Tools

Read-only:
- `app_health()` — transcription provider in use + note lifecycle counts.
- `list_pending_support_requests(limit=20)` — gate-passed requests awaiting work.
- `get_support_request(request_id)` — full detail incl. linked trace.
- `get_trace(trace_id)` — the note lifecycle for one end-to-end trace id.
- `recent_transcription_failures(limit=20)` — proactive issue discovery.

Controlled write (support lifecycle only — never user notes or other data):
- `update_support_request_status(request_id, status, github_issue_number?, github_issue_url?)`

## Run

```bash
cd backend
pip install -r requirements.txt -r requirements-mcp.txt
DJANGO_SETTINGS_MODULE=config.settings \
python -m clio_mcp.server --transport streamable-http --port 8123
```

The `mcp` dependency lives in `requirements-mcp.txt` (kept out of the core
backend image — it conflicts with the core pins and the web/celery backend
does not run this server). Needs DB access via the usual `DATABASE_URL`; runs
`django.setup()` and queries the ORM directly.

## Register with the gateway

The gateway catalog lives at `mcp-gateway/src/mcp_gateway/capabilities.json`
(runtime: `~/.codex/state/mcp-gateway/capabilities.docker.json`). Add the entry
in `gateway-entry.json` under `servers`, then restart the gateway so it
re-reads the catalog. Because the agent and gateway run co-located while the
Clio prod DB lives on Linode, decide the data source at registration time:
- **dev:** run the server in the clio-sec backend container (port 8123) against
  the dev DB.
- **prod:** run it inside the prod clio stack on Linode (co-located with the
  prod DB) and have wren reach it over the tailnet, like omni-mem.
