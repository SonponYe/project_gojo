/**
 * Hand-written types mirroring the Supabase schema (see /supabase/migrations).
 * Regenerate with `supabase gen types typescript` once the project is linked.
 */

export type SignalType = 'wifi' | '4g' | '3g' | '2g' | 'none' | 'unknown';
export type MessageKind = 'text' | 'location';
export type LanguageCode = 'en' | 'tw';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  family_id: string | null;
  name: string;
  avatar_url: string | null;
  email: string | null;
  is_sharing: boolean;
  push_token: string | null;
  language: LanguageCode | null;
  consent_accepted_at: string | null;
  created_at: string;
}

export interface LocationRow {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  battery_level: number | null;
  signal_type: SignalType | null;
  place_name: string | null;
  updated_at: string;
}

export interface Message {
  id: string;
  family_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  latitude: number | null;
  longitude: number | null;
  sent_at: string;
}

export interface SosAlert {
  id: string;
  sender_id: string;
  family_id: string;
  lat: number;
  lng: number;
  resolved_at: string | null;
  created_at: string;
}

export interface SavedPlace {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  created_at: string;
}

/** A family member joined with their latest location — what the map renders. */
export interface MemberWithLocation {
  user: AppUser;
  location: LocationRow | null;
}
