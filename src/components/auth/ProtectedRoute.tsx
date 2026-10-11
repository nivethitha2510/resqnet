/**
 * Protected Route Component
 * Enforces authentication and role-based access control.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ConfigError } from '../../pages/auth/ConfigError';
import { AccessDenied } from '../../pages/auth/AccessDenied';
import type { UserRole } from '../../types/domain';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, isLoading } = useAuth();

  if (!isSupabaseConfigured()) {
    return <ConfigError />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        <span className="text-xs font-semibold text-slate-400">Verifying Supabase Session & Role...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role || (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role))) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};
