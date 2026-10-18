-- ============================================================================
-- 009_allow_calls_and_contact_settings.sql: Call Button Preference & Contact Privacy
-- ============================================================================
-- IMPORTANT FOR DEPLOYMENT:
-- This migration hardens contact number privacy and adds owner-controlled
-- 'allow_calls' preferences.
--
-- BACKWARD-COMPATIBILITY SAFEGUARD:
-- 1. Existing rows are initially given 'allow_calls = false' so historical
--    records do NOT unintentionally expose phone numbers without user consent.
-- 2. The column default is then set to 'true' for newly created records going forward.
-- ============================================================================

-- 1. Ensure phone column exists in public.profiles (originally defined in 001_schema.sql)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. Add owner-controlled allow_calls setting to public.requests
--    Existing rows get false; future rows default to true.
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS allow_calls boolean DEFAULT false;

ALTER TABLE public.requests
  ALTER COLUMN allow_calls SET DEFAULT true;

-- 3. Add owner-controlled allow_calls setting to public.collection_drives
--    Existing rows get false; future rows default to true.
ALTER TABLE public.collection_drives
  ADD COLUMN IF NOT EXISTS allow_calls boolean DEFAULT false;

ALTER TABLE public.collection_drives
  ALTER COLUMN allow_calls SET DEFAULT true;

-- 4. Add owner-controlled allow_calls setting to public.offers
--    Existing rows get false; future rows default to true.
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS allow_calls boolean DEFAULT false;

ALTER TABLE public.offers
  ALTER COLUMN allow_calls SET DEFAULT true;

-- ----------------------------------------------------------------------------
-- 5. Hardened RLS Policy: public.request_contacts
-- ----------------------------------------------------------------------------
-- Ensures donors can only view coordinator contact information when
-- calling is explicitly enabled (requests.allow_calls IS NOT FALSE).
-- Requesters and admins always retain access to their own request contacts.
DROP POLICY IF EXISTS "request_contacts_select" ON public.request_contacts;
CREATE POLICY "request_contacts_select" ON public.request_contacts
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE requester_id = auth.uid()
    )
    OR public.is_admin()
    OR request_id IN (
      SELECT r.id FROM public.requests r
      JOIN public.offers o ON o.request_id = r.id
      WHERE o.donor_id = auth.uid()
        AND o.status IN ('pending', 'accepted', 'dispatched', 'delivered')
        AND (r.allow_calls IS NOT FALSE)
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Hardened RPC: public.get_request_offers (Replaces 008 definition)
-- ----------------------------------------------------------------------------
-- Protects donors' sensitive pickup addresses and phone numbers:
-- - pickup_address is returned only to the coordinator, donor, or admin.
-- - pickup_contact is returned only when allow_calls is enabled (or caller is the donor).
-- - Third parties / unauthenticated users receive NULL for both fields.
DROP FUNCTION IF EXISTS public.get_request_offers(uuid);

CREATE OR REPLACE FUNCTION public.get_request_offers(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  donor_id uuid,
  donor_name text,
  item_name text,
  unit text,
  quantity_offered numeric,
  quantity_dispatched numeric,
  quantity_delivered numeric,
  status offer_status,
  message text,
  delivery_method text,
  pickup_date date,
  pickup_time_window text,
  pickup_address text,
  pickup_contact text,
  pickup_notes text,
  pickup_status text,
  allow_calls boolean,
  created_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.donor_id,
    COALESCE(p.full_name, 'Anonymous Donor') AS donor_name,
    ri.item_name,
    ri.unit,
    o.quantity_offered,
    o.quantity_dispatched,
    o.quantity_delivered,
    o.status,
    o.message,
    COALESCE(o.delivery_method, 'self') AS delivery_method,
    -- Authorized pickup address: coordinator, donor, or admin
    CASE
      WHEN (o.donor_id = auth.uid() OR public.is_admin() OR EXISTS (
        SELECT 1 FROM public.requests req WHERE req.id = p_request_id AND req.requester_id = auth.uid()
      )) THEN o.pickup_address
      ELSE NULL
    END AS pickup_address,
    -- Authorized pickup contact: donor themselves, or coordinator/admin when allow_calls is true
    CASE
      WHEN o.donor_id = auth.uid() THEN o.pickup_contact
      WHEN (o.allow_calls IS NOT FALSE) AND (public.is_admin() OR EXISTS (
        SELECT 1 FROM public.requests req WHERE req.id = p_request_id AND req.requester_id = auth.uid()
      )) THEN o.pickup_contact
      ELSE NULL
    END AS pickup_contact,
    o.pickup_notes,
    COALESCE(o.pickup_status, 'not_applicable') AS pickup_status,
    o.allow_calls,
    o.created_at,
    o.dispatched_at,
    o.delivered_at
  FROM public.offers o
  LEFT JOIN public.profiles p ON p.id = o.donor_id
  JOIN public.request_items ri ON ri.id = o.request_item_id
  WHERE o.request_id = p_request_id
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_request_offers(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Secure RPC: public.get_drive_with_contact
-- ----------------------------------------------------------------------------
-- Safely retrieves drive details and masks organizer_contact at database level
-- when allow_calls is false (unless caller is organizer or admin).
CREATE OR REPLACE FUNCTION public.get_drive_with_contact(p_drive_id uuid)
RETURNS TABLE (
  id uuid,
  collector_id uuid,
  title text,
  description text,
  organizer_name text,
  organizer_contact text,
  allow_calls boolean,
  from_city text,
  to_city text,
  destination_city text,
  destination_event text,
  destination_camp text,
  destination_lat numeric,
  destination_lng numeric,
  collection_location text,
  collection_address text,
  collection_lat numeric,
  collection_lng numeric,
  departure_date date,
  deadline timestamptz,
  vehicle_type text,
  capacity_kg numeric,
  needs text[],
  target_items jsonb,
  accepted_items text[],
  unaccepted_items text[],
  instructions text,
  pickup_enabled boolean,
  pickup_radius_km numeric,
  allow_pickup boolean,
  allow_dropoff boolean,
  allow_courier boolean,
  require_dropoff boolean,
  status text,
  dispatched_at timestamptz,
  dispatch_notes text,
  delivered_at timestamptz,
  delivered_by uuid,
  receipt_confirmed_at timestamptz,
  receipt_confirmed_by uuid,
  recipient_name text,
  recipient_contact text,
  recipient_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.collector_id,
    d.title,
    d.description,
    d.organizer_name,
    CASE
      WHEN d.collector_id = auth.uid() OR public.is_admin() OR d.allow_calls IS NOT FALSE
      THEN d.organizer_contact
      ELSE NULL
    END AS organizer_contact,
    d.allow_calls,
    d.from_city,
    d.to_city,
    d.destination_city,
    d.destination_event,
    d.destination_camp,
    d.destination_lat,
    d.destination_lng,
    d.collection_location,
    d.collection_address,
    d.collection_lat,
    d.collection_lng,
    d.departure_date,
    d.deadline,
    d.vehicle_type,
    d.capacity_kg,
    d.needs,
    d.target_items,
    d.accepted_items,
    d.unaccepted_items,
    d.instructions,
    d.pickup_enabled,
    d.pickup_radius_km,
    d.allow_pickup,
    d.allow_dropoff,
    d.allow_courier,
    d.require_dropoff,
    d.status,
    d.dispatched_at,
    d.dispatch_notes,
    d.delivered_at,
    d.delivered_by,
    d.receipt_confirmed_at,
    d.receipt_confirmed_by,
    d.recipient_name,
    d.recipient_contact,
    d.recipient_notes,
    d.created_at,
    d.updated_at
  FROM public.collection_drives d
  WHERE d.id = p_drive_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_drive_with_contact(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Owner-Enforced RPC: public.set_offer_allow_calls
-- ----------------------------------------------------------------------------
-- Allows an authenticated donor to update their own allow_calls setting on an offer.
CREATE OR REPLACE FUNCTION public.set_offer_allow_calls(
  p_offer_id uuid,
  p_allow_calls boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offers
  SET allow_calls = p_allow_calls,
      updated_at = now()
  WHERE id = p_offer_id AND (donor_id = auth.uid() OR public.is_admin());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found or caller is not authorized to update it';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_offer_allow_calls(uuid, boolean) TO authenticated;
