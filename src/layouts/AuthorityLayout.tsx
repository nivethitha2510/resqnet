/**
 * Authority Command Center Layout
 * Clean responsive design for mobile (375px, 390px), tablet (768px), and desktop (1280px+).
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  MapPin,
  Truck,
  Users,
  BarChart3,
  Bot,
  ShieldCheck,
  Bell,
  ShieldAlert,
  LogOut,
  UserCheck,
  Menu,
  X,
} from 'lucide-react';

export const AuthorityLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { incidents, vehicles, reports, notifications } = useApp();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed');
  const criticalIncidents = activeIncidents.filter((i) => i.priority === 'critical');
  const pendingReports = reports.filter((r) => r.status === 'submitted' || r.status === 'ai_analyzed');
  const availableVehicles = vehicles.filter((v) => v.status === 'available');
  const unreadNotifs = notifications.filter((n) => !n.is_read);

  const navItems = [
    { label: 'Dashboard', path: '/authority', icon: LayoutDashboard },
    { label: 'Citizen Reports', path: '/authority/reports', icon: FileText, count: pendingReports.length },
    { label: 'Incidents Workspace', path: '/authority/incidents', icon: AlertTriangle, count: activeIncidents.length },
    { label: 'Live Operations Map', path: '/authority/map', icon: MapPin },
    { label: 'Vehicle Fleet', path: '/authority/vehicles', icon: Truck, count: availableVehicles.length },
    { label: 'Response Teams', path: '/authority/teams', icon: Users },
    { label: 'Analytics', path: '/authority/analytics', icon: BarChart3 },
    { label: 'AI Audit Logs', path: '/authority/ai-logs', icon: Bot },
    { label: 'System & Audit', path: '/authority/system-audit', icon: ShieldCheck },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-sky-50/40 text-slate-900 flex flex-col font-sans">
      <header className="bg-white text-slate-900 border-b border-sky-100 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/authority" className="flex items-center space-x-2">
              <div className="bg-red-600 p-2 rounded-lg text-white font-bold shadow-sm">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg sm:text-xl tracking-wider text-slate-900">ResQNet</span>
                <span className="ml-2 text-[10px] sm:text-xs font-bold px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-200 rounded">
                  COMMAND CENTER
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Header Stats for Large Screens */}
          <div className="hidden xl:flex items-center space-x-4 text-xs font-medium">
            <div className="flex items-center space-x-2 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <span className="text-slate-600 font-semibold">Active:</span>
              <span className="font-extrabold text-slate-900 text-sm">{activeIncidents.length}</span>
            </div>

            <div className="flex items-center space-x-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <span className="text-amber-800 font-bold">Critical:</span>
              <span className="font-extrabold text-amber-900 text-sm">{criticalIncidents.length}</span>
            </div>

            <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-800 font-semibold">Available Fleet:</span>
              <span className="font-extrabold text-emerald-900 text-sm">{availableVehicles.length} / {vehicles.length}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <button className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 relative">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>
            </div>

            {user && (
              <div className="hidden md:flex items-center space-x-2 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200 text-xs">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <p className="font-bold text-slate-900 text-xs leading-none">{profile?.full_name || 'Officer'}</p>
                  <p className="text-[10px] text-sky-700 leading-none mt-0.5 uppercase font-semibold">{profile?.role || 'authority'}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={signOut}
              className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-lg border border-red-200 flex items-center space-x-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar & Mobile Drawer Overlay */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white text-slate-800 border-r border-sky-100 flex flex-col shrink-0 transition-transform duration-200 transform shadow-xs ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-bold text-sky-800 tracking-wider uppercase">
              Operations Control
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    active
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'text-slate-700 hover:bg-sky-50 hover:text-sky-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        active ? 'bg-white text-sky-700' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sky-100 text-xs text-slate-500">
            <p className="font-bold text-slate-700">ResQNet Engine v1.0</p>
            <p className="text-slate-500">Human-in-the-Loop Operations</p>
          </div>
        </aside>

        {/* Mobile Overlay Background */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-sky-50/40 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
