-- ============================================================================
-- 006_push_subscriptions.sql: Web Push subscriptions for mobile PWA notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public insert of push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow select own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    auth.uid() IS NULL OR user_id IS NULL OR user_id = auth.uid()
  );

CREATE POLICY "Allow update own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (
    auth.uid() IS NULL OR user_id IS NULL OR user_id = auth.uid()
  );

CREATE POLICY "Allow delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (
    auth.uid() IS NULL OR user_id IS NULL OR user_id = auth.uid()
  );
