import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, CheckCircle2, LockKeyhole, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function BibleStudies({ adminMode = false }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState({ title: '', description: '', member_ids: [] });
  const [lessonDraft, setLessonDraft] = useState({ title: '', scripture: '', content: '', video_url: '' });
  const [editingLessonId, setEditingLessonId] = useState('');
  const [expandedLessons, setExpandedLessons] = useState({});
  const [memberSearch, setMemberSearch] = useState('');
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: groups = [], isLoading, isError } = useQuery({ queryKey: ['bible-study-groups'], queryFn: () => appClient.studies.groups() });
  const canCreate = Boolean(adminMode && user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role)));
  const selectedGroup = groups.find((group) => group.id === selectedId) || groups[0] || null;
  const canManageGroup = Boolean(canCreate && selectedGroup?.is_creator);
  const { data: members = [] } = useQuery({
    queryKey: ['study-members'],
    queryFn: () => appClient.studies.members(),
    enabled: canCreate,
  });
  const { data: currentMembers = [] } = useQuery({
    queryKey: ['study-group-members', selectedGroup?.id],
    queryFn: () => appClient.studies.groupMembers(selectedGroup.id),
    enabled: Boolean(selectedGroup && canManageGroup),
  });
  const { data: lessons = [], isLoading: lessonsLoading, isError: lessonsError } = useQuery({
    queryKey: ['study-lessons', selectedGroup?.id],
    queryFn: () => appClient.studies.lessons(selectedGroup.id),
    enabled: Boolean(selectedGroup),
  });
  const currentMemberIds = useMemo(() => currentMembers.map((member) => member.member_id), [currentMembers]);

  useEffect(() => {
    if (!selectedId && groups[0]) setSelectedId(groups[0].id);
  }, [groups, selectedId]);
  useEffect(() => {
    if (!selectedGroup || !canManageGroup) return;
    setGroupDraft((draft) => ({
      ...draft,
      title: selectedGroup.title,
      description: selectedGroup.description || '',
      member_ids: currentMemberIds,
    }));
  }, [selectedGroup?.id, selectedGroup?.title, selectedGroup?.description, currentMemberIds.join(','), canManageGroup]);

  const createGroup = useMutation({
    mutationFn: /** @param {{ title: string, description: string, member_ids: string[] }} data */ (data) => appClient.studies.createGroup(data),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['bible-study-groups'] });
      setSelectedId(group.id);
      setGroupDraft({ title: '', description: '', member_ids: [] });
      setCreateOpen(false);
      toast.success('Formation privée créée. Seuls ses membres et ses responsables y ont accès.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de créer cette formation.'),
  });
  const saveMembers = useMutation({
    mutationFn: /** @param {{ id: string, member_ids: string[] }} variables */ ({ id, member_ids: memberIds }) => appClient.studies.updateMembers(id, { member_ids: memberIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-group-members', selectedGroup?.id] });
      queryClient.invalidateQueries({ queryKey: ['bible-study-groups'] });
      toast.success('La liste des participants a été mise à jour.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de modifier les participants.'),
  });
  const addLesson = useMutation({
    mutationFn: /** @param {{ id?: string, data: { title: string, scripture: string, content: string, video_url: string } }} variables */ ({ id, data }) => id
      ? appClient.studies.updateLesson(id, data)
      : appClient.studies.createLesson(selectedGroup.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-lessons', selectedGroup?.id] });
      setEditingLessonId('');
      setLessonDraft({ title: '', scripture: '', content: '', video_url: '' });
      toast.success('Le cours a été enregistré pour les participants autorisés.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de publier le cours.'),
  });
  const updateGroup = useMutation({
    mutationFn: () => appClient.studies.updateGroup(selectedGroup.id, {
      title: groupDraft.title,
      description: groupDraft.description,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bible-study-groups'] });
      toast.success('La formation a été modifiée.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de modifier la formation.'),
  });
  const markLessonOpened = useMutation({
    mutationFn: /** @param {string} lessonId */ (lessonId) => appClient.studies.openLesson(lessonId),
    onSuccess: (_result, lessonId) => {
      setExpandedLessons((current) => ({ ...current, [lessonId]: true }));
      queryClient.invalidateQueries({ queryKey: ['study-lessons', selectedGroup?.id] });
    },
    onError: (error) => toast.error(error.message || 'Impossible de mettre à jour le suivi de ce cours.'),
  });
  const deleteLesson = useMutation({
    mutationFn: /** @param {string} lessonId */ (lessonId) => appClient.studies.deleteLesson(lessonId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['study-lessons', selectedGroup?.id] }),
    onError: (error) => toast.error(error.message || 'Impossible de supprimer ce cours.'),
  });
  const deleteGroup = useMutation({
    mutationFn: /** @param {string} groupId */ (groupId) => appClient.studies.deleteGroup(groupId),
    onSuccess: () => {
      setSelectedId('');
      queryClient.invalidateQueries({ queryKey: ['bible-study-groups'] });
      toast.success('La formation et ses cours ont été supprimés.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de supprimer cette formation.'),
  });

  const toggleMember = (memberId) => {
    const selected = groupDraft.member_ids;
    setGroupDraft({ ...groupDraft, member_ids: selected.includes(memberId)
      ? selected.filter((id) => id !== memberId)
      : [...selected, memberId] });
  };
  const filteredMembers = members.filter((member) => (
    `${member.full_name || ''} ${member.numero_membre || ''}`.toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase())
  ));

  return (
    <div className="min-h-screen bg-background">
      <header className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-primary px-6 py-10 text-white md:px-12">
        {!adminMode && <img src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1600&q=80" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
        {!adminMode && <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-indigo-950/80 to-primary/65" />}
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-200"><LockKeyhole className="h-4 w-4" />Espace confidentiel</p>
        <h1 className="text-4xl font-black text-white md:text-5xl">Formations bibliques privées</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">Les formations, leurs participants et leurs cours ne sont visibles que par le pasteur responsable et les membres invités.</p>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        {canCreate && (
          <section className="glass-panel rounded-3xl p-5">
            {!createOpen ? (
              <Button onClick={() => {
                setGroupDraft({ title: '', description: '', member_ids: [] });
                setCreateOpen(true);
              }}><Plus className="h-4 w-4" />Créer une formation privée</Button>
            ) : (
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                createGroup.mutate(groupDraft);
              }}>
                <h2 className="text-xl font-black">Nouvelle communauté d’étude</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="study-title">Nom de la formation</Label><Input id="study-title" required maxLength={160} value={groupDraft.title} onChange={(event) => setGroupDraft({ ...groupDraft, title: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="study-description">Description (facultative)</Label><Input id="study-description" maxLength={2000} value={groupDraft.description} onChange={(event) => setGroupDraft({ ...groupDraft, description: event.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Inviter des membres disposant d’un compte actif</Label>
                  <Input aria-label="Rechercher un membre" placeholder="Rechercher par nom ou numéro de membre" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                  <div className="grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-border/60 p-3 sm:grid-cols-2">
                    {filteredMembers.map((member) => (
                      <label key={member.member_id} className="flex cursor-pointer items-center gap-2 rounded-xl p-2 text-sm hover:bg-muted/60">
                        <input type="checkbox" checked={groupDraft.member_ids.includes(member.member_id)} onChange={() => toggleMember(member.member_id)} />
                        <span className="min-w-0 flex-1 truncate">{member.full_name}</span>
                        <span className="text-xs text-muted-foreground">{member.numero_membre}</span>
                      </label>
                    ))}
                    {filteredMembers.length === 0 && <p className="text-sm text-muted-foreground">Aucun membre trouvé.</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{groupDraft.member_ids.length} participant(s) sélectionné(s).</p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createGroup.isPending}>Créer la formation</Button>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                </div>
              </form>
            )}
          </section>
        )}

        {isLoading ? <p className="py-12 text-center text-muted-foreground">Chargement de vos formations…</p>
          : isError ? <p role="alert" className="rounded-2xl border border-destructive/30 p-4 text-destructive">Impossible de charger les formations privées.</p>
            : groups.length === 0 ? (
              <div className="glass-panel rounded-3xl p-10 text-center">
                <LockKeyhole className="mx-auto mb-4 h-12 w-12 text-primary/50" />
                <h2 className="text-xl font-black">Aucune formation privée associée à votre compte</h2>
                <p className="mt-2 text-sm text-muted-foreground">Les invitations du pasteur apparaîtront ici. Les autres formations de l’église restent confidentielles.</p>
              </div>
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-[280px_1fr]">
                <aside className="glass-panel space-y-2 rounded-3xl p-4">
                  <h2 className="mb-3 flex items-center gap-2 px-2 font-black"><Users className="h-4 w-4 text-primary" />Mes formations</h2>
                  {groups.map((group) => (
                    <button key={group.id} type="button" onClick={() => setSelectedId(group.id)} className={`w-full rounded-2xl p-3 text-left transition ${selectedGroup?.id === group.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/70'}`}>
                      <span className="block truncate font-bold">{group.title}</span>
                      <span className={`text-xs ${selectedGroup?.id === group.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{group.member_count} participant(s)</span>
                    </button>
                  ))}
                </aside>

                {selectedGroup && (
                  <section className="space-y-5">
                    <div className="glass-panel rounded-3xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><LockKeyhole className="h-3.5 w-3.5" />Formation privée</p><h2 className="text-2xl font-black">{selectedGroup.title}</h2>{selectedGroup.description && <p className="mt-2 text-sm text-muted-foreground">{selectedGroup.description}</p>}</div>
                        {canManageGroup && <Button variant="outline" size="sm" className="text-destructive" onClick={() => {
                          if (window.confirm('Supprimer cette formation et tous ses cours ?')) deleteGroup.mutate(selectedGroup.id);
                        }}><Trash2 className="h-4 w-4" />Supprimer</Button>}
                      </div>
                      {canManageGroup && (
                        <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
                          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
                            event.preventDefault();
                            updateGroup.mutate();
                          }}>
                            <div className="space-y-2"><Label htmlFor="edit-study-title">Nom de la formation</Label><Input id="edit-study-title" required maxLength={160} value={groupDraft.title} onChange={(event) => setGroupDraft({ ...groupDraft, title: event.target.value })} /></div>
                            <div className="space-y-2"><Label htmlFor="edit-study-description">Description</Label><Input id="edit-study-description" maxLength={2000} value={groupDraft.description} onChange={(event) => setGroupDraft({ ...groupDraft, description: event.target.value })} /></div>
                            <Button className="sm:col-span-2 sm:justify-self-start" size="sm" disabled={updateGroup.isPending}>Enregistrer la formation</Button>
                          </form>
                          <Label>Participants autorisés</Label>
                          <Input aria-label="Filtrer les membres" placeholder="Rechercher un membre" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                          <div className="grid max-h-52 gap-1 overflow-y-auto sm:grid-cols-2">
                            {filteredMembers.map((member) => (
                              <label key={member.member_id} className="flex cursor-pointer items-center gap-2 rounded-xl p-2 text-sm hover:bg-muted/60">
                                <input type="checkbox" checked={groupDraft.member_ids.includes(member.member_id)} onChange={() => toggleMember(member.member_id)} />
                                <span className="min-w-0 flex-1 truncate">{member.full_name}</span><span className="text-xs text-muted-foreground">{member.numero_membre}</span>
                              </label>
                            ))}
                          </div>
                          <Button size="sm" variant="outline" disabled={saveMembers.isPending} onClick={() => saveMembers.mutate({ id: selectedGroup.id, member_ids: groupDraft.member_ids })}>Enregistrer les participants</Button>
                        </div>
                      )}
                    </div>

                    {canManageGroup && (
                      <form className="glass-panel space-y-3 rounded-3xl p-5" onSubmit={(event) => {
                        event.preventDefault();
                        addLesson.mutate({ id: editingLessonId || undefined, data: lessonDraft });
                      }}>
                        <h3 className="flex items-center gap-2 font-black"><BookOpen className="h-5 w-5 text-primary" />{editingLessonId ? 'Modifier le cours biblique' : 'Préparer un cours biblique'}</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2"><Label htmlFor="lesson-title">Titre</Label><Input id="lesson-title" required maxLength={160} value={lessonDraft.title} onChange={(event) => setLessonDraft({ ...lessonDraft, title: event.target.value })} /></div>
                          <div className="space-y-2"><Label htmlFor="lesson-scripture">Passage biblique</Label><Input id="lesson-scripture" maxLength={300} placeholder="Ex. Jean 3:16-21" value={lessonDraft.scripture} onChange={(event) => setLessonDraft({ ...lessonDraft, scripture: event.target.value })} /></div>
                        </div>
                        <div className="space-y-2"><Label htmlFor="lesson-content">Contenu du cours</Label><Textarea id="lesson-content" required maxLength={30000} rows={6} value={lessonDraft.content} onChange={(event) => setLessonDraft({ ...lessonDraft, content: event.target.value })} /></div>
                        <div className="space-y-2"><Label htmlFor="lesson-video">Lien vidéo (facultatif)</Label><Input id="lesson-video" type="url" placeholder="YouTube ou Facebook" value={lessonDraft.video_url} onChange={(event) => setLessonDraft({ ...lessonDraft, video_url: event.target.value })} /></div>
                        <div className="flex gap-2"><Button type="submit" disabled={addLesson.isPending}>{editingLessonId ? 'Enregistrer les modifications' : 'Publier le cours aux participants'}</Button>{editingLessonId && <Button type="button" variant="outline" onClick={() => { setEditingLessonId(''); setLessonDraft({ title: '', scripture: '', content: '', video_url: '' }); }}>Annuler</Button>}</div>
                      </form>
                    )}

                    {lessonsLoading ? <p className="py-6 text-center text-muted-foreground">Chargement des cours…</p>
                      : lessonsError ? <p role="alert" className="text-sm text-destructive">Impossible de charger les cours.</p>
                        : lessons.length === 0 ? <p className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground">Aucun cours n’a encore été publié dans cette formation.</p>
                          : lessons.map((lesson) => (
                            <article key={lesson.id} className="glass-panel space-y-3 rounded-3xl p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div><h3 className="text-xl font-black">{lesson.title}</h3>{lesson.scripture && <p className="mt-1 text-sm font-semibold text-primary">{lesson.scripture}</p>}{!canManageGroup && lesson.is_completed && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle2 className="h-4 w-4" />Cours ouvert</p>}</div>
                                {canManageGroup && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Modifier le cours" onClick={() => { setEditingLessonId(lesson.id); setLessonDraft({ title: lesson.title || '', scripture: lesson.scripture || '', content: lesson.content || '', video_url: lesson.video_url || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Supprimer le cours" onClick={() => {
                                  if (window.confirm('Supprimer ce cours ?')) deleteLesson.mutate(lesson.id);
                                }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>}
                              </div>
                              {canManageGroup || expandedLessons[lesson.id] ? <><p className="whitespace-pre-wrap text-sm leading-7">{lesson.content}</p>{lesson.video_url && <a className="inline-flex font-semibold text-primary underline" href={lesson.video_url} target="_blank" rel="noreferrer">Voir la vidéo du cours</a>}</>
                                : <Button size="sm" variant="outline" disabled={markLessonOpened.isPending} onClick={() => markLessonOpened.mutate(lesson.id)}>{lesson.is_completed ? 'Lire le cours' : 'Ouvrir le cours'}</Button>}
                              <p className="text-xs text-muted-foreground">{new Date(lesson.created_at).toLocaleDateString('fr-FR')}</p>
                            </article>
                          ))}
                  </section>
                )}
              </div>
            )}
      </main>
    </div>
  );
}
