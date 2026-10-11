/**
 * Responder Dashboard Page
 * Real Supabase PostgreSQL integration for emergency responder units.
 * Executes live status transitions (en_route -> on_scene -> in_progress -> resolved).
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { ModularMap } from '../../components/map/ModularMap';
import { Truck, MapPin, PhoneCall, Loader2, AlertCircle, Radio, CheckCircle2 } from 'lucide-react';
import type { IncidentStatus, VehicleStatus } from '../../types/domain';

export const ResponderDashboard: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [assignedIncident, setAssignedIncident] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');

  const fetchResponderData = async () => {
    try {
      // 1. Fetch available vehicles
      const { data: vehData, error: vehErr } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_code', { ascending: true });

      if (vehErr) throw new Error(vehErr.message);

      setVehicles(vehData || []);

      // Select active vehicle (first vehicle assigned or active, or fallback first unit)
      const currentVeh = selectedVehicle
        ? vehData?.find((v) => v.id === selectedVehicle.id) || vehData?.[0]
        : vehData?.find((v) => v.assigned_incident_id) || vehData?.[0];

      setSelectedVehicle(currentVeh || null);

      // 2. Fetch Assigned Incident if vehicle is allocated
      if (currentVeh?.assigned_incident_id) {
        const { data: incData } = await supabase
          .from('incidents')
          .select('*')
          .eq('id', currentVeh.assigned_incident_id)
          .single();

        setAssignedIncident(incData || null);
      } else {
        // Fallback: search for active incident requiring response
        const { data: activeInc } = await supabase
          .from('incidents')
          .select('*')
          .neq('status', 'resolved')
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setAssignedIncident(activeInc || null);
      }
    } catch (err: any) {
      console.error('Error fetching responder data:', err);
      setError(err.message || 'Could not load responder status from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResponderData();

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'responder-dashboard-channel',
      ['vehicles', 'incidents', 'incident_resources', 'vehicle_status_history'],
      () => {
        setRealtimeStatus('LIVE');
        fetchResponderData();
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, [selectedVehicle?.id]);

  const handleSetStatus = async (newVehStatus: VehicleStatus, newIncStatus: IncidentStatus) => {
    if (!selectedVehicle) return;
    setIsUpdating(true);
    setError(null);
    setStatusNotice(null);

    const timestamp = new Date().toISOString();
    const incId = assignedIncident?.id || selectedVehicle.assigned_incident_id;

    try {
      // 1. Update Vehicle Status
      const vehUpdate: any = {
        status: newVehStatus,
        updated_at: timestamp,
      };

      if (newVehStatus === 'available') {
        vehUpdate.assigned_incident_id = null;
      } else if (incId) {
        vehUpdate.assigned_incident_id = incId;
      }

      const { error: vErr } = await supabase
        .from('vehicles')
        .update(vehUpdate)
        .eq('id', selectedVehicle.id);

      if (vErr) throw new Error(`Vehicle update error: ${vErr.message}`);

      // 2. Update Incident Status if linked
      if (incId) {
        const incUpdate: any = {
          status: newIncStatus,
          updated_at: timestamp,
        };

        if (newIncStatus === 'resolved') {
          incUpdate.resolved_at = timestamp;

          // Also update linked emergency reports to 'resolved'
          await supabase
            .from('emergency_reports')
            .update({ status: 'resolved' })
            .eq('incident_id', incId);
        }

        const { error: iErr } = await supabase
          .from('incidents')
          .update(incUpdate)
          .eq('id', incId);

        if (iErr) console.warn('Incident update warning:', iErr.message);

        // 3. Log vehicle status history
        await supabase.from('vehicle_status_history').insert({
          vehicle_id: selectedVehicle.id,
          incident_id: incId,
          previous_status: selectedVehicle.status,
          new_status: newVehStatus,
          latitude: selectedVehicle.latitude || 0,
          longitude: selectedVehicle.longitude || 0,
          created_at: timestamp,
        });

        // 4. Log audit record
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
          user_id: user?.id || selectedVehicle.id,
          user_role: 'responder',
          action: 'RESPONDER_STATUS_TRANSITION',
          target_entity: 'incidents',
          target_id: incId,
          details: {
            vehicle_code: selectedVehicle.vehicle_code,
            previous_vehicle_status: selectedVehicle.status,
            new_vehicle_status: newVehStatus,
            new_incident_status: newIncStatus,
            timestamp,
          },
        });
      }

      setStatusNotice(
        `Tactical status transitioned to '${newVehStatus.toUpperCase()}' / Incident '${newIncStatus.toUpperCase()}'. Persisted to Supabase PostgreSQL.`
      );
      await fetchResponderData();
    } catch (err: any) {
      console.error('Responder status update failed:', err);
      setError(err.message || 'Failed to update tactical status.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-white space-y-3 max-w-3xl mx-auto">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-400">Loading responder unit parameters from Supabase...</p>
      </div>
    );
  }

  const mapIncidentCoords = assignedIncident
    ? {
        latitude: assignedIncident.latitude || 0,
        longitude: assignedIncident.longitude || 0,
        address: assignedIncident.location_text || 'Incident scene',
      }
    : { latitude: 12.9716, longitude: 77.5946, address: 'Command Center' };

  const mapVehicles = selectedVehicle
    ? [
        {
          id: selectedVehicle.id,
          vehicle_code: selectedVehicle.vehicle_code,
          name: selectedVehicle.name,
          type: selectedVehicle.type,
          status: selectedVehicle.status,
          current_location: {
            latitude: selectedVehicle.latitude || 0,
            longitude: selectedVehicle.longitude || 0,
            address: selectedVehicle.location_text || 'En route',
          },
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header Bar */}
      <div className="bg-slate-950 text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-red-500" />
            {vehicles.length > 1 ? (
              <select
                value={selectedVehicle?.id || ''}
                onChange={(e) => {
                  const found = vehicles.find((v) => v.id === e.target.value);
                  if (found) setSelectedVehicle(found);
                }}
                className="bg-slate-900 border border-slate-700 text-white font-mono font-black text-sm rounded-lg px-2 py-1"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_code} - {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono font-black text-lg text-emerald-400">
                {selectedVehicle?.vehicle_code || 'UNIT-01'}
              </span>
            )}
            <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800 uppercase">
              {String(selectedVehicle?.status || 'AVAILABLE').replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 pt-1">{selectedVehicle?.name || 'Emergency Responder Unit'}</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 text-emerald-400 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>

          <a
            href="tel:108"
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Dispatch Hotline</span>
          </a>
        </div>
      </div>

      {statusNotice && (
        <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-3.5 text-xs text-emerald-300 font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border border-red-800 rounded-xl p-4 flex items-start space-x-3 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {assignedIncident ? (
        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono font-bold text-red-400">{assignedIncident.code || assignedIncident.id.slice(0, 8)}</span>
              <h2 className="text-lg font-black text-white">{assignedIncident.title}</h2>
            </div>
            <span
              className={`px-3 py-1 text-xs font-black rounded uppercase ${
                assignedIncident.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {assignedIncident.priority} PRIORITY
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <p className="flex items-center space-x-1.5 text-slate-200 font-semibold">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <span>{assignedIncident.location_text}</span>
            </p>
            <p className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300">
              {assignedIncident.description}
            </p>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800">
            <ModularMap
              center={mapIncidentCoords}
              zoom={14}
              incidents={[
                {
                  id: assignedIncident.id,
                  code: assignedIncident.code,
                  title: assignedIncident.title,
                  emergency_type: assignedIncident.emergency_type,
                  priority: assignedIncident.priority,
                  status: assignedIncident.status,
                  location: mapIncidentCoords,
                },
              ] as any}
              vehicles={mapVehicles as any}
              height="250px"
            />
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                Update Tactical Status (Supabase Realtime CDC Sync)
              </span>
              {isUpdating && <Loader2 className="w-4 h-4 text-red-500 animate-spin" />}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleSetStatus('en_route', 'en_route')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold transition-all border ${
                  selectedVehicle?.status === 'en_route'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-300'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                EN ROUTE
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleSetStatus('on_scene', 'on_scene')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold transition-all border ${
                  selectedVehicle?.status === 'on_scene'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-300'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                ON SCENE
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleSetStatus('on_scene', 'in_progress')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold transition-all border ${
                  assignedIncident?.status === 'in_progress'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-300'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                IN PROGRESS
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleSetStatus('available', 'resolved')}
                className={`py-3 px-2 rounded-xl text-xs font-extrabold transition-all border ${
                  assignedIncident?.status === 'resolved'
                    ? 'bg-emerald-700 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                RESOLVED 🎉
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 p-8 rounded-2xl text-center space-y-2 text-slate-400 border border-slate-800">
          <Truck className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold">No active incident currently assigned to this unit.</p>
        </div>
      )}
    </div>
  );
};
