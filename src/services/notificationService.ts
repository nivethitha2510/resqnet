import type { Notification, UserRole } from '../types/domain';

class NotificationService {
  public createNotificationPayload(
    title: string,
    message: string,
    targetRole?: UserRole,
    type: Notification['type'] = 'info',
    incidentId?: string,
    reportId?: string
  ): Omit<Notification, 'id' | 'created_at'> {
    return {
      title,
      message,
      target_role: targetRole,
      type,
      incident_id: incidentId,
      report_id: reportId,
      is_read: false,
    };
  }
}

export const notificationService = new NotificationService();
