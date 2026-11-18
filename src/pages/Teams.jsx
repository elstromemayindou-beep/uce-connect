import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Search, Music, BookOpen, Heart, Globe, Monitor, Smile, Zap, Star } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ImageUploadField from '@/components/media/ImageUploadField';

const typeConfig = {
  worship:     { label: 'Louange',     icon: Music,    gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10 text-purple-600' },
  preaching:   { label: 'Prédication', icon: BookOpen, gradient: 'from-blue-500 to-blue-600',     bg: 'bg-blue-500/10 text-blue-600' },
  children:    { label: 'Enfants',     icon: Smile,    gradient: 'from-pink-500 to-pink-600',     bg: 'bg-pink-500/10 text-pink-600' },
  missions:    { label: 'Missions',    icon: Globe,    gradient: 'from-green-500 to-green-600',   bg: 'bg-green-500/10 text-green-600' },
  prayer:      { label: 'Prière',      icon: Heart,    gradient: 'from-red-500 to-red-600',       bg: 'bg-red-500/10 text-red-500' },
  media:       { label: 'Média',       icon: Monitor,  gradient: 'from-slate-500 to-slate-600',   bg: 'bg-slate-500/10 text-slate-600' },
  hospitality: { label: 'Accueil',     icon: Star,     gradient: 'from-amber-500 to-amber-600',   bg: 'bg-amber-500/10 text-amber-600' },
  youth:       { label: 'Jeunesse',    icon: Zap,      gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-500/10 text-indigo-600' },
  other:       { label: 'Autre',       icon: Users,    gradient: 'from-slate-400 to-slate-500',   bg: 'bg-slate-500/10 text-slate-600' },
};

export default function Teams({ adminMode = false }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [draft, setDraft] = useState({ name: '', type: 'other', description: '', leader_email: '', image_url: '' });

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: branding = {} } = useQuery({ queryKey: ['app-branding'], queryFn: () => appClient.settings.branding() });
  const { data: teams = [], isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => appClient.entities.Team.list() });
  const canManage = Boolean(adminMode && user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role)));

  const joinMutation = useMutation({
    /** @param {{ id: string, members?: Array<{ email?: string, name?: string, role?: string }> }} team */
    mutationFn: async (team) => {
      const members = team.members || [];
      if (members.some(m => m.email === user?.email)) return;
      await appClient.entities.Team.update(team.id, {
        members: [...members, { email: user?.email, name: user?.full_name, role: 'Membre' }]
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); toast.success("Vous avez rejoint l'équipe !"); },
  });
  const saveTeamMutation = useMutation({
    mutationFn: /** @param {{ id: string, data: Record<string, unknown> }} variables */ ({ id, data }) => appClient.entities.Team.update(id, data),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSelected(team);
      setEditing(false);
      toast.success('Les informations de l’équipe ont été mises à jour.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de modifier l’équipe.'),
  });
  const createTeamMutation = useMutation({
    mutationFn: /** @param {Record<string, unknown>} data */ (data) => appClient.entities.Team.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setDraft({ name: '', type: 'other', description: '', leader_email: '', image_url: '' });
      setCreateOpen(false);
      toast.success('La nouvelle équipe est publiée.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de créer l’équipe.'),
  });
  const deleteTeamMutation = useMutation({
    mutationFn: /** @param {string} id */ (id) => appClient.entities.Team.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSelected(null);
      toast.success('L’équipe a été supprimée.');
    },
    onError: (error) => toast.error(error.message || 'Impossible de supprimer l’équipe.'),
  });

  const filtered = teams.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()));
  const isMember = (team) => team.members?.some(m => m.email === user?.email);

  if (adminMode && user && !user.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL'].includes(role))) {
    return <div className="p-8 text-center"><h1 className="text-xl font-black">Accès restreint</h1><p className="mt-2 text-muted-foreground">La gestion des équipes est réservée au pasteur et à l’administration.</p></div>;
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-800 via-amber-700 to-orange-700 text-white">
        {!adminMode && <img src={branding.teams_hero_url || 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&q=80'} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {!adminMode && <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-amber-950/70 to-orange-950/60" />}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative px-6 py-12 md:px-12">
          <p className="text-white/70 font-bold tracking-widest text-xs uppercase mb-2">Servir avec passion</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white">Équipes & Ministères</h1>
          <p className="text-white/70 mt-2">Servez Dieu avec vos talents</p>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        {canManage && (
          <section className="glass-panel rounded-3xl p-5">
            {!createOpen ? (
              <Button onClick={() => setCreateOpen(true)}>Ajouter une équipe ou un responsable</Button>
            ) : (
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
                event.preventDefault();
                createTeamMutation.mutate(draft);
              }}>
                <h2 className="text-xl font-black sm:col-span-2">Nouvelle équipe</h2>
                <div className="space-y-2"><Label htmlFor="new-team-name">Nom</Label><Input id="new-team-name" required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="new-team-type">Ministère</Label><select id="new-team-type" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{Object.entries(typeConfig).map(([type, config]) => <option key={type} value={type}>{config.label}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="new-team-leader">E-mail du responsable (facultatif)</Label><Input id="new-team-leader" type="email" value={draft.leader_email} onChange={(event) => setDraft({ ...draft, leader_email: event.target.value })} /></div>
                <ImageUploadField id="new-team-image" label="Image de l’équipe (facultative)" value={draft.image_url} onChange={(image_url) => setDraft({ ...draft, image_url })} onUploadingChange={setImageUploading} />
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-team-description">Description</Label><Input id="new-team-description" maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
                <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={createTeamMutation.isPending || imageUploading}>Publier l’équipe</Button><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button></div>
              </form>
            )}
          </section>
        )}
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher une équipe..." className="pl-11 h-12 rounded-2xl" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 && !isLoading ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">Aucune équipe trouvée</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((team) => {
              const config = typeConfig[team.type] || typeConfig.other;
              const Icon = config.icon;
              const member = isMember(team);
              return (
                <div
                  key={team.id}
                  className="bg-card border border-border/50 rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  onClick={() => { setSelected(team); setEditing(false); setDraft({ name: team.name || '', type: team.type || 'other', description: team.description || '', leader_email: team.leader_email || '', image_url: team.image_url || '' }); }}
                >
                  {/* Colored top bar */}
                  <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />
                  <div className="p-5">
                    {team.image_url && <img src={team.image_url} alt="" className="mb-4 h-32 w-full rounded-2xl object-cover" />}
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.bg}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {member && (
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2.5 py-1 rounded-full">✓ Membre</span>
                      )}
                    </div>
                    <h3 className="font-black text-base mb-1">{team.name}</h3>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${config.bg}`}>{config.label}</span>
                    {team.description && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{team.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-semibold">{team.members?.length || 0} membres</span>
                      </div>
                      <span className="text-xs text-primary font-semibold group-hover:underline">Voir →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="rounded-3xl overflow-hidden p-0">
          {selected && (() => {
            const config = typeConfig[selected.type] || typeConfig.other;
            const Icon = config.icon;
            return (
              <>
                <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Icon className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black">{selected.name}</h2>
                      <span className="text-white/70 text-sm">{config.label}</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {editing && canManage ? (
                    <form className="space-y-3" onSubmit={(event) => {
                      event.preventDefault();
                      saveTeamMutation.mutate({ id: selected.id, data: draft });
                    }}>
                      <div className="space-y-2"><Label htmlFor="edit-team-name">Nom de l’équipe</Label><Input id="edit-team-name" required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="edit-team-type">Ministère</Label><select id="edit-team-type" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{Object.entries(typeConfig).map(([type, item]) => <option key={type} value={type}>{item.label}</option>)}</select></div>
                      <div className="space-y-2"><Label htmlFor="edit-team-description">Description</Label><Input id="edit-team-description" maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="edit-team-leader">E-mail du responsable</Label><Input id="edit-team-leader" type="email" value={draft.leader_email} onChange={(event) => setDraft({ ...draft, leader_email: event.target.value })} /></div>
                      <ImageUploadField id="edit-team-image" label="Image de l’équipe" value={draft.image_url} onChange={(image_url) => setDraft({ ...draft, image_url })} onUploadingChange={setImageUploading} />
                      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saveTeamMutation.isPending || imageUploading}>Enregistrer</Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Annuler</Button></div>
                    </form>
                  ) : (
                    <>
                      {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                  {selected.leader_email && (
                    <div className="p-3 rounded-2xl bg-muted/50 text-sm">
                      <span className="font-bold">Responsable : </span>{selected.leader_email}
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-sm mb-2">Membres ({selected.members?.length || 0})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selected.members?.map((member, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {member.name?.[0] || '?'}
                            </div>
                            <span className="font-medium">{member.name || member.email}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{member.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button className="flex-1 rounded-2xl" onClick={() => setEditing(true)}>Modifier l’équipe</Button>
                      <Button variant="outline" className="text-destructive" onClick={() => {
                        if (window.confirm(`Supprimer l’équipe « ${selected.name} » ?`)) deleteTeamMutation.mutate(selected.id);
                      }}>Supprimer</Button>
                    </div>
                  ) : (
                    <Button className="w-full rounded-2xl h-11 font-bold bg-amber-500 hover:bg-amber-400 text-black" onClick={() => joinMutation.mutate(selected)} disabled={isMember(selected)}>
                      {isMember(selected) ? '✓ Déjà membre' : "Rejoindre l'équipe"}
                    </Button>
                  )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}