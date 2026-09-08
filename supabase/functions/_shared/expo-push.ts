// Shared helper: send a batch of push notifications through the Expo push service.
// https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  categoryId?: string;
  ttl?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Fire messages in batches of 100 (Expo's per-request limit). Errors are logged, not thrown. */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => {
    const to = Array.isArray(m.to) ? m.to[0] : m.to;
    return typeof to === "string" && to.startsWith("ExponentPushToken");
  });
  if (valid.length === 0) return;

  for (const batch of chunk(valid, 100)) {
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error("expo push failed", res.status, await res.text());
      }
    } catch (err) {
      console.error("expo push error", err);
    }
  }
}
