/**
 * Signup Page
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ConfigError } from './ConfigError';
import { ShieldAlert, UserPlus, AlertCircle, Loader2, Lock, Mail, User, Globe, CheckCircle2 } from 'lucide-react';
import type { LanguageCode } from '../../types/domain';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('en-US');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return <ConfigError />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName || !email || !password) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName, language);
      setSuccessMessage('Citizen profile registered successfully! Redirecting...');
      setTimeout(() => {
        navigate('/citizen');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          Public signups automatically create a verified <strong className="text-slate-900">Citizen Profile</strong>. Command Center & Dispatcher access requires administrative authorization.
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Anand Kumar"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Preferred Language</label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              >
                <option value="en-US">English (US)</option>
                <option value="ta-IN">தமிழ் (TN)</option>
                <option value="hi-IN">हिन्दी (IN)</option>
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

        <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-sky-700 hover:underline">
            Sign In to Existing Account
          </Link>
        </div>
      </div>
    </div>
  );
};
