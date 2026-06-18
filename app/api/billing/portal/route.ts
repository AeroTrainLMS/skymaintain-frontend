import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireSession } from "@/lib/apiAuth";

export const runtime = "nodejs";

type PortalBody = {
    customerId: string;
    returnUrl?: string;
};

export async function POST(req: NextRequest) {
    // ── Auth enforcement ──
    const session = requireSession(req);
    if (session instanceof NextResponse) return session;

    const stripe = getStripe();

    if (!stripe) {
        return NextResponse.json(
            { ok: false, error: "Stripe is not configured" },
            { status: 503 }
        );
    }

    try {
        const body = (await req.json()) as PortalBody;

        if (!body.customerId) {
            return NextResponse.json(
                { ok: false, error: "Missing customer ID" },
                { status: 400 }
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://skymaintain.ai";

        const session = await stripe.billingPortal.sessions.create({
            customer: body.customerId,
            return_url: body.returnUrl || `${baseUrl}/app/subscription-billing`,
        });

        return NextResponse.json({
            ok: true,
            url: session.url,
        });
    } catch (error) {
        console.error("Stripe portal error:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Portal creation failed" },
            { status: 500 }
        );
    }
}
