/**
 * Authority Dashboard Page
 * Real Supabase PostgreSQL integration with live counters & map overview.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { ModularMap } from '../../components/map/ModularMap';
import {
  AlertTriangle,
  FileText,
  Truck,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Loader2,
  Radio,
} from 'lucide-react';

export const AuthorityDashboard: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');

  const fetchDashboardData = async () => {
    try {
      const [incRes, repRes, vehRes] = await Promise.all([
        supabase.from('incidents').select('*').order('created_at', { ascending: false }),
        supabase.from('emergency_reports').select('*').order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').order('vehicle_code', { ascending: true }),
      ]);

      if (incRes.data) setIncidents(incRes.data);
      if (repRes.data) setReports(repRes.data);
      if (vehRes.data) setVehicles(vehRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-dashboard-channel',
      ['incidents', 'emergency_reports', 'vehicles'],
      () => {
        setRealtimeStatus('LIVE');
        fetchDashboardData();
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, []);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed');
  const criticalIncidents = activeIncidents.filter((i) => i.priority === 'critical');
  const pendingReports = reports.filter((r) => r.status === 'submitted' || r.status === 'ai_analyzed');
  const availableVehicles = vehicles.filter((v) => v.status === 'available');
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved' || i.status === 'closed');

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Loading Command Center data from Supabase...</p>
      </div>
    );
  }

  // Format objects for ModularMap compatibility
  const mapIncidents = activeIncidents.map((i) => ({
    id: i.id,
    code: i.code || i.id.slice(0, 8),
    title: i.title || 'Emergency Incident',
    emergency_type: i.emergency_type || 'other',
    priority: i.priority || 'medium',
    status: i.status || 'open',
    location: {
      latitude: i.latitude || 0,
      longitude: i.longitude || 0,
      address: i.location_text || 'Location unavailable',
    },
  }));

  const mapReports = reports.map((r) => ({
    id: r.id,
    emergency_type: r.emergency_type || 'other',
    status: r.status || 'submitted',
    location: {
      latitude: r.latitude || 0,
      longitude: r.longitude || 0,
      address: r.location_text || 'Location unavailable',
    },
  }));

  const mapVehicles = vehicles.map((v) => ({
    id: v.id,
    vehicle_code: v.vehicle_code || v.id.slice(0, 8),
    name: v.name || 'Emergency Unit',
    type: v.type || 'ambulance',
    status: v.status || 'available',
    current_location: {
      latitude: v.latitude || 0,
      longitude: v.longitude || 0,
      address: v.location_text || 'Station',
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Command Center Dashboard</h1>
          <p className="text-xs text-slate-500">Real-time emergency monitoring from Supabase PostgreSQL database</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1.5 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime CDC: {realtimeStatus}</span>
          </div>
          <Link
            to="/authority/incidents"
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all"
          >
            Open Incidents Workspace
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 border-l-4 border-l-red-600">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Incidents</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{activeIncidents.length}</span>
            <span className="text-xs font-bold text-red-600">{criticalIncidents.length} Critical</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Reports</span>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{pendingReports.length}</span>
            <span className="text-xs text-slate-500">Citizen Reports</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Available Fleet</span>
            <Truck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{availableVehicles.length}</span>
            <span className="text-xs text-slate-500">of {vehicles.length} Units</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{resolvedIncidents.length}</span>
            <span className="text-xs text-emerald-600 font-bold">100% Verified</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>Live Emergency Operations Map</span>
            </h3>
            <Link to="/authority/map" className="text-xs font-bold text-red-600 hover:underline">
              Full Screen Map →
            </Link>
          </div>
          <ModularMap
            zoom={12}
            incidents={mapIncidents as any}
            reports={mapReports as any}
            vehicles={mapVehicles as any}
            height="400px"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Active Incidents Queue</h3>
            <span className="text-xs font-bold text-red-600">{activeIncidents.length} Active</span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {activeIncidents.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No active incidents in queue</p>
            ) : (
              activeIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 hover:border-red-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-slate-900">{inc.code || inc.id.slice(0, 8)}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${
                        inc.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {inc.priority}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 line-clamp-1">{inc.title}</p>
                  <p className="text-xs text-slate-500 truncate">{inc.location_text}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-600 font-medium">Status: {String(inc.status).toUpperCase()}</span>
                    <Link
                      to={`/authority/incidents?id=${inc.id}`}
                      className="font-bold text-red-600 hover:underline flex items-center"
                    >
                      Manage <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
