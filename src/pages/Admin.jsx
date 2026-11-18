import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  Users, Calendar, Heart, Church, BookOpen, TrendingUp, ArrowUpRight,
  Shield, Network, Bell, LockKeyhole, Palette, Radio,
  UserCog, SlidersHorizontal, HandCoins, Music, History, Images,
  Gamepad2,
} from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { canManageNotifications, isSystemAdministrator } from '@/lib/navigation';
import { isUpcomingEvent } from '@/lib/contentDates';

const workspaces = [
  {
    id: 'general',
    label: 'Administration générale',
    description: 'Vue d’ensemble et suivi des activités de l’église.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'],
    path: '/admin?espace=general',
    icon: Shield,
  },
  {
    id: 'finance',
    label: 'Trésorerie',
    description: 'Gérer les encaissements et vérifier les paiements des membres.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'TRESORIER', 'CONTROLEUR_FIN'],
    path: '/admin/finance',
    icon: TrendingUp,
  },
  {
    id: 'finance-report',
    label: 'Rapport financier et validations',
    description: 'Consulter le rapport quotidien et approuver les décaissements.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'],
    path: '/admin/finance/report',
    icon: HandCoins,
  },
  {
    id: 'audit',
    label: 'Historique des actions',
    description: 'Consulter les changements administratifs et financiers importants.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'TRESORIER', 'CONTROLEUR_FIN'],
    path: '/admin/audit',
    icon: History,
  },
  {
    id: 'members',
    label: 'Annuaire des membres',
    description: 'Consulter les membres de l’église.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'GESTIONNAIRE_MEMBRES'],
    path: '/admin/members',
    icon: Users,
  },
  {
    id: 'secretariat',
    label: 'Secrétariat et événements',
    description: 'Gérer les événements de l’église.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'SECRETAIRE_GENERAL'],
    path: '/admin/content?tab=events',
    icon: Calendar,
  },
  {
    id: 'daily-thoughts',
    label: 'Pensées du jour',
    description: 'Publier une méditation pendant 24 heures et consulter les archives.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'SECRETAIRE_GENERAL'],
    path: '/admin/content?tab=thoughts',
    icon: Heart,
  },
  {
    id: 'gallery',
    label: 'Photothèque',
    description: 'Publier et organiser les photos des cultes.',
    roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'SECRETAIRE_GENERAL'],
    path: '/admin/gallery',
    icon: Images,
  },
  {
    id: 'role-requests', label: 'Demandes de responsables', description: 'Proposer des responsables à valider par l’administration générale.',
    roles: ['PASTEUR_PRINCIPAL'], path: '/admin/role-requests', icon: UserCog,
  },
  {
    id: 'organization', label: 'Départements et commissions', description: 'Gérer la structure de l’église.',
    roles: ['PASTEUR_PRINCIPAL'], path: '/admin/groups', icon: Network,
  },
];
const departmentRoleCodes = ['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT', 'MONITEUR_ECOLE_DIMANCHE'];
const commissionRoleCodes = ['RESP_COMMISSION', 'SECRETAIRE_COMMISSION'];

export default function Admin() {
  const location = useLocation();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const roleAssignments = Array.isArray(user?.role_assignments) ? user.role_assignments : [];
  const scopedWorkspaces = roleAssignments.flatMap((assignment) => {
    if (assignment.department?.code === 'COM'
      && (assignment.scope === 'departement'
        && ['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT'].includes(assignment.code)
        || assignment.scope === 'commission'
        && ['RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code))) {
      return [{
        id: `communication-${assignment.department.id}`,
        label: 'Communication',
        description: `${assignment.name} · ${assignment.scope === 'commission' ? assignment.commission?.name || 'Commission' : 'Département'}`,
        path: '/admin/notifications',
        icon: Bell,
      }, {
        id: `gallery-communication-${assignment.department.id}`,
        label: 'Photothèque',
        description: `${assignment.name} · ${assignment.scope === 'commission' ? assignment.commission?.name || 'Commission' : 'Département'}`,
        path: '/admin/gallery',
        icon: Images,
      }];
    }
    if (departmentRoleCodes.includes(assignment.code) && assignment.department?.id) {
      return [{
        id: `department-${assignment.department.id}`,
        label: assignment.department.name,
        description: `${assignment.name} · Département`,
        path: `/admin/departements/${assignment.department.id}`,
        icon: Network,
      }];
    }
    if (commissionRoleCodes.includes(assignment.code) && assignment.commission?.id) {
      return [{
        id: `commission-${assignment.commission.id}`,
        label: assignment.commission.name,
        description: `${assignment.name} · ${assignment.department?.name || 'Commission'}`,
        path: `/admin/commissions/${assignment.commission.id}`,
        icon: Users,
      }];
    }
    return [];
  });
  const availableWorkspaces = [
    ...workspaces.filter((workspace) => workspace.roles.some((role) => roles.includes(role))),
    ...scopedWorkspaces.filter((workspace, index, list) => list.findIndex((item) => item.id === workspace.id) === index),
  ];
  const selectedWorkspace = new URLSearchParams(location.search).get('espace');
  const missingAssignments = roles.some((role) => (
    departmentRoleCodes.includes(role) || commissionRoleCodes.includes(role)
  ) && !roleAssignments.some((assignment) => assignment.code === role && (
    (departmentRoleCodes.includes(role) && assignment.department?.id)
    || (commissionRoleCodes.includes(role) && assignment.commission?.id)
  )));

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Chargement de vos espaces…</div>;
  }

  if (selectedWorkspace === 'general' && availableWorkspaces.some((workspace) => workspace.id === 'general')) {
    return <GeneralAdminDashboard />;
  }

  if (availableWorkspaces.length === 1) {
    return availableWorkspaces[0].id === 'general'
      ? <GeneralAdminDashboard />
      : <Navigate to={availableWorkspaces[0].path} replace />;
  }

  if (availableWorkspaces.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="glass-panel max-w-lg rounded-3xl p-8 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="mb-2 text-2xl font-black">Espace membre</h1>
          <p className="text-muted-foreground">
            Aucun espace de gestion n’est associé à votre compte. Vous pouvez continuer à utiliser les fonctionnalités de l’église.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 p-5 shadow-elev-2 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <p className="relative mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Administration</p>
        <h1 className="relative text-3xl font-black">Choisissez votre fonction</h1>
        <p className="relative mt-2 text-sm text-muted-foreground">Sélectionnez le rôle ou l’espace de gestion à ouvrir.</p>
      </div>
      {missingAssignments && (
        <p role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Un rôle de département ou de commission est présent, mais aucun périmètre ne lui est rattaché. Demandez à l’administration de compléter l’affectation.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {availableWorkspaces.map((workspace, index) => (
          <Link
            key={workspace.id}
            to={workspace.path}
            className="glass-card group relative flex min-h-40 flex-col justify-between rounded-3xl bg-card/80 p-5 shadow-elev-1 transition duration-300 hover:-translate-y-1 hover:shadow-elev-3 sm:p-6"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/10 via-accent/5 to-transparent opacity-70 transition group-hover:opacity-100" />
            <span className="relative flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary transition group-hover:scale-105">
                <workspace.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold tabular-nums text-muted-foreground/60">{String(index + 1).padStart(2, '0')}</span>
            </span>
            <span className="relative mt-5">
              <span className="block text-lg font-black leading-snug">{workspace.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{workspace.description}</span>
            </span>
            <span className="relative mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-primary transition group-hover:border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground">
              Ouvrir <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GeneralAdminDashboard() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: summary } = useQuery({ queryKey: ['dashboard-summary'], queryFn: () => appClient.dashboard.summary() });
  const { data: organization = [], isLoading: isLoadingOrganization, isError: organizationError } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => appClient.organization.tree(),
  });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => appClient.entities.User.list() });
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdministrator = isSystemAdministrator(user);
  const isPastor = roles.includes('PASTEUR_PRINCIPAL');
  const { data: events = [] } = useQuery({ queryKey: ['admin-events'], queryFn: () => appClient.entities.Event.list('date', 500), enabled: isAdministrator });
  const { data: prayers = [] } = useQuery({ queryKey: ['admin-prayers'], queryFn: () => appClient.entities.PrayerRequest.list(), enabled: isAdministrator });
  const { data: communities = [] } = useQuery({ queryKey: ['admin-communities'], queryFn: () => appClient.entities.Community.list(), enabled: isAdministrator });
  const { data: sermons = [] } = useQuery({ queryKey: ['admin-sermons'], queryFn: () => appClient.entities.Sermon.list() });
  const upcomingEvents = events.filter((event) => isUpcomingEvent(event));
  const hasAnyRole = (...allowedRoles) => roles.some((role) => allowedRoles.includes(role));
  const canManageChurch = hasAnyRole('SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL');
  const moduleSections = [
    {
      title: 'Administration et organisation',
      description: 'Gérer les personnes, les responsabilités et la structure de l’église.',
      modules: [
        ...(hasAnyRole('SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'GESTIONNAIRE_MEMBRES')
          ? [{
            label: hasAnyRole('PASTEUR_PRINCIPAL') && !isAdministrator ? 'Annuaire des membres' : 'Gestion des membres',
            description: isAdministrator || hasAnyRole('GESTIONNAIRE_MEMBRES') ? 'Créer les fiches et mettre à jour les informations.' : 'Consulter la liste des membres de l’église.',
            path: '/admin/members',
            icon: Users,
            accent: 'bg-sky-500/10 text-sky-600',
          }]
          : []),
        ...(isAdministrator
          ? [{
            label: 'Rôles et affectations',
            description: 'Attribuer les rôles et définir leur périmètre de responsabilité.',
            path: '/admin/organisation',
            icon: UserCog,
            accent: 'bg-indigo-500/10 text-indigo-600',
          }, {
            label: 'Historique des actions',
            description: 'Consulter les changements administratifs et financiers importants.',
            path: '/admin/audit',
            icon: History,
            accent: 'bg-slate-500/10 text-slate-600',
          }, {
            label: 'Équipes et ministères',
            description: 'Créer, modifier et organiser les équipes de service.',
            path: '/admin/teams',
            icon: Music,
            accent: 'bg-cyan-500/10 text-cyan-600',
          }]
          : []),
        ...(hasAnyRole('PASTEUR_PRINCIPAL') ? [{ label: 'Demandes de responsables', description: 'Proposer un responsable de département à valider par l’administration générale.', path: '/admin/role-requests', icon: UserCog, accent: 'bg-indigo-500/10 text-indigo-600' }] : []),
        ...(canManageChurch ? [{ label: 'Départements et commissions', description: 'Organiser les départements et commissions de l’église.', path: '/admin/groups', icon: Network, accent: 'bg-violet-500/10 text-violet-600' }] : []),
        ...(isAdministrator || hasAnyRole('TRESORIER', 'CONTROLEUR_FIN')
          ? [{
            label: 'Trésorerie et comptabilité',
            description: 'Suivre les dons, encaissements, dépenses et écritures financières.',
            path: '/admin/finance',
            icon: HandCoins,
            accent: 'bg-emerald-500/10 text-emerald-600',
          }]
          : []),
        ...(hasAnyRole('PASTEUR_PRINCIPAL')
          ? [{
            label: 'Rapport financier et validations',
            description: 'Consulter le rapport quotidien et approuver les décaissements.',
            path: '/admin/finance/report',
            icon: HandCoins,
            accent: 'bg-amber-500/10 text-amber-600',
          }]
          : []),
      ],
    },
    {
      title: 'Activités et communication',
      description: 'Publier les activités, accompagner les membres et communiquer les annonces.',
      modules: [
        ...(hasAnyRole('SUPER_ADMIN', 'ADMIN_GENERAL', 'SECRETAIRE_GENERAL')
          ? [{
            label: 'Événements',
            description: 'Publier les programmes, affiches, dates et lieux des activités.',
            path: '/admin/content?tab=events',
            icon: Calendar,
            accent: 'bg-amber-500/10 text-amber-600',
          }]
          : []),
        ...(isAdministrator || hasAnyRole('PASTEUR_PRINCIPAL')
          ? [{
            label: 'Prédications et médias',
            description: 'Publier et organiser les prédications de l’église.',
            path: '/admin/content?tab=sermons',
            icon: BookOpen,
            accent: 'bg-orange-500/10 text-orange-600',
          }]
          : []),
        ...(isAdministrator
          ? [{
            label: 'Directs du culte',
            description: 'Programmer et mettre à jour les liens des prochains cultes en direct.',
            path: '/admin/live',
            icon: Radio,
            accent: 'bg-rose-500/10 text-rose-600',
          }]
          : []),
        ...(isAdministrator || hasAnyRole('PASTEUR_PRINCIPAL') ? [{ label: 'Formations bibliques', description: 'Créer des formations privées et suivre leurs participants.', path: '/admin/studies', icon: LockKeyhole, accent: 'bg-blue-500/10 text-blue-600' }] : []),
        ...(canManageNotifications(user)
          ? [{
            label: 'Notifications téléphone',
            description: 'Envoyer les annonces générales ou ciblées aux membres.',
            path: '/admin/notifications',
            icon: Bell,
            accent: 'bg-cyan-500/10 text-cyan-600',
          }]
          : []),
        ...(isAdministrator
          ? [{
            label: 'Quiz biblique et récompenses',
            description: 'Gérer les questions, les niveaux, les cadeaux et les demandes des membres.',
            path: '/admin/quiz',
            icon: Gamepad2,
            accent: 'bg-emerald-500/10 text-emerald-600',
          }]
          : []),
      ],
    },
    {
      title: 'Personnalisation de l’application',
      description: 'Centraliser les réglages visuels et les informations présentées aux membres.',
      modules: hasAnyRole('SUPER_ADMIN', 'ADMIN_GENERAL')
        ? [{
          label: 'Communautés',
          description: 'Ajouter et mettre à jour les informations des communautés UCE.',
          path: '/communities',
          icon: Church,
          accent: 'bg-purple-500/10 text-purple-600',
        }, {
          label: 'Design et identité de l’application',
          description: 'Modifier le logo, les images, les couleurs, la police et les responsables.',
          path: '/admin/design',
          icon: Palette,
          accent: 'bg-fuchsia-500/10 text-fuchsia-600',
        }, {
          label: 'Gestion des responsables',
          description: 'Ajouter, modifier ou retirer un responsable avec son titre, sa description et sa photo.',
          path: '/admin/responsibles',
          icon: Users,
          accent: 'bg-yellow-500/10 text-yellow-700',
        }]
        : [],
    },
  ].filter((section) => section.modules.length > 0);

  if (!user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-destructive opacity-50" />
          </div>
          <h2 className="text-xl font-black mb-2">Accès restreint</h2>
          <p className="text-muted-foreground">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  const adminStats = [
    { label: 'Membres', value: users.length, icon: Users, gradient: 'from-blue-500 to-blue-600', path: '/admin/members' },
    { label: 'Communautés', value: communities.length, icon: Church, gradient: 'from-purple-500 to-purple-600', path: '/communities' },
    { label: 'Événements à venir', value: upcomingEvents.length, icon: Calendar, gradient: 'from-green-500 to-green-600', path: '/admin/content?tab=events' },
    { label: 'Inscriptions aux événements', value: summary?.upcoming_event_signups ?? events.reduce((total, event) => total + (event.attendee_count || 0), 0), icon: Users, gradient: 'from-cyan-500 to-cyan-600', path: '/events' },
    { label: 'Prédications', value: sermons.length, icon: BookOpen, gradient: 'from-amber-500 to-amber-600', path: '/admin/content?tab=sermons' },
    { label: 'Prières', value: prayers.length, icon: Heart, gradient: 'from-red-500 to-red-600', path: '/prayers' },
  ];
  const stats = isAdministrator ? adminStats : isPastor ? adminStats.filter((item) => ['Membres', 'Prédications'].includes(item.label)) : [];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-primary text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative px-6 py-12 md:px-12">
          <p className="text-amber-400 font-bold tracking-widest text-xs uppercase mb-2">Administration</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Tableau de bord</h1>
          <p className="text-white/70 mt-2">Vue d’ensemble de l’Église UCE</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
        <section aria-labelledby="admin-modules-title" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Centre de gestion</p>
              <h2 id="admin-modules-title" className="text-2xl font-black">Accès aux modules</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choisissez une rubrique pour ouvrir directement son espace de travail.</p>
            </div>
            <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {moduleSections.reduce((total, section) => total + section.modules.length, 0)} modules disponibles
            </span>
          </div>
          {moduleSections.map((section) => (
            <section key={section.title} aria-label={section.title} className="space-y-3">
              <div>
                <h3 className="text-lg font-extrabold">{section.title}</h3>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.modules.map((module, index) => (
                  <Link
                    key={module.path}
                    to={module.path}
                    className="glass-card group relative flex min-h-40 flex-col justify-between rounded-3xl bg-card/80 p-4 shadow-elev-1 transition duration-300 hover:-translate-y-1 hover:shadow-elev-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/10 via-accent/5 to-transparent opacity-60 transition group-hover:opacity-100" />
                    <div className="relative flex items-start justify-between gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/50 ${module.accent} transition group-hover:scale-105`}>
                        <module.icon className="h-5 w-5" />
                      </span>
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="relative mt-5 min-w-0">
                      <h4 className="font-black leading-snug">{module.label}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{module.description}</p>
                    </div>
                    <span className="relative mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-primary transition group-hover:border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground">
                      Ouvrir le module <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="glass-panel rounded-3xl p-5 md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black"><Network className="h-5 w-5 text-primary" />Aperçu de l’organisation</h2>
              <p className="mt-1 text-sm text-muted-foreground">Accès rapide aux départements et aux commissions actifs.</p>
            </div>
            {canManageChurch && (
              <Link to="/admin/groups" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary/40 hover:bg-primary/5">
                <SlidersHorizontal className="h-4 w-4" />Gérer l’organisation
              </Link>
            )}
          </div>
          {isLoadingOrganization ? (
            <p className="py-6 text-center text-muted-foreground">Chargement de l’organisation…</p>
          ) : organizationError ? (
            <p role="alert" className="py-6 text-center text-destructive">Impossible de charger l’organisation.</p>
          ) : organization.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Aucun département actif.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {organization.map((department) => (
                <Link
                  key={department.id}
                  to={`/admin/departements/${department.id}`}
                  className="rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold">{department.nom}</h3>
                    <span className="text-xs text-muted-foreground">{department.commissions.length} commissions</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{department.nombre_membres} affectations actives</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="admin-overview-title" className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Indicateurs</p>
            <h2 id="admin-overview-title" className="text-2xl font-black">Vue d’ensemble</h2>
          </div>
          {summary?.pending_member_profiles !== null && summary?.pending_member_profiles !== undefined && (
            <Link to="/admin/members" className="block rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-800 dark:text-amber-200">
              {summary.pending_member_profiles} inscription(s) nécessitent une vérification des doublons.
            </Link>
          )}
          {summary?.financial && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Recettes du mois', summary.financial.receipts],
                ['Dépenses payées ce mois', summary.financial.expenses],
              ].map(([label, amount]) => (
                <div key={label} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-black">
                    {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(amount) || 0)} {summary.financial.currency}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <Link key={stat.label} to={stat.path} className="group">
              <div className="bg-card border border-border/50 rounded-3xl p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-3xl font-black">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-1">{stat.label}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Voir tout <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
          </div>
        </section>

        {/* Charts row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent members */}
          <div className="bg-card border border-border/50 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />Derniers membres
              </h3>
              <span className="text-xs text-muted-foreground font-semibold bg-muted px-3 py-1 rounded-full">{users.length} total</span>
            </div>
            <div className="space-y-3">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun membre</p>
              ) : users.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-primary">{u.full_name?.[0] || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{u.full_name || 'Sans nom'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{u.role || 'user'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming events */}
          {isAdministrator && <>
          <div className="bg-card border border-border/50 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />Prochains événements
              </h3>
              <Link to="/events" className="text-xs text-primary font-semibold bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors">Voir tout</Link>
            </div>
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun événement</p>
              ) : upcomingEvents.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors">
                  {e.date && (
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-amber-600 uppercase leading-none">
                        {format(new Date(e.date), 'MMM', { locale: fr })}
                      </span>
                      <span className="text-lg font-black text-amber-600 leading-none">
                        {format(new Date(e.date), 'd')}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.location || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Users className="w-3 h-3" />
                    {e.attendee_count || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>}
        </div>

        {/* Activity row */}
        {isAdministrator && <>
        <div className="bg-card border border-border/50 rounded-3xl p-6">
          <h3 className="font-black text-lg flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-primary" />Demandes de prière récentes
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {prayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande</p>
            ) : prayers.slice(0, 4).map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-muted/50 border border-border/30">
                <p className="text-sm line-clamp-2 mb-2">{p.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{p.is_anonymous ? 'Anonyme' : p.author_name}</span>
                  <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-red-500" />{p.prayer_count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        </>}
      </div>
    </div>
  );
}
