import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, BookOpen, Pencil, Plus, Trash2, Video, Mic2, Info, LoaderCircle, Heart } from 'lucide-react';
import { toast } from 'sonner';
import ImageUploadField from '@/components/media/ImageUploadField';
import SermonFileUploadField from '@/components/media/SermonFileUploadField';
import { isCurrentDailyThought } from '@/lib/contentDates';

const blankEvent = { title: '', description: '', image_url: '', type: 'service', date: '', time: '', location: '', department: '', capacity: '' };
const blankSermon = {
  title: '', description: '', category: 'sermon', type: 'preaching', speaker: '',
  date: '', scripture: '', series_name: '', duration_minutes: '',
  thumbnail_url: '', video_url: '', audio_url: '', stream_url: '', pdf_url: '', docx_url: '',
};
const blankThought = { title: '', content: '', author: '', image_url: '' };

function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

export default function ContentManagement() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = ['sermons', 'thoughts'].includes(requestedTab) ? requestedTab : 'events';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [eventDraft, setEventDraft] = useState(blankEvent);
  const [sermonDraft, setSermonDraft] = useState(blankSermon);
  const [thoughtDraft, setThoughtDraft] = useState(blankThought);
  const [editingId, setEditingId] = useState('');
  const [eventImageUploading, setEventImageUploading] = useState(false);
  const [thoughtImageUploading, setThoughtImageUploading] = useState(false);
  const [sermonFileUploads, setSermonFileUploads] = useState(0);
  useEffect(() => {
    if (['events', 'sermons', 'thoughts'].includes(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const roles = user?.roles || [];
  const canManageChurchSermons = roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role));
  const canManageThoughts = roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'SECRETAIRE_GENERAL'].includes(role));
  const canManageAllEvents = roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'SECRETAIRE_GENERAL'].includes(role));
  const scopedEventAssignments = (user?.role_assignments || []).filter((assignment) => (
    ['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT', 'RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code)
    && (assignment.department?.name || assignment.commission?.name)
  ));
  const canManageEvents = canManageAllEvents || scopedEventAssignments.length > 0;
  const canManage = activeTab === 'events' ? canManageEvents : activeTab === 'sermons' ? canManageChurchSermons : canManageThoughts;
  const backPath = roles.includes('SECRETAIRE_GENERAL') && !canManageChurchSermons ? '/events' : '/admin';
  const eventDepartments = [...new Set(scopedEventAssignments.flatMap((assignment) => (
    [assignment.department?.name, assignment.commission?.name].filter(Boolean)
  )))];
  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useQuery({
    queryKey: ['events'],
    queryFn: () => appClient.entities.Event.list('date', 500),
    enabled: canManageEvents,
  });
  const { data: sermons = [], isLoading: sermonsLoading, isError: sermonsError } = useQuery({
    queryKey: ['sermons'],
    queryFn: () => appClient.entities.Sermon.list('-created_date', 200),
    enabled: canManageChurchSermons,
  });
  const { data: thoughts = [], isLoading: thoughtsLoading, isError: thoughtsError } = useQuery({
    queryKey: ['daily-thoughts'],
    queryFn: () => appClient.entities.DailyThought.list('-created_date', 200),
    enabled: canManageThoughts,
  });
  const visibleEvents = canManageAllEvents
    ? events
    : events.filter((item) => eventDepartments.includes(item.department));
  const currentItems = activeTab === 'events' ? visibleEvents : activeTab === 'sermons' ? sermons : thoughts;
  const currentLoading = activeTab === 'events' ? eventsLoading : activeTab === 'sermons' ? sermonsLoading : thoughtsLoading;
  const currentError = activeTab === 'events' ? eventsError : activeTab === 'sermons' ? sermonsError : thoughtsError;
  const managedSermons = useMemo(() => sermons.filter((sermon) => ['affirmation', 'formation'].includes(sermon.category)), [sermons]);
  const activeThoughtId = thoughts.find((thought) => isCurrentDailyThought(thought))?.id;

  const resetForm = () => {
    setEditingId('');
    setEventDraft(blankEvent);
    setSermonDraft(blankSermon);
    setThoughtDraft(blankThought);
    setEventImageUploading(false);
    setThoughtImageUploading(false);
    setSermonFileUploads(0);
  };
  const invalidate = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['events'] }),
    queryClient.invalidateQueries({ queryKey: ['sermons'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-sermons'] }),
    queryClient.invalidateQueries({ queryKey: ['daily-thoughts'] }),
  ]);
  const saveMutation = useMutation({
    mutationFn: () => {
      const data = activeTab === 'events' ? {
        ...eventDraft,
        capacity: eventDraft.capacity === '' ? null : Number(eventDraft.capacity),
      } : activeTab === 'sermons' ? {
        ...sermonDraft,
        duration_minutes: sermonDraft.duration_minutes ? Number(sermonDraft.duration_minutes) : null,
      } : thoughtDraft;
      const entity = activeTab === 'events' ? 'Event' : activeTab === 'sermons' ? 'Sermon' : 'DailyThought';
      return editingId
        ? appClient.entities[entity].update(editingId, data)
        : appClient.entities[entity].create(data);
    },
    onSuccess: async () => {
      await invalidate();
      resetForm();
      toast.success(activeTab === 'events' ? 'Événement enregistré.' : activeTab === 'sermons' ? 'Prédication ou cours enregistré.' : 'Pensée publiée pour 24 heures.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer ce contenu.'),
  });
  const deleteMutation = useMutation({
    mutationFn: /** @param {{ kind: 'Event' | 'Sermon' | 'DailyThought', id: string }} variables */ ({ kind, id }) => appClient.entities[kind].remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Contenu supprimé.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de supprimer ce contenu.'),
  });

  const edit = (item) => {
    setEditingId(item.id);
    if (activeTab === 'events') {
      setEventDraft({
        title: item.title || '', description: item.description || '', image_url: item.image_url || '',
        type: item.type || 'service', date: dateInput(item.date), time: item.time || '', location: item.location || '',
        department: item.department || '', capacity: item.capacity ?? '',
      });
    } else if (activeTab === 'sermons') {
      setSermonDraft({
        title: item.title || '',
        description: item.description || '',
        category: item.category || 'sermon',
        type: item.type || 'preaching',
        speaker: item.speaker || '',
        date: dateInput(item.date),
        scripture: item.scripture || '',
        series_name: item.series_name || '',
        duration_minutes: item.duration_minutes ?? '',
        thumbnail_url: item.thumbnail_url || '',
        video_url: item.video_url || '',
        audio_url: item.audio_url || '',
        stream_url: item.stream_url || '',
        pdf_url: item.pdf_url || '',
        docx_url: item.docx_url || '',
      });
    } else {
      setThoughtDraft({ title: item.title || '', content: item.content || '', author: item.author || '', image_url: item.image_url || '' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!canManage) return <div className="p-8 text-center"><h1 className="text-xl font-black">Accès restreint</h1><p className="mt-2 text-muted-foreground">La gestion de ce type de contenu n’est pas associée à votre compte.</p><Link className="mt-4 inline-block text-primary underline" to="/admin/content?tab=events">Gérer les événements autorisés</Link></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to={backPath} className="text-sm font-bold text-primary">← {backPath === '/events' ? 'Retour aux événements' : 'Retour à l’administration'}</Link>
      <header className="glass-panel rounded-3xl p-6">
        <BookOpen className="mb-3 h-9 w-9 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Espace de gestion</p>
        <h1 className="text-3xl font-black">Contenus de l’église</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gérez les événements, les prédications et les pensées du jour de l’église.</p>
      </header>

      <div className="grid grid-cols-1 gap-2 rounded-2xl bg-muted/50 p-1 sm:grid-cols-3">
        <Button type="button" variant={activeTab === 'events' ? 'default' : 'ghost'} onClick={() => { setActiveTab('events'); resetForm(); }}><CalendarDays className="mr-2 h-4 w-4" />Événements ({events.length})</Button>
        <Button type="button" variant={activeTab === 'sermons' ? 'default' : 'ghost'} disabled={!canManageChurchSermons} onClick={() => { setActiveTab('sermons'); resetForm(); }}><BookOpen className="mr-2 h-4 w-4" />Prédications et cours ({sermons.length})</Button>
        <Button type="button" variant={activeTab === 'thoughts' ? 'default' : 'ghost'} disabled={!canManageThoughts} onClick={() => { setActiveTab('thoughts'); resetForm(); }}><Heart className="mr-2 h-4 w-4" />Pensées du jour ({thoughts.length})</Button>
      </div>

      <section className="glass-panel space-y-4 rounded-3xl p-5">
        <h2 className="text-xl font-black">{editingId ? 'Modifier le contenu' : activeTab === 'events' ? 'Ajouter un événement' : activeTab === 'sermons' ? 'Ajouter une prédication ou un cours' : 'Publier une pensée du jour'}</h2>
        {saveMutation.isError && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Impossible d’enregistrer ce contenu. Vérifiez les champs et réessayez.'}
          </p>
        )}
        {activeTab === 'events' ? (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            if (eventImageUploading) {
              toast.error('Attendez la fin du téléversement de l’image avant de publier.');
              return;
            }
            saveMutation.reset();
            saveMutation.mutate();
          }}>
            <div className="space-y-2"><Label htmlFor="event-title">Titre</Label><Input id="event-title" required maxLength={160} value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="event-kind">Type</Label><select id="event-kind" value={eventDraft.type} onChange={(event) => setEventDraft({ ...eventDraft, type: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="service">Culte</option><option value="conference">Conférence</option><option value="camp">Camp</option><option value="retreat">Retraite</option><option value="youth">Jeunesse</option><option value="prayer">Prière</option><option value="other">Autre</option></select></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="event-caption">Légende descriptive</Label><Textarea id="event-caption" required maxLength={2000} value={eventDraft.description} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} /></div>
            <div className="md:col-span-2"><ImageUploadField id="event-image" label="Affiche de l’événement (facultative)" value={eventDraft.image_url} onChange={(image_url) => setEventDraft({ ...eventDraft, image_url })} onUploadingChange={setEventImageUploading} previewClassName="h-40 w-full object-contain bg-muted/40" /></div>
            <div className="space-y-2"><Label htmlFor="event-date">Date <span className="text-destructive">*</span></Label><Input id="event-date" type="date" required value={eventDraft.date} onChange={(event) => setEventDraft({ ...eventDraft, date: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="event-time">Heure</Label><Input id="event-time" type="time" value={eventDraft.time} onChange={(event) => setEventDraft({ ...eventDraft, time: event.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="event-location">Lieu</Label><Input id="event-location" maxLength={200} value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="event-capacity">Nombre de places (facultatif)</Label><Input id="event-capacity" type="number" min={1} max={100000} step={1} value={eventDraft.capacity} onChange={(event) => setEventDraft({ ...eventDraft, capacity: event.target.value })} /></div>
            {eventDepartments.length > 0 && <div className="space-y-2 md:col-span-2"><Label htmlFor="event-department">Département ou commission responsable</Label><select id="event-department" required={!canManageAllEvents} value={eventDraft.department} onChange={(event) => setEventDraft({ ...eventDraft, department: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{canManageAllEvents && <option value="">Événement général</option>}{eventDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>}
            <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={saveMutation.isPending || eventImageUploading}>{eventImageUploading ? <><span className="mr-2">⏳</span>Téléversement de l’image…</> : <><Plus className="mr-2 h-4 w-4" />{saveMutation.isPending ? 'Publication…' : editingId ? 'Enregistrer' : 'Publier l’événement'}</>}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>}</div>
          </form>
        ) : activeTab === 'sermons' ? (
          <form className="space-y-5" onSubmit={(event) => {
            event.preventDefault();
            if (sermonFileUploads > 0) {
              toast.error('Attendez la fin du téléversement des fichiers avant de publier.');
              return;
            }
            saveMutation.reset();
            saveMutation.mutate();
          }}>
            <section className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mic2 className="h-4 w-4" /></span>
                <div><h3 className="font-bold">1. Présentation</h3><p className="text-sm text-muted-foreground">Les informations qui permettront de reconnaître ce contenu.</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2"><Label htmlFor="sermon-title">Titre <span className="text-destructive">*</span></Label><Input id="sermon-title" required maxLength={160} placeholder="Ex. La foi qui transforme" value={sermonDraft.title} onChange={(event) => setSermonDraft({ ...sermonDraft, title: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sermon-kind">Format</Label><select id="sermon-kind" value={sermonDraft.type} onChange={(event) => setSermonDraft({ ...sermonDraft, type: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="preaching">Prédication</option><option value="course">Cours</option><option value="testimony">Témoignage</option><option value="worship">Louange</option><option value="live">Lien de direct</option></select></div>
                <div className="space-y-2"><Label htmlFor="sermon-category">Catégorie</Label><select id="sermon-category" value={sermonDraft.category} onChange={(event) => setSermonDraft({ ...sermonDraft, category: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="sermon">Prédication générale</option><option value="affirmation">Affermissement</option><option value="formation">Formation des serviteurs</option></select></div>
                <div className="space-y-2"><Label htmlFor="sermon-speaker">Orateur / responsable</Label><Input id="sermon-speaker" maxLength={160} placeholder="Nom de l’orateur" value={sermonDraft.speaker} onChange={(event) => setSermonDraft({ ...sermonDraft, speaker: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sermon-scripture">Référence biblique</Label><Input id="sermon-scripture" maxLength={300} placeholder="Ex. Jean 3:16" value={sermonDraft.scripture} onChange={(event) => setSermonDraft({ ...sermonDraft, scripture: event.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="sermon-description">Description</Label><Textarea id="sermon-description" rows={3} maxLength={2000} placeholder="Présentez brièvement le message ou le cours…" value={sermonDraft.description} onChange={(event) => setSermonDraft({ ...sermonDraft, description: event.target.value })} /></div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Video className="h-4 w-4" /></span>
                <div><h3 className="font-bold">2. Médias et documents</h3><p className="text-sm text-muted-foreground">Ajoutez les supports disponibles. Vous pouvez en proposer plusieurs pour un même contenu.</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-border/60 p-3 md:p-4">
                  <SermonFileUploadField id="sermon-audio-file" label="Fichier audio" kind="audio" value={sermonDraft.audio_url} onChange={(audio_url) => setSermonDraft({ ...sermonDraft, audio_url })} onUploadingChange={(uploading) => setSermonFileUploads((count) => Math.max(0, count + (uploading ? 1 : -1)))} />
                  <div className="space-y-2"><Label htmlFor="sermon-audio">Ou lien audio externe</Label><Input id="sermon-audio" type="url" placeholder="https://…" value={sermonDraft.audio_url.startsWith('http') && !sermonDraft.audio_url.includes('/storage/v1/object/public/') ? sermonDraft.audio_url : ''} onChange={(event) => setSermonDraft({ ...sermonDraft, audio_url: event.target.value })} /></div>
                </div>
                <div className="space-y-4 rounded-xl border border-border/60 p-3 md:p-4">
                  <div className="space-y-2"><Label htmlFor="sermon-video">Lien vidéo</Label><Input id="sermon-video" type="url" placeholder="https://…" value={sermonDraft.video_url} onChange={(event) => setSermonDraft({ ...sermonDraft, video_url: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="sermon-live">Lien de direct</Label><Input id="sermon-live" type="url" placeholder="https://…" value={sermonDraft.stream_url} onChange={(event) => setSermonDraft({ ...sermonDraft, stream_url: event.target.value })} /></div>
                </div>
                <div className="rounded-xl border border-border/60 p-3 md:p-4"><SermonFileUploadField id="sermon-pdf-file" label="Support PDF" kind="pdf" value={sermonDraft.pdf_url} onChange={(pdf_url) => setSermonDraft({ ...sermonDraft, pdf_url })} onUploadingChange={(uploading) => setSermonFileUploads((count) => Math.max(0, count + (uploading ? 1 : -1)))} /></div>
                <div className="rounded-xl border border-border/60 p-3 md:p-4"><SermonFileUploadField id="sermon-docx-file" label="Support Word (DOCX)" kind="docx" value={sermonDraft.docx_url} onChange={(docx_url) => setSermonDraft({ ...sermonDraft, docx_url })} onUploadingChange={(uploading) => setSermonFileUploads((count) => Math.max(0, count + (uploading ? 1 : -1)))} /></div>
                <div className="rounded-xl border border-border/60 p-3 md:col-span-2 md:p-4">
                  <ImageUploadField id="sermon-image" label="Image de couverture (facultative)" value={sermonDraft.thumbnail_url} onChange={(thumbnail_url) => setSermonDraft({ ...sermonDraft, thumbnail_url })} onUploadingChange={(uploading) => setSermonFileUploads((count) => Math.max(0, count + (uploading ? 1 : -1)))} previewClassName="h-40 w-full object-contain bg-muted/40" />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Info className="h-4 w-4" /></span>
                <div><h3 className="font-bold">3. Informations complémentaires</h3><p className="text-sm text-muted-foreground">Ces détails sont facultatifs.</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="sermon-series">Série</Label><Input id="sermon-series" maxLength={160} placeholder="Nom de la série" value={sermonDraft.series_name} onChange={(event) => setSermonDraft({ ...sermonDraft, series_name: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sermon-date">Date du message</Label><Input id="sermon-date" type="date" value={sermonDraft.date} onChange={(event) => setSermonDraft({ ...sermonDraft, date: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sermon-duration">Durée (minutes)</Label><Input id="sermon-duration" type="number" min="0" max="1440" placeholder="Ex. 45" value={sermonDraft.duration_minutes} onChange={(event) => setSermonDraft({ ...sermonDraft, duration_minutes: event.target.value })} /></div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{sermonFileUploads > 0 ? 'Téléversement en cours, veuillez patienter…' : 'Vérifiez les informations avant la publication.'}</p>
              <div className="flex flex-wrap gap-2">
                {editingId && <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>}
                <Button disabled={saveMutation.isPending || sermonFileUploads > 0}>
                  {sermonFileUploads > 0 || saveMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {sermonFileUploads > 0 ? 'Téléversement…' : saveMutation.isPending ? 'Publication…' : editingId ? 'Enregistrer les modifications' : 'Publier le contenu'}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            saveMutation.reset();
            saveMutation.mutate();
          }}>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="mb-3 text-sm font-semibold">L’image est le contenu principal de la pensée. Le titre et le texte ci-dessous peuvent servir de légende.</p><ImageUploadField id="thought-image" label="Image de la pensée du jour" value={thoughtDraft.image_url} required onChange={(image_url) => setThoughtDraft({ ...thoughtDraft, image_url })} onUploadingChange={setThoughtImageUploading} previewClassName="max-h-[28rem] w-full bg-slate-950 object-contain" /></div>
            <div className="space-y-2"><Label htmlFor="thought-title">Titre ou référence (facultatif)</Label><Input id="thought-title" maxLength={160} value={thoughtDraft.title} onChange={(event) => setThoughtDraft({ ...thoughtDraft, title: event.target.value })} placeholder="Ex. Une parole pour aujourd’hui" /></div>
            <div className="space-y-2"><Label htmlFor="thought-content">Légende (facultatif)</Label><Textarea id="thought-content" maxLength={3000} rows={4} value={thoughtDraft.content} onChange={(event) => setThoughtDraft({ ...thoughtDraft, content: event.target.value })} placeholder="Ajoutez un court commentaire si nécessaire…" /></div>
            <div className="space-y-2"><Label htmlFor="thought-author">Auteur (facultatif)</Label><Input id="thought-author" maxLength={160} value={thoughtDraft.author} onChange={(event) => setThoughtDraft({ ...thoughtDraft, author: event.target.value })} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">La pensée s’affiche pendant 24 heures, puis rejoint les archives.</p>
              <div className="flex gap-2">
                {editingId && <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>}
                <Button type="submit" disabled={saveMutation.isPending || thoughtImageUploading || !thoughtDraft.image_url}><Plus className="mr-2 h-4 w-4" />{thoughtImageUploading ? 'Téléversement…' : saveMutation.isPending ? 'Publication…' : editingId ? 'Enregistrer' : 'Publier pour 24 h'}</Button>
              </div>
            </div>
          </form>
        )}
      </section>

      <section className="glass-panel rounded-3xl p-5">
        <h2 className="mb-4 text-xl font-black">{activeTab === 'events' ? 'Événements publiés' : activeTab === 'sermons' ? 'Prédications et cours publiés' : 'Pensées publiées et archives'}</h2>
        {activeTab === 'sermons' && <p className="mb-4 text-sm text-muted-foreground">{managedSermons.length} cours d’affermissement ou de formation gérés · {sermons.length} contenus au total.</p>}
        {activeTab === 'thoughts' && <p className="mb-4 text-sm text-muted-foreground">Une pensée reste visible pendant 24 heures après sa publication. Les précédentes sont conservées ici et dans les archives de l’accueil.</p>}
        {currentLoading ? <p className="py-8 text-center text-muted-foreground">Chargement…</p> : currentError ? <p role="alert" className="py-8 text-center text-destructive">{currentError.message || 'Impossible de charger les contenus.'}</p> : currentItems.length === 0 ? <p className="py-8 text-center text-muted-foreground">Aucun contenu publié.</p> : (
          <div className="divide-y divide-border/60">{currentItems.map((item) => <article key={item.id} className="flex flex-wrap items-center gap-3 py-4">
            {(item.image_url || item.thumbnail_url) && <img src={item.image_url || item.thumbnail_url} alt="" className="h-14 w-20 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1"><p className="font-bold">{item.title || (activeTab === 'thoughts' ? 'Pensée illustrée' : '')}</p><p className="text-xs text-muted-foreground">{activeTab === 'events' ? `${item.type || 'Événement'} · ${item.date || 'Date à définir'}` : activeTab === 'sermons' ? `${item.category || 'sermon'} · ${item.type || 'contenu'}${item.speaker ? ` · ${item.speaker}` : ''}` : `${item.author || 'Église UCE'} · ${item.created_date ? new Date(item.created_date).toLocaleString('fr-FR') : ''}`}</p></div>
            {activeTab === 'thoughts' && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.id === activeThoughtId ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{item.id === activeThoughtId ? 'Active · 24 h' : 'Archivée'}</span>}
            <Button size="sm" variant="outline" onClick={() => edit(item)}><Pencil className="mr-1 h-4 w-4" />Modifier</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if (window.confirm(`Supprimer « ${item.title} » ?`)) deleteMutation.mutate({ kind: activeTab === 'events' ? 'Event' : activeTab === 'sermons' ? 'Sermon' : 'DailyThought', id: item.id }); }}><Trash2 className="mr-1 h-4 w-4" />Supprimer</Button>
          </article>)}</div>
        )}
      </section>
    </div>
  );
}
