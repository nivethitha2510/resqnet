/**
 * Authority Vehicle Fleet Management Page
 * Real Supabase PostgreSQL integration for emergency fleet vehicles.
 * Enforces proper vehicle lifecycle (Allocation -> Dispatch -> Responder Operations).
 * Disallows arbitrary manual operational status overrides.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { MapPin, Phone, Loader2, AlertCircle, Radio, Truck, Lock } from 'lucide-react';
import type { VehicleStatus } from '../../types/domain';

export const AuthorityVehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_code', { ascending: true });

      if (fetchErr) throw new Error(fetchErr.message);
      setVehicles(data || []);
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
      setError(err.message || 'Could not load vehicle fleet from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-vehicles-channel',
      ['vehicles'],
      () => {
        setRealtimeStatus('LIVE');
        fetchVehicles();
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleMaintenance = async (vehicleId: string, currentStatus: VehicleStatus) => {
    if (['assigned', 'en_route', 'on_scene'].includes(currentStatus)) {
      setError('Active operational vehicles assigned to emergency incidents cannot be placed in maintenance directly.');
      return;
    }

    const newStatus: VehicleStatus = currentStatus === 'maintenance' ? 'available' : 'maintenance';

    setUpdatingId(vehicleId);
    setError(null);
    setActionNotice(null);
    try {
      const timestamp = new Date().toISOString();
      const updatePayload: any = {
        status: newStatus,
        updated_at: timestamp,
      };

      if (newStatus === 'available') {
        updatePayload.assigned_incident_id = null;
      }

      const { error: updateErr } = await supabase
        .from('vehicles')
        .update(updatePayload)
        .eq('id', vehicleId);

      if (updateErr) throw new Error(updateErr.message);

      setActionNotice(`Vehicle status updated to '${newStatus.toUpperCase()}' in PostgreSQL.`);
      await fetchVehicles();
    } catch (err: any) {
      console.error('Error updating vehicle status:', err);
      setError(err.message || 'Failed to update vehicle status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Retrieving emergency fleet from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fleet Management</h1>
          <p className="text-xs text-slate-500">Emergency response vehicles & operational status from PostgreSQL</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-900 text-white rounded-lg">
            Fleet Size: {vehicles.length} Units
          </span>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium">
          {actionNotice}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.length === 0 ? (
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No emergency vehicles registered in PostgreSQL database.
          </div>
        ) : (
          vehicles.map((veh) => {
            const isOperationalActive = ['assigned', 'en_route', 'on_scene'].includes(veh.status);
            return (
              <div key={veh.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-red-600" />
                    <span className="font-mono font-extrabold text-slate-900 text-sm">{veh.vehicle_code}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase ${
                        veh.status === 'en_route'
                          ? 'bg-emerald-100 text-emerald-800'
                          : veh.status === 'on_scene'
                          ? 'bg-amber-100 text-amber-800'
                          : veh.status === 'assigned'
                          ? 'bg-indigo-100 text-indigo-800'
                          : veh.status === 'available'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {String(veh.status).replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{veh.station_name || 'Central Command'}</span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{veh.name}</h3>
                <p className="text-xs text-slate-600 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{veh.location_text || 'Station base'}</span>
                </p>

                {Array.isArray(veh.equipment_list) && veh.equipment_list.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-slate-700">Equipped Assets:</span>
                    <div className="flex flex-wrap gap-1">
                      {veh.equipment_list.map((eq: string, idx: number) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{veh.contact_number || 'Hotline 108'}</span>
                  </span>

                  <div className="flex items-center space-x-2">
                    {updatingId === veh.id && <Loader2 className="w-4 h-4 animate-spin text-red-600" />}

                    {isOperationalActive ? (
                      <span className="text-[11px] text-slate-500 font-semibold bg-slate-50 px-2.5 py-1 rounded border border-slate-200 flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Managed via Operations</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === veh.id}
                        onClick={() => handleToggleMaintenance(veh.id, veh.status)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1 rounded border border-slate-300 text-xs transition-colors disabled:opacity-50"
                      >
                        {veh.status === 'maintenance' ? 'Set: Available' : 'Set: Maintenance'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
