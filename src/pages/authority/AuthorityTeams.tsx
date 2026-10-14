/**
 * Response Teams & Personnel Role Management Page
 * Real Supabase PostgreSQL integration for response teams roster
 * and authorized personnel role assignment (Citizen -> Responder / Authority).
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { authorityService } from '../../services/authorityService';
import { useAuth } from '../../context/AuthContext';
import type { UserRole, Profile } from '../../types/domain';
import {
  Phone,
  Users,
  Loader2,
  ShieldCheck,
  Truck,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const AuthorityTeams: React.FC = () => {
  const { user: currentAuthUser } = useAuth();

  // State: Response Teams
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  // State: Personnel Profiles
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('response_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching response teams from Supabase:', err);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles((data as Profile[]) || []);
    } catch (err: any) {
      console.error('Error fetching personnel profiles:', err);
      setActionError(err.message || 'Could not load personnel profiles from database.');
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchProfiles();
  }, []);

  const handleRoleChange = async (targetUser: Profile, newRole: UserRole) => {
    if (targetUser.role === newRole) return;

    if (targetUser.id === currentAuthUser?.id) {
      setActionError('Self-modification safety: You cannot modify your own active administrative role.');
      return;
    }

    setUpdatingUserId(targetUser.id);
    setActionNotice(null);
    setActionError(null);

    try {
      await authorityService.assignUserRole(targetUser.id, newRole);
      setActionNotice(
        `Role for '${targetUser.email || targetUser.full_name}' successfully updated to '${newRole.toUpperCase()}'. Persisted to Supabase PostgreSQL.`
      );
      await fetchProfiles();
    } catch (err: any) {
      console.error('Role update error:', err);
      setActionError(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.badge_number?.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const responderCount = profiles.filter((p) => p.role === 'responder').length;
  const authorityCount = profiles.filter((p) => p.role === 'authority').length;
  const citizenCount = profiles.filter((p) => p.role === 'citizen').length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Response Teams & Personnel Roster</h1>
          <p className="text-xs text-slate-500">
            Deployed rescue squads, certified responders, and administrative role assignment
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
            Responders: {responderCount}
          </span>
          <span className="px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg">
            Authorities: {authorityCount}
          </span>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
            Citizens: {citizenCount}
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{actionNotice}</span>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* SECTION 1: Active Response Teams Roster */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-slate-900">Active Response Squads</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {teams.length} Registered Units
          </span>
        </div>

        {isLoadingTeams ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-red-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading response squads from Supabase...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs">
            No response teams registered in database.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-red-600" />
                    <span className="font-bold text-slate-900 text-sm">{t.team_name}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                    {t.status}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-700">
                  <p>Agency: <strong className="text-slate-900">{t.agency}</strong></p>
                  <p>Commander: <strong className="text-slate-900">{t.leader_name}</strong></p>
                  <p>Squad Size: <strong className="text-slate-900">{t.member_count} Personnel</strong></p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center space-x-2">
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t.contact_phone}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Personnel Role Management */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Personnel & Responder Role Assignment</h2>
              <p className="text-[11px] text-slate-500">
                Authorized command officers can safely promote accounts to Responder or Authority
              </p>
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                roleFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              All ({profiles.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('responder')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                roleFilter === 'responder' ? 'bg-emerald-600 text-white shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Responders ({responderCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('authority')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                roleFilter === 'authority' ? 'bg-sky-700 text-white shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Authorities ({authorityCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('citizen')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                roleFilter === 'citizen' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Citizens ({citizenCount})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search personnel by name, email, or badge number..."
            className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Personnel List */}
        {isLoadingProfiles ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading personnel accounts from Supabase...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs">
            No accounts matching the search/filter criteria.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Language / Badge</th>
                    <th className="py-3 px-4">Assign Role (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfiles.map((p) => {
                    const isSelf = p.id === currentAuthUser?.id;
                    const isBusy = updatingUserId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                p.role === 'responder'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.role === 'authority'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {p.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                <span>{p.full_name || 'Unnamed User'}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-500 text-[11px] font-mono">{p.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase ${
                              p.role === 'responder'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : p.role === 'authority'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : p.role === 'admin'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {p.role === 'responder' && <Truck className="w-3 h-3 text-emerald-600" />}
                            {p.role === 'authority' && <ShieldCheck className="w-3 h-3 text-sky-600" />}
                            {p.role === 'citizen' && <UserCheck className="w-3 h-3 text-slate-500" />}
                            <span>{p.role}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500">
                          <div>Lang: <span className="font-mono text-slate-700">{p.preferred_language || 'en-US'}</span></div>
                          {p.badge_number && (
                            <div className="text-[11px] text-slate-600">Badge: {p.badge_number}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {isSelf ? (
                            <span className="text-slate-400 text-[11px] italic">Active Account</span>
                          ) : isBusy ? (
                            <div className="flex items-center space-x-1 text-slate-500">
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                              <span className="text-[11px]">Updating...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <select
                                value={p.role}
                                onChange={(e) => handleRoleChange(p, e.target.value as UserRole)}
                                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                              >
                                <option value="citizen">Citizen (Standard)</option>
                                <option value="responder">Responder (Tactical Field)</option>
                                <option value="authority">Authority (Command Center)</option>
                              </select>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
