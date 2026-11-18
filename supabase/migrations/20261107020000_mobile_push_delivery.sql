BEGIN;

ALTER TABLE public.uce_notifications
  ADD COLUMN IF NOT EXISTS dispatch_status varchar(12) NOT NULL DEFAULT 'pending'
    CHECK (dispatch_status IN ('pending', 'processing', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS dispatch_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_count integer NOT NULL DEFAULT 0
    CHECK (delivery_count >= 0),
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0
    CHECK (failure_count >= 0),
  ADD COLUMN IF NOT EXISTS dispatch_error text;

UPDATE public.uce_notifications
SET dispatch_status='sent',dispatch_attempted_at=created_at
WHERE dispatch_status='pending';

CREATE INDEX IF NOT EXISTS uce_notifications_pending_push_idx
  ON public.uce_notifications (scheduled_at)
  WHERE dispatch_status = 'pending';

CREATE TABLE IF NOT EXISTS public.uce_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_push_subscriptions_profile_idx
  ON public.uce_push_subscriptions (eglise_id, profile_id);

ALTER TABLE public.uce_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uce_push_subscriptions FROM anon, authenticated;
REVOKE SELECT ON public.uce_notifications, public.uce_notification_recipients
  FROM anon, authenticated;

DROP POLICY IF EXISTS uce_notifications_recipient_read ON public.uce_notifications;
DROP POLICY IF EXISTS uce_notification_recipients_self_read ON public.uce_notification_recipients;

COMMIT;
