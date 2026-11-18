import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bell, CalendarClock, CalendarDays, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { canManageNotifications } from '@/lib/navigation';

const categoryLabels = {
  general: 'Annonce générale',
  prayer: 'Prière',
  service: 'Culte et programme',
  fundraiser: 'Cagnotte / collecte',
  event: 'Événement',
  department: 'Département',
  commission: 'Commission',
};

const dispatchLabels = {
  pending: 'Programmée',
  processing: 'En cours',
  sent: 'Traitée',
  failed: 'Échec de livraison',
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({
    category: 'general',
    title: '',
    message: '',
    target: 'church',
    url: '',
    scheduled_at: '',
  });
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const canBroadcast = canManageNotifications(user);
  const { data: organization = [] } = useQuery({
    queryKey: ['notification-organization'],
    queryFn: () => appClient.organization.tree(),
    enabled: canBroadcast,
  });
  const { data: pushConfig, isLoading: isLoadingPushConfig, isError: isPushConfigError } = useQuery({
    queryKey: ['push-config'],
    queryFn: () => appClient.push.config(),
    enabled: canBroadcast,
  });
  const { data: notifications = [], isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => appClient.notifications.list(),
    enabled: canBroadcast,
    refetchInterval: 30_000,
  });
  const targets = useMemo(() => organization.flatMap((department) => [
    { type: 'department', id: department.id, label: `Département · ${department.nom}` },
    ...(department.commissions || []).map((commission) => ({
      type: 'commission',
      id: commission.id,
      label: `Commission · ${commission.nom}`,
    })),
  ]), [organization]);
  const send = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: (data) => appClient.notifications.create(data),
    onSuccess: (notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setDraft({ category: 'general', title: '', message: '', target: 'church', url: '', scheduled_at: '' });
      setFormOpen(false);
      if (notification.dispatch_status === 'pending') {
        toast.success(`Alerte programmée pour ${notification.recipient_count} membre(s).`);
      } else if (notification.failure_count > 0) {
        toast.error(`Livraison partielle : ${notification.delivery_count} appareil(s) notifié(s), ${notification.failure_count} échec(s).`);
      } else if (notification.delivery_count === 0) {
        toast.warning('Aucun appareil n’est abonné aux alertes pour le moment.');
      } else {
        toast.success(`Alerte envoyée sur ${notification.delivery_count} appareil(s).`);
      }
    },
    onError: (error) => toast.error(error.message || 'Impossible de diffuser cette alerte.'),
  });

  if (user && !canBroadcast) return <Navigate to="/profile" replace />;
  if (!canBroadcast) return <p className="p-8 text-center text-muted-foreground">Chargement de vos autorisations…</p>;

  const targetOptions = [
    { type: 'church', id: null, label: 'Toute l’église' },
    ...targets,
  ];
  const submit = (event) => {
    event.preventDefault();
    const target = targetOptions.find((option) => (
      option.type === 'church' ? draft.target === 'church' : draft.target === `${option.type}:${option.id}`
    ));
    if (!target) {
      toast.error('Choisissez une audience valide.');
      return;
    }
    send.mutate({
      category: draft.category,
      title: draft.title,
      message: draft.message,
      target_type: target.type,
      target_id: target.id,
      url: draft.url,
      scheduled_at: draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : null,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-slate-950 via-primary to-indigo-950 px-6 py-10 text-white md:px-12">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70"><Bell className="h-4 w-4" />Département Communication</p>
        <h1 className="text-4xl font-black">Alertes téléphone</h1>
        <p className="mt-2 max-w-2xl text-white/70">Les membres reçoivent les annonces dans les notifications de leur téléphone, pas dans une boîte de réception de l’application.</p>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
        <Link
          to="/admin/content?tab=events"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary/40 hover:bg-primary/5"
        >
          <CalendarDays className="h-4 w-4" />Gérer les événements
        </Link>
        {isPushConfigError ? (
          <p role="alert" className="rounded-2xl border border-destructive/30 p-4 text-sm text-destructive">Impossible de vérifier le service d’alertes.</p>
        ) : !isLoadingPushConfig && !pushConfig?.enabled ? (
          <p role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Configurez les clés VAPID côté serveur pour activer la diffusion des alertes téléphone.</p>
        ) : null}
        <section className="glass-panel rounded-3xl p-5">
          {!formOpen ? (
            <Button onClick={() => setFormOpen(true)} disabled={isLoadingPushConfig || !pushConfig?.enabled}><Megaphone className="h-4 w-4" />Préparer une alerte</Button>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <h2 className="text-xl font-black">Nouvelle alerte téléphone</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notification-category">Type d’annonce</Label>
                  <select id="notification-category" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                    {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notification-target">Destinataires</Label>
                  <select id="notification-target" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })}>
                    {targetOptions.map((target) => <option key={`${target.type}:${target.id || 'church'}`} value={target.type === 'church' ? 'church' : `${target.type}:${target.id}`}>{target.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2"><Label htmlFor="notification-title">Titre</Label><Input id="notification-title" required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="notification-message">Message (maximum 240 caractères)</Label><Textarea id="notification-message" required maxLength={240} rows={3} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="notification-url">Lien (facultatif)</Label><Input id="notification-url" placeholder="/events" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="notification-date">Diffusion (facultative)</Label><Input id="notification-date" type="datetime-local" value={draft.scheduled_at} onChange={(event) => setDraft({ ...draft, scheduled_at: event.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Seuls les appareils ayant autorisé les alertes pourront les recevoir. Le serveur doit être en ligne à l’heure programmée.</p>
              <div className="flex gap-2">
                <Button type="submit" disabled={send.isPending || !pushConfig?.enabled}>Diffuser l’alerte</Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-lg font-black">Suivi des diffusions</h2>
          {isLoading ? <p className="py-8 text-center text-muted-foreground">Chargement…</p>
            : isError ? <p role="alert" className="rounded-2xl border border-destructive/30 p-4 text-destructive">Impossible de charger le suivi des alertes.</p>
              : notifications.length === 0 ? <p className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Aucune alerte diffusée.</p>
                : notifications.map((notification) => (
                  <article key={notification.id} className="glass-panel rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold">{notification.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{notification.message}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{new Date(notification.scheduled_at).toLocaleString('fr-FR')}</p>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{dispatchLabels[notification.dispatch_status] || notification.dispatch_status}</span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {notification.delivery_count} appareil(s) notifié(s) sur {notification.recipient_count} membre(s)
                      {notification.failure_count > 0 ? ` · ${notification.failure_count} échec(s)` : ''}
                    </p>
                  </article>
                ))}
        </section>
      </main>
    </div>
  );
}
