export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  expirationTime: number | null;
  userAgent: string | null;
  deviceLabel: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureReason: string | null;
};

export type PushSubscriptionUpsertResult = {
  subscription: PushSubscriptionRecord;
};

export type PushSubscriptionDeleteResult = {
  removed: boolean;
};

export type PushSubscriptionStatus = {
  configured: boolean;
  supported: boolean;
  vapidPublicKeyConfigured: boolean;
  currentDeviceSubscribed: boolean;
  activeSubscriptionCount: number;
};
