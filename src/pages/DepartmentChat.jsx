import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarClock, CalendarDays, Check, Clock3, Link2, MapPin, MessageCircle,
  Network, Plus, Send, Users, Video, X,
} from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

function localDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMMM yyyy · HH:mm', { locale: fr });
}

function safeMeetingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export default function DepartmentChat() {
  const queryClient = useQueryClient();
  const [activeDepartmentId, setActiveDepartmentId] = useState('');
  const [draft, setDraft] = useState('');
  const [meetingFormOpen, setMeetingFormOpen] = useState(false);
  const [meetingDraft, setMeetingDraft] = useState({ title: '', description: '', starts_at: '', location_or_link: '' });
  const messagesEndRef = useRef(null);
  const { data: departments = [], isLoading: departmentsLoading, isError: departmentsError } = useQuery({
    queryKey: ['department-chat-list'],
    queryFn: () => appClient.departmentChat.list(),
    refetchInterval: 20_000,
  });
  const activeDepartment = departments.find((department) => department.id === activeDepartmentId) || departments[0];
  const activeId = activeDepartment?.id || '';
  const { data: room, isLoading: roomLoading, isError: roomError } = useQuery({
    queryKey: ['department-chat-room', activeId],
    queryFn: () => appClient.departmentChat.room(activeId),
    enabled: Boolean(activeId),
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (departments.length && !departments.some((department) => department.id === activeDepartmentId)) {
      setActiveDepartmentId(departments[0].id);
    }
  }, [departments, activeDepartmentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [room?.messages?.at(-1)?.id, activeId]);

  const sendMutation = useMutation({
    mutationFn: (content) => appClient.departmentChat.sendMessage(activeId, { content }),
    onSuccess: async () => {
      setDraft('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['department-chat-room', activeId] }),
        queryClient.invalidateQueries({ queryKey: ['department-chat-list'] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’envoyer le message.'),
  });
  const meetingMutation = useMutation({
    mutationFn: () => appClient.departmentChat.createMeeting(activeId, {
      ...meetingDraft,
      starts_at: new Date(meetingDraft.starts_at).toISOString(),
    }),
    onSuccess: async () => {
      setMeetingDraft({ title: '', description: '', starts_at: '', location_or_link: '' });
      setMeetingFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['department-chat-room', activeId] });
      toast.success('Réunion ajoutée au salon du département.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de planifier la réunion.'),
  });

  const nextMeetings = useMemo(() => (room?.meetings || []).filter((meeting) => new Date(meeting.starts_at) >= new Date()), [room?.meetings]);
  const submitMessage = (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (content && !sendMutation.isPending) sendMutation.mutate(content);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 pb-8 md:p-8">
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-white/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-primary p-6 text-white shadow-elev-3 sm:p-8">
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sky-200"><MessageCircle className="h-5 w-5" /></span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-200">La vie des départements</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Les salons de discussion</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">Échangez avec votre équipe, partagez les informations utiles et organisez vos prochaines réunions au même endroit.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white/85 backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />Messages actualisés automatiquement</div>
        </div>
      </header>

      {departmentsError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Impossible de charger vos salons. Réessayez dans un instant.</div>
      ) : departmentsLoading ? (
        <div className="glass-panel rounded-3xl p-8 text-center text-muted-foreground">Chargement de vos départements…</div>
      ) : departments.length === 0 ? (
        <section className="glass-panel rounded-3xl p-8 text-center sm:p-12">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Network className="h-6 w-6" /></span>
          <h2 className="text-xl font-black">Aucun salon disponible</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Les salons apparaissent ici quand votre compte est affecté à un département. Contactez un responsable si vous pensez qu’il manque un accès.</p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="glass-panel h-fit rounded-3xl p-3 lg:sticky lg:top-20">
            <div className="flex items-center justify-between px-3 pb-3 pt-2">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Mes espaces</p><p className="mt-1 text-sm font-bold">{departments.length} département{departments.length > 1 ? 's' : ''}</p></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-4 w-4" /></span>
            </div>
            <div className="flex max-h-52 gap-2 overflow-x-auto pb-1 lg:max-h-[65vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
              {departments.map((department) => {
                const selected = (activeDepartment?.id || activeDepartmentId) === department.id;
                return <button key={department.id} type="button" onClick={() => setActiveDepartmentId(department.id)} className={`min-w-56 flex-1 rounded-2xl border p-3 text-left transition lg:min-w-0 ${selected ? 'border-primary/25 bg-primary/10 shadow-sm' : 'border-transparent bg-background/50 hover:border-border hover:bg-background'}`}>
                  <span className="flex items-start justify-between gap-2"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-primary text-white' : 'bg-card text-primary shadow-sm'}`}><Network className="h-4 w-4" /></span><span className="mt-1 text-[10px] font-semibold text-muted-foreground">{department.member_count} membres</span></span>
                  <span className="mt-3 block truncate text-sm font-extrabold text-foreground">{department.nom}</span>
                  <span className="mt-1 line-clamp-2 block min-h-8 text-xs leading-relaxed text-muted-foreground">{department.dernier_message ? `${department.dernier_message_auteur || 'Membre'} : ${department.dernier_message}` : department.description || 'Démarrez la conversation'}</span>
                  {department.dernier_message_at && <span className="mt-2 block text-[10px] text-muted-foreground">{localDateTime(department.dernier_message_at)}</span>}
                </button>;
              })}
            </div>
          </aside>

          <section className="glass-panel flex min-h-[70vh] min-w-0 flex-col overflow-hidden rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Network className="h-5 w-5" /></span>
                <div className="min-w-0"><h2 className="truncate text-lg font-black">{room?.department?.nom || activeDepartment?.nom}</h2><p className="text-xs text-muted-foreground">Salon privé du département · {activeDepartment?.member_count} membres affectés</p></div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setMeetingFormOpen((open) => !open)} className="gap-2 rounded-full border-primary/20 bg-primary/5 font-bold text-primary hover:bg-primary/10"><Plus className="h-4 w-4" />Planifier une réunion</Button>
            </div>

            {meetingFormOpen && <form className="grid gap-3 border-b border-border/60 bg-primary/[0.03] p-4 sm:grid-cols-2 sm:px-6" onSubmit={(event) => { event.preventDefault(); meetingMutation.mutate(); }}>
              <div className="space-y-1"><Label htmlFor="meeting-title">Titre de la réunion</Label><Input id="meeting-title" required maxLength={160} value={meetingDraft.title} onChange={(event) => setMeetingDraft({ ...meetingDraft, title: event.target.value })} placeholder="Ex. Réunion de préparation" /></div>
              <div className="space-y-1"><Label htmlFor="meeting-date">Date et heure</Label><Input id="meeting-date" type="datetime-local" required min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} value={meetingDraft.starts_at} onChange={(event) => setMeetingDraft({ ...meetingDraft, starts_at: event.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="meeting-location">Lieu ou lien de visioconférence</Label><Input id="meeting-location" maxLength={500} value={meetingDraft.location_or_link} onChange={(event) => setMeetingDraft({ ...meetingDraft, location_or_link: event.target.value })} placeholder="Salle, adresse ou lien sécurisé" /></div>
              <div className="space-y-1"><Label htmlFor="meeting-description">Détails (facultatif)</Label><Input id="meeting-description" maxLength={2000} value={meetingDraft.description} onChange={(event) => setMeetingDraft({ ...meetingDraft, description: event.target.value })} placeholder="Ordre du jour, préparation…" /></div>
              <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={meetingMutation.isPending} className="gap-2 rounded-xl"><CalendarClock className="h-4 w-4" />{meetingMutation.isPending ? 'Enregistrement…' : 'Publier la réunion'}</Button><Button type="button" variant="ghost" onClick={() => setMeetingFormOpen(false)}><X className="mr-1 h-4 w-4" />Annuler</Button></div>
            </form>}

            {nextMeetings.length > 0 && <div className="border-b border-border/60 bg-amber-500/[0.04] px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300"><CalendarDays className="h-4 w-4" />Prochaines réunions</div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {nextMeetings.map((meeting) => {
                  const url = safeMeetingUrl(meeting.location_or_link || '');
                  return <article key={meeting.id} className="min-w-64 max-w-sm flex-1 rounded-2xl border border-amber-500/15 bg-card/80 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-extrabold">{meeting.titre}</h3><p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><Clock3 className="h-3.5 w-3.5" />{localDateTime(meeting.starts_at)}</p></div><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Video className="h-4 w-4" /></span></div>
                    {meeting.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{meeting.description}</p>}
                    {meeting.location_or_link && (url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Link2 className="h-3.5 w-3.5" />Rejoindre la réunion</a> : <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{meeting.location_or_link}</p>)}
                    <p className="mt-2 text-[10px] text-muted-foreground">Organisée par {meeting.organizer_name}</p>
                  </article>;
                })}
              </div>
            </div>}

            <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-background/40 to-primary/[0.025] px-4 py-5 sm:px-6">
              {roomLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Ouverture du salon…</p>
                : roomError ? <p role="alert" className="py-12 text-center text-sm text-destructive">Le salon n’a pas pu être chargé. Vérifiez que la migration du chat a été appliquée.</p>
                  : !room?.messages?.length ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></span><p className="font-bold">La conversation commence ici</p><p className="mt-1 text-xs text-muted-foreground">Envoyez le premier message à votre département.</p></div>
                    : room.messages.map((message) => {
                      const mine = message.author_id === room.current_user_id;
                      return <article key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border/60 bg-card'}`}>
                          {!mine && <p className="mb-1 text-[11px] font-extrabold text-primary">{message.author_name}</p>}
                          <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${mine ? 'text-primary-foreground' : 'text-foreground'}`}>{message.contenu}</p>
                          <p className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-primary-foreground/65' : 'text-muted-foreground'}`}>{localDateTime(message.created_at)} {mine && <Check className="h-3 w-3" />}</p>
                        </div>
                      </article>;
                    })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={submitMessage} className="border-t border-border/60 bg-card/75 p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background p-2 shadow-inner focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(event); } }} rows={1} maxLength={4000} placeholder={`Écrire dans ${activeDepartment?.nom}…`} aria-label="Votre message" className="max-h-36 min-h-10 resize-y border-0 bg-transparent py-2 shadow-none focus-visible:ring-0" />
                <Button type="submit" size="icon" aria-label="Envoyer le message" disabled={!draft.trim() || sendMutation.isPending} className="h-10 w-10 shrink-0 rounded-xl"><Send className="h-4 w-4" /></Button>
              </div>
              <p className="mt-2 px-1 text-[10px] text-muted-foreground">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</p>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
