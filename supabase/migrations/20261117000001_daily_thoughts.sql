BEGIN;

ALTER TABLE public.uce_app_records
  DROP CONSTRAINT IF EXISTS uce_app_records_entity_type_check;

ALTER TABLE public.uce_app_records
  ADD CONSTRAINT uce_app_records_entity_type_check
  CHECK (entity_type IN (
    'Campaign',
    'Community',
    'DailyThought',
    'DailyVerse',
    'Donation',
    'Event',
    'GalleryCategory',
    'GalleryPhoto',
    'Group',
    'JournalEntry',
    'PrayerRequest',
    'Sermon',
    'Team'
  ));

CREATE INDEX IF NOT EXISTS uce_daily_thoughts_recent_idx
  ON public.uce_app_records (eglise_id, created_at DESC)
  WHERE entity_type='DailyThought';

INSERT INTO public.uce_app_records (eglise_id,entity_type,payload)
SELECT e.id,'DailyThought',jsonb_build_object(
  'title','Le sens de l’engagement',
  'content','Ton engagement envers Jésus n’est pas un hasard. Si tu as tout abandonné pour le suivre, c’est que ton âme a compris que ce que tu gagnes en lui dépasse infiniment ce que tu as quitté pour lui.',
  'author',''
)
FROM public.eglises e
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_app_records existing
    WHERE existing.eglise_id=e.id AND existing.entity_type='DailyThought'
  );

COMMIT;
