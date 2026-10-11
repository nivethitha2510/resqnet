/**
 * Admin Layout
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, LogOut, UserCheck } from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-wider">ResQNet Admin</span>
              <span className="ml-2 text-xs px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-semibold">
                SYSTEM PORTAL
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <span>{profile?.full_name || user.email} (ADMIN)</span>
              </div>
            )}

            <button
              type="button"
              onClick={signOut}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded border border-slate-700 flex items-center space-x-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        {children}
      </main>
    </div>
  );
};
