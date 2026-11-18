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

COMMIT;
