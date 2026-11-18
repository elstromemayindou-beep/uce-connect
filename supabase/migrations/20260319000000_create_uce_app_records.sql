-- Additive storage for UCE modules missing from the existing database.
CREATE TABLE IF NOT EXISTS public.uce_app_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  entity_type varchar(40) NOT NULL CHECK (
    entity_type IN (
      'Campaign',
      'Community',
      'DailyVerse',
      'Donation',
      'Event',
      'Group',
      'JournalEntry',
      'PrayerRequest',
      'Sermon',
      'Team'
    )
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uce_app_records_church_entity_created_idx
  ON public.uce_app_records (eglise_id, entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS uce_app_records_church_creator_idx
  ON public.uce_app_records (eglise_id, created_by);

ALTER TABLE public.uce_app_records ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('uce-uploads', 'uce-uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "UCE members upload their own profile photos" ON storage.objects;
CREATE POLICY "UCE members upload their own profile photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uce-uploads'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "UCE members update their own profile photos" ON storage.objects;
CREATE POLICY "UCE members update their own profile photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'uce-uploads'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'uce-uploads'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
