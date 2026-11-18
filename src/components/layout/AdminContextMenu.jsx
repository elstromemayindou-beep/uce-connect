import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen, Calendar, ChevronDown, ClipboardList, HandCoins,
  Heart, LockKeyhole, Network, Palette, Radio, Shield, UserCog, Users,
  Music, Images, Gamepad2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { appClient } from '@/api/appClient';
import { canManageNotifications } from '@/lib/navigation';

const menuItems = [
  { label: 'Tableau de bord', description: 'Vue d’ensemble', path: '/admin', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'TRESORIER', 'CONTROLEUR_FIN', 'GESTIONNAIRE_MEMBRES', 'SECRETAIRE_GENERAL'] },
  { label: 'Membres', description: 'Fiches et suivi des membres', path: '/admin/members', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'GESTIONNAIRE_MEMBRES'] },
  { label: 'Groupes et départements', description: 'Structure de l’église', path: '/admin/groups', icon: Network, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'] },
  { label: 'Équipes et ministères', description: 'Gestion des équipes de service', path: '/admin/teams', icon: Music, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
  { label: 'Rôles et affectations', description: 'Responsabilités et accès', path: '/admin/organisation', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
  { label: 'Demandes de responsables', description: 'Proposer une affectation à valider', path: '/admin/role-requests', icon: UserCog, roles: ['PASTEUR_PRINCIPAL'] },
  { label: 'Trésorerie', description: 'Caisse, dons et dépenses', path: '/admin/finance', icon: HandCoins, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'TRESORIER', 'CONTROLEUR_FIN'] },
  { label: 'Rapport financier', description: 'Rapport journalier et approbations du pasteur', path: '/admin/finance/report', icon: HandCoins, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'] },
  { label: 'Détails des comptes', description: 'Plan de comptes', path: '/admin/finance/accounts', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'TRESORIER', 'CONTROLEUR_FIN'] },
  { label: 'Événements', description: 'Programmes et affiches', path: '/admin/content?tab=events', icon: Calendar, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'SECRETAIRE_GENERAL', 'RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT', 'RESP_COMMISSION', 'SECRETAIRE_COMMISSION'] },
  { label: 'Pensées du jour', description: 'Méditations publiées pendant 24 heures', path: '/admin/content?tab=thoughts', icon: Heart, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'SECRETAIRE_GENERAL'] },
  { label: 'Photothèque', description: 'Albums et photos des cultes', path: '/admin/gallery', icon: Images, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'SECRETAIRE_GENERAL'] },
  { label: 'Prédications et médias', description: 'Messages, audio et documents', path: '/admin/content?tab=sermons', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'] },
  { label: 'Directs', description: 'Liens des cultes en direct', path: '/admin/live', icon: Radio, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
  { label: 'Formations bibliques', description: 'Parcours et cours', path: '/admin/studies', icon: LockKeyhole, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'] },
  { label: 'Quiz biblique', description: 'Questions et récompenses', path: '/admin/quiz', icon: Gamepad2, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
  { label: 'Notifications', description: 'Annonces aux membres', path: '/admin/notifications', icon: Heart, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL', 'SECRETAIRE_GENERAL'] },
  { label: 'Responsables', description: 'Équipe affichée dans l’application', path: '/admin/responsibles', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
  { label: 'Communautés', description: 'Coordonnées, pasteur et image des communautés', path: '/communities', icon: Network, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
  { label: 'Design et identité', description: 'Personnalisation de l’application', path: '/admin/design', icon: Palette, roles: ['SUPER_ADMIN', 'ADMIN_GENERAL'] },
];

export default function AdminContextMenu() {
  const location = useLocation();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdminContext = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  if (!isAdminContext || !user) return null;

  const items = menuItems.filter((item) => item.roles.some((role) => roles.includes(role))
    || (['/admin/notifications', '/admin/gallery'].includes(item.path) && canManageNotifications(user)));
  const assignments = (user.role_assignments || []).flatMap((assignment) => {
    if (['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT', 'MONITEUR_ECOLE_DIMANCHE'].includes(assignment.code) && assignment.department?.id) {
      return [{ label: assignment.department.name, description: 'Espace de département', path: `/admin/departements/${assignment.department.id}`, icon: Network }];
    }
    if (['RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code) && assignment.commission?.id) {
      return [{ label: assignment.commission.name, description: assignment.department?.name || 'Espace de commission', path: `/admin/commissions/${assignment.commission.id}`, icon: Users }];
    }
    return [];
  });
  const availableItems = [
    ...items,
    ...assignments.filter((assignment, index) => assignments.findIndex((entry) => entry.path === assignment.path) === index),
  ];
  const currentPath = `${location.pathname}${location.search}`;
  const currentItem = availableItems.find((item) => item.path === currentPath
    || (item.path === '/admin' && currentPath.startsWith('/admin?'))
    || (item.path.startsWith('/admin/content?') && item.path === currentPath)
    || (item.path === '/admin/finance' && location.pathname === '/admin/finance/accounts')
    || (item.path === '/admin/studies' && location.pathname === '/studies')
    || (item.path === '/admin/live' && location.pathname === '/live'))
    || availableItems.find((item) => item.path === location.pathname);

  if (!availableItems.length) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {currentItem?.icon ? <currentItem.icon className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold">{currentItem?.label || 'Espace de gestion'}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{currentItem?.description || 'Accès rapide aux modules disponibles'}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="shrink-0 gap-2 rounded-full border-border/70 bg-card/80 shadow-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary"><Shield className="h-3.5 w-3.5" /></span>
              <span className="hidden sm:inline">Menu de gestion</span><span className="sm:hidden">Menu</span><ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[min(75vh,36rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-border/70 bg-background/95 p-3 shadow-elev-4 backdrop-blur-xl">
            <DropdownMenuLabel className="px-2 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Vos espaces de gestion</DropdownMenuLabel>
            <DropdownMenuSeparator className="mb-2" />
            {availableItems.map((item, index) => {
              const isSelected = currentItem?.path === item.path;
              return (
                <DropdownMenuItem key={item.path} asChild className="mb-1 cursor-pointer rounded-2xl p-0 focus:bg-transparent">
                  <Link to={item.path} className={`group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${isSelected ? 'border-primary/20 bg-primary/5' : 'border-transparent hover:border-border/70 hover:bg-card'}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm transition group-hover:scale-105 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground/60">{String(index + 1).padStart(2, '0')}</span>
                </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
