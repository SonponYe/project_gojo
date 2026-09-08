// Gojo · chat push notification
//
// Called by the sender's app right after it inserts a message (a user JWT), or
// by the on_message_created DB trigger (the service role key). Either way it
// pushes a WhatsApp-style notification to every other family member so a closed
// or backgrounded app still buzzes. The in-app realtime stream covers the live
// case; a foreground recipient reading the chat is muted client-side.
//
// POST /functions/v1/notify-message
//   headers: Authorization: Bearer <user access token | service role key>
//   body:    { "message_id": "<uuid>" }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendExpoPush, type ExpoPushMessage } from "../_shared/expo-push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response("missing bearer token", { status: 401 });

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

  // Authorise: either the service role key, or the message's own sender.
  if (token !== SERVICE_ROLE_KEY) {
    const { data: userData, error } = await admin.auth.getUser(token);
    if (error || !userData.user || userData.user.id !== msg.sender_id) {
      return new Response("forbidden", { status: 403 });
    }
  }

  const { data: recipients } = await admin
    .from("users")
    .select("id, push_token")
    .eq("family_id", msg.family_id)
    .neq("id", msg.sender_id)
    .not("push_token", "is", null);

  // deno-lint-ignore no-explicit-any
  const senderName = (msg as any).sender?.name?.trim() || "A family member";
  const body =
    msg.kind === "location"
      ? `${senderName} shared a location`
      : (msg.body ?? "").slice(0, 160);

  const messages: ExpoPushMessage[] = (recipients ?? [])
    .filter((r) => !!r.push_token)
    .map((r) => ({
      to: r.push_token as string,
      title: senderName,
      body,
      sound: "default",
      channelId: "chat",
      data: { type: "chat", family_id: msg.family_id },
    }));

  await sendExpoPush(messages);
  return new Response(JSON.stringify({ ok: true, recipients: messages.length }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
