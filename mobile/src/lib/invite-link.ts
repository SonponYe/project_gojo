// Invite links: build a deep link for a family's code, and stash a code that
// arrived via a link so onboarding can pick it up even after the sign-in detour.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const PENDING_KEY = 'gojo:pending-invite-code';

/** e.g. gojo://join-family?code=ABC123 (dev builds get the right scheme too). */
export function buildInviteLink(code: string): string {
  return Linking.createURL('join-family', { queryParams: { code } });
}

/** Human-friendly message for the OS share sheet. */
export function inviteShareMessage(code: string, familyName?: string): string {
  const who = familyName ? `the ${familyName} family` : 'my family';
  return (
    `Join ${who} on Gojo so we can see each other's location and stay in touch.\n\n` +
    `In the app, tap "Join family" and enter code: ${code}\n` +
    `Or open: ${buildInviteLink(code)}`
  );
}

/** Pull a `code` query param out of any URL the app was opened with. */
export function codeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { queryParams } = Linking.parse(url);
    const raw = queryParams?.code;
    const code = Array.isArray(raw) ? raw[0] : raw;
    return code ? String(code).trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

export async function setPendingInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, code);
  } catch {
    /* non-fatal */
  }
}

/** Read and clear the stashed code. */
export async function takePendingInviteCode(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(PENDING_KEY);
    if (code) await AsyncStorage.removeItem(PENDING_KEY);
    return code;
  } catch {
    return null;
  }
}
