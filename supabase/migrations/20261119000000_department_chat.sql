CREATE TABLE IF NOT EXISTS public.uce_department_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL,
  departement_id uuid NOT NULL,
  auteur_id uuid NOT NULL,
  contenu text NOT NULL CHECK (char_length(btrim(contenu)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_department_chat_message_department
    FOREIGN KEY (departement_id, eglise_id)
    REFERENCES public.departements (id, eglise_id) ON DELETE CASCADE,
  CONSTRAINT fk_department_chat_message_author
    FOREIGN KEY (auteur_id, eglise_id)
    REFERENCES public.profils_utilisateurs (id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_department_chat_messages_room_created
  ON public.uce_department_chat_messages (eglise_id, departement_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.uce_department_chat_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL,
  departement_id uuid NOT NULL,
  organisateur_id uuid NOT NULL,
  titre varchar(160) NOT NULL CHECK (char_length(btrim(titre)) BETWEEN 1 AND 160),
  description varchar(2000),
  lieu_ou_lien varchar(500),
  commence_a timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_department_chat_meeting_department
    FOREIGN KEY (departement_id, eglise_id)
    REFERENCES public.departements (id, eglise_id) ON DELETE CASCADE,
  CONSTRAINT fk_department_chat_meeting_organizer
    FOREIGN KEY (organisateur_id, eglise_id)
    REFERENCES public.profils_utilisateurs (id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_department_chat_meetings_room_start
  ON public.uce_department_chat_meetings (eglise_id, departement_id, commence_a);

ALTER TABLE public.uce_department_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_department_chat_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server manages department chat messages" ON public.uce_department_chat_messages;
CREATE POLICY "server manages department chat messages"
  ON public.uce_department_chat_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "server manages department chat meetings" ON public.uce_department_chat_meetings;
CREATE POLICY "server manages department chat meetings"
  ON public.uce_department_chat_meetings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON public.uce_department_chat_messages TO service_role;
GRANT ALL ON public.uce_department_chat_meetings TO service_role;
