import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { ClipboardList, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, EyeOff } from 'lucide-react';

const scopeLabels = {
  eglise: 'Église entière',
  departement: 'Département',
  commission: 'Commission',
};

export default function RoleAssignments() {
  const queryClient = useQueryClient();
  const [profileId, setProfileId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [commissionId, setCommissionId] = useState('');
  const [responsibleDraft, setResponsibleDraft] = useState({ full_name: '', email: '', phone: '', password: '', role_id: '', department_id: '', commission_id: '' });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['organization-admin'],
    queryFn: () => appClient.organization.admin(),
  });
  const selectedRole = data?.roles.find((role) => role.id === roleId);
  const commissions = useMemo(
    () => data?.commissions.filter((commission) => commission.departement_id === departmentId) || [],
    [data?.commissions, departmentId],
  );
  const accountRole = data?.roles.find((role) => role.id === responsibleDraft.role_id);
  const accountCommissions = useMemo(
    () => data?.commissions.filter((commission) => commission.departement_id === responsibleDraft.department_id) || [],
    [data?.commissions, responsibleDraft.department_id],
  );
  const canCreateAccount = Boolean(responsibleDraft.full_name.trim() && responsibleDraft.email.trim()
    && responsibleDraft.password.length >= 8 && accountRole?.assignable !== false
    && (accountRole?.niveau_portee === 'eglise'
      || (responsibleDraft.department_id && (accountRole?.niveau_portee !== 'commission' || responsibleDraft.commission_id))));
  const createAccountMutation = useMutation({
    mutationFn: () => appClient.organization.createResponsibleAccount(responsibleDraft),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-admin'] }),
        queryClient.invalidateQueries({ queryKey: ['managed-members'] }),
      ]);
      setResponsibleDraft({ full_name: '', email: '', phone: '', password: '', role_id: '', department_id: '', commission_id: '' });
      toast.success('Compte créé et rôle attribué. Transmettez le mot de passe au responsable de manière sécurisée.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de créer ce compte.'),
  });
  const resetPasswordMutation = useMutation({
    mutationFn: () => appClient.organization.resetResponsiblePassword(resetTarget.profile_id, resetPassword),
    onSuccess: () => {
      toast.success(`Nouveau mot de passe enregistré pour ${resetTarget.nom}.`);
      setResetTarget(null);
      setResetPassword('');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de réinitialiser le mot de passe.'),
  });
  const assignMutation = useMutation({
    mutationFn: () => appClient.organization.assignRole({
      profile_id: profileId,
      role_id: roleId,
      department_id: selectedRole?.niveau_portee === 'eglise' ? null : departmentId || null,
      commission_id: selectedRole?.niveau_portee === 'commission' ? commissionId || null : null,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-admin'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      setRoleId('');
      setDepartmentId('');
      setCommissionId('');
      toast.success('Rôle attribué.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’attribuer ce rôle.'),
  });
  const revokeMutation = useMutation({
    /** @param {string} id */
    mutationFn: (id) => appClient.organization.revokeRole(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-admin'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      toast.success('Attribution révoquée.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de révoquer cette attribution.'),
  });

  if (isLoading) {
    return <p className="p-8 text-center text-muted-foreground">Chargement des rôles et des périmètres…</p>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-black">Gestion indisponible</h1>
        <p className="mt-2 text-muted-foreground">Vous devez être administrateur de l’église pour gérer les attributions.</p>
        <Link to="/admin" className="mt-5 inline-block text-sm font-bold text-primary">Retour aux espaces</Link>
      </div>
    );
  }

  const canSubmit = Boolean(profileId && roleId
    && selectedRole?.assignable !== false
    && (selectedRole?.niveau_portee === 'eglise'
      || (departmentId && (selectedRole?.niveau_portee !== 'commission' || commissionId))));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin" className="text-sm font-bold text-primary">← Retour à l’administration</Link>
      <header className="glass-panel rounded-3xl p-6">
        <ClipboardList className="mb-4 h-10 w-10 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Administration UCE</p>
        <h1 className="mt-1 text-3xl font-black">Rôles et affectations</h1>
        <p className="mt-2 text-muted-foreground">
          Les départements et commissions sont chargés depuis la base. Un rôle limité à un périmètre n’ouvre que ce périmètre.
        </p>
      </header>

      <section className="glass-panel space-y-5 rounded-3xl p-5 md:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h2 className="text-xl font-black">Créer le compte d’un responsable</h2>
            <p className="mt-1 text-sm text-muted-foreground">Crée son accès à l’application, sa fiche membre et attribue son rôle en une seule étape.</p>
          </div>
        </div>
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => { event.preventDefault(); if (canCreateAccount) createAccountMutation.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="responsible-name">Nom complet</Label><Input id="responsible-name" required maxLength={150} value={responsibleDraft.full_name} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, full_name: event.target.value })} placeholder="Ex. Jean Nzambe" /></div>
          <div className="space-y-1.5"><Label htmlFor="responsible-email">Adresse e-mail</Label><Input id="responsible-email" type="email" required maxLength={150} autoComplete="email" value={responsibleDraft.email} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, email: event.target.value })} placeholder="nom@exemple.com" /></div>
          <div className="space-y-1.5"><Label htmlFor="responsible-phone">Téléphone</Label><Input id="responsible-phone" type="tel" maxLength={30} value={responsibleDraft.phone} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, phone: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="responsible-password">Mot de passe initial</Label><div className="relative"><Input id="responsible-password" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={72} autoComplete="new-password" value={responsibleDraft.password} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, password: event.target.value })} className="pr-11" /><button type="button" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><p className="text-xs text-muted-foreground">8 caractères minimum. Remettez-le au responsable par un canal sûr.</p></div>
          <label className="space-y-1.5 text-sm font-semibold">Rôle
            <select value={responsibleDraft.role_id} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, role_id: event.target.value, department_id: '', commission_id: '' })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>
              <option value="">Choisir un rôle</option>{data.roles.map((role) => <option key={role.id} value={role.id} disabled={!role.assignable}>{role.nom} · {scopeLabels[role.niveau_portee] || role.niveau_portee}{role.assignable ? '' : ' · réservé'}</option>)}
            </select>
          </label>
          {accountRole?.niveau_portee !== 'eglise' && accountRole && <label className="space-y-1.5 text-sm font-semibold">Département
            <select value={responsibleDraft.department_id} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, department_id: event.target.value, commission_id: '' })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required><option value="">Choisir un département</option>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.nom}</option>)}</select>
          </label>}
          {accountRole?.niveau_portee === 'commission' && <label className="space-y-1.5 text-sm font-semibold">Commission
            <select value={responsibleDraft.commission_id} onChange={(event) => setResponsibleDraft({ ...responsibleDraft, commission_id: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required disabled={!responsibleDraft.department_id}><option value="">Choisir une commission</option>{accountCommissions.map((commission) => <option key={commission.id} value={commission.id}>{commission.nom}</option>)}</select>
          </label>}
          <div className="flex items-end sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={!canCreateAccount || createAccountMutation.isPending} className="gap-2 rounded-xl font-bold"><UserPlus className="h-4 w-4" />{createAccountMutation.isPending ? 'Création du compte…' : 'Créer le compte et attribuer le rôle'}</Button></div>
        </form>
      </section>

      <section className="glass-panel rounded-3xl p-5 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-black"><UserPlus className="h-5 w-5 text-primary" />Attribuer un rôle</h2>
        {data.members.length === 0 || data.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Il faut au moins un profil membre actif et un rôle actif pour créer une attribution.</p>
        ) : (
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) assignMutation.mutate();
            }}
          >
            <label className="space-y-1.5 text-sm font-semibold">
              Membre
              <select
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3"
                required
              >
                <option value="">Choisir un membre</option>
                {data.members.map((member) => (
                  <option key={member.profile_id} value={member.profile_id}>
                    {member.nom}{member.email ? ` · ${member.email}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-semibold">
              Rôle
              <select
                value={roleId}
                onChange={(event) => {
                  setRoleId(event.target.value);
                  setDepartmentId('');
                  setCommissionId('');
                }}
                className="h-11 w-full rounded-xl border border-input bg-background px-3"
                required
              >
                <option value="">Choisir un rôle</option>
                {data.roles.map((role) => (
                  <option key={role.id} value={role.id} disabled={!role.assignable}>
                    {role.nom} · {scopeLabels[role.niveau_portee] || role.niveau_portee}{role.assignable ? '' : ' · attribution réservée'}
                  </option>
                ))}
              </select>
            </label>

            {selectedRole?.niveau_portee !== 'eglise' && selectedRole && (
              <label className="space-y-1.5 text-sm font-semibold">
                Département
                <select
                  value={departmentId}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setCommissionId('');
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3"
                  required
                >
                  <option value="">Choisir un département</option>
                  {data.departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.nom}</option>
                  ))}
                </select>
              </label>
            )}

            {selectedRole?.niveau_portee === 'commission' && (
              <label className="space-y-1.5 text-sm font-semibold">
                Commission
                <select
                  value={commissionId}
                  onChange={(event) => setCommissionId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3"
                  required
                  disabled={!departmentId}
                >
                  <option value="">Choisir une commission</option>
                  {commissions.map((commission) => (
                    <option key={commission.id} value={commission.id}>{commission.nom}</option>
                  ))}
                </select>
              </label>
            )}

            {selectedRole?.modules?.length > 0 && (
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Modules autorisés par ce rôle</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRole.modules.map((module) => (
                    <span key={module} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{module}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <Button type="submit" disabled={!canSubmit || assignMutation.isPending} className="rounded-xl font-bold">
                {assignMutation.isPending ? 'Attribution…' : 'Attribuer le rôle'}
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="glass-panel rounded-3xl p-5 md:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Attributions actives</h2>
            <p className="text-sm text-muted-foreground">{data.assignments.length} attribution{data.assignments.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        {data.assignments.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Aucun rôle attribué.</p>
        ) : (
          <div className="space-y-3">
            {data.assignments.map((assignment) => (
              <article key={assignment.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{assignment.membre_nom}</p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.role_nom}
                    {assignment.departement_nom ? ` · ${assignment.departement_nom}` : ''}
                    {assignment.commission_nom ? ` · ${assignment.commission_nom}` : ''}
                  </p>
                  {assignment.email && <p className="truncate text-xs text-muted-foreground">{assignment.email}</p>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!assignment.profile_id}
                  onClick={() => { setResetTarget({ profile_id: assignment.profile_id, nom: assignment.membre_nom, email: assignment.email }); setResetPassword(''); }}
                  className="gap-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Mot de passe
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(assignment.id)}
                >
                  Révoquer
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => { if (!open && !resetPasswordMutation.isPending) { setResetTarget(null); setResetPassword(''); } }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau mot de passe</DialogTitle>
            <DialogDescription>{resetTarget?.nom}{resetTarget?.email ? ` · ${resetTarget.email}` : ''}. Le nouveau mot de passe remplacera immédiatement l’ancien.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (resetPassword.length >= 8) resetPasswordMutation.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="reset-responsible-password">Mot de passe temporaire</Label><Input id="reset-responsible-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /><p className="text-xs text-muted-foreground">8 caractères minimum. Transmettez-le directement à la personne par un canal sûr.</p></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={resetPasswordMutation.isPending} onClick={() => setResetTarget(null)}>Annuler</Button><Button type="submit" disabled={resetPassword.length < 8 || resetPasswordMutation.isPending}>{resetPasswordMutation.isPending ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
