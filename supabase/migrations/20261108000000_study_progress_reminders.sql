BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uce_study_lessons_id_group_idx
  ON public.uce_study_lessons (id, group_id);

CREATE TABLE IF NOT EXISTS public.uce_study_progress (
  eglise_id uuid NOT NULL,
  group_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  opened_at timestamptz,
  last_reminder_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, profile_id),
  FOREIGN KEY (group_id, eglise_id)
    REFERENCES public.uce_study_groups(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id, group_id)
    REFERENCES public.uce_study_lessons(id, group_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_study_progress_reminder_idx
  ON public.uce_study_progress (eglise_id, profile_id, last_reminder_date);

ALTER TABLE public.uce_study_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uce_study_progress FROM anon, authenticated;
GRANT SELECT ON public.uce_study_progress TO authenticated;

CREATE POLICY uce_study_progress_self_read
  ON public.uce_study_progress FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND public.uce_active_profile_in_church(uce_study_progress.eglise_id)
  );

COMMIT;
