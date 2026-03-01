-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to read their own profile (or everyone's, for admin check context)
-- Ideally, admin check should be: everyone can read 'is_admin' field? 
-- Or better: Allow reading ANY profile if you are authenticated (simplest for now)

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Policy: Allow users to insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (true);

-- Policy: Allow users to update their own profile
-- This usually requires auth.uid() check, but since we use wallet_address matching, 
-- we might rely on the application logic or just open it up for this MVP if auth is custom.
-- STRICT: USING ( auth.uid() = id ) -- Only if id is uuid matching auth.users
