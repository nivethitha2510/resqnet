import type { AuditLog, AIAuditLog, UserRole } from '../types/domain';

class AuditService {
  public createAuditPayload(
    userId: string,
    userRole: UserRole,
    action: string,
    targetEntity: string,
    targetId: string,
    details: Record<string, unknown>
  ): Omit<AuditLog, 'id' | 'timestamp'> {
    return {
      user_id: userId,
      user_role: userRole,
      action,
      target_entity: targetEntity,
      target_id: targetId,
      details,
    };
  }

  public createAIAuditPayload(
    aiModule: AIAuditLog['ai_module'],
    confidenceScore: number,
    recommendation: Record<string, unknown>,
    reportId?: string,
    incidentId?: string
  ): Omit<AIAuditLog, 'id' | 'timestamp'> {
    return {
      ai_module: aiModule,
      confidence_score: confidenceScore,
      recommendation,
      report_id: reportId,
      incident_id: incidentId,
    };
  }
}

export const auditService = new AuditService();
