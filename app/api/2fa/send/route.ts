import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateOtp, getOtpExpiry, signPayload } from "@/lib/twoFactor";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";

const COOKIE_NAME = "sm2fa";
const COOKIE_DOMAIN = process.env.TWO_FA_COOKIE_DOMAIN || undefined;

type SendBody = {
    method: "email" | "sms";
    destination: string;
};

/* ── Resend (primary) ─────────────────────────────────────── */

function getResend(): Resend | null {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

const SENDER_ADDRESS =
    process.env.RESEND_FROM || "SkyMaintain <noreply@skymaintain.ai>";

function buildOtpEmail(code: string) {
    const text = [
        `Your SkyMaintain verification code is: ${code}`,
        "",
        "This code expires in 5 minutes. If you did not request this code, you can safely ignore this email.",
        "",
        "— The SkyMaintain Team",
        "https://www.skymaintain.ai",
    ].join("\n");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#0f172a;padding:24px 32px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">SkyMaintain</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0f172a;">Verification code</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.5;">
            Enter this code to complete your sign-in. It expires in <strong>5 minutes</strong>.
          </p>
          <div style="text-align:center;padding:20px 0;">
            <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:0.35em;color:#0f172a;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:14px 28px;">${code}</span>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
            If you did not request this code, you can safely ignore this email. Never share this code with anyone.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            &copy; ${new Date().getFullYear()} SkyMaintain &middot;
            <a href="https://www.skymaintain.ai" style="color:#64748b;text-decoration:none;">skymaintain.ai</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    return { text, html };
}

async function sendViaResend(code: string, destination: string) {
    const resend = getResend();
    if (!resend) return null;

    const { text, html } = buildOtpEmail(code);

    const { data, error } = await resend.emails.send({
        from: SENDER_ADDRESS,
        to: [destination],
        subject: "Your SkyMaintain verification code",
        text,
        html,
        headers: {
            "X-Entity-Ref-ID": `sm-2fa-${Date.now()}`,
        },
    });

    if (error) throw new Error(error.message || "Resend delivery failed");
    return { messageId: data?.id ?? undefined };
}

/* ── SMTP fallback ────────────────────────────────────────── */

function isSmtpConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

async function sendViaSmtp(code: string, destination: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !from) throw new Error("SMTP not configured.");

    const { createTransport } = await import("nodemailer");
    const transport = createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
    });

    const { text, html } = buildOtpEmail(code);

    await transport.sendMail({
        from: from.includes("<") ? from : `SkyMaintain <${from}>`,
        replyTo: process.env.SMTP_REPLY_TO || undefined,
        to: destination,
        subject: "Your SkyMaintain verification code",
        text,
        html,
    });
}

/* ── SMS ──────────────────────────────────────────────────── */

async function sendSms(code: string, destination: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;

    if (!sid || !token || !from) return;

    const body = new URLSearchParams({
        From: from,
        To: destination,
        Body: `Your SkyMaintain verification code is ${code}. It expires in 5 minutes.`,
    });

    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to send SMS.");
    }
}

/* ── POST handler ─────────────────────────────────────────── */

export async function POST(req: NextRequest) {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateCheck = checkRateLimit(`2fa:${ip}`, RATE_LIMITS.twoFa);

    if (!rateCheck.allowed) {
        return NextResponse.json(
            { ok: false, error: "Too many requests. Please try again later." },
            { status: 429, headers: getRateLimitHeaders(rateCheck, RATE_LIMITS.twoFa) }
        );
    }

    const body = (await req.json()) as SendBody;

    if (!body?.destination || !body?.method) {
        return NextResponse.json({ ok: false, error: "Missing destination or method." }, { status: 400 });
    }

    const code = generateOtp();
    const expires = getOtpExpiry();
    const token = signPayload({ method: body.method, destination: body.destination, code, expires });

    let provider = "resend";
    let sendError: string | null = null;
    // Track which delivery mechanism actually works. The client needs this
    // to decide which verify path to use (cookie-based vs Supabase OTP).
    let deliveryMethod: "api" | "supabase" | null = null;

    if (body.method === "email") {
        // 1. Try Resend (best deliverability) - FAIL-CLOSED
        // If Resend is configured but fails, return error immediately.
        // Do NOT fall back to other methods to prevent false success responses.
        const hasResendKey = !!process.env.RESEND_API_KEY;
        if (hasResendKey) {
            try {
                const result = await sendViaResend(code, body.destination);
                if (result) {
                    console.info("2FA email sent via Resend", { destination: body.destination, id: result.messageId });
                    deliveryMethod = "api";
                } else {
                    throw new Error("RESEND_API_KEY not configured");
                }
            } catch (resendErr) {
                sendError = resendErr instanceof Error ? resendErr.message : "Email delivery failed";
                console.error("Resend email failed:", sendError);
                // FAIL-CLOSED: Return error instead of falling back to Supabase
                // This ensures false "code sent" responses don't grant access
                return NextResponse.json(
                    { ok: false, error: "Unable to send verification code. Please try again or contact support." },
                    { status: 503 }
                );
            }
        } else {
            // If Resend isn't configured, try SMTP as primary
            provider = "smtp";
            if (isSmtpConfigured()) {
                try {
                    await sendViaSmtp(code, body.destination);
                    console.info("2FA email sent via SMTP", { destination: body.destination });
                    deliveryMethod = "api";
                } catch (smtpErr) {
                    sendError = smtpErr instanceof Error ? smtpErr.message : "SMTP delivery failed";
                    console.error("SMTP delivery failed:", sendError);
                    // FAIL-CLOSED: Return error instead of falling back
                    return NextResponse.json(
                        { ok: false, error: "Unable to send verification code. Please try again or contact support." },
                        { status: 503 }
                    );
                }
            } else {
                // Neither Resend nor SMTP configured
                sendError = "Email services not configured.";
                console.error(sendError);
                return NextResponse.json(
                    { ok: false, error: "Email service unavailable. Please contact support." },
                    { status: 503 }
                );
            }
        }
    } else {
        // SMS - FAIL-CLOSED
        provider = "sms";
        try {
            await sendSms(code, body.destination);
        } catch (smsErr) {
            sendError = smsErr instanceof Error ? smsErr.message : "SMS delivery failed";
            console.error("SMS delivery failed:", sendError);
            // FAIL-CLOSED: Return error on SMS failure
            return NextResponse.json(
                { ok: false, error: "Unable to send verification code. Please try again or contact support." },
                { status: 503 }
            );
        }
    }

    if (sendError) {
        return NextResponse.json(
            { ok: false, error: "Unable to send verification code. Please try again or contact support." },
            { status: 503 }
        );
    }

    const response = NextResponse.json({
        ok: true,
        sent: true,
        provider,
        // Tell the client which delivery mechanism worked, so it can
        // use the matching verify path (cookie-based vs Supabase OTP)
        deliveryMethod: deliveryMethod || "api",
    });

    // Only set the cookie when Resend/SMTP delivered the code (the cookie
    // stores our generated OTP for server-side verification). When Supabase
    // delivered the code, it manages its own OTP — the cookie is irrelevant
    // and would cause a "code mismatch" on verify if the user enters the
    // Supabase-generated code against our cookie-stored code.
    if (deliveryMethod === "api") {
        response.cookies.set({
            name: COOKIE_NAME,
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 300,
            domain: COOKIE_DOMAIN,
            path: "/",
        });
    }

    return response;
}
