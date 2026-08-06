export const runtime = "edge";

const defaultRecipient = "PankjaSewal@Abandonedfunds.org";

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const inquiry = {
      name: clean(body.name, 100),
      organization: clean(body.organization, 140),
      email: clean(body.email, 160),
      phone: clean(body.phone, 40),
      overview: clean(body.overview, 1800),
    };

    if (!inquiry.name || !inquiry.overview || !/^\S+@\S+\.\S+$/.test(inquiry.email)) {
      return Response.json({ ok: false, message: "Please provide your name, a valid email address, and an overview of the funds." }, { status: 400 });
    }

    const recipient = process.env.ABANDONED_FUNDS_CONTACT_EMAIL || defaultRecipient;
    const subject = "Confidential Abandoned Funds Inquiry";
    const plainText = [
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      `Organization: ${inquiry.organization || "Not provided"}`,
      `Phone: ${inquiry.phone || "Not provided"}`,
      "",
      "Funds overview:",
      inquiry.overview,
    ].join("\n");

    if (!process.env.RESEND_API_KEY) {
      return Response.json({
        ok: true,
        delivery: "client",
        mailtoUrl: `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`,
      });
    }

    const rows = Object.entries({
      Name: inquiry.name,
      Email: inquiry.email,
      Organization: inquiry.organization || "Not provided",
      Phone: inquiry.phone || "Not provided",
    }).map(([label, value]) => `<tr><td style="padding:8px 12px;color:#637174">${label}</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("");

    const delivery = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ABANDONED_FUNDS_FROM_EMAIL || "Abandoned Funds Recovery Group <onboarding@resend.dev>",
        to: [recipient],
        reply_to: inquiry.email,
        subject,
        html: `<div style="font-family:Arial,sans-serif;color:#071c24;max-width:680px"><h1 style="font-family:Georgia,serif">New Abandoned Funds inquiry</h1><table style="border-collapse:collapse;width:100%;background:#f4f2eb">${rows}</table><h2 style="margin-top:28px">Funds overview</h2><p style="line-height:1.7;white-space:pre-wrap">${escapeHtml(inquiry.overview)}</p></div>`,
      }),
    });

    if (!delivery.ok) return Response.json({ ok: false, message: "Email delivery is temporarily unavailable. Please try again shortly." }, { status: 502 });
    return Response.json({ ok: true, delivery: "email" });
  } catch {
    return Response.json({ ok: false, message: "We could not process this inquiry." }, { status: 400 });
  }
}
