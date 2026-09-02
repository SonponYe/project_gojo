// Gojo · chat push notification (invoked by the on_message_created DB trigger)
//
// POST /functions/v1/notify-message
//   headers: Authorization: Bearer <service role key>
//   body:    { "message_id": "<uuid>" }
//
// Sends a push to every family member except the sender. In-app realtime still
// handles the live case; this is only so a closed app still buzzes.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendExpoPush, type ExpoPushMessage } from "../_shared/expo-push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // Only the trigger (service role key) may call this.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== SERVICE_ROLE_KEY) {
    return new Response("forbidden", { status: 403 });
  }

  let messageId: string;
  try {
    messageId = String((await req.json()).message_id);
    if (!messageId) throw new Error();
  } catch {
    return new Response("body must be { message_id }", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: msg } = await admin
    .from("messages")
    .select("id, family_id, sender_id, kind, body, sender:users!messages_sender_id_fkey(name)")
    .eq("id", messageId)
    .single();

  if (!msg) return new Response("message not found", { status: 404 });

  const { data: recipients } = await admin
    .from("users")
    .select("id, push_token")
    .eq("family_id", msg.family_id)
    .neq("id", msg.sender_id)
    .not("push_token", "is", null);

  // deno-lint-ignore no-explicit-any
  const senderName = (msg as any).sender?.name || "Family";
  const preview =
    msg.kind === "location" ? "📍 Shared a location" : (msg.body ?? "").slice(0, 140);

  const messages: ExpoPushMessage[] = (recipients ?? [])
    .filter((r) => !!r.push_token)
    .map((r) => ({
      to: r.push_token as string,
      title: senderName,
      body: preview,
      sound: "default",
      channelId: "chat",
      data: { type: "chat", family_id: msg.family_id },
    }));

  await sendExpoPush(messages);
  return new Response(JSON.stringify({ ok: true, recipients: messages.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
