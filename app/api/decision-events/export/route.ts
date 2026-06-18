import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";

type Store = { events: Array<Record<string, unknown>> };
const globalForDecisionEvents = globalThis as unknown as { __decisionEventStore?: Store };
const decisionEventStore = globalForDecisionEvents.__decisionEventStore ?? { events: [] };

globalForDecisionEvents.__decisionEventStore = decisionEventStore;

function toCsv(events: Array<Record<string, unknown>>) {
    if (events.length === 0) return "";
    const headers = Object.keys(events[0]);
    const rows = events.map((event) => headers.map((h) => JSON.stringify(event[h] ?? "")).join(","));
    return [headers.join(","), ...rows].join("\n");
}

export async function GET(req: NextRequest) {
    // ── Auth enforcement ──
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "json").toLowerCase();
    const events = decisionEventStore.events;

    if (format === "csv") {
        const csv = toCsv(events);
        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": "attachment; filename=decision-events.csv",
            },
        });
    }

    if (format === "pdf") {
        const payload = [
            "SkyMaintain Decision Events Export",
            `Exported: ${new Date().toISOString()}`,
            `Count: ${events.length}`,
            "",
            JSON.stringify(events, null, 2),
        ].join("\n");

        return new NextResponse(payload, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=decision-events.pdf",
            },
        });
    }

    return NextResponse.json({ events });
}
