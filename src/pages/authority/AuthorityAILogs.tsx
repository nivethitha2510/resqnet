/**
 * AI Audit Logs Page
 * Real Supabase PostgreSQL integration for AI recommendation logs.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Bot, Loader2, AlertCircle, Radio } from 'lucide-react';
import { realtimeService } from '../../services/realtimeService';

export const AuthorityAILogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');

  const fetchAILogs = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('ai_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching AI audit logs:', err);
      setError(err.message || 'Could not load AI audit logs from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAILogs();

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-ai-logs-channel',
      ['ai_audit_logs'],
      () => {
        setRealtimeStatus('LIVE');
        fetchAILogs();
      }
    );
    setRealtimeStatus('LIVE');

    return () => {
      unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Retrieving AI audit logs from Supabase PostgreSQL...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI Decision Audit Trail</h1>
          <p className="text-xs text-slate-500">
            Human-in-the-Loop explainability logs for Gemini AI recommendations and officer actions from PostgreSQL
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-900 text-white rounded-lg">
            Total Logs: {logs.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No AI audit log entries recorded in database yet.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-sm text-slate-900">{log.ai_module || 'Gemini 3.5 Flash Lite'}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    {Math.round((log.confidence_score || 0.95) * 100)}% Confidence
                  </span>
                </div>
                <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-800">
                <span className="font-bold text-slate-900 block font-sans mb-1">Recommendation Output Payload:</span>
                <pre className="whitespace-pre-wrap">{JSON.stringify(log.recommendation || log.input_payload || {}, null, 2)}</pre>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-700">
                <span>
                  Authority Action:{' '}
                  <strong className="text-emerald-700 uppercase font-bold">{log.authority_action || 'approved'}</strong>
                </span>
                <span className="text-slate-500">{log.authority_notes || 'Report processed by Edge Function'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
