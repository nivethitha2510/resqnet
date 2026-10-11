/**
 * Citizen Experience Layout
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, PlusCircle, ListOrdered, LogOut, User } from 'lucide-react';

export const CitizenLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-sky-50/40 text-slate-900 flex flex-col font-sans">
      <header className="bg-white text-slate-900 shadow-sm border-b border-sky-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link to="/citizen" className="flex items-center space-x-2.5 group">
            <div className="bg-red-600 p-2 rounded-lg text-white font-bold shadow-sm group-hover:bg-red-700 transition-colors">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-lg tracking-wider text-slate-900">ResQNet</span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-semibold border border-sky-200">
                Citizen Portal
              </span>
            </div>
          </Link>

          {/* User Account & Logout */}
          <div className="flex items-center space-x-3 text-xs">
            {user && (
              <div className="hidden sm:flex items-center space-x-1.5 text-slate-700 font-medium">
                <User className="w-3.5 h-3.5 text-red-600" />
                <span className="truncate max-w-[140px] font-semibold">{profile?.full_name || user.email}</span>
                <span className="px-1.5 py-0.5 bg-sky-100 text-[10px] uppercase font-bold text-sky-800 rounded border border-sky-200">
                  {profile?.role || 'citizen'}
                </span>
              </div>
            )}

            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1 font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 h-16">
          <Link
            to="/citizen"
            className={`flex flex-col items-center justify-center space-y-1 ${
              isActive('/citizen') ? 'text-red-600 font-semibold border-t-2 border-red-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-xs">Emergency</span>
          </Link>

          <Link
            to="/citizen/report"
            className={`flex flex-col items-center justify-center space-y-1 ${
              isActive('/citizen/report') ? 'text-red-600 font-semibold border-t-2 border-red-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-5 h-5 text-red-600" />
            <span className="text-xs font-bold text-red-600">Report</span>
          </Link>

          <Link
            to="/citizen/reports"
            className={`flex flex-col items-center justify-center space-y-1 ${
              isActive('/citizen/reports') || location.pathname.startsWith('/citizen/track')
                ? 'text-red-600 font-semibold border-t-2 border-red-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-xs">My Reports</span>
          </Link>
        </div>
      </nav>
    </div>
  );
};
