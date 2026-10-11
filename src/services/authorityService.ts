/**
 * ResQNet - Real Authority Verification Service (Phase 3E)
 * Handles human-in-the-loop decision workflow: Approve, Modify, or Reject system recommendations.
 * Enforces RLS, immutable audit trails in `public.audit_logs`, and preserves system recommendations.
 */

import { supabase as defaultSupabase } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriorityLevel } from '../types/domain';

export type VerificationDecision = 'approved' | 'modified' | 'rejected';

export interface AuthorityDecisionResult {
  incident: any;
  auditLog: any;
}

class AuthorityService {
  /**
   * Helper to verify current session and role
   */
  private async getAuthenticatedAuthority(client: SupabaseClient): Promise<{ userId: string; role: string }> {
    let userId: string | undefined;
    const { data: { session } } = await client.auth.getSession();
    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      const { data: { user } } = await client.auth.getUser();
      userId = user?.id;
    }

    if (!userId) {
      throw new Error('Authentication required for authority verification actions.');
    }
    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profErr || !profile) {
      throw new Error('Failed to verify user role from profiles.');
    }

    if (profile.role !== 'authority' && profile.role !== 'admin') {
      throw new Error(`Unauthorized: User role '${profile.role}' cannot perform authority verification.`);
    }

    return { userId, role: profile.role };
  }

  /**
   * Authority approves the system recommended priority
   */
  public async approveRecommendation(
    incidentId: string,
    customClient?: SupabaseClient
  ): Promise<AuthorityDecisionResult> {
    const client = customClient || defaultSupabase;
    const { userId, role } = await this.getAuthenticatedAuthority(client);

    // 1. Fetch target incident
    const { data: incident, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incident) {
      throw new Error(`Incident not found: ${incErr?.message || incidentId}`);
    }

    const systemPriority: PriorityLevel = incident.system_priority || incident.priority || 'medium';
    const now = new Date().toISOString();

    // 2. Update public.incidents
    const { data: updatedIncident, error: updateErr } = await client
      .from('incidents')
      .update({
        priority: systemPriority,
        verification_status: 'approved',
        verified_by: userId,
        verified_at: now,
        updated_at: now
      })
      .eq('id', incidentId)
      .select()
      .single();

    if (updateErr) {
      console.error(`Approval DB update failed for incident ${incidentId}:`, updateErr);
      throw new Error(`Failed to approve incident in PostgreSQL: ${updateErr.message}`);
    }

    // 3. Log Immutable Audit Record in public.audit_logs
    const auditPayload = {
      user_id: userId,
      user_role: role,
      action: 'INCIDENT_VERIFICATION_APPROVE',
      target_entity: 'incidents',
      target_id: incidentId,
      details: {
        previous_verification_status: incident.verification_status || 'pending_review',
        new_verification_status: 'approved',
        system_priority: systemPriority,
        verified_priority: systemPriority,
        timestamp: now
      }
    };

    const { data: auditLog, error: auditErr } = await client
      .from('audit_logs')
      .insert(auditPayload)
      .select()
      .single();

    if (auditErr) {
      console.warn('Warning: Failed to persist audit log entry:', auditErr.message);
    }

    return { incident: updatedIncident, auditLog };
  }

  /**
   * Authority modifies operational priority (Requires non-empty reason)
   */
  public async modifyPriority(
    incidentId: string,
    newPriority: PriorityLevel,
    reason: string,
    customClient?: SupabaseClient
  ): Promise<AuthorityDecisionResult> {
    const client = customClient || defaultSupabase;

    if (!reason || reason.trim().length === 0) {
      throw new Error('Authority modification requires a mandatory justification reason.');
    }

    const { userId, role } = await this.getAuthenticatedAuthority(client);

    // 1. Fetch target incident
    const { data: incident, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incident) {
      throw new Error(`Incident not found: ${incErr?.message || incidentId}`);
    }

    const systemPriority: PriorityLevel = incident.system_priority || incident.priority || 'medium';
    const now = new Date().toISOString();

    // 2. Update public.incidents
    const { data: updatedIncident, error: updateErr } = await client
      .from('incidents')
      .update({
        priority: newPriority,
        verification_status: 'modified',
        authority_notes: reason.trim(),
        verified_by: userId,
        verified_at: now,
        updated_at: now
      })
      .eq('id', incidentId)
      .select()
      .single();

    if (updateErr) {
      console.error(`Modification DB update failed for incident ${incidentId}:`, updateErr);
      throw new Error(`Failed to modify incident priority in PostgreSQL: ${updateErr.message}`);
    }

    // 3. Log Immutable Audit Record
    const auditPayload = {
      user_id: userId,
      user_role: role,
      action: 'INCIDENT_VERIFICATION_MODIFY',
      target_entity: 'incidents',
      target_id: incidentId,
      details: {
        previous_verification_status: incident.verification_status || 'pending_review',
        new_verification_status: 'modified',
        previous_priority: incident.priority,
        system_priority: systemPriority,
        verified_priority: newPriority,
        authority_notes: reason.trim(),
        timestamp: now
      }
    };

    const { data: auditLog, error: auditErr } = await client
      .from('audit_logs')
      .insert(auditPayload)
      .select()
      .single();

    if (auditErr) {
      console.warn('Warning: Failed to persist audit log entry:', auditErr.message);
    }

    return { incident: updatedIncident, auditLog };
  }

  /**
   * Authority rejects recommendation / incident assessment (Requires non-empty reason)
   */
  public async rejectRecommendation(
    incidentId: string,
    reason: string,
    customClient?: SupabaseClient
  ): Promise<AuthorityDecisionResult> {
    const client = customClient || defaultSupabase;

    if (!reason || reason.trim().length === 0) {
      throw new Error('Authority rejection requires a mandatory justification reason.');
    }

    const { userId, role } = await this.getAuthenticatedAuthority(client);

    // 1. Fetch target incident
    const { data: incident, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incident) {
      throw new Error(`Incident not found: ${incErr?.message || incidentId}`);
    }

    const systemPriority: PriorityLevel = incident.system_priority || incident.priority || 'medium';
    const now = new Date().toISOString();

    // 2. Update public.incidents
    const { data: updatedIncident, error: updateErr } = await client
      .from('incidents')
      .update({
        verification_status: 'rejected',
        authority_notes: reason.trim(),
        verified_by: userId,
        verified_at: now,
        updated_at: now
      })
      .eq('id', incidentId)
      .select()
      .single();

    if (updateErr) {
      console.error(`Rejection DB update failed for incident ${incidentId}:`, updateErr);
      throw new Error(`Failed to reject incident in PostgreSQL: ${updateErr.message}`);
    }

    // 3. Log Immutable Audit Record
    const auditPayload = {
      user_id: userId,
      user_role: role,
      action: 'INCIDENT_VERIFICATION_REJECT',
      target_entity: 'incidents',
      target_id: incidentId,
      details: {
        previous_verification_status: incident.verification_status || 'pending_review',
        new_verification_status: 'rejected',
        system_priority: systemPriority,
        authority_notes: reason.trim(),
        timestamp: now
      }
    };

    const { data: auditLog, error: auditErr } = await client
      .from('audit_logs')
      .insert(auditPayload)
      .select()
      .single();

    if (auditErr) {
      console.warn('Warning: Failed to persist audit log entry:', auditErr.message);
    }

    return { incident: updatedIncident, auditLog };
  }

  /**
   * Retrieves full audit history for an incident from `public.audit_logs`
   */
  public async getIncidentAuditHistory(
    incidentId: string,
    customClient?: SupabaseClient
  ): Promise<any[]> {
    const client = customClient || defaultSupabase;

    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('target_entity', 'incidents')
      .eq('target_id', incidentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Error fetching audit history for incident ${incidentId}:`, error);
      return [];
    }

    return data || [];
  }
}

export const authorityService = new AuthorityService();
