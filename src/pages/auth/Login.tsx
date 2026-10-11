/**
 * Login Page
 * Real Supabase Authentication Sign In
 * Enforces strict role verification for Citizen & Authority portals.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ConfigError } from './ConfigError';
import { ShieldAlert, LogIn, AlertCircle, Loader2, Lock, Mail, User, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [loginTab, setLoginTab] = useState<'citizen' | 'authority'>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return <ConfigError />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(email, password);
      const actualRole = res.role;

      if (!actualRole) {
        setErrorMessage('Account role could not be verified in public.profiles database table.');
        return;
      }

      if (loginTab === 'authority') {
        if (actualRole === 'authority' || actualRole === 'admin') {
          navigate('/authority');
        } else {
          setErrorMessage(
            `ACCESS DENIED: Account '${email}' has role '${actualRole.toUpperCase()}' in PostgreSQL. It is not authorized for Authority Command Center access.`
          );
        }
      } else if (loginTab === 'citizen') {
        if (actualRole === 'citizen') {
          navigate('/citizen');
        } else if (actualRole === 'authority' || actualRole === 'responder' || actualRole === 'admin') {
          setErrorMessage(
            `This account is registered as '${actualRole.toUpperCase()}'. Please select the Authority Login tab.`
          );
        } else {
          setErrorMessage(`Unauthorized access for account role '${actualRole}'.`);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
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
        <div className="bg-sky-50 p-1.5 rounded-2xl border border-sky-200 grid grid-cols-2 gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setLoginTab('citizen');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
              loginTab === 'citizen'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Citizen Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginTab('authority');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
              loginTab === 'authority'
                ? 'bg-sky-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Authority Login</span>
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-red-700 block uppercase tracking-wider">Access Authorization Warning</span>
              <span>{errorMessage}</span>
            </div>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={loginTab === 'citizen' ? 'citizen@example.com' : 'authority@resqnet.gov'}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center space-x-2 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md transition-all disabled:opacity-50 ${
              loginTab === 'authority' ? 'bg-sky-700 hover:bg-sky-800' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>SIGN IN ({loginTab.toUpperCase()})</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Citizen?{' '}
          <Link to="/signup" className="font-bold text-sky-700 hover:underline">
            Register as Citizen
          </Link>
        </div>
      </div>
    </div>
  );
};
