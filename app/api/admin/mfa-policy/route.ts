import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { normalizeRole } from "@/lib/auth/roles";

const BACKEND_BASE = process.env.SKYMAINTAIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function backendUrl(path: string): string {
    return `${BACKEND_BASE.replace(/\/+$/, "")}${path}`;
}

function forwardHeaders(req: NextRequest): HeadersInit {
    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
    };
    const cookie = req.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    const requestId = req.headers.get("x-request-id");
    if (requestId) headers["x-request-id"] = requestId;
    return headers;
}

/**
 * GET /api/admin/mfa-policy — Read the org's MFA enforcement status + 2FA adoption stats
 */
export async function GET(req: NextRequest) {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    try {
        // Fetch MFA policy from backend
        const policyRes = await fetch(backendUrl("/v1/team/org/mfa-policy"), {
            method: "GET",
            headers: forwardHeaders(req),
        });

        let mfa_enforced = false;
        if (policyRes.ok) {
            const policyData = await policyRes.json();
            mfa_enforced = policyData.mfa_enforced ?? false;
        }

        // Fetch team stats for 2FA adoption
        const statsRes = await fetch(backendUrl("/v1/team/stats/summary"), {
            method: "GET",
            headers: forwardHeaders(req),
        });

        let two_factor_adoption = 0;
        let two_factor_percent = 0;
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            two_factor_adoption = statsData.two_factor_adoption ?? 0;
            two_factor_percent = statsData.two_factor_percent ?? 0;
        }

        return NextResponse.json({
            mfa_enforced,
            two_factor_adoption,
            two_factor_percent,
        });
    } catch (error) {
        console.error("MFA policy fetch failed:", error);
        return NextResponse.json(
            { mfa_enforced: false, two_factor_adoption: 0, two_factor_percent: 0 },
        );
    }
}

/**
 * PATCH /api/admin/mfa-policy — Toggle MFA enforcement (org_admin or super_admin only)
 */
export async function PATCH(req: NextRequest) {
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const role = normalizeRole(session.role);
    if (role !== "super_admin" && role !== "admin" && role !== "org_admin") {
        return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
    }

    try {
        const body = await req.json();

        const res = await fetch(backendUrl("/v1/team/org/mfa-policy"), {
            method: "PATCH",
            headers: forwardHeaders(req),
            body: JSON.stringify({ mfa_enforced: !!body.mfa_enforced }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: data.detail || "Failed to update MFA policy" },
                { status: res.status },
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("MFA policy update failed:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
