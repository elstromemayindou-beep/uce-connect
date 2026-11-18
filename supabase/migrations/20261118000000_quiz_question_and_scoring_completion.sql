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

-- Une bonne réponse rapporte toujours 10 jetons, quel que soit le mode ou
-- le niveau. Les anciens jetons déjà gagnés restent inchangés.
-- Ces questions complètent les niveaux existants et garantissent cinq
-- questions au niveau Découverte pour chaque jeu.
INSERT INTO public.uce_quiz_questions
  (eglise_id,game_mode,difficulty,prompt,choices,correct_option,explanation,bible_reference)
SELECT e.id,q.game_mode,q.difficulty,q.prompt,q.choices::jsonb,q.correct_option,q.explanation,q.bible_reference
FROM public.eglises e
CROSS JOIN (VALUES
  ('qcm',1,'Quel signe Dieu place-t-il dans les nuées après le déluge ?','["Un arc-en-ciel","Une étoile","Un olivier","Une colombe"]',0,'L’arc-en-ciel rappelle l’alliance de Dieu avec la terre.','Genèse 9:12-17'),
  ('qcm',1,'Qui reçoit les dix commandements sur le mont Sinaï ?','["Moïse","Aaron","Josué","Élie"]',0,'Dieu remet à Moïse les tables de l’alliance.','Exode 31:18'),
  ('qcm',2,'Quel juge demande un signe avec une toison ?','["Gédéon","Samson","Débora","Jefté"]',0,'Gédéon demande à Dieu de confirmer sa mission par la toison.','Juges 6:36-40'),
  ('qcm',3,'Quel prophète est nourri par des corbeaux près d’un torrent ?','["Élie","Élisée","Ésaïe","Amos"]',0,'Dieu commande aux corbeaux d’apporter du pain et de la viande à Élie.','1 Rois 17:2-6'),
  ('qcm',4,'Quel roi voit une écriture apparaître pendant un festin ?','["Belschatsar","David","Josias","Salomon"]',0,'Daniel interprète l’inscription apparue sur le mur du palais.','Daniel 5:1-28'),
  ('qcm',5,'Quel couple accompagne Apollos et lui explique plus exactement la voie de Dieu ?','["Priscille et Aquilas","Marthe et Lazare","Lydie et Silas","Junia et Andronicus"]',0,'Priscille et Aquilas instruisent Apollos avec précision.','Actes 18:24-26'),
  ('vrai_faux',1,'Noé a construit une arche avant le déluge.','["Vrai","Faux"]',0,'Dieu demande à Noé de construire une arche pour préserver sa famille et les animaux.','Genèse 6:13-22'),
  ('vrai_faux',1,'La Bible dit que Daniel fut jeté dans une fosse aux ours.','["Vrai","Faux"]',1,'Daniel fut jeté dans une fosse aux lions.','Daniel 6:16-23'),
  ('vrai_faux',2,'Ruth choisit de rester avec Naomi et son peuple.','["Vrai","Faux"]',0,'Ruth accompagne Naomi et fait du Dieu d’Israël son Dieu.','Ruth 1:16-17'),
  ('vrai_faux',3,'Le prophète Élie défie les prophètes de Baal au mont Carmel.','["Vrai","Faux"]',0,'Le récit du Carmel montre la réponse de Dieu par le feu.','1 Rois 18:20-39'),
  ('vrai_faux',4,'Dans le livre d’Esther, le nom de Dieu apparaît explicitement dans le texte.','["Vrai","Faux"]',1,'Le nom de Dieu n’est pas explicitement écrit dans le livre d’Esther.','Esther'),
  ('vrai_faux',5,'Paul écrit que les croyants doivent revêtir l’armure de Dieu.','["Vrai","Faux"]',0,'L’armure décrit les ressources spirituelles du croyant.','Éphésiens 6:10-18'),
  ('personnage',1,'Qui interprète les songes de Pharaon en Égypte ?','["Joseph","Daniel","Moïse","Aaron"]',0,'Joseph explique les sept années d’abondance et les sept années de famine.','Genèse 41:14-32'),
  ('personnage',1,'Qui est choisi pour succéder à Moïse et conduire Israël ?','["Josué","Caleb","Aaron","Gédéon"]',0,'Josué reçoit la mission de conduire le peuple après Moïse.','Josué 1:1-9'),
  ('personnage',2,'Quelle femme juge et prophétesse accompagne Barak ?','["Débora","Abigaïl","Esther","Miriam"]',0,'Débora appelle Barak et l’encourage à partir au combat.','Juges 4:4-9'),
  ('personnage',3,'Quel roi danse devant l’arche lorsqu’elle arrive à Jérusalem ?','["David","Saül","Salomon","Ézéchias"]',0,'David célèbre l’arrivée de l’arche avec tout Israël.','2 Samuel 6:12-16'),
  ('personnage',4,'Quel prophète voit une vallée remplie d’ossements desséchés ?','["Ézéchiel","Jérémie","Daniel","Osée"]',0,'La vision annonce la restauration du peuple d’Israël.','Ézéchiel 37:1-14'),
  ('personnage',5,'Quel compagnon de Paul est surnommé « le médecin bien-aimé » ?','["Luc","Tite","Marc","Silas"]',0,'Paul mentionne Luc, le médecin bien-aimé, dans ses salutations.','Colossiens 4:14'),
  ('livre',1,'Dans quel livre trouve-t-on le récit de la création ?','["Genèse","Exode","Psaumes","Romains"]',0,'La Genèse commence par le récit de la création.','Genèse 1:1'),
  ('livre',1,'Quel livre biblique rassemble principalement des chants et des prières ?','["Psaumes","Proverbes","Lévitique","Actes"]',0,'Le livre des Psaumes rassemble prières, chants et louanges.','Psaumes'),
  ('livre',2,'Dans quel livre se trouve le récit de la tour de Babel ?','["Genèse","Exode","Daniel","Matthieu"]',0,'Le récit de Babel se trouve dans le livre de la Genèse.','Genèse 11:1-9'),
  ('livre',3,'Quel livre raconte la reconstruction des murailles de Jérusalem par Néhémie ?','["Néhémie","Esdras","Juges","Amos"]',0,'Néhémie organise la reconstruction des murailles de Jérusalem.','Néhémie 2-6'),
  ('livre',4,'Dans quel livre Paul décrit-il l’amour comme patient et plein de bonté ?','["1 Corinthiens","Romains","Galates","Philippiens"]',0,'Paul décrit l’amour dans son enseignement sur les dons spirituels.','1 Corinthiens 13:4-7'),
  ('livre',5,'Quel livre clôt le Nouveau Testament par une vision de la nouvelle Jérusalem ?','["Apocalypse","Jude","Hébreux","Actes"]',0,'L’Apocalypse se termine sur la vision de la nouvelle Jérusalem.','Apocalypse 21:1-4'),
  ('vie_chretienne',1,'Que demande Jésus à ses disciples de faire pour leurs ennemis ?','["Prier pour eux","Se venger","Les mépriser","Les éviter toujours"]',0,'Jésus enseigne à aimer ses ennemis et à prier pour ceux qui persécutent.','Matthieu 5:44'),
  ('vie_chretienne',1,'Selon Jésus, comment traiter son prochain ?','["Comme on voudrait être traité","Selon sa richesse","Avec indifférence","Seulement s’il est d’accord"]',0,'Jésus résume cette règle dans la loi et les prophètes.','Matthieu 7:12'),
  ('vie_chretienne',2,'Quelle attitude Paul recommande-t-il face aux soucis ?','["Prier et présenter ses demandes à Dieu","Cesser d’aider les autres","Chercher la vengeance","Se croire supérieur"]',0,'Paul invite à faire connaître ses besoins à Dieu dans la prière.','Philippiens 4:6-7'),
  ('vie_chretienne',3,'Quel fruit de l’Esprit aide à maîtriser ses réactions ?','["La maîtrise de soi","La jalousie","La rivalité","La colère"]',0,'La maîtrise de soi fait partie du fruit de l’Esprit.','Galates 5:22-23'),
  ('vie_chretienne',4,'Comment Jacques décrit-il la foi sans les œuvres ?','["Morte","Plus grande","Invisible","Suffisante à elle seule"]',0,'Jacques enseigne que la foi vivante se manifeste aussi par les actes.','Jacques 2:17'),
  ('vie_chretienne',5,'Quel comportement Paul recommande-t-il envers ceux qui font le mal ?','["Vaincre le mal par le bien","Rendre le mal pour le mal","Chercher leur humiliation","Refuser toute réconciliation"]',0,'Paul appelle à laisser la vengeance à Dieu et à faire le bien.','Romains 12:17-21'),
  ('citation',1,'Qui dit à Marie : « Je suis la servante du Seigneur » ?','["Marie","Élisabeth","Anne","Marthe"]',0,'Marie répond à l’annonce de l’ange Gabriel.','Luc 1:38'),
  ('citation',1,'Qui répond : « Parle, car ton serviteur écoute » ?','["Samuel","David","Ésaïe","Jérémie"]',0,'Samuel répond à l’appel de Dieu pendant la nuit.','1 Samuel 3:9-10'),
  ('citation',1,'Qui s’exclame : « Mon Seigneur et mon Dieu ! » en voyant Jésus ?','["Thomas","Pierre","Philippe","André"]',0,'Thomas reconnaît Jésus ressuscité.','Jean 20:27-28'),
  ('citation',1,'Qui dit : « Quant à moi et à ma maison, nous servirons l’Éternel » ?','["Josué","Moïse","Caleb","Gédéon"]',0,'Josué invite le peuple à choisir qui il veut servir.','Josué 24:15'),
  ('citation',1,'Qui répond : « Voici, je viens […] pour faire, ô Dieu, ta volonté » ?','["Jésus","Étienne","Paul","Jean-Baptiste"]',0,'L’épître aux Hébreux applique ces paroles au Christ.','Hébreux 10:7'),
  ('citation',2,'Qui prie : « Crée en moi un cœur pur, ô Dieu » ?','["David","Salomon","Ésaïe","Néhémie"]',0,'David demande à Dieu de le purifier après sa faute.','Psaume 51:12'),
  ('citation',3,'Quel prophète dit : « L’Éternel est mon berger » ?','["David","Élie","Ésaïe","Samuel"]',0,'David exprime sa confiance en Dieu dans ce psaume.','Psaume 23:1'),
  ('citation',4,'Qui déclare : « Ma grâce te suffit » ?','["Le Seigneur à Paul","Pierre à Jean","Moïse à Aaron","Élie à Élisée"]',0,'Le Seigneur répond ainsi à Paul au sujet de sa faiblesse.','2 Corinthiens 12:9'),
  ('citation',5,'Qui proclame : « Voici l’Agneau de Dieu, qui ôte le péché du monde » ?','["Jean-Baptiste","Jean l’apôtre","Pierre","André"]',0,'Jean-Baptiste désigne Jésus auprès de ses disciples.','Jean 1:29'),
  ('chronologie',1,'Quel événement vient en premier ?','["La création","Le déluge","L’appel d’Abraham","La sortie d’Égypte"]',0,'Le récit biblique commence par la création.','Genèse 1:1'),
  ('chronologie',1,'Que fait Dieu après la sortie d’Égypte, avant l’entrée en terre promise ?','["Il conduit Israël au désert","Il envoie Paul à Rome","Il bâtit le temple","Il établit la Pentecôte"]',0,'Israël traverse le désert avant d’entrer en Canaan.','Exode 15; Josué 3'),
  ('chronologie',1,'Quel événement précède la naissance de Jésus ?','["L’annonce de l’ange à Marie","La Pentecôte","Le ministère de Paul","La chute de Jérusalem en 70"]',0,'Gabriel annonce à Marie qu’elle donnera naissance à Jésus.','Luc 1:26-38'),
  ('chronologie',1,'Que se passe-t-il après la crucifixion de Jésus ?','["Sa résurrection","La traversée de la mer Rouge","La naissance de David","La construction de Babel"]',0,'Les Évangiles racontent la résurrection de Jésus après sa mort.','Luc 23-24'),
  ('chronologie',1,'Quel événement clôt le récit de la vie terrestre de Jésus dans Actes 1 ?','["Son ascension","Son baptême","Sa naissance","La visite des mages"]',0,'Jésus est élevé au ciel après avoir instruit ses disciples.','Actes 1:3-11'),
  ('chronologie',2,'Quel événement vient après le règne du roi Saül ?','["Le règne de David","La naissance d’Abraham","La sortie d’Égypte","La Pentecôte"]',0,'David succède à Saül comme roi d’Israël.','1 Samuel 31; 2 Samuel 2'),
  ('chronologie',3,'Quel événement a lieu avant le retour d’Israël de l’exil à Babylone ?','["La destruction de Jérusalem","La Pentecôte","Le ministère de Jésus","Le voyage de Paul à Rome"]',0,'Jérusalem est détruite avant le retour autorisé par les rois perses.','2 Rois 25; Esdras 1'),
  ('chronologie',4,'Dans quel ordre se déroulent ces événements de la vie de Jésus ?','["Baptême, tentation, ministère","Ministère, naissance, baptême","Résurrection, naissance, baptême","Ascension, tentation, ministère"]',0,'Les Évangiles rapportent le baptême, la tentation au désert, puis le ministère public.','Matthieu 3:13-4:17'),
  ('chronologie',5,'Quel événement de l’Église primitive précède le premier voyage missionnaire de Paul ?','["L’envoi de Barnabas et de Saul depuis Antioche","La visite des mages","La reconstruction du temple par Salomon","La chute de Jéricho"]',0,'L’Esprit met à part Barnabas et Saul, envoyés par l’Église d’Antioche.','Actes 13:1-4'),
  ('lieux',1,'Dans quelle ville Jésus naît-il ?','["Bethléhem","Nazareth","Cana","Jéricho"]',0,'Jésus naît à Bethléhem en Judée.','Matthieu 2:1'),
  ('lieux',1,'Où Jésus transforme-t-il l’eau en vin ?','["À Cana","À Jérusalem","À Jéricho","À Béthanie"]',0,'Le premier signe de Jésus rapporté par Jean se déroule à Cana.','Jean 2:1-11'),
  ('lieux',1,'Sur quelle mer Jésus calme-t-il la tempête ?','["La mer de Galilée","La mer Rouge","La mer Morte","La Méditerranée près de Rome"]',0,'Jésus calme le vent et la mer pendant la traversée du lac.','Marc 4:35-41'),
  ('lieux',1,'Dans quelle ville les murs tombent-ils après que le peuple en a fait le tour ?','["Jéricho","Bethléhem","Damas","Cana"]',0,'Josué conduit le peuple autour de Jéricho selon les instructions reçues.','Josué 6:1-20'),
  ('lieux',1,'Dans quelle ville les disciples sont-ils d’abord appelés chrétiens ?','["Antioche","Jérusalem","Éphèse","Philippes"]',0,'Les disciples reçoivent ce nom à Antioche.','Actes 11:26'),
  ('lieux',2,'Dans quel pays Joseph est-il emmené après avoir été vendu ?','["Égypte","Assyrie","Perse","Grèce"]',0,'Joseph est emmené en Égypte et vendu à Potiphar.','Genèse 37:28, 36'),
  ('lieux',3,'Sur quelle montagne Élie affronte-t-il les prophètes de Baal ?','["Le Carmel","Le Sinaï","Le Nébo","Les Oliviers"]',0,'Élie rassemble le peuple au mont Carmel.','1 Rois 18:19-20'),
  ('lieux',4,'Dans quelle ville Paul et Silas sont-ils emprisonnés avant un tremblement de terre ?','["Philippes","Corinthe","Athènes","Éphèse"]',0,'Le récit se déroule à Philippes, en Macédoine.','Actes 16:12-26'),
  ('lieux',5,'Dans quelle ville Paul s’adresse-t-il aux philosophes à l’Aréopage ?','["Athènes","Rome","Damas","Antioche"]',0,'Paul prend la parole à l’Aréopage d’Athènes.','Actes 17:16-22')
) AS q(game_mode,difficulty,prompt,choices,correct_option,explanation,bible_reference)
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_quiz_questions existing
    WHERE existing.eglise_id=e.id AND existing.game_mode=q.game_mode
      AND existing.prompt=q.prompt
  );

INSERT INTO public.uce_quiz_questions
  (eglise_id,game_mode,difficulty,prompt,choices,correct_option,answer_text,image_urls,explanation,bible_reference)
SELECT e.id,'4_images_1_mot',q.difficulty,q.prompt,'[]'::jsonb,-1,q.answer_text,q.image_urls::jsonb,q.explanation,q.bible_reference
FROM public.eglises e
CROSS JOIN (VALUES
  (1,'Quel mot relie ces quatre images ?','ARCHE','["/quiz-images/noah-ark.svg","/quiz-images/noah-dove.svg","/quiz-images/noah-rainbow.svg","/quiz-images/noah-olive-leaf.svg"]','Noé construit une arche pour préserver sa famille et les animaux pendant le déluge.','Genèse 6-9'),
  (1,'Quel mot relie ces quatre images ?','ALLIANCE','["/quiz-images/noah-rainbow.svg","/quiz-images/noah-olive-leaf.svg","/quiz-images/noah-ark.svg","/quiz-images/noah-dove.svg"]','Après le déluge, l’arc-en-ciel rappelle l’alliance de Dieu avec la terre.','Genèse 9:8-17'),
  (2,'Quel mot relie ces quatre images ?','DELIVRANCE','["/quiz-images/moses-bush.svg","/quiz-images/moses-staff.svg","/quiz-images/moses-sea.svg","/quiz-images/moses-tablets.svg"]','Dieu libère Israël de l’esclavage en Égypte et le conduit vers la liberté.','Exode 3; 14'),
  (3,'Quel mot relie ces quatre images ?','ROI','["/quiz-images/david-sling.svg","/quiz-images/david-stone.svg","/quiz-images/david-harp.svg","/quiz-images/david-crown.svg"]','David est oint roi après avoir gardé les troupeaux et affronté Goliath.','1 Samuel 16-17'),
  (4,'Quel mot relie ces quatre images ?','PRIERE','["/quiz-images/daniel-lion.svg","/quiz-images/daniel-den.svg","/quiz-images/daniel-scroll.svg","/quiz-images/daniel-prayer.svg"]','Daniel garde l’habitude de prier Dieu malgré l’interdiction du roi.','Daniel 6:10-23'),
  (5,'Quel mot relie ces quatre images ?','PROPHETIE','["/quiz-images/joseph-coat.svg","/quiz-images/joseph-dream.svg","/quiz-images/joseph-grain.svg","/quiz-images/joseph-egypt.svg"]','Les songes de Joseph annoncent son avenir et la famine à venir.','Genèse 37; 41')
) AS q(difficulty,prompt,answer_text,image_urls,explanation,bible_reference)
WHERE upper(e.sigle)='UCE'
  AND NOT EXISTS (
    SELECT 1 FROM public.uce_quiz_questions existing
    WHERE existing.eglise_id=e.id AND existing.game_mode='4_images_1_mot'
      AND existing.difficulty=q.difficulty AND existing.answer_text=q.answer_text
      AND existing.prompt=q.prompt
  );

COMMIT;
