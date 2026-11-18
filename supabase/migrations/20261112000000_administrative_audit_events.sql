CREATE TABLE IF NOT EXISTS public.uce_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action varchar(60) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (actor_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS uce_audit_events_church_created_idx
  ON public.uce_audit_events (eglise_id, created_at DESC);

CREATE INDEX IF NOT EXISTS uce_audit_events_entity_idx
  ON public.uce_audit_events (eglise_id, entity_type, entity_id, created_at DESC);

ALTER TABLE public.uce_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uce_audit_events FROM anon, authenticated;
