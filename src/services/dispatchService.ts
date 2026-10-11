/**
 * ResQNet - Real Dispatch Service (Phase 3G)
 * Handles authority dispatch of allocated emergency vehicles.
 * Enforces strict preconditions, authority security, atomic transitions,
 * double-dispatch protection, vehicle status history, and audit logging.
 */

import { supabase } from '../lib/supabase';

export interface DispatchResult {
  success: boolean;
  incident_id: string;
  vehicle_id: string;
  vehicle_code: string;
  previous_status: 'assigned';
  new_status: 'en_route';
  resource_id: string;
  dispatched_at: string;
}

class DispatchService {
  /**
   * Authority Dispatch Action.
   * Transitions allocated vehicle from status 'assigned' -> 'en_route'.
   */
  public async dispatchResource(
    incidentId: string,
    vehicleId: string,
    customClient?: any
  ): Promise<DispatchResult> {
    const client = customClient || supabase;

    // 1. Auth & Role Verification
    const { data: { user }, error: userErr } = await client.auth.getUser();
    if (userErr || !user) {
      throw new Error('401 Unauthorized: Authentication required for vehicle dispatch.');
    }

    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !['authority', 'admin'].includes(profile.role)) {
      throw new Error('401 Unauthorized: User role cannot perform vehicle dispatch.');
    }

    // 2. Precondition 1: Validate Incident Existence
    const { data: incident, error: incErr } = await client
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (incErr || !incident) {
      throw new Error(`Precondition Failed: Incident ${incidentId} not found.`);
    }

    // 3. Precondition 2 & Double-Dispatch Protection: Check Vehicle State & Allocation
    const { data: vehicle, error: vehErr } = await client
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();

    if (vehErr || !vehicle) {
      throw new Error(`Precondition Failed: Vehicle ${vehicleId} not found.`);
    }

    // Check if vehicle is allocated to this incident
    if (vehicle.assigned_incident_id !== incidentId) {
      throw new Error(
        `Precondition Failed: Vehicle ${vehicle.vehicle_code} is not allocated to incident ${incident.code}.`
      );
    }

    // Check if vehicle is in 'assigned' status (cannot dispatch if already 'en_route', 'available', etc.)
    if (vehicle.status !== 'assigned') {
      throw new Error(
        `Conflict / Precondition Error: Vehicle ${vehicle.vehicle_code} is currently in state '${vehicle.status}' (expected 'assigned').`
      );
    }

    // Check allocation row in public.incident_resources
    const { data: resourceRow, error: resFindErr } = await client
      .from('incident_resources')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('resource_type', vehicle.type)
      .eq('status', 'assigned')
      .single();

    if (resFindErr || !resourceRow) {
      throw new Error(
        `Precondition Failed: No active allocation record in 'assigned' state found for vehicle type ${vehicle.type}.`
      );
    }

    // 4. ATOMIC / CONDITIONAL STATE TRANSITION
    // Update vehicle status from 'assigned' -> 'en_route' ONLY IF status is still 'assigned'
    const timestamp = new Date().toISOString();

    const { data: updatedVehicles, error: vehUpdateErr } = await client
      .from('vehicles')
      .update({
        status: 'en_route',
        updated_at: timestamp,
      })
      .eq('id', vehicleId)
      .eq('status', 'assigned') // Conditional match guarantees atomic double-dispatch protection!
      .select();

    if (vehUpdateErr || !updatedVehicles || updatedVehicles.length === 0) {
      throw new Error(
        `Double Dispatch Conflict: Vehicle ${vehicle.vehicle_code} could not be dispatched. Status may have been updated concurrently.`
      );
    }

    // 5. Update incident_resources status to 'dispatched'
    const { error: resUpdateErr } = await client
      .from('incident_resources')
      .update({
        status: 'dispatched',
        quantity_dispatched: resourceRow.quantity_requested,
      })
      .eq('id', resourceRow.id);

    if (resUpdateErr) {
      console.error('Failed to update incident_resources status:', resUpdateErr);
    }

    // 6. Update Incident Status to 'en_route' (if current status is open/verifying/dispatching)
    if (['open', 'verifying', 'dispatching'].includes(incident.status)) {
      await client
        .from('incidents')
        .update({
          status: 'en_route',
          updated_at: timestamp,
        })
        .eq('id', incidentId);
    }

    // 7. Insert Vehicle Status History Record
    await client.from('vehicle_status_history').insert({
      vehicle_id: vehicleId,
      incident_id: incidentId,
      previous_status: 'assigned',
      new_status: 'en_route',
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      created_at: timestamp,
    });

    // 8. Insert Immutable Audit Log
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_role: profile.role,
      action: 'RESOURCE_DISPATCHED',
      target_entity: 'incident_resources',
      target_id: resourceRow.id,
      details: {
        incident_id: incidentId,
        incident_code: incident.code,
        vehicle_id: vehicleId,
        vehicle_code: vehicle.vehicle_code,
        previous_status: 'assigned',
        new_status: 'en_route',
        operational_priority: incident.priority,
        timestamp,
      },
    });

    // 9. Send Notification to target role ('responder' / 'authority')
    await client.from('notifications').insert({
      target_role: 'responder',
      title: `DISPATCH ALERT: Unit ${vehicle.vehicle_code}`,
      message: `Vehicle ${vehicle.vehicle_code} dispatched to incident ${incident.code} (${incident.title})`,
      incident_id: incidentId,
      type: 'dispatch',
      is_read: false,
    });

    return {
      success: true,
      incident_id: incidentId,
      vehicle_id: vehicleId,
      vehicle_code: vehicle.vehicle_code,
      previous_status: 'assigned',
      new_status: 'en_route',
      resource_id: resourceRow.id,
      dispatched_at: timestamp,
    };
  }
}

export const dispatchService = new DispatchService();
