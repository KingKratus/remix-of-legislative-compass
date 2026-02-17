-- Explicitly deny direct inserts to profiles (created via trigger only)
CREATE POLICY "Profiles created via trigger only" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (false);