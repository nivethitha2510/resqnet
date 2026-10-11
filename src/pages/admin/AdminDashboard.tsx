/**
 * Admin Dashboard Page
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Database, Cpu, Mic, Activity } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { reports, incidents, vehicles, auditLogs } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">System Administration & Configuration</h1>
        <p className="text-xs text-slate-400">Platform architecture readiness, service status, and environment audit</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Database Ready</span>
            <Database className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">PostgreSQL / Supabase</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              SCHEMA READY
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Gemini AI Boundary</span>
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Server Proxy</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              SECURE LAYER
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Web Speech API</span>
            <Mic className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">ta-IN / en-US / hi-IN</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              ACTIVE
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Map Provider</span>
            <Activity className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Leaflet + OSM</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              MODULAR
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Data Store Diagnostics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-300">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span>Total Reports Logged</span>
            <p className="text-xl font-bold text-white mt-1">{reports.length}</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span>Total Incidents Managed</span>
            <p className="text-xl font-bold text-white mt-1">{incidents.length}</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span>Fleet Vehicles Registered</span>
            <p className="text-xl font-bold text-white mt-1">{vehicles.length}</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <span>Audit Trail Entries</span>
            <p className="text-xl font-bold text-white mt-1">{auditLogs.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
