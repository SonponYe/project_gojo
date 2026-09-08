// Gojo · SOS Edge Function (v2.3)
//
// Called when a member holds the SOS button. It:
//   1. authenticates the caller from their JWT,
//   2. writes one row to public.sos_alerts,
//   3. fans an urgent push out to every other member of the family,
// all in a single call, target end-to-end latency < 2s.
//
// POST /functions/v1/sos-alert
//   headers: Authorization: Bearer <user access token>
//   body:    { "lat": number, "lng": number }
//   200:     { "ok": true, "alert_id": "<uuid>", "recipients": <n> }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendExpoPush, type ExpoPushMessage } from "../_shared/expo-push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing bearer token" }, 401);

  let lat: number, lng: number;
  try {
    const body = await req.json();
    lat = Number(body.lat);
    lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("bad coords");
  } catch {
    return json({ error: "body must be { lat, lng }" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Who is calling?
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "invalid session" }, 401);
  const senderId = userData.user.id;

  const { data: sender, error: senderErr } = await admin
    .from("users")
    .select("id, name, family_id")
    .eq("id", senderId)
    .single();
  if (senderErr || !sender?.family_id) {
    return json({ error: "you are not in a family" }, 403);
  }

  // 2. Record the alert.
  const { data: alert, error: alertErr } = await admin
    .from("sos_alerts")
    .insert({ sender_id: senderId, family_id: sender.family_id, lat, lng })
    .select("id, created_at")
    .single();
  if (alertErr || !alert) {
    console.error("sos insert failed", alertErr);
    return json({ error: "could not record alert" }, 500);
  }

  // 3. Fan out to the rest of the family.
  const { data: recipients } = await admin
    .from("users")
    .select("id, push_token")
    .eq("family_id", sender.family_id)
    .neq("id", senderId)
    .not("push_token", "is", null);

  const name = (sender.name ?? "").trim() || "A family member";
  const messages: ExpoPushMessage[] = (recipients ?? [])
    .filter((r) => !!r.push_token)
    .map((r) => ({
      to: r.push_token as string,
      title: "Gojo: SOS alert",
      body: `${name} needs help! Tap for their location, or use Directions.`,
      sound: "default",
      priority: "high",
      channelId: "sos",
      categoryId: "sos", // enables the "Directions" quick action on the phone
      data: {
        type: "sos",
        alert_id: alert.id,
        sender_id: senderId,
        lat,
        lng,
      },
    }));

  await sendExpoPush(messages);

  return json({ ok: true, alert_id: alert.id, recipients: messages.length });
});
