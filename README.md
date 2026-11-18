# UCE Connect

Copie locale de l’application adaptée à l’Église Unité chrétienne d’évangélisation (UCE), située rue Lénine, quartier Ouenze, à Brazzaville.

## Démarrage

Prérequis : Node.js et npm.

1. Installez les dépendances avec `npm install`.
2. Créez le fichier serveur `.env` à partir de `.env.example`. Renseignez :
   - `DATABASE_URL` avec la chaîne PostgreSQL du **pooler Supabase**.
   - `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` du projet.
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` pour le navigateur.
   - Pour activer les alertes, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et
     `VAPID_SUBJECT` côté serveur.

   ```env
   DATABASE_URL=postgresql://...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your-public-key
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-public-key
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   VAPID_SUBJECT=mailto:contact@your-church-domain.org
   API_BIBLE_API_KEY=your-api-bible-key
   API_BIBLE_FRENCH_ID=your-french-bible-id
   API_BIBLE_LINGALA_ID=your-lingala-bible-id
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is required for administrator-managed staff accounts and password resets. Keep it server-side only and never add a `VITE_` prefix.

   Ne mettez jamais une clé `service_role` ou une clé `secret` dans une variable `VITE_`.
3. Dans Supabase, ouvrez **SQL Editor** et exécutez
   `supabase/migrations/20260319000000_create_uce_app_records.sql`. Ce script
   ajoute la table de stockage des modules manquants et le bucket de photos UCE.
   La photothèque est disponible dans **Photothèque** (`/gallery`). Les membres
   autorisés à gérer les médias (administrateurs, secrétariat général et équipe
   de communication) peuvent publier des lots de photos dans `/admin/gallery`;
   les images utilisent le bucket `uce-uploads` existant et sont regroupées par
   catégorie, album et date du culte. Les catégories courantes (culte, mariage,
   séminaire, campagne, jeunesse) peuvent être ajoutées depuis leur gestion
   dédiée. Après la migration initiale, exécutez également
   `supabase/migrations/20261113000000_gallery_categories.sql` pour autoriser
   les types `GalleryCategory` et `GalleryPhoto` dans le registre de contenus,
   puis `supabase/migrations/20261114000000_gallery_interactions.sql` pour
   activer les J’aime et les commentaires sécurisés. La photothèque propose
   aussi le téléchargement des photos, la sélection multiple par appui
   prolongé et un réglage persistant de la grille.
4. Pour éviter qu’une suppression de profil rende invalide l’église associée à
   un membre, exécutez ensuite
   `supabase/migrations/20261105000000_restrict_member_profile_deletion.sql`.
   Cette migration modifie la contrainte `fk_membre_profil` : la suppression
   d’un profil référencé sera refusée tant que le lien au membre existe.
   Inspectez et sauvegardez la base avant de l’appliquer.
5. Pour activer la comptabilité et la trésorerie, inspectez puis exécutez
   `supabase/migrations/20261106000000_finance_accounting_ledger.sql`.
   Elle ajoute le plan de comptes, les journaux équilibrés et immuables, le
   registre des dépenses et la piste d’audit. Sauvegardez la base avant toute
   migration de production. Les comptes internes doivent être mappés aux
   numéros SYSCOHADA validés par le contrôleur financier / comptable avant la
   première écriture. Exécutez ensuite
   `supabase/migrations/20261107030000_finance_cash_sessions.sql` pour les
   ouvertures et clôtures de caisse par culte. Une seule session peut être
   ouverte par église; les encaissements et dépenses réglées en espèces y sont
   rattachés. Le comptage réel est comparé au solde théorique et tout écart est
   conservé dans la piste d’audit. Les espèces ne peuvent pas être enregistrées
   ou réglées hors d’une session ouverte.
6. Après sauvegarde, exécutez
   `supabase/migrations/20261107000000_live_studies_notifications_design.sql`.
   Elle ajoute le suivi des directs, les formations bibliques privées et leurs
   cours, ainsi que les notifications ciblées. Les cours privés sont filtrés
   côté serveur et protégés par des règles RLS. Cette migration ne crée aucune
   notification ni transaction fictive.
7. Si la migration précédente était déjà appliquée avant le correctif RLS,
   exécutez aussi
   `supabase/migrations/20261107010000_enforce_authenticated_feature_scope.sql`.
   Elle répare la vérification des profils actifs et réapplique les règles
   d’accès aux directs, formations privées et notifications.
8. Exécutez
   `supabase/migrations/20261107020000_mobile_push_delivery.sql` pour activer
   les abonnements d’appareils et l’envoi des alertes push.
9. Après sauvegarde, exécutez
   `supabase/migrations/20261108000000_study_progress_reminders.sql`. Elle crée
   le suivi d’ouverture des cours et permet d’arrêter les rappels quotidiens
   dès qu’un participant ouvre son cours. Les rappels nécessitent aussi les
   variables VAPID configurées à l’étape 2, au moins un abonnement push actif
   par membre et une API qui reste en fonctionnement.
10. Pour le paiement CinetPay, après sauvegarde, inspectez puis exécutez
    `supabase/migrations/20261109000000_cinetpay_donations.sql`. Elle ajoute
    le registre privé des transactions et leur état de vérification.
11. Après sauvegarde, exécutez
    `supabase/migrations/20261110000000_finance_pastor_approval.sql` pour
    ajouter l’approbation du pasteur aux demandes de dépense.
12. Après sauvegarde, exécutez
    `supabase/migrations/20261111000000_event_registration_attendance.sql`.
    Elle ajoute les inscriptions, les capacités et les présences aux événements,
    migre les inscriptions existantes et prépare les rappels push planifiés.
13. Après sauvegarde, exécutez
    `supabase/migrations/20261112000000_administrative_audit_events.sql` pour
    enregistrer les actions importantes d’administration.
14. Exécutez `supabase/migrations/20261115000000_spiritual_quiz.sql` pour
    activer le quiz biblique, les jetons, les cadeaux et leurs demandes. Les
    jeux et questions de départ, dont « 4 images, 1 réponse », sont ajoutés
    automatiquement pour l’église UCE. Les administrateurs peuvent ensuite
    gérer les questions, téléverser les images et traiter les récompenses dans
    `/admin/quiz`. Les réponses sont vérifiées par l’API et ne sont pas
    transmises aux joueurs avant leur tentative.
15. Générez le client Prisma et lancez l’interface et l’API :

   ```sh
   npm run prisma:generate
   npm run dev
   ```

Les personnes peuvent créer un compte depuis l’écran de connexion. Si la
confirmation d’adresse e-mail est activée, autorisez l’URL de redirection vers
`/login` dans les URL de redirection de Supabase Auth. À l’inscription, un profil
UCE actif et une fiche membre sont créés automatiquement; si plusieurs fiches
existantes correspondent à l’adresse, le compte reste en attente de vérification
afin d’éviter un rattachement ambigu. La connexion dépend de la confirmation
d’adresse lorsque Supabase l’exige.
Les inscriptions aux événements sont comptabilisées séparément des fiches membre.
Les rappels deux heures avant un événement nécessitent les clés VAPID, un
abonnement push actif et un serveur API en fonctionnement.
La lecture biblique reste indisponible jusqu’à la configuration d’une source de
texte biblique. Pour l’activer, créez un compte API.Bible, vérifiez les droits
d’utilisation et la disponibilité des versions souhaitées dans votre compte,
puis renseignez la clé API et les IDs de versions française et lingala dans
l’environnement serveur. Ces trois variables doivent être définies ensemble;
la clé ne doit jamais être exposée au navigateur. La version lingala Open Lingala
Contemporary Bible 2020 et une version française comme J.N. Darby peuvent être
recherchées dans le catalogue API.Bible; la disponibilité peut dépendre de
l’approbation du compte. Aucune version kituba n’a été confirmée; l’interface
n’annonce donc pas une traduction kituba.

La langue de l’interface se choisit depuis **Profil > Langue de l’application**
et est mémorisée sur l’appareil. Le français reste la langue par défaut; les
premières traductions lingala et kituba couvrent la navigation, l’accueil, le
profil et la lecture biblique. Elles doivent être relues par des locuteurs
natif·ve·s et les autres modules de l’application restent à traduire. Les
contenus rédigés par les membres ne sont pas traduits.

Les paiements électroniques ne sont pas encore exécutés par un
prestataire : les déclarations restent en attente jusqu’à leur vérification par
la trésorerie. La caisse et les données comptables sont accessibles aux rôles `TRESORIER`,
`CONTROLEUR_FIN`, `ADMIN_GENERAL` et `SUPER_ADMIN`. Les paiements en espèces
nécessitent une session de caisse ouverte par culte.

### Installation sur Android et iPhone (PWA)

UCE Connect se distribue comme une application web installable (PWA), sans
publication dans les magasins :

- Publiez le client et l’API sur une adresse HTTPS stable, idéalement avec un
  domaine propre. Configurez le routage pour servir `index.html` sur les URL
  de l’application et `/api` vers le serveur. Le service worker doit rester
  accessible à l’adresse `/sw.js`.
- Android : ouvrez l’adresse dans Chrome, puis choisissez **Installer
  l’application** ou **Ajouter à l’écran d’accueil**. Selon le navigateur et
  sa version, le nom du menu peut varier.
- iPhone/iPad : ouvrez l’adresse dans Safari, touchez **Partager**, puis
  **Sur l’écran d’accueil** et **Ajouter**. iOS ne présente pas le même bouton
  d’installation automatique que Chrome Android.
- Un raccourci de ces étapes est disponible dans **Profil > Installer UCE
  Connect**. Sur les navigateurs compatibles, le bouton d’installation natif
  est proposé automatiquement.

Le service worker est enregistré par l’application, mais ne met en cache ni
les pages, ni les appels API : une connexion Internet reste nécessaire et les
données privées ne sont pas stockées hors ligne. Les notifications sur iPhone
nécessitent iOS/iPadOS 16.4 ou ultérieur et l’application ajoutée à l’écran
d’accueil. Les notifications nécessitent aussi les clés VAPID et un serveur API
disponible.

L’installation PWA est gratuite pour les membres et ne requiert ni compte
Google Play ni abonnement Apple Developer. Les frais d’hébergement du serveur
API, de la base de données et du domaine dépendent du fournisseur; en
production, choisissez un hébergement disponible en continu plutôt qu’une
offre gratuite susceptible de mettre le serveur en veille.

Les administrateurs généraux peuvent personnaliser les images, le logo, les
couleurs, la police, la forme des boutons, l’opacité des panneaux vitrés et les
fiches de responsables depuis **Administration > Design**. Le pasteur ou
l’administration peuvent programmer les directs du culte; les membres peuvent
les suivre et retrouver les diffusions passées sous les directs à venir. Le
pasteur et l’administration générale peuvent créer et gérer les formations
privées. Seuls leur responsable et les membres invités peuvent voir une
formation et ses cours.

L’administration générale et le pasteur gèrent les formations privées, leurs
participants et leurs leçons depuis **Administration > Formations privées**.
Les participants marquent automatiquement un cours comme suivi lorsqu’ils
l’ouvrent dans l’application. Si un cours n’a pas été ouvert, le serveur envoie
au plus un rappel push par jour; sans migration de progression appliquée ou sans
configuration VAPID, ces rappels ne sont pas actifs. Le secrétariat général
gère les événements (image et légende); l’administration et le pasteur gèrent
également les prédications, les cours d’affermissement et les formations
publiées dans la médiathèque.

Les images de l’application se choisissent depuis les fichiers de l’appareil
(y compris la galerie sur téléphone) et sont téléversées dans le bucket public
`uce-uploads`. Les formats image jusqu’à 8 Mo sont acceptés. Le bucket est créé
par la migration `20260319000000_create_uce_app_records.sql`; les règles de
stockage limitent les téléversements au dossier du compte connecté.

### Alertes sur le téléphone

Les membres ne disposent pas d’une boîte de notifications dans l’application.
Le département Communication (`COM`) prépare et diffuse les annonces générales
ou ciblées; les administrateurs généraux conservent un accès de supervision.
Chaque membre active les alertes sur son appareil depuis **Profil > Alertes sur
ce téléphone** et doit autoriser les notifications dans son navigateur.

Pour activer l’envoi, configurez ensemble `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans l’environnement serveur. Générez une
paire avec `npx web-push generate-vapid-keys`, gardez la clé privée uniquement
côté serveur et définissez `VAPID_SUBJECT` comme une adresse e-mail de contact
réelle (`mailto:...`) ou une URL HTTPS de l’église. La même paire doit être
présente sur le serveur de production. Les alertes web nécessitent HTTPS (sauf
`localhost` pour le développement); sur iPhone/iPad, le membre doit ajouter
l’application à l’écran d’accueil et autoriser les notifications. Les alertes
programmées sont envoyées par l’API : celle-ci doit rester en fonctionnement à
l’heure prévue. Ce mécanisme utilise les notifications push du navigateur et
n’envoie pas de SMS.

### Connexion sans adresse e-mail

Dans Supabase Auth, activez le fournisseur Téléphone et configurez un prestataire
SMS pour la vérification initiale. Créez ou convertissez le compte Auth avec un
numéro vérifié au format international E.164 (par exemple `+242061234567`) et
un mot de passe, puis rattachez son identifiant au profil UCE et à la fiche du
membre. À l’écran de connexion, la personne choisit **Téléphone** et utilise ce
numéro avec son mot de passe. La réinitialisation du mot de passe par SMS n’est
pas incluse; en cas d’oubli, le secrétariat doit réinitialiser le compte.

### Activer les paiements CinetPay

L’application comprend le flux CinetPay pour initialiser un paiement Mobile
Money ou carte et ne comptabiliser le don qu’après vérification serveur du
statut auprès de CinetPay. Pour l’activer :

1. Faites valider le compte marchand UCE et confirmez directement auprès de
   CinetPay la disponibilité au Congo-Brazzaville en XAF, ainsi que les
   opérateurs pris en charge (MTN, Airtel), Visa, frais, règlements,
   remboursements et procédures de contestation.
2. Récupérez `apikey` et `site_id` du compte marchand, d’abord pour les essais
   puis pour la production. Ne communiquez jamais ces clés dans l’application,
   le dépôt ou une conversation.
3. Renseignez `CINETPAY_API_KEY` et `CINETPAY_SITE_ID` uniquement dans
   l’environnement du serveur. Laissez-les vides pour désactiver le paiement.
   `CINETPAY_NOTIFY_URL` est facultative; en production, le webhook
   `https://votre-domaine.org/api/payments/cinetpay/notify` doit être public,
   HTTPS et acheminé par le reverse proxy vers l’API.
4. Configurez `APP_ORIGIN` avec l’adresse HTTPS de l’application en production,
   appliquez la migration de l’étape 10, puis testez les paiements, refus,
   annulations, notifications répétées et retours depuis le guichet en
   environnement de test avant l’ouverture au public. Cette migration crée
   aussi des comptes de règlement CinetPay Mobile Money et carte; faites valider
   puis mapper leurs numéros SYSCOHADA avec le contrôleur financier avant le
   premier encaissement.

La redirection du navigateur n’est jamais utilisée comme preuve de paiement.
Le webhook et la page de retour déclenchent une vérification serveur auprès de
CinetPay; montant, devise et identifiant de transaction sont comparés aux
données locales. Une transaction confirmée est inscrite une seule fois au
grand livre. L’application ne collecte ni ne stocke le code PIN Mobile Money.
Les paiements en ligne restent indisponibles tant que les identifiants serveur
ne sont pas configurés. Le choix du réseau mobile se confirme sur le guichet
CinetPay; le guichet gère les réseaux accessibles et les cartes bancaires.
L’API refuse aussi l’ouverture du guichet tant que la migration CinetPay n’est
pas appliquée ou que les comptes de règlement et de produits ne sont pas
activés et mappés. Le webhook accepte les notifications JSON et
`application/x-www-form-urlencoded`, puis vérifie toujours le statut auprès de
CinetPay avant de comptabiliser le don.

## Commandes

- `npm run dev` : interface Vite et API locale
- `npm run dev:client` / `npm run dev:server` : lancer chaque processus séparément
- `npm run build` : build de production
- `npm run check` : ESLint, contrôle des types et build de production
- `npm run lint` : vérification ESLint
- `npm run prisma:pull` : lire le schéma PostgreSQL existant (ne migre pas la base)
- `npm run prisma:generate` : générer le client Prisma

L’API vérifie les sessions avec Supabase Auth et accède à PostgreSQL côté serveur. Les migrations SQL UCE ne doivent être appliquées qu’après inspection et validation des tables et contraintes existantes. L’API de développement ne remplace pas un déploiement serveur de production.

Pour activer les jeux bibliques ajoutés (citations, chronologie et lieux), exécutez aussi supabase/migrations/20261116000000_quiz_game_modes.sql après la migration 20261115000000_spiritual_quiz.sql.

Pour activer la publication des pensées du jour, leurs archives et leur durée de 24 heures, appliquez supabase/migrations/20261117000001_daily_thoughts.sql après les migrations du registre de contenus et des catégories de la photothèque.

Pour compléter les questions des jeux et de leurs niveaux, puis appliquer le barème uniforme de 10 jetons par bonne réponse, exécutez supabase/migrations/20261118000000_quiz_question_and_scoring_completion.sql après les migrations des jeux bibliques.

Pour activer les salons de discussion des départements et la planification des réunions, exécutez `supabase/migrations/20261119000000_department_chat.sql` dans l’éditeur SQL Supabase.

## Déploiement de test sur Render

Le fichier `render.yaml` prépare un service Render gratuit qui compile l’interface React et sert aussi l’API Express sur le même domaine. Le serveur écoute sur `PORT` et `0.0.0.0`; en production, les routes de l’interface retombent sur `index.html` pour que les URLs React fonctionnent après actualisation.

1. Pousse le projet dans un dépôt GitHub ou GitLab accessible à ton compte Render.
2. Dans Render, choisis **New → Blueprint**, connecte le dépôt et sélectionne `render.yaml`.
3. Renseigne les variables demandées par Render. `DATABASE_URL` doit être l’URL PostgreSQL du pooler Supabase; utilise les valeurs Supabase du projet pour `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. La clé `SUPABASE_SERVICE_ROLE_KEY` reste une variable serveur secrète.
4. Après le premier déploiement, ajoute l’adresse `https://uce-connect.onrender.com/login` (avec le vrai nom de domaine Render si différent) aux URL de redirection autorisées dans **Supabase → Authentication → URL Configuration**. Utilise aussi l’adresse Render comme Site URL.
5. Applique dans le SQL Editor Supabase les migrations requises par les fonctions utilisées, notamment celle des salons de discussion si tu veux les tester.

Les fichiers locaux ne sont pas persistants sur Render Free. Les données de l’application doivent donc rester dans Supabase (PostgreSQL et Storage), comme prévu par le projet. Après 15 minutes sans requête, le service gratuit peut s’endormir et mettre environ une minute à se réveiller.