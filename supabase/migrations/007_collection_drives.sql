-- ============================================================================
-- 007_collection_drives.sql: Complete Collection Drives Feature & Delivery Workflow
-- ============================================================================

-- 1. Extend collection_drives table with complete logistics, locations, and two-step delivery fields
ALTER TABLE public.collection_drives
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS organizer_contact text,
  ADD COLUMN IF NOT EXISTS collection_location text,
  ADD COLUMN IF NOT EXISTS collection_address text,
  ADD COLUMN IF NOT EXISTS collection_lat numeric(10,6),
  ADD COLUMN IF NOT EXISTS collection_lng numeric(10,6),
  ADD COLUMN IF NOT EXISTS destination_camp text,
  ADD COLUMN IF NOT EXISTS destination_lat numeric(10,6),
  ADD COLUMN IF NOT EXISTS destination_lng numeric(10,6),
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS deadline timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_radius_km numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS allow_pickup boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_dropoff boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_courier boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_dropoff boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_items text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unaccepted_items text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS target_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_notes text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS receipt_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_confirmed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_contact text,
  ADD COLUMN IF NOT EXISTS recipient_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create collection_drive_contributions table
CREATE TABLE IF NOT EXISTS public.collection_drive_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id uuid NOT NULL REFERENCES public.collection_drives(id) ON DELETE CASCADE,
  donor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  donor_name text NOT NULL,
  donor_contact text,
  is_anonymous boolean NOT NULL DEFAULT false,
  delivery_method text NOT NULL CHECK (delivery_method IN ('pickup', 'self_delivery', 'courier')),
  donor_address text,
  donor_lat numeric(10,6),
  donor_lng numeric(10,6),
  distance_km numeric(8,2),
  pickup_scheduled_at timestamptz,
  pickup_notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'accepted',
    'collection_arranged',
    'collected',
    'dispatched',
    'delivered',
    'receipt_confirmed',
    'declined',
    'cancelled'
  )),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drive_contribs_drive_id ON public.collection_drive_contributions(drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_contribs_donor_id ON public.collection_drive_contributions(donor_id);
CREATE INDEX IF NOT EXISTS idx_drive_contribs_status ON public.collection_drive_contributions(status);

-- 3. Row Level Security for collection_drive_contributions
ALTER TABLE public.collection_drive_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drive_contributions_insert" ON public.collection_drive_contributions;
CREATE POLICY "drive_contributions_insert" ON public.collection_drive_contributions
  FOR INSERT
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "drive_contributions_select_authorized" ON public.collection_drive_contributions;
CREATE POLICY "drive_contributions_select_authorized" ON public.collection_drive_contributions
  FOR SELECT
  USING (
    (donor_id IS NOT NULL AND donor_id = auth.uid()) OR
    drive_id IN (SELECT id FROM public.collection_drives WHERE collector_id = auth.uid()) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "drive_contributions_update_authorized" ON public.collection_drive_contributions;
CREATE POLICY "drive_contributions_update_authorized" ON public.collection_drive_contributions
  FOR UPDATE
  USING (
    (donor_id IS NOT NULL AND donor_id = auth.uid()) OR
    drive_id IN (SELECT id FROM public.collection_drives WHERE collector_id = auth.uid()) OR
    public.is_admin()
  );

-- 4. Secure public donor list function (strips private contact/address information & respects anonymity)
CREATE OR REPLACE FUNCTION public.get_public_drive_contributions(p_drive_id uuid)
RETURNS TABLE (
  id uuid,
  drive_id uuid,
  donor_display_name text,
  is_anonymous boolean,
  delivery_method text,
  status text,
  items jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.drive_id,
    CASE WHEN c.is_anonymous THEN 'Anonymous Donor' ELSE c.donor_name END AS donor_display_name,
    c.is_anonymous,
    c.delivery_method,
    c.status,
    c.items,
    c.created_at
  FROM public.collection_drive_contributions c
  WHERE c.drive_id = p_drive_id
    AND c.status NOT IN ('declined', 'cancelled')
  ORDER BY c.created_at DESC;
$$;

-- Grant execution to all users (public and authenticated)
GRANT EXECUTE ON FUNCTION public.get_public_drive_contributions(uuid) TO anon, authenticated;

-- 5. Two-Step Delivery Confirmation Functions

-- Step A: Organizer marks shipment dispatched
CREATE OR REPLACE FUNCTION public.mark_drive_dispatched(
  p_drive_id uuid,
  p_dispatch_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collector_id uuid;
  v_current_status text;
BEGIN
  SELECT collector_id, status INTO v_collector_id, v_current_status
  FROM public.collection_drives WHERE id = p_drive_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection drive not found';
  END IF;

  IF v_collector_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to dispatch this collection drive';
  END IF;

  UPDATE public.collection_drives
  SET status = 'dispatched',
      dispatched_at = now(),
      dispatch_notes = p_dispatch_notes,
      updated_at = now()
  WHERE id = p_drive_id;

  -- Update all collected contributions to dispatched
  UPDATE public.collection_drive_contributions
  SET status = 'dispatched',
      updated_at = now()
  WHERE drive_id = p_drive_id AND status = 'collected';

  RETURN jsonb_build_object('success', true, 'status', 'dispatched');
END;
$$;

-- Step B: Organizer / Driver marks delivered to destination (Awaiting recipient confirmation)
CREATE OR REPLACE FUNCTION public.mark_drive_delivered(
  p_drive_id uuid,
  p_delivery_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collector_id uuid;
  v_current_status text;
BEGIN
  SELECT collector_id, status INTO v_collector_id, v_current_status
  FROM public.collection_drives WHERE id = p_drive_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection drive not found';
  END IF;

  IF v_collector_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to mark this drive as delivered';
  END IF;

  IF v_current_status <> 'dispatched' THEN
    RAISE EXCEPTION 'Collection drive must be dispatched before it can be marked delivered';
  END IF;

  UPDATE public.collection_drives
  SET status = 'delivered',
      delivered_at = now(),
      delivered_by = auth.uid(),
      recipient_notes = p_delivery_notes,
      updated_at = now()
  WHERE id = p_drive_id;

  -- Update all dispatched contributions to delivered
  UPDATE public.collection_drive_contributions
  SET status = 'delivered',
      updated_at = now()
  WHERE drive_id = p_drive_id AND status = 'dispatched';

  RETURN jsonb_build_object('success', true, 'status', 'delivered');
END;
$$;

-- Step C: Receiving Representative / Camp Coordinator confirms receipt ("Receipt Confirmed")
CREATE OR REPLACE FUNCTION public.confirm_drive_receipt(
  p_drive_id uuid,
  p_recipient_name text,
  p_recipient_contact text DEFAULT NULL,
  p_recipient_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status
  FROM public.collection_drives WHERE id = p_drive_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection drive not found';
  END IF;

  IF v_current_status <> 'delivered' THEN
    RAISE EXCEPTION 'Collection drive must be marked delivered before receipt can be confirmed';
  END IF;

  IF p_recipient_name IS NULL OR trim(p_recipient_name) = '' THEN
    RAISE EXCEPTION 'Recipient name is required for verified confirmation';
  END IF;

  UPDATE public.collection_drives
  SET status = 'receipt_confirmed',
      receipt_confirmed_at = now(),
      receipt_confirmed_by = auth.uid(),
      recipient_name = trim(p_recipient_name),
      recipient_contact = trim(p_recipient_contact),
      recipient_notes = trim(p_recipient_notes),
      updated_at = now()
  WHERE id = p_drive_id;

  -- Update all delivered contributions to receipt_confirmed
  UPDATE public.collection_drive_contributions
  SET status = 'receipt_confirmed',
      updated_at = now()
  WHERE drive_id = p_drive_id AND status = 'delivered';

  RETURN jsonb_build_object('success', true, 'status', 'receipt_confirmed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_drive_dispatched(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_drive_delivered(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_drive_receipt(uuid, text, text, text) TO authenticated, anon;

-- 6. Hardening push_subscriptions RLS (preventing anonymous full select/mutation)
DROP POLICY IF EXISTS "Allow select own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow select own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    user_id IS NOT NULL AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Allow update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow update own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (
    user_id IS NOT NULL AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Allow delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (
    user_id IS NOT NULL AND user_id = auth.uid()
  );
