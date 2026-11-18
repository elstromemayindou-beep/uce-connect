BEGIN;

ALTER TABLE public.uce_quiz_questions
  DROP CONSTRAINT IF EXISTS uce_quiz_questions_game_mode_check;
ALTER TABLE public.uce_quiz_questions
  ADD CONSTRAINT uce_quiz_questions_game_mode_check
  CHECK (game_mode IN ('qcm','vrai_faux','personnage','livre','vie_chretienne','4_images_1_mot','citation','chronologie','lieux'));

ALTER TABLE public.uce_quiz_sessions
  DROP CONSTRAINT IF EXISTS uce_quiz_sessions_game_mode_check;
ALTER TABLE public.uce_quiz_sessions
  ADD CONSTRAINT uce_quiz_sessions_game_mode_check
  CHECK (game_mode IN ('qcm','vrai_faux','personnage','livre','vie_chretienne','4_images_1_mot','citation','chronologie','lieux'));

INSERT INTO public.uce_quiz_questions
  (eglise_id,game_mode,difficulty,prompt,choices,correct_option,explanation,bible_reference)
SELECT e.id,q.game_mode,q.difficulty,q.prompt,q.choices::jsonb,q.correct_option,q.explanation,q.bible_reference
FROM public.eglises e
CROSS JOIN (VALUES
  ('citation',1,'Qui dit : « Suivez-moi, et je vous ferai pêcheurs d’hommes » ?','["Jésus","Pierre","Jean-Baptiste","Paul"]',0,'Jésus appelle Simon et André à le suivre.','Matthieu 4:19'),
  ('citation',2,'Qui prie : « Seigneur, à qui irions-nous ? Tu as les paroles de la vie éternelle » ?','["Pierre","Thomas","Étienne","Jean"]',0,'Pierre répond au nom des Douze après le départ de plusieurs disciples.','Jean 6:68'),
  ('citation',3,'À qui Dieu dit-il : « Ne crains point, car je suis avec toi » ?','["Jacob","Josué","Élie","Daniel"]',0,'Dieu renouvelle sa promesse à Jacob pendant son voyage.','Genèse 28:15'),
  ('citation',4,'Quel prophète répond : « Me voici, envoie-moi » ?','["Ésaïe","Jérémie","Amos","Ézéchiel"]',0,'Ésaïe se rend disponible après sa vision du Seigneur.','Ésaïe 6:8'),
  ('citation',5,'Qui déclare : « Je sais en qui j’ai cru » ?','["Paul","Pierre","Jean","Timothée"]',0,'Paul exprime sa confiance en Dieu malgré les épreuves.','2 Timothée 1:12'),
  ('chronologie',1,'Quel événement vient en premier dans le récit biblique ?','["La création du monde","Le déluge","L’appel d’Abraham","La naissance de Moïse"]',0,'La Genèse commence par le récit de la création.','Genèse 1:1'),
  ('chronologie',2,'Quel événement arrive après la sortie d’Égypte ?','["La traversée de la mer Rouge","La naissance de Jésus","La construction du temple","La Pentecôte"]',0,'Israël traverse la mer après avoir quitté l’Égypte.','Exode 14'),
  ('chronologie',3,'Quel événement précède le règne de David ?','["Le règne de Saül","La construction du second temple","L’exil à Babylone","La Pentecôte"]',0,'Saül est le premier roi d’Israël et précède David.','1 Samuel 10; 16'),
  ('chronologie',4,'Quel événement a lieu après la résurrection de Jésus ?','["L’ascension de Jésus","La sortie d’Égypte","Le jugement de Salomon","La naissance de Samuel"]',0,'Jésus apparaît à ses disciples puis monte au ciel.','Actes 1:3-11'),
  ('chronologie',5,'Dans quel ordre ces événements du ministère de Jésus se produisent-ils ?','["Baptême, tentation au désert, appel des disciples","Appel des disciples, naissance, baptême","Résurrection, baptême, tentation","Tentation, crucifixion, naissance"]',0,'Les Évangiles rapportent le baptême, puis la tentation, avant le début du ministère public.','Matthieu 3:13-4:1'),
  ('lieux',1,'Dans quelle ville Jésus est-il né ?','["Bethléhem","Nazareth","Jéricho","Cana"]',0,'Jésus naît à Bethléhem en Judée.','Matthieu 2:1'),
  ('lieux',2,'Dans quel fleuve Jean baptisait-il ?','["Le Jourdain","Le Nil","L’Euphrate","Le Tigre"]',0,'Jean baptisait dans le Jourdain, notamment près de Béthanie.','Matthieu 3:5-6'),
  ('lieux',3,'Sur quelle montagne Moïse reçoit-il les tables de la loi ?','["Le Sinaï","Le Carmel","Le mont des Oliviers","Le mont Garizim"]',0,'Moïse monte au Sinaï pour recevoir les paroles de l’alliance.','Exode 19:20; 31:18'),
  ('lieux',4,'Dans quelle ville Paul et Silas sont-ils emprisonnés avant un tremblement de terre ?','["Philippes","Corinthe","Éphèse","Antioche"]',0,'Ils sont emprisonnés à Philippes après avoir annoncé l’Évangile.','Actes 16:12-26'),
  ('lieux',5,'Dans quelle ville Paul rencontre-t-il des philosophes à l’Aréopage ?','["Athènes","Rome","Damas","Jérusalem"]',0,'Paul s’adresse aux Athéniens à l’Aréopage.','Actes 17:16-22')
) AS q(game_mode,difficulty,prompt,choices,correct_option,explanation,bible_reference)
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_quiz_questions existing
    WHERE existing.eglise_id=e.id AND existing.game_mode=q.game_mode AND existing.prompt=q.prompt
  );

COMMIT;
