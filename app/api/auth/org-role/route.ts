import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSession } from "@/lib/apiAuth";

export const runtime = "nodejs";

/**
 * POST /api/auth/org-role
 *
 * Determines the role for a user based on whether they are the first
 * member of their organization. The first user from an org automatically
 * gets the "admin" role so they can manage aircraft, users, etc.
 *
 * Body: { userId: string, orgName: string, email: string }
 * Returns: { role: string, isFirstOrgUser: boolean }
 */
export async function POST(request: NextRequest) {
    // ── Auth enforcement ──
    const session = requireSession(request);
    if (session instanceof NextResponse) return session;

    try {
        const body = await request.json();
        const userId = (body.userId || "").trim();
        const orgName = (body.orgName || "").trim();
        const email = (body.email || "").trim();

        if (!orgName || !email) {
            return NextResponse.json(
                { role: "fleet_manager", isFirstOrgUser: false },
                { status: 200 }
            );
        }

        // If Supabase server client isn't available, fall back gracefully
        if (!supabaseServer) {
            return NextResponse.json(
                { role: "fleet_manager", isFirstOrgUser: false },
                { status: 200 }
            );
        }

        // Count how many other users exist in this org (excluding the current user)
        let query = supabaseServer
            .from("user_profiles")
            .select("user_id", { count: "exact", head: true })
            .ilike("org_name", orgName);

        if (userId) {
            query = query.neq("user_id", userId);
        } else {
            // If we don't have the userId, exclude by email
            query = query.neq("email", email);
        }

        const { count, error } = await query;

        if (error) {
            console.error("Error checking org membership:", error);
            return NextResponse.json(
                { role: "fleet_manager", isFirstOrgUser: false },
                { status: 200 }
            );
        }

        const isFirstOrgUser = (count ?? 0) === 0;
        const role = isFirstOrgUser ? "admin" : "fleet_manager";

        // If this is the first user, update their profile to admin
        if (isFirstOrgUser && userId) {
            const { error: updateError } = await supabaseServer
                .from("user_profiles")
                .update({ role: "admin" })
                .eq("user_id", userId);

            if (updateError) {
                console.error("Error updating user role to admin:", updateError);
            }
        }

        return NextResponse.json({ role, isFirstOrgUser });
    } catch (err) {
        console.error("Unhandled error in POST /api/auth/org-role:", err);
        return NextResponse.json(
            { role: "fleet_manager", isFirstOrgUser: false },
            { status: 200 }
        );
    }
}
