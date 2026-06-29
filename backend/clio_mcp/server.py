"""Clio MCP server — gives the wren/openclaw agent read access to Clio's
end-to-end tracing, support queue, and health, plus one controlled write to
advance a support request's lifecycle.

Run (matches the gateway's chad-agent pattern):

    DJANGO_SETTINGS_MODULE=config.settings \\
    python -m clio_mcp.server --transport streamable-http --port 8123

The server initialises Django so the tools query the ORM directly. The gateway
mediates access (only wren reaches this server); there is no auth here and no
tool mutates user notes or production data — code changes are agent PRs.
"""

from __future__ import annotations

import argparse
import json
import os

import django

# Initialise Django before importing anything that touches the ORM.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from mcp.server.fastmcp import FastMCP  # noqa: E402

from clio_mcp import queries  # noqa: E402


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clio MCP server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("CLIO_MCP_PORT", "8123")))
    parser.add_argument(
        "--transport",
        default=os.environ.get("CLIO_MCP_TRANSPORT", "stdio"),
        choices=["stdio", "sse", "streamable-http"],
    )
    return parser.parse_args()


def create_server(port: int = 8123) -> FastMCP:
    mcp = FastMCP("clio", host="0.0.0.0", port=port)

    @mcp.tool()
    def app_health() -> str:
        """Clio health: transcription provider in use and note lifecycle counts."""
        return json.dumps(queries.app_health(), indent=2)

    @mcp.tool()
    def list_pending_support_requests(limit: int = 20) -> str:
        """User support requests that passed the gate and await an issue / work."""
        return json.dumps(queries.list_pending_support_requests(limit), indent=2)

    @mcp.tool()
    def get_support_request(request_id: int) -> str:
        """Full detail for one support request, including its trace if any."""
        result = queries.get_support_request(request_id)
        return json.dumps(result, indent=2) if result else json.dumps({"error": "not found"})

    @mcp.tool()
    def get_trace(trace_id: str) -> str:
        """End-to-end observability for one trace id: the note lifecycle + status/errors."""
        return json.dumps(queries.get_trace(trace_id), indent=2)

    @mcp.tool()
    def recent_transcription_failures(limit: int = 20) -> str:
        """Recently failed transcriptions — for proactively finding issues to fix."""
        return json.dumps(queries.recent_transcription_failures(limit), indent=2)

    @mcp.tool()
    def update_support_request_status(
        request_id: int,
        status: str,
        github_issue_number: int | None = None,
        github_issue_url: str | None = None,
    ) -> str:
        """Advance a support request's lifecycle status (e.g. issue_created,
        in_progress, shipped) and optionally link its GitHub issue. The only
        write tool; it touches the support row only, never user data."""
        try:
            return json.dumps(
                queries.update_support_request_status(
                    request_id, status, github_issue_number, github_issue_url
                ),
                indent=2,
            )
        except ValueError as exc:
            return json.dumps({"error": str(exc)})

    return mcp


def main() -> None:
    args = _parse_args()
    mcp = create_server(port=args.port)
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
