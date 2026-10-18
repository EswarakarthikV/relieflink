-- ============================================================================
-- 008_offers_pickup_and_workflow.sql: Pickup Arrangements & Delivery Workflow
-- ============================================================================

-- 1. Add fulfillment and pickup columns to public.offers
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS pickup_date date,
  ADD COLUMN IF NOT EXISTS pickup_time_window text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_contact text,
  ADD COLUMN IF NOT EXISTS pickup_notes text,
  ADD COLUMN IF NOT EXISTS pickup_status text DEFAULT 'pending';

-- Add check constraint for delivery_method if not exists
DO $$ BEGIN
  ALTER TABLE public.offers
    ADD CONSTRAINT check_delivery_method
    CHECK (delivery_method IN ('self', 'pickup', 'courier'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Update create_offer stored procedure to support fulfillment & pickup
CREATE OR REPLACE FUNCTION public.create_offer(
  p_item_id uuid,
  p_qty numeric,
  p_msg text DEFAULT NULL,
  p_delivery_method text DEFAULT 'self',
  p_pickup_date date DEFAULT NULL,
  p_pickup_time text DEFAULT NULL,
  p_pickup_address text DEFAULT NULL,
  p_pickup_contact text DEFAULT NULL,
  p_pickup_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.request_items%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_sum_offered numeric;
  v_remaining numeric;
  v_offer_id uuid;
  v_caller_id uuid;
  v_method text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Must be greater than 0';
  END IF;

  v_method := COALESCE(p_delivery_method, 'self');
  IF v_method NOT IN ('self', 'pickup', 'courier') THEN
    v_method := 'self';
  END IF;

  -- Lock the item row to serialize concurrent offers
  SELECT * INTO v_item
  FROM public.request_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_item.request_id;

  IF v_request.status != 'open' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN';
  END IF;

  -- Compute remaining requirement across all active commitments
  SELECT COALESCE(SUM(quantity_offered), 0)
  INTO v_sum_offered
  FROM public.offers
  WHERE request_item_id = p_item_id
    AND status NOT IN ('rejected', 'cancelled');

  v_remaining := v_item.quantity_needed - v_sum_offered;

  IF p_qty > v_remaining THEN
    RAISE EXCEPTION 'EXCEEDS_REMAINING: %', v_remaining;
  END IF;

  -- Insert offer with complete fulfillment details
  INSERT INTO public.offers (
    request_item_id,
    request_id,
    donor_id,
    quantity_offered,
    status,
    message,
    delivery_method,
    pickup_date,
    pickup_time_window,
    pickup_address,
    pickup_contact,
    pickup_notes,
    pickup_status
  )
  VALUES (
    p_item_id,
    v_item.request_id,
    v_caller_id,
    p_qty,
    'pending',
    p_msg,
    v_method,
    p_pickup_date,
    p_pickup_time,
    p_pickup_address,
    p_pickup_contact,
    p_pickup_notes,
    CASE WHEN v_method = 'pickup' THEN 'pending' ELSE 'not_applicable' END
  )
  RETURNING id INTO v_offer_id;

  -- Insert audit event
  INSERT INTO public.offer_events (
    offer_id,
    actor_id,
    event_type,
    quantity,
    note
  )
  VALUES (
    v_offer_id,
    v_caller_id,
    'offered',
    p_qty,
    p_msg
  );

  -- 1. Notify request owner
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_request.requester_id,
    'New Offer Received',
    'A donor offered ' || p_qty || ' ' || v_item.unit || ' for "' || v_item.item_name || '".' ||
    CASE WHEN v_method = 'pickup' THEN ' (Pickup requested)' ELSE '' END,
    '/tracker/' || v_request.id,
    'offer'
  );

  -- 2. Notify donor (Confirmation in donor notification feed)
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_caller_id,
    'Offer Submitted',
    'Your commitment of ' || p_qty || ' ' || v_item.unit || ' for "' || v_request.title || '" has been recorded.',
    '/tracker/' || v_request.id,
    'offer'
  );

  RETURN v_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_offer(uuid, numeric, text, text, date, text, text, text, text) TO authenticated;

-- 3. Extend get_request_offers RPC to return unit, fulfillment method, and pickup details
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
    o.pickup_date,
    o.pickup_time_window,
    o.pickup_address,
    o.pickup_contact,
    o.pickup_notes,
    COALESCE(o.pickup_status, 'not_applicable') AS pickup_status,
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

-- 4. Donor: Mark as Delivered when supplies arrive at destination camp
CREATE OR REPLACE FUNCTION public.mark_delivered(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_offer
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND';
  END IF;

  -- Donor or Admin
  IF v_offer.donor_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF v_offer.status NOT IN ('accepted', 'dispatched') THEN
    RAISE EXCEPTION 'OFFER_NOT_READY_FOR_DELIVERY';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_offer.request_id;

  UPDATE public.offers
  SET status = 'delivered',
      delivered_at = now(),
      quantity_dispatched = GREATEST(quantity_dispatched, quantity_offered),
      quantity_delivered = GREATEST(quantity_delivered, quantity_offered),
      updated_at = now()
  WHERE id = p_offer_id;

  INSERT INTO public.offer_events (
    offer_id,
    actor_id,
    event_type,
    quantity,
    note
  )
  VALUES (
    p_offer_id,
    v_caller_id,
    'delivered',
    v_offer.quantity_offered,
    'Marked delivered by donor'
  );

  -- Notify requester to verify & confirm receipt
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_request.requester_id,
    'Supplies Delivered',
    'Donor marked supplies as delivered for "' || v_request.title || '". Please confirm receipt.',
    '/tracker/' || v_request.id,
    'delivery'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_delivered(uuid) TO authenticated;

-- 5. Requester / Coordinator: Respond to pickup request (Accept or Decline)
CREATE OR REPLACE FUNCTION public.respond_to_pickup(
  p_offer_id uuid,
  p_accepted boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_offer
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_offer.request_id;

  -- Requester or admin only
  IF v_request.requester_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.offers
  SET pickup_status = CASE WHEN p_accepted THEN 'accepted' ELSE 'declined' END,
      updated_at = now()
  WHERE id = p_offer_id;

  INSERT INTO public.offer_events (
    offer_id,
    actor_id,
    event_type,
    note
  )
  VALUES (
    p_offer_id,
    v_caller_id,
    CASE WHEN p_accepted THEN 'pickup_accepted' ELSE 'pickup_declined' END,
    p_note
  );

  -- Notify donor
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_offer.donor_id,
    CASE WHEN p_accepted THEN 'Pickup Confirmed' ELSE 'Pickup Declined' END,
    CASE WHEN p_accepted
      THEN 'The coordinator confirmed the pickup schedule for "' || v_request.title || '".'
      ELSE 'The coordinator was unable to arrange pickup: ' || COALESCE(p_note, 'Please consider self-delivery or courier.')
    END,
    '/tracker/' || v_request.id,
    'pickup'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_pickup(uuid, boolean, text) TO authenticated;
