-- ============================================================================
-- 010_delete_my_account.sql: RPC function for user self-service account deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure the user is actually logged in
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Delete the user from auth.users. 
  -- Because of ON DELETE CASCADE in your schema, this will automatically
  -- delete their profile, requests, offers, collection drives, and notifications.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Allow authenticated users to delete their own account
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, anon;
