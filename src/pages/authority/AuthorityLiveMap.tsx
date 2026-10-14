/**
 * Authority Live Operations Map Page
 * Real Supabase PostgreSQL integration with live CDC updates.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { ModularMap } from '../../components/map/ModularMap';
import { Radio, RefreshCw, Loader2 } from 'lucide-react';

export const AuthorityLiveMap: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');

  const fetchLiveMapData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

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
      console.error('Error fetching live map data from Supabase:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveMapData(false);

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-live-map-channel',
      ['incidents', 'emergency_reports', 'vehicles'],
      () => {
        setRealtimeStatus('LIVE');
        fetchLiveMapData(true);
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, []);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed');

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
      address: v.location_text || 'Base Station',
    },
  }));

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Loading live operations map from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tactical Operations Live Map</h1>
          <p className="text-xs text-slate-500">
            Real-time geospatial tracking across incidents, citizen reports & response fleet from Supabase
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => fetchLiveMapData(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Refresh Live Map"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-600' : ''}`} />
          </button>
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg">Incidents: {activeIncidents.length}</span>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg">Reports: {reports.length}</span>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg">Fleet Units: {vehicles.length}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <ModularMap
          zoom={12}
          incidents={mapIncidents as any}
          reports={mapReports as any}
          vehicles={mapVehicles as any}
          height="620px"
        />
      </div>
    </div>
  );
};
