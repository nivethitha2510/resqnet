/**
 * ResQNet - Domain Data Schemas & Types
 * Database-ready TypeScript definitions for Supabase / PostgreSQL schema integration.
 */

export type UserRole = 'citizen' | 'authority' | 'responder' | 'admin';

export type EmergencyType = 
  | 'fire'
  | 'flood'
  | 'medical'
  | 'road_accident'
  | 'building_collapse'
  | 'cyclone_storm'
  | 'landslide'
  | 'other';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ReportStatus = 
  | 'submitted'
  | 'ai_analyzed'
  | 'verified'
  | 'linked_to_incident'
  | 'rejected';

export type IncidentStatus = 
  | 'open'
  | 'verifying'
  | 'dispatching'
  | 'en_route'
  | 'on_scene'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export type VehicleType = 
  | 'fire_truck'
  | 'ambulance'
  | 'police_car'
  | 'rescue_boat'
  | 'hazmat_unit'
  | 'drone_unit'
  | 'heavy_rescue';

export type VehicleStatus = 
  | 'available'
  | 'assigned'
  | 'en_route'
  | 'on_scene'
  | 'maintenance'
  | 'offline';

export type LanguageCode = 'ta-IN' | 'en-US' | 'hi-IN';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
  landmark?: string;
  city?: string;
  district?: string;
}

export interface Profile {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
  role: UserRole;
  badge_number?: string;
  agency?: string;
  preferred_language: LanguageCode;
  created_at: string;
  updated_at: string;
}

export interface ReportMedia {
  id: string;
  report_id: string;
  file_path: string;
  file_type: 'image' | 'video' | 'audio';
  storage_bucket: string;
  created_at: string;
}

export interface EmergencyReport {
  id: string;
  report_number?: string;
  citizen_id?: string;
  citizen_name?: string;
  citizen_phone?: string;
  emergency_type: EmergencyType;
  raw_text?: string;
  voice_transcript?: string;
  input_language: LanguageCode;
  location: LocationCoordinates;
  status: ReportStatus;
  
  // AI Extracted Details
  ai_summary?: string;
  affected_people_count: number;
  trapped_people_count: number;
  injured_people_count: number;
  vulnerable_people_count: number; // elderly, children, disabled
  calculated_priority: PriorityLevel;
  ai_confidence_score: number; // 0.0 - 1.0
  evidence_snippets: string[];
  
  incident_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  code: string; // e.g. INC-2026-8941
  title: string;
  description: string;
  emergency_type: EmergencyType;
  priority: PriorityLevel;
  status: IncidentStatus;
  location: LocationCoordinates;
  
  // AI Aggregated & Human Verified Stats
  affected_count: number;
  trapped_count: number;
  injured_count: number;
  vulnerable_count: number;
  
  // Clustering & Explainability
  cluster_id?: string;
  clustering_reason?: string;
  priority_reasons: string[];
  required_resources: string[];
  
  // Recommended & Assigned Units
  recommended_vehicle_ids: string[];
  assigned_vehicle_ids: string[];
  assigned_team_ids: string[];
  
  verified_by?: string;
  verified_at?: string;
  system_priority?: PriorityLevel;
  verification_status?: 'pending_review' | 'approved' | 'modified' | 'rejected';
  authority_notes?: string;
  resolved_at?: string;

  created_at: string;
  updated_at: string;
}

export interface IncidentReport {
  id: string;
  incident_id: string;
  report_id: string;
  linked_at: string;
  match_confidence: number;
}

export interface IncidentStatusHistory {
  id: string;
  incident_id: string;
  status: IncidentStatus;
  changed_by: string;
  notes?: string;
  timestamp: string;
}

export interface Vehicle {
  id: string;
  vehicle_code: string; // e.g. ENG-01, AMB-04
  type: VehicleType;
  name: string;
  status: VehicleStatus;
  current_location: LocationCoordinates;
  assigned_incident_id?: string;
  capacity: number;
  equipment_list: string[];
  contact_number?: string;
  station_name?: string;
  updated_at: string;
}

export interface ResponseTeam {
  id: string;
  team_name: string;
  agency: string;
  leader_name: string;
  contact_phone: string;
  member_count: number;
  assigned_vehicle_id?: string;
  assigned_incident_id?: string;
  status: 'available' | 'deployed' | 'standby' | 'off_duty';
  updated_at: string;
}

export interface IncidentResource {
  id: string;
  incident_id: string;
  resource_type: string;
  quantity_requested: number;
  quantity_dispatched: number;
  status: 'requested' | 'approved' | 'dispatched' | 'delivered';
  created_at: string;
}

export interface VehicleStatusHistory {
  id: string;
  vehicle_id: string;
  incident_id?: string;
  status: VehicleStatus;
  location: LocationCoordinates;
  timestamp: string;
}

export interface Notification {
  id: string;
  user_id?: string;
  target_role?: UserRole;
  title: string;
  message: string;
  incident_id?: string;
  report_id?: string;
  is_read: boolean;
  type: 'info' | 'alert' | 'dispatch' | 'status_change';
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_role: UserRole;
  action: string;
  target_entity: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  timestamp: string;
}

export interface AIAuditLog {
  id: string;
  report_id?: string;
  incident_id?: string;
  ai_module: 'aiService' | 'clusteringService' | 'priorityService' | 'vehicleAllocationService';
  input_prompt_tokens?: number;
  output_tokens?: number;
  confidence_score: number;
  recommendation: Record<string, unknown>;
  authority_action?: 'approved' | 'modified' | 'rejected';
  authority_notes?: string;
  timestamp: string;
}
