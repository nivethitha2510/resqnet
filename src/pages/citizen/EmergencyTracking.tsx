/**
 * ResQNet - Real Citizen Emergency Live Tracking Page (Phase 3H)
 * Retrieves real operational progress from Supabase PostgreSQL database
 * and listens to live state changes via Supabase Realtime CDC WebSockets.
 * Enforces strict RLS report ownership and relationship security.
 */

import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshCw,
  ShieldCheck,
  XCircle,
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
    priority?: string;
    ai_summary: string | null;
    people_affected: number;
    people_injured: number;
    people_trapped: number;
    created_at: string;
    updated_at: string;
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
    authority_notes?: string | null;
    verified_by?: string | null;
    verified_at: string | null;
    resolved_at?: string | null;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING' | 'OFFLINE'>('CONNECTING');

  const fetchReportTrackingData = useCallback(async (reportIdentifier: string, isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
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

      // Determine linked incident ID directly or through incident_reports mapping
      let linkedIncidentId = rep.incident_id;
      if (!linkedIncidentId) {
        const { data: mapping } = await supabase
          .from('incident_reports')
          .select('incident_id')
          .eq('report_id', rep.id)
          .maybeSingle();
        if (mapping?.incident_id) {
          linkedIncidentId = mapping.incident_id;
        }
      }

      // 2. Fetch Linked Incident if present (RLS Enforced)
      if (linkedIncidentId) {
        const { data: incData } = await supabase
          .from('incidents')
          .select('*')
          .eq('id', linkedIncidentId)
          .maybeSingle();
        if (incData) inc = incData;

        // 3. Fetch Incident Resources (RLS Enforced)
        const { data: resData } = await supabase
          .from('incident_resources')
          .select('*')
          .eq('incident_id', linkedIncidentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (resData) assignedRes = resData;

        // 4. Fetch Assigned Vehicle (RLS Enforced)
        const { data: vehData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('assigned_incident_id', linkedIncidentId)
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

        // 5. Fetch Notifications for Incident & Report (RLS Enforced)
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .or(`incident_id.eq.${linkedIncidentId},report_id.eq.${rep.id}`)
          .order('created_at', { ascending: false });
        if (notifData) notifs = notifData;
      } else {
        // Fetch report-specific notifications if no incident yet
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('report_id', rep.id)
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
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchReportTrackingData(id, false);
    }
  }, [id, fetchReportTrackingData]);

  // Realtime Supabase CDC Subscription across all operational tables
  useEffect(() => {
    if (!id) return;

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      `citizen-tracking-${id}`,
      ['emergency_reports', 'incidents', 'incident_resources', 'vehicles', 'vehicle_status_history'],
      (payload) => {
        console.log('[Citizen Tracking Realtime Event]:', payload);
        fetchReportTrackingData(id, true);
      },
      undefined,
      (status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('LIVE');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('OFFLINE');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [id, fetchReportTrackingData]);

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
  const isRejected = report.status === 'rejected' || incident?.verification_status === 'rejected';
  const isAIAnalyzed = !!report.ai_summary || report.status !== 'submitted';
  const isVerified =
    report.status === 'verified' ||
    report.status === 'linked_to_incident' ||
    incident?.verification_status === 'approved' ||
    incident?.verification_status === 'modified' ||
    !!incident?.verified_at;

  const isResourceAssigned =
    assignedResource?.status === 'assigned' ||
    assignedResource?.status === 'dispatched' ||
    assignedVehicle?.status === 'assigned' ||
    assignedVehicle?.status === 'en_route' ||
    assignedVehicle?.status === 'on_scene';

  const isEnRoute =
    assignedVehicle?.status === 'en_route' ||
    assignedVehicle?.status === 'on_scene' ||
    incident?.status === 'en_route';

  const isOnScene =
    assignedVehicle?.status === 'on_scene' ||
    incident?.status === 'on_scene' ||
    incident?.status === 'in_progress';

  const isResolved =
    incident?.status === 'resolved' ||
    incident?.status === 'closed' ||
    report.status === 'resolved';

  const activePriority = (incident?.priority || report.priority || report.severity || 'medium').toUpperCase();

  const timelineSteps = [
    {
      key: 'received',
      label: 'Report Received',
      isDone: true,
      isCurrent: !isAIAnalyzed && !isRejected,
      timestamp: report.created_at,
      desc: 'Emergency report logged into Supabase PostgreSQL',
    },
    {
      key: 'ai_analyzed',
      label: 'AI Analyzed',
      isDone: isAIAnalyzed,
      isCurrent: isAIAnalyzed && !isVerified && !isRejected,
      timestamp: report.created_at,
      desc: 'Category & severity score generated by Gemini AI',
    },
    {
      key: 'verified',
      label: isRejected ? 'Report Rejected' : 'Authority Verified',
      isDone: isVerified || isRejected,
      isCurrent: (isVerified && !isResourceAssigned && !isResolved) || isRejected,
      timestamp: incident?.verified_at || (isVerified ? report.updated_at : null),
      desc: isRejected
        ? 'Report evaluated and rejected by Command Center'
        : isVerified
        ? incident?.verification_status === 'modified'
          ? `Verified by Authority (Operational Priority set to ${activePriority})`
          : 'Verified & approved by Authority Command Center'
        : 'Awaiting verification by Command Center',
    },
    {
      key: 'resource_assigned',
      label: 'Resource Assigned',
      isDone: isResourceAssigned,
      isCurrent: isResourceAssigned && !isEnRoute && !isResolved,
      timestamp: assignedResource?.created_at || (assignedVehicle ? assignedVehicle.updated_at : null),
      desc: assignedVehicle ? `Unit ${assignedVehicle.vehicle_code} (${assignedVehicle.name}) allocated` : 'Awaiting unit allocation',
    },
    {
      key: 'en_route',
      label: 'En Route',
      isDone: isEnRoute,
      isCurrent: isEnRoute && !isOnScene && !isResolved,
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
      timestamp: incident?.resolved_at || null,
      desc: isResolved ? 'Situation secured & emergency closed' : 'Response in progress',
    },
  ];

  const incidentCoords: LocationCoordinates = {
    latitude: Number(report.latitude) || 13.0827,
    longitude: Number(report.longitude) || 80.2707,
    address: report.location_text || 'Emergency Location',
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
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            type="button"
            onClick={() => id && fetchReportTrackingData(id, true)}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
            title="Refresh latest status from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-600' : 'text-slate-600'}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 hidden sm:inline">
            Report: {report.report_number || report.id.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Main Banner */}
      {isRejected ? (
        <div className="bg-red-50 border border-red-300 text-red-900 rounded-2xl p-6 shadow-sm text-center space-y-2">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black">EMERGENCY REPORT REJECTED</h2>
          <p className="text-xs text-red-700 max-w-lg mx-auto">
            {incident?.authority_notes ||
              'This emergency report was evaluated and marked as rejected by Authority Command Center (e.g. duplicate or false alarm).'}
          </p>
        </div>
      ) : isResolved ? (
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2.5 py-0.5 rounded bg-red-600 font-bold uppercase">
                {report.emergency_type.replace('_', ' ')} EMERGENCY
              </span>
              {incident?.code && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {incident.code}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">
                Operational Priority:{' '}
                <strong
                  className={`font-black uppercase ${
                    activePriority === 'CRITICAL'
                      ? 'text-red-400'
                      : activePriority === 'HIGH'
                      ? 'text-amber-400'
                      : 'text-blue-400'
                  }`}
                >
                  {activePriority}
                </strong>
              </span>

              {incident?.verification_status && (
                <span
                  className={`px-2 py-0.5 rounded font-extrabold uppercase text-[10px] ${
                    incident.verification_status === 'approved'
                      ? 'bg-emerald-600 text-white'
                      : incident.verification_status === 'modified'
                      ? 'bg-blue-600 text-white'
                      : incident.verification_status === 'rejected'
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {incident.verification_status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-black pt-1">
            {incident?.title || report.ai_summary || report.description}
          </h1>

          <p className="text-xs text-slate-300 flex items-center space-x-1">
            <Navigation className="w-3.5 h-3.5 text-red-500" />
            <span>{report.location_text}</span>
          </p>
        </div>
      )}

      {/* Authority Command Directive & Notes Banner (if provided by authority) */}
      {incident?.authority_notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm space-y-1.5 text-xs text-blue-900">
          <span className="font-bold flex items-center space-x-1.5 text-blue-950">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Authority Command Directives & Operational Notes</span>
          </span>
          <p className="text-blue-900 font-semibold bg-white p-3 rounded-xl border border-blue-100">
            {incident.authority_notes}
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
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${
                assignedVehicle.status === 'en_route'
                  ? 'bg-emerald-600 text-white'
                  : assignedVehicle.status === 'on_scene'
                  ? 'bg-blue-600 text-white'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
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
              Vehicle Type:{' '}
              <strong className="text-slate-900 uppercase font-bold">
                {assignedVehicle.type.replace('_', ' ')}
              </strong>
            </p>
            {vehicleCoords ? (
              <p className="text-emerald-700 font-medium">Location: {assignedVehicle.location_text}</p>
            ) : (
              <p className="text-slate-500 italic">Live vehicle base station: {assignedVehicle.location_text}</p>
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
          <span className="text-slate-500 font-mono">
            {report.latitude && report.longitude
              ? `Lat: ${Number(report.latitude).toFixed(4)}, Lng: ${Number(report.longitude).toFixed(4)}`
              : 'Coordinates Active'}
          </span>
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
                    <h4
                      className={`text-xs font-extrabold ${
                        isDone ? 'text-slate-900' : isCurrent ? 'text-red-600 font-black' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </h4>
                    {step.timestamp && (
                      <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
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
