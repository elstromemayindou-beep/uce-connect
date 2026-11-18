BEGIN;

ALTER TABLE public.membres
  DROP CONSTRAINT IF EXISTS fk_membre_profil;

ALTER TABLE public.membres
  ADD CONSTRAINT fk_membre_profil
  FOREIGN KEY (profil_utilisateur_id, eglise_id)
  REFERENCES public.profils_utilisateurs (id, eglise_id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

COMMIT;
