/**
 * AI Analysis Preview Page
 * Renders real AI backend analysis returned by Supabase Edge Function `analyze-emergency`.
 * Enforces Citizen Confirmation Rule prior to committing report to Supabase DB.
 * Duplicate submission protection & real database ID generation.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { EmergencyReport, EmergencyType, PriorityLevel } from '../../types/domain';
import {
  Bot,
  Users,
  UserX,
  HeartPulse,
  Baby,
  MapPin,
  CheckCircle2,
  Edit3,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const AIAnalysisPreview: React.FC = () => {
  const navigate = useNavigate();
  const routeState = useLocation().state || {};
  const { addReport } = useApp();
  const { user } = useAuth();

  const initialAnalysis = routeState.aiAnalysis || {};

  const [emergencyType] = useState<EmergencyType>(
    routeState.emergencyType || initialAnalysis.emergency_type || 'fire'
  );
  const [summary, setSummary] = useState<string>(
    initialAnalysis.summary || routeState.rawText || routeState.voiceTranscript || 'Emergency reported'
  );
  const [affectedCount, setAffectedCount] = useState<number>(initialAnalysis.affected_people_count || 1);
  const [trappedCount, setTrappedCount] = useState<number>(initialAnalysis.trapped_people_count || 0);
  const [injuredCount, setInjuredCount] = useState<number>(initialAnalysis.injured_people_count || 0);
  const [vulnerableCount, setVulnerableCount] = useState<number>(initialAnalysis.vulnerable_people_count || 0);
  const [priority] = useState<PriorityLevel>(initialAnalysis.calculated_priority || 'high');

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirmReport = async () => {
    if (isSubmitting) return; // Prevent duplicate click submission

    setIsSubmitting(true);
    setSubmitError(null);

    const reportNum = `REP-${Date.now()}`;
    const location = routeState.location || { latitude: 13.0827, longitude: 80.2707, address: 'Anna Salai, Chennai' };

    try {
      // Real Supabase PostgreSQL emergency_reports INSERT using authenticated user id
      const { data: dbReport, error: dbErr } = await supabase
        .from('emergency_reports')
        .insert({
          report_number: reportNum,
          citizen_id: user?.id || null,
          emergency_type: emergencyType,
          description: routeState.rawText || summary,
          voice_transcript: routeState.voiceTranscript || null,
          input_language: routeState.language || 'en-US',
          people_affected: affectedCount,
          people_injured: injuredCount,
          people_trapped: trappedCount,
          vulnerable_people: vulnerableCount,
          latitude: location.latitude,
          longitude: location.longitude,
          location_text: location.address,
          severity: priority,
          priority: priority,
          status: 'ai_analyzed',
          ai_summary: summary,
          ai_confidence: initialAnalysis.confidence_score || 0.85,
        })
        .select()
        .single();

      if (dbErr) {
        console.error('Database report submission error:', dbErr);
        throw new Error(`Failed to submit report to database: ${dbErr.message}`);
      }

      if (!dbReport || !dbReport.id) {
        throw new Error('Database did not return a valid report record.');
      }

      // Construct domain report object using actual database ID and report_number
      const newReport: EmergencyReport = {
        id: dbReport.id,
        report_number: dbReport.report_number,
        citizen_name: user?.user_metadata?.full_name || 'Citizen Reporter',
        citizen_phone: user?.email || '+91 Contact',
        emergency_type: dbReport.emergency_type,
        raw_text: dbReport.description,
        voice_transcript: dbReport.voice_transcript,
        input_language: dbReport.input_language,
        location: {
          latitude: dbReport.latitude,
          longitude: dbReport.longitude,
          address: dbReport.location_text,
        },
        status: dbReport.status,
        ai_summary: dbReport.ai_summary,
        affected_people_count: dbReport.people_affected,
        trapped_people_count: dbReport.people_trapped,
        injured_people_count: dbReport.people_injured,
        vulnerable_people_count: dbReport.vulnerable_people,
        calculated_priority: dbReport.priority,
        ai_confidence_score: dbReport.ai_confidence,
        evidence_snippets: initialAnalysis.evidence_snippets || [summary],
        created_at: dbReport.created_at,
        updated_at: dbReport.updated_at,
      };

      addReport(newReport);
      navigate('/citizen/report/confirm', { state: { report: newReport } });
    } catch (err: any) {
      console.error('Submission error:', err);
      setSubmitError(err.message || 'Could not submit emergency report. Please check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-sky-900 text-white rounded-2xl p-5 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 p-2.5 rounded-xl text-white shadow-sm">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Analysis & Verification</h1>
            <p className="text-xs text-sky-100">
              Review extracted structured data before final submission to dispatch control.
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-xs text-sky-200 font-medium">AI Confidence Score</span>
          <p className="text-lg font-black text-emerald-400">
            {Math.round((initialAnalysis.confidence_score || 0.85) * 100)}%
          </p>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Submission Error</span>
            <p>{submitError}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <span>Extracted Emergency Insights</span>
          </h2>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center space-x-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Done Editing' : 'Edit Details'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">Emergency Priority</label>
            <span
              className={`inline-block px-3 py-1 text-xs font-extrabold rounded-lg uppercase ${
                priority === 'critical'
                  ? 'bg-red-600 text-white'
                  : priority === 'high'
                  ? 'bg-amber-500 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {priority} Priority
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">Category</label>
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg uppercase">
              {emergencyType.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">AI Situation Summary</label>
          {isEditing ? (
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500"
            />
          ) : (
            <p className="text-sm bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-900 font-medium">
              {summary}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Total Affected</span>
            </div>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={affectedCount}
                onChange={(e) => setAffectedCount(Number(e.target.value))}
                className="w-full text-sm p-1 border rounded"
              />
            ) : (
              <p className="text-xl font-black text-slate-900">{affectedCount}</p>
            )}
          </div>

          <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-red-700">
              <UserX className="w-4 h-4 text-red-600" />
              <span>Trapped Victims</span>
            </div>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={trappedCount}
                onChange={(e) => setTrappedCount(Number(e.target.value))}
                className="w-full text-sm p-1 border rounded"
              />
            ) : (
              <p className="text-xl font-black text-red-700">{trappedCount}</p>
            )}
          </div>

          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-800">
              <HeartPulse className="w-4 h-4 text-amber-600" />
              <span>Injured Victims</span>
            </div>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={injuredCount}
                onChange={(e) => setInjuredCount(Number(e.target.value))}
                className="w-full text-sm p-1 border rounded"
              />
            ) : (
              <p className="text-xl font-black text-amber-800">{injuredCount}</p>
            )}
          </div>

          <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-purple-800">
              <Baby className="w-4 h-4 text-purple-600" />
              <span>Vulnerable</span>
            </div>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={vulnerableCount}
                onChange={(e) => setVulnerableCount(Number(e.target.value))}
                className="w-full text-sm p-1 border rounded"
              />
            ) : (
              <p className="text-xl font-black text-purple-900">{vulnerableCount}</p>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
          <span className="font-bold text-slate-900 flex items-center space-x-1">
            <MapPin className="w-4 h-4 text-red-600" />
            <span>Target Location Coordinates</span>
          </span>
          <p className="text-slate-700 font-medium">
            {routeState.location?.address || 'Anna Salai, Chennai'} (Lat: {routeState.location?.latitude?.toFixed(4)}, Lng: {routeState.location?.longitude?.toFixed(4)})
          </p>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleConfirmReport}
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-base py-4 rounded-2xl shadow-lg transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>SUBMITTING TO DATABASE...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6" />
              <span>CONFIRM & DISPATCH EMERGENCY REPORT</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
