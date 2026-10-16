-- ============================================================================
-- 005_get_request_offers.sql: Helper RPC to fetch request offers bypassing RLS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_request_offers(p_request_id uuid)
RETURNS TABLE (
  id uuid, donor_id uuid, donor_name text, item_name text,
  quantity_offered numeric, quantity_dispatched numeric,
  quantity_delivered numeric, status offer_status, message text,
  created_at timestamptz, dispatched_at timestamptz, delivered_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.donor_id, p.full_name, ri.item_name,
         o.quantity_offered, o.quantity_dispatched, o.quantity_delivered,
         o.status, o.message, o.created_at, o.dispatched_at, o.delivered_at
  FROM offers o
  JOIN profiles p ON p.id = o.donor_id
  JOIN request_items ri ON ri.id = o.request_item_id
  WHERE o.request_id = p_request_id
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_request_offers(uuid) TO anon, authenticated;
