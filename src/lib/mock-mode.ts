export const FORCE_LOGIN_EMAIL = "force@taskmanager.local";
export const FORCE_LOGIN_PASSWORD = "Force@123456";
export const FORCE_LOGIN_USER_ID = "force-session-user";

export function isForcedUser(user?: { id?: string | null; email?: string | null; isForced?: boolean }) {
  return user?.isForced === true || user?.id === FORCE_LOGIN_USER_ID || user?.email === FORCE_LOGIN_EMAIL;
}
