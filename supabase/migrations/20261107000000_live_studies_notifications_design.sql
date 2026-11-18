BEGIN;

CREATE TABLE IF NOT EXISTS public.uce_livestreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description varchar(2000) NOT NULL DEFAULT '',
  stream_url varchar(2048) NOT NULL,
  starts_at timestamptz,
  status varchar(12) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, eglise_id)
);

CREATE INDEX IF NOT EXISTS uce_livestreams_church_status_start_idx
  ON public.uce_livestreams (eglise_id, status, starts_at);

CREATE TABLE IF NOT EXISTS public.uce_study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description varchar(2000) NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, eglise_id)
);

CREATE TABLE IF NOT EXISTS public.uce_study_group_members (
  eglise_id uuid NOT NULL,
  group_id uuid NOT NULL,
  member_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, member_id),
  FOREIGN KEY (group_id, eglise_id)
    REFERENCES public.uce_study_groups(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id, eglise_id)
    REFERENCES public.membres(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_study_group_members_profile_idx
  ON public.uce_study_group_members (eglise_id, profile_id);

CREATE TABLE IF NOT EXISTS public.uce_study_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL,
  group_id uuid NOT NULL,
  title varchar(160) NOT NULL,
  scripture varchar(300) NOT NULL DEFAULT '',
  content text NOT NULL,
  video_url varchar(2048),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (group_id, eglise_id)
    REFERENCES public.uce_study_groups(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_study_lessons_group_created_idx
  ON public.uce_study_lessons (eglise_id, group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.uce_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  category varchar(20) NOT NULL
    CHECK (category IN ('general', 'prayer', 'service', 'fundraiser', 'event', 'department', 'commission')),
  title varchar(160) NOT NULL,
  message varchar(2000) NOT NULL,
  url varchar(2048),
  target_type varchar(12) NOT NULL CHECK (target_type IN ('church', 'department', 'commission')),
  target_id uuid,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((target_type = 'church' AND target_id IS NULL)
    OR (target_type IN ('department', 'commission') AND target_id IS NOT NULL)),
  UNIQUE (id, eglise_id)
);

CREATE TABLE IF NOT EXISTS public.uce_notification_recipients (
  eglise_id uuid NOT NULL,
  notification_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, profile_id),
  FOREIGN KEY (notification_id, eglise_id)
    REFERENCES public.uce_notifications(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_notification_recipients_inbox_idx
  ON public.uce_notification_recipients (eglise_id, profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uce_notifications_schedule_idx
  ON public.uce_notifications (eglise_id, scheduled_at DESC);

ALTER TABLE public.uce_livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_study_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_notification_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.uce_livestreams, public.uce_study_groups,
  public.uce_study_group_members, public.uce_study_lessons,
  public.uce_notifications, public.uce_notification_recipients
  FROM anon, authenticated;

GRANT SELECT ON public.uce_livestreams, public.uce_study_groups,
  public.uce_study_group_members, public.uce_study_lessons,
  public.uce_notifications, public.uce_notification_recipients
  TO authenticated;

CREATE OR REPLACE FUNCTION public.uce_active_profile_in_church(target_eglise_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profils_utilisateurs p
    WHERE p.id = auth.uid() AND p.eglise_id = target_eglise_id
      AND p.statut = 'actif'
  );
$$;

REVOKE ALL ON FUNCTION public.uce_active_profile_in_church(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uce_active_profile_in_church(uuid) TO authenticated;

CREATE POLICY uce_livestreams_authenticated_read
  ON public.uce_livestreams FOR SELECT TO authenticated
  USING (public.uce_active_profile_in_church(uce_livestreams.eglise_id));

CREATE POLICY uce_study_groups_private_read
  ON public.uce_study_groups FOR SELECT TO authenticated
  USING (
    public.uce_active_profile_in_church(uce_study_groups.eglise_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.uce_study_group_members m
        WHERE m.group_id = uce_study_groups.id
          AND m.eglise_id = uce_study_groups.eglise_id
          AND m.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY uce_study_group_members_self_read
  ON public.uce_study_group_members FOR SELECT TO authenticated
  USING (profile_id = auth.uid()
    AND public.uce_active_profile_in_church(uce_study_group_members.eglise_id));

CREATE POLICY uce_study_lessons_private_read
  ON public.uce_study_lessons FOR SELECT TO authenticated
  USING (
    public.uce_active_profile_in_church(uce_study_lessons.eglise_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.uce_study_groups g
        WHERE g.id = uce_study_lessons.group_id
          AND g.eglise_id = uce_study_lessons.eglise_id
          AND g.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.uce_study_group_members m
        WHERE m.group_id = uce_study_lessons.group_id
          AND m.eglise_id = uce_study_lessons.eglise_id
          AND m.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY uce_notifications_recipient_read
  ON public.uce_notifications FOR SELECT TO authenticated
  USING (
    public.uce_active_profile_in_church(uce_notifications.eglise_id)
    AND EXISTS (
      SELECT 1 FROM public.uce_notification_recipients r
      WHERE r.notification_id = uce_notifications.id
        AND r.eglise_id = uce_notifications.eglise_id
        AND r.profile_id = auth.uid()
    )
  );

CREATE POLICY uce_notification_recipients_self_read
  ON public.uce_notification_recipients FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND public.uce_active_profile_in_church(uce_notification_recipients.eglise_id)
  );

COMMIT;
