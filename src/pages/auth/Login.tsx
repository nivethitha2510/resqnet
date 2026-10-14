/**
 * Login Page
 * Real Supabase Authentication Sign In
 * Enforces role verification with intelligent portal routing, cooldown-protected email resends,
 * and clear rate-limit handling.
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
  LogIn,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Truck,
  Send,
  CheckCircle2,
  ArrowRight,
  Clock,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, resendConfirmation, user, role, isLoading } = useAuth();

  const [loginTab, setLoginTab] = useState<'citizen' | 'responder' | 'authority'>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldownState] = useState<number>(0);
  const [portalNotice, setPortalNotice] = useState<{
    text: string;
    targetPath: string;
    buttonLabel: string;
  } | null>(null);

  // In-flight submission lock to prevent concurrent submissions from repeated clicks
  const isSubmittingRef = useRef(false);

  // If already authenticated with a role, redirect to appropriate portal
  useEffect(() => {
    if (!isLoading && user && role) {
      if (role === 'authority') navigate('/authority', { replace: true });
      else if (role === 'responder') navigate('/responder', { replace: true });
      else if (role === 'admin') navigate('/admin', { replace: true });
      else navigate('/citizen', { replace: true });
    }
  }, [user, role, isLoading, navigate]);

  // Update cooldown timer countdown
  useEffect(() => {
    if (!unconfirmedEmail) return;

    const updateTimer = () => {
      const remaining = getCooldownRemaining(unconfirmedEmail);
      setCooldownState(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unconfirmedEmail]);

  if (!isSupabaseConfigured()) {
    return <ConfigError />;
  }

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail || resending) return;

    if (cooldown > 0) {
      setResendStatus(`Please wait ${cooldown} seconds before requesting another confirmation email.`);
      return;
    }

    setResending(true);
    setResendStatus(null);
    setIsRateLimited(false);

    try {
      await resendConfirmation(unconfirmedEmail);
      setResendStatus('Confirmation email sent! Please check your inbox and spam folder.');
      setCooldown(unconfirmedEmail, 60);
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
    setPortalNotice(null);
    setResendStatus(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const res = await signIn(cleanEmail, password);
      const actualRole = res.role;

      if (!actualRole) {
        setErrorMessage('Account role could not be verified in public.profiles database table.');
        return;
      }

      // Intelligent Portal Routing based on verified database role
      if (loginTab === 'responder') {
        if (actualRole === 'responder') {
          navigate('/responder');
        } else if (actualRole === 'authority' || actualRole === 'admin') {
          navigate('/authority');
        } else if (actualRole === 'citizen') {
          setPortalNotice({
            text: `Account '${cleanEmail}' is registered as Citizen. Field Responder portal is restricted to active emergency response units.`,
            targetPath: '/citizen',
            buttonLabel: 'Go to Citizen Dashboard',
          });
        }
      } else if (loginTab === 'authority') {
        if (actualRole === 'authority' || actualRole === 'admin') {
          navigate('/authority');
        } else if (actualRole === 'responder') {
          navigate('/responder');
        } else if (actualRole === 'citizen') {
          setPortalNotice({
            text: `Account '${cleanEmail}' is registered with Citizen permissions. Official Command Center is restricted to authorized personnel.`,
            targetPath: '/citizen',
            buttonLabel: 'Go to Citizen Dashboard',
          });
        }
      } else {
        // Citizen login tab
        if (actualRole === 'citizen') {
          navigate('/citizen');
        } else if (actualRole === 'authority' || actualRole === 'admin') {
          navigate('/authority');
        } else if (actualRole === 'responder') {
          navigate('/responder');
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(msg);

      if (err.isRateLimit || msg.toLowerCase().includes('rate limit')) {
        setIsRateLimited(true);
      } else if (
        err.isUnconfirmed ||
        msg.toLowerCase().includes('not been confirmed') ||
        msg.toLowerCase().includes('confirm your email') ||
        msg.toLowerCase().includes('email not confirmed')
      ) {
        setUnconfirmedEmail(cleanEmail);
      }
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50/60 text-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-red-600 p-3 rounded-2xl text-white font-bold shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wider pt-1">ResQNet</h1>
          <p className="text-xs text-slate-500 font-medium">Intelligent Emergency Response Network</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="bg-sky-50 p-1.5 rounded-2xl border border-sky-200 grid grid-cols-3 gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setLoginTab('citizen');
              setErrorMessage(null);
              setIsRateLimited(false);
              setPortalNotice(null);
            }}
            className={`py-2 px-1.5 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
              loginTab === 'citizen'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Citizen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginTab('responder');
              setErrorMessage(null);
              setIsRateLimited(false);
              setPortalNotice(null);
            }}
            className={`py-2 px-1.5 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
              loginTab === 'responder'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100'
            }`}
          >
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Responder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginTab('authority');
              setErrorMessage(null);
              setIsRateLimited(false);
              setPortalNotice(null);
            }}
            className={`py-2 px-1.5 sm:px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition-all ${
              loginTab === 'authority'
                ? 'bg-sky-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Official</span>
          </button>
        </div>

        {/* Portal Notice Banner */}
        {portalNotice && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{portalNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate(portalNotice.targetPath)}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-xl transition-all"
            >
              <span>{portalNotice.buttonLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Rate Limit Banner */}
        {isRateLimited && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-amber-900">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="uppercase tracking-wider">Email Rate Limit Reached</span>
            </div>
            <p className="leading-relaxed">
              Supabase has temporarily reached its hourly email delivery limit (HTTP 429). If you already received a verification link earlier, please check your inbox and spam folder.
            </p>
            <p className="text-[11px] text-amber-800">
              Please wait a few minutes before requesting another verification email.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && !isRateLimited && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-red-700 block uppercase tracking-wider">Authentication Notice</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Unconfirmed Email Notice & Cooldown Resend Button */}
        {unconfirmedEmail && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-xs text-sky-900 space-y-2">
            <p className="font-medium">
              Need another verification email for <strong>{unconfirmedEmail}</strong>?
            </p>
            <button
              type="button"
              disabled={resending || cooldown > 0}
              onClick={handleResendConfirmation}
              className="inline-flex items-center space-x-1.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              {resending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : cooldown > 0 ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : 'Resend Confirmation Email'}
              </span>
            </button>
            {resendStatus && (
              <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold pt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{resendStatus}</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder={
                  loginTab === 'citizen'
                    ? 'citizen@example.com'
                    : loginTab === 'responder'
                    ? 'responder@resqnet.org'
                    : 'authority@resqnet.gov'
                }
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center space-x-2 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md transition-all disabled:opacity-50 ${
              loginTab === 'authority'
                ? 'bg-sky-700 hover:bg-sky-800'
                : loginTab === 'responder'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>
                  SIGN IN ({loginTab === 'citizen' ? 'CITIZEN' : loginTab === 'responder' ? 'RESPONDER' : 'OFFICIAL'})
                </span>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Need a new account?{' '}
          <Link to="/signup" className="font-bold text-sky-700 hover:underline">
            Register as Citizen
          </Link>
        </div>
      </div>
    </div>
  );
};
