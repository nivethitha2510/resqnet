/**
 * Application Routes Configuration
 * Integrates Auth State & Strict Protected Route Guards per Role
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

// Layouts
import { CitizenLayout } from '../layouts/CitizenLayout';
import { AuthorityLayout } from '../layouts/AuthorityLayout';
import { ResponderLayout } from '../layouts/ResponderLayout';
import { AdminLayout } from '../layouts/AdminLayout';

// Auth Pages
import { Login } from '../pages/auth/Login';
import { Signup } from '../pages/auth/Signup';
import { AccessDenied } from '../pages/auth/AccessDenied';

// Citizen Pages
import { CitizenHome } from '../pages/citizen/CitizenHome';
import { ReportEmergency } from '../pages/citizen/ReportEmergency';
import { AIAnalysisPreview } from '../pages/citizen/AIAnalysisPreview';
import { ReportConfirmation } from '../pages/citizen/ReportConfirmation';
import { MyReports } from '../pages/citizen/MyReports';
import { EmergencyTracking } from '../pages/citizen/EmergencyTracking';

// Authority Pages
import { AuthorityDashboard } from '../pages/authority/AuthorityDashboard';
import { AuthorityReports } from '../pages/authority/AuthorityReports';
import { AuthorityIncidents } from '../pages/authority/AuthorityIncidents';
import { AuthorityLiveMap } from '../pages/authority/AuthorityLiveMap';
import { AuthorityVehicles } from '../pages/authority/AuthorityVehicles';
import { AuthorityTeams } from '../pages/authority/AuthorityTeams';
import { AuthorityAnalytics } from '../pages/authority/AuthorityAnalytics';
import { AuthorityAILogs } from '../pages/authority/AuthorityAILogs';
import { AuthoritySystemAudit } from '../pages/authority/AuthoritySystemAudit';

// Responder Pages
import { ResponderDashboard } from '../pages/responder/ResponderDashboard';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/access-denied" element={<AccessDenied />} />

      {/* Default Root Redirect */}
      <Route path="/" element={<Navigate to="/citizen" replace />} />

      {/* Protected Citizen Routes (Strictly Citizen Only) */}
      <Route
        path="/citizen"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout>
              <CitizenHome />
            </CitizenLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/citizen/report"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout>
              <ReportEmergency />
            </CitizenLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/citizen/report/preview"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout>
              <AIAnalysisPreview />
            </CitizenLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/citizen/report/confirm"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout>
              <ReportConfirmation />
            </CitizenLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/citizen/reports"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout>
              <MyReports />
            </CitizenLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/citizen/track/:id"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <CitizenLayout>
              <EmergencyTracking />
            </CitizenLayout>
          </ProtectedRoute>
        }
      />

      {/* Protected Authority Command Center Routes (Authority & Admin Only) */}
      <Route
        path="/authority"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityDashboard />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/reports"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityReports />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/incidents"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityIncidents />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/map"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityLiveMap />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/vehicles"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityVehicles />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/teams"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityTeams />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/analytics"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityAnalytics />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/ai-logs"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthorityAILogs />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/system-audit"
        element={
          <ProtectedRoute allowedRoles={['authority', 'admin']}>
            <AuthorityLayout>
              <AuthoritySystemAudit />
            </AuthorityLayout>
          </ProtectedRoute>
        }
      />

      {/* Protected Responder Tactical Field Routes (Responder Only) */}
      <Route
        path="/responder"
        element={
          <ProtectedRoute allowedRoles={['responder']}>
            <ResponderLayout>
              <ResponderDashboard />
            </ResponderLayout>
          </ProtectedRoute>
        }
      />

      {/* Protected Admin Routes (Admin Only) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* Fallback Catch-all Route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
