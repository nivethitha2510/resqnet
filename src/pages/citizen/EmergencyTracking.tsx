/**
 * ResQNet - Real Citizen Emergency Live Tracking Page (Phase 3H)
 * Retrieves real operational progress from Supabase PostgreSQL database
 * and listens to live state changes via Supabase Realtime CDC WebSockets.
 * Enforces strict RLS report ownership and relationship security.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { ModularMap } from '../../components/map/ModularMap';
import type { LocationCoordinates } from '../../types/domain';
import {
  CheckCircle2,
  ArrowLeft,
  Navigation,
  Loader2,
  AlertCircle,
  Radio,
  Clock,
  Truck,
  Bell,
} from 'lucide-react';

interface TrackingData {
  report: {
    id: string;
    report_number: string;
    emergency_type: string;
    description: string;
    location_text: string;
    latitude: number;
    longitude: number;
    status: string;
    severity: string;
    ai_summary: string | null;
    people_affected: number;
    people_injured: number;
    people_trapped: number;
    created_at: string;
    incident_id: string | null;
  };
  incident: {
    id: string;
    code: string;
    title: string;
    description: string;
    emergency_type: string;
    priority: string;
    status: string;
    verification_status: string;
    verified_at: string | null;
    created_at: string;
  } | null;
  assignedResource: {
    id: string;
    resource_type: string;
    status: string;
    created_at: string;
  } | null;
  assignedVehicle: {
    id: string;
    vehicle_code: string;
    name: string;
    type: string;
    status: string;
    latitude: number;
    longitude: number;
    location_text: string;
    updated_at: string;
  } | null;
  statusHistory: Array<{
    id: string;
    previous_status: string;
    new_status: string;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    created_at: string;
  }>;
}

export const EmergencyTracking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING' | 'OFFLINE'>('CONNECTING');

  useEffect(() => {
    if (id) {
      fetchReportTrackingData(id);
    }
  }, [id]);

  // Realtime Supabase CDC Subscription
  useEffect(() => {
    if (!id) return;

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      `citizen-tracking-${id}`,
      ['vehicles', 'incidents', 'incident_resources', 'vehicle_status_history'],
      (payload) => {
        console.log('[Citizen Tracking Realtime Event]:', payload);
        setRealtimeStatus('LIVE');
        fetchReportTrackingData(id);
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, [id]);

  const fetchReportTrackingData = async (reportIdentifier: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Report (RLS Enforced: Citizen reads only own report)
      let { data: rep, error: repErr } = await supabase
        .from('emergency_reports')
        .select('*')
        .eq('id', reportIdentifier)
        .maybeSingle();

      if (!rep && !repErr) {
        const { data: numRep, error: numErr } = await supabase
          .from('emergency_reports')
          .select('*')
          .eq('report_number', reportIdentifier)
          .maybeSingle();
        rep = numRep;
        repErr = numErr;
      }

      if (repErr) throw new Error(repErr.message);
      if (!rep) throw new Error('Report not found or permission denied.');

      let inc: TrackingData['incident'] = null;
      let assignedRes: TrackingData['assignedResource'] = null;
      let assignedVeh: TrackingData['assignedVehicle'] = null;
      let history: TrackingData['statusHistory'] = [];
      let notifs: TrackingData['notifications'] = [];

      // 2. Fetch Linked Incident if present (RLS Enforced)
      if (rep.incident_id) {
        const { data: incData } = await supabase
          .from('incidents')
          .select('*')
          .eq('id', rep.incident_id)
          .single();
        if (incData) inc = incData;

        // 3. Fetch Incident Resources (RLS Enforced)
        const { data: resData } = await supabase
          .from('incident_resources')
          .select('*')
          .eq('incident_id', rep.incident_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (resData) assignedRes = resData;

        // 4. Fetch Assigned Vehicle (RLS Enforced)
        const { data: vehData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('assigned_incident_id', rep.incident_id)
          .maybeSingle();
        if (vehData) {
          assignedVeh = vehData;
          // Fetch vehicle status history
          const { data: histData } = await supabase
            .from('vehicle_status_history')
            .select('*')
            .eq('vehicle_id', vehData.id)
            .order('created_at', { ascending: true });
          if (histData) history = histData;
        }

        // 5. Fetch Notifications for Incident (RLS Enforced)
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('incident_id', rep.incident_id)
          .order('created_at', { ascending: false });
        if (notifData) notifs = notifData;
      }

      setData({
        report: rep,
        incident: inc,
        assignedResource: assignedRes,
        assignedVehicle: assignedVeh,
        statusHistory: history,
        notifications: notifs,
      });
    } catch (err: any) {
      console.error('Error loading citizen report tracking:', err);
      setError(err.message || 'Could not load report tracking details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pt-8 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-12 space-y-3">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Retrieving live tracking status from Supabase...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pt-4">
        <Link to="/citizen/reports" className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Reports</span>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-bold">Tracking Record Unavailable</h2>
            <p className="text-xs">{error || 'Unable to locate report record.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { report, incident, assignedResource, assignedVehicle, notifications } = data;

  // Real Status Mapping Calculations
  const isAIAnalyzed = !!report.ai_summary || report.status !== 'submitted';
  const isVerified = incident?.verification_status === 'approved' || incident?.verification_status === 'modified' || !!incident?.verified_at;
  const isResourceAssigned = assignedResource?.status === 'assigned' || assignedResource?.status === 'dispatched' || assignedVehicle?.status === 'assigned' || assignedVehicle?.status === 'en_route' || assignedVehicle?.status === 'on_scene';
  const isEnRoute = assignedVehicle?.status === 'en_route' || assignedVehicle?.status === 'on_scene' || incident?.status === 'en_route';
  const isOnScene = assignedVehicle?.status === 'on_scene' || incident?.status === 'on_scene' || incident?.status === 'in_progress';
  const isResolved = incident?.status === 'resolved' || incident?.status === 'closed' || report.status === 'resolved';

  const timelineSteps = [
    {
      key: 'received',
      label: 'Report Received',
      isDone: true,
      isCurrent: !isAIAnalyzed,
      timestamp: report.created_at,
      desc: 'Emergency report logged into Supabase PostgreSQL',
    },
    {
      key: 'ai_analyzed',
      label: 'AI Analyzed',
      isDone: isAIAnalyzed,
      isCurrent: isAIAnalyzed && !isVerified,
      timestamp: report.created_at,
      desc: 'Category & severity score generated by Gemini AI',
    },
    {
      key: 'verified',
      label: 'Authority Verified',
      isDone: isVerified,
      isCurrent: isVerified && !isResourceAssigned,
      timestamp: incident?.verified_at || null,
      desc: isVerified ? 'Verified by Authority Command Center' : 'Awaiting verification by Command Center',
    },
    {
      key: 'resource_assigned',
      label: 'Resource Assigned',
      isDone: isResourceAssigned,
      isCurrent: isResourceAssigned && !isEnRoute,
      timestamp: assignedResource?.created_at || null,
      desc: assignedVehicle ? `Unit ${assignedVehicle.vehicle_code} (${assignedVehicle.name}) allocated` : 'Awaiting unit allocation',
    },
    {
      key: 'en_route',
      label: 'En Route',
      isDone: isEnRoute,
      isCurrent: isEnRoute && !isOnScene,
      timestamp: assignedVehicle?.updated_at || null,
      desc: isEnRoute ? `Unit ${assignedVehicle?.vehicle_code || ''} traveling to scene` : 'Awaiting dispatch',
    },
    {
      key: 'on_scene',
      label: 'On Scene',
      isDone: isOnScene,
      isCurrent: isOnScene && !isResolved,
      timestamp: null,
      desc: isOnScene ? 'First responders active at location' : 'Awaiting arrival at location',
    },
    {
      key: 'resolved',
      label: 'Emergency Resolved 🎉',
      isDone: isResolved,
      isCurrent: isResolved,
      timestamp: null,
      desc: isResolved ? 'Situation secured & emergency closed' : 'Response in progress',
    },
  ];

  const incidentCoords: LocationCoordinates = {
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.location_text,
  };

  const vehicleCoords: LocationCoordinates | undefined =
    assignedVehicle && assignedVehicle.latitude && assignedVehicle.longitude && assignedVehicle.latitude !== 0
      ? {
          latitude: assignedVehicle.latitude,
          longitude: assignedVehicle.longitude,
          address: assignedVehicle.location_text || `Unit ${assignedVehicle.vehicle_code}`,
        }
      : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link to="/citizen/reports" className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Reports</span>
        </Link>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Supabase Realtime: {realtimeStatus}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">Report: {report.report_number || report.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Main Banner */}
      {isResolved ? (
        <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-md text-center space-y-3">
          <div className="w-14 h-14 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">EMERGENCY RESOLVED SUCCESSFULLY 🎉</h2>
          <p className="text-sm text-emerald-100 max-w-lg mx-auto">
            Response teams have completed on-scene operations. Situation secured and closed by Authority Command.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs px-2.5 py-0.5 rounded bg-red-600 font-bold uppercase">{report.emergency_type.replace('_', ' ')} EMERGENCY</span>
            <span className="text-xs text-slate-400">Severity: <strong className="text-amber-400 uppercase font-black">{report.severity}</strong></span>
          </div>
          <h1 className="text-lg sm:text-xl font-black pt-1">{report.ai_summary || report.description}</h1>
          <p className="text-xs text-slate-300 flex items-center space-x-1">
            <Navigation className="w-3.5 h-3.5 text-red-500" />
            <span>{report.location_text}</span>
          </p>
        </div>
      )}

      {/* Assigned Vehicle / Response Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900">Assigned Operational Resource</h3>
          </div>
          {assignedVehicle ? (
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${
              assignedVehicle.status === 'en_route' ? 'bg-emerald-600 text-white' :
              assignedVehicle.status === 'on_scene' ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {assignedVehicle.status.replace('_', ' ')}
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-slate-100 text-slate-600">
              Pending Allocation
            </span>
          )}
        </div>

        {assignedVehicle ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-black text-slate-900 text-sm">{assignedVehicle.vehicle_code}</span>
              <span className="text-slate-500 font-semibold">{assignedVehicle.name}</span>
            </div>
            <p className="text-slate-600">
              Vehicle Type: <strong className="text-slate-900 uppercase font-bold">{assignedVehicle.type.replace('_', ' ')}</strong>
            </p>
            {vehicleCoords ? (
              <p className="text-emerald-700 font-medium">Location: {assignedVehicle.location_text}</p>
            ) : (
              <p className="text-slate-500 italic">Live vehicle location unavailable</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
            Authority Command Center is evaluating nearby emergency units for allocation.
          </p>
        )}
      </div>

      {/* Map View */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
          <span className="flex items-center space-x-1">
            <Navigation className="w-4 h-4 text-emerald-600" />
            <span>Emergency Location Map</span>
          </span>
          <span className="text-slate-500 font-mono">Lat: {report.latitude.toFixed(4)}, Lng: {report.longitude.toFixed(4)}</span>
        </div>
        <ModularMap
          center={incidentCoords}
          zoom={14}
          selectedLocationPin={incidentCoords}
          height="280px"
        />
      </div>

      {/* Operational Notifications */}
      {notifications.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Bell className="w-4 h-4 text-red-600" />
            <span>Operational Updates ({notifications.length})</span>
          </h3>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{n.title}</span>
                  <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
                <p className="text-slate-700">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Real Database Emergency Progress Timeline</h3>

        <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
          {timelineSteps.map((step, idx) => {
            const isDone = step.isDone;
            const isCurrent = step.isCurrent;
            return (
              <div key={idx} className="relative pl-6">
                <div
                  className={`absolute -left-2.5 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-600 text-white font-bold'
                      : isCurrent
                      ? 'bg-red-600 border-red-600 text-white font-bold animate-pulse'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isDone ? '✓' : ''}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <h4 className={`text-xs font-extrabold ${isDone ? 'text-slate-900' : isCurrent ? 'text-red-600 font-black' : 'text-slate-400'}`}>
                      {step.label}
                    </h4>
                    {step.timestamp && (
                      <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
