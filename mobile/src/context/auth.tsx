import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { applyLanguage } from '../i18n';
import type { AppUser, Family, LanguageCode } from '../lib/database.types';
import { registerPushToken } from '../lib/notifications';
import { resumeTrackingIfEnabled } from '../lib/tracking';
import { supabase } from '../lib/supabase';

interface AuthState {
  initializing: boolean;
  session: Session | null;
  profile: AppUser | null;
  family: Family | null;
  language: LanguageCode;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setLanguageOverride: (lang: LanguageCode | null) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [language, setLanguage] = useState<LanguageCode>(applyLanguage(null));

  const loadProfile = useCallback(async (uid: string) => {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single<AppUser>();
    setProfile(user ?? null);
    setLanguage(applyLanguage(user?.language ?? null));

    if (user?.family_id) {
      const { data: fam } = await supabase
        .from('families')
        .select('*')
        .eq('id', user.family_id)
        .single<Family>();
      setFamily(fam ?? null);
    } else {
      setFamily(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session?.user.id, loadProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) await loadProfile(data.session.user.id);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next?.user.id) {
        await loadProfile(next.user.id);
        registerPushToken();
        resumeTrackingIfEnabled();
      } else {
        setProfile(null);
        setFamily(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const setLanguageOverride = useCallback(
    async (lang: LanguageCode | null) => {
      setLanguage(applyLanguage(lang));
      if (session?.user.id) {
        await supabase.from('users').update({ language: lang }).eq('id', session.user.id);
        setProfile((p) => (p ? { ...p, language: lang } : p));
      }
    },
    [session?.user.id],
  );

  const value = useMemo<AuthState>(
    () => ({
      initializing,
      session,
      profile,
      family,
      language,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      setLanguageOverride,
    }),
    [
      initializing,
      session,
      profile,
      family,
      language,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      setLanguageOverride,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
