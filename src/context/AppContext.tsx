/**
 * ResQNet Global Application Context
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  UserRole,
  LanguageCode,
  EmergencyReport,
  Incident,
  Vehicle,
  ResponseTeam,
  Notification,
  AuditLog,
  AIAuditLog,
  IncidentStatus,
  VehicleStatus,
} from '../types/domain';
import {
  INITIAL_DEV_REPORTS,
  INITIAL_DEV_INCIDENTS,
  INITIAL_DEV_VEHICLES,
  INITIAL_DEV_TEAMS,
  INITIAL_DEV_NOTIFICATIONS,
  INITIAL_DEV_AUDIT_LOGS,
  INITIAL_DEV_AI_AUDIT_LOGS,
} from '../lib/devData';

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;

  reports: EmergencyReport[];
  incidents: Incident[];
  vehicles: Vehicle[];
  teams: ResponseTeam[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  aiAuditLogs: AIAuditLog[];

  addReport: (report: EmergencyReport) => void;
  updateReportStatus: (reportId: string, status: EmergencyReport['status']) => void;
  createIncidentFromReport: (reportId: string, overrideTitle?: string) => Incident;
  updateIncidentStatus: (incidentId: string, status: IncidentStatus, notes?: string) => void;
  assignVehicleToIncident: (incidentId: string, vehicleId: string) => void;
  updateVehicleStatus: (vehicleId: string, status: VehicleStatus) => void;
  markNotificationRead: (notifId: string) => void;
  addAuditLog: (action: string, entity: string, entityId: string, details: Record<string, unknown>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('citizen');
  const [language, setLanguage] = useState<LanguageCode>('en-US');

  const [reports, setReports] = useState<EmergencyReport[]>(INITIAL_DEV_REPORTS);
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_DEV_INCIDENTS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_DEV_VEHICLES);
  const [teams] = useState<ResponseTeam[]>(INITIAL_DEV_TEAMS);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_DEV_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_DEV_AUDIT_LOGS);
  const [aiAuditLogs] = useState<AIAuditLog[]>(INITIAL_DEV_AI_AUDIT_LOGS);

  const addAuditLog = useCallback(
    (action: string, entity: string, entityId: string, details: Record<string, unknown>) => {
      const newLog: AuditLog = {
        id: `AUD-${Date.now()}`,
        user_id: 'CURRENT_USER',
        user_role: currentRole,
        action,
        target_entity: entity,
        target_id: entityId,
        details,
        timestamp: new Date().toISOString(),
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    },
    [currentRole]
  );

  const addReport = useCallback((report: EmergencyReport) => {
    setReports((prev) => [report, ...prev]);

    const newNotif: Notification = {
      id: `NOTIF-${Date.now()}`,
      target_role: 'authority',
      title: `New Emergency Report: ${report.emergency_type.toUpperCase()}`,
      message: report.ai_summary || report.raw_text || 'Emergency submitted by citizen',
      report_id: report.id,
      is_read: false,
      type: 'alert',
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  const updateReportStatus = useCallback((reportId: string, status: EmergencyReport['status']) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status, updated_at: new Date().toISOString() } : r))
    );
  }, []);

  const createIncidentFromReport = useCallback(
    (reportId: string, overrideTitle?: string): Incident => {
      const report = reports.find((r) => r.id === reportId);
      if (!report) throw new Error('Report not found');

      const newIncident: Incident = {
        id: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        code: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        title: overrideTitle || `Emergency Incident: ${report.emergency_type.toUpperCase()}`,
        description: report.ai_summary || report.raw_text || 'Verified incident from citizen report',
        emergency_type: report.emergency_type,
        priority: report.calculated_priority,
        status: 'verifying',
        location: report.location,
        affected_count: report.affected_people_count,
        trapped_count: report.trapped_people_count,
        injured_count: report.injured_people_count,
        vulnerable_count: report.vulnerable_people_count,
        priority_reasons: report.evidence_snippets,
        required_resources: [report.emergency_type === 'fire' ? 'Fire Engine' : 'Ambulance'],
        recommended_vehicle_ids: vehicles.filter((v) => v.status === 'available').slice(0, 2).map((v) => v.id),
        assigned_vehicle_ids: [],
        assigned_team_ids: [],
        verified_by: 'Authority Officer',
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setIncidents((prev) => [newIncident, ...prev]);
      updateReportStatus(reportId, 'linked_to_incident');

      addAuditLog('CREATE_INCIDENT', 'Incident', newIncident.id, {
        source_report_id: reportId,
        priority: newIncident.priority,
      });

      return newIncident;
    },
    [reports, vehicles, updateReportStatus, addAuditLog]
  );

  const updateIncidentStatus = useCallback(
    (incidentId: string, status: IncidentStatus, notes?: string) => {
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.id === incidentId) {
            const updated = { ...inc, status, updated_at: new Date().toISOString() };
            if (status === 'resolved') {
              updated.resolved_at = new Date().toISOString();
            }
            return updated;
          }
          return inc;
        })
      );

      addAuditLog('UPDATE_INCIDENT_STATUS', 'Incident', incidentId, { new_status: status, notes });
    },
    [addAuditLog]
  );

  const assignVehicleToIncident = useCallback(
    (incidentId: string, vehicleId: string) => {
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.id === incidentId) {
            const updatedAssigned = Array.from(new Set([...inc.assigned_vehicle_ids, vehicleId]));
            return { ...inc, assigned_vehicle_ids: updatedAssigned, status: 'dispatching' as IncidentStatus };
          }
          return inc;
        })
      );

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? { ...v, status: 'assigned' as VehicleStatus, assigned_incident_id: incidentId, updated_at: new Date().toISOString() }
            : v
        )
      );

      addAuditLog('ASSIGN_VEHICLE', 'Vehicle', vehicleId, { assigned_to_incident: incidentId });
    },
    [addAuditLog]
  );

  const updateVehicleStatus = useCallback((vehicleId: string, status: VehicleStatus) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, status, updated_at: new Date().toISOString() } : v))
    );
  }, []);

  const markNotificationRead = useCallback((notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        language,
        setLanguage,
        reports,
        incidents,
        vehicles,
        teams,
        notifications,
        auditLogs,
        aiAuditLogs,
        addReport,
        updateReportStatus,
        createIncidentFromReport,
        updateIncidentStatus,
        assignVehicleToIncident,
        updateVehicleStatus,
        markNotificationRead,
        addAuditLog,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
