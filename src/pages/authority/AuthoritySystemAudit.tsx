/**
 * System Audit Trail Page
 * Real Supabase PostgreSQL integration for system audit logs.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { realtimeService } from '../../services/realtimeService';
import { Loader2, AlertCircle, Radio } from 'lucide-react';

export const AuthoritySystemAudit: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'LIVE' | 'CONNECTING'>('CONNECTING');

  const fetchAuditLogs = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Could not load system audit logs from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();

    const { unsubscribe } = realtimeService.subscribeToOperationalChanges(
      'authority-system-audit-channel',
      ['audit_logs'],
      () => {
        setRealtimeStatus('LIVE');
        fetchAuditLogs();
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
        <p className="text-xs font-semibold text-slate-600">Retrieving system audit logs from Supabase PostgreSQL...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Action Audit Logs</h1>
          <p className="text-xs text-slate-500">Immutable operational history of user actions and state updates from PostgreSQL</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Realtime: {realtimeStatus}</span>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-900 text-white rounded-lg">
            Total Entries: {logs.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-x-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No audit log entries recorded in database yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                <th className="py-2.5 px-3">Log ID</th>
                <th className="py-2.5 px-3">User & Role</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target Entity</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{log.id.slice(0, 8)}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900">{log.user_id ? log.user_id.slice(0, 8) : 'System'}</span> ({log.user_role || 'system'})
                  </td>
                  <td className="py-3 px-3 font-bold text-red-600">{log.action}</td>
                  <td className="py-3 px-3">{log.target_entity} #{log.target_id ? log.target_id.slice(0, 8) : ''}</td>
                  <td className="py-3 px-3 text-slate-500">{new Date(log.created_at || log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
