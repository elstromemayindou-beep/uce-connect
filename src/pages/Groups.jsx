import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Lock, Search, UserPlus, Unlock, Network, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/components/ui/AnimatedPage';

const typeLabels = {
  cell: 'Cellule', bible_study: 'Étude biblique', youth_girls: 'Jeunes filles',
  youth_boys: 'Jeunes garçons', couples: 'Couples', other: 'Autre'
};
const typeColors = {
  cell: 'bg-blue-500/15 text-blue-600',
  bible_study: 'bg-green-500/15 text-green-600',
  youth_girls: 'bg-pink-500/15 text-pink-600',
  youth_boys: 'bg-indigo-500/15 text-indigo-600',
  couples: 'bg-red-500/15 text-red-500',
  other: 'bg-slate-500/15 text-slate-600',
};

export default function Groups() {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('groups');

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: groups = [], isLoading, isError: groupsError } = useQuery({ queryKey: ['groups'], queryFn: () => appClient.entities.Group.list() });
  const {
    data: departments = [],
    isLoading: isLoadingDepartments,
    isError: departmentsError,
  } = useQuery({
    queryKey: ['church-departments'],
    queryFn: () => appClient.organization.departments(),
    enabled: activeSection === 'departments',
  });

  const joinMutation = useMutation({
    /** @param {{ id: string, members?: string[] }} group */
    mutationFn: async (group) => {
      const members = group.members || [];
      if (members.includes(user?.email)) return;
      await appClient.entities.Group.update(group.id, { members: [...members, user?.email] });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); toast.success('Vous avez rejoint le groupe !'); },
  });

  const filtered = groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));
  const departmentSearch = search.trim().toLowerCase();
  const filteredDepartments = departments.flatMap((department) => {
    const departmentMatches = `${department.nom} ${department.description || ''}`.toLowerCase().includes(departmentSearch);
    const matchingCommissions = department.commissions.filter((commission) => (
      `${commission.nom} ${commission.description || ''}`.toLowerCase().includes(departmentSearch)
    ));
    if (departmentSearch && !departmentMatches && matchingCommissions.length === 0) return [];
    return [{
      ...department,
      commissions: departmentMatches || !departmentSearch ? department.commissions : matchingCommissions,
    }];
  });
  const isMember = (group) => group.members?.includes(user?.email);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative min-h-64 overflow-hidden bg-gradient-to-br from-indigo-950 via-primary to-blue-900 text-white">
        <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&q=80" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-indigo-950/75 to-primary/65" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>
        <motion.div
          className="relative flex min-h-64 items-end justify-between px-6 py-12 md:px-12"
          initial={reduceMotion ? false : 'hidden'}
          animate="visible"
          variants={staggerItem}
        >
          <div>
            <p className="text-amber-400 font-bold tracking-widest text-xs uppercase mb-2">Communauté</p>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white">Groupes & départements</h1>
              <p className="text-white/70 mt-2">Rejoignez un groupe et découvrez les services de l’église</p>
          </div>
        </motion.div>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-2 gap-3" role="tablist" aria-label="Espaces de communauté">
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'groups'}
              onClick={() => { setActiveSection('groups'); setSearch(''); }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-bold transition ${activeSection === 'groups' ? 'border-primary bg-primary text-primary-foreground' : 'glass-panel'}`}
            >
              <Users className="h-4 w-4" />Groupes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'departments'}
              onClick={() => { setActiveSection('departments'); setSearch(''); }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-bold transition ${activeSection === 'departments' ? 'border-primary bg-primary text-primary-foreground' : 'glass-panel'}`}
            >
              <Network className="h-4 w-4" />Départements
            </button>
        </div>

        {/* Search */}
        <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={activeSection === 'groups' ? 'Rechercher un groupe...' : 'Rechercher un département ou une commission...'}
              className="pl-11 h-12 rounded-2xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
        </div>

        {activeSection === 'groups' && groupsError ? (
            <p role="alert" className="py-12 text-center text-destructive">Impossible de charger les groupes. Réessayez plus tard.</p>
        ) : activeSection === 'groups' && filtered.length === 0 && !isLoading ? (
            <div className="text-center py-20 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-semibold text-lg">Aucun groupe trouvé</p>
            </div>
        ) : activeSection === 'groups' ? (
            <motion.div
              className="grid gap-4 md:grid-cols-2"
              variants={staggerContainer}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
            >
            {filtered.map((group) => (
              <motion.div key={group.id} variants={staggerItem} whileHover={reduceMotion ? undefined : { y: -5 }} className="bg-card border border-border/50 rounded-3xl p-5 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {group.image_url ? (
                      <img src={group.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-7 h-7 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base truncate">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${typeColors[group.type] || 'bg-muted text-muted-foreground'}`}>
                        {typeLabels[group.type] || group.type}
                      </span>
                      {group.is_private ? (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Unlock className="w-3 h-3 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
                {group.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{group.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-semibold">{group.members?.length || 0} membres</span>
                  </div>
                  <Button
                    size="sm"
                    className={`rounded-xl font-bold ${isMember(group) ? 'bg-green-100 text-green-600 hover:bg-green-100' : 'bg-primary text-white'}`}
                    onClick={() => joinMutation.mutate(group)}
                    disabled={isMember(group)}
                  >
                    {isMember(group) ? '✓ Membre' : <><UserPlus className="w-3.5 h-3.5 mr-1" />Rejoindre</>}
                  </Button>
                </div>
              </motion.div>
            ))}
            </motion.div>
        ) : departmentsError ? (
          <p role="alert" className="py-12 text-center text-destructive">Impossible de charger les départements de l’église. Réessayez plus tard.</p>
        ) : isLoadingDepartments ? (
          <p className="py-12 text-center text-muted-foreground">Chargement des départements…</p>
        ) : filteredDepartments.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="mx-auto mb-4 h-16 w-16 opacity-20" />
            <p className="font-semibold text-lg">Aucun département trouvé</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {filteredDepartments.length} département{filteredDepartments.length === 1 ? '' : 's'} de l’église
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredDepartments.map((department) => (
                <details key={department.id} className="glass-panel group rounded-3xl p-5">
                  <summary className="flex cursor-pointer list-none items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black">{department.nom}</h2>
                      {department.description && <p className="mt-1 text-sm text-muted-foreground">{department.description}</p>}
                      <p className="mt-2 text-xs font-semibold text-primary">
                        {department.commissions.length} commission{department.commissions.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span aria-hidden="true" className="text-xl text-muted-foreground transition group-open:rotate-180">⌄</span>
                  </summary>
                  <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                    {department.commissions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune commission correspondante.</p>
                    ) : department.commissions.map((commission) => (
                      <div key={commission.id} className="rounded-2xl bg-background/70 p-3">
                        <p className="text-sm font-bold">{commission.nom}</p>
                        {commission.description && <p className="mt-1 text-xs text-muted-foreground">{commission.description}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}