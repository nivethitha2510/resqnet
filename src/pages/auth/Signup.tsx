/**
 * Signup Page
 * Registers citizen accounts with complete email verification flow,
 * client-side cooldown timers, rate-limit warnings, and duplicate protection.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ConfigError } from './ConfigError';
import {
  getCooldownRemaining,
  setCooldown,
} from '../../lib/authRateLimit';
import {
  ShieldAlert,
  UserPlus,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  User,
  Globe,
  CheckCircle2,
  MailCheck,
  ArrowRight,
  Send,
  Clock,
  LogIn,
} from 'lucide-react';
import type { LanguageCode } from '../../types/domain';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, resendConfirmation } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('en-US');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isDuplicateAccount, setIsDuplicateAccount] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Email confirmation awaiting state
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [cooldown, setCooldownState] = useState<number>(0);

  // In-flight submission lock to prevent concurrent submissions from repeated clicks
  const isSubmittingRef = useRef(false);

  // Update cooldown timer countdown
  useEffect(() => {
    const targetEmail = registeredEmail || email.trim();
    if (!targetEmail) return;

    const updateTimer = () => {
      const remaining = getCooldownRemaining(targetEmail);
      setCooldownState(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [registeredEmail, email]);

  if (!isSupabaseConfigured()) {
    return <ConfigError />;
  }

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleResend = async () => {
    const targetEmail = registeredEmail || email.trim();
    if (!targetEmail) return;

    if (cooldown > 0) {
      setResendStatus(`Please wait ${cooldown} seconds before requesting another verification email.`);
      return;
    }

    if (resending) return;

    setResending(true);
    setResendStatus(null);
    setIsRateLimited(false);

    try {
      await resendConfirmation(targetEmail);
      setResendStatus('Verification email sent! Please check your inbox and spam folder.');
      setCooldown(targetEmail, 60);
      setCooldownState(60);
    } catch (err: any) {
      if (err.isRateLimit || err.message?.toLowerCase().includes('rate limit')) {
        setIsRateLimited(true);
        setResendStatus(
          'Email rate limit reached. The authentication service has temporarily paused sending verification emails. Please wait a few minutes before trying again.'
        );
      } else {
        setResendStatus(err.message || 'Failed to resend confirmation email.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submission caused by rapid double-clicks
    if (loading || isSubmittingRef.current) {
      return;
    }

    setErrorMessage(null);
    setIsRateLimited(false);
    setIsDuplicateAccount(false);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address format (e.g. name@example.com).');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const res = await signUp(cleanEmail, password, cleanName, language);

      if (res.requiresEmailConfirmation) {
        setRegisteredEmail(cleanEmail);
        setAwaitingConfirmation(true);
      } else {
        setSuccessMessage('Citizen account registered successfully! Redirecting to Dashboard...');
        setTimeout(() => {
          navigate('/citizen');
        }, 1200);
      }
    } catch (err: any) {
      const msg = err.message || 'Registration failed. Please try again.';
      setErrorMessage(msg);

      if (err.isRateLimit || msg.toLowerCase().includes('rate limit')) {
        setIsRateLimited(true);
      } else if (
        err.isDuplicate ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('already registered')
      ) {
        setIsDuplicateAccount(true);
        setRegisteredEmail(cleanEmail);
      }
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // Screen shown when email confirmation is required
  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-sky-50/60 text-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <MailCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-wider">Verify Your Email</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              We have sent an activation link to:
            </p>
            <p className="font-bold text-sm text-sky-800 bg-sky-50 py-2 px-3 rounded-xl border border-sky-200 break-all">
              {registeredEmail}
            </p>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              Please click the link in your email to confirm your account. Once verified, you can sign in to access ResQNet.
            </p>
          </div>

          {/* Rate limit banner on verification screen */}
          {isRateLimited && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 text-left space-y-2">
              <div className="flex items-center space-x-2 font-bold text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Email Sending Rate Limit Reached</span>
              </div>
              <p className="leading-relaxed">
                Supabase has paused new email dispatches for this project. If you received an email earlier, please check your inbox and spam folder. Otherwise, please wait a few minutes before trying again.
              </p>
            </div>
          )}

          {resendStatus && !isRateLimited && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center space-x-2 justify-center text-left">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resendStatus}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-md transition-all"
            >
              <span>PROCEED TO SIGN IN</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              disabled={resending || cooldown > 0}
              onClick={handleResend}
              className="w-full inline-flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all"
            >
              {resending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : cooldown > 0 ? (
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : 'Resend Verification Email'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50/60 text-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-red-600 p-3 rounded-2xl text-white font-bold shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wider pt-2">Register Citizen Account</h1>
          <p className="text-xs text-slate-500 font-medium">Join the ResQNet Emergency Response Network</p>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-[11px] text-slate-700">
          <span className="font-bold text-sky-800 uppercase tracking-wider block mb-0.5">Role Security Policy:</span>
          Public signups automatically create a verified <strong className="text-slate-900">Citizen Profile</strong>. Official Command Center & Dispatcher access requires administrative authorization.
        </div>

        {/* Specialized Rate Limit Banner */}
        {isRateLimited && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-2.5">
            <div className="flex items-center space-x-2 font-bold text-amber-900">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="uppercase tracking-wider">Email Rate Limit Reached</span>
            </div>
            <p className="leading-relaxed">
              Supabase authentication has reached its hourly email delivery limit (HTTP 429). New verification emails cannot be sent right now.
            </p>
            <div className="bg-amber-100/70 p-2.5 rounded-xl text-[11px] space-y-1 text-amber-900">
              <p>• If you registered earlier, check your inbox and spam folder, then sign in.</p>
              <p>• Please wait a few minutes before trying again. Repeated submissions will not speed up delivery.</p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 font-bold text-amber-900 hover:text-amber-950 underline"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Proceed to Sign In</span>
            </Link>
          </div>
        )}

        {/* Specialized Duplicate Account Banner */}
        {isDuplicateAccount && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-950 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sky-900">
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Account Already Registered</span>
            </div>
            <p className="leading-relaxed">
              An account with <strong>{email}</strong> already exists.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Link
                to="/login"
                className="inline-flex items-center justify-center space-x-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold px-3 py-2 rounded-xl transition-all"
              >
                <span>Sign In to Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setRegisteredEmail(email.trim().toLowerCase());
                  setAwaitingConfirmation(true);
                }}
                className="inline-flex items-center justify-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-xl transition-all"
              >
                <span>Verify Email</span>
              </button>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && !isRateLimited && !isDuplicateAccount && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Anand Kumar"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Password (minimum 6 characters)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                disabled={loading}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Preferred Language</label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <select
                disabled={loading}
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-60"
              >
                <option value="en-US">English (US)</option>
                <option value="ta-IN">Tamil (ta-IN)</option>
                <option value="hi-IN">Hindi (hi-IN)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>REGISTER CITIZEN ACCOUNT</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4 space-y-1">
          <div>
            Already registered?{' '}
            <Link to="/login" className="font-bold text-sky-700 hover:underline">
              Sign In to Existing Account
            </Link>
          </div>
          <div>
            Waiting for confirmation email?{' '}
            <button
              type="button"
              onClick={() => {
                if (email.trim()) setRegisteredEmail(email.trim().toLowerCase());
                setAwaitingConfirmation(true);
              }}
              className="font-bold text-sky-700 hover:underline"
            >
              Check Verification Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
