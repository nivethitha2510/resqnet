/**
 * Operational Analytics & Metrics Page
 */

import React from 'react';

export const AuthorityAnalytics: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Emergency Operations Analytics</h1>
        <p className="text-xs text-slate-500">Response time metrics, emergency distribution & clustering accuracy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Avg Response Time</span>
          <p className="text-2xl font-black text-emerald-600">6.4 Mins</p>
          <p className="text-xs text-slate-500">From Report to Unit Arrival</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">AI Extraction Precision</span>
          <p className="text-2xl font-black text-indigo-600">94.2%</p>
          <p className="text-xs text-slate-500">Verified by Command Officers</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Clustering Reduction</span>
          <p className="text-2xl font-black text-blue-600">68%</p>
          <p className="text-xs text-slate-500">Duplicate Report Deduplication</p>
        </div>
      </div>
    </div>
  );
};
