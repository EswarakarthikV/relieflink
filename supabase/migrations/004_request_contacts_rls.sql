-- ============================================================================
-- 004_request_contacts_rls.sql: Update request_contacts_select policy
-- ============================================================================

-- Include 'pending' status so donors who have submitted an offer can see coordinator contact details
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
        AND status IN ('pending', 'accepted', 'dispatched', 'delivered')
    )
  );
