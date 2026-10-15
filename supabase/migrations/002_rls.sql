-- ============================================================================
-- 002_rls.sql: Row Level Security, Auth Trigger, and Access Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- HELPER FUNCTION: is_admin()
-- ----------------------------------------------------------------------------
-- Needed by policies to evaluate administrative privileges safely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- AUTH TRIGGER: handle_new_user()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_name text;
BEGIN
  -- Derive default full name from user metadata or email prefix
  v_default_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    'Volunteer'
  );

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, v_default_name, 'donor')
  ON CONFLICT (id) DO UPDATE
  SET full_name = CASE
                    WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name
                    ELSE public.profiles.full_name
                  END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- POLICIES: profiles
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- POLICIES: requests
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "requests_select_active_or_own_or_admin" ON public.requests;
CREATE POLICY "requests_select_active_or_own_or_admin" ON public.requests
  FOR SELECT
  USING (
    status != 'cancelled'
    OR requester_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "requests_insert_own" ON public.requests;
CREATE POLICY "requests_insert_own" ON public.requests
  FOR INSERT
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "requests_update_own_or_admin" ON public.requests;
CREATE POLICY "requests_update_own_or_admin" ON public.requests
  FOR UPDATE
  USING (requester_id = auth.uid() OR public.is_admin())
  WITH CHECK (requester_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "requests_delete_open_uncommitted" ON public.requests;
CREATE POLICY "requests_delete_open_uncommitted" ON public.requests
  FOR DELETE
  USING (
    requester_id = auth.uid()
    AND status = 'open'
    AND NOT EXISTS (
      SELECT 1 FROM public.offers WHERE request_id = requests.id
    )
  );

-- ----------------------------------------------------------------------------
-- POLICIES: request_contacts
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "request_contacts_select" ON public.request_contacts;
CREATE POLICY "request_contacts_select" ON public.request_contacts
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
    OR public.is_admin()
    OR request_id IN (
      SELECT request_id FROM public.offers
      WHERE donor_id = auth.uid()
        AND status IN ('accepted', 'dispatched', 'delivered')
    )
  );

DROP POLICY IF EXISTS "request_contacts_insert" ON public.request_contacts;
CREATE POLICY "request_contacts_insert" ON public.request_contacts
  FOR INSERT
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "request_contacts_update" ON public.request_contacts;
CREATE POLICY "request_contacts_update" ON public.request_contacts
  FOR UPDATE
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  )
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- POLICIES: request_items
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "request_items_select" ON public.request_items;
CREATE POLICY "request_items_select" ON public.request_items
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.requests
      WHERE status != 'cancelled'
         OR requester_id = auth.uid()
         OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "request_items_insert" ON public.request_items;
CREATE POLICY "request_items_insert" ON public.request_items
  FOR INSERT
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "request_items_update" ON public.request_items;
CREATE POLICY "request_items_update" ON public.request_items
  FOR UPDATE
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  )
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- POLICIES: collection_drives
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "collection_drives_select_public" ON public.collection_drives;
CREATE POLICY "collection_drives_select_public" ON public.collection_drives
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "collection_drives_insert" ON public.collection_drives;
CREATE POLICY "collection_drives_insert" ON public.collection_drives
  FOR INSERT
  WITH CHECK (collector_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "collection_drives_update" ON public.collection_drives;
CREATE POLICY "collection_drives_update" ON public.collection_drives
  FOR UPDATE
  USING (collector_id = auth.uid() OR public.is_admin())
  WITH CHECK (collector_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- POLICIES: offers (NO direct insert/update/delete — RPC only)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "offers_select_parties_or_admin" ON public.offers;
CREATE POLICY "offers_select_parties_or_admin" ON public.offers
  FOR SELECT
  USING (
    donor_id = auth.uid()
    OR public.is_admin()
    OR request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- POLICIES: offer_events
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "offer_events_select" ON public.offer_events;
CREATE POLICY "offer_events_select" ON public.offer_events
  FOR SELECT
  USING (
    offer_id IN (
      SELECT id FROM public.offers WHERE donor_id = auth.uid()
    )
    OR offer_id IN (
      SELECT id FROM public.offers
      WHERE request_id IN (
        SELECT id FROM public.requests WHERE requester_id = auth.uid()
      )
    )
    OR public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- POLICIES: notifications
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
