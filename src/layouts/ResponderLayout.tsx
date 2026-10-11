/**
 * Responder Tactical Field Layout
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Truck, LogOut, UserCheck } from 'lucide-react';

export const ResponderLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vehicles } = useApp();
  const { user, profile, signOut } = useAuth();
  const assignedUnit = vehicles.find((v) => v.id === 'VEH-FIRE-01') || vehicles[0];

  return (
    <div className="min-h-screen bg-sky-50/40 text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-sky-100 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 tracking-wider">UNIT: {assignedUnit?.vehicle_code}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold uppercase">
                  {assignedUnit?.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{assignedUnit?.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user && (
              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-700 font-semibold">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>{profile?.full_name || user.email}</span>
              </div>
            )}

            <button
              type="button"
              onClick={signOut}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
};
