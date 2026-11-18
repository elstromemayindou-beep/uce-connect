CREATE TABLE IF NOT EXISTS public.uce_role_assignment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  demandeur_id uuid NOT NULL,
  profil_cible_id uuid NOT NULL,
  role_id uuid NOT NULL,
  departement_id uuid,
  commission_id uuid,
  motif text NOT NULL CHECK (char_length(btrim(motif)) BETWEEN 5 AND 1000),
  statut text NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending','approved','rejected')),
  traite_par uuid,
  traite_le timestamptz,
  decision_motif text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_role_request_requester FOREIGN KEY (demandeur_id,eglise_id)
    REFERENCES public.profils_utilisateurs(id,eglise_id) ON DELETE CASCADE,
  CONSTRAINT fk_role_request_target FOREIGN KEY (profil_cible_id,eglise_id)
    REFERENCES public.profils_utilisateurs(id,eglise_id) ON DELETE CASCADE,
  CONSTRAINT fk_role_request_role FOREIGN KEY (role_id,eglise_id)
    REFERENCES public.roles(id,eglise_id) ON DELETE RESTRICT,
  CONSTRAINT fk_role_request_department FOREIGN KEY (departement_id,eglise_id)
    REFERENCES public.departements(id,eglise_id) ON DELETE RESTRICT,
  CONSTRAINT fk_role_request_commission FOREIGN KEY (commission_id,departement_id)
    REFERENCES public.commissions(id,departement_id) ON DELETE RESTRICT,
  CONSTRAINT fk_role_request_decider FOREIGN KEY (traite_par,eglise_id)
    REFERENCES public.profils_utilisateurs(id,eglise_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_role_assignment_requests_church_status
  ON public.uce_role_assignment_requests (eglise_id,statut,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_assignment_requests_requester
  ON public.uce_role_assignment_requests (demandeur_id,created_at DESC);

ALTER TABLE public.uce_role_assignment_requests ENABLE ROW LEVEL SECURITY;
