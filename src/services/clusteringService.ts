/**
 * ResQNet - Real Incident Clustering Service (Phase 3C)
 * Groups citizen emergency reports from PostgreSQL into unified incidents.
 * Enforces REPORT != INCIDENT architecture rule.
 */

import { supabase } from '../lib/supabase';
import { priorityService } from './priorityService';
import type { EmergencyType, PriorityLevel } from '../types/domain';

export interface RawReportRow {
  id: string;
  report_number: string;
  citizen_id: string | null;
  emergency_type: EmergencyType;
  description: string;
  people_affected: number;
  people_injured: number;
  people_trapped: number;
  vulnerable_people: number;
  latitude: number;
  longitude: number;
  location_text: string;
  severity: string;
  priority: PriorityLevel;
  status: string;
  ai_summary: string | null;
  incident_id: string | null;
  created_at: string;
}

export interface IncidentRow {
  id: string;
  code: string;
  title: string;
  description: string;
  emergency_type: EmergencyType;
  priority: PriorityLevel;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  location_text: string;
  affected_count: number;
  trapped_count: number;
  injured_count: number;
  vulnerable_count: number;
  cluster_id: string | null;
  clustering_reason: string | null;
  created_at: string;
}

class ClusteringService {
  /**
   * Calculates Haversine distance in kilometers between two coordinates.
   */
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Main idempotent clustering run: reads unlinked reports from PostgreSQL, groups candidates,
   * creates incidents in `public.incidents`, and establishes `public.incident_reports` mappings.
   */
  public async runClustering(): Promise<{
    processedReports: number;
    createdIncidents: number;
    linkedReports: number;
    incidents: IncidentRow[];
  }> {
    // 1. Fetch unlinked reports from public.emergency_reports
    const { data: unlinkedReports, error: repErr } = await supabase
      .from('emergency_reports')
      .select('*')
      .is('incident_id', null)
      .order('created_at', { ascending: true });

    if (repErr) {
      console.error('Clustering fetch unlinked reports error:', repErr);
      throw new Error(`Failed to fetch unlinked reports: ${repErr.message}`);
    }

    if (!unlinkedReports || unlinkedReports.length === 0) {
      // Fetch existing incidents to return
      const { data: existingIncidents } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
      return {
        processedReports: 0,
        createdIncidents: 0,
        linkedReports: 0,
        incidents: existingIncidents || [],
      };
    }

    // 2. Fetch active incidents to test if unlinked reports match existing incidents
    const { data: activeIncidents } = await supabase
      .from('incidents')
      .select('*')
      .neq('status', 'closed');

    const existingList: IncidentRow[] = activeIncidents || [];
    let createdCount = 0;
    let linkedCount = 0;
    const remainingToCluster: RawReportRow[] = [];

    // Step A: Link unlinked reports to matching existing incidents
    for (const report of unlinkedReports as RawReportRow[]) {
      let matchedIncident: IncidentRow | null = null;
      let minDistance = 3.0; // 3.0 km threshold

      for (const inc of existingList) {
        if (inc.emergency_type === report.emergency_type) {
          const dist = this.calculateDistanceKm(report.latitude, report.longitude, inc.latitude, inc.longitude);
          const reportTime = new Date(report.created_at).getTime();
          const incTime = new Date(inc.created_at).getTime();
          const timeDiffMinutes = Math.abs(reportTime - incTime) / (1000 * 60);

          if (dist <= 3.0 && timeDiffMinutes <= 120 && dist < minDistance) {
            minDistance = dist;
            matchedIncident = inc;
          }
        }
      }

      if (matchedIncident) {
        // Link to existing incident
        await this.linkReportToIncident(report, matchedIncident.id, minDistance);
        linkedCount++;
      } else {
        remainingToCluster.push(report);
      }
    }

    // Step B: Group remaining unlinked reports into new incidents
    const visited = new Set<string>();

    for (let i = 0; i < remainingToCluster.length; i++) {
      const repA = remainingToCluster[i];
      if (visited.has(repA.id)) continue;

      const group: RawReportRow[] = [repA];
      visited.add(repA.id);

      for (let j = i + 1; j < remainingToCluster.length; j++) {
        const repB = remainingToCluster[j];
        if (visited.has(repB.id)) continue;

        if (repA.emergency_type === repB.emergency_type) {
          const dist = this.calculateDistanceKm(repA.latitude, repA.longitude, repB.latitude, repB.longitude);
          const timeA = new Date(repA.created_at).getTime();
          const timeB = new Date(repB.created_at).getTime();
          const timeDiffMin = Math.abs(timeA - timeB) / (1000 * 60);

          if (dist <= 3.0 && timeDiffMin <= 60) {
            group.push(repB);
            visited.add(repB.id);
          }
        }
      }

      // Create new incident if group has 2+ reports or single critical report
      if (group.length >= 2 || repA.severity === 'critical' || repA.people_trapped > 0) {
        const newInc = await this.createIncidentFromGroup(group);
        if (newInc) {
          createdCount++;
          linkedCount += group.length;
        }
      }
    }

    // Fetch updated incidents list from PostgreSQL
    const { data: updatedIncidents } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    return {
      processedReports: unlinkedReports.length,
      createdIncidents: createdCount,
      linkedReports: linkedCount,
      incidents: updatedIncidents || [],
    };
  }

  /**
   * Links a single report to an existing incident in public.emergency_reports & public.incident_reports
   */
  private async linkReportToIncident(report: RawReportRow, incidentId: string, distanceKm: number): Promise<void> {
    // 1. Update report incident_id reference
    await supabase
      .from('emergency_reports')
      .update({ incident_id: incidentId })
      .eq('id', report.id);

    // 2. Insert mapping into public.incident_reports (Idempotent ON CONFLICT ignore)
    const confidence = Math.max(0.70, 1.0 - (distanceKm / 3.0) * 0.3);
    await supabase
      .from('incident_reports')
      .insert({
        incident_id: incidentId,
        report_id: report.id,
        match_confidence: Number(confidence.toFixed(2)),
      })
      .select();

    // 3. Recalculate aggregated counts on incident
    const { data: linkedReps } = await supabase
      .from('emergency_reports')
      .select('people_affected, people_injured, people_trapped, vulnerable_people')
      .eq('incident_id', incidentId);

    if (linkedReps && linkedReps.length > 0) {
      const affected = linkedReps.reduce((sum, r) => sum + (r.people_affected || 0), 0);
      const injured = linkedReps.reduce((sum, r) => sum + (r.people_injured || 0), 0);
      const trapped = linkedReps.reduce((sum, r) => sum + (r.people_trapped || 0), 0);
      const vulnerable = linkedReps.reduce((sum, r) => sum + (r.vulnerable_people || 0), 0);

      await supabase
        .from('incidents')
        .update({
          affected_count: affected,
          injured_count: injured,
          trapped_count: trapped,
          vulnerable_count: vulnerable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', incidentId);

      // Recalculate operational priority & reasons via Priority Engine
      await priorityService.evaluateIncidentPriority(incidentId);
    }
  }

  /**
   * Creates a new incident in public.incidents from a group of reports
   */
  private async createIncidentFromGroup(group: RawReportRow[]): Promise<IncidentRow | null> {
    const primary = group[0];
    const code = `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const categoryLabel = primary.emergency_type.replace('_', ' ').toUpperCase();
    const title = `${categoryLabel} Incident - ${primary.location_text.split(',')[0]}`;
    
    const descriptions = group.map((r) => r.ai_summary || r.description).filter(Boolean);
    const combinedDescription = descriptions.join(' | ');

    // Aggregate counts across group
    const affected = group.reduce((sum, r) => sum + (r.people_affected || 0), 0);
    const injured = group.reduce((sum, r) => sum + (r.people_injured || 0), 0);
    const trapped = group.reduce((sum, r) => sum + (r.people_trapped || 0), 0);
    const vulnerable = group.reduce((sum, r) => sum + (r.vulnerable_people || 0), 0);

    // Calculate centroid coordinates
    const latSum = group.reduce((sum, r) => sum + r.latitude, 0);
    const lonSum = group.reduce((sum, r) => sum + r.longitude, 0);
    const avgLat = latSum / group.length;
    const avgLon = lonSum / group.length;

    // Determine max priority/severity
    const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    let maxPriority: PriorityLevel = 'medium';
    let maxVal = 0;

    for (const r of group) {
      const val = priorityOrder[r.priority] || 2;
      if (val > maxVal) {
        maxVal = val;
        maxPriority = r.priority;
      }
    }

    const clusterId = `CLUS-${Date.now()}`;
    const reason = `Grouped ${group.length} emergency report(s) within 3.0km radius and time window sharing category '${primary.emergency_type}' and location '${primary.location_text}'.`;

    const { data: newIncident, error: incErr } = await supabase
      .from('incidents')
      .insert({
        code,
        title,
        description: combinedDescription,
        emergency_type: primary.emergency_type,
        priority: maxPriority,
        severity: maxPriority,
        status: 'open',
        latitude: avgLat,
        longitude: avgLon,
        location_text: primary.location_text,
        affected_count: affected,
        trapped_count: trapped,
        injured_count: injured,
        vulnerable_count: vulnerable,
        cluster_id: clusterId,
        clustering_reason: reason,
        priority_reasons: [reason, `Max Severity Level: ${maxPriority.toUpperCase()}`],
        required_resources: primary.emergency_type === 'fire' ? ['Fire Truck', 'Ambulance'] : ['Rescue Unit'],
      })
      .select()
      .single();

    if (incErr) {
      console.error('Error creating incident from group:', incErr);
      return null;
    }

    // Link all reports in group to new incident
    for (const rep of group) {
      await this.linkReportToIncident(rep, newIncident.id, 0.5);
    }

    return newIncident as IncidentRow;
  }

  /**
   * Safely processes an unlinked report via deduplicating runClustering() engine.
   * If report is already linked to an incident, returns existing incident.
   * Prevents competing duplicate incident creation.
   */
  public async clusterReport(reportId: string): Promise<IncidentRow | null> {
    const { data: report, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !report) {
      throw new Error(`Report not found: ${error?.message || reportId}`);
    }

    // If report is already linked, return existing incident
    if (report.incident_id) {
      const { data: existingInc } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', report.incident_id)
        .single();
      return (existingInc as IncidentRow) || null;
    }

    // Execute deduplicating clustering engine across unlinked reports
    await this.runClustering();

    // Check if report was linked during clustering
    const { data: updatedReport } = await supabase
      .from('emergency_reports')
      .select('incident_id')
      .eq('id', reportId)
      .single();

    if (updatedReport?.incident_id) {
      const { data: inc } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', updatedReport.incident_id)
        .single();
      return (inc as IncidentRow) || null;
    }

    // If still unlinked (e.g. single report), group it safely into unified incident
    const newInc = await this.createIncidentFromGroup([report as RawReportRow]);
    return newInc;
  }
}

export const clusteringService = new ClusteringService();
