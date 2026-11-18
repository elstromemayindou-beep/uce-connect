import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin, Users, Clock, Search, CheckCircle, Radio, ArrowRight, LayoutGrid, CalendarDays, Bell, ClipboardCheck, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/components/ui/AnimatedPage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import EventCalendarView from '@/components/events/EventCalendarView';
import { eventStartTime, isUpcomingEvent } from '@/lib/contentDates';

const typeLabels = {
  service: 'Culte', conference: 'Conférence', camp: 'Camp',
  retreat: 'Retraite', youth: 'Jeunesse', prayer: 'Prière', other: 'Autre'
};
const typeColors = {
  service: 'bg-blue-500/15 text-blue-600',
  conference: 'bg-purple-500/15 text-purple-600',
  camp: 'bg-green-500/15 text-green-600',
  youth: 'bg-amber-500/15 text-amber-600',
  prayer: 'bg-red-500/15 text-red-500',
  retreat: 'bg-teal-500/15 text-teal-600',
  other: 'bg-slate-500/15 text-slate-600',
};
const attendanceStatuses = /** @type {const} */ (['present', 'absent']);
const eventImages = [
  'https://images.unsplash.com/photo-1438232992991-995b671a1b65?w=800&q=70',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=70',
  'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=70',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=70',
];

export default function Events() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [eventRange, setEventRange] = useState('upcoming');
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const canManageEvents = Boolean(user?.roles?.some((role) => [
    'SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'RESP_DEPARTEMENT',
    'SECRETAIRE_DEPARTEMENT', 'RESP_COMMISSION', 'SECRETAIRE_COMMISSION', 'SECRETAIRE_GENERAL',
  ].includes(role)));
  const canManageSelectedEvent = Boolean(selected && (
    user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'SECRETAIRE_GENERAL'].includes(role))
    || user?.role_assignments?.some((assignment) => {
      if (!['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT', 'RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code)) return false;
      const normalize = (value) => typeof value === 'string'
        ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase()
        : '';
      return [assignment.department?.code, assignment.department?.name, assignment.commission?.code, assignment.commission?.name]
        .some((value) => normalize(value) === normalize(selected.department));
    })
  ));
  const { data: events = [], isLoading, isError: eventsError } = useQuery({
    queryKey: ['events'],
    queryFn: () => appClient.entities.Event.list('date', 500),
    refetchInterval: 60_000,
  });
  const { data: registrations = [], isError: registrationsError } = useQuery({
    queryKey: ['event-registrations', selected?.id],
    queryFn: () => appClient.events.registrations(selected.id),
    enabled: Boolean(selected?.id && canManageSelectedEvent),
  });

  const joinMutation = useMutation({
    /** @param {{ id: string }} event */
    mutationFn: (event) => appClient.events.register(event.id),
    onSuccess: (result, event) => {
      setSelected((current) => current?.id === event.id
        ? {
          ...current,
          is_registered: true,
          attendee_count: (current.attendee_count || 0) + 1,
          reminder_scheduled: Boolean(result.reminder_scheduled),
        }
        : current);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(result.reminder_scheduled
        ? 'Inscription confirmée. Un rappel sera envoyé avant l’événement.'
        : 'Inscription confirmée !');
    },
    onError: (error) => toast.error(error.message || 'Impossible de réserver cette place.'),
  });

  const leaveMutation = useMutation({
    /** @param {{ id: string }} event */
    mutationFn: (event) => appClient.events.unregister(event.id),
    onSuccess: (_, event) => {
      setSelected((current) => current?.id === event.id
        ? { ...current, is_registered: false, attendee_count: Math.max(0, (current.attendee_count || 1) - 1), reminder_scheduled: false }
        : current);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Inscription annulée.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’annuler cette inscription.'),
  });
  const attendanceMutation = useMutation({
    /** @param {{ eventId: string, profileId: string, status: 'present' | 'absent' }} variables */
    mutationFn: ({ eventId, profileId, status }) => appClient.events.setAttendance(eventId, profileId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-registrations', selected?.id] }),
    onError: (error) => toast.error(error.message || 'Impossible de mettre à jour la présence.'),
  });

  const isJoined = (event) => Boolean(event.is_registered);
  const datedEvents = events.filter((event) => eventStartTime(event) !== null);
  const periodEvents = datedEvents.filter((event) => isUpcomingEvent(event) === (eventRange === 'upcoming'));
  const filtered = periodEvents.filter((event) => event.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      {/* Hero avec image de fond */}
      <div className="relative z-10 min-h-[24rem] overflow-hidden text-white">
        <img
          src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80"
          alt="Événement"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative flex h-full items-end justify-between gap-4 px-6 py-12 md:px-12 md:py-16">
          <div className="mb-8">
            <p className="text-amber-400 font-bold tracking-widest text-xs uppercase mb-2 shadow-md">Calendrier</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight leading-none text-white shadow-lg shadow-black/40">Événements</h1>
            <p className="text-white/90 mt-3 text-lg leading-relaxed shadow-md shadow-black/30">Services, conférences, camps et plus</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-card/75 p-1.5 shadow-elev-1 backdrop-blur-sm">
          <button type="button" aria-pressed={eventRange === 'upcoming'} onClick={() => setEventRange('upcoming')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${eventRange === 'upcoming' ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'}`}>
            <CalendarDays className="h-4 w-4" /> À venir <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{datedEvents.filter((event) => isUpcomingEvent(event)).length}</span>
          </button>
          <button type="button" aria-pressed={eventRange === 'archive'} onClick={() => setEventRange('archive')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${eventRange === 'archive' ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'}`}>
            <Archive className="h-4 w-4" /> Archives <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{datedEvents.filter((event) => !isUpcomingEvent(event)).length}</span>
          </button>
        </div>
        {/* Search + View toggle */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un événement..."
              className="pl-11 h-12 rounded-2xl bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex bg-card border border-border/60 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
        </div>

        {eventsError ? (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center text-sm text-destructive">Impossible de charger les événements. Vérifiez votre connexion puis réessayez.</p>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-3xl overflow-hidden bg-card animate-pulse">
                <div className="h-52 bg-muted" />
                <div className="p-5 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-5 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">{search ? 'Aucun événement ne correspond à cette recherche' : eventRange === 'upcoming' ? 'Aucun événement à venir' : 'Aucun événement archivé'}</p>
          </div>
        ) : viewMode === 'calendar' ? (
          <EventCalendarView events={filtered} onSelectEvent={setSelected} />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
            {filtered.map((event, idx) => (
              <motion.div
                key={event.id}
                variants={staggerItem}
                whileHover={{ y: -5 }}
                className="glass-card rounded-3xl overflow-hidden cursor-pointer group transition-all duration-300 hover:border-primary/40 hover:shadow-elev-4"
                onClick={() => setSelected(event)}
              >
                <div className="relative h-56 bg-primary/5 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={event.image_url || eventImages[idx % eventImages.length]}
                    alt={event.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    onError={(e) => { e.currentTarget.src = eventImages[idx % eventImages.length]; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-70" />
                  {event.date && (
                    <div className="absolute top-4 left-4 bg-accent text-accent-foreground rounded-2xl px-3 py-2 text-center shadow-elev-2">
                      <div className="text-xs font-black uppercase leading-none">{format(new Date(event.date), 'MMM', { locale: fr })}</div>
                      <div className="text-2xl font-black leading-none">{format(new Date(event.date), 'd')}</div>
                    </div>
                  )}
                  {event.is_live && (
                    <div className="absolute top-4 right-4 bg-red-500 text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 animate-pulse shadow-elev-2">
                      <Radio className="w-3 h-3" /> EN DIRECT
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4">
                    {event.type && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${typeColors[event.type] || 'bg-black/70 text-white'} backdrop-blur-sm`}>
                        {typeLabels[event.type]}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <div className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-xl mb-3 leading-tight text-foreground">{event.title}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {event.time && <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{event.time}</span>}
                    {event.location && <span className="flex items-center gap-2 truncate"><MapPin className="w-4 h-4 flex-shrink-0" />{event.location}</span>}
                    <span className="flex items-center gap-2 ml-auto">
                      <Users className="w-4 h-4" />
                      {event.attendee_count || 0}{event.capacity ? `/${event.capacity}` : ''}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl p-0">
          {selected?.image_url ? (
            <img src={selected.image_url || eventImages[0]} alt={selected.title || 'Affiche de l’événement'} className="block h-auto w-full bg-muted/40" onError={(e) => { e.currentTarget.src = eventImages[0]; }} />
          ) : (
            <div className="w-full h-32 bg-gradient-to-br from-primary/20 to-purple-400/20 flex items-center justify-center">
              <Calendar className="w-12 h-12 text-primary/30" />
            </div>
          )}
          <div className="p-6 space-y-4">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-xl font-black leading-tight">{selected?.title}</DialogTitle>
                {selected?.type && (
                  <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${typeColors[selected.type]}`}>
                    {typeLabels[selected.type]}
                  </span>
                )}
              </div>
            </DialogHeader>
            {selected && (
              <>
                {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                <div className="space-y-2 text-sm bg-muted/40 rounded-2xl p-4">
                  {selected.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="font-medium capitalize">{format(new Date(selected.date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
                    </div>
                  )}
                  {selected.time && <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><span>{selected.time}</span></div>}
                  {selected.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-500" /><span>{selected.location}</span></div>}
                  {selected.organizer && <div className="flex items-center gap-2"><Users className="w-4 h-4 text-amber-500" /><span>{selected.organizer}</span></div>}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{selected.attendee_count || 0} inscrits{selected.capacity ? ` / ${selected.capacity} places` : ''}</span>
                  </div>
                </div>

                {/* Registration button */}
                {!isUpcomingEvent(selected) ? (
                  <p className="rounded-xl border border-border/60 bg-muted/50 p-3 text-center text-sm font-bold text-muted-foreground">Cet événement est terminé et conservé dans les archives.</p>
                ) : isJoined(selected) ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl h-11 font-bold"
                    onClick={() => leaveMutation.mutate(selected)}
                    disabled={leaveMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />Annuler mon inscription
                  </Button>
                ) : (
                  <Button
                    className="w-full rounded-2xl h-11 font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-elev-3 hover:shadow-elev-4 hover:-translate-y-0.5"
                    onClick={() => joinMutation.mutate(selected)}
                    disabled={joinMutation.isPending || (selected.capacity && selected.attendee_count >= selected.capacity)}
                  >
                    {selected.capacity && selected.attendee_count >= selected.capacity ? 'Événement complet' : 'Réserver ma place'}
                  </Button>
                )}

                {canManageSelectedEvent && (
                  <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                    <h3 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-4 w-4 text-primary" />Présences des inscrits</h3>
                    {registrationsError ? (
                      <p role="alert" className="text-sm text-destructive">Impossible de charger les présences de cet événement.</p>
                    ) : registrations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun participant inscrit pour le moment.</p>
                    ) : (
                      <div className="max-h-56 divide-y overflow-y-auto">
                        {registrations.map((registration) => (
                          <div key={registration.profile_id} className="flex items-center justify-between gap-3 py-2">
                            <span className="truncate text-sm font-medium">{registration.full_name}</span>
                            <div className="flex shrink-0 gap-1">
                              {attendanceStatuses.map((status) => (
                                <Button
                                  key={status}
                                  type="button"
                                  size="sm"
                                  variant={registration.status === status ? 'default' : 'outline'}
                                  disabled={attendanceMutation.isPending}
                                  onClick={() => attendanceMutation.mutate({
                                    eventId: selected.id,
                                    profileId: registration.profile_id,
                                    status,
                                  })}
                                >
                                  {status === 'present' ? 'Présent' : 'Absent'}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {selected.is_registered && selected.reminder_scheduled && (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Bell className="h-4 w-4 text-primary" />Un rappel sera envoyé 2h avant l’événement.
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
