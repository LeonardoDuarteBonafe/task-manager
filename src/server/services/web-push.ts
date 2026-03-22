import webpush from "web-push";
import type { PushSubscriptionRecord } from "@/lib/notifications/push-subscription-types";

let vapidConfigured = false;

function ensureWebPushConfigured() {
  if (vapidConfigured) {
    return;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Web Push is not configured. Define NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

type SendWebPushInput = {
  subscription: PushSubscriptionRecord & {
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  payload: Record<string, unknown>;
  ttlSeconds?: number;
};

export async function sendWebPush(input: SendWebPushInput) {
  ensureWebPushConfigured();

  return webpush.sendNotification(
    {
      endpoint: input.subscription.endpoint,
      expirationTime: input.subscription.expirationTime,
      keys: input.subscription.keys,
    },
    JSON.stringify(input.payload),
    {
      TTL: input.ttlSeconds ?? 60,
      urgency: "high",
    },
  );
}
