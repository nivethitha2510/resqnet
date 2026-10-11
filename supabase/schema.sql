-- ====================================================================
-- RESQNET — INTELLIGENT EMERGENCY RESPONSE NETWORK
-- DATABASE SCHEMA MIGRATION (PHASE 2 REAL SUPABASE FOUNDATION)
-- Safe to execute repeatedly (Idempotent Migration)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM DOMAIN TYPES / ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('citizen', 'authority', 'responder', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE emergency_type AS ENUM (
      'fire', 'flood', 'medical', 'road_accident',
      'building_collapse', 'cyclone_storm', 'landslide', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM (
      'submitted', 'ai_analyzed', 'verified', 'linked_to_incident', 'rejected'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM (
      'open', 'verifying', 'dispatching', 'en_route', 'on_scene', 'in_progress', 'resolved', 'closed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM (
      'fire_truck', 'ambulance', 'police_car', 'rescue_boat', 'hazmat_unit', 'drone_unit', 'heavy_rescue'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM (
      'available', 'assigned', 'en_route', 'on_scene', 'maintenance', 'offline'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ====================================================================
-- 3. TABLES DEFINITION (13 REQUIRED TABLES)
-- ====================================================================

-- TABLE 1: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'citizen',
    preferred_language TEXT NOT NULL DEFAULT 'en-US',
    badge_number TEXT,
    agency TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 2: emergency_reports
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number TEXT UNIQUE NOT NULL,
    citizen_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    emergency_type emergency_type NOT NULL,
    description TEXT,
    voice_transcript TEXT,
    input_language TEXT NOT NULL DEFAULT 'en-US',
    people_affected INT NOT NULL DEFAULT 0,
    people_injured INT NOT NULL DEFAULT 0,
    people_trapped INT NOT NULL DEFAULT 0,
    vulnerable_people INT NOT NULL DEFAULT 0,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_text TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    priority priority_level NOT NULL DEFAULT 'medium',
    status report_status NOT NULL DEFAULT 'submitted',
    ai_summary TEXT,
    ai_confidence DOUBLE PRECISION DEFAULT 0.0,
    incident_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 3: report_media
CREATE TABLE IF NOT EXISTS public.report_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'report-media',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 4: incidents
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    emergency_type emergency_type NOT NULL,
    priority priority_level NOT NULL DEFAULT 'medium',
    severity TEXT NOT NULL DEFAULT 'medium',
    status incident_status NOT NULL DEFAULT 'open',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_text TEXT NOT NULL,
    affected_count INT NOT NULL DEFAULT 0,
    trapped_count INT NOT NULL DEFAULT 0,
    injured_count INT NOT NULL DEFAULT 0,
    vulnerable_count INT NOT NULL DEFAULT 0,
    cluster_id TEXT,
    clustering_reason TEXT,
    priority_reasons TEXT[] DEFAULT '{}',
    required_resources TEXT[] DEFAULT '{}',
    system_priority priority_level,
    verification_status TEXT NOT NULL DEFAULT 'pending_review',
    authority_notes TEXT,
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign Key linking emergency_reports to incidents
ALTER TABLE public.emergency_reports DROP CONSTRAINT IF EXISTS fk_reports_incident;
ALTER TABLE public.emergency_reports 
  ADD CONSTRAINT fk_reports_incident 
  FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;

-- TABLE 5: incident_reports
CREATE TABLE IF NOT EXISTS public.incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    match_confidence DOUBLE PRECISION DEFAULT 1.0,
    UNIQUE(incident_id, report_id)
);

-- TABLE 6: incident_status_history
CREATE TABLE IF NOT EXISTS public.incident_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    previous_status incident_status,
    new_status incident_status NOT NULL,
    changed_by UUID REFERENCES public.profiles(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 7: vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_code TEXT UNIQUE NOT NULL,
    type vehicle_type NOT NULL,
    name TEXT NOT NULL,
    status vehicle_status NOT NULL DEFAULT 'available',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_text TEXT NOT NULL,
    assigned_incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    capacity INT DEFAULT 0,
    equipment_list TEXT[] DEFAULT '{}',
    contact_number TEXT,
    station_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 8: response_teams
CREATE TABLE IF NOT EXISTS public.response_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    agency TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    member_count INT NOT NULL DEFAULT 1,
    assigned_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    assigned_incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 9: incident_resources
CREATE TABLE IF NOT EXISTS public.incident_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    quantity_requested INT NOT NULL DEFAULT 1,
    quantity_dispatched INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'requested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 10: vehicle_status_history
CREATE TABLE IF NOT EXISTS public.vehicle_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    previous_status vehicle_status,
    new_status vehicle_status NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 11: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_role user_role,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    report_id UUID REFERENCES public.emergency_reports(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    type TEXT NOT NULL DEFAULT 'info',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 12: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_role user_role NOT NULL,
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 13: ai_audit_logs
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.emergency_reports(id) ON DELETE SET NULL,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    ai_module TEXT NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    recommendation JSONB NOT NULL,
    authority_action TEXT,
    authority_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ====================================================================
-- 4. INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_reports_citizen ON public.emergency_reports(citizen_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.emergency_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.emergency_reports(emergency_type);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON public.incidents(priority);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);


-- ====================================================================
-- 5. SECURITY HELPER FUNCTION (Prevents RLS Recursion)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- ====================================================================
-- 6. AUTH USER REGISTRATION TRIGGER (STEP 20 SECURITY RULE)
-- Automatic profile creation. MUST ALWAYS DEFAULT TO 'citizen' ROLE.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, preferred_language, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Citizen User'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en-US'),
    'citizen' -- ENFORCED: Public signup ALWAYS produces 'citizen' role!
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ====================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES ON ALL 13 TABLES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to safely drop existing policies during idempotent migrations
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- PROFILES POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Users can read own profile or privileged roles read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.get_auth_role() IN ('authority', 'responder', 'admin'));

CREATE POLICY "Users can update non-role profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = public.get_auth_role() -- Safe SECURITY DEFINER lookup prevents RLS recursion
  );

-- --------------------------------------------------------------------
-- EMERGENCY REPORTS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Citizens read own reports; Operators read all"
  ON public.emergency_reports FOR SELECT
  TO authenticated
  USING (citizen_id = auth.uid() OR public.get_auth_role() IN ('authority', 'responder', 'admin'));

CREATE POLICY "Authenticated citizens insert own report"
  ON public.emergency_reports FOR INSERT
  TO authenticated
  WITH CHECK (citizen_id = auth.uid());

CREATE POLICY "Authorities and Admins update reports"
  ON public.emergency_reports FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'))
  WITH CHECK (public.get_auth_role() IN ('authority', 'admin'));

-- --------------------------------------------------------------------
-- REPORT MEDIA POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Read report media for authorized reports"
  ON public.report_media FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.emergency_reports r 
      WHERE r.id = report_id AND (r.citizen_id = auth.uid() OR public.get_auth_role() IN ('authority', 'responder', 'admin'))
    )
  );

CREATE POLICY "Citizens insert media for own reports"
  ON public.report_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.emergency_reports r 
      WHERE r.id = report_id AND r.citizen_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------
-- INCIDENTS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Authenticated users view active/relevant incidents"
  ON public.incidents FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('authority', 'responder', 'admin') OR
    EXISTS (
      SELECT 1 FROM public.emergency_reports r 
      WHERE r.incident_id = public.incidents.id AND r.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Authorities and Admins insert/update incidents"
  ON public.incidents FOR ALL
  TO public
  USING (public.get_auth_role() IN ('authority', 'admin'))
  WITH CHECK (public.get_auth_role() IN ('authority', 'admin'));

-- --------------------------------------------------------------------
-- INCIDENT REPORTS & STATUS HISTORY POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Read incident reports mapping"
  ON public.incident_reports FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'responder', 'admin'));

CREATE POLICY "Manage incident reports mapping"
  ON public.incident_reports FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'));

CREATE POLICY "Read incident status history"
  ON public.incident_status_history FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'responder', 'admin'));

CREATE POLICY "Insert incident status history"
  ON public.incident_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.get_auth_role() IN ('authority', 'responder', 'admin'));

-- --------------------------------------------------------------------
-- VEHICLES & RESPONSE TEAMS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Read vehicles fleet or assigned to own incident"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('authority', 'responder', 'admin') OR
    EXISTS (
      SELECT 1 FROM public.incidents i
      JOIN public.emergency_reports r ON r.incident_id = i.id
      WHERE i.id = public.vehicles.assigned_incident_id AND r.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Manage vehicles fleet"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'))
  WITH CHECK (public.get_auth_role() IN ('authority', 'admin'));

CREATE POLICY "Update vehicle status"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'responder', 'admin'));

CREATE POLICY "Read response teams"
  ON public.response_teams FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'responder', 'admin'));

CREATE POLICY "Manage response teams"
  ON public.response_teams FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'));

-- --------------------------------------------------------------------
-- INCIDENT RESOURCES & VEHICLE HISTORY POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Read incident resources for own incident"
  ON public.incident_resources FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('authority', 'responder', 'admin') OR
    EXISTS (
      SELECT 1 FROM public.emergency_reports r
      WHERE r.incident_id = public.incident_resources.incident_id AND r.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Manage incident resources"
  ON public.incident_resources FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'));

CREATE POLICY "Read vehicle status history for own incident"
  ON public.vehicle_status_history FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('authority', 'responder', 'admin') OR
    EXISTS (
      SELECT 1 FROM public.emergency_reports r
      WHERE r.incident_id = public.vehicle_status_history.incident_id AND r.citizen_id = auth.uid()
    )
  );

CREATE POLICY "Insert vehicle status history"
  ON public.vehicle_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.get_auth_role() IN ('authority', 'responder', 'admin'));

-- --------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Users read own notifications or target role"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR target_role = public.get_auth_role() OR public.get_auth_role() = 'admin');

CREATE POLICY "Users update own notification read status"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------------------
-- AUDIT LOGS & AI AUDIT LOGS POLICIES
-- --------------------------------------------------------------------
CREATE POLICY "Authorities and Admins read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'));

CREATE POLICY "Authenticated users insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authorities and Admins read AI audit logs"
  ON public.ai_audit_logs FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'));

CREATE POLICY "Authorities and Admins insert AI audit logs"
  ON public.ai_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.get_auth_role() IN ('authority', 'admin'));

-- --------------------------------------------------------------------
-- 8. SUPABASE REALTIME PUBLICATION CONFIGURATION (PHASE 3G)
-- --------------------------------------------------------------------
ALTER TABLE public.vehicles REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.incident_resources REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_status_history REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_resources;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_status_history;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
