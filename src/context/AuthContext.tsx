/**
 * ResQNet Authentication Context
 * Integrates real Supabase Auth with automatic session restoration and live profiles state.
 * Enforces strict profile role retrieval without default fallbacks.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole, LanguageCode } from '../types/domain';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  authError: string | null;
  signUp: (email: string, password: string, fullName: string, preferredLanguage?: LanguageCode) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ user: User; profile: Profile | null; role: UserRole }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = async (userId: string): Promise<{ profile: Profile | null; role: UserRole | null }> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching user profile from public.profiles:', error?.message);
        setProfile(null);
        setRole(null);
        return { profile: null, role: null };
      }

      const fetchedProfile = data as Profile;
      const fetchedRole = (data.role as UserRole) || null;
      setProfile(fetchedProfile);
      setRole(fetchedRole);
      return { profile: fetchedProfile, role: fetchedRole };
    } catch (err: any) {
      console.error('Unexpected error fetching profile:', err);
    }
    setProfile(null);
    setRole(null);
    return { profile: null, role: null };
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    preferredLanguage: LanguageCode = 'en-US'
  ) => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          preferred_language: preferredLanguage,
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    if (data.user) {
      setUser(data.user);
      let res = await fetchProfile(data.user.id);
      if (!res.profile) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          role: 'citizen',
          preferred_language: preferredLanguage,
          updated_at: new Date().toISOString(),
        });
        await fetchProfile(data.user.id);
      }
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ user: User; profile: Profile | null; role: UserRole }> => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    if (data.user) {
      setUser(data.user);
      const res = await fetchProfile(data.user.id);
      if (!res.profile || !res.role) {
        throw new Error('User account exists but profile role could not be retrieved from public.profiles.');
      }
      return {
        user: data.user,
        profile: res.profile,
        role: res.role,
      };
    }

    throw new Error('Authentication failed. No user returned.');
  };

  const signOut = async () => {
    setAuthError(null);
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: role as UserRole,
        isLoading,
        authError,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
