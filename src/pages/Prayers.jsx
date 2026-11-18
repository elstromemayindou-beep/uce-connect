import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Plus, Send, CheckCircle2, LockKeyhole } from 'lucide-react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Prayers() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: prayers = [], isLoading } = useQuery({
    queryKey: ['prayers'],
    queryFn: () => appClient.entities.PrayerRequest.list('-created_date', 100),
  });

  const createMutation = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: (data) => appClient.entities.PrayerRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayers'] });
      setContent(''); setIsPrivate(false); setShowForm(false);
      toast.success('Demande de prière publiée');
    },
    onError: (error) => toast.error(error.message || 'Impossible de publier cette demande.'),
  });

  const prayMutation = useMutation({
    /** @param {{ id: string, prayed_by?: string[], prayer_count?: number }} prayer */
    mutationFn: async (prayer) => {
      const prayed = prayer.prayed_by || [];
      if (prayed.includes(user?.id)) return;
      await appClient.entities.PrayerRequest.update(prayer.id, {
        prayer_count: (prayer.prayer_count || 0) + 1,
        prayed_by: [...prayed, user?.id],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }),
  });

  const resolveMutation = useMutation({
    /** @param {string} id */
    mutationFn: (id) => appClient.entities.PrayerRequest.update(id, { status: 'answered' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayers'] }),
    onError: (error) => toast.error(error.message || 'Impossible de mettre à jour cette demande.'),
  });

  const activePrayers = prayers.filter(p => p.status !== 'answered');
  const answeredPrayers = prayers.filter(p => p.status === 'answered');
  const myPrayers = prayers.filter((prayer) => prayer.created_by === user?.id);
  const hasPrayed = (prayer) => prayer.prayed_by?.includes(user?.id);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      {/* Hero avec image de fond */}
      <div className="relative z-10 min-h-[24rem] overflow-hidden text-white">
        <img
          src="/prayer-wall-background.jpg"
          alt="Prière"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative flex h-full items-end justify-between gap-4 px-6 py-12 md:px-12 md:py-16">
          <div className="mb-8">
            <p className="text-amber-400 font-bold tracking-widest text-xs uppercase mb-2 shadow-md">Intercession</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight leading-none text-white shadow-lg shadow-black/40">Mur de Prière</h1>
            <p className="text-white/90 mt-3 text-lg leading-relaxed shadow-md shadow-black/30">Priez les uns pour les autres, portez les fardeaux les uns des autres</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="shrink-0 gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-elev-3 hover:shadow-elev-4 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouvelle demande</span><span className="sm:hidden">Nouvelle</span>
          </Button>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-3xl mx-auto">
        <Tabs defaultValue="active">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-muted p-1 mb-6">
            <TabsTrigger value="active" className="flex-1 rounded-xl font-semibold">
              Actives ({activePrayers.length})
            </TabsTrigger>
            <TabsTrigger value="answered" className="flex-1 rounded-xl font-semibold">
              Exaucées ({answeredPrayers.length})
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1 rounded-xl font-semibold">Mes demandes ({myPrayers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activePrayers.length === 0 && !isLoading ? (
              <div className="text-center py-20 text-muted-foreground">
                <Heart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-semibold text-lg">Aucune demande active</p>
                <p className="text-sm mt-1">Soyez le premier à partager</p>
              </div>
            ) : activePrayers.map((prayer, i) => (
              <motion.div key={prayer.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-card border border-border/50 rounded-3xl p-5 hover:shadow-md transition-all">
                <p className="text-sm leading-relaxed mb-4">{prayer.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {prayer.is_anonymous ? '?' : prayer.author_name?.[0] || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{prayer.is_anonymous ? 'Anonyme' : prayer.author_name}</p>
                      {prayer.created_date && (
                        <p className="text-xs text-muted-foreground">{format(new Date(prayer.created_date), 'd MMM', { locale: fr })}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => prayMutation.mutate(prayer)}
                    disabled={hasPrayed(prayer)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                      hasPrayed(prayer)
                        ? 'bg-red-100 text-red-600'
                        : 'bg-muted hover:bg-red-50 hover:text-red-500 text-muted-foreground'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${hasPrayed(prayer) ? 'fill-red-500 text-red-500' : ''}`} />
                    {prayer.prayer_count || 0}
                  </button>
                </div>
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="answered" className="space-y-4">
            {answeredPrayers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-semibold text-lg">Aucune prière exaucée</p>
              </div>
            ) : answeredPrayers.map((prayer) => (
              <div key={prayer.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-bold text-green-600">Prière exaucée !</span>
                </div>
                <p className="text-sm">{prayer.content}</p>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="mine" className="space-y-4">
            {myPrayers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
                <Heart className="mx-auto mb-3 h-12 w-12 opacity-25" />
                <p className="font-bold">Vous n’avez pas encore publié de demande</p>
              </div>
            ) : myPrayers.map((prayer) => (
              <article key={prayer.id} className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${prayer.status === 'answered' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                    {prayer.status === 'answered' ? 'Exaucée' : 'En cours'}
                  </span>
                  {prayer.is_private && <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-600"><LockKeyhole className="h-3 w-3" />Privée</span>}
                  {prayer.created_date && <span className="text-xs text-muted-foreground">{format(new Date(prayer.created_date), 'd MMM yyyy', { locale: fr })}</span>}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{prayer.content}</p>
                {prayer.status !== 'answered' && (
                  <Button type="button" size="sm" variant="outline" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate(prayer.id)} className="mt-4 gap-2 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />Marquer comme exaucée
                  </Button>
                )}
              </article>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* New prayer dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Nouvelle demande de prière</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Partagez votre sujet de prière..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="rounded-2xl resize-none"
            />
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50">
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              <Label className="cursor-pointer">Publier anonymement</Label>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              <div className="min-w-0">
                <Label className="flex cursor-pointer items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" />Garder cette demande privée</Label>
                <p className="mt-1 text-xs text-muted-foreground">Visible seulement par vous et les responsables de l’église.</p>
              </div>
            </div>
            <Button
              className="w-full rounded-2xl h-11 font-bold bg-amber-500 hover:bg-amber-400 text-black"
              onClick={() => createMutation.mutate({
                content, is_anonymous: isAnonymous, is_private: isPrivate,
                author_name: isAnonymous ? 'Anonyme' : user?.full_name,
                status: 'active', prayer_count: 0, prayed_by: [],
              })}
              disabled={!content.trim() || createMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />Publier ma demande
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
