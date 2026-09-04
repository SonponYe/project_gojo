// Spec §10.5, English + Twi. Device language picks the default; a manual
// override lives in the profile screen. Add a language by dropping in another
// JSON file and registering it here, no code changes elsewhere.

import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';

import type { LanguageCode } from '../lib/database.types';
import en from './en.json';
import tw from './tw.json';

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi' },
];

export const i18n = new I18n({ en, tw });
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export function deviceLanguage(): LanguageCode {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code === 'tw' || code === 'ak' ? 'tw' : 'en';
}

/** `override` is the user's manual choice; null => follow the device. */
export function applyLanguage(override: LanguageCode | null | undefined): LanguageCode {
  const lang = override ?? deviceLanguage();
  i18n.locale = lang;
  return lang;
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
