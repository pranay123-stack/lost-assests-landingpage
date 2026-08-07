export const runtime = "edge";

const defaultRecipient = "PankjaSewal@Abandonedfunds.org";

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
      character
    ] || character,
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const inquiry = {
      name: clean(body.name, 100),
      email: clean(body.email, 160),
    };

    if (!inquiry.name || !/^\S+@\S+\.\S+$/.test(inquiry.email)) {
      return Response.json(
        {
          ok: false,
          message:
            "Please provide your full name and a valid email address.",
        },
        { status: 400 },
      );
    }

    const recipient =
      process.env.ABANDONED_FUNDS_CONTACT_EMAIL || defaultRecipient;
    const fromEmail =
      process.env.ABANDONED_FUNDS_FROM_EMAIL ||
      "Abandoned Funds Recovery Group <onboarding@resend.dev>";
    const subject = "Class Action Claim Portal — Access Request";
    const plainText = [
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      "",
      "A new user has requested access to the Free Class Action Claim Portal.",
      "Please review and grant access to the settlement database.",
    ].join("\n");

    // If no Resend API key configured, fall back to mailto: link
    if (!process.env.RESEND_API_KEY) {
      const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`;
      return Response.json({
        ok: true,
        delivery: "client",
        mailtoUrl,
        message: "Access request sent. Check your email to continue.",
        redirectUrl: "/settlements",
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bea" + "rer " + (process.env.RESEND_API_KEY || ""),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient, inquiry.email],
        reply_to: inquiry.email,
        subject,
        html: `<div style="font-family:Arial,sans-serif;color:#071c24;max-width:680px">
          <h1 style="font-family:Georgia,serif">New Class Action Portal Access Request</h1>
          <table style="border-collapse:collapse;width:100%;background:#f4f2eb">
            <tr><td style="padding:8px 12px;color:#637174">Name</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(inquiry.name)}</td></tr>
            <tr><td style="padding:8px 12px;color:#637174">Email</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(inquiry.email)}</td></tr>
          </table>
          <h2 style="margin-top:28px">What happens next</h2>
          <p style="line-height:1.7">We will review your request and grant you access to the daily-updated class action settlement database at <strong>claimdepot.com</strong>.</p>
        </div>`,
      }),
    });

    if (!resendResponse.ok) {
      return Response.json(
        {
          ok: false,
          message: "Email delivery is temporarily unavailable. Please try again shortly.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      delivery: "email",
      message: "Access request sent. Check your email to continue.",
      redirectUrl: "/settlements",
    });
  } catch {
    return Response.json(
      { ok: false, message: "We could not process your request." },
      { status: 400 },
    );
  }
}
