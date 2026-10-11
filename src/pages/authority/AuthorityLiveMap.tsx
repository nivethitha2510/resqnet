/**
 * Authority Live Operations Map Page
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { ModularMap } from '../../components/map/ModularMap';

export const AuthorityLiveMap: React.FC = () => {
  const { incidents, reports, vehicles } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tactical Operations Live Map</h1>
          <p className="text-xs text-slate-500">Real-time geospatial tracking across incidents, citizen reports & response fleet</p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg">Incidents: {incidents.length}</span>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg">Reports: {reports.length}</span>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg">Fleet Units: {vehicles.length}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <ModularMap
          zoom={12}
          incidents={incidents}
          reports={reports}
          vehicles={vehicles}
          height="620px"
        />
      </div>
    </div>
  );
};
