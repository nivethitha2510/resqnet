-- ====================================================================
-- RESQNET — DATABASE MIGRATION: AUTH & PROFILES RLS FIX
-- Safe to execute repeatedly (Idempotent Migration)
-- ====================================================================

-- 1. Ensure public.profiles has an INSERT policy for authenticated citizens
DROP POLICY IF EXISTS "Users can insert own citizen profile" ON public.profiles;
CREATE POLICY "Users can insert own citizen profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id AND
    role = 'citizen'
  );

-- 2. Ensure trigger handle_new_user safely defaults email and role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, preferred_language, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Citizen User'),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en-US'),
    'citizen' -- ENFORCED: Public signup ALWAYS produces 'citizen' role
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
