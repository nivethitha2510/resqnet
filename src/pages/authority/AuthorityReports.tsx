/**
 * Authority Reports Management Page
 * Real Supabase PostgreSQL integration for raw citizen emergency reports.
 * Uses deduplicating clusteringService to prevent duplicate incident creation.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { clusteringService } from '../../services/clusteringService';
import { authorityService } from '../../services/authorityService';
import {
  XCircle,
  Loader2,
  AlertCircle,
  Radio,
  MapPin,
  Clock,
  Bot,
  Layers,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
} from 'lucide-react';

export const AuthorityReports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('emergency_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);
      setReports(data || []);
    } catch (err: any) {
      console.error('Error fetching emergency reports:', err);
      setError(err.message || 'Could not load reports from database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-reports-channel',
      ['emergency_reports', 'incidents'],
      () => {
        fetchReports();
      },
      undefined,
      (status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('LIVE');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('CONNECTING');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [fetchReports]);

  const handleApproveReport = useCallback(async (report: any) => {
    setIsProcessing(report.id);
    setError(null);
    setActionNotice(null);

    try {
      let incidentId = report.incident_id;

      // 1. If not yet linked to incident, cluster report into a unified incident
      if (!incidentId) {
        const inc = await clusteringService.clusterReport(report.id);
        if (inc) {
          incidentId = inc.id;
        }
      }

      // 2. Approve incident in Supabase PostgreSQL via Authority verification service
      if (incidentId) {
        await authorityService.approveRecommendation(incidentId);
      }

      // 3. Mark report as verified in public.emergency_reports
      const { error: repUpdateErr } = await supabase
        .from('emergency_reports')
        .update({
          status: 'verified',
          incident_id: incidentId || report.incident_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      if (repUpdateErr) {
        throw new Error(`Failed to update report status: ${repUpdateErr.message}`);
      }

      setActionNotice(
        `Report #${report.report_number || report.id.slice(0, 8)} APPROVED & VERIFIED in Supabase database.`
      );
      await fetchReports();
    } catch (err: any) {
      console.error('Error approving report:', err);
      setError(err.message || 'Failed to approve report.');
    } finally {
      setIsProcessing(null);
    }
  }, [fetchReports]);

  const handleClusterReport = useCallback(async (reportId: string, existingIncidentId?: string | null) => {
    if (existingIncidentId) {
      navigate(`/authority/incidents?id=${existingIncidentId}`);
      return;
    }

    setIsProcessing(reportId);
    setError(null);
    setActionNotice(null);
    try {
      const inc = await clusteringService.clusterReport(reportId);
      if (inc) {
        setActionNotice(`Report safely clustered into Incident ${inc.code}. Persisted to Supabase PostgreSQL.`);
        navigate(`/authority/incidents?id=${inc.id}`);
      } else {
        setActionNotice(`Clustering complete. Report evaluated against existing incidents.`);
        await fetchReports();
      }
    } catch (err: any) {
      console.error('Error clustering report:', err);
      setError(err.message || 'Failed to cluster report into incident.');
    } finally {
      setIsProcessing(null);
    }
  }, [navigate, fetchReports]);

  const handleRejectReport = useCallback(async (reportId: string, existingIncidentId?: string | null) => {
    setIsProcessing(reportId);
    setError(null);
    setActionNotice(null);
    try {
      const { error: updateErr } = await supabase
        .from('emergency_reports')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', reportId);

      if (updateErr) throw new Error(updateErr.message);

      if (existingIncidentId) {
        await authorityService.rejectRecommendation(existingIncidentId, 'Report rejected by authority officer.');
      }

      setActionNotice(`Report #${reportId.slice(0, 8)} REJECTED in database.`);
      await fetchReports();
    } catch (err: any) {
      console.error('Error rejecting report:', err);
      setError(err.message || 'Failed to reject report.');
    } finally {
      setIsProcessing(null);
    }
  }, [fetchReports]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Retrieving emergency reports from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Citizen Emergency Reports</h1>
          <p className="text-xs text-slate-500">Incoming citizen reports & Gemini AI analysis queue in PostgreSQL</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-900 text-white rounded-lg">
            Total Reports: {reports.length}
          </span>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No emergency reports recorded in PostgreSQL yet.
          </div>
        ) : (
          reports.map((rep) => (
            <div
              key={rep.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {rep.report_number || rep.id.slice(0, 8)}
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-red-100 text-red-700 uppercase">
                    {(rep.emergency_type || 'other').replace('_', ' ')}
                  </span>
                  {rep.severity && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800 uppercase">
                      Severity: {rep.severity}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2.5 py-1 font-bold rounded ${
                      rep.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : rep.status === 'linked_to_incident' || rep.incident_id
                        ? 'bg-blue-100 text-blue-800'
                        : rep.status === 'rejected'
                        ? 'bg-slate-200 text-slate-600 line-through'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    STATUS: {rep.status === 'verified' ? 'VERIFIED' : rep.incident_id ? 'LINKED TO INCIDENT' : String(rep.status).toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(rep.created_at).toLocaleString()}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-2 space-y-2">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                      <Bot className="w-4 h-4 text-red-600" />
                      <span>Gemini AI Summary & Report Details</span>
                    </span>
                    <p className="text-sm font-semibold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {rep.ai_summary || rep.description || 'No description provided'}
                    </p>
                  </div>

                  {rep.voice_transcript && (
                    <div className="text-slate-600 italic bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                      <span className="font-bold text-slate-800 not-italic">Voice Transcript:</span> "{rep.voice_transcript}"
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 block">Extracted Impact Metrics</span>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>Affected: <strong className="text-slate-900">{rep.people_affected || 0}</strong></div>
                    <div>Trapped: <strong className="text-red-600">{rep.people_trapped || 0}</strong></div>
                    <div>Injured: <strong className="text-amber-600">{rep.people_injured || 0}</strong></div>
                    <div>Vulnerable: <strong className="text-purple-600">{rep.vulnerable_people || 0}</strong></div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-slate-600 flex items-start space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <span>{rep.location_text || 'Location unavailable'}</span>
                  </div>
                </div>
              </div>

              {rep.status !== 'rejected' && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleRejectReport(rep.id, rep.incident_id)}
                    disabled={isProcessing === rep.id}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Report</span>
                  </button>

                  {rep.status !== 'verified' && (
                    <button
                      type="button"
                      onClick={() => handleApproveReport(rep)}
                      disabled={isProcessing === rep.id}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50"
                    >
                      {isProcessing === rep.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Approve & Verify</span>
                    </button>
                  )}

                  {rep.incident_id ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/authority/incidents?id=${rep.incident_id}`)}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg shadow-sm transition-all"
                      title="Open incident workspace for this report"
                    >
                      <Eye className="w-4 h-4 text-red-500" />
                      <span>View Incident</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClusterReport(rep.id, rep.incident_id)}
                      disabled={isProcessing === rep.id}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50"
                    >
                      {isProcessing === rep.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                      <span>Run Incident Clustering</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
