import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSession } from "@/lib/apiAuth";

type UploadedDoc = {
    filename: string;
    date: string;
    size: string;
    category: string;
};

type Discrepancy = {
    title: string;
    date: string;
    summary: string;
    status: "Resolved" | "In Progress";
};

type DocumentationPayload = {
    uploadedDocs: UploadedDoc[];
    discrepancies: Discrepancy[];
};

export async function GET(request: NextRequest) {
    // ── Auth enforcement ──
    const session = requireSession(request);
    if (session instanceof NextResponse) return session;

    try {
        const reg = request.nextUrl.searchParams.get("reg") || "";

        const uploadedDocs: UploadedDoc[] = [];
        const discrepancies: Discrepancy[] = [];

        if (supabaseServer && reg) {
            // Fetch uploaded documents from Supabase storage listing
            try {
                const { data: files } = await supabaseServer.storage
                    .from("documents")
                    .list(reg, { limit: 50, sortBy: { column: "created_at", order: "desc" } });

                if (files) {
                    for (const f of files) {
                        uploadedDocs.push({
                            filename: f.name,
                            date: f.created_at
                                ? new Date(f.created_at).toLocaleDateString()
                                : "--",
                            size: f.metadata?.size
                                ? formatFileSize(Number(f.metadata.size))
                                : "--",
                            category: "Maintenance Records",
                        });
                    }
                }
            } catch {
                // Storage bucket may not exist yet — return empty
            }

            // Fetch discrepancies from discrepancy_reports table
            try {
                const { data: rows } = await supabaseServer
                    .from("discrepancy_reports")
                    .select("title, created_at, summary, status")
                    .eq("aircraft_registration", reg)
                    .order("created_at", { ascending: false })
                    .limit(20);

                if (rows) {
                    for (const r of rows) {
                        discrepancies.push({
                            title: r.title ?? "Untitled",
                            date: r.created_at
                                ? new Date(r.created_at).toLocaleDateString()
                                : "--",
                            summary: r.summary ?? "",
                            status: r.status === "resolved" ? "Resolved" : "In Progress",
                        });
                    }
                }
            } catch {
                // Table may not exist yet — return empty
            }
        }

        const payload: DocumentationPayload = { uploadedDocs, discrepancies };

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
            },
        });
    } catch (error) {
        console.error("Error fetching documentation data:", error);
        return NextResponse.json(
            { error: "Failed to fetch documentation data" },
            { status: 500 }
        );
    }
}

function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}
