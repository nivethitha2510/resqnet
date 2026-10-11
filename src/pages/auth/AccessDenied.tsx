/**
 * Access Denied Page
 * Rendered when an authenticated user attempts to access a route for a different role.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  const { role, user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 bg-red-950 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-800">
          <ShieldX className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-red-950 text-red-400 border border-red-800 rounded-full">
            403 Forbidden
          </span>
          <h1 className="text-2xl font-black text-white pt-2">Access Denied</h1>
          <p className="text-sm text-slate-400">
            Your account role (<strong className="text-white uppercase font-bold">{role || 'unverified'}</strong>) does not have permission to access this command center partition.
          </p>
        </div>

        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
          <p>Logged in as: <strong className="text-white">{user?.email}</strong></p>
          <p>Role Security Boundary enforced by PostgreSQL Row Level Security (RLS).</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            to={`/${role || 'login'}`}
            className="flex-1 inline-flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to My {(role || 'User').toUpperCase()} Portal</span>
          </Link>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-3 rounded-xl text-xs transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
