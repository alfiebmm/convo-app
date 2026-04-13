/**
 * PUT /api/settings/test-notification
 *
 * Sends a test Telegram notification to verify the config.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendTestNotification } from "@/lib/notifications";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { botToken, chatId, tenantName } = body;

  if (!botToken || !chatId) {
    return NextResponse.json(
      { success: false, error: "botToken and chatId are required" },
      { status: 400 }
    );
  }

  const result = await sendTestNotification(
    botToken,
    chatId,
    tenantName || "Test Tenant"
  );

  return NextResponse.json(result);
}
