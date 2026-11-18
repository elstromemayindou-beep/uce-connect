import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Heart, BookOpen, Sparkles, Lock, Star, Feather, Sun, Moon } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const typeConfig = {
  prayer:        { label: 'Prière',              icon: Heart,    gradient: 'from-rose-500 to-red-600',      bg: 'bg-rose-500/10 text-rose-600',    placeholder: 'Partagez votre cœur avec Dieu... Priez librement.' },
  reflection:    { label: 'Réflexion',            icon: Pencil,   gradient: 'from-blue-500 to-indigo-600',   bg: 'bg-blue-500/10 text-blue-600',    placeholder: 'Qu\'est-ce que Dieu vous a parlé aujourd\'hui ?' },
  gratitude:     { label: 'Gratitude',            icon: Sparkles, gradient: 'from-amber-500 to-yellow-500',  bg: 'bg-amber-500/10 text-amber-600',  placeholder: 'Pour quoi êtes-vous reconnaissant envers Dieu ?' },
  reading_note:  { label: 'Note de lecture',     icon: BookOpen, gradient: 'from-green-500 to-emerald-600', bg: 'bg-green-500/10 text-green-600',  placeholder: 'Quel passage vous a touché ? Notez vos révélations...' },
  god_encounter: { label: 'Rencontre avec Dieu', icon: Star,     gradient: 'from-violet-500 to-purple-700', bg: 'bg-violet-500/10 text-violet-600', placeholder: 'Racontez cette expérience unique avec Dieu... Un moment de présence, une parole reçue, un signe...' },
};

const moodConfig = {
  joyful:   { label: 'Joyeux',        emoji: '😊', color: 'text-yellow-500' },
  peaceful: { label: 'En paix',       emoji: '😌', color: 'text-blue-500' },
  grateful: { label: 'Reconnaissant', emoji: '🙏', color: 'text-amber-500' },
  seeking:  { label: 'En recherche',  emoji: '🔍', color: 'text-indigo-500' },
  heavy:    { label: 'Lourd',         emoji: '😔', color: 'text-slate-500' },
};

const timeOfDay = () => {
  const h = new Date().getHours();
  if (h < 6) return { icon: Moon, label: 'Nuit' };
  if (h < 12) return { icon: Sun, label: 'Matin' };
  if (h < 18) return { icon: Sun, label: 'Après-midi' };
  return { icon: Moon, label: 'Soir' };
};

const inspirations = [
  '"Cherchez l\'Éternel et sa force, cherchez toujours sa face." — Ps 105:4',
  '"Ma grâce te suffit, car ma puissance s\'accomplit dans la faiblesse." — 2 Cor 12:9',
  '"L\'Éternel est mon berger, je ne manquerai de rien." — Ps 23:1',
  '"Approchez-vous de Dieu, et il s\'approchera de vous." — Jac 4:8',
  '"Je suis avec vous tous les jours, jusqu\'à la fin du monde." — Mt 28:20',
];

export default function Journal() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'prayer', mood: '' });
  const [inspiration] = useState(() => inspirations[Math.floor(Math.random() * inspirations.length)]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journal'],
    queryFn: () => appClient.entities.JournalEntry.list('-created_date', 100),
  });

  const createMutation = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: (data) => appClient.entities.JournalEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      setShowForm(false);
      setForm({ title: '', content: '', type: 'prayer', mood: '' });
      toast.success('✨ Entrée sauvegardée');
    },
  });

  const openForm = (type = 'prayer') => {
    setForm({ title: '', content: '', type, mood: '' });
    setShowForm(true);
  };

  const prayerEntries = entries.filter(e => e.type !== 'god_encounter');
  const godEncounters = entries.filter(e => e.type === 'god_encounter');
  const Time = timeOfDay();

  return (
    <div className="min-h-screen bg-background">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
        <img
          src="https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=1200&q=80"
          alt="Journal"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/90 via-purple-800/85 to-indigo-900/90" />
        {/* Stars decoration */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-white/40 rounded-full animate-pulse"
              style={{ top: `${Math.random() * 80}%`, left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s` }}
            />
          ))}
        </div>
        <div className="relative z-10 px-6 py-10 md:px-12 text-white min-h-[280px] flex flex-col justify-between">
          <div className="flex items-center gap-2 text-white/50 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" /> Espace privé & sécurisé
          </div>
          <div>
            <p className="text-amber-400 font-bold tracking-[0.2em] text-xs uppercase mb-2">Vie spirituelle</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tight leading-none text-white mb-2">Journal</h1>
            <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tight leading-none text-violet-300 mb-4">Spirituel</h2>
            <p className="text-white/60 text-sm max-w-sm italic">"{inspiration}"</p>
          </div>
        </div>
      </div>

      {/* ── QUICK WRITE BAR ── */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => openForm('prayer')}
            className="w-full flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-4 py-3 text-muted-foreground hover:border-violet-400/50 hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
              <Feather className="w-4 h-4 text-violet-500" />
            </div>
            <span className="flex-1 text-left text-sm">Écrire une entrée du jour…</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground/60 bg-muted px-2 py-1 rounded-lg">
              <Time.icon className="w-3 h-3" />{Time.label}
            </div>
          </button>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">

        {/* ── QUICK ACTION CARDS ── */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {Object.entries(typeConfig).map(([k, v], index) => {
            const Ic = v.icon;
            return (
              <button
                key={k}
                onClick={() => openForm(k)}
                className={`group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-3 text-left shadow-elev-1 transition duration-300 hover:-translate-y-1 hover:shadow-elev-3 sm:min-h-32 sm:rounded-3xl sm:p-4 ${index === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <span aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${v.gradient} opacity-[0.08] transition-opacity group-hover:opacity-[0.16]`} />
                <span className="relative flex w-full items-start justify-between gap-2">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${v.bg}`}><Ic className="h-5 w-5" /></span>
                  <Plus className="h-4 w-4 text-muted-foreground transition group-hover:rotate-90 group-hover:text-primary" />
                </span>
                <span className="relative mt-3 text-xs font-extrabold text-foreground sm:text-sm">{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TABS ── */}
        {entries.length === 0 && !isLoading ? (
          <EmptyState onWrite={() => openForm('prayer')} />
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="w-full h-12 rounded-2xl bg-muted">
              <TabsTrigger value="all" className="flex-1 rounded-xl font-semibold text-xs">Tout ({entries.length})</TabsTrigger>
              <TabsTrigger value="encounters" className="flex-1 rounded-xl font-semibold text-xs">
                ✨ Rencontres ({godEncounters.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {prayerEntries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
              {prayerEntries.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">Pas encore d'entrées ici.</div>
              )}
            </TabsContent>

            <TabsContent value="encounters" className="space-y-4 mt-4">
              {godEncounters.length === 0 ? (
                <EncounterEmptyState onWrite={() => openForm('god_encounter')} />
              ) : godEncounters.map((entry) => <EntryCard key={entry.id} entry={entry} highlight />)}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── WRITE DIALOG ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="rounded-3xl max-w-lg overflow-hidden p-0">
          {/* Dialog header with gradient */}
          <div className={`bg-gradient-to-r ${typeConfig[form.type]?.gradient || 'from-violet-500 to-purple-700'} p-5`}>
            <div className="flex items-center gap-3">
              {(() => { const Ic = typeConfig[form.type]?.icon || Pencil; return <Ic className="w-6 h-6 text-white" />; })()}
              <div>
                <h2 className="text-white font-black text-lg">{typeConfig[form.type]?.label}</h2>
                <p className="text-white/60 text-xs">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Type selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {Object.entries(typeConfig).map(([k, v]) => {
                const Ic = v.icon;
                return (
                  <button
                    key={k}
                    onClick={() => setForm({ ...form, type: k })}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${form.type === k ? `${v.bg} border-transparent shadow-sm` : 'border-border bg-muted/50 hover:border-primary/30'}`}
                  >
                    <Ic className="w-3.5 h-3.5" />{v.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Titre (optionnel)..."
                className="h-11 rounded-2xl font-semibold text-base border-0 bg-muted/50 focus-visible:ring-1"
              />
            </div>

            <div className="space-y-1.5">
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={typeConfig[form.type]?.placeholder || 'Écrivez ici...'}
                rows={form.type === 'god_encounter' ? 7 : 5}
                className="rounded-2xl resize-none border-0 bg-muted/50 focus-visible:ring-1 leading-relaxed"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-sm">Comment vous sentez-vous ?</Label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(moodConfig).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setForm({ ...form, mood: form.mood === k ? '' : k })}
                    className={`px-3 py-2 rounded-xl text-sm border transition-all ${form.mood === k ? 'bg-primary text-white border-primary shadow-sm' : 'border-border hover:border-primary/40 bg-muted/50'}`}
                  >
                    {v.emoji} <span className="text-xs font-medium ml-1">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-2xl font-bold bg-amber-500 hover:bg-amber-400 text-black text-base shadow-lg"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.content.trim() || createMutation.isPending}
            >
              <Feather className="w-4 h-4 mr-2" />
              {createMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder mon entrée'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryCard({ entry, highlight = false }) {
  const config = typeConfig[entry.type] || typeConfig.prayer;
  const Icon = config.icon;
  const mood = moodConfig[entry.mood];

  return (
    <div className={`relative bg-card border rounded-3xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${highlight ? 'border-violet-300/50 shadow-violet-500/10 shadow-md' : 'border-border/50'}`}>
      <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />
      {highlight && (
        <div className="absolute top-4 right-4">
          <span className="bg-violet-500/10 text-violet-600 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3 fill-violet-500" /> Rencontre
          </span>
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${config.bg}`}>{config.label}</span>
          {mood && <span className="text-base">{mood.emoji}</span>}
          <span className="text-xs text-muted-foreground ml-auto">
            {entry.created_date && format(new Date(entry.created_date), 'd MMM yyyy', { locale: fr })}
          </span>
        </div>
        {entry.title && <h3 className="font-black text-base mb-2">{entry.title}</h3>}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">{entry.content}</p>
      </div>
    </div>
  );
}

function EmptyState({ onWrite }) {
  return (
    <div className="text-center py-16">
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
          <Feather className="w-12 h-12 text-violet-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-black" />
        </div>
      </div>
      <h3 className="text-2xl font-black mb-2">Votre journal vous attend</h3>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
        Un espace sacré pour dialoguer avec Dieu, noter vos révélations et tracer votre parcours spirituel.
      </p>
      <Button onClick={onWrite} className="rounded-2xl font-bold bg-amber-500 hover:bg-amber-400 text-black px-8 h-12 shadow-lg">
        <Feather className="w-4 h-4 mr-2" /> Écrire ma première entrée
      </Button>
    </div>
  );
}

function EncounterEmptyState({ onWrite }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
        <Star className="w-10 h-10 text-violet-400" />
      </div>
      <h3 className="text-xl font-black mb-2">Aucune rencontre notée</h3>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-5">
        Avez-vous vécu un moment fort avec Dieu ? Une parole reçue, un miracle, une présence ressentie ? Notez-le ici !
      </p>
      <Button onClick={onWrite} className="rounded-2xl font-bold bg-violet-600 hover:bg-violet-500 text-white px-6">
        <Star className="w-4 h-4 mr-2" /> Raconter une rencontre
      </Button>
    </div>
  );
}