-- ============================================================================
-- 003_functions.sql: Stored Procedures, Triggers, and Aggregate Views
-- ============================================================================

-- All functions defined with:
--   LANGUAGE plpgsql
--   SECURITY DEFINER
--   SET search_path = public

-- ----------------------------------------------------------------------------
-- 1. is_admin()
-- ----------------------------------------------------------------------------
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
-- 2. refresh_request_status(p_request_id uuid)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_request_status(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum_needed numeric;
  v_sum_delivered numeric;
BEGIN
  SELECT COALESCE(SUM(quantity_needed), 0)
  INTO v_sum_needed
  FROM public.request_items
  WHERE request_id = p_request_id;

  SELECT COALESCE(SUM(quantity_delivered), 0)
  INTO v_sum_delivered
  FROM public.offers
  WHERE request_id = p_request_id;

  IF v_sum_needed > 0 AND v_sum_delivered >= v_sum_needed THEN
    UPDATE public.requests
    SET status = 'fulfilled',
        closed_at = COALESCE(closed_at, now()),
        updated_at = now()
    WHERE id = p_request_id
      AND status != 'fulfilled';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_request_status(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. create_offer(p_item_id uuid, p_qty numeric, p_msg text)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_offer(
  p_item_id uuid,
  p_qty numeric,
  p_msg text DEFAULT NULL
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
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: Must be greater than 0';
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

  -- Insert offer
  INSERT INTO public.offers (
    request_item_id,
    request_id,
    donor_id,
    quantity_offered,
    status,
    message
  )
  VALUES (
    p_item_id,
    v_item.request_id,
    v_caller_id,
    p_qty,
    'pending',
    p_msg
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

  -- Notify request owner
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
    'A donor offered ' || p_qty || ' ' || v_item.unit || ' for "' || v_item.item_name || '".',
    '/requests/' || v_request.id,
    'offer'
  );

  RETURN v_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_offer(uuid, numeric, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. accept_offer(p_offer_id uuid)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_item public.request_items%ROWTYPE;
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

  IF v_offer.status != 'pending' THEN
    RAISE EXCEPTION 'OFFER_NOT_PENDING';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_offer.request_id;

  -- Must be caller's own request
  IF v_request.requester_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO v_item
  FROM public.request_items
  WHERE id = v_offer.request_item_id;

  UPDATE public.offers
  SET status = 'accepted',
      quantity_accepted = quantity_offered,
      accepted_at = now(),
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
    'accepted',
    v_offer.quantity_offered,
    'Offer accepted by requester'
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_offer.donor_id,
    'Offer Accepted',
    'Your offer of ' || v_offer.quantity_offered || ' ' || v_item.unit || ' for "' || v_request.title || '" was accepted.',
    '/requests/' || v_request.id,
    'offer'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_offer(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. reject_offer(p_offer_id uuid, p_reason text)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_offer(
  p_offer_id uuid,
  p_reason text DEFAULT NULL
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

  IF v_offer.status != 'pending' THEN
    RAISE EXCEPTION 'OFFER_NOT_PENDING';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_offer.request_id;

  IF v_request.requester_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE public.offers
  SET status = 'rejected',
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
    'rejected',
    p_reason
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_offer.donor_id,
    'Offer Rejected',
    COALESCE(p_reason, 'Your offer for "' || v_request.title || '" was not accepted.'),
    '/requests/' || v_request.id,
    'offer'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_offer(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. cancel_offer(p_offer_id uuid)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_item public.request_items%ROWTYPE;
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

  -- Donor only
  IF v_offer.donor_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Only if nothing dispatched
  IF v_offer.quantity_dispatched > 0 OR v_offer.status IN ('dispatched', 'delivered') THEN
    RAISE EXCEPTION 'CANNOT_CANCEL_DISPATCHED';
  END IF;

  IF v_offer.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'OFFER_ALREADY_INACTIVE';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_offer.request_id;

  SELECT * INTO v_item
  FROM public.request_items
  WHERE id = v_offer.request_item_id;

  UPDATE public.offers
  SET status = 'cancelled',
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
    'cancelled',
    'Offer cancelled by donor'
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_request.requester_id,
    'Offer Cancelled',
    'A donor cancelled their offer for "' || v_item.item_name || '".',
    '/requests/' || v_request.id,
    'offer'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_offer(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. mark_dispatched(p_offer_id uuid, p_qty numeric)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_dispatched(
  p_offer_id uuid,
  p_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_item public.request_items%ROWTYPE;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  SELECT * INTO v_offer
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND';
  END IF;

  -- Donor only
  IF v_offer.donor_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF v_offer.status NOT IN ('accepted', 'dispatched') THEN
    RAISE EXCEPTION 'OFFER_NOT_ACCEPTED_FOR_DISPATCH';
  END IF;

  -- Quantity dispatched must not exceed quantity_accepted
  IF (v_offer.quantity_dispatched + p_qty) > v_offer.quantity_accepted THEN
    RAISE EXCEPTION 'EXCEEDS_ACCEPTED';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = v_offer.request_id;

  SELECT * INTO v_item
  FROM public.request_items
  WHERE id = v_offer.request_item_id;

  UPDATE public.offers
  SET quantity_dispatched = quantity_dispatched + p_qty,
      status = 'dispatched',
      dispatched_at = now(),
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
    'dispatched',
    p_qty,
    'Dispatched ' || p_qty || ' ' || v_item.unit
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_request.requester_id,
    'Supplies Dispatched',
    p_qty || ' ' || v_item.unit || ' dispatched for "' || v_request.title || '".',
    '/requests/' || v_request.id,
    'dispatch'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_dispatched(uuid, numeric) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. confirm_delivery(p_offer_id uuid, p_qty numeric)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_delivery(
  p_offer_id uuid,
  p_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_request public.requests%ROWTYPE;
  v_item public.request_items%ROWTYPE;
  v_caller_id uuid;
  v_new_delivered numeric;
  v_is_fully_delivered boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
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

  -- Request owner or admin
  IF v_request.requester_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_new_delivered := v_offer.quantity_delivered + p_qty;

  -- Quantity delivered must not exceed quantity_dispatched
  IF v_new_delivered > v_offer.quantity_dispatched THEN
    RAISE EXCEPTION 'EXCEEDS_DISPATCHED';
  END IF;

  v_is_fully_delivered := (v_new_delivered >= v_offer.quantity_accepted);

  SELECT * INTO v_item
  FROM public.request_items
  WHERE id = v_offer.request_item_id;

  UPDATE public.offers
  SET quantity_delivered = v_new_delivered,
      status = CASE WHEN v_is_fully_delivered THEN 'delivered'::public.offer_status ELSE status END,
      delivered_at = CASE WHEN v_is_fully_delivered THEN now() ELSE delivered_at END,
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
    p_qty,
    'Delivery confirmed: ' || p_qty || ' ' || v_item.unit
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  VALUES (
    v_offer.donor_id,
    'Delivery Confirmed',
    'Delivery of ' || p_qty || ' ' || v_item.unit || ' for "' || v_request.title || '" has been confirmed!',
    '/requests/' || v_request.id,
    'delivery'
  );

  PERFORM public.refresh_request_status(v_offer.request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid, numeric) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. close_request(p_request_id uuid)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.requests%ROWTYPE;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_request
  FROM public.requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_request.requester_id != v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Set status = cancelled, closed_at = now()
  UPDATE public.requests
  SET status = 'cancelled',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  -- Notify active offer donors before status change
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    link,
    kind
  )
  SELECT DISTINCT
    o.donor_id,
    'Request Closed',
    'The request "' || v_request.title || '" was closed by the requester.',
    '/requests/' || p_request_id,
    'request'
  FROM public.offers o
  WHERE o.request_id = p_request_id
    AND o.status IN ('pending', 'accepted');

  -- Cancel all pending/accepted offers
  UPDATE public.offers
  SET status = 'cancelled',
      updated_at = now()
  WHERE request_id = p_request_id
    AND status IN ('pending', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_request(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. admin_flag_request(p_request_id uuid, p_reason text)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_flag_request(
  p_request_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privilege required';
  END IF;

  UPDATE public.requests
  SET is_flagged = true,
      flagged_reason = p_reason,
      updated_at = now()
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_flag_request(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- TRIGGER: requests_guard_fulfilled
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_request_fulfilled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum_needed numeric;
  v_sum_delivered numeric;
BEGIN
  IF NEW.status = 'fulfilled' AND (OLD.status IS DISTINCT FROM 'fulfilled') THEN
    SELECT COALESCE(SUM(quantity_needed), 0)
    INTO v_sum_needed
    FROM public.request_items
    WHERE request_id = NEW.id;

    SELECT COALESCE(SUM(quantity_delivered), 0)
    INTO v_sum_delivered
    FROM public.offers
    WHERE request_id = NEW.id;

    IF v_sum_needed = 0 OR v_sum_delivered < v_sum_needed THEN
      RAISE EXCEPTION 'CANNOT_FULFIL: % of % delivered', v_sum_delivered, v_sum_needed;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requests_guard_fulfilled ON public.requests;
CREATE TRIGGER requests_guard_fulfilled
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_request_fulfilled();

-- ----------------------------------------------------------------------------
-- VIEW: request_item_stats
-- ----------------------------------------------------------------------------
-- Aggregates inventory metrics across RLS boundaries without exposing donor identities
CREATE OR REPLACE VIEW public.request_item_stats
WITH (security_invoker = false)
AS
SELECT
  ri.id AS request_item_id,
  ri.request_id,
  ri.item_name,
  ri.unit,
  ri.category,
  ri.quantity_needed,
  COALESCE(
    SUM(o.quantity_offered) FILTER (WHERE o.status NOT IN ('rejected', 'cancelled')),
    0
  ) AS quantity_committed,
  COALESCE(
    SUM(o.quantity_delivered),
    0
  ) AS quantity_delivered,
  GREATEST(
    ri.quantity_needed - COALESCE(
      SUM(o.quantity_offered) FILTER (WHERE o.status NOT IN ('rejected', 'cancelled')),
      0
    ),
    0
  ) AS quantity_remaining
FROM public.request_items ri
LEFT JOIN public.offers o ON o.request_item_id = ri.id
GROUP BY ri.id, ri.request_id, ri.item_name, ri.unit, ri.category, ri.quantity_needed;

GRANT SELECT ON public.request_item_stats TO authenticated, anon;
