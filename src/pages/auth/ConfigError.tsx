/**
 * Configuration Error Page
 * Rendered when Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing or invalid.
 */

import React from 'react';
import { missingEnvVariables } from '../../lib/supabase';
import { AlertOctagon, Terminal } from 'lucide-react';

export const ConfigError: React.FC = () => {
  const missingVars = missingEnvVariables();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-950 border border-red-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3 text-red-500">
          <div className="bg-red-950 p-3 rounded-2xl border border-red-800">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Supabase Connection Required</h1>
            <p className="text-xs text-red-300 font-semibold">Environment variables unconfigured</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          ResQNet Phase 2 mandates a real Supabase database and authentication connection. Fake backends and localStorage databases are strictly forbidden.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
            <Terminal className="w-4 h-4" />
            <span>Missing Environment Variables:</span>
          </div>

          <ul className="space-y-1 text-xs font-mono">
            {missingVars.map((v) => (
              <li key={v} className="bg-red-950/60 border border-red-800/60 text-red-300 px-3 py-1.5 rounded-lg flex items-center justify-between">
                <span>{v}</span>
                <span className="text-[10px] uppercase tracking-wider text-red-400 font-sans font-bold">REQUIRED</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 text-xs text-slate-400 border-t border-slate-800 pt-4">
          <p className="font-semibold text-slate-200">To configure your local environment:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Create a <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded">.env</code> file in project root.</li>
            <li>Add your Supabase project URL and anon public key:</li>
          </ol>
          <pre className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
      </div>
    </div>
  );
};
