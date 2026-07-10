import type { OrderWithCustomer, Pizza } from "@shared/schema";
import { formatPickupTime } from "@shared/pickup-time";

export type OrderEmailConfig = {
  resendApiKey?: string;
  emailFrom?: string;
  siteUrl: string;
};

function formatServiceDate(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return dateStr;
  }

  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function buildOrderConfirmationHtml(
  order: OrderWithCustomer,
  pizza: Pizza,
  siteUrl: string,
): string {
  const logoUrl = `${siteUrl.replace(/\/$/, "")}/viks-pizza-logo2.png`;
  const pickupTime = formatPickupTime(order.pickupSlot.pickupTime);
  const serviceDate = formatServiceDate(order.date);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Order confirmed</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#171717;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 12px;text-align:center;background:#111111;">
              <img src="${logoUrl}" alt="Vik's Pizza" width="220" style="display:block;margin:0 auto;max-width:220px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#ffb000;font-weight:700;">Order confirmed</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#ffffff;">Thanks, ${order.customer.name}!</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.82);">
                Your pie is reserved. Pay when you pick up.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <tr>
                  <td style="padding:18px 16px;">
                    <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ffb000;font-weight:700;">Pickup details</p>
                    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#ffffff;">${pizza.name}</p>
                    <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.85);"><strong>Date:</strong> ${serviceDate}</p>
                    <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.85);"><strong>Time:</strong> ${pickupTime} PT</p>
                    <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.85);"><strong>Quantity:</strong> ${order.quantity}</p>
                    <p style="margin:0;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.85);"><strong>Name for pickup:</strong> ${order.customer.name}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;text-align:center;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.65);">
                See you soon. Peace and pies.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOrderConfirmationEmail(
  order: OrderWithCustomer,
  pizza: Pizza,
  config: OrderEmailConfig,
): Promise<void> {
  const to = order.customer.email?.trim();
  if (!to) {
    return;
  }

  const subject = `Your Vik's Pizza order is confirmed`;
  const html = buildOrderConfirmationHtml(order, pizza, config.siteUrl);
  const from = config.emailFrom || "Vik's Pizza <onboarding@resend.dev>";

  if (!config.resendApiKey) {
    console.log("[EMAIL] Resend not configured — order confirmation not sent");
    console.log(`[EMAIL] To: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403 && body.includes("domain is not verified")) {
      console.error(
        `[EMAIL] Resend rejected the From address (${from}). ` +
          "Use a verified domain (e.g. orders@vikspizza.com), not @gmail.com. " +
          "Add DNS records at https://resend.com/domains — or for local testing only, " +
          "set EMAIL_FROM to onboarding@resend.dev (can only deliver to your Resend account email).",
      );
    } else {
      console.error(`[EMAIL] Failed to send order confirmation to ${to}: ${response.status} ${body}`);
    }
    return;
  }

  console.log(`[EMAIL] Order confirmation sent to ${to}`);
}
