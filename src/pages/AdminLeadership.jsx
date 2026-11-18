import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Shield, Trash2, Users } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ImageUploadField from '@/components/media/ImageUploadField';
import { toast } from 'sonner';
import { isSystemAdministrator } from '@/lib/navigation';

const emptyLeader = { name: '', role: '', bio: '', photo_url: '', email: '', phone: '' };

export default function AdminLeadership() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: saved = {}, isLoading, isError } = useQuery({
    queryKey: ['app-branding'],
    queryFn: () => appClient.settings.branding(),
  });
  const [leaders, setLeaders] = useState([]);
  const [uploading, setUploading] = useState(() => new Set());

  useEffect(() => {
    setLeaders(Array.isArray(saved.leaders) ? saved.leaders : []);
  }, [saved.leaders]);

  const saveMutation = useMutation({
    mutationFn: /** @param {Array<Record<string, string>>} nextLeaders */ (nextLeaders) => appClient.settings.saveBranding({ leaders: nextLeaders }),
    onSuccess: (branding) => {
      queryClient.setQueryData(['app-branding'], branding);
      toast.success('Les responsables ont été enregistrés.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer les responsables.'),
  });
  const canManage = isSystemAdministrator(user);

  const updateLeader = (index, key, value) => {
    setLeaders((current) => current.map((leader, itemIndex) => (
      itemIndex === index ? { ...leader, [key]: value } : leader
    )));
  };
  const setImageUploading = (index, active) => setUploading((current) => {
    const next = new Set(current);
    if (active) next.add(index);
    else next.delete(index);
    return next;
  });
  const publish = (event) => {
    event.preventDefault();
    if (uploading.size > 0) {
      toast.error('Attendez la fin du téléversement des photos avant d’enregistrer.');
      return;
    }
    const incompleteLeader = leaders.find((leader) => (
      !leader.name?.trim() || !leader.role?.trim() || !leader.bio?.trim() || !leader.photo_url
    ));
    if (incompleteLeader) {
      toast.error('Chaque responsable doit avoir un nom, un titre, une description et une photo.');
      return;
    }
    saveMutation.mutate(leaders);
  };

  if (userLoading || isLoading) return <p className="p-8 text-center text-muted-foreground">Chargement des responsables…</p>;
  if (!canManage) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center p-6">
        <div className="glass-panel rounded-3xl p-8 text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-black">Gestion réservée à l’administration</h1>
          <p className="mt-2 text-sm text-muted-foreground">Seuls les administrateurs généraux peuvent publier les responsables.</p>
        </div>
      </div>
    );
  }
  if (isError) return <p role="alert" className="p-8 text-center text-destructive">Impossible de charger la liste des responsables.</p>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-slate-950 via-primary to-indigo-950 px-5 py-8 text-white md:px-12 md:py-10">
        <Link to="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-white/75 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />Administration
        </Link>
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70"><Users className="h-4 w-4" />Équipe de l’église</p>
        <h1 className="text-3xl font-black md:text-4xl">Gestion des responsables</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">Ajoutez et mettez à jour les personnes présentées sur la page publique « Responsables ».</p>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div><p className="font-bold">{leaders.length} responsable{leaders.length === 1 ? '' : 's'} dans la liste</p><p className="text-sm text-muted-foreground">Le pasteur principal est géré dans Design et identité.</p></div>
          <Button type="button" variant="outline" className="rounded-xl" disabled={leaders.length >= 30} onClick={() => setLeaders((current) => [...current, { ...emptyLeader }])}>
            <Plus className="mr-2 h-4 w-4" />Ajouter un responsable
          </Button>
        </div>

        <form className="space-y-4" onSubmit={publish}>
          {leaders.length === 0 ? (
            <div className="glass-panel rounded-3xl border border-dashed p-10 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <h2 className="font-bold">Aucun responsable ajouté</h2>
              <p className="mt-1 text-sm text-muted-foreground">Commencez par ajouter une personne à présenter sur la page.</p>
              <Button type="button" className="mt-4 rounded-xl" onClick={() => setLeaders([{ ...emptyLeader }])}><Plus className="mr-2 h-4 w-4" />Ajouter le premier responsable</Button>
            </div>
          ) : leaders.map((leader, index) => (
            <section key={`leader-${index}`} className="glass-panel space-y-4 rounded-3xl p-4 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Responsable {index + 1}</p><h2 className="text-lg font-black">{leader.name || 'Nouvelle fiche'}</h2></div>
                <Button type="button" variant="ghost" className="rounded-xl text-destructive hover:text-destructive" onClick={() => setLeaders((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <Trash2 className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Retirer</span>
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor={`leader-name-${index}`}>Nom complet *</Label><Input id={`leader-name-${index}`} required maxLength={120} placeholder="Ex. Jean-Marc Nzambe" value={leader.name || ''} onChange={(event) => updateLeader(index, 'name', event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`leader-role-${index}`}>Titre / fonction *</Label><Input id={`leader-role-${index}`} required maxLength={120} placeholder="Ex. Responsable de la jeunesse" value={leader.role || ''} onChange={(event) => updateLeader(index, 'role', event.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor={`leader-bio-${index}`}>Description *</Label><Textarea id={`leader-bio-${index}`} required maxLength={1000} rows={4} placeholder="Présentez son rôle, son parcours ou son service dans l’église…" value={leader.bio || ''} onChange={(event) => updateLeader(index, 'bio', event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`leader-email-${index}`}>E-mail (facultatif)</Label><Input id={`leader-email-${index}`} type="email" maxLength={254} placeholder="nom@eglise.org" value={leader.email || ''} onChange={(event) => updateLeader(index, 'email', event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`leader-phone-${index}`}>Téléphone (facultatif)</Label><Input id={`leader-phone-${index}`} maxLength={40} placeholder="+242…" value={leader.phone || ''} onChange={(event) => updateLeader(index, 'phone', event.target.value)} /></div>
                <div className="md:col-span-2">
                  <ImageUploadField
                    id={`leader-photo-${index}`}
                    label="Photo du responsable"
                    required
                    value={leader.photo_url || ''}
                    onChange={(url) => updateLeader(index, 'photo_url', url)}
                    onUploadingChange={(active) => setImageUploading(index, active)}
                    previewClassName="h-40 w-32 rounded-2xl object-cover"
                  />
                </div>
              </div>
            </section>
          ))}

          {leaders.length > 0 && (
            <div className="fixed bottom-20 left-0 right-0 z-20 px-4 md:sticky md:bottom-4 md:px-0">
              <div className="mx-auto flex max-w-5xl justify-end rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur md:border-0 md:bg-transparent md:p-0 md:shadow-none">
                <Button size="lg" className="w-full rounded-2xl md:w-auto" disabled={saveMutation.isPending || uploading.size > 0}>
                  <Save className="mr-2 h-4 w-4" />
                  {uploading.size ? 'Téléversement des photos…' : saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer les responsables'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
