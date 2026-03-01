-- Enable RLS for swap_pairs
ALTER TABLE public.swap_pairs ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users and service roles
CREATE POLICY "Public read for authenticated users" ON public.swap_pairs
    FOR SELECT
    TO authenticated, service_role
    USING (true);

-- Allow admins to manage swap pairs
CREATE POLICY "Admins can manage swap pairs" ON public.swap_pairs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );
