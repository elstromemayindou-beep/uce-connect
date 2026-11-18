import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, CirclePlay, Radio, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const initialStream = { title: '', description: '', stream_url: '', starts_at: '', status: 'scheduled' };

function getEmbedUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (['youtu.be', 'www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(host)) {
      const videoId = host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') || url.pathname.match(/\/(?:live|embed|shorts)\/([^/?]+)/)?.[1];
      return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null;
    }
    if (['facebook.com', 'www.facebook.com', 'fb.watch'].includes(host)) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(value)}&show_text=false`;
    }
  } catch {
    return null;
  }
  return null;
}

export default function Live({ adminMode = false }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialStream);
  const [formOpen, setFormOpen] = useState(false);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: streams = [], isLoading, isError } = useQuery({
    queryKey: ['livestreams'],
    queryFn: () => appClient.livestreams.list(),
  });
  const canManage = Boolean(adminMode && user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role)));
  const createStream = useMutation({
    mutationFn: /** @param {{ title: string, description: string, stream_url: string, starts_at: string | null, status: string }} data */ (data) => appClient.livestreams.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestreams'] });
      setForm(initialStream);
      setFormOpen(false);
      toast.success('Le direct a été publié.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de publier ce direct.'),
  });
  const updateStream = useMutation({
    mutationFn: /** @param {{ id: string, data: Record<string, unknown> }} variables */ ({ id, data }) => appClient.livestreams.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['livestreams'] }),
    onError: (error) => toast.error(error.message || 'Impossible de modifier ce direct.'),
  });
  const deleteStream = useMutation({
    mutationFn: /** @param {string} id */ (id) => appClient.livestreams.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestreams'] });
      toast.success('Le direct a été supprimé.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de supprimer ce direct.'),
  });

  if (adminMode && !canManage) {
    return <div className="p-8 text-center text-destructive">La gestion des directs est réservée au pasteur et à l’administration.</div>;
  }

  const submit = (event) => {
    event.preventDefault();
    createStream.mutate({
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="relative isolate overflow-hidden px-6 py-12 text-white md:px-12">
        <img src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&q=80" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-red-950/80 to-primary/70" />
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
          <Radio className="h-4 w-4" />UCE en direct
        </p>
        <h1 className="text-4xl font-black text-white md:text-5xl">Suivre les cultes</h1>
        <p className="mt-2 max-w-xl text-white/70">Retrouvez les cultes diffusés et les prochaines retransmissions directement dans l’application.</p>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        {canManage && (
          <section className="glass-panel rounded-3xl p-5">
            {!formOpen ? (
              <Button onClick={() => setFormOpen(true)} className="rounded-2xl">Programmer ou lancer un direct</Button>
            ) : (
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stream-title">Titre</Label>
                  <Input id="stream-title" value={form.title} maxLength={160} required onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stream-url">Lien YouTube ou Facebook Live</Label>
                  <Input id="stream-url" type="url" value={form.stream_url} required placeholder="https://youtube.com/live/…" onChange={(event) => setForm({ ...form, stream_url: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stream-date">Date et heure</Label>
                  <Input id="stream-date" type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stream-status">État</Label>
                  <select id="stream-status" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option value="scheduled">À venir</option>
                    <option value="live">En direct</option>
                    <option value="ended">Terminé</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="stream-description">Description</Label>
                  <Textarea id="stream-description" value={form.description} maxLength={2000} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <Button type="submit" disabled={createStream.isPending}>Publier le direct</Button>
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
                </div>
              </form>
            )}
          </section>
        )}

        {isLoading ? <p className="py-12 text-center text-muted-foreground">Chargement des directs…</p>
          : isError ? <p role="alert" className="rounded-2xl border border-destructive/30 p-4 text-destructive">Impossible de charger les directs.</p>
            : streams.length === 0 ? (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <CirclePlay className="mx-auto mb-3 h-12 w-12 text-primary/50" />
                <h2 className="text-xl font-black">Aucun direct programmé</h2>
                <p className="mt-2 text-sm text-muted-foreground">Les retransmissions de l’église apparaîtront ici.</p>
              </div>
            ) : streams.map((stream) => {
              const embedUrl = getEmbedUrl(stream.stream_url);
              const isLive = stream.status === 'live';
              return (
                <article key={stream.id} className="glass-panel overflow-hidden rounded-3xl">
                  {embedUrl ? (
                    <div className="aspect-video bg-black">
                      <iframe
                        src={embedUrl}
                        title={stream.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  ) : (
                    <a href={stream.stream_url} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center bg-slate-950 text-white">
                      <span className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-bold"><CirclePlay className="h-5 w-5" />Ouvrir la diffusion</span>
                    </a>
                  )}
                  <div className="flex flex-wrap items-center gap-3 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">{stream.title}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isLive ? 'bg-red-500/10 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                          {isLive ? 'EN DIRECT' : stream.status === 'scheduled' ? 'À VENIR' : 'TERMINÉ'}
                        </span>
                      </div>
                      {stream.description && <p className="text-sm text-muted-foreground">{stream.description}</p>}
                      {stream.starts_at && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />{new Date(stream.starts_at).toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        {stream.status !== 'live' && <Button size="sm" onClick={() => updateStream.mutate({ id: stream.id, data: { status: 'live' } })}>Lancer</Button>}
                        {stream.status === 'live' && <Button size="sm" variant="outline" onClick={() => updateStream.mutate({ id: stream.id, data: { status: 'ended' } })}>Terminer</Button>}
                        <Button size="icon" variant="ghost" aria-label="Supprimer le direct" onClick={() => {
                          if (window.confirm('Supprimer ce direct ?')) deleteStream.mutate(stream.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
      </main>
    </div>
  );
}
