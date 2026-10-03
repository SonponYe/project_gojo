// Gojo · "Request check-in" nudge
//
// There is no way to pull a position off someone else's phone without their
// app cooperating. This is the honest equivalent: push them a notification;
// tapping it opens Gojo, which reports their current position immediately
// (the same foreground-sync path that runs on every app open).
//
// POST /functions/v1/request-checkin
//   headers: Authorization: Bearer <user access token>
//   body:    { "target_user_id": "<uuid>" }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendExpoPush } from "../_shared/expo-push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing bearer token" }, 401);

  let targetUserId: string;
  try {
    targetUserId = String((await req.json()).target_user_id);
    if (!targetUserId) throw new Error();
  } catch {
    return json({ error: "body must be { target_user_id }" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: "invalid session" }, 401);

  const { data: me } = await admin
    .from("users")
    .select("id, name, family_id")
    .eq("id", userData.user.id)
    .single();
  if (!me?.family_id) return json({ error: "you are not in a family" }, 403);

  const { data: target } = await admin
    .from("users")
    .select("id, family_id, push_token")
    .eq("id", targetUserId)
    .single();

  if (!target || target.family_id !== me.family_id) {
    return json({ error: "that person is not in your family" }, 403);
  }
  if (!target.push_token) {
    return json({ error: "they have no push token registered yet" }, 422);
  }

  const name = (me.name ?? "").trim() || "A family member";
  await sendExpoPush([
    {
      to: target.push_token,
      title: "Gojo",
      body: `${name} wants to know where you are. Tap to update your location.`,
      sound: "default",
      channelId: "default",
      data: { type: "checkin_request" },
    },
  ]);

  return json({ ok: true });
});
