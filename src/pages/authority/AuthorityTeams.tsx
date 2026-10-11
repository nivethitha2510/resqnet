/**
 * Response Teams Roster Page
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Phone } from 'lucide-react';

export const AuthorityTeams: React.FC = () => {
  const { teams } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Response Teams Roster</h1>
        <p className="text-xs text-slate-500">Deployed rescue squads, team leads, and unit assignments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-base">{t.team_name}</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                {t.status}
              </span>
            </div>

            <div className="text-xs space-y-1 text-slate-700">
              <p>Agency: <strong className="text-slate-900">{t.agency}</strong></p>
              <p>Commander: <strong className="text-slate-900">{t.leader_name}</strong></p>
              <p>Personnel Count: <strong className="text-slate-900">{t.member_count} Rescuers</strong></p>
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center space-x-2">
              <Phone className="w-3.5 h-3.5 text-slate-600" />
              <span>{t.contact_phone}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
