/**
 * Authority Incidents Workspace Page (Phase 3C)
 * Queries real incidents from Supabase PostgreSQL `public.incidents`
 * and supporting reports linked via `public.incident_reports`.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { clusteringService } from '../../services/clusteringService';
import { priorityService } from '../../services/priorityService';
import { authorityService } from '../../services/authorityService';
import { vehicleAllocationService } from '../../services/vehicleAllocationService';
import type { IncidentAllocationSummary } from '../../services/vehicleAllocationService';
import { dispatchService } from '../../services/dispatchService';
import { realtimeService } from '../../services/realtimeService';
import { ModularMap } from '../../components/map/ModularMap';
import type { IncidentStatus, EmergencyType, PriorityLevel } from '../../types/domain';
import {
  AlertTriangle,
  CheckCircle2,
  Bot,
  Zap,
  RefreshCw,
  Loader2,
  AlertCircle,
  Layers,
  MapPin,
  Clock,
  ShieldCheck,
  Check,
  Edit3,
  XCircle,
  History,
  Truck,
  Radio,
  Send,
} from 'lucide-react';

interface DBIncident {
  id: string;
  code: string;
  title: string;
  description: string;
  emergency_type: EmergencyType;
  priority: PriorityLevel;
  system_priority?: PriorityLevel;
  verification_status?: 'pending_review' | 'approved' | 'modified' | 'rejected';
  authority_notes?: string;
  verified_by?: string;
  verified_at?: string;
  severity: string;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  location_text: string;
  affected_count: number;
  trapped_count: number;
  injured_count: number;
  vulnerable_count: number;
  cluster_id: string | null;
  clustering_reason: string | null;
  priority_reasons: string[] | null;
  created_at: string;
}

interface DBReport {
  id: string;
  report_number: string;
  emergency_type: string;
  description: string;
  location_text: string;
  people_affected: number;
  people_injured: number;
  people_trapped: number;
  created_at: string;
  ai_summary: string | null;
}

export const AuthorityIncidents: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState<DBIncident[]>([]);
  const [supportingReports, setSupportingReports] = useState<DBReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClustering, setIsClustering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clusterNotice, setClusterNotice] = useState<string | null>(null);

  const selectedId = searchParams.get('id');
  const currentIncident = incidents.find((i) => i.id === selectedId) || incidents[0];

  const [activeTab, setActiveTab] = useState<'overview' | 'clustering' | 'verification' | 'allocation'>('overview');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [allocationSummary, setAllocationSummary] = useState<IncidentAllocationSummary | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING' | 'OFFLINE'>('CONNECTING');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedModifyPriority, setSelectedModifyPriority] = useState<PriorityLevel>('high');
  const [authorityReasonInput, setAuthorityReasonInput] = useState('');

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (currentIncident?.id) {
      fetchSupportingReports(currentIncident.id);
      fetchAuditLogs(currentIncident.id);
      fetchAllocations(currentIncident.id);
    }
  }, [currentIncident?.id]);

  // Realtime Supabase Subscription Effect
  useEffect(() => {
    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-incidents-channel',
      ['vehicles', 'incidents', 'incident_resources', 'vehicle_status_history'],
      (payload) => {
        console.log('[Supabase Realtime Payload Received]:', payload);
        setRealtimeStatus('LIVE');
        fetchIncidents();
        if (currentIncident?.id) {
          fetchAllocations(currentIncident.id);
          fetchAuditLogs(currentIncident.id);
        }
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, [currentIncident?.id]);

  const fetchAllocations = async (incidentId: string) => {
    try {
      const summary = await vehicleAllocationService.getIncidentRecommendationsFromDB(incidentId);
      setAllocationSummary(summary);
    } catch (err) {
      console.error('Error fetching vehicle allocations:', err);
    }
  };

  const handleAllocateVehicle = async (vehicleId: string) => {
    if (!currentIncident?.id) return;
    setIsAllocating(true);
    setError(null);
    setClusterNotice(null);
    try {
      const res = await vehicleAllocationService.allocateResource(currentIncident.id, vehicleId);
      setClusterNotice(`Resource ${res.vehicle_code} ALLOCATED to Incident ${currentIncident.code}. Persisted to PostgreSQL.`);
      await fetchAllocations(currentIncident.id);
      await fetchAuditLogs(currentIncident.id);
    } catch (err: any) {
      console.error('Allocation Error:', err);
      setError(err.message || 'Vehicle allocation failed.');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleDispatchVehicle = async (vehicleId: string) => {
    if (!currentIncident?.id) return;
    setIsDispatching(true);
    setError(null);
    setClusterNotice(null);
    try {
      const res = await dispatchService.dispatchResource(currentIncident.id, vehicleId);
      setClusterNotice(`DISPATCH CONFIRMED: Unit ${res.vehicle_code} transitioned to EN ROUTE for Incident ${currentIncident.code}. Persisted to PostgreSQL.`);
      await fetchIncidents();
      await fetchAllocations(currentIncident.id);
      await fetchAuditLogs(currentIncident.id);
    } catch (err: any) {
      console.error('Dispatch Error:', err);
      setError(err.message || 'Vehicle dispatch failed.');
    } finally {
      setIsDispatching(false);
    }
  };

  const fetchAuditLogs = async (incidentId: string) => {
    try {
      const logs = await authorityService.getIncidentAuditHistory(incidentId);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const handleApprove = async () => {
    if (!currentIncident?.id) return;
    setIsVerifying(true);
    setClusterNotice(null);
    setError(null);
    try {
      await authorityService.approveRecommendation(currentIncident.id);
      setClusterNotice(`Incident ${currentIncident.code} APPROVED by Authority. Persisted to PostgreSQL.`);
      await fetchIncidents();
      fetchAuditLogs(currentIncident.id);
    } catch (err: any) {
      console.error('Approval Error:', err);
      setError(err.message || 'Failed to approve incident.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleModifySubmit = async () => {
    if (!currentIncident?.id) return;
    if (!authorityReasonInput.trim()) {
      setError('Modification reason is required.');
      return;
    }
    setIsVerifying(true);
    setClusterNotice(null);
    setError(null);
    try {
      await authorityService.modifyPriority(currentIncident.id, selectedModifyPriority, authorityReasonInput);
      setClusterNotice(`Incident ${currentIncident.code} operational priority MODIFIED to ${selectedModifyPriority.toUpperCase()}. Persisted to PostgreSQL.`);
      setShowModifyModal(false);
      setAuthorityReasonInput('');
      await fetchIncidents();
      fetchAuditLogs(currentIncident.id);
    } catch (err: any) {
      console.error('Modification Error:', err);
      setError(err.message || 'Failed to modify incident priority.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!currentIncident?.id) return;
    if (!authorityReasonInput.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setIsVerifying(true);
    setClusterNotice(null);
    setError(null);
    try {
      await authorityService.rejectRecommendation(currentIncident.id, authorityReasonInput);
      setClusterNotice(`Incident ${currentIncident.code} REJECTED by Authority. Persisted to PostgreSQL.`);
      setShowRejectModal(false);
      setAuthorityReasonInput('');
      await fetchIncidents();
      fetchAuditLogs(currentIncident.id);
    } catch (err: any) {
      console.error('Rejection Error:', err);
      setError(err.message || 'Failed to reject incident.');
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchIncidents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      setIncidents(data || []);
    } catch (err: any) {
      console.error('Error fetching incidents:', err);
      setError(err.message || 'Could not load incidents from Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupportingReports = async (incidentId: string) => {
    try {
      const { data, error: repErr } = await supabase
        .from('emergency_reports')
        .select('id, report_number, emergency_type, description, location_text, people_affected, people_injured, people_trapped, created_at, ai_summary')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true });

      if (repErr) {
        console.error('Error fetching supporting reports:', repErr);
        return;
      }

      setSupportingReports(data || []);
    } catch (err) {
      console.error('Error in fetchSupportingReports:', err);
    }
  };

  const handleRunClustering = async () => {
    setIsClustering(true);
    setClusterNotice(null);
    setError(null);

    try {
      const result = await clusteringService.runClustering();
      setClusterNotice(
        `Clustering complete: Processed ${result.processedReports} report(s), Created ${result.createdIncidents} new incident(s), Linked ${result.linkedReports} report(s).`
      );
      setIncidents(result.incidents as DBIncident[]);
    } catch (err: any) {
      console.error('Clustering error:', err);
      setError(err.message || 'Incident clustering failed.');
    } finally {
      setIsClustering(false);
    }
  };

  const handleRecalculatePriorities = async () => {
    setIsClustering(true);
    setClusterNotice(null);
    setError(null);

    try {
      const result = await priorityService.reevaluateAllActiveIncidents();
      setClusterNotice(
        `Priority Engine complete: Evaluated ${result.evaluated} active incident(s). Priorities persisted to PostgreSQL.`
      );
      await fetchIncidents();
    } catch (err: any) {
      console.error('Priority engine error:', err);
      setError(err.message || 'Priority calculation failed.');
    } finally {
      setIsClustering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Retrieving incidents from Supabase PostgreSQL...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Incident Command Center</h1>
          <p className="text-xs text-slate-600">Real-time incident clustering & priority engine from Supabase database.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleRecalculatePriorities}
            disabled={isClustering}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition-all flex items-center space-x-2"
          >
            <Zap className="w-4 h-4 text-white" />
            <span>Recalculate Priorities</span>
          </button>

          <button
            type="button"
            onClick={handleRunClustering}
            disabled={isClustering}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center space-x-2"
          >
            {isClustering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4 text-red-500" />
                <span>Run Incident Clustering</span>
              </>
            )}
          </button>
        </div>
      </div>

      {clusterNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{clusterNotice}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Command Error</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!currentIncident ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No active incidents found in database.</p>
          <p className="text-xs text-slate-500">Click "Run Incident Clustering" above to group unlinked emergency reports into incidents.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <span className="font-mono font-black text-xl text-red-500">{currentIncident.code}</span>
                <span
                  className={`px-3 py-0.5 text-xs font-bold rounded uppercase ${
                    currentIncident.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                  }`}
                >
                  {currentIncident.priority} Priority
                </span>
                <span className="px-3 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 uppercase">
                  STATUS: {currentIncident.status}
                </span>
              </div>
              <h2 className="text-xl font-bold pt-1">{currentIncident.title}</h2>
              <p className="text-xs text-slate-400">{currentIncident.location_text}</p>
            </div>

            <button
              type="button"
              onClick={fetchIncidents}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl border border-slate-700 transition-colors"
              title="Refresh Incidents"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex border-b border-slate-200 space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`pb-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'overview' ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Overview & Supporting Reports ({supportingReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('clustering')}
                  className={`pb-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'clustering' ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Clustering & AI Rationale
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('verification')}
                  className={`pb-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'verification' ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Authority Audit ({auditLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('allocation')}
                  className={`pb-2.5 text-xs font-bold transition-colors flex items-center space-x-1 ${
                    activeTab === 'allocation' ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Resource Allocation (Phase 3F)</span>
                </button>
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Authority Verification & Human-in-the-Loop Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-slate-900">Authority Verification & Human-in-the-Loop</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        currentIncident.verification_status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        currentIncident.verification_status === 'modified' ? 'bg-blue-100 text-blue-800' :
                        currentIncident.verification_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        Verification: {currentIncident.verification_status || 'pending_review'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-semibold text-slate-500 block">System Recommended Priority</span>
                        <span className="font-mono font-bold text-slate-900 text-sm uppercase">
                          {currentIncident.system_priority || currentIncident.priority}
                        </span>
                      </div>
                      <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 space-y-1">
                        <span className="font-semibold text-indigo-700 block">Authority Verified Operational Priority</span>
                        <span className="font-mono font-bold text-indigo-950 text-sm uppercase">
                          {currentIncident.priority}
                        </span>
                      </div>
                    </div>

                    {currentIncident.authority_notes && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                        <span className="font-bold text-slate-900 block">Authority Note:</span>
                        <p>{currentIncident.authority_notes}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={isVerifying}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span>APPROVE RECOMMENDATION</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowModifyModal(true); setShowRejectModal(false); setError(null); }}
                        disabled={isVerifying}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>MODIFY PRIORITY</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowRejectModal(true); setShowModifyModal(false); setError(null); }}
                        disabled={isVerifying}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>REJECT</span>
                      </button>
                    </div>

                    {showModifyModal && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-3 text-xs">
                        <span className="font-bold text-blue-900 block">Modify Incident Operational Priority</span>
                        <div className="flex items-center space-x-3">
                          <label className="font-semibold text-slate-700">New Operational Priority:</label>
                          <select
                            value={selectedModifyPriority}
                            onChange={(e) => setSelectedModifyPriority(e.target.value as PriorityLevel)}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold"
                          >
                            <option value="critical">CRITICAL</option>
                            <option value="high">HIGH</option>
                            <option value="medium">MEDIUM</option>
                            <option value="low">LOW</option>
                          </select>
                        </div>
                        <textarea
                          placeholder="Mandatory justification reason for priority modification..."
                          value={authorityReasonInput}
                          onChange={(e) => setAuthorityReasonInput(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                          rows={2}
                        />
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={handleModifySubmit}
                            disabled={isVerifying}
                            className="bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg"
                          >
                            Submit Modification
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowModifyModal(false)}
                            className="bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {showRejectModal && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-3 text-xs">
                        <span className="font-bold text-red-900 block">Reject Recommendation / Incident Assessment</span>
                        <textarea
                          placeholder="Mandatory rejection reason (e.g. false report, duplicate, resolved)..."
                          value={authorityReasonInput}
                          onChange={(e) => setAuthorityReasonInput(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                          rows={2}
                        />
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={handleRejectSubmit}
                            disabled={isVerifying}
                            className="bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg"
                          >
                            Confirm Rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRejectModal(false)}
                            className="bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Incident Description & Aggregated Impact</span>
                    </h3>
                    <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 font-medium">
                      {currentIncident.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-500 block">Affected</span>
                        <span className="text-lg font-black text-slate-900">{currentIncident.affected_count}</span>
                      </div>
                      <div className="bg-red-50 p-3 rounded-xl border border-red-200">
                        <span className="text-xs text-red-700 block">Trapped</span>
                        <span className="text-lg font-black text-red-700">{currentIncident.trapped_count}</span>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                        <span className="text-xs text-amber-800 block">Injured</span>
                        <span className="text-lg font-black text-amber-800">{currentIncident.injured_count}</span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                        <span className="text-xs text-purple-800 block">Vulnerable</span>
                        <span className="text-lg font-black text-purple-900">{currentIncident.vulnerable_count}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">Grouped Citizen Reports ({supportingReports.length})</h3>
                    {supportingReports.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No linked citizen reports found for this incident ID.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {supportingReports.map((rep) => (
                          <div key={rep.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900">{rep.report_number || rep.id.slice(0, 8)}</span>
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(rep.created_at).toLocaleTimeString()}</span>
                              </span>
                            </div>
                            <p className="text-slate-800 font-medium">{rep.ai_summary || rep.description}</p>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 pt-1">
                              <MapPin className="w-3 h-3 text-red-600" />
                              <span>{rep.location_text}</span>
                              <span>• Affected: {rep.people_affected}</span>
                              <span>• Injured: {rep.people_injured}</span>
                              <span>• Trapped: {rep.people_trapped}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                    <span className="text-xs font-bold text-slate-900 block">Incident Location Map</span>
                    <ModularMap
                      center={{ latitude: currentIncident.latitude, longitude: currentIncident.longitude, address: currentIncident.location_text }}
                      zoom={14}
                      selectedLocationPin={{ latitude: currentIncident.latitude, longitude: currentIncident.longitude, address: currentIncident.location_text }}
                      height="280px"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'clustering' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-red-600" />
                    <h3 className="text-sm font-bold text-slate-900">Explainable AI Rationale & Clustering Rules</h3>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-900 block">Geospatial & Signal Rationale</span>
                    <p className="text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                      {currentIncident.clustering_reason || 'Geospatial radius & time proximity clustering.'}
                    </p>
                  </div>

                  {currentIncident.priority_reasons && currentIncident.priority_reasons.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-900 block">Priority Reasons</span>
                      <ul className="space-y-2">
                        {currentIncident.priority_reasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start space-x-2 bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-800 font-semibold">
                            <Zap className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'verification' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">Immutable Audit History (`public.audit_logs`)</h3>
                  </div>

                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
                      No authority verification audit records recorded yet for this incident.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-950 uppercase">{log.action}</span>
                            <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-700 text-[11px]">Actor Role: <span className="font-bold text-slate-900">{log.user_role}</span> | User ID: {log.user_id}</p>
                          <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-800 font-mono">
                            {JSON.stringify(log.details, null, 2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'allocation' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Truck className="w-5 h-5 text-red-600" />
                      <h3 className="text-sm font-bold text-slate-900">Vehicle Allocation & Dispatch Engine (Phase 3G)</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
                        <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        <span>Realtime: {realtimeStatus}</span>
                      </div>
                      <span className="text-xs font-semibold bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-200">
                        Operational Priority: {currentIncident.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {!allocationSummary ? (
                    <div className="flex items-center space-x-2 text-xs text-slate-500 italic p-4">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span>Calculating vehicle suitability recommendations...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allocationSummary.recommendations.map((rec, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-600"></span>
                              <span>Required Capability: {rec.capability.replace('_', ' ')}</span>
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase ${
                              rec.status === 'recommended' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {rec.status.replace('_', ' ')}
                            </span>
                          </div>

                          {rec.status === 'no_suitable_resource' ? (
                            <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-800 flex items-start space-x-2 font-medium">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <span>{rec.message}</span>
                            </div>
                          ) : rec.vehicle ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-black text-slate-900 text-sm">{rec.vehicle.vehicle_code}</span>
                                    <span className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                      Suitability Score: {rec.vehicle.suitability_score}/100
                                    </span>
                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                                      rec.vehicle.status === 'en_route' ? 'bg-emerald-600 text-white' :
                                      rec.vehicle.status === 'assigned' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-800'
                                    }`}>
                                      Status: {rec.vehicle.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-sm">{rec.vehicle.name}</h4>
                                  <p className="text-xs text-slate-500">
                                    Distance: {rec.vehicle.distance_km !== null ? `${rec.vehicle.distance_km} km` : 'N/A'}
                                    {rec.vehicle.estimated_eta_minutes && ` (ETA ~${rec.vehicle.estimated_eta_minutes} mins)`}
                                  </p>
                                </div>

                                {rec.vehicle.status === 'available' && (
                                  <button
                                    type="button"
                                    onClick={() => handleAllocateVehicle(rec.vehicle!.id)}
                                    disabled={isAllocating}
                                    className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                                  >
                                    {isAllocating ? 'Allocating...' : 'ALLOCATE RESOURCE'}
                                  </button>
                                )}

                                {rec.vehicle.status === 'assigned' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDispatchVehicle(rec.vehicle!.id)}
                                    disabled={isDispatching}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isDispatching ? 'Dispatching...' : 'DISPATCH RESOURCE'}</span>
                                  </button>
                                )}

                                {rec.vehicle.status === 'en_route' && (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs px-3 py-1.5 rounded-xl flex items-center space-x-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>DISPATCHED — EN ROUTE</span>
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-600 block">Suitability Rationale:</span>
                                <div className="flex flex-wrap gap-1">
                                  {rec.vehicle.match_reasons.map((reason, rIdx) => (
                                    <span key={rIdx} className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Active Incidents ({incidents.length})</h3>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">PostgreSQL</span>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {incidents.map((inc) => {
                  const active = inc.id === currentIncident.id;
                  return (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => setSearchParams({ id: inc.id })}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                        active
                          ? 'bg-red-600 text-white border-red-600 font-bold shadow-md'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{inc.code}</span>
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-bold">{inc.priority}</span>
                      </div>
                      <p className="truncate mt-1 font-semibold">{inc.title}</p>
                      <p className="text-[10px] opacity-80 truncate">{inc.location_text}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
