import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Network, Plus, Users, Pencil, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const emptyGroup = { name: '', type: 'other', description: '' };
const emptyStructure = { code: '', name: '', description: '' };

export default function OrganizationManagement() {
  const queryClient = useQueryClient();
  const [groupDraft, setGroupDraft] = useState(emptyGroup);
  const [editingGroup, setEditingGroup] = useState('');
  const [departmentDraft, setDepartmentDraft] = useState(emptyStructure);
  const [commissionDraft, setCommissionDraft] = useState({ ...emptyStructure, department_id: '' });
  const [editingDepartment, setEditingDepartment] = useState('');
  const [editingCommission, setEditingCommission] = useState('');
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => appClient.entities.Group.list(),
    enabled: Boolean(user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role))),
  });
  const { data: structure = [], isLoading: structureLoading, isError } = useQuery({
    queryKey: ['organization-structure'],
    queryFn: () => appClient.organization.structure(),
  });
  const canManage = Boolean(user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role)));

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['groups'] }),
      queryClient.invalidateQueries({ queryKey: ['organization-structure'] }),
      queryClient.invalidateQueries({ queryKey: ['church-departments'] }),
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] }),
    ]);
  };
  const groupMutation = useMutation({
    mutationFn: () => editingGroup
      ? appClient.entities.Group.update(editingGroup, groupDraft)
      : appClient.entities.Group.create({ ...groupDraft, members: [], is_private: true }),
    onSuccess: async () => {
      await refresh();
      setEditingGroup('');
      setGroupDraft(emptyGroup);
      toast.success('Groupe enregistré.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer le groupe.'),
  });
  const removeGroup = useMutation({
    mutationFn: /** @param {string} id */ (id) => appClient.entities.Group.remove(id),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message || 'Impossible de supprimer le groupe.'),
  });
  const departmentMutation = useMutation({
    mutationFn: () => editingDepartment
      ? appClient.organization.updateDepartment(editingDepartment, departmentDraft)
      : appClient.organization.createDepartment(departmentDraft),
    onSuccess: async () => {
      await refresh();
      setEditingDepartment('');
      setDepartmentDraft(emptyStructure);
      toast.success('Département enregistré.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer le département.'),
  });
  const commissionMutation = useMutation({
    mutationFn: () => editingCommission
      ? appClient.organization.updateCommission(editingCommission, commissionDraft)
      : appClient.organization.createCommission(commissionDraft),
    onSuccess: async () => {
      await refresh();
      setEditingCommission('');
      setCommissionDraft({ ...emptyStructure, department_id: '' });
      toast.success('Commission enregistrée.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer la commission.'),
  });
  const toggleStructureStatus = useMutation({
    mutationFn: /** @param {{ kind: 'department' | 'commission', id: string, active: boolean }} variables */ ({ kind, id, active }) => kind === 'department'
      ? appClient.organization.updateDepartment(id, { active })
      : appClient.organization.updateCommission(id, { active }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message || 'Impossible de modifier le statut.'),
  });

  useEffect(() => {
    if (!commissionDraft.department_id && structure.length) {
      const activeDepartment = structure.find((department) => department.statut === 'actif');
      if (activeDepartment) setCommissionDraft((draft) => ({ ...draft, department_id: activeDepartment.id }));
    }
  }, [commissionDraft.department_id, structure]);

  if (!canManage) {
    return <div className="p-8 text-center"><h1 className="text-xl font-black">Accès restreint</h1><p className="mt-2 text-muted-foreground">La gestion des groupes et de la structure est réservée à l’administration et au pasteur.</p></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin" className="text-sm font-bold text-primary">← Retour à l’administration</Link>
      <header className="glass-panel rounded-3xl p-6">
        <Network className="mb-3 h-9 w-9 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Espace de gestion</p>
        <h1 className="text-3xl font-black">Groupes, départements et commissions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Les suppressions de structure sont des archivages : l’historique des affectations est conservé.</p>
      </header>

      {user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role)) && <section className="glass-panel space-y-4 rounded-3xl p-5">
        <h2 className="flex items-center gap-2 text-xl font-black"><Users className="h-5 w-5 text-primary" />Groupes</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); groupMutation.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="group-name">Nom du groupe</Label><Input id="group-name" required maxLength={160} value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="group-type">Type</Label><select id="group-type" value={groupDraft.type} onChange={(event) => setGroupDraft({ ...groupDraft, type: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cell">Cellule</option><option value="bible_study">Étude biblique</option><option value="youth_girls">Jeunes filles</option><option value="youth_boys">Jeunes garçons</option><option value="couples">Couples</option><option value="other">Autre</option></select></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="group-description">Description</Label><Textarea id="group-description" maxLength={2000} value={groupDraft.description} onChange={(event) => setGroupDraft({ ...groupDraft, description: event.target.value })} /></div>
          <div className="flex gap-2 md:col-span-2"><Button disabled={groupMutation.isPending}><Plus className="mr-2 h-4 w-4" />{editingGroup ? 'Enregistrer le groupe' : 'Ajouter un groupe'}</Button>{editingGroup && <Button type="button" variant="outline" onClick={() => { setEditingGroup(''); setGroupDraft(emptyGroup); }}>Annuler</Button>}</div>
        </form>
        {groupsLoading ? <p className="text-sm text-muted-foreground">Chargement des groupes…</p> : groups.length === 0 ? <p className="text-sm text-muted-foreground">Aucun groupe enregistré.</p> : (
          <div className="divide-y divide-border/60">
            {groups.map((group) => <article key={group.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="font-bold">{group.name}</p><p className="text-xs text-muted-foreground">{group.description || 'Sans description'} · {group.members?.length || 0} membres</p></div>
              <Button size="sm" variant="outline" onClick={() => { setEditingGroup(group.id); setGroupDraft({ name: group.name || '', type: group.type || 'other', description: group.description || '' }); }}><Pencil className="mr-1 h-4 w-4" />Modifier</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if (window.confirm(`Supprimer le groupe « ${group.name} » ?`)) removeGroup.mutate(group.id); }}><Archive className="mr-1 h-4 w-4" />Supprimer</Button>
            </article>)}
          </div>
        )}
      </section>}

      <section className="glass-panel space-y-4 rounded-3xl p-5">
        <h2 className="flex items-center gap-2 text-xl font-black"><Building2 className="h-5 w-5 text-primary" />Départements</h2>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); departmentMutation.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="department-code">Code</Label><Input id="department-code" required maxLength={30} value={departmentDraft.code} onChange={(event) => setDepartmentDraft({ ...departmentDraft, code: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="department-name">Nom</Label><Input id="department-name" required maxLength={150} value={departmentDraft.name} onChange={(event) => setDepartmentDraft({ ...departmentDraft, name: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="department-description">Description</Label><Input id="department-description" value={departmentDraft.description} maxLength={2000} onChange={(event) => setDepartmentDraft({ ...departmentDraft, description: event.target.value })} /></div>
          <div className="flex gap-2 md:col-span-3"><Button disabled={departmentMutation.isPending}>{editingDepartment ? 'Enregistrer le département' : 'Ajouter un département'}</Button>{editingDepartment && <Button type="button" variant="outline" onClick={() => { setEditingDepartment(''); setDepartmentDraft(emptyStructure); }}>Annuler</Button>}</div>
        </form>

        <h2 className="flex items-center gap-2 border-t border-border/60 pt-5 text-xl font-black"><Network className="h-5 w-5 text-primary" />Commissions</h2>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); commissionMutation.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="commission-department">Département</Label><select id="commission-department" required value={commissionDraft.department_id} onChange={(event) => setCommissionDraft({ ...commissionDraft, department_id: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choisir</option>{structure.filter((department) => department.statut === 'actif').map((department) => <option key={department.id} value={department.id}>{department.nom}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="commission-code">Code</Label><Input id="commission-code" required maxLength={30} value={commissionDraft.code} onChange={(event) => setCommissionDraft({ ...commissionDraft, code: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="commission-name">Nom</Label><Input id="commission-name" required maxLength={150} value={commissionDraft.name} onChange={(event) => setCommissionDraft({ ...commissionDraft, name: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="commission-description">Description</Label><Input id="commission-description" maxLength={2000} value={commissionDraft.description} onChange={(event) => setCommissionDraft({ ...commissionDraft, description: event.target.value })} /></div>
          <div className="flex gap-2 md:col-span-4"><Button disabled={commissionMutation.isPending}>{editingCommission ? 'Enregistrer la commission' : 'Ajouter une commission'}</Button>{editingCommission && <Button type="button" variant="outline" onClick={() => { setEditingCommission(''); setCommissionDraft({ ...emptyStructure, department_id: '' }); }}>Annuler</Button>}</div>
        </form>

        {structureLoading ? <p className="text-sm text-muted-foreground">Chargement de la structure…</p> : isError ? <p role="alert" className="text-sm text-destructive">Impossible de charger la structure.</p> : (
          <div className="space-y-4 border-t border-border/60 pt-4">
            {structure.map((department) => <article key={department.id} className="rounded-2xl border border-border/60 bg-card/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1"><p className="font-bold">{department.nom} <span className="text-xs text-muted-foreground">({department.code}) · {department.statut}</span></p><p className="text-sm text-muted-foreground">{department.description}</p></div>
                <Button size="sm" variant="outline" onClick={() => { setEditingDepartment(department.id); setDepartmentDraft({ code: department.code, name: department.nom, description: department.description || '' }); }}><Pencil className="mr-1 h-4 w-4" />Modifier</Button>
                <Button size="sm" variant="outline" onClick={() => toggleStructureStatus.mutate({ kind: 'department', id: department.id, active: department.statut !== 'actif' })}>{department.statut === 'actif' ? <Archive className="mr-1 h-4 w-4" /> : <RotateCcw className="mr-1 h-4 w-4" />}{department.statut === 'actif' ? 'Archiver' : 'Réactiver'}</Button>
              </div>
              <div className="mt-3 space-y-2 pl-4">
                {department.commissions.map((commission) => <div key={commission.id} className="flex flex-wrap items-center gap-2 border-l-2 border-primary/20 pl-3">
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{commission.nom} <span className="text-xs text-muted-foreground">({commission.code}) · {commission.statut}</span></p><p className="text-xs text-muted-foreground">{commission.description}</p></div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingCommission(commission.id); setCommissionDraft({ code: commission.code, name: commission.nom, description: commission.description || '', department_id: department.id }); }}><Pencil className="mr-1 h-4 w-4" />Modifier</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleStructureStatus.mutate({ kind: 'commission', id: commission.id, active: commission.statut !== 'actif' })}>{commission.statut === 'actif' ? 'Archiver' : 'Réactiver'}</Button>
                </div>)}
              </div>
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}
