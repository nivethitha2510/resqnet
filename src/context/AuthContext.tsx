/**
 * ResQNet Authentication Context
 * Integrates real Supabase Auth with automatic session restoration and live profiles state.
 * Enforces strict profile role retrieval with secure citizen self-healing and email verification support.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole, LanguageCode } from '../types/domain';
import {
  parseSupabaseAuthError,
  getCooldownRemaining,
  setCooldown,
} from '../lib/authRateLimit';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  authError: string | null;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    preferredLanguage?: LanguageCode
  ) => Promise<{ requiresEmailConfirmation: boolean; user: User | null; isExistingAccount?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ user: User; profile: Profile | null; role: UserRole }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (
      userId: string,
      authUser?: User | null
    ): Promise<{ profile: Profile | null; role: UserRole | null }> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        const fetchedProfile = data as Profile;
        const fetchedRole = (data.role as UserRole) || null;
        setProfile(fetchedProfile);
        setRole(fetchedRole);
        return { profile: fetchedProfile, role: fetchedRole };
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch note:', error.message);
      }

      // Self-healing fallback: If user is authenticated in Supabase Auth,
      // create default citizen profile using verified auth user details.
      const targetUser = authUser || (await supabase.auth.getUser()).data?.user;
      if (targetUser && targetUser.id === userId) {
        const userEmail = targetUser.email || '';
        const userFullName = targetUser.user_metadata?.full_name || 'Citizen User';
        const userLang = targetUser.user_metadata?.preferred_language || 'en-US';

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            full_name: userFullName,
            role: 'citizen',
            preferred_language: userLang,
          })
          .select()
          .single();

        if (newProfile && !insertError) {
          const healedProfile = newProfile as Profile;
          const healedRole = healedProfile.role as UserRole;
          setProfile(healedProfile);
          setRole(healedRole);
          return { profile: healedProfile, role: healedRole };
        } else if (insertError) {
          console.error('Self-healing citizen profile insert error:', insertError.message);
        }
      }
    } catch (err: any) {
      console.error('Unexpected error fetching profile:', err);
    }

    setProfile(null);
    setRole(null);
    return { profile: null, role: null };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    let isMounted = true;

    // Subscribe to auth state changes. This automatically fires INITIAL_SESSION on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id, currentSession.user);
      } else {
        setProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    preferredLanguage: LanguageCode = 'en-US'
  ): Promise<{ requiresEmailConfirmation: boolean; user: User | null; isExistingAccount?: boolean }> => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          preferred_language: preferredLanguage,
        },
      },
    });

    if (error) {
      const parsed = parseSupabaseAuthError(error);
      setAuthError(parsed.message);
      const enhancedError: any = new Error(parsed.message);
      enhancedError.status = parsed.status;
      enhancedError.code = parsed.code;
      enhancedError.isRateLimit = parsed.isRateLimit;
      enhancedError.isDuplicate = parsed.isDuplicate;
      enhancedError.technicalDetails = parsed.technicalDetails;
      throw enhancedError;
    }

    // Duplicate detection when Supabase anti-enumeration returns user with empty identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const duplicateMsg = 'An account with this email address already exists. Please sign in instead.';
      setAuthError(duplicateMsg);
      const dupError: any = new Error(duplicateMsg);
      dupError.isDuplicate = true;
      throw dupError;
    }

    const requiresEmailConfirmation = !data.session;

    if (requiresEmailConfirmation) {
      // Set an initial 60s cooldown for resending verification email
      setCooldown(cleanEmail, 60);
    } else if (data.session && data.user) {
      setSession(data.session);
      setUser(data.user);
      await fetchProfile(data.user.id, data.user);
    }

    return {
      requiresEmailConfirmation,
      user: data.user,
    };
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ user: User; profile: Profile | null; role: UserRole }> => {
    setAuthError(null);
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      const parsed = parseSupabaseAuthError(error);
      setAuthError(parsed.message);
      const enhancedError: any = new Error(parsed.message);
      enhancedError.status = parsed.status;
      enhancedError.code = parsed.code;
      enhancedError.isRateLimit = parsed.isRateLimit;
      enhancedError.isUnconfirmed = parsed.isUnconfirmed;
      enhancedError.technicalDetails = parsed.technicalDetails;
      throw enhancedError;
    }

    if (data.user && data.session) {
      setUser(data.user);
      setSession(data.session);
      const res = await fetchProfile(data.user.id, data.user);
      if (!res.profile || !res.role) {
        throw new Error('Account role could not be verified in user profile. Please try logging in again.');
      }
      return {
        user: data.user,
        profile: res.profile,
        role: res.role,
      };
    }

    throw new Error('Authentication failed. No active session returned.');
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

  const resendConfirmation = async (email: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const cleanEmail = email.trim().toLowerCase();

    // Enforce client-side cooldown before making any network call
    const remainingSeconds = getCooldownRemaining(cleanEmail);
    if (remainingSeconds > 0) {
      const waitErr: any = new Error(
        `Please wait ${remainingSeconds} seconds before requesting another verification email.`
      );
      waitErr.isRateLimit = true;
      waitErr.cooldownRemaining = remainingSeconds;
      throw waitErr;
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });

    if (error) {
      const parsed = parseSupabaseAuthError(error);
      if (parsed.isRateLimit) {
        // Enforce 120s cooldown on 429
        setCooldown(cleanEmail, 120);
      }
      const enhancedError: any = new Error(parsed.message);
      enhancedError.status = parsed.status;
      enhancedError.code = parsed.code;
      enhancedError.isRateLimit = parsed.isRateLimit;
      enhancedError.technicalDetails = parsed.technicalDetails;
      throw enhancedError;
    }

    // Set 60-second cooldown on successful email dispatch
    setCooldown(cleanEmail, 60);
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
        resendConfirmation,
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
