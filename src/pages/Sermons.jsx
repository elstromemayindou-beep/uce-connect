import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appClient } from '@/api/appClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Play, Clock, Video, Headphones, FileText, Music2, GraduationCap, Flame, Radio, BookOpen, Download, LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeUp } from '@/components/ui/AnimatedPage';

const typeLabels = {
  preaching: 'Prédication',
  course: 'Cours',
  testimony: 'Témoignage',
  worship: 'Louange',
  live: 'Direct',
};
const typeColors = {
  preaching: 'bg-primary/10 text-primary',
  course: 'bg-green-500/15 text-green-600',
  testimony: 'bg-amber-500/15 text-amber-600',
  worship: 'bg-purple-500/15 text-purple-600',
  live: 'bg-red-500/15 text-red-600',
};
const fallbackImage = 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=900&q=80';
const categoryDetails = {
  affirmation: {
    title: 'Affermissement',
    subtitle: 'Parcours de croissance pour les nouveaux convertis',
    icon: Flame,
    tone: 'from-green-700/90 to-emerald-600/80',
  },
  formation: {
    title: 'Formation',
    subtitle: 'Cours pour les serviteurs et responsables',
    icon: GraduationCap,
    tone: 'from-amber-700/90 to-orange-600/80',
  },
};

async function downloadSermonFile(url, title, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Impossible de télécharger ce fichier.');
  const blob = await response.blob();
  const contentTypeExtension = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  }[blob.type];
  const pathExtension = new URL(url, window.location.href).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const extension = contentTypeExtension || pathExtension || type;
  const filename = `${(title || 'predication').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'predication'}.${extension}`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function MediaCard({ item, onSelect }) {
  return (
    <motion.button
      type="button"
      variants={staggerItem}
      whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)' }}
      className="glass-card group w-full overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-elev-4 transition-all duration-300"
      onClick={() => onSelect(item)}
    >
      <div className="relative h-56 bg-primary/5 overflow-hidden group-hover:scale-105 transition-transform duration-300">
        <img
          src={item.thumbnail_url || fallbackImage}
          alt=""
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          onError={(event) => { event.currentTarget.src = fallbackImage; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-70" />
        <div className="absolute bottom-4 left-4">
          <span className={`bg-accent text-accent-foreground rounded-xl px-3 py-1 text-xs font-bold shadow-elev-1 ${typeColors[item.type]}`}>{typeLabels[item.type] || item.type}</span>
        </div>
        <div className="absolute bottom-4 right-4">
          <div className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <Play className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-lg leading-tight mb-3 text-foreground">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium">{item.speaker || item.scripture || 'UCE'}</span>
          {item.duration_minutes > 0 && <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{item.duration_minutes} min</span>}
        </div>
      </div>
    </motion.button>
  );
}

function ContentSection({ category, items, onSelect }) {
  const details = categoryDetails[category];
  const Icon = details.icon;
  return (
    <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}>
      <div className="relative mb-5 h-40 overflow-hidden rounded-3xl">
        <img src={fallbackImage} alt="" className="h-full w-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-r ${details.tone}`} />
        <div className="absolute inset-0 flex items-center gap-4 px-6">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 backdrop-blur-sm">
            <Icon className="h-7 w-7 text-white" />
          </span>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/70">{details.subtitle}</p>
            <h2 className="text-2xl font-black uppercase leading-none tracking-tight text-white">{details.title}</h2>
            <p className="mt-2 text-sm text-white/80">{items.length} contenu(s) publié(s)</p>
          </div>
        </div>
      </div>
      {items.length ? (
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-3 md:grid-cols-2">
          {items.map((item) => <MediaCard key={item.id} item={item} onSelect={onSelect} />)}
        </motion.div>
      ) : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Aucun contenu publié dans cette catégorie pour le moment.</p>}
    </motion.section>
  );
}

export default function Sermons() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState('');
  const { data: sermons = [], isLoading, isError } = useQuery({
    queryKey: ['sermons'],
    queryFn: () => appClient.entities.Sermon.list('-created_date', 200),
  });
  const matchesSearch = (sermon) => {
    const text = `${sermon.title || ''} ${sermon.speaker || ''} ${sermon.scripture || ''} ${sermon.series_name || ''}`.toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase());
  };
  const publicSermons = sermons.filter((item) => (
    (!item.category || item.category === 'sermon')
    && (typeFilter === 'all' || item.type === typeFilter)
    && matchesSearch(item)
  ));
  const filteredCategory = (category) => sermons.filter((item) => item.category === category && matchesSearch(item));
  const series = [...new Set(publicSermons.filter((item) => item.series_name).map((item) => item.series_name))];
  const handleDownload = async (url, type) => {
    if (!selected || downloadingFile) return;
    setDownloadingFile(type);
    try {
      await downloadSermonFile(url, selected.title, type);
      toast.success('Téléchargement lancé.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Le téléchargement a échoué. Vérifiez votre connexion puis réessayez.');
    } finally {
      setDownloadingFile('');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden text-white">
        <img
          src="https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1200&q=80"
          alt="Sermon"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 pointer-events-none" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }} className="relative flex h-full items-end justify-between gap-4 px-6 py-12 md:px-12 md:py-16">
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-400 shadow-md">Médiathèque</p>
            <h1 className="text-5xl font-black uppercase tracking-tight text-white md:text-6xl leading-none shadow-lg shadow-black/40">Prédications</h1>
            <p className="mt-2 text-white/90 text-lg leading-relaxed shadow-md shadow-black/30">Vidéos, audios, directs, formation et affermissement</p>
          </div>
        </motion.div>
      </motion.div>

      <main className="relative z-10 mx-auto max-w-5xl space-y-10 p-4 md:p-8">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40">
              <Search className="w-4 h-4" />
            </div>
            <Input placeholder="Rechercher…" className="pl-10 h-11 rounded-2xl" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-11 w-44 rounded-2xl"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="preaching">Prédications</SelectItem>
              <SelectItem value="course">Cours</SelectItem>
              <SelectItem value="testimony">Témoignages</SelectItem>
              <SelectItem value="worship">Louange</SelectItem>
              <SelectItem value="live">Directs</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {series.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">Séries</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {series.map((name) => <button key={name} type="button" onClick={() => setSearch(name)} className="flex-shrink-0 rounded-2xl border border-border bg-card px-5 py-3 text-left transition hover:border-amber-400">
                <span className="block text-sm font-bold">{name}</span><span className="text-xs text-muted-foreground">{publicSermons.filter((item) => item.series_name === name).length} éléments</span>
              </button>)}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-black">Prédications et médias</h2>
          {isLoading ? <p className="py-12 text-center text-muted-foreground">Chargement des contenus…</p>
            : isError ? <p role="alert" className="rounded-2xl border border-destructive/30 p-5 text-destructive">Impossible de charger la médiathèque.</p>
              : publicSermons.length ? <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-5 md:grid-cols-2">{publicSermons.map((item) => <MediaCard key={item.id} item={item} onSelect={setSelected} />)}</motion.div>
                : <div className="py-12 text-center text-muted-foreground"><Music2 className="mx-auto mb-4 h-16 w-16 opacity-20" /><p className="text-lg font-semibold">Aucune prédication trouvée</p></div>}
        </section>

        <ContentSection category="affirmation" items={filteredCategory('affirmation')} onSelect={setSelected} />
        <ContentSection category="formation" items={filteredCategory('formation')} onSelect={setSelected} />
      </main>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg rounded-3xl shadow-elev-4 overflow-hidden">
          <DialogHeader className="bg-primary/5 p-6 border-b border-border/50">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-black">{selected?.title}</DialogTitle>
              {selected?.type && <span className={`px-3 py-1 rounded-full text-xs font-bold ${typeColors[selected.type] || 'bg-primary/10 text-primary'} backdrop-blur-sm`}>{typeLabels[selected.type] || selected.type}</span>}
            </div>
          </DialogHeader>
          {selected && <div className="p-6 space-y-5">
            {selected.speaker && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-bold text-foreground">Parleur :</span> {selected.speaker}
              </div>
            )}
            {selected.scripture && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-bold text-foreground">Écriture :</span> <span className="text-primary font-medium">{selected.scripture}</span>
              </div>
            )}
            {selected.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{selected.description}</p>}
            {selected.ai_summary && (
              <div className="glass-card rounded-3xl p-5 border border-primary/40">
                <p className="mb-2 text-sm font-bold text-primary flex items-center gap-1">
                  <BookOpen className="w-4 h-4" /> Résumé
                </p>
                <p className="text-sm">{selected.ai_summary}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {selected.video_url && <Button asChild className="rounded-xl flex-1 bg-gradient-to-r from-accent to-primary text-accent-foreground font-bold shadow-elev-2 hover:shadow-elev-3"><a href={selected.video_url} target="_blank" rel="noopener noreferrer"><Video className="mr-2 h-4 w-4" />Vidéo</a></Button>}
              {selected.audio_url && <Button variant="outline" asChild className="rounded-xl flex-1"><a href={selected.audio_url} target="_blank" rel="noopener noreferrer"><Headphones className="mr-2 h-4 w-4" />Audio</a></Button>}
              {selected.stream_url && <Button variant="outline" asChild className="rounded-xl flex-1"><a href={selected.stream_url} target="_blank" rel="noopener noreferrer"><Radio className="mr-2 h-4 w-4" />Suivre le direct</a></Button>}
              {selected.pdf_url && <Button variant="outline" asChild className="rounded-xl flex-1"><a href={selected.pdf_url} target="_blank" rel="noopener noreferrer"><FileText className="mr-2 h-4 w-4" />PDF</a></Button>}
              {selected.docx_url && <Button variant="outline" asChild className="rounded-xl flex-1"><a href={selected.docx_url} target="_blank" rel="noopener noreferrer"><FileText className="mr-2 h-4 w-4" />DOCX</a></Button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.audio_url && (
                <Button type="button" size="sm" variant="outline" disabled={Boolean(downloadingFile)} onClick={() => handleDownload(selected.audio_url, 'mp3')}>
                  {downloadingFile === 'mp3' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Télécharger l’audio
                </Button>
              )}
              {selected.pdf_url && (
                <Button type="button" size="sm" variant="outline" disabled={Boolean(downloadingFile)} onClick={() => handleDownload(selected.pdf_url, 'pdf')}>
                  {downloadingFile === 'pdf' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Télécharger le PDF
                </Button>
              )}
              {selected.docx_url && (
                <Button type="button" size="sm" variant="outline" disabled={Boolean(downloadingFile)} onClick={() => handleDownload(selected.docx_url, 'docx')}>
                  {downloadingFile === 'docx' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Télécharger le DOCX
                </Button>
              )}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
