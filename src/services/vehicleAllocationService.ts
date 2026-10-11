/**
 * ResQNet - Real Vehicle & Resource Allocation Service (Phase 3F)
 * Provides deterministic suitability ranking and authority resource allocation.
 * Enforces PostgreSQL RLS, role checks, double-allocation protection,
 * and immutable audit logging.
 */

import { supabase } from '../lib/supabase';
import type { Incident, Vehicle, VehicleType, PriorityLevel } from '../types/domain';

export interface ResourceRecommendation {
  capability: VehicleType;
  status: 'recommended' | 'no_suitable_resource';
  message?: string;
  vehicle?: {
    id: string;
    vehicle_code: string;
    name: string;
    type: VehicleType;
    status: string;
    distance_km: number | null;
    estimated_eta_minutes: number | null;
    suitability_score: number;
    match_reasons: string[];
    station_name?: string;
    capacity?: number;
    equipment_list?: string[];
  };
  alternative_vehicles?: Array<{
    id: string;
    vehicle_code: string;
    name: string;
    type: VehicleType;
    distance_km: number | null;
    suitability_score: number;
    match_reasons: string[];
  }>;
}

export interface IncidentAllocationSummary {
  incident_id: string;
  incident_code: string;
  operational_priority: PriorityLevel;
  verification_status: string;
  required_capabilities: VehicleType[];
  recommendations: ResourceRecommendation[];
}

class VehicleAllocationService {
  /**
   * Calculates Haversine distance in kilometers between two lat/lng coordinates.
   */
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2 || (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) {
      return -1; // Distance unavailable
    }
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  /**
   * Maps required resource strings or emergency type to structured VehicleType capabilities.
   */
  public getRequiredCapabilities(incident: { emergency_type: string; required_resources?: string[]; injured_count?: number; trapped_count?: number }): VehicleType[] {
    const requiredSet = new Set<VehicleType>();

    // 1. Map explicit required_resources if present
    if (incident.required_resources && incident.required_resources.length > 0) {
      for (const res of incident.required_resources) {
        const lower = res.toLowerCase().trim();
        if (lower.includes('fire') || lower === 'fire_truck') requiredSet.add('fire_truck');
        else if (lower.includes('amb') || lower.includes('med') || lower === 'ambulance') requiredSet.add('ambulance');
        else if (lower.includes('boat') || lower.includes('water') || lower === 'rescue_boat') requiredSet.add('rescue_boat');
        else if (lower.includes('heavy') || lower.includes('rescue_unit') || lower.includes('extraction') || lower === 'heavy_rescue') requiredSet.add('heavy_rescue');
        else if (lower.includes('police') || lower === 'police_car') requiredSet.add('police_car');
        else if (lower.includes('hazmat') || lower === 'hazmat_unit') requiredSet.add('hazmat_unit');
        else if (lower.includes('drone') || lower === 'drone_unit') requiredSet.add('drone_unit');
      }
    }

    // 2. If no required resources extracted or specified, infer from emergency_type
    if (requiredSet.size === 0) {
      switch (incident.emergency_type) {
        case 'fire':
          requiredSet.add('fire_truck');
          break;
        case 'medical':
          requiredSet.add('ambulance');
          break;
        case 'building_collapse':
          requiredSet.add('heavy_rescue');
          requiredSet.add('ambulance');
          break;
        case 'flood':
          requiredSet.add('rescue_boat');
          break;
        case 'road_accident':
          requiredSet.add('ambulance');
          requiredSet.add('police_car');
          break;
        case 'cyclone_storm':
          requiredSet.add('rescue_boat');
          requiredSet.add('heavy_rescue');
          break;
        case 'landslide':
          requiredSet.add('heavy_rescue');
          break;
        default:
          requiredSet.add('police_car');
          break;
      }
    }

    // 3. Casualty check: if injured or trapped count > 0, ensure ambulance is requested
    if ((incident.injured_count && incident.injured_count > 0) || (incident.trapped_count && incident.trapped_count > 0)) {
      requiredSet.add('ambulance');
    }

    return Array.from(requiredSet);
  }

  /**
   * Deterministically calculates suitability score (0-100) for a candidate vehicle matching a capability.
   */
  public calculateSuitabilityScore(
    vehicle: Vehicle,
    requiredType: VehicleType,
    incident: { latitude: number; longitude: number; priority: PriorityLevel; verification_status?: string; system_priority?: PriorityLevel }
  ): { score: number; distanceKm: number | null; etaMinutes: number | null; reasons: string[] } {
    const reasons: string[] = [];

    // Strict Capability Check
    if (vehicle.type !== requiredType) {
      return { score: 0, distanceKm: null, etaMinutes: null, reasons: ['Incompatible vehicle capability'] };
    }

    // Strict Availability Check
    if (vehicle.status !== 'available' || vehicle.assigned_incident_id) {
      return { score: 0, distanceKm: null, etaMinutes: null, reasons: ['Vehicle is currently unavailable or assigned'] };
    }

    let score = 40; // Base score for capability match
    reasons.push(`Capability Match (${vehicle.type.replace('_', ' ').toUpperCase()})`);

    // Availability Score
    score += 30;
    reasons.push('Unit is Available');

    // Distance Calculation
    const distKm = this.calculateDistanceKm(vehicle.current_location.latitude, vehicle.current_location.longitude, incident.latitude, incident.longitude);
    let etaMinutes: number | null = null;

    if (distKm >= 0) {
      etaMinutes = Math.max(2, Math.round(distKm * 2.5));
      const distScore = Math.max(0, Math.round(20 - distKm));
      score += distScore;
      reasons.push(`Distance ~${distKm} km (ETA ~${etaMinutes} mins)`);
    } else {
      reasons.push('Location distance unavailable');
    }

    // Operational Priority Weight (Uses Phase 3E Verified Priority)
    const operationalPriority = incident.priority;
    switch (operationalPriority) {
      case 'critical':
        score += 10;
        reasons.push('High Priority Weight (CRITICAL Incident)');
        break;
      case 'high':
        score += 7;
        reasons.push('Priority Weight (HIGH Incident)');
        break;
      case 'medium':
        score += 4;
        break;
      case 'low':
        score += 2;
        break;
    }

    // Equipment / Capacity Bonus
    if (vehicle.capacity && vehicle.capacity >= 4) {
      score += 5;
      reasons.push(`High Capacity Unit (${vehicle.capacity} seats)`);
    }

    const finalScore = Math.min(100, Math.max(0, score));
    return { score: finalScore, distanceKm: distKm >= 0 ? distKm : null, etaMinutes, reasons };
  }

  /**
   * Generates resource allocation recommendations for an incident.
   */
  public generateRecommendations(incident: Incident, availableVehicles: Vehicle[]): IncidentAllocationSummary {
    const requiredCaps = this.getRequiredCapabilities({
      emergency_type: incident.emergency_type,
      required_resources: incident.required_resources,
      injured_count: incident.injured_count,
      trapped_count: incident.trapped_count,
    });

    const recommendations: ResourceRecommendation[] = [];

    for (const cap of requiredCaps) {
      // Filter vehicles strictly matching this capability and available
      const matching = availableVehicles
        .map((v) => {
          const evalResult = this.calculateSuitabilityScore(v, cap, {
            latitude: incident.location.latitude,
            longitude: incident.location.longitude,
            priority: incident.priority,
            verification_status: incident.verification_status,
            system_priority: incident.system_priority,
          });
          return { vehicle: v, evalResult };
        })
        .filter((item) => item.evalResult.score > 0)
        .sort((a, b) => b.evalResult.score - a.evalResult.score);

      if (matching.length === 0) {
        recommendations.push({
          capability: cap,
          status: 'no_suitable_resource',
          message: `No suitable available local resource for capability: ${cap.replace('_', ' ').toUpperCase()}`,
        });
      } else {
        const topMatch = matching[0];
        const alternatives = matching.slice(1).map((item) => ({
          id: item.vehicle.id,
          vehicle_code: item.vehicle.vehicle_code,
          name: item.vehicle.name,
          type: item.vehicle.type,
          distance_km: item.evalResult.distanceKm,
          suitability_score: item.evalResult.score,
          match_reasons: item.evalResult.reasons,
        }));

        recommendations.push({
          capability: cap,
          status: 'recommended',
          vehicle: {
            id: topMatch.vehicle.id,
            vehicle_code: topMatch.vehicle.vehicle_code,
            name: topMatch.vehicle.name,
            type: topMatch.vehicle.type,
            status: topMatch.vehicle.status,
            distance_km: topMatch.evalResult.distanceKm,
            estimated_eta_minutes: topMatch.evalResult.etaMinutes,
            suitability_score: topMatch.evalResult.score,
            match_reasons: topMatch.evalResult.reasons,
            station_name: topMatch.vehicle.station_name,
            capacity: topMatch.vehicle.capacity,
            equipment_list: topMatch.vehicle.equipment_list,
          },
          alternative_vehicles: alternatives,
        });
      }
    }

    return {
      incident_id: incident.id,
      incident_code: incident.code,
      operational_priority: incident.priority,
      verification_status: incident.verification_status || 'pending_review',
      required_capabilities: requiredCaps,
      recommendations,
    };
  }

  /**
   * Fetches real incident and vehicles from Supabase DB and returns suitability recommendations.
   */
  public async getIncidentRecommendationsFromDB(incidentId: string, customClient?: any): Promise<IncidentAllocationSummary> {
    const client = customClient || supabase;
    const { data: incidentRow, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incidentRow) {
      throw new Error(`Incident not found: ${incErr?.message || incidentId}`);
    }

    const { data: vehicleRows, error: vehErr } = await client
      .from('vehicles')
      .select('*');

    if (vehErr) {
      throw new Error(`Failed to load vehicle fleet: ${vehErr.message}`);
    }

    const formattedIncident: Incident = {
      id: incidentRow.id,
      code: incidentRow.code,
      title: incidentRow.title,
      description: incidentRow.description,
      emergency_type: incidentRow.emergency_type,
      priority: incidentRow.priority,
      status: incidentRow.status,
      location: {
        latitude: incidentRow.latitude,
        longitude: incidentRow.longitude,
        address: incidentRow.location_text,
      },
      affected_count: incidentRow.affected_count,
      trapped_count: incidentRow.trapped_count,
      injured_count: incidentRow.injured_count,
      vulnerable_count: incidentRow.vulnerable_count,
      priority_reasons: incidentRow.priority_reasons || [],
      required_resources: incidentRow.required_resources || [],
      recommended_vehicle_ids: [],
      assigned_vehicle_ids: [],
      assigned_team_ids: [],
      system_priority: incidentRow.system_priority,
      verification_status: incidentRow.verification_status,
      authority_notes: incidentRow.authority_notes,
      created_at: incidentRow.created_at,
      updated_at: incidentRow.updated_at,
    };

    const formattedVehicles: Vehicle[] = (vehicleRows || []).map((v: any) => ({
      id: v.id,
      vehicle_code: v.vehicle_code,
      type: v.type,
      name: v.name,
      status: v.status,
      current_location: {
        latitude: v.latitude,
        longitude: v.longitude,
        address: v.location_text,
      },
      assigned_incident_id: v.assigned_incident_id,
      capacity: v.capacity || 0,
      equipment_list: v.equipment_list || [],
      contact_number: v.contact_number,
      station_name: v.station_name,
      updated_at: v.updated_at,
    }));

    return this.generateRecommendations(formattedIncident, formattedVehicles);
  }

  /**
   * Authority Resource Allocation Action.
   * Allocates a vehicle to an incident in Supabase PostgreSQL database.
   * Enforces role security, double-allocation protection, vehicle status history, and audit logging.
   */
  public async allocateResource(
    incidentId: string,
    vehicleId: string,
    customClient?: any
  ): Promise<{ success: boolean; resource_id: string; vehicle_code: string }> {
    const client = customClient || supabase;

    // 1. Auth & Role Verification
    const { data: { user }, error: userErr } = await client.auth.getUser();
    if (userErr || !user) {
      throw new Error('401 Unauthorized: Authentication required for resource allocation.');
    }

    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !['authority', 'admin'].includes(profile.role)) {
      throw new Error('401 Unauthorized: User role cannot perform vehicle allocation.');
    }

    // 2. Fetch Incident and Operational Priority
    const { data: incident, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incident) {
      throw new Error(`Incident ${incidentId} not found.`);
    }

    // 3. Double Allocation Protection: Fetch Vehicle State
    const { data: vehicle, error: vehErr } = await client
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();

    if (vehErr || !vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found.`);
    }

    if (vehicle.status !== 'available' || vehicle.assigned_incident_id !== null) {
      throw new Error(
        `Double Allocation Error: Vehicle ${vehicle.vehicle_code} is currently ${vehicle.status} and cannot be assigned.`
      );
    }

    // 4. Update Vehicle State in Database: status = 'assigned', assigned_incident_id = incidentId
    const { error: vehUpdateErr } = await client
      .from('vehicles')
      .update({
        status: 'assigned',
        assigned_incident_id: incidentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicleId);

    if (vehUpdateErr) {
      throw new Error(`Failed to update vehicle status: ${vehUpdateErr.message}`);
    }

    // 5. Insert Allocation Row into public.incident_resources
    const { data: resourceRow, error: resErr } = await client
      .from('incident_resources')
      .insert({
        incident_id: incidentId,
        resource_type: vehicle.type,
        quantity_requested: 1,
        quantity_dispatched: 1,
        status: 'assigned',
      })
      .select()
      .single();

    if (resErr || !resourceRow) {
      // Rollback vehicle update if resource insertion failed
      await client.from('vehicles').update({ status: 'available', assigned_incident_id: null }).eq('id', vehicleId);
      throw new Error(`Failed to insert incident resource allocation record: ${resErr?.message}`);
    }

    // 6. Record Vehicle Status History
    await client.from('vehicle_status_history').insert({
      vehicle_id: vehicleId,
      incident_id: incidentId,
      previous_status: 'available',
      new_status: 'assigned',
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
    });

    // 7. Audit Log in public.audit_logs
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_role: profile.role,
      action: 'RESOURCE_ALLOCATED',
      target_entity: 'incident_resources',
      target_id: resourceRow.id,
      details: {
        incident_id: incidentId,
        incident_code: incident.code,
        vehicle_id: vehicleId,
        vehicle_code: vehicle.vehicle_code,
        vehicle_type: vehicle.type,
        operational_priority: incident.priority,
        verification_status: incident.verification_status,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      resource_id: resourceRow.id,
      vehicle_code: vehicle.vehicle_code,
    };
  }

  /**
   * Authority Resource Deallocation Action.
   * Releases an assigned vehicle from an incident.
   */
  public async deallocateResource(
    incidentId: string,
    vehicleId: string,
    customClient?: any
  ): Promise<{ success: boolean }> {
    const client = customClient || supabase;

    // Auth check
    const { data: { user }, error: userErr } = await client.auth.getUser();
    if (userErr || !user) {
      throw new Error('401 Unauthorized: Authentication required for deallocation.');
    }

    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['authority', 'admin'].includes(profile.role)) {
      throw new Error('401 Unauthorized: User role cannot perform vehicle deallocation.');
    }

    // Fetch vehicle
    const { data: vehicle } = await client.from('vehicles').select('*').eq('id', vehicleId).single();
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found.`);

    // Release vehicle
    await client
      .from('vehicles')
      .update({ status: 'available', assigned_incident_id: null, updated_at: new Date().toISOString() })
      .eq('id', vehicleId);

    // Update incident_resources
    await client
      .from('incident_resources')
      .update({ status: 'released' })
      .eq('incident_id', incidentId)
      .eq('resource_type', vehicle.type);

    // Record status history
    await client.from('vehicle_status_history').insert({
      vehicle_id: vehicleId,
      incident_id: incidentId,
      previous_status: 'assigned',
      new_status: 'available',
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
    });

    // Audit log
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_role: profile.role,
      action: 'RESOURCE_DEALLOCATED',
      target_entity: 'incident_resources',
      target_id: incidentId,
      details: {
        vehicle_id: vehicleId,
        vehicle_code: vehicle.vehicle_code,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true };
  }
}

export const vehicleAllocationService = new VehicleAllocationService();
