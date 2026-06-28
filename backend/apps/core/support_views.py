import logging

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import support_gate
from .models import SupportRequest
from .serializers import SupportRequestSerializer

logger = logging.getLogger(__name__)


def _dispatch_to_codex(support_request: SupportRequest) -> None:
    """Hand a sufficient request off to the self-heal pipeline.

    Creates the `codex`-labelled GitHub issue (carrying the trace id) and lets
    the agent take it from there. Routing is wired in Phase 3/4 (via the MCP
    gateway); until then this is a no-op seam so the submission flow ships and
    is testable on its own.
    """
    from .tasks import create_support_issue_task
    create_support_issue_task.delay(support_request.id)


class SupportRequestCreateView(generics.ListCreateAPIView):
    """Submit a change request / bug report, or list your own.

    On create, a deterministic sufficiency gate runs first. Insufficient
    submissions are saved as `needs_detail` and returned with a concrete
    reason (HTTP 200, not an error) so the user can revise without losing
    their text. Sufficient ones are dispatched to the codex pipeline.
    """

    serializer_class = SupportRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SupportRequest.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        body = serializer.validated_data['body']
        sufficient, reason = support_gate.evaluate(body)

        support_request = serializer.save(
            user=request.user,
            status='submitted' if sufficient else 'needs_detail',
            gate_reason='' if sufficient else reason,
        )

        if sufficient:
            logger.info(
                "Support request %d passed the gate, dispatching to codex (trace_id=%s)",
                support_request.id, support_request.trace_id,
            )
            _dispatch_to_codex(support_request)
        else:
            logger.info("Support request %d bounced by gate: %s", support_request.id, reason)

        out = self.get_serializer(support_request).data
        return Response(out, status=status.HTTP_201_CREATED)
