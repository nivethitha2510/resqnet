/**
 * ResQNet - Real Incident Priority Engine (Phase 3D)
 * Deterministic and explainable priority calculation for unified emergency incidents.
 * Enforces INCIDENT -> PRIORITY architecture contract.
 * Persists operational priority and reasons to Supabase PostgreSQL `public.incidents`.
 */

import { supabase as defaultSupabase } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriorityLevel, EmergencyType } from '../types/domain';

export interface PriorityCalculationResult {
  priority: PriorityLevel;
  score: number;
  reasons: string[];
}

export interface IncidentPriorityInput {
  id: string;
  code: string;
  title: string;
  emergency_type: EmergencyType;
  severity: string;
  affected_count: number;
  trapped_count: number;
  injured_count: number;
  vulnerable_count: number;
  location_text: string;
}

class PriorityService {
  /**
   * Deterministic Scoring Logic:
   * 1. Base Severity/Category Weight
   * 2. Trapped People Weight (High life threat: +25 pts/person, max 100)
   * 3. Injured People Weight (+15 pts/person, max 75)
   * 4. Vulnerable People Weight (+10 pts/person, max 50)
   * 5. Affected Population Weight (+2 pts/person, max 30)
   * 6. Duplicate Report Protection (Capped at max +10 pts regardless of report volume)
   * 7. AI Confidence Factor (+5 pts if avg confidence >= 0.8)
   */
  public calculatePriority(
    incident: IncidentPriorityInput,
    supportingReportsCount: number = 1,
    avgConfidence: number = 0.0
  ): PriorityCalculationResult {
    let score = 0;
    const reasons: string[] = [];

    // 1. Base Emergency Severity / Category Score
    const severityLower = (incident.severity || 'medium').toLowerCase();
    let baseScore = 20;

    if (severityLower === 'critical' || incident.emergency_type === 'building_collapse' || incident.emergency_type === 'cyclone_storm') {
      baseScore = 40;
      reasons.push(`Emergency Severity: CRITICAL / High Risk Category (${incident.emergency_type.replace('_', ' ').toUpperCase()})`);
    } else if (severityLower === 'high' || incident.emergency_type === 'fire' || incident.emergency_type === 'flood' || incident.emergency_type === 'landslide') {
      baseScore = 30;
      reasons.push(`Emergency Severity: HIGH / Significant Category (${incident.emergency_type.replace('_', ' ').toUpperCase()})`);
    } else if (severityLower === 'medium' || incident.emergency_type === 'medical' || incident.emergency_type === 'road_accident') {
      baseScore = 20;
      reasons.push(`Emergency Severity: MEDIUM / Standard Response Category (${incident.emergency_type.replace('_', ' ').toUpperCase()})`);
    } else {
      baseScore = 10;
      reasons.push(`Emergency Severity: LOW / Minor Category (${incident.emergency_type.replace('_', ' ').toUpperCase()})`);
    }
    score += baseScore;

    // 2. Trapped People (Heavy life threat weight)
    const trapped = incident.trapped_count || 0;
    if (trapped > 0) {
      const trappedPts = Math.min(100, trapped * 25);
      score += trappedPts;
      reasons.push(`${trapped} occupant(s) reported trapped in danger zone (+${trappedPts} pts)`);
    }

    // 3. Injured People (Medical casualty weight)
    const injured = incident.injured_count || 0;
    if (injured > 0) {
      const injuredPts = Math.min(75, injured * 15);
      score += injuredPts;
      reasons.push(`${injured} injured individual(s) requiring emergency medical assistance (+${injuredPts} pts)`);
    }

    // 4. Vulnerable Population (Children, elderly, disabled)
    const vulnerable = incident.vulnerable_count || 0;
    if (vulnerable > 0) {
      const vulnerablePts = Math.min(50, vulnerable * 10);
      score += vulnerablePts;
      reasons.push(`${vulnerable} vulnerable individual(s) (elderly/children/disabled) exposed (+${vulnerablePts} pts)`);
    }

    // 5. Total Affected Population (Impact scale)
    const affected = incident.affected_count || 0;
    if (affected > 0) {
      const affectedPts = Math.min(30, affected * 2);
      score += affectedPts;
      reasons.push(`${affected} total affected person(s) at site (+${affectedPts} pts)`);
    }

    // 6. Duplicate Report Volume Protection
    // Supporting report count is capped at +10 pts max to prevent 20 duplicate reports for a minor issue from inflating priority to CRITICAL
    if (supportingReportsCount > 0) {
      const reportPts = Math.min(10, supportingReportsCount * 2);
      score += reportPts;
      reasons.push(`${supportingReportsCount} supporting citizen report(s) aggregated (volume contribution capped at +${reportPts} pts)`);
    }

    // 7. AI Confidence Factor
    if (avgConfidence >= 0.8) {
      score += 5;
      reasons.push(`High AI analysis confidence level (${(avgConfidence * 100).toFixed(0)}%) (+5 pts)`);
    }

    // Determine Final Priority Level from Score & Critical Triggers
    let priority: PriorityLevel = 'low';

    // Critical Trigger: Any incident with trapped occupants AND critical/high severity OR score >= 80
    if (score >= 80 || (trapped >= 2 && baseScore >= 30) || (trapped >= 1 && baseScore >= 40)) {
      priority = 'critical';
    } else if (score >= 50 || trapped > 0 || injured >= 2 || (affected >= 5 && baseScore >= 30)) {
      priority = 'high';
    } else if (score >= 25 || injured > 0 || affected >= 2) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    reasons.push(`Calculated Priority Score: ${score}/100 -> Priority Level: ${priority.toUpperCase()}`);

    return { priority, score, reasons };
  }

  /**
   * Fetches unified incident from Supabase PostgreSQL, calculates deterministic priority,
   * updates `public.incidents` table, and logs audit record.
   */
  public async evaluateIncidentPriority(
    incidentId: string,
    customClient?: SupabaseClient
  ): Promise<{ priority: PriorityLevel; reasons: string[]; incident: any }> {
    const client = customClient || defaultSupabase;

    // 1. Fetch target incident from PostgreSQL
    const { data: incident, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incident) {
      console.error(`Priority Engine fetch error for incident ${incidentId}:`, incErr);
      throw new Error(`Incident not found in PostgreSQL: ${incErr?.message || incidentId}`);
    }

    // 2. Fetch linked supporting reports count and average AI confidence
    const { data: linkedReps, error: repErr } = await client
      .from('emergency_reports')
      .select('ai_confidence')
      .eq('incident_id', incidentId);

    if (repErr) {
      console.warn(`Priority Engine warning fetching linked reports for ${incidentId}:`, repErr.message);
    }

    const reportCount = linkedReps?.length || 1;
    let totalConf = 0;
    if (linkedReps && linkedReps.length > 0) {
      totalConf = linkedReps.reduce((sum, r) => sum + (r.ai_confidence || 0), 0);
    }
    const avgConfidence = reportCount > 0 ? totalConf / reportCount : 0;

    // 3. Run deterministic priority calculation
    const calc = this.calculatePriority(incident, reportCount, avgConfidence);

    // 4. Update public.incidents in Supabase PostgreSQL
    // Always update system_priority and priority_reasons.
    // ONLY update operational priority if verification_status is pending_review (preserving authority overrides).
    const updatePayload: Record<string, any> = {
      system_priority: calc.priority,
      priority_reasons: calc.reasons,
      updated_at: new Date().toISOString()
    };

    if (!incident.verification_status || incident.verification_status === 'pending_review') {
      updatePayload.priority = calc.priority;
    }

    const { data: updatedIncident, error: updateErr } = await client
      .from('incidents')
      .update(updatePayload)
      .eq('id', incidentId)
      .select()
      .single();

    if (updateErr) {
      console.error(`Priority Engine DB update error for incident ${incidentId}:`, updateErr);
      throw new Error(`Failed to update incident priority in PostgreSQL: ${updateErr.message}`);
    }

    return {
      priority: calc.priority,
      reasons: calc.reasons,
      incident: updatedIncident
    };
  }

  /**
   * Re-evaluates all active (non-closed) incidents in PostgreSQL
   */
  public async reevaluateAllActiveIncidents(
    customClient?: SupabaseClient
  ): Promise<{ evaluated: number; updated: any[] }> {
    const client = customClient || defaultSupabase;

    const { data: activeIncidents, error: fetchErr } = await client
      .from('incidents')
      .select('id')
      .neq('status', 'closed');

    if (fetchErr) {
      console.error('Error fetching active incidents for priority re-evaluation:', fetchErr);
      throw new Error(`Failed to fetch active incidents: ${fetchErr.message}`);
    }

    if (!activeIncidents || activeIncidents.length === 0) {
      return { evaluated: 0, updated: [] };
    }

    const updatedIncidents: any[] = [];
    for (const inc of activeIncidents) {
      const res = await this.evaluateIncidentPriority(inc.id, client);
      updatedIncidents.push(res.incident);
    }

    return {
      evaluated: activeIncidents.length,
      updated: updatedIncidents
    };
  }
}

export const priorityService = new PriorityService();
