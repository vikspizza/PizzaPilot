import type { OrderWithCustomer, Pizza } from "@shared/schema";
import { formatPickupTime } from "@shared/pickup-time";
import { buildReviewLinkUrl } from "@shared/review-link";

const LOGO_FILENAME = "viks-pizza-logo2.png";
const LOGO_CONTENT_ID = "viks-logo";
const PIZZA_CONTENT_ID = "pizza-image";

export type OrderEmailConfig = {
  resendApiKey?: string;
  emailFrom?: string;
  siteUrl: string;
  /** Origin that serves static assets (e.g. pages.dev). Defaults to siteUrl. */
  logoBaseUrl?: string;
  /** HMAC secret for personalized review links. */
  reviewLinkSecret?: string;
};

type ResendAttachment = {
  filename: string;
  content: string;
  content_id: string;
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

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function logoUrlFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${LOGO_FILENAME}`;
}

function resolveAssetUrl(baseUrl: string, url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function loadImageAttachment(
  imageUrl: string,
  contentId: string,
  filename: string,
): Promise<ResendAttachment | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[EMAIL] Could not load image from ${imageUrl}: ${response.status}`);
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      filename,
      content: bytesToBase64(bytes),
      content_id: contentId,
    };
  } catch (error) {
    console.error(`[EMAIL] Could not load image from ${imageUrl}:`, error);
    return null;
  }
}

async function loadLogoAttachment(logoBaseUrl: string): Promise<ResendAttachment | null> {
  return loadImageAttachment(logoUrlFor(logoBaseUrl), LOGO_CONTENT_ID, LOGO_FILENAME);
}

async function loadPizzaImageAttachment(
  assetBaseUrl: string,
  pizza: Pizza,
): Promise<{ attachment: ResendAttachment; src: string } | null> {
  const imageUrl = resolveAssetUrl(assetBaseUrl, pizza.imageUrl);
  if (!imageUrl) {
    return null;
  }

  const filename = imageUrl.split("/").pop() || "pizza.jpg";
  const attachment = await loadImageAttachment(imageUrl, PIZZA_CONTENT_ID, filename);
  if (!attachment) {
    return null;
  }

  return {
    attachment,
    src: `cid:${PIZZA_CONTENT_ID}`,
  };
}

function buildOrderConfirmationHtml(
  order: OrderWithCustomer,
  pizza: Pizza,
  logoSrc: string,
  pizzaImageSrc: string | null,
  reviewUrl: string | null,
): string {
  const pickupTime = formatPickupTime(order.pickupSlot.pickupTime);
  const serviceDate = formatServiceDate(order.date);
  const pizzaImageMarkup = pizzaImageSrc
    ? `<img src="${pizzaImageSrc}" alt="${pizza.name}" width="280" style="display:block;width:100%;max-width:280px;height:auto;margin:0 auto 14px;border-radius:10px;" />`
    : "";
  const reviewMarkup = reviewUrl
    ? `<tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.82);">
                After you try it, we'd love your honest feedback. This link is just for your order and stops working once you submit.
              </p>
              <a href="${reviewUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ffb000;color:#111111;font-size:14px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;">
                Leave a review
              </a>
            </td>
          </tr>`
    : "";

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
              <img src="${logoSrc}" alt="Vik's Pizza" width="220" style="display:block;margin:0 auto;max-width:220px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#ffb000;font-weight:700;">Order confirmed</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#ffffff;">Thanks, ${order.customer.name}!</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.82);">
                Your pie is reserved. Our treat!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <tr>
                  <td style="padding:18px 16px;">
                    <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ffb000;font-weight:700;">Pickup details</p>
                    ${pizzaImageMarkup}
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
          ${reviewMarkup}
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

  const logoBaseUrl = config.logoBaseUrl || config.siteUrl;
  const logoAttachment = await loadLogoAttachment(logoBaseUrl);
  const logoSrc = logoAttachment ? `cid:${LOGO_CONTENT_ID}` : logoUrlFor(logoBaseUrl);

  const pizzaImage = await loadPizzaImageAttachment(logoBaseUrl, pizza);
  const pizzaImageSrc = pizzaImage?.src ?? resolveAssetUrl(logoBaseUrl, pizza.imageUrl);

  const subject = `Your Vik's Pizza order is confirmed`;
  let reviewUrl: string | null = null;
  if (config.reviewLinkSecret) {
    try {
      reviewUrl = await buildReviewLinkUrl(config.siteUrl, order.id, config.reviewLinkSecret);
    } catch (error) {
      console.error("[EMAIL] Failed to build review link:", error);
    }
  } else {
    console.warn("[EMAIL] No review link secret configured — confirmation sent without review CTA");
  }

  const html = buildOrderConfirmationHtml(order, pizza, logoSrc, pizzaImageSrc, reviewUrl);
  const from = config.emailFrom || "Vik's Pizza <onboarding@resend.dev>";
  const attachments = [logoAttachment, pizzaImage?.attachment].filter(
    (attachment): attachment is ResendAttachment => Boolean(attachment),
  );

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
      ...(attachments.length > 0 ? { attachments } : {}),
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
