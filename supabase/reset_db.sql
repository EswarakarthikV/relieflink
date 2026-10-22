-- ============================================================================
-- ReliefLink: Complete Database Reset Script for Hackathon Demo
-- Clears all testing data while preserving table schemas, RLS, and functions.
-- ============================================================================

BEGIN;

-- 1. Wipe notifications
DELETE FROM public.notifications;

-- 2. Wipe offer timeline audit events
DELETE FROM public.offer_events;

-- 3. Wipe donor offers & commitments
DELETE FROM public.offers;

-- 4. Wipe request line items
DELETE FROM public.request_items;

-- 5. Wipe request coordinator contacts
DELETE FROM public.request_contacts;

-- Unlink any linked_request_id in collection_drives to prevent FK constraint conflicts
UPDATE public.collection_drives SET linked_request_id = NULL WHERE linked_request_id IS NOT NULL;

-- 6. Wipe crisis requests
DELETE FROM public.requests;

-- 7. Wipe collection drive contributions and collection drives
DELETE FROM public.collection_drive_contributions;
DELETE FROM public.collection_drives;

-- 8. Wipe push notification subscriptions
DELETE FROM public.push_subscriptions;

-- 9. Wipe authentication users (cascades automatically to public.profiles)
DELETE FROM auth.users;

COMMIT;
