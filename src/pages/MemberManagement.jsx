import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Users, UserPlus, Pencil, Archive, RotateCcw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const blankMember = {
  nom: '', postnom: '', prenom: '', sexe: '', telephone: '', email: '',
  adresse: '', date_naissance: '', date_adhesion: '',
};

function dateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export default function MemberManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState(blankMember);
  const [editingId, setEditingId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => appClient.auth.me(),
  });
  const isPastor = Boolean(user?.roles?.includes('PASTEUR_PRINCIPAL'));
  const canManageMembers = Boolean(user?.roles?.some((role) => [
    'SUPER_ADMIN', 'ADMIN_GENERAL', 'GESTIONNAIRE_MEMBRES',
  ].includes(role)));
  const canViewMembers = canManageMembers || isPastor;
  const { data: members = [], isLoading, isError } = useQuery({
    queryKey: ['managed-members'],
    queryFn: () => appClient.members.list(),
    enabled: canViewMembers,
  });
  const {
    data: availableUsers = [],
    isLoading: isLoadingAvailableUsers,
    isError: availableUsersError,
  } = useQuery({
    queryKey: ['available-member-users'],
    queryFn: () => appClient.members.availableUsers(),
    enabled: canManageMembers,
  });
  const saveMutation = useMutation({
    mutationFn: () => editingId
      ? appClient.members.update(editingId, draft)
      : appClient.members.create(draft),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['managed-members'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      ]);
      setDraft(blankMember);
      setEditingId('');
      toast.success(editingId ? 'Fiche membre mise à jour.' : 'Membre ajouté à l’annuaire.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer ce membre.'),
  });
  const statusMutation = useMutation({
    mutationFn: /** @param {{ id: string, active: boolean }} variables */ ({ id, active }) => appClient.members.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['managed-members'] }),
    onError: (error) => toast.error(error.message || 'Impossible de modifier le statut du membre.'),
  });
  const importUserMutation = useMutation({
    /** @param {string} profileId */
    mutationFn: (profileId) => appClient.members.importUser(profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['managed-members'] }),
        queryClient.invalidateQueries({ queryKey: ['available-member-users'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-members'] }),
      ]);
      toast.success('Compte ajouté à l’annuaire et rattaché à sa fiche membre.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’ajouter ce compte à l’annuaire.'),
  });

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return members.filter((member) => (showArchived || member.is_active)
      && (!query || `${member.nom || ''} ${member.postnom || ''} ${member.prenom || ''} ${member.email || ''} ${member.telephone || ''} ${member.numero_membre || ''}`.toLocaleLowerCase().includes(query)));
  }, [members, search, showArchived]);
  const activeCount = members.filter((member) => member.is_active).length;

  const editMember = (member) => {
    setEditingId(member.member_id);
    setDraft({
      nom: member.nom || '',
      postnom: member.postnom || '',
      prenom: member.prenom || '',
      sexe: member.sexe || '',
      telephone: member.telephone || '',
      email: member.email || '',
      adresse: member.adresse || '',
      date_naissance: dateInput(member.date_naissance),
      date_adhesion: dateInput(member.date_adhesion),
    });
  };

  if (isLoadingUser) return <p className="p-8 text-center text-muted-foreground">Chargement de votre espace…</p>;
  if (!canViewMembers) {
    return <div className="mx-auto max-w-lg p-8 text-center"><h1 className="text-xl font-black">Accès restreint</h1><p className="mt-2 text-muted-foreground">La gestion des membres n’est pas associée à votre compte.</p></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin" className="text-sm font-bold text-primary">← Retour à l’administration</Link>
      <header className="glass-panel rounded-3xl p-6 md:p-8">
        <Users className="mb-4 h-10 w-10 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Espace de gestion</p>
        <h1 className="mt-1 text-3xl font-black">Membres</h1>
        <p className="mt-2 text-muted-foreground">Ajouter, modifier et archiver les fiches. Les dossiers archivés gardent leur historique financier.</p>
      </header>

      {canManageMembers && <>
      <section className="glass-panel space-y-4 rounded-3xl p-4 md:p-6">
        <h2 className="flex items-center gap-2 text-xl font-black"><UserPlus className="h-5 w-5 text-primary" />{editingId ? 'Modifier une fiche' : 'Ajouter un membre'}</h2>
        {!editingId && <p className="text-sm text-muted-foreground">Cela crée la fiche de membre, pas son compte de connexion. Le compte téléphone/e-mail devra ensuite être créé et rattaché séparément pour lui donner accès à l’application.</p>}
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }}>
          {[
            ['prenom', 'Prénom'], ['nom', 'Nom *'], ['postnom', 'Postnom'],
            ['telephone', 'Téléphone'], ['email', 'E-mail'], ['adresse', 'Adresse'],
          ].map(([field, label]) => <div key={field} className="space-y-1.5"><Label htmlFor={`member-${field}`}>{label}</Label><Input id={`member-${field}`} required={field === 'nom'} maxLength={field === 'adresse' ? 2000 : 150} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></div>)}
          <div className="space-y-1.5"><Label htmlFor="member-sex">Sexe</Label><select id="member-sex" value={draft.sexe} onChange={(event) => setDraft({ ...draft, sexe: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Non renseigné</option><option value="homme">Homme</option><option value="femme">Femme</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="member-birthdate">Date de naissance</Label><Input id="member-birthdate" type="date" value={draft.date_naissance} onChange={(event) => setDraft({ ...draft, date_naissance: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="member-join-date">Date d’adhésion</Label><Input id="member-join-date" type="date" value={draft.date_adhesion} onChange={(event) => setDraft({ ...draft, date_adhesion: event.target.value })} /></div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Ajouter à l’annuaire'}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(''); setDraft(blankMember); }}>Annuler</Button>}</div>
        </form>
      </section>

      <section className="glass-panel space-y-4 rounded-3xl p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><Smartphone className="h-5 w-5 text-primary" />Comptes de l’application</h2>
            <p className="mt-1 text-sm text-muted-foreground">Rattachez à l’annuaire les comptes UCE existants qui n’ont pas encore de fiche membre.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Rechercher un compte…" className="rounded-xl pl-9" aria-label="Rechercher un compte à ajouter" />
          </div>
        </div>
        {isLoadingAvailableUsers ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement des comptes non rattachés…</p>
        ) : availableUsersError ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Impossible de charger les comptes de l’application.</p>
        ) : availableUsers.filter((account) => `${account.display_name || ''} ${account.telephone || ''}`.toLocaleLowerCase().includes(accountSearch.trim().toLocaleLowerCase())).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            {availableUsers.length ? 'Aucun compte ne correspond à cette recherche.' : 'Tous les comptes inscrits ont déjà une fiche membre.'}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {availableUsers
              .filter((account) => `${account.display_name || ''} ${account.email || ''} ${account.telephone || ''}`.toLocaleLowerCase().includes(accountSearch.trim().toLocaleLowerCase()))
              .map((account) => (
                <article key={account.profile_id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 font-black text-primary">
                    {account.photo_url
                      ? <img src={account.photo_url} alt="" className="h-full w-full object-cover" />
                      : account.display_name?.trim().charAt(0)?.toLocaleUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{account.display_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{account.email || account.telephone || 'Coordonnées non renseignées'} · {account.profile_status === 'en_attente' ? 'inscription en attente' : 'compte actif'}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => importUserMutation.mutate(account.profile_id)}
                    disabled={importUserMutation.isPending}
                    className="rounded-xl"
                  >
                    <UserPlus className="mr-1 h-4 w-4" />Ajouter à l’annuaire
                  </Button>
                </article>
              ))}
          </div>
        )}
      </section>
      </>}

      <section className="glass-panel rounded-3xl p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-xl font-black">Annuaire</h2><p className="text-sm text-muted-foreground">{activeCount} membres actifs · {members.length} fiches</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Afficher les archives</label>
            <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un membre…" className="rounded-xl pl-9" aria-label="Rechercher un membre" /></div>
          </div>
        </div>
        {isLoading ? <p className="py-10 text-center text-muted-foreground">Chargement des membres…</p>
          : isError ? <p role="alert" className="py-10 text-center text-destructive">Impossible de charger l’annuaire. Réessayez plus tard.</p>
            : filteredMembers.length === 0 ? <p className="py-10 text-center text-muted-foreground">{search ? 'Aucun membre ne correspond à cette recherche.' : 'Aucun membre à afficher.'}</p>
              : <div className="divide-y divide-border/60">{filteredMembers.map((member) => (
                <article key={member.member_id} className="flex flex-wrap items-center gap-3 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 font-black text-primary">{member.photo_url ? <img src={member.photo_url} alt="" className="h-full w-full object-cover" /> : member.nom?.trim().charAt(0)?.toLocaleUpperCase() || '?'}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{[member.prenom, member.nom, member.postnom].filter(Boolean).join(' ') || member.nom_affichage || 'Sans nom'}</p><p className="truncate text-sm text-muted-foreground">{member.email || 'E-mail non renseigné'}{member.telephone ? ` · ${member.telephone}` : ''}</p><p className="text-xs text-muted-foreground">{member.numero_membre} · {member.is_active ? 'Actif' : 'Archivé'}{member.profile_id ? ' · compte connecté' : ' · sans compte connecté'}</p></div>
                  {canManageMembers && <><Button size="sm" variant="outline" onClick={() => editMember(member)}><Pencil className="mr-1 h-4 w-4" />Modifier</Button>
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: member.member_id, active: !member.is_active })}>{member.is_active ? <Archive className="mr-1 h-4 w-4" /> : <RotateCcw className="mr-1 h-4 w-4" />}{member.is_active ? 'Archiver' : 'Réactiver'}</Button></>}
                </article>
              ))}</div>}
      </section>
    </div>
  );
}
