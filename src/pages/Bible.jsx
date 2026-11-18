import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, ChevronLeft, ChevronRight, LoaderCircle, CheckCircle2, CalendarDays, WifiOff, RotateCcw } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/I18nContext';
import { Progress } from '@/components/ui/progress';
import { fetchAndCacheBibleValue } from '@/lib/offlineBible';
import { usePwa } from '@/lib/PwaContext';

const psalmDays = [1, 3, 8, 16, 19, 23, 27, 34, 37, 40, 42, 46, 51, 63, 84, 91, 100, 103, 107, 119, 121, 126, 127, 130, 136, 139, 145, 146, 148, 150];
const readingPlans = [
  {
    id: 'hope', title: '7 jours de paix et d’espérance', description: 'Des passages pour retrouver courage, paix et confiance.', days: [
      ['JHN', 1], ['PSA', 23], ['ROM', 8], ['MAT', 5], ['PHP', 4], ['ISA', 40], ['ROM', 12],
    ],
  },
  {
    id: 'jesus', title: '21 jours pour découvrir Jésus', description: 'Un parcours à travers les Évangiles et les paroles de Jésus.', days: [
      ['MRK', 1], ['MRK', 2], ['MRK', 4], ['MRK', 5], ['MRK', 6], ['MRK', 8], ['MRK', 9],
      ['MRK', 10], ['MRK', 12], ['MRK', 14], ['MRK', 15], ['MRK', 16], ['JHN', 2], ['JHN', 3],
      ['JHN', 4], ['JHN', 6], ['JHN', 10], ['JHN', 11], ['JHN', 13], ['JHN', 15], ['JHN', 20],
    ],
  },
  {
    id: 'psalms', title: '30 jours dans les Psaumes', description: 'Des prières et des chants pour chaque jour du mois.', days: psalmDays.map((chapter) => ['PSA', chapter]),
  },
];

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dayNumber(startedOn) {
  const start = Date.parse(`${startedOn}T00:00:00Z`);
  const today = Date.parse(`${todayString()}T00:00:00Z`);
  return Math.max(1, Math.floor((today - start) / 86_400_000) + 1);
}

export default function Bible() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { online } = usePwa();
  const [language, setLanguage] = useState('fr');
  const [bookId, setBookId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const { data: versions = [], isLoading: isLoadingVersions, isError: versionsError } = useQuery({
    queryKey: ['bible-versions'],
    queryFn: () => fetchAndCacheBibleValue('versions', () => appClient.bible.versions()),
    retry: false,
  });
  const { data: books = [], isLoading: isLoadingBooks, isError: booksError } = useQuery({
    queryKey: ['bible-books', language],
    queryFn: () => fetchAndCacheBibleValue(`books:${language}`, () => appClient.bible.books(language)),
    enabled: versions.length > 0,
    retry: false,
  });
  const { data: chapters = [], isLoading: isLoadingChapters, isError: chaptersError } = useQuery({
    queryKey: ['bible-chapters', language, bookId],
    queryFn: () => fetchAndCacheBibleValue(`chapters:${language}:${bookId}`, () => appClient.bible.chapters(language, bookId)),
    enabled: Boolean(bookId) && versions.length > 0,
    retry: false,
  });
  const { data: passage, isLoading: isLoadingPassage, isError: passageError } = useQuery({
    queryKey: ['bible-passage', language, chapterId],
    queryFn: () => fetchAndCacheBibleValue(`passage:${language}:${chapterId}`, () => appClient.bible.passage(language, chapterId)),
    enabled: Boolean(chapterId) && versions.length > 0,
    retry: false,
  });
  const search = useMutation({
    mutationFn: () => appClient.bible.search(language, searchQuery.trim()),
    onSuccess: (result) => setSearchResults(result.verses || []),
    onError: (error) => toast.error(error.message || 'Impossible de chercher dans cette Bible.'),
  });
  const saveReadingMutation = useMutation({
    mutationFn: (bible_reading) => appClient.auth.updateMe({ bible_reading }),
    onSuccess: (_result, bible_reading) => {
      queryClient.setQueryData(['me'], (current) => ({ ...current, bible_reading }));
      toast.success(bible_reading?.completed_days?.length ? 'Progression enregistrée.' : 'Votre parcours de lecture a commencé.');
    },
    onError: (error) => toast.error(error.message || 'Impossible d’enregistrer votre parcours.'),
  });
  const book = books.find((item) => item.id === bookId);
  const selectedChapterIndex = chapters.findIndex((item) => item.id === chapterId);
  const activeVersion = versions.find((version) => version.language === language);
  const readingProgress = user?.bible_reading;
  const activeReadingPlan = readingPlans.find((plan) => plan.id === readingProgress?.plan_id);
  const currentPlanDay = activeReadingPlan
    ? Math.min(dayNumber(readingProgress.started_on), activeReadingPlan.days.length)
    : 0;
  const currentPlanStep = activeReadingPlan?.days[currentPlanDay - 1];
  const currentPlanBookId = books.find((item) => item.id === currentPlanStep?.[0])?.id;
  const isViewingPlanStep = Boolean(currentPlanBookId && chapterId === `${currentPlanBookId}.${currentPlanStep?.[1]}`);
  const completedPlanDays = readingProgress?.completed_days || [];
  const planFinished = Boolean(activeReadingPlan && completedPlanDays.length >= activeReadingPlan.days.length);
  const chapterText = typeof passage?.content === 'string'
    ? passage.content
    : Array.isArray(passage?.content)
      ? passage.content.map((item) => item.text || '').join('\n')
      : '';

  useEffect(() => {
    if (!books.length) return;
    if (!books.some((item) => item.id === bookId)) {
      const defaultBook = books.find((item) => item.id === 'JHN') || books[0];
      setBookId(defaultBook.id);
      setChapterId('');
    }
  }, [books, bookId]);

  useEffect(() => {
    if (!chapters.length) return;
    if (!chapters.some((item) => item.id === chapterId)) {
      setChapterId(chapters[0].id);
    }
  }, [chapters, chapterId]);

  const moveChapter = (offset) => {
    const nextChapter = chapters[selectedChapterIndex + offset];
    if (nextChapter) setChapterId(nextChapter.id);
  };

  const beginPlan = (planId) => {
    saveReadingMutation.mutate({ plan_id: planId, started_on: todayString(), completed_days: [] });
  };

  const openPlanStep = (day = currentPlanDay) => {
    const step = activeReadingPlan?.days[day - 1];
    if (!step) return;
    const [targetBookCode, targetChapter] = step;
    const targetBook = books.find((item) => item.id === targetBookCode);
    if (!targetBook) {
      toast.error('Ce livre n’est pas disponible dans la version biblique choisie.');
      return;
    }
    setBookId(targetBook.id);
    setChapterId(`${targetBook.id}.${targetChapter}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const completePlanDay = () => {
    if (!activeReadingPlan || !currentPlanDay || !chapterText || !isViewingPlanStep) return;
    const completedDays = [...new Set([...completedPlanDays, currentPlanDay])].sort((a, b) => a - b);
    saveReadingMutation.mutate({ ...readingProgress, completed_days: completedDays });
  };

  const handleSearch = (event) => {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchResults([]);
    search.mutate();
  };

  const openSearchResult = (result) => {
    if (typeof result.id !== 'string') return;
    const [resultBook, resultChapter] = result.id.split('.');
    const matchingBook = books.find((item) => item.id === resultBook);
    if (!matchingBook || !resultChapter) return;
    setBookId(matchingBook.id);
    setChapterId(`${resultBook}.${resultChapter}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-8 p-4 md:p-8">
        <div className="relative isolate mb-6 min-h-44 overflow-hidden rounded-3xl p-6 text-white shadow-elev-3">
          <img src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1400&q=80" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-indigo-950/80 to-primary/65" />
          <div className="flex min-h-32 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 shadow-elev-1">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight text-white">{t('Bible')}</h1>
              <p className="text-sm text-white/85">{t('Lire la Bible en français ou en lingala.')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="bible-language" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('Langue')}</label>
          <Select value={language} onValueChange={(value) => { setLanguage(value); setSearchResults([]); }}>
            <SelectTrigger id="bible-language" className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">{t('Français')}</SelectItem>
              <SelectItem value="ln">Lingala</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="bible-book" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('Livre')}</label>
          <Select value={bookId} onValueChange={(value) => { setBookId(value); setChapterId(''); }}>
            <SelectTrigger id="bible-book" className="h-11 rounded-2xl"><SelectValue placeholder={t('Choisir un livre')} /></SelectTrigger>
            <SelectContent className="max-h-60">
              {books.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="bible-chapter" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('Chapitre')}</label>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger id="bible-chapter" className="h-11 rounded-2xl"><SelectValue placeholder={t('Choisir un chapitre')} /></SelectTrigger>
            <SelectContent className="max-h-60">
              {chapters.map((item) => <SelectItem key={item.id} value={item.id}>{item.number || item.id.split('.').at(-1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        </div>

      <section aria-labelledby="reading-plan-title" className="space-y-4">
        <Card className="glass-card rounded-3xl border border-primary/15 bg-card/85 p-5 shadow-elev-2 sm:p-7">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Un pas chaque jour</p>
              <h2 id="reading-plan-title" className="text-xl font-black">Parcours de lecture biblique</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choisissez un parcours, lisez le passage du jour et suivez votre progression sur votre compte.</p>
            </div>
          </div>
          {activeReadingPlan ? (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{activeReadingPlan.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{planFinished ? 'Parcours terminé — bravo pour votre régularité !' : `Jour ${currentPlanDay} sur ${activeReadingPlan.days.length}`}</p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={!online || saveReadingMutation.isPending} onClick={() => beginPlan(activeReadingPlan.id)} className="gap-1.5 rounded-xl">
                  <RotateCcw className="h-3.5 w-3.5" />Recommencer
                </Button>
              </div>
              <Progress value={Math.round((completedPlanDays.length / activeReadingPlan.days.length) * 100)} className="h-2.5" />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Lecture proposée</p>
                  <p className="mt-1 font-black">{books.find((item) => item.id === currentPlanStep?.[0])?.name || currentPlanStep?.[0]} {currentPlanStep?.[1]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={!currentPlanStep || !versions.length} onClick={() => openPlanStep()} className="rounded-xl">Ouvrir le passage</Button>
                  <Button type="button" disabled={!online || !isViewingPlanStep || !chapterText || !currentPlanDay || completedPlanDays.includes(currentPlanDay) || saveReadingMutation.isPending} onClick={completePlanDay} className="gap-2 rounded-xl">
                    <CheckCircle2 className="h-4 w-4" />{completedPlanDays.includes(currentPlanDay) ? 'Journée validée' : planFinished ? 'Parcours terminé' : 'Marquer comme lu'}
                  </Button>
                </div>
              </div>
              {!isViewingPlanStep && !planFinished && <p className="text-xs text-muted-foreground">Ouvrez le passage proposé avant de valider votre lecture.</p>}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {readingPlans.map((plan) => (
                <article key={plan.id} className="flex flex-col rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-primary">{plan.days.length} jours</p>
                  <h3 className="mt-2 font-black leading-snug">{plan.title}</h3>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>
                  <Button type="button" disabled={!online || saveReadingMutation.isPending} onClick={() => beginPlan(plan.id)} className="mt-4 rounded-xl">Commencer ce parcours</Button>
                </article>
              ))}
            </div>
          )}
          {activeReadingPlan && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {readingPlans.filter((plan) => plan.id !== activeReadingPlan.id).map((plan) => (
                <article key={plan.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div><p className="text-xs font-bold text-primary">{plan.days.length} jours</p><h3 className="mt-1 text-sm font-extrabold">{plan.title}</h3></div>
                  <Button type="button" variant="outline" size="sm" disabled={!online || saveReadingMutation.isPending} onClick={() => beginPlan(plan.id)} className="shrink-0 rounded-xl">Choisir</Button>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>

      {!online && <p role="status" className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm font-semibold text-amber-900 dark:text-amber-100"><WifiOff className="h-4 w-4 shrink-0" />Hors connexion : les versions, livres, chapitres et passages déjà consultés sont conservés sur cet appareil.</p>}

      <form className="flex gap-3" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40">
            <Search className="w-4 h-4" />
          </div>
          <Input
            placeholder={t('Rechercher un mot ou un verset…')}
            className="pl-10 h-11 rounded-2xl"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={search.isPending || !versions.length || !online} className="bg-gradient-to-r from-accent to-primary text-accent-foreground font-bold shadow-elev-2 hover:shadow-elev-3">
          {search.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : t('Chercher')}
        </Button>
      </form>

      {searchResults.length > 0 && (
        <Card className="glass-card rounded-3xl p-5 shadow-elev-2">
          <h2 className="font-bold text-foreground">{t('Résultats de recherche')}</h2>
          {searchResults.slice(0, 20).map((result) => (
            <button key={result.id || result.reference} type="button" onClick={() => openSearchResult(result)} className="w-full rounded-2xl p-3 text-left hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/40">
              <span className="font-bold text-foreground">{result.reference}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{result.text}</span>
            </button>
          ))}
        </Card>
      )}
      {!search.isPending && search.isSuccess && searchResults.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('Aucun résultat trouvé.')}</p>
      )}

      {isLoadingVersions || isLoadingBooks || isLoadingChapters ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />{t('Chargement de la Bible…')}</div>
      ) : versionsError || booksError || chaptersError ? (
        <Card role="alert" className="glass-card rounded-3xl border border-destructive/30 p-6 text-sm text-destructive shadow-elev-1">
          {versionsError
            ? t('La Bible n’est pas encore configurée. L’administrateur doit renseigner une clé API.Bible et les versions française et lingala.')
            : t('Impossible de charger cette version biblique. Réessaie plus tard.')}
        </Card>
      ) : (
        <>
          <Card className="glass-card rounded-3xl p-6 md:p-8 shadow-elev-3 border-gradient overflow-hidden">
            <div className="relative z-10">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">{activeVersion?.name || (language === 'fr' ? 'Français' : 'Lingala')}</p>
              <h2 className="mb-5 text-2xl font-black leading-tight text-foreground">{book?.name} {chapters[selectedChapterIndex]?.number || chapterId.split('.').at(-1)}</h2>
              {isLoadingPassage ? (
                <p className="py-8 text-sm text-muted-foreground">{t('Chargement du chapitre…')}</p>
              ) : passageError ? (
                <p role="alert" className="text-sm text-destructive">{t('Impossible de charger ce chapitre biblique.')}</p>
              ) : (
                <div className="whitespace-pre-wrap text-lg leading-relaxed text-foreground">{chapterText || t('Ce chapitre ne contient aucun texte disponible.')}</div>
              )}
            </div>
          </Card>
          <div className="flex justify-between gap-4">
            <Button variant="outline" onClick={() => moveChapter(-1)} disabled={selectedChapterIndex <= 0} className="rounded-2xl h-11 font-semibold">
              <ChevronLeft className="mr-2 h-4 w-4" />{t('Chapitre précédent')}
            </Button>
            <Button variant="outline" onClick={() => moveChapter(1)} disabled={selectedChapterIndex < 0 || selectedChapterIndex >= chapters.length - 1} className="rounded-2xl h-11 font-semibold">
              {t('Chapitre suivant')}<ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
