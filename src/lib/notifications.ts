/**
 * Admin Notifications
 *
 * Sends notifications (currently Telegram) when new conversations start.
 * Designed to be fire-and-forget — never blocks the chat response.
 */

import type { NotificationsConfig } from "./guardrails";
import type { ConversationLead } from "./leads/types";

export interface NotificationConversation {
  id: string;
  visitorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationTenant {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown> | null;
}

/**
 * Send an admin notification for a new conversation.
 * Fire-and-forget: errors are logged, never thrown.
 */
export function sendAdminNotification(
  tenant: NotificationTenant,
  conversation: NotificationConversation,
  firstMessage: string
): void {
  // Fire and forget — don't await
  _sendNotification(tenant, conversation, firstMessage).catch((err) => {
    console.error("[Notifications] Failed to send admin notification:", err);
  });
}

async function _sendNotification(
  tenant: NotificationTenant,
  conversation: NotificationConversation,
  firstMessage: string
): Promise<void> {
  const settings = tenant.settings ?? {};
  const notifications = settings.notifications as NotificationsConfig | undefined;

  if (!notifications?.enabled || notifications.mode === "off") return;

  // Telegram
  if (notifications.telegram?.botToken && notifications.telegram?.chatId) {
    await sendTelegramNotification(
      notifications.telegram.botToken,
      notifications.telegram.chatId,
      tenant,
      conversation,
      firstMessage
    );
  }
}

async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  tenant: NotificationTenant,
  conversation: NotificationConversation,
  firstMessage: string
): Promise<void> {
  const metadata = conversation.metadata ?? {};
  const pageUrl = (metadata.pageUrl as string) || "Unknown";
  const referrer = (metadata.referrer as string) || "Direct";
  const visitorId = conversation.visitorId || "Anonymous";

  // Truncate first message for preview
  const preview =
    firstMessage.length > 200
      ? firstMessage.slice(0, 200) + "…"
      : firstMessage;

  const dashboardUrl = `https://app.convo.so/dashboard/conversations?id=${conversation.id}`;

  const text =
    `💬 *New Conversation — ${escapeMarkdown(tenant.name)}*\n\n` +
    `👤 Visitor: \`${escapeMarkdown(visitorId)}\`\n` +
    `📄 Page: ${escapeMarkdown(pageUrl)}\n` +
    `🔗 Referrer: ${escapeMarkdown(referrer)}\n\n` +
    `💭 _"${escapeMarkdown(preview)}"_\n\n` +
    `[View in Dashboard](${dashboardUrl})`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[Notifications] Telegram API error ${response.status}: ${body}`
    );
  }
}

// ============================================================
// CON-95: Lead notifications
// ============================================================

export interface LeadNotificationContext {
  /** New detection sources fired by this capture event. */
  newDetections: string[];
  /** New intent categories fired by this capture event. */
  newIntents: string[];
  /** Whether this is the first capture for the conversation. */
  firstCapture: boolean;
}

/**
 * Send a Telegram admin notification when a lead is captured (or updated
 * with new signals). Fire-and-forget: errors logged, never thrown.
 *
 * PII handling: the admin Telegram channel is the tenant's OWN inbound,
 * not a customer-facing surface. Contact details are shown in full so the
 * admin can act. The summary is the AI-generated context blurb; if it
 * hasn't been written yet (summariser is async) the field is omitted.
 */
export function sendLeadNotification(
  tenant: NotificationTenant,
  conversation: NotificationConversation,
  lead: ConversationLead,
  context: LeadNotificationContext
): void {
  _sendLeadNotification(tenant, conversation, lead, context).catch((err) => {
    console.error("[Notifications] Failed to send lead notification:", err);
  });
}

async function _sendLeadNotification(
  tenant: NotificationTenant,
  conversation: NotificationConversation,
  lead: ConversationLead,
  context: LeadNotificationContext
): Promise<void> {
  const settings = tenant.settings ?? {};
  const notifications = settings.notifications as NotificationsConfig | undefined;
  if (!notifications?.enabled || notifications.mode === "off") return;
  if (!notifications.telegram?.botToken || !notifications.telegram?.chatId) return;

  await sendLeadTelegram(
    notifications.telegram.botToken,
    notifications.telegram.chatId,
    tenant,
    conversation,
    lead,
    context
  );
}

async function sendLeadTelegram(
  botToken: string,
  chatId: string,
  tenant: NotificationTenant,
  conversation: NotificationConversation,
  lead: ConversationLead,
  context: LeadNotificationContext
): Promise<void> {
  const metadata = conversation.metadata ?? {};
  const pageUrl = (metadata.pageUrl as string) || "Unknown";
  const dashboardUrl = `https://app.convo.so/dashboard/conversations?id=${conversation.id}`;

  const heading = context.firstCapture
    ? `🎯 *Lead Captured — ${escapeMarkdown(tenant.name)}*`
    : `🎯 *Lead Updated — ${escapeMarkdown(tenant.name)}*`;

  const contactLines: string[] = [];
  if (lead.contact.name) {
    contactLines.push(`👤 Name: ${escapeMarkdown(lead.contact.name)}`);
  }
  if (lead.contact.email) {
    contactLines.push(`📧 Email: ${escapeMarkdown(lead.contact.email)}`);
  }
  if (lead.contact.phone) {
    contactLines.push(`📞 Phone: ${escapeMarkdown(lead.contact.phone)}`);
  }
  if (contactLines.length === 0) {
    contactLines.push(`👤 Contact: _intent-only, no PII yet_`);
  }

  const signalsLine = lead.intentSignals.length
    ? `🔍 Intent: ${lead.intentSignals.map(escapeMarkdown).join(", ")}`
    : "🔍 Intent: _voluntary contact_";

  const summaryLine = lead.summary
    ? `
📝 _${escapeMarkdown(lead.summary)}_`
    : "";

  const text =
    `${heading}\n\n` +
    `${contactLines.join("\n")}\n` +
    `${signalsLine}\n` +
    `📄 Page: ${escapeMarkdown(pageUrl)}` +
    `${summaryLine}\n\n` +
    `[View in Dashboard](${dashboardUrl})`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[Notifications] Lead Telegram API error ${response.status}: ${body}`
    );
  }
  // Silence unused-binding lints if the linter ever sees `context` unused.
  void context;
}

/**
 * Send a test notification to verify Telegram config.
 */
export async function sendTestNotification(
  botToken: string,
  chatId: string,
  tenantName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ Test notification from Convo — ${escapeMarkdown(tenantName)}\n\nNotifications are working!`,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Telegram API error: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
