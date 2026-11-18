import {
  Home, Users, Calendar, BookOpen, Heart, Music,
  Church, UserCircle, HandCoins, Pencil, UsersRound, Shield, Crown, Mail,
  Radio, LockKeyhole, MapPinned, Images, Gamepad2, MessageCircle,
} from 'lucide-react';

export const navigationItems = [
  { path: '/', icon: Home, label: 'Accueil', color: 'text-indigo-500' },
  { path: '/communities', icon: Church, label: 'Communautés', color: 'text-violet-500' },
  { path: '/events', icon: Calendar, label: 'Événements', color: 'text-green-500' },
  { path: '/gallery', icon: Images, label: 'Photothèque', color: 'text-amber-500' },
  { path: '/sermons', icon: Music, label: 'Prédications', color: 'text-purple-500' },
  { path: '/live', icon: Radio, label: 'Cultes en direct', color: 'text-red-500' },
  { path: '/bible', icon: BookOpen, label: 'Bible', color: 'text-blue-500' },
  { path: '/studies', icon: LockKeyhole, label: 'Formations privées', color: 'text-indigo-500' },
  { path: '/prayers', icon: Heart, label: 'Prières', color: 'text-rose-500' },
  { path: '/groups', icon: UsersRound, label: 'Groupes', color: 'text-orange-500' },
  { path: '/department-chat', icon: MessageCircle, label: 'Chat des départements', color: 'text-blue-500' },
  { path: '/teams', icon: Users, label: 'Équipes', color: 'text-cyan-600' },
  { path: '/donations', icon: HandCoins, label: 'Dons', color: 'text-amber-500' },
  { path: '/journal', icon: Pencil, label: 'Journal', color: 'text-pink-500' },
  { path: '/quiz', icon: Gamepad2, label: 'Jeux bibliques', color: 'text-emerald-500' },
  { path: '/leadership', icon: Crown, label: 'Responsables', color: 'text-yellow-600' },
  { path: '/profile', icon: UserCircle, label: 'Profil', color: 'text-sky-500' },
  { path: '/admin', icon: Shield, label: 'Administration', color: 'text-slate-500' },
  { path: '/contact', icon: Mail, label: 'Contact', color: 'text-emerald-500' },
  { path: '/map', icon: MapPinned, label: 'Nous trouver', color: 'text-red-500' },
];

export function isSystemAdministrator(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role));
}

export function canManageNotifications(user) {
  const assignments = Array.isArray(user?.role_assignments) ? user.role_assignments : [];
  if (user?.roles?.includes('PASTEUR_PRINCIPAL') && !isSystemAdministrator(user)) return false;
  return isSystemAdministrator(user)
    || assignments.some((assignment) => assignment.department?.code === 'COM'
      && (assignment.scope === 'departement'
        && ['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT'].includes(assignment.code)
        || assignment.scope === 'commission'
        && ['RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code)));
}
