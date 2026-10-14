/**
 * My Reports Page
 * Retrieves citizen reports directly from Supabase PostgreSQL `emergency_reports` table.
 * Enforces RLS isolation for the authenticated user session.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ChevronRight, Clock, MapPin, Loader2, AlertCircle } from 'lucide-react';

interface DBReport {
  id: string;
  report_number: string;
  emergency_type: string;
  description: string;
  location_text: string;
  status: string;
  ai_summary: string | null;
  created_at: string;
}

export const MyReports: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<DBReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('emergency_reports')
        .select('id, report_number, emergency_type, description, location_text, status, ai_summary, created_at')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('Error fetching citizen reports:', fetchErr);
        throw new Error(`Failed to load reports: ${fetchErr.message}`);
      }

      setReports(data || []);
    } catch (err: any) {
      setError(err.message || 'Could not retrieve your reports from the database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyReports();
  }, [fetchMyReports, user]);


  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">My Emergency Reports</h1>
          <p className="text-xs sm:text-sm text-slate-600">Real-time database retrieval of your emergency submissions.</p>
        </div>
        <Link
          to="/citizen/report"
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          + New Report
        </Link>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Retrieving reports from Supabase PostgreSQL...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Database Error</span>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No emergency reports submitted yet.</p>
          <p className="text-xs text-slate-500">Your submitted reports will appear here in real time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-red-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-extrabold text-xs text-slate-900">
                    {rep.report_number || rep.id.slice(0, 8)}
                  </span>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded bg-red-100 text-red-700 uppercase">
                    {rep.emergency_type.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 uppercase">
                    {rep.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-xs text-slate-500 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(rep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-800">{rep.ai_summary || rep.description}</p>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  <span className="truncate max-w-xs">{rep.location_text}</span>
                </div>

                <Link
                  to={`/citizen/track/${rep.id}`}
                  className="inline-flex items-center space-x-1 font-bold text-red-600 hover:text-red-700"
                >
                  <span>Track Status</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
