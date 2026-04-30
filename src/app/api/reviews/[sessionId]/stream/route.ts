import { NextRequest } from "next/server";
import { subscribeSSE } from "@/lib/ai/sse";
import { getSession } from "@/lib/db/sessions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const id = parseInt(sessionId);

  if (isNaN(id)) {
    return new Response("Invalid session ID", { status: 400 });
  }

  const session = getSession(id);
  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  if (session.status === "completed" || session.status === "failed") {
    const encoder = new TextEncoder();
    const body = encoder.encode(
      `event: ${session.status === "completed" ? "complete" : "error"}\ndata: ${JSON.stringify({ status: session.status })}\n\n`
    );
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const unsubscribe = subscribeSSE(id, (event, data) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );

          if (event === "complete" || event === "error") {
            setTimeout(() => {
              unsubscribe();
              controller.close();
            }, 100);
          }
        } catch {
          unsubscribe();
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
