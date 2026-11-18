import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { applyBranding, defaultBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePlus, Palette, Save, Shield, Type } from 'lucide-react';
import { toast } from 'sonner';
import ImageUploadField from '@/components/media/ImageUploadField';
import { Link } from 'react-router-dom';

const imageFields = [
  { key: 'logo_url', label: 'Logo de l’église' },
  { key: 'home_hero_url', label: 'Image de fond de l’accueil' },
  { key: 'pastor_photo_url', label: 'Photo du pasteur' },
  { key: 'teams_hero_url', label: 'Image de la page Équipes' },
  { key: 'background_url', label: 'Image de fond générale (facultative)' },
];

export default function AppDesign() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: saved = defaultBranding, isLoading, isError } = useQuery({
    queryKey: ['app-branding'],
    queryFn: () => appClient.settings.branding(),
  });
  const [draft, setDraft] = useState(defaultBranding);
  const [uploading, setUploading] = useState(() => new Set());
  const isAdministrator = Boolean(user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role)));

  useEffect(() => {
    setDraft({ ...defaultBranding, ...saved, leaders: Array.isArray(saved.leaders) ? saved.leaders : [] });
  }, [saved]);

  useEffect(() => {
    applyBranding(draft);
    return () => applyBranding(saved);
  }, [draft, saved]);

  const saveMutation = useMutation({
    mutationFn: /** @param {Record<string, unknown>} settings */ (settings) => appClient.settings.saveBranding(settings),
    onSuccess: /** @param {Record<string, unknown>} settings */ (settings) => {
      queryClient.setQueryData(['app-branding'], settings);
      toast.success('Les réglages visuels et les responsables ont été enregistrés.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer les réglages.'),
  });

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setImageUploading = (key, isUploading) => setUploading((current) => {
    const next = new Set(current);
    if (isUploading) next.add(key);
    else next.delete(key);
    return next;
  });
  const leaderCount = Array.isArray(draft.leaders) ? draft.leaders.length : 0;
  if (userLoading || isLoading) return <p className="p-8 text-center text-muted-foreground">Chargement des réglages…</p>;
  if (!isAdministrator) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center p-6">
        <div className="glass-panel rounded-3xl p-8 text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-black">Gestion réservée à l’administration</h1>
          <p className="mt-2 text-sm text-muted-foreground">Seuls les administrateurs généraux peuvent modifier le design et les responsables de l’application.</p>
        </div>
      </div>
    );
  }
  if (isError) return <p role="alert" className="p-8 text-center text-destructive">Impossible de charger la configuration de l’application.</p>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-slate-950 via-primary to-indigo-950 px-6 py-10 text-white md:px-12">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70"><Palette className="h-4 w-4" />Administration générale</p>
        <h1 className="text-3xl font-black md:text-4xl">Design et identité de l’application</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">Gérez le logo, les photos, les couleurs, la typographie, les boutons et les responsables visibles par les membres.</p>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <section className="glass-panel space-y-5 rounded-3xl p-5 md:p-7">
          <div className="flex items-center gap-3">
            <ImagePlus className="h-6 w-6 text-primary" />
            <div><h2 className="text-xl font-black">Images et identité</h2><p className="text-sm text-muted-foreground">Les fichiers téléversés sont enregistrés dans le stockage de l’église.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {imageFields.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <ImageUploadField
                  id={`branding-${key}`}
                  label={label}
                  value={draft[key] || ''}
                  onChange={(url) => update(key, url)}
                  onUploadingChange={(isUploading) => setImageUploading(key, isUploading)}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['pastor_name', 'Nom du pasteur'],
              ['pastor_role', 'Fonction du pasteur'],
              ['pastor_email', 'E-mail du pasteur'],
              ['pastor_phone', 'Téléphone du pasteur'],
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`branding-${key}`}>{label}</Label>
                <Input id={`branding-${key}`} value={draft[key] || ''} maxLength={200} onChange={(event) => update(key, event.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel space-y-5 rounded-3xl p-5 md:p-7">
          <div className="flex items-center gap-3">
            <Type className="h-6 w-6 text-primary" />
            <div><h2 className="text-xl font-black">Thème global</h2><p className="text-sm text-muted-foreground">Les changements sont prévisualisés immédiatement sur cette session.</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ['primary_color', 'Couleur principale', '#4f46e5'],
              ['accent_color', 'Couleur d’accent', '#f59e0b'],
            ].map(([key, label, fallback]) => (
              <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
                <Label htmlFor={`branding-${key}`}>{label}</Label>
                <Input id={`branding-${key}`} type="color" value={draft[key] || fallback} className="h-11 w-16 cursor-pointer p-1" onChange={(event) => update(key, event.target.value)} />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="branding-font">Police de caractères</Label>
              <select id="branding-font" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.font_family || 'Inter'} onChange={(event) => update('font_family', event.target.value)}>
                <option value="Inter">Inter · moderne</option><option value="Arial">Arial · classique</option><option value="Georgia">Georgia · éditoriale</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branding-buttons">Forme des boutons</Label>
              <select id="branding-buttons" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={draft.button_style || 'rounded'} onChange={(event) => update('button_style', event.target.value)}>
                <option value="rounded">Arrondis</option><option value="pill">Pilule</option><option value="square">Carrés</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="branding-opacity">Opacité des panneaux vitrés · {Math.round(Number(draft.glass_opacity ?? 0.7) * 100)} %</Label>
              <input id="branding-opacity" type="range" min="0.35" max="0.95" step="0.05" value={draft.glass_opacity ?? 0.7} onChange={(event) => update('glass_opacity', Number(event.target.value))} className="w-full accent-primary" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4">
            <Button className="rounded-2xl">Aperçu d’un bouton</Button>
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm">Aperçu de l’effet verre dépoli</div>
          </div>
        </section>

        <section className="glass-panel space-y-5 rounded-3xl p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-black">Responsables affichés dans l’application</h2><p className="text-sm text-muted-foreground">Le pasteur principal est géré dans la section Identité ci-dessus.</p></div>
            <Button asChild type="button" variant="outline"><Link to="/admin/responsibles">Gérer les responsables</Link></Button>
          </div>
          <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            {leaderCount} responsable{leaderCount === 1 ? '' : 's'} publié{leaderCount === 1 ? '' : 's'}. Modifiez leurs fiches depuis l’espace dédié pour gérer leur description et leur photo.
          </p>
        </section>

        <div className="sticky bottom-4 z-20 flex justify-end">
          <Button size="lg" className="rounded-2xl shadow-xl" disabled={saveMutation.isPending || uploading.size > 0} onClick={() => saveMutation.mutate(draft)}>
            <Save className="h-4 w-4" />{saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer tous les réglages'}
          </Button>
        </div>
      </main>
    </div>
  );
}
