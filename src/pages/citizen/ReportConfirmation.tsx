/**
 * Report Confirmation Page
 * Renders real database-generated report ID & report number from Supabase INSERT response.
 */

import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Navigation, ArrowRight, ShieldCheck } from 'lucide-react';

export const ReportConfirmation: React.FC = () => {
  const routeState = useLocation().state || {};
  const report = routeState.report;

  if (!report) {
    return (
      <div className="max-w-xl mx-auto space-y-6 pt-4 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
          <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">No Report Data Found</h1>
          <p className="text-xs text-slate-600">Please submit a new emergency report from the main menu.</p>
          <Link
            to="/citizen/report"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
          >
            Create Report
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-4 text-center">
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 shadow-sm space-y-4">
        <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
          <CheckCircle className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-extrabold uppercase px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            Report Transmitted
          </span>
          <h1 className="text-2xl font-black text-slate-900 pt-2">Emergency Report Submitted</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Your emergency report has been registered into the live ResQNet Supabase PostgreSQL database.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 inline-block space-y-1 shadow-xs">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block">Official Report Number</span>
          <p className="text-2xl font-black text-emerald-700 tracking-wider font-mono">
            {report.report_number || report.id}
          </p>
          {report.report_number && (
            <span className="text-[10px] text-slate-400 font-mono block">UUID: {report.id}</span>
          )}
        </div>

        <div className="text-xs text-slate-500 pt-2">
          Authority Command is reviewing AI resource allocation recommendations for verification.
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/citizen/track/${report.id}`}
          className="inline-flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-md transition-all text-sm"
        >
          <Navigation className="w-4 h-4" />
          <span>Track Emergency Live</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          to="/citizen/reports"
          className="inline-flex items-center justify-center space-x-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-5 py-3.5 rounded-xl transition-colors text-sm"
        >
          <span>View My Reports</span>
        </Link>
      </div>
    </div>
  );
};
