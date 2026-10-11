/**
 * Citizen Home Page
 * Clean white/light emergency assistance hub connected to Supabase PostgreSQL.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ShieldAlert, PlusCircle, Flame, Waves, Stethoscope, Car, Building2, Wind, AlertTriangle, ChevronRight, PhoneCall, History } from 'lucide-react';
import type { EmergencyType } from '../../types/domain';

export const CitizenHome: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      supabase
        .from('emergency_reports')
        .select('*')
        .eq('citizen_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data }) => {
          if (data) setReports(data);
        });
    }
  }, [user?.id]);

  const emergencyCategories: { type: EmergencyType; label: string; icon: any; color: string }[] = [
    { type: 'fire', label: 'Fire', icon: Flame, color: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
    { type: 'flood', label: 'Flood', icon: Waves, color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
    { type: 'medical', label: 'Medical', icon: Stethoscope, color: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
    { type: 'road_accident', label: 'Accident', icon: Car, color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
    { type: 'building_collapse', label: 'Collapse', icon: Building2, color: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' },
    { type: 'cyclone_storm', label: 'Cyclone', icon: Wind, color: 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100' },
    { type: 'landslide', label: 'Landslide', icon: AlertTriangle, color: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' },
    { type: 'other', label: 'Other', icon: ShieldAlert, color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* High Urgency Action Banner */}
      <div className="bg-red-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center space-x-2 bg-red-700/80 px-3 py-1 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 bg-white rounded-full animate-ping" />
            <span>24/7 Emergency Response Network</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Need Emergency Assistance?
          </h1>
          <p className="text-red-100 text-sm leading-relaxed max-w-xl">
            Report fires, medical emergencies, floods, accidents, or trapped victims immediately for real-time dispatch.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              to="/citizen/report"
              className="inline-flex items-center justify-center space-x-2 bg-white text-red-700 font-extrabold px-6 py-3.5 rounded-xl shadow-md hover:bg-red-50 transition-all text-base"
            >
              <PlusCircle className="w-5 h-5 text-red-600" />
              <span>REPORT EMERGENCY NOW</span>
            </Link>

            <a
              href="tel:112"
              className="inline-flex items-center justify-center space-x-2 bg-red-800 hover:bg-red-900 text-white font-semibold px-5 py-3 rounded-xl border border-red-500 transition-colors text-sm"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Call Emergency (112)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Emergency Categories Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Select Emergency Type</h2>
          <span className="text-xs text-slate-500">Quick report launch</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {emergencyCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.type}
                to={`/citizen/report?type=${cat.type}`}
                className={`p-4 rounded-xl border ${cat.color} flex flex-col items-center text-center space-y-2 hover:shadow-md transition-all group`}
              >
                <Icon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Submitted Reports Quick Track */}
      {reports.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-slate-600" />
              <h3 className="font-bold text-slate-900 text-base">Your Active Reports</h3>
            </div>
            <Link to="/citizen/reports" className="text-xs font-semibold text-red-600 hover:underline flex items-center">
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {reports.map((rep) => (
              <Link
                key={rep.id}
                to={`/citizen/track/${rep.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-red-300 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{rep.report_number || rep.id.slice(0, 8)}</span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded uppercase">
                      {rep.emergency_type?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate max-w-xs mt-1">
                    {rep.ai_summary || rep.description}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-600 flex items-center">
                  Track <ChevronRight className="w-4 h-4 ml-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
