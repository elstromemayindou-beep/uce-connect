BEGIN;

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

DROP POLICY IF EXISTS uce_livestreams_authenticated_read ON public.uce_livestreams;
CREATE POLICY uce_livestreams_authenticated_read
  ON public.uce_livestreams FOR SELECT TO authenticated
  USING (public.uce_active_profile_in_church(uce_livestreams.eglise_id));

DROP POLICY IF EXISTS uce_study_groups_private_read ON public.uce_study_groups;
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

DROP POLICY IF EXISTS uce_study_group_members_self_read ON public.uce_study_group_members;
CREATE POLICY uce_study_group_members_self_read
  ON public.uce_study_group_members FOR SELECT TO authenticated
  USING (profile_id = auth.uid()
    AND public.uce_active_profile_in_church(uce_study_group_members.eglise_id));

DROP POLICY IF EXISTS uce_study_lessons_private_read ON public.uce_study_lessons;
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

DROP POLICY IF EXISTS uce_notifications_recipient_read ON public.uce_notifications;
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

DROP POLICY IF EXISTS uce_notification_recipients_self_read ON public.uce_notification_recipients;
CREATE POLICY uce_notification_recipients_self_read
  ON public.uce_notification_recipients FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND public.uce_active_profile_in_church(uce_notification_recipients.eglise_id)
  );

COMMIT;
