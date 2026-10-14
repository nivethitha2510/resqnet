/**
 * Operational Analytics & Metrics Page
 * Real Supabase PostgreSQL database analytics and aggregation.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, Loader2, TrendingUp } from 'lucide-react';

export const AuthorityAnalytics: React.FC = () => {
  const [reportCount, setReportCount] = useState(0);
  const [incidentCount, setIncidentCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [fleetCount, setFleetCount] = useState(0);
  const [activeVehiclesCount, setActiveVehiclesCount] = useState(0);
  const [typeDistribution, setTypeDistribution] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const [repRes, incRes, vehRes] = await Promise.all([
        supabase.from('emergency_reports').select('emergency_type, status'),
        supabase.from('incidents').select('status, emergency_type'),
        supabase.from('vehicles').select('status'),
      ]);

      const reports = repRes.data || [];
      const incidents = incRes.data || [];
      const vehicles = vehRes.data || [];

      setReportCount(reports.length);
      setIncidentCount(incidents.length);
      setResolvedCount(incidents.filter((i) => i.status === 'resolved' || i.status === 'closed').length);
      setFleetCount(vehicles.length);
      setActiveVehiclesCount(vehicles.filter((v) => ['assigned', 'en_route', 'on_scene'].includes(v.status)).length);

      // Category breakdown
      const counts: Record<string, number> = {};
      reports.forEach((r) => {
        const type = r.emergency_type || 'other';
        counts[type] = (counts[type] || 0) + 1;
      });
      setTypeDistribution(counts);
    } catch (err) {
      console.error('Error fetching analytics from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Calculating analytics from Supabase PostgreSQL...</p>
      </div>
    );
  }

  const resolutionRate = incidentCount > 0 ? Math.round((resolvedCount / incidentCount) * 100) : 100;
  const fleetUtilization = fleetCount > 0 ? Math.round((activeVehiclesCount / fleetCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Emergency Operations Analytics</h1>
          <p className="text-xs text-slate-500">
            Real metrics aggregated live from Supabase PostgreSQL database
          </p>
        </div>
        <div className="flex items-center space-x-1.5 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
          <BarChart3 className="w-4 h-4 text-red-500" />
          <span>Real-time DB Metrics</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1 border-l-4 border-l-indigo-600">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Reports</span>
          <p className="text-3xl font-black text-slate-900">{reportCount}</p>
          <p className="text-xs text-slate-500">Citizen submissions logged</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1 border-l-4 border-l-red-600">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Incidents</span>
          <p className="text-3xl font-black text-red-600">{incidentCount}</p>
          <p className="text-xs text-slate-500">Clustered Command Incidents</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1 border-l-4 border-l-emerald-600">
          <span className="text-xs font-bold text-slate-500 uppercase">Resolution Rate</span>
          <p className="text-3xl font-black text-emerald-600">{resolutionRate}%</p>
          <p className="text-xs text-slate-500">{resolvedCount} of {incidentCount} resolved</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1 border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-slate-500 uppercase">Fleet Deployment</span>
          <p className="text-3xl font-black text-amber-600">{fleetUtilization}%</p>
          <p className="text-xs text-slate-500">{activeVehiclesCount} of {fleetCount} units active</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-red-600" />
          <span>Emergency Category Distribution</span>
        </h2>

        {Object.keys(typeDistribution).length === 0 ? (
          <p className="text-xs text-slate-500 italic">No reports recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(typeDistribution).map(([type, count]) => (
              <div key={type} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
                <span className="text-xs font-bold text-slate-600 uppercase block">{type.replace('_', ' ')}</span>
                <p className="text-2xl font-black text-slate-900">{count}</p>
                <span className="text-[10px] text-slate-400">Reports filed</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
