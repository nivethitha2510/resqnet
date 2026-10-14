-- ====================================================================
-- RESQNET - REALTIME PUBLICATION, RLS PERMISSIONS & OPERATIONAL SYNC
-- Safe idempotent migration
-- ====================================================================

-- 1. Enable Full Replica Identity for Realtime CDC
ALTER TABLE public.emergency_reports REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.vehicles REPLICA IDENTITY FULL;
ALTER TABLE public.incident_resources REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_status_history REPLICA IDENTITY FULL;

-- 2. Add Tables to supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_reports') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_reports;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'incidents') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'incident_resources') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_resources;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_status_history') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_status_history;
    END IF;
  END IF;
END $$;

-- 3. Fix Incidents RLS: Allow Responders to Update Tactical Incident Status
DROP POLICY IF EXISTS "Authorities and Admins insert/update incidents" ON public.incidents;
DROP POLICY IF EXISTS "Authorities and Admins manage incidents" ON public.incidents;
DROP POLICY IF EXISTS "Responders update tactical incident status" ON public.incidents;

CREATE POLICY "Authorities and Admins manage incidents"
  ON public.incidents FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'))
  WITH CHECK (public.get_auth_role() IN ('authority', 'admin'));

CREATE POLICY "Responders update tactical incident status"
  ON public.incidents FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() = 'responder')
  WITH CHECK (public.get_auth_role() = 'responder');

-- 4. Fix Emergency Reports RLS: Allow Responders to Update Status (e.g. resolve)
DROP POLICY IF EXISTS "Authorities and Admins update reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "Authorities, Responders, and Admins update reports" ON public.emergency_reports;

CREATE POLICY "Authorities, Responders, and Admins update reports"
  ON public.emergency_reports FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'responder', 'admin'))
  WITH CHECK (public.get_auth_role() IN ('authority', 'responder', 'admin'));

-- 5. Fix Notifications RLS: Allow Citizens to Read Incident Notifications
DROP POLICY IF EXISTS "Users read own notifications or target role" ON public.notifications;
DROP POLICY IF EXISTS "Users read own notifications or target role or related incident" ON public.notifications;

CREATE POLICY "Users read own notifications or target role or related incident"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    target_role = public.get_auth_role() OR
    public.get_auth_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.emergency_reports r
      WHERE (r.incident_id = public.notifications.incident_id OR r.id = public.notifications.report_id)
        AND r.citizen_id = auth.uid()
    )
  );

-- 6. Seed Available Vehicles Fleet (for all emergency capabilities)
INSERT INTO public.vehicles (vehicle_code, type, name, status, latitude, longitude, location_text, capacity, equipment_list, contact_number, station_name)
VALUES
  ('ENG-101', 'fire_truck', 'Chennai Central Fire Engine 1', 'available', 13.0780, 80.2650, 'Egmore Fire Station', 4500, ARRAY['Hydraulic Cutter', 'Thermal Imager', 'Foam Ejector', 'Breathing Apparatus'], '+91 98400 11101', 'Egmore Fire Station'),
  ('AMB-402', 'ambulance', '108 Advanced Life Support Unit 4', 'available', 13.0720, 80.2580, 'Kilpauk Medical Center', 2, ARRAY['Defibrillator', 'Oxygen Respirator', 'ECG Monitor', 'Trauma Kit'], '+91 98400 11102', 'Kilpauk Medical Center'),
  ('RSC-BOAT-02', 'rescue_boat', 'Disaster Relief Rescue Craft B-2', 'available', 13.0450, 80.2380, 'Velachery Relief Station', 8, ARRAY['Outboard Motor', 'Life Jackets', 'Floodlights', 'Medical First Aid'], '+91 98400 11103', 'Velachery Relief Station'),
  ('PAT-901', 'police_car', 'Traffic Control & Perimeter Unit 9', 'available', 13.0600, 80.2450, 'Nungambakkam High Road', 4, ARRAY['Megaphone', 'Traffic Cones', 'Barricade Tape'], '+91 98400 11104', 'Nungambakkam Police Station'),
  ('HVY-505', 'heavy_rescue', 'Heavy Urban Search & Rescue Unit 5', 'available', 13.0850, 80.2750, 'Central Rescue Depot', 6, ARRAY['Concrete Breaker', 'Search Cam', 'Air Bags', 'Shoring Jacks'], '+91 98400 11105', 'Central Rescue Depot')
ON CONFLICT (vehicle_code) DO UPDATE SET
  status = 'available',
  assigned_incident_id = NULL,
  updated_at = now();

-- 7. Seed Response Teams
INSERT INTO public.response_teams (team_name, agency, leader_name, contact_phone, member_count, status)
VALUES
  ('Alpha Fire Squad', 'Fire & Rescue Services', 'Commander M. Selvam', '+91 98401 22201', 6, 'available'),
  ('Flood Response Team Beta', 'State Disaster Response Force', 'Capt. R. Narayanan', '+91 98401 22202', 8, 'available'),
  ('Paramedic Rapid Response 3', 'Emergency Medical Services', 'Dr. S. Meenakshi', '+91 98401 22203', 4, 'available'),
  ('Urban Search & Rescue Delta', 'Civil Defense Force', 'Major K. Balaji', '+91 98401 22204', 10, 'available')
ON CONFLICT DO NOTHING;
