BEGIN;

CREATE TABLE IF NOT EXISTS public.uce_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  game_mode varchar(24) NOT NULL
    CHECK (game_mode IN ('qcm','vrai_faux','personnage','livre','vie_chretienne','4_images_1_mot')),
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  prompt varchar(500) NOT NULL CHECK (length(trim(prompt)) BETWEEN 5 AND 500),
  choices jsonb NOT NULL CHECK (
    jsonb_typeof(choices)='array' AND (
      (game_mode='4_images_1_mot' AND jsonb_array_length(choices)=0)
      OR (game_mode<>'4_images_1_mot' AND jsonb_array_length(choices) BETWEEN 2 AND 6)
    )
  ),
  correct_option smallint NOT NULL CHECK (
    (game_mode='4_images_1_mot' AND correct_option=-1)
    OR (game_mode<>'4_images_1_mot' AND correct_option >= 0 AND correct_option < jsonb_array_length(choices))
  ),
  answer_text varchar(80) NOT NULL DEFAULT ''
    CHECK ((game_mode='4_images_1_mot' AND length(trim(answer_text)) BETWEEN 2 AND 80)
      OR (game_mode<>'4_images_1_mot' AND answer_text='')),
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(image_urls)='array' AND (
      (game_mode='4_images_1_mot' AND jsonb_array_length(image_urls)=4)
      OR (game_mode<>'4_images_1_mot' AND jsonb_array_length(image_urls)=0)
    )
  ),
  explanation varchar(1200) NOT NULL DEFAULT '',
  bible_reference varchar(160) NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, eglise_id)
);

CREATE INDEX IF NOT EXISTS uce_quiz_questions_available_idx
  ON public.uce_quiz_questions (eglise_id, game_mode, difficulty DESC)
  WHERE is_active=true;

CREATE TABLE IF NOT EXISTS public.uce_quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  game_mode varchar(24) NOT NULL
    CHECK (game_mode IN ('qcm','vrai_faux','personnage','livre','vie_chretienne','4_images_1_mot')),
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  question_ids uuid[] NOT NULL CHECK (cardinality(question_ids) BETWEEN 1 AND 5),
  choice_orders jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(choice_orders)='array'),
  current_index smallint NOT NULL DEFAULT 0,
  question_started_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers)='array'),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  status varchar(20) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (id, eglise_id),
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_quiz_sessions_profile_created_idx
  ON public.uce_quiz_sessions (eglise_id, profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.uce_quiz_point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  session_id uuid NOT NULL,
  points integer NOT NULL CHECK (points > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eglise_id, profile_id, session_id),
  FOREIGN KEY (session_id, eglise_id)
    REFERENCES public.uce_quiz_sessions(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_quiz_point_ledger_profile_idx
  ON public.uce_quiz_point_ledger (eglise_id, profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.uce_quiz_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description varchar(500) NOT NULL DEFAULT '',
  points_required integer NOT NULL CHECK (points_required > 0),
  stock integer CHECK (stock IS NULL OR stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, eglise_id)
);

CREATE INDEX IF NOT EXISTS uce_quiz_rewards_active_idx
  ON public.uce_quiz_rewards (eglise_id, points_required)
  WHERE is_active=true;

CREATE TABLE IF NOT EXISTS public.uce_quiz_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL,
  reward_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  admin_note varchar(500) NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (reward_id, eglise_id)
    REFERENCES public.uce_quiz_rewards(id, eglise_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS uce_quiz_reward_claims_admin_idx
  ON public.uce_quiz_reward_claims (eglise_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uce_quiz_reward_claims_once_idx
  ON public.uce_quiz_reward_claims (eglise_id, profile_id, reward_id)
  WHERE status IN ('pending','approved');

ALTER TABLE public.uce_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_quiz_point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_quiz_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_quiz_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uce_quiz_questions, public.uce_quiz_sessions,
  public.uce_quiz_point_ledger, public.uce_quiz_rewards,
  public.uce_quiz_reward_claims FROM anon, authenticated;

INSERT INTO public.uce_quiz_questions
  (eglise_id,game_mode,difficulty,prompt,choices,correct_option,explanation,bible_reference)
SELECT e.id,q.game_mode,q.difficulty,q.prompt,q.choices::jsonb,q.correct_option,q.explanation,q.bible_reference
FROM public.eglises e
CROSS JOIN (VALUES
  ('qcm',1,'Qui a construit l’arche avant le déluge ?','["Noé","Moïse","Abraham","David"]',0,'Noé construisit l’arche selon les instructions de Dieu.','Genèse 6:13-22'),
  ('qcm',1,'Dans quelle ville Jésus est-il né ?','["Bethléhem","Nazareth","Jérusalem","Capernaüm"]',0,'Jésus est né à Bethléhem, en Judée.','Matthieu 2:1'),
  ('qcm',1,'Quel disciple a marché sur l’eau vers Jésus ?','["Pierre","Jean","André","Thomas"]',0,'Pierre est sorti de la barque et a marché sur l’eau vers Jésus.','Matthieu 14:28-29'),
  ('qcm',2,'Quel roi a demandé la sagesse à Dieu ?','["Salomon","Saül","Ézéchias","Josias"]',0,'Salomon demanda un cœur intelligent pour gouverner le peuple.','1 Rois 3:5-12'),
  ('qcm',2,'Quel était le métier de Pierre et André ?','["Pêcheurs","Bergers","Charpentiers","Collecteurs d’impôts"]',0,'Jésus les appela alors qu’ils jetaient un filet dans la mer.','Matthieu 4:18-19'),
  ('qcm',3,'Quel prophète a défié les prophètes de Baal au mont Carmel ?','["Élie","Élisée","Ésaïe","Jérémie"]',0,'Élie a prié et le feu de l’Éternel est tombé sur l’autel.','1 Rois 18:20-39'),
  ('qcm',4,'Quelle église a examiné les Écritures chaque jour après avoir reçu la parole ?','["Bérée","Corinthe","Éphèse","Philippes"]',0,'Les Béréens vérifiaient chaque jour dans les Écritures si ce qu’ils entendaient était exact.','Actes 17:10-12'),
  ('qcm',5,'Devant quel tribunal Paul a-t-il fait appel à César ?','["Festus","Félix","Gallion","Hérode Agrippa"]',0,'Paul a déclaré en être appelé à César devant Festus.','Actes 25:9-12'),
  ('vrai_faux',1,'David a vaincu Goliath.','["Vrai","Faux"]',0,'David a vaincu Goliath avec une fronde et une pierre.','1 Samuel 17:49-50'),
  ('vrai_faux',1,'Jonas a passé trois jours dans le ventre d’un grand poisson.','["Vrai","Faux"]',0,'Jonas est resté trois jours et trois nuits dans le poisson.','Jonas 1:17'),
  ('vrai_faux',1,'Jésus avait douze disciples.','["Vrai","Faux"]',0,'Jésus a choisi douze apôtres.','Luc 6:13'),
  ('vrai_faux',2,'Daniel a été jeté dans une fosse aux lions.','["Vrai","Faux"]',0,'Daniel fut jeté dans la fosse aux lions, mais Dieu le protégea.','Daniel 6:16-23'),
  ('vrai_faux',2,'Martha était la sœur de Marie et de Lazare.','["Vrai","Faux"]',0,'Les trois étaient frère et sœurs et vivaient à Béthanie.','Jean 11:1-5'),
  ('vrai_faux',3,'Déborah a exercé la fonction de juge en Israël.','["Vrai","Faux"]',0,'Déborah était prophétesse et juge d’Israël.','Juges 4:4-5'),
  ('vrai_faux',4,'Le livre d’Esther mentionne explicitement le nom de Dieu.','["Vrai","Faux"]',1,'Le nom de Dieu n’apparaît pas explicitement dans le livre d’Esther.','Esther'),
  ('vrai_faux',5,'Dans Actes, les croyants de Bérée vérifiaient chaque jour les Écritures.','["Vrai","Faux"]',0,'Ils examinaient chaque jour les Écritures pour vérifier l’enseignement reçu.','Actes 17:11'),
  ('personnage',1,'Qui a été vendu par ses frères puis élevé en Égypte ?','["Joseph","Benjamin","Ruben","Isaac"]',0,'Joseph fut vendu par ses frères et devint intendant en Égypte.','Genèse 37; 41'),
  ('personnage',1,'Qui a conduit les Israélites hors d’Égypte ?','["Moïse","Josué","Aaron","Caleb"]',0,'Dieu a envoyé Moïse pour faire sortir son peuple d’Égypte.','Exode 3:10'),
  ('personnage',1,'Qui a baptisé Jésus dans le Jourdain ?','["Jean-Baptiste","Pierre","André","Philippe"]',0,'Jean-Baptiste a baptisé Jésus dans le Jourdain.','Matthieu 3:13-17'),
  ('personnage',2,'Quel disciple était collecteur d’impôts avant de suivre Jésus ?','["Matthieu","Jean","Jacques","Thomas"]',0,'Jésus appela Matthieu alors qu’il était assis au bureau des impôts.','Matthieu 9:9'),
  ('personnage',2,'Qui a remplacé Judas parmi les douze apôtres ?','["Matthias","Barnabas","Silas","Étienne"]',0,'Les disciples ont tiré au sort et Matthias fut associé aux onze apôtres.','Actes 1:23-26'),
  ('personnage',3,'Quel prophète a succédé à Élie ?','["Élisée","Ésaïe","Ézéchiel","Amos"]',0,'Élisée a reçu le manteau d’Élie et lui a succédé.','2 Rois 2:9-15'),
  ('personnage',4,'Qui était roi de Salem et sacrificateur du Dieu Très-Haut ?','["Melchisédek","Abimélec","Jéthro","Boaz"]',0,'Melchisédek, roi de Salem et sacrificateur du Dieu Très-Haut, bénit Abram.','Genèse 14:18-20'),
  ('personnage',5,'Quel enseignant de la loi fut le maître de Paul ?','["Gamaliel","Nicodème","Hillel","Ananias"]',0,'Paul dit avoir été instruit aux pieds de Gamaliel.','Actes 22:3'),
  ('livre',1,'Quel est le premier livre de la Bible ?','["Genèse","Exode","Psaumes","Matthieu"]',0,'La Genèse ouvre le récit biblique par la création.','Genèse 1:1'),
  ('livre',1,'Dans quel livre trouve-t-on principalement les Psaumes ?','["Psaumes","Proverbes","Job","Ecclésiaste"]',0,'Le livre des Psaumes rassemble des chants et des prières.','Psaumes'),
  ('livre',1,'Quel évangile commence par la généalogie de Jésus ?','["Matthieu","Marc","Luc","Jean"]',0,'Matthieu ouvre son évangile par la généalogie de Jésus-Christ.','Matthieu 1:1'),
  ('livre',2,'Quel livre raconte la sortie d’Israël d’Égypte ?','["Exode","Lévitique","Nombres","Deutéronome"]',0,'L’Exode raconte la délivrance d’Israël et le départ d’Égypte.','Exode 12-14'),
  ('livre',2,'Dans quel livre se trouve le récit de la vallée des ossements desséchés ?','["Ézéchiel","Daniel","Osée","Zacharie"]',0,'Ézéchiel reçoit la vision de la vallée des ossements desséchés.','Ézéchiel 37:1-14'),
  ('livre',3,'Quel livre vient immédiatement après les Actes des Apôtres ?','["Romains","1 Corinthiens","Galates","Éphésiens"]',0,'Dans l’ordre canonique habituel du Nouveau Testament, Romains suit les Actes.','Romains'),
  ('livre',4,'Combien de livres composent les Prophètes mineurs dans la Bible protestante ?','["Douze","Dix","Quatorze","Seize"]',0,'Les douze livres des petits prophètes vont d’Osée à Malachie.','Osée-Malachie'),
  ('livre',5,'Quel livre du Nouveau Testament est une lettre adressée à Philémon ?','["Philémon","Tite","Jude","Jacques"]',0,'Paul adresse une courte lettre à Philémon au sujet d’Onésime.','Philémon 1:1'),
  ('vie_chretienne',1,'Selon Jésus, quel est le plus grand commandement ?','["Aimer Dieu de tout son cœur","Posséder beaucoup","Être admiré","Ne jamais parler"]',0,'Jésus enseigne d’aimer Dieu de tout son cœur, de toute son âme et de toute sa pensée.','Matthieu 22:36-38'),
  ('vie_chretienne',1,'Que recommande Jésus de faire pour ses ennemis ?','["Les aimer et prier pour eux","Les mépriser","Se venger","Les ignorer toujours"]',0,'Jésus appelle à aimer ses ennemis et à prier pour ceux qui persécutent.','Matthieu 5:44'),
  ('vie_chretienne',1,'Quel fruit est cité dans le fruit de l’Esprit ?','["La patience","La jalousie","La vengeance","L’orgueil"]',0,'La patience fait partie du fruit de l’Esprit décrit par Paul.','Galates 5:22-23'),
  ('vie_chretienne',2,'Dans la parabole de Jésus, qui s’est montré le prochain de l’homme blessé ?','["Le Samaritain","Le sacrificateur","Le lévite","Le marchand"]',0,'Le Samaritain a pris soin de l’homme blessé sur la route.','Luc 10:30-37'),
  ('vie_chretienne',2,'Que demande Jacques au croyant qui manque de sagesse ?','["La demander à Dieu","Se taire","Chercher la richesse","Accuser son prochain"]',0,'Jacques invite à demander la sagesse à Dieu, qui donne simplement.','Jacques 1:5'),
  ('vie_chretienne',3,'Quel est le premier fruit de l’Esprit mentionné par Paul ?','["L’amour","La patience","La bonté","La fidélité"]',0,'Paul commence la liste du fruit de l’Esprit par l’amour.','Galates 5:22'),
  ('vie_chretienne',4,'Selon Jacques, comment la foi se montre-t-elle vivante ?','["Par les œuvres qui l’accompagnent","Par les paroles seules","Par la richesse","Par le statut"]',0,'Jacques enseigne que la foi se manifeste par les œuvres.','Jacques 2:17-18'),
  ('vie_chretienne',5,'Quelle image Paul utilise-t-il pour décrire l’équipement spirituel du croyant ?','["L’armure de Dieu","Une couronne de pierres","Une tour d’argent","Un manteau royal"]',0,'Paul décrit l’armure de Dieu et ses éléments spirituels.','Éphésiens 6:10-18')
) AS q(game_mode,difficulty,prompt,choices,correct_option,explanation,bible_reference)
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_quiz_questions existing
    WHERE existing.eglise_id=e.id AND existing.prompt=q.prompt
  );

INSERT INTO public.uce_quiz_questions
  (eglise_id,game_mode,difficulty,prompt,choices,correct_option,answer_text,image_urls,explanation,bible_reference)
SELECT e.id,'4_images_1_mot',q.difficulty,q.prompt,'[]'::jsonb,-1,q.answer_text,q.image_urls::jsonb,q.explanation,q.bible_reference
FROM public.eglises e
CROSS JOIN (VALUES
  (1,'Quel mot relie ces quatre images ?','NOE','["/quiz-images/noah-ark.svg","/quiz-images/noah-dove.svg","/quiz-images/noah-rainbow.svg","/quiz-images/noah-olive-leaf.svg"]','Dieu demanda à Noé de construire une arche. Une colombe revint avec une feuille d’olivier et Dieu plaça son arc dans les nuées.','Genèse 6-9'),
  (1,'Quel mot relie ces quatre images ?','JONAS','["/quiz-images/jonah-fish.svg","/quiz-images/jonah-ship.svg","/quiz-images/jonah-waves.svg","/quiz-images/jonah-plant.svg"]','Jonas fut avalé par un grand poisson, puis Dieu fit pousser une plante pour lui donner de l’ombre.','Jonas 1-4'),
  (1,'Quel mot relie ces quatre images ?','DAVID','["/quiz-images/david-sling.svg","/quiz-images/david-stone.svg","/quiz-images/david-harp.svg","/quiz-images/david-crown.svg"]','David vainquit Goliath avec une fronde et une pierre; il jouait aussi de la harpe et devint roi.','1 Samuel 16-17'),
  (2,'Quel mot relie ces quatre images ?','DANIEL','["/quiz-images/daniel-lion.svg","/quiz-images/daniel-den.svg","/quiz-images/daniel-scroll.svg","/quiz-images/daniel-prayer.svg"]','Daniel resta fidèle à Dieu et fut protégé dans la fosse aux lions.','Daniel 6'),
  (2,'Quel mot relie ces quatre images ?','MOISE','["/quiz-images/moses-bush.svg","/quiz-images/moses-staff.svg","/quiz-images/moses-sea.svg","/quiz-images/moses-tablets.svg"]','Dieu appela Moïse dans le buisson ardent, le chargea de conduire Israël hors d’Égypte et lui donna les tables de la loi.','Exode 3; 14; 31'),
  (2,'Quel mot relie ces quatre images ?','JESUS','["/quiz-images/jesus-manger.svg","/quiz-images/jesus-star.svg","/quiz-images/jesus-cross.svg","/quiz-images/jesus-tomb.svg"]','Jésus est né à Bethléhem, est mort sur la croix et est ressuscité.','Matthieu 2; 27-28'),
  (3,'Quel mot relie ces quatre images ?','SAMSON','["/quiz-images/samson-strength.svg","/quiz-images/samson-lion.svg","/quiz-images/samson-pillars.svg","/quiz-images/samson-hair.svg"]','Samson était connu pour sa force extraordinaire, liée à son vœu et à ses cheveux.','Juges 13-16'),
  (3,'Quel mot relie ces quatre images ?','JOSEPH','["/quiz-images/joseph-coat.svg","/quiz-images/joseph-dream.svg","/quiz-images/joseph-grain.svg","/quiz-images/joseph-egypt.svg"]','Joseph reçut un manteau particulier, raconta ses songes et devint gouverneur en Égypte.','Genèse 37; 41'),
  (4,'Quel mot relie ces quatre images ?','BABEL','["/quiz-images/babel-tower.svg","/quiz-images/babel-bricks.svg","/quiz-images/babel-city.svg","/quiz-images/babel-languages.svg"]','À Babel, les bâtisseurs entreprirent une tour et leurs langues furent confondues.','Genèse 11:1-9'),
  (4,'Quel mot relie ces quatre images ?','ESTHER','["/quiz-images/jesus-star.svg","/quiz-images/david-crown.svg","/quiz-images/babel-city.svg","/quiz-images/daniel-scroll.svg"]','Esther devint reine et risqua sa vie pour sauver son peuple.','Esther 4-7')
) AS q(difficulty,prompt,answer_text,image_urls,explanation,bible_reference)
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_quiz_questions existing
    WHERE existing.eglise_id=e.id AND existing.game_mode='4_images_1_mot'
      AND existing.answer_text=q.answer_text AND existing.prompt=q.prompt
  );

INSERT INTO public.uce_quiz_rewards (eglise_id,name,description,points_required)
SELECT e.id,r.name,r.description,r.points_required
FROM public.eglises e
CROSS JOIN (VALUES
  ('Stylo UCE','Un stylo aux couleurs de l’église.',100),
  ('Tasse UCE','Une tasse avec le logo de l’église.',300),
  ('T-shirt UCE','Un t-shirt aux couleurs de l’église.',700),
  ('Chemise UCE','Une chemise avec le logo de l’église.',1200),
  ('Bible de poche','Une Bible à emporter partout.',2000)
) AS r(name,description,points_required)
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_quiz_rewards existing
    WHERE existing.eglise_id=e.id AND existing.name=r.name
  );

COMMIT;
