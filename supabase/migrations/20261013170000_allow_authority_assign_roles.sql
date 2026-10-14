-- ====================================================================
-- RESQNET - SAFE ROLE ASSIGNMENT BY AUTHORITIES & ADMINISTRATORS
-- Migration: 20261013170000_allow_authority_assign_roles.sql
-- ====================================================================

-- 1. Allow Authorities and Admins to update user profiles (assign roles)
-- Safe to run repeatedly (Idempotent)
DROP POLICY IF EXISTS "Authorities and Admins update profiles" ON public.profiles;
CREATE POLICY "Authorities and Admins update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('authority', 'admin'))
  WITH CHECK (public.get_auth_role() IN ('authority', 'admin'));

-- 2. Stored Procedure for explicit role assignment with audit logging
CREATE OR REPLACE FUNCTION public.assign_user_role(target_user_id UUID, new_role public.user_role)
RETURNS jsonb AS $$
DECLARE
  caller_role public.user_role;
  target_profile public.profiles%ROWTYPE;
BEGIN
  -- Strict caller verification
  caller_role := public.get_auth_role();
  IF caller_role NOT IN ('authority', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Authorities and Admins can assign roles.';
  END IF;

  -- Ensure target exists
  SELECT * INTO target_profile FROM public.profiles WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for ID %', target_user_id;
  END IF;

  -- Update target profile role
  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_role,
    action,
    target_entity,
    target_id,
    details
  ) VALUES (
    auth.uid(),
    caller_role,
    'USER_ROLE_ASSIGNMENT',
    'profiles',
    target_user_id::text,
    jsonb_build_object('assigned_role', new_role, 'target_email', target_profile.email)
  );

  RETURN jsonb_build_object('success', true, 'target_user_id', target_user_id, 'new_role', new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
