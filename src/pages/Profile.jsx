import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Save, LogOut, Award, BookOpen, Flame, Shield, Heart, HandCoins, CalendarClock, Download, Smartphone, Pencil, X } from 'lucide-react';
import PushDeviceSettings from '@/components/notifications/PushDeviceSettings';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/I18nContext';
import { usePwa } from '@/lib/PwaContext';

const SPIRITUAL_ROLES = [
  { value: 'member', label: 'Membre' },
  { value: 'deacon', label: 'Diacre' },
  { value: 'elder', label: 'Ancien' },
  { value: 'pastor', label: 'Pasteur' },
  { value: 'evangelist', label: 'Évangéliste' },
  { value: 'worship_leader', label: 'Responsable louange' },
  { value: 'teacher', label: 'Enseignant' },
  { value: 'new_convert', label: 'Nouveau converti' },
];

export default function Profile() {
  const { language, setLanguage, t } = useLanguage();
  const { canPromptInstall, installed, install } = usePwa();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: activity, isLoading: isLoadingActivity, isError: activityError } = useQuery({
    queryKey: ['my-activity'],
    queryFn: () => appClient.auth.activity(),
  });
  const { data: communities = [] } = useQuery({ queryKey: ['communities'], queryFn: () => appClient.entities.Community.list() });

  /** @type {[{
   *   phone: string;
   *   country: string;
   *   city: string;
   *   gender: string;
   *   age: string | number;
   *   spiritual_role: string;
   *   bio: string;
   *   community_id: string;
   *   reading_plan: string;
   * }, React.Dispatch<React.SetStateAction<{
   *   phone: string;
   *   country: string;
   *   city: string;
   *   gender: string;
   *   age: string | number;
   *   spiritual_role: string;
   *   bio: string;
   *   community_id: string;
   *   reading_plan: string;
   * }>>]} */
  const [form, setForm] = useState({
    phone: '',
    country: '',
    city: '',
    gender: '',
    age: '',
    spiritual_role: 'member',
    bio: '',
    community_id: '',
    reading_plan: '1_chapter',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  useEffect(() => {
    if (user) {
      setForm({
        phone: user.phone || '',
        country: user.country || '',
        city: user.city || '',
        gender: user.gender || '',
        age: user.age || '',
        spiritual_role: user.spiritual_role || 'member',
        bio: user.bio || '',
        community_id: user.community_id || '',
        reading_plan: user.reading_plan || '1_chapter',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: (data) => appClient.auth.updateMe(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setIsEditingProfile(false);
      toast.success(t('Profil mis à jour'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('Impossible de mettre à jour le profil.')),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      updateMutation.mutate({ photo_url: file_url });
    } catch (error) {
      toast.error(error.message || t('Impossible de téléverser la photo.'));
    } finally {
      e.target.value = '';
    }
  };

  const handleInstall = async () => {
    try {
      if (!await install()) toast.message(t('Installation annulée.'));
    } catch (error) {
      toast.error(error.message || t('Impossible d’installer l’application.'));
    }
  };

  const isAppleMobile = /iPhone|iPad|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { icon: Flame, label: 'Jours consécutifs', value: user?.reading_streak || 0, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: BookOpen, label: 'Chapitres/jour', value: user?.reading_plan === '5_chapters' ? 5 : user?.reading_plan === '3_chapters' ? 3 : 1, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Award, label: 'Badges', value: user?.badges?.length || 0, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      {/* Hero / Cover */}
      <div className="relative z-10 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-purple-700 text-white">
        <img src="https://images.unsplash.com/photo-1438232992991-995b671a1b65?w=1600&q=80" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-indigo-950/75 to-primary/65" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        <div className="relative px-6 pt-12 pb-20 md:px-12">
          <p className="text-amber-300 font-bold tracking-widest text-xs uppercase mb-1">{t('Mon compte')}</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none text-white">{t('Mon Profil')}</h1>
        </div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 -mt-12 pb-12 space-y-8">
        {/* Profile Card */}
        <div className="glass-card border-gradient rounded-3xl p-6 shadow-elev-4 overflow-hidden">
          <div className="relative z-10 flex items-center gap-5">
            <div className="relative group flex-shrink-0">
              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-primary/10 ring-4 ring-white shadow-elev-3">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl font-black text-primary">{user?.full_name?.[0] || '?'}</span>
                  </div>
                )}
              </div>
              {isEditingProfile && (
                <label className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black truncate">{user?.full_name}</h2>
              <p className="text-muted-foreground text-sm truncate">{user?.email}</p>
              {user?.spiritual_role && (
                <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                  <Shield className="w-3 h-3" />
                  {t(SPIRITUAL_ROLES.find(r => r.value === user.spiritual_role)?.label || user.spiritual_role)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card rounded-3xl p-4 text-center hover:border-primary/40 transition-all duration-300">
              <div className={`w-10 h-10 rounded-2xl ${stat.bg} flex items-center justify-center mx-auto mb-3 shadow-elev-1`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{t(stat.label)}</p>
            </div>
          ))}
        </div>

        <section className="glass-card rounded-3xl p-5 space-y-3 hover:border-primary/40 transition-all duration-300">
          <div>
            <h2 className="font-black">{t('Langue de l’application')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Choisissez la langue de l’interface. Vos contenus personnels restent dans leur langue d’origine.')}
            </p>
          </div>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger aria-label={t('Langue de l’application')} className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">{t('Français')}</SelectItem>
              <SelectItem value="ln">{t('Lingala')}</SelectItem>
              <SelectItem value="kg">{t('Kituba (Munukutuba)')}</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="glass-card rounded-3xl p-5 space-y-3 hover:border-primary/40 transition-all duration-300">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black">{t('Installer UCE Connect')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {installed
                  ? t('UCE Connect est déjà installée sur cet appareil.')
                  : isAppleMobile
                    ? t('Dans Safari, touche Partager, puis Sur l’écran d’accueil et Ajouter.')
                    : canPromptInstall
                      ? t('Ajoute l’application à l’écran d’accueil pour la retrouver comme une application.')
                      : t('Dans le menu de ton navigateur, choisis Installer l’application ou Ajouter à l’écran d’accueil.')}
              </p>
            </div>
          </div>
          {!installed && canPromptInstall && !isAppleMobile && (
            <Button type="button" onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              {t('Installer l’application')}
            </Button>
          )}
        </section>

        <PushDeviceSettings />

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t('Mon espace personnel')}</p>
              <h2 className="text-2xl font-black">{t('Mon activité')}</h2>
            </div>
            <span className="text-sm text-muted-foreground">{user?.church?.name || 'Église UCE'}</span>
          </div>
          {activityError ? (
            <p role="alert" className="rounded-2xl border border-destructive/30 p-4 text-sm text-destructive">{t('Impossible de charger votre historique personnel.')}</p>
          ) : isLoadingActivity ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('Chargement de votre activité…')}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="glass-card rounded-3xl p-5 hover:border-primary/40 transition-all duration-300">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-black"><HandCoins className="h-5 w-5 text-amber-500" />{t('Mes dons')}</h3>
                  <Link to="/donations" className="text-sm font-bold text-primary hover:underline">{t('Voir les dons')}</Link>
                </div>
                {activity?.donations?.length ? (
                  <ul className="space-y-3">
                    {activity.donations.slice(0, 8).map((donation) => (
                      <li key={donation.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{donation.type || 'Contribution'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(donation.created_at).toLocaleDateString('fr-FR')} · {donation.status || 'En attente'}</p>
                        </div>
                        <span className="shrink-0 font-black">{Number(donation.amount || 0).toLocaleString('fr-FR')} {donation.currency || user?.church?.currency || 'XAF'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">{t('Aucun don associé à votre profil.')}</p>}
              </section>

              <section className="glass-card rounded-3xl p-5 hover:border-primary/40 transition-all duration-300">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-black"><BookOpen className="h-5 w-5 text-indigo-500" />{t('Mes cours bibliques')}</h3>
                  <Link to="/studies" className="text-sm font-bold text-primary hover:underline">{t('Ouvrir les formations')}</Link>
                </div>
                {activity?.lessons?.length ? (
                  <ul className="space-y-3">
                    {activity.lessons.slice(0, 8).map((lesson) => (
                      <li key={lesson.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                        <p className="font-semibold">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">{lesson.group_title}{lesson.scripture ? ` · ${lesson.scripture}` : ''} · {new Date(lesson.created_at).toLocaleDateString('fr-FR')}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">{t('Aucun cours privé ne vous a encore été attribué.')}</p>}
              </section>

              <section className="glass-card rounded-3xl p-5 lg:col-span-2 hover:border-primary/40 transition-all duration-300">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-black"><CalendarClock className="h-5 w-5 text-primary" />{t('Mon historique')}</h3>
                  <Link to="/journal" className="text-sm font-bold text-primary hover:underline">{t('Mon journal')}</Link>
                </div>
                {activity?.journal?.length || activity?.prayers?.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {[...(activity.journal || []).map((item) => ({ ...item, activityType: 'journal' })),
                      ...(activity.prayers || []).map((item) => ({ ...item, activityType: 'prayer' }))]
                      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
                      .slice(0, 10)
                      .map((item) => (
                        <li key={`${item.activityType}-${item.id}`} className="rounded-2xl bg-muted/50 p-3">
                          <p className="flex items-center gap-2 font-semibold">
                            {item.activityType === 'journal' ? <BookOpen className="h-4 w-4 text-primary" /> : <Heart className="h-4 w-4 text-rose-500" />}
                            {item.title || t(item.activityType === 'journal' ? 'Entrée de journal' : 'Demande de prière')}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content || item.scripture || ''}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString('fr-FR')}</p>
                        </li>
                      ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">{t('Votre journal et vos demandes de prière apparaîtront ici.')}</p>}
              </section>
            </div>
          )}
        </section>

        {/* Form */}
        <div className="glass-card border-gradient rounded-3xl p-6 space-y-5 shadow-elev-4 overflow-hidden">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-black text-lg">{t('Informations personnelles')}</h3>
            {!isEditingProfile && (
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsEditingProfile(true)}>
                <Pencil className="mr-2 h-4 w-4" />{t('Modifier mes informations')}
              </Button>
            )}
          </div>

          {isEditingProfile ? (
            <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">{t('Téléphone')}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+242..." className="h-11 rounded-2xl focus-ring-custom" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">{t('Âge')}</Label>
              <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: parseInt(e.target.value) || '' })} className="h-11 rounded-2xl focus-ring-custom" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">{t('Pays')}</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="République du Congo" className="h-11 rounded-2xl focus-ring-custom" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">{t('Ville')}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Brazzaville" className="h-11 rounded-2xl focus-ring-custom" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">{t('Sexe')}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className="h-11 rounded-2xl focus-ring-custom"><SelectValue placeholder={t('Choisir')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Homme</SelectItem>
                  <SelectItem value="female">Femme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Rôle spirituel</Label>
              <Select value={form.spiritual_role} onValueChange={(v) => setForm({ ...form, spiritual_role: v })}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPIRITUAL_ROLES.map(r => (<SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">{t('Communauté UCE')}</Label>
            <Select value={form.community_id} onValueChange={(v) => setForm({ ...form, community_id: v })}>
              <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder={t('Choisir une communauté')} /></SelectTrigger>
              <SelectContent>
                {communities.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">{t('Plan de lecture quotidien')}</Label>
            <Select value={form.reading_plan} onValueChange={(v) => setForm({ ...form, reading_plan: v })}>
              <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1_chapter">{t('1 chapitre / jour')}</SelectItem>
                <SelectItem value="3_chapters">{t('3 chapitres / jour')}</SelectItem>
                <SelectItem value="5_chapters">{t('5 chapitres / jour')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">{t('Bio')}</Label>
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t('Parle-nous de toi...')} rows={3} className="rounded-2xl resize-none focus-ring-custom" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl h-11 flex-1"
              disabled={updateMutation.isPending}
              onClick={() => {
                if (user) {
                  setForm({
                    phone: user.phone || '',
                    country: user.country || '',
                    city: user.city || '',
                    gender: user.gender || '',
                    age: user.age || '',
                    spiritual_role: user.spiritual_role || 'member',
                    bio: user.bio || '',
                    community_id: user.community_id || '',
                    reading_plan: user.reading_plan || '1_chapter',
                  });
                }
                setIsEditingProfile(false);
              }}
            >
              <X className="w-4 h-4 mr-2" />{t('Annuler')}
            </Button>
            <Button
              type="button"
              className="rounded-2xl h-11 flex-1 font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-elev-3 hover:shadow-elev-4 hover:-translate-y-0.5"
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" /> {t('Enregistrer')}
            </Button>
          </div>
            </>
          ) : (
            <div className="glass-card rounded-3xl p-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Téléphone', user?.phone],
                  ['Âge', user?.age],
                  ['Pays', user?.country],
                  ['Ville', user?.city],
                  ['Sexe', user?.gender === 'male' ? 'Homme' : user?.gender === 'female' ? 'Femme' : ''],
                  ['Rôle spirituel', SPIRITUAL_ROLES.find((role) => role.value === user?.spiritual_role)?.label || user?.spiritual_role],
                  ['Communauté UCE', communities.find((community) => community.id === user?.community_id)?.name],
                  ['Plan de lecture quotidien', user?.reading_plan === '5_chapters' ? '5 chapitres / jour' : user?.reading_plan === '3_chapters' ? '3 chapitres / jour' : '1 chapitre / jour'],
                ].filter(([, value]) => value).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-muted-foreground">{t(label)}</dt>
                    <dd className="mt-1 font-medium">{t(String(value))}</dd>
                  </div>
                ))}
                {user?.bio && <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">{t('Bio')}</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{user.bio}</dd></div>}
              </dl>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" className="rounded-2xl h-11 hover:border-primary/40 transition-all" onClick={() => appClient.auth.logout()}>
            <LogOut className="w-4 h-4 mr-2" /> {t('Déconnexion')}
          </Button>
        </div>
      </div>
    </div>
  );
}