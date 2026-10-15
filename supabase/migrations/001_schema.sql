-- ============================================================================
-- 001_schema.sql: Core schema, enums, tables, and indexes for ReliefLink
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('requester', 'donor', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.urgency_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM ('open', 'fulfilled', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.offer_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'dispatched',
    'delivered'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.item_category AS ENUM (
    'water',
    'food',
    'hygiene',
    'medical',
    'shelter',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- 1. profiles: Mirrors auth.users and tracks user profile data & role
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'donor',
  organization text,
  phone text,
  deactivated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. requests: Crisis supply requests created by requesters
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  urgency public.urgency_level NOT NULL DEFAULT 'medium',
  status public.request_status NOT NULL DEFAULT 'open',
  address_line text,
  city text,
  district text,
  state text,
  pincode text,
  latitude double precision,
  longitude double precision,
  needed_by date,
  delivery_instructions text,
  is_flagged boolean DEFAULT false,
  flagged_reason text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

-- 3. request_contacts: Sensitive coordinator/camp contact details for a request
CREATE TABLE IF NOT EXISTS public.request_contacts (
  request_id uuid PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text
);

-- 4. request_items: Line items required under a crisis request
CREATE TABLE IF NOT EXISTS public.request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category public.item_category NOT NULL DEFAULT 'other',
  unit text NOT NULL,
  quantity_needed numeric(12,2) NOT NULL CHECK (quantity_needed > 0),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 5. collection_drives: Citizen & community collection logistics drives
CREATE TABLE IF NOT EXISTS public.collection_drives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_city text,
  to_city text,
  destination_city text,
  linked_request_id uuid REFERENCES public.requests(id),
  destination_event text,
  departure_date date,
  vehicle_type text,
  capacity_kg numeric,
  needs text[],
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

-- 6. offers: Commitments from donors targeting specific requested items
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id uuid NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity_offered numeric(12,2) NOT NULL CHECK (quantity_offered > 0),
  quantity_accepted numeric(12,2) DEFAULT 0,
  quantity_dispatched numeric(12,2) DEFAULT 0,
  quantity_delivered numeric(12,2) DEFAULT 0,
  status public.offer_status NOT NULL DEFAULT 'pending',
  message text,
  accepted_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  drive_id uuid REFERENCES public.collection_drives(id),
  collection_point text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_accepted CHECK (quantity_accepted <= quantity_offered),
  CONSTRAINT check_dispatched CHECK (quantity_dispatched <= quantity_accepted),
  CONSTRAINT check_delivered CHECK (quantity_delivered <= quantity_dispatched)
);

-- 7. offer_events: Audit timeline events tracking dispatch, status changes, delivery
CREATE TABLE IF NOT EXISTS public.offer_events (
  id bigserial PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  quantity numeric(12,2),
  note text,
  created_at timestamptz DEFAULT now()
);

-- 8. notifications: User activity alerts and telemetry updates
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  kind text DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_urgency ON public.requests(urgency);
CREATE INDEX IF NOT EXISTS idx_requests_city ON public.requests(city);
CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON public.request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_request_id ON public.offers(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_donor_id ON public.offers(donor_id);
CREATE INDEX IF NOT EXISTS idx_offers_request_item_id ON public.offers(request_item_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at);
