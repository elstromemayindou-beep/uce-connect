import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ClipboardCheck, Send } from 'lucide-react';

export default function RoleRequests() {
  const client = useQueryClient();
  const [draft, setDraft] = useState({ profile_id: '', role_id: '', department_id: '', commission_id: '', reason: '' });
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const isAdmin = Boolean(user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role)));
  const { data: requests = [], isLoading } = useQuery({ queryKey: ['role-requests'], queryFn: () => appClient.organization.roleRequests(), enabled: isAdmin || user?.roles?.includes('PASTEUR_PRINCIPAL') });
  const { data: options } = useQuery({ queryKey: ['role-request-options'], queryFn: () => appClient.organization.roleRequestOptions(), enabled: !isAdmin && user?.roles?.includes('PASTEUR_PRINCIPAL') });
  const selectedRole = options?.roles?.find((role) => role.id === draft.role_id);
  const commissions = useMemo(() => options?.commissions?.filter((item) => item.departement_id === draft.department_id) || [], [options, draft.department_id]);
  const create = useMutation({
    mutationFn: () => appClient.organization.createRoleRequest(draft),
    onSuccess: async () => { setDraft({ profile_id: '', role_id: '', department_id: '', commission_id: '', reason: '' }); await client.invalidateQueries({ queryKey: ['role-requests'] }); toast.success('Demande envoyée à l’administration générale.'); },
    onError: (error) => toast.error(error.message || 'La demande n’a pas pu être envoyée.'),
  });
  const decide = useMutation({
    mutationFn: ({ id, action, reason = '' }) => appClient.organization.decideRoleRequest(id, { action, decision_reason: reason }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['role-requests'] }); await client.invalidateQueries({ queryKey: ['organization-admin'] }); toast.success('Demande traitée.'); },
    onError: (error) => toast.error(error.message || 'Impossible de traiter la demande.'),
  });
  if (!isAdmin && !user?.roles?.includes('PASTEUR_PRINCIPAL')) return <div className="p-8 text-center">Accès réservé.</div>;
  return <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
    <Link to="/admin" className="text-sm font-bold text-primary">← Retour à l’administration</Link>
    <header className="glass-panel rounded-3xl p-6"><ClipboardCheck className="mb-3 h-9 w-9 text-primary"/><p className="text-xs font-bold uppercase tracking-widest text-primary">Organisation de l’église</p><h1 className="text-3xl font-black">{isAdmin ? 'Demandes de responsables' : 'Proposer un responsable'}</h1><p className="mt-2 text-muted-foreground">{isAdmin ? 'Examinez les propositions du pasteur. L’affectation est créée après votre validation.' : 'Votre proposition sera transmise à l’administration générale. Aucun rôle ne sera attribué avant sa validation.'}</p></header>
    {!isAdmin && <form className="glass-panel grid gap-4 rounded-3xl p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="space-y-2"><Label>Membre proposé</Label><select required value={draft.profile_id} onChange={(e) => setDraft({ ...draft, profile_id: e.target.value })} className="h-11 w-full rounded-xl border bg-background px-3"><option value="">Choisir un membre</option>{options?.members?.map((person) => <option key={person.profile_id} value={person.profile_id}>{person.full_name}</option>)}</select></div>
      <div className="space-y-2"><Label>Responsabilité</Label><select required value={draft.role_id} onChange={(e) => setDraft({ ...draft, role_id: e.target.value, commission_id: '' })} className="h-11 w-full rounded-xl border bg-background px-3"><option value="">Choisir un rôle</option>{options?.roles?.map((role) => <option key={role.id} value={role.id}>{role.nom}</option>)}</select></div>
      {selectedRole?.niveau_portee !== 'eglise' && <div className="space-y-2"><Label>Département</Label><select required value={draft.department_id} onChange={(e) => setDraft({ ...draft, department_id: e.target.value, commission_id: '' })} className="h-11 w-full rounded-xl border bg-background px-3"><option value="">Choisir un département</option>{options?.departments?.map((department) => <option key={department.id} value={department.id}>{department.nom}</option>)}</select></div>}
      {selectedRole?.niveau_portee === 'commission' && <div className="space-y-2"><Label>Commission</Label><select required value={draft.commission_id} onChange={(e) => setDraft({ ...draft, commission_id: e.target.value })} className="h-11 w-full rounded-xl border bg-background px-3"><option value="">Choisir une commission</option>{commissions.map((commission) => <option key={commission.id} value={commission.id}>{commission.nom}</option>)}</select></div>}
      <div className="space-y-2 md:col-span-2"><Label>Motif et informations utiles</Label><Textarea required minLength={5} maxLength={1000} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="Expliquez pourquoi cette personne est proposée…" /></div>
      <Button type="submit" disabled={create.isPending || !selectedRole}><Send className="mr-2 h-4 w-4"/>Envoyer à l’administration</Button>
    </form>}
    <section className="glass-panel space-y-3 rounded-3xl p-5"><h2 className="text-xl font-black">{isAdmin ? 'À examiner et historique' : 'Mes demandes'}</h2>{isLoading ? <p>Chargement…</p> : requests.length === 0 ? <p className="py-6 text-center text-muted-foreground">Aucune demande pour le moment.</p> : requests.map((item) => <article key={item.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-border/70 bg-background/70 p-4"><div className="min-w-0 flex-1"><p className="font-bold">{item.target_name} · {item.role_name}</p><p className="text-sm text-muted-foreground">{[item.department_name, item.commission_name].filter(Boolean).join(' / ') || 'Église entière'} · {item.reason}</p><p className="mt-2 text-xs font-bold uppercase tracking-wide">{item.status === 'pending' ? 'En attente' : item.status === 'approved' ? 'Approuvée' : 'Refusée'}{item.decision_reason ? ` · ${item.decision_reason}` : ''}</p></div>{isAdmin && item.status === 'pending' && <div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate({ id: item.id, action: 'approve' })}>Valider</Button><Button size="sm" variant="outline" onClick={() => { const reason = window.prompt('Motif du refus'); if (reason?.trim()) decide.mutate({ id: item.id, action: 'reject', reason: reason.trim() }); }}>Refuser</Button></div>}</article>)}</section>
  </main>;
}
