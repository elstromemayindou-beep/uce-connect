BEGIN;

CREATE TABLE IF NOT EXISTS public.uce_gallery_likes (
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (eglise_id, photo_id, profile_id),
  FOREIGN KEY (photo_id, eglise_id)
    REFERENCES public.uce_app_records(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_gallery_likes_photo_idx
  ON public.uce_gallery_likes (eglise_id, photo_id);

CREATE TABLE IF NOT EXISTS public.uce_gallery_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  content varchar(2000) NOT NULL
    CHECK (length(trim(content)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (photo_id, eglise_id)
    REFERENCES public.uce_app_records(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_gallery_comments_photo_created_idx
  ON public.uce_gallery_comments (eglise_id, photo_id, created_at DESC);

ALTER TABLE public.uce_gallery_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_gallery_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uce_gallery_likes, public.uce_gallery_comments
  FROM anon, authenticated;

COMMIT;
