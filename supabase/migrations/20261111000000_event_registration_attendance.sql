BEGIN;

CREATE TABLE IF NOT EXISTS public.uce_event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.uce_app_records(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profils_utilisateurs(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'present', 'absent', 'cancelled')),
  marked_by uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eglise_id, event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS uce_event_registrations_event_status_idx
  ON public.uce_event_registrations (eglise_id, event_id, status);

CREATE INDEX IF NOT EXISTS uce_event_registrations_profile_idx
  ON public.uce_event_registrations (eglise_id, profile_id, status);

ALTER TABLE public.uce_notifications
  ADD COLUMN IF NOT EXISTS source_event_id uuid,
  ADD COLUMN IF NOT EXISTS source_profile_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uce_app_records_id_eglise_unique_idx
  ON public.uce_app_records (id, eglise_id);

ALTER TABLE public.uce_notifications
  ADD CONSTRAINT fk_uce_notifications_source_event
  FOREIGN KEY (source_event_id, eglise_id)
  REFERENCES public.uce_app_records(id, eglise_id) ON DELETE CASCADE;

ALTER TABLE public.uce_notifications
  ADD CONSTRAINT fk_uce_notifications_source_profile
  FOREIGN KEY (source_profile_id, eglise_id)
  REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uce_notifications_event_reminder_unique_idx
  ON public.uce_notifications (source_event_id, source_profile_id)
  WHERE source_event_id IS NOT NULL AND source_profile_id IS NOT NULL;

ALTER TABLE public.uce_event_registrations
  ADD CONSTRAINT fk_uce_event_registrations_event_church
  FOREIGN KEY (event_id, eglise_id)
  REFERENCES public.uce_app_records(id, eglise_id) ON DELETE CASCADE;

ALTER TABLE public.uce_event_registrations
  ADD CONSTRAINT fk_uce_event_registrations_profile_church
  FOREIGN KEY (profile_id, eglise_id)
  REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE;

INSERT INTO public.uce_event_registrations (eglise_id,event_id,profile_id,status)
SELECT DISTINCT r.eglise_id,r.id,p.id,'registered'
FROM public.uce_app_records r
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(r.payload->'attendees')='array'
    THEN r.payload->'attendees' ELSE '[]'::jsonb END
) AS attendee(email)
JOIN auth.users au ON lower(au.email)=lower(attendee.email)
JOIN public.profils_utilisateurs p ON p.id=au.id AND p.eglise_id=r.eglise_id
WHERE r.entity_type='Event'
ON CONFLICT (eglise_id,event_id,profile_id) DO NOTHING;

UPDATE public.uce_app_records r
SET payload=jsonb_set(r.payload,'{attendees}',COALESCE((
  SELECT jsonb_agg(to_jsonb(attendee.email))
  FROM jsonb_array_elements_text(r.payload->'attendees') AS attendee(email)
  WHERE NOT EXISTS (
    SELECT 1
    FROM auth.users au
    JOIN public.profils_utilisateurs p ON p.id=au.id AND p.eglise_id=r.eglise_id
    WHERE lower(au.email)=lower(attendee.email)
  )
),'[]'::jsonb))
WHERE r.entity_type='Event' AND jsonb_typeof(r.payload->'attendees')='array';

ALTER TABLE public.uce_event_registrations ENABLE ROW LEVEL SECURITY;

COMMIT;
