import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Award, BookOpen, Check, Clock3, Crown, Gamepad2,
  Heart, LockKeyhole, RotateCcw, Sparkles, Trophy, UserRound, X, Quote, History, MapPin,
} from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const gameModes = [
  { id: 'qcm', label: 'Quiz biblique', description: 'Choisissez la bonne réponse parmi plusieurs propositions.', icon: BookOpen, tone: 'from-sky-500/15 to-blue-500/5 text-sky-600' },
  { id: 'vrai_faux', label: 'Vrai ou faux', description: 'Démêlez les faits bibliques des idées reçues.', icon: Check, tone: 'from-emerald-500/15 to-teal-500/5 text-emerald-600' },
  { id: 'personnage', label: 'Personnages', description: 'Reconnaissez les figures qui ont marqué la Bible.', icon: UserRound, tone: 'from-violet-500/15 to-purple-500/5 text-violet-600' },
  { id: 'livre', label: 'Livres bibliques', description: 'Explorez les livres et l’organisation des Écritures.', icon: BookOpen, tone: 'from-amber-500/15 to-orange-500/5 text-amber-600' },
  { id: 'vie_chretienne', label: 'Vie chrétienne', description: 'Mettez en pratique les enseignements de Jésus.', icon: Heart, tone: 'from-rose-500/15 to-pink-500/5 text-rose-600' },
  { id: 'citation', label: 'Paroles & citations', description: 'Retrouvez qui a prononcé ces paroles bibliques.', icon: Quote, tone: 'from-cyan-500/15 to-sky-500/5 text-cyan-600' },
  { id: 'chronologie', label: 'Chronologie biblique', description: 'Replacez les événements dans leur contexte historique.', icon: History, tone: 'from-lime-500/15 to-green-500/5 text-lime-700' },
  { id: 'lieux', label: 'Lieux de la Bible', description: 'Explorez les villes et régions des récits bibliques.', icon: MapPin, tone: 'from-orange-500/15 to-amber-500/5 text-orange-600' },
  { id: '4_images_1_mot', label: '4 images, 1 réponse', description: 'Observez les indices et composez le nom biblique avec les lettres.', icon: Sparkles, tone: 'from-fuchsia-500/15 to-violet-500/5 text-fuchsia-600' },
];

const gameModeImages = {
  qcm: '/quiz-images/moses-tablets.svg',
  vrai_faux: '/quiz-images/noah-rainbow.svg',
  personnage: '/quiz-images/david-crown.svg',
  livre: '/quiz-images/daniel-scroll.svg',
  vie_chretienne: '/quiz-images/jesus-cross.svg',
  citation: '/quiz-images/joseph-dream.svg',
  chronologie: '/quiz-images/moses-sea.svg',
  lieux: '/quiz-images/babel-city.svg',
  '4_images_1_mot': '/quiz-images/jonah-fish.svg',
};

const levelStyles = [
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
];

function formatClaimStatus(status) {
  return ({
    pending: 'En attente',
    approved: 'Validée',
    rejected: 'Refusée',
  })[status] || status;
}

export default function Quiz() {
  const queryClient = useQueryClient();
  const answerLock = useRef(false);
  const questionTimer = useRef({ key: '', deadline: 0 });
  const [selectedMode, setSelectedMode] = useState('qcm');
  const [selectedDifficulty, setSelectedDifficulty] = useState(1);
  const [session, setSession] = useState(null);
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [feedback, setFeedback] = useState(null);
  const [completedResult, setCompletedResult] = useState(null);

  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: summaryError,
  } = useQuery({
    queryKey: ['quiz-summary'],
    queryFn: () => appClient.quiz.summary(),
  });

  const startMutation = useMutation({
    mutationFn: (data) => appClient.quiz.startSession(data),
    onSuccess: (nextSession) => {
      answerLock.current = false;
      setFeedback(null);
      setCompletedResult(null);
      setSession(nextSession);
      setSelectedLetters([]);
      setSecondsLeft(10);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de démarrer la partie.'),
  });

  const answerMutation = useMutation({
    mutationFn: ({ sessionId, data }) => appClient.quiz.answer(sessionId, data),
    onSuccess: (result) => {
      answerLock.current = false;
      setFeedback(result);
      if (result.finished) {
        setSession(null);
        setCompletedResult(result);
        queryClient.invalidateQueries({ queryKey: ['quiz-summary'] });
      } else {
        setSelectedLetters([]);
        setSession((current) => current ? {
          ...current,
          question: result.question,
          question_index: result.question_index,
          question_started_at: result.question_started_at,
        } : null);
      }
    },
    onError: (error) => {
      answerLock.current = false;
      toast.error(error instanceof Error ? error.message : 'La réponse n’a pas pu être enregistrée.');
    },
  });

  const submitAnswer = useCallback((choiceOrAnswer) => {
    if (!session || answerLock.current || answerMutation.isPending) return;
    answerLock.current = true;
    const data = { question_index: session.question_index };
    if (session.game_mode === '4_images_1_mot') {
      if (typeof choiceOrAnswer === 'string') data.answer = choiceOrAnswer;
    } else {
      data.choice = choiceOrAnswer;
    }
    answerMutation.mutate({
      sessionId: session.id,
      data,
    });
  }, [answerMutation, session]);

  useEffect(() => {
    if (!session || answerMutation.isPending) return undefined;
    const questionKey = `${session.id}:${session.question_index}`;
    if (questionTimer.current.key !== questionKey) {
      questionTimer.current = { key: questionKey, deadline: performance.now() + 10_000 };
    }

    const updateTimer = () => {
      const now = performance.now();
      const remaining = Math.max(0, Math.ceil((questionTimer.current.deadline - now) / 1000));
      setSecondsLeft(remaining);
      if (now >= questionTimer.current.deadline + 450) submitAnswer(null);
    };
    updateTimer();
    const timerId = window.setInterval(updateTimer, 150);
    return () => window.clearInterval(timerId);
  }, [answerMutation.isPending, session, submitAnswer]);

  const claimMutation = useMutation({
    mutationFn: (rewardId) => appClient.quiz.claimReward(rewardId),
    onSuccess: () => {
      toast.success('Votre demande de cadeau a été envoyée à l’administration.');
      queryClient.invalidateQueries({ queryKey: ['quiz-summary'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’envoyer la demande.'),
  });

  const activeMode = gameModes.find((mode) => mode.id === selectedMode) || gameModes[0];
  const timerPercent = (secondsLeft / 10) * 100;
  const availableLevels = summary?.levels || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-violet-50 to-amber-50 text-foreground dark:from-background dark:via-indigo-950/30 dark:to-background">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-primary to-violet-900 p-6 text-white shadow-elev-4 sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-60 w-60 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                <Sparkles className="h-4 w-4" /> Grandir en s’amusant
              </span>
              <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">Le défi des Écritures</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                Testez vos connaissances bibliques, progressez à votre rythme et gagnez des jetons pour réclamer des cadeaux.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-200"><Trophy className="h-6 w-6" /></span>
              <div>
                <p className="text-xs font-semibold text-white/70">Vos jetons</p>
                <p className="text-2xl font-black tabular-nums">{isLoadingSummary ? '…' : summary?.points ?? 0}</p>
                <p className="mt-0.5 text-[10px] font-medium text-white/65">10 jetons par bonne réponse</p>
              </div>
            </div>
          </div>
        </section>

        {summaryError && (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Impossible de charger votre progression. Actualisez la page pour réessayer.
          </p>
        )}

        {session ? (
          <section aria-labelledby="question-title" className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setSession(null)} className="gap-2 rounded-full">
                <ArrowLeft className="h-4 w-4" /> Quitter la partie
              </Button>
              <span className="rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs font-bold text-muted-foreground">
                Question {session.question_index + 1} / {session.question_count}
              </span>
            </div>

            <div className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-elev-3 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{gameModes.find((mode) => mode.id === session.game_mode)?.label || activeMode.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Niveau {session.question.difficulty} · {session.question_index + 1} sur {session.question_count}</p>
                </div>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-4 tabular-nums ${secondsLeft <= 3 ? 'border-rose-500/20 bg-rose-500/10 text-rose-600' : 'border-primary/15 bg-primary/5 text-primary'}`}>
                  <span className="flex items-center gap-1 text-lg font-black"><Clock3 className="h-4 w-4" />{secondsLeft}</span>
                </div>
              </div>
              <Progress value={timerPercent} className="mb-7 h-2.5" />
              {feedback && (
                <div role="status" className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${feedback.correct ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                  <span className={`mt-0.5 ${feedback.correct ? 'text-emerald-600' : 'text-amber-600'}`}>{feedback.correct ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}</span>
                  <div>
                    <p className="font-extrabold">{feedback.timed_out ? 'Temps écoulé' : feedback.correct ? `Bonne réponse · +${feedback.points_awarded} jetons` : `La bonne réponse était : ${feedback.correct_choice}`}</p>
                    {feedback.explanation && <p className="mt-1 text-muted-foreground">{feedback.explanation}</p>}
                    {feedback.bible_reference && <p className="mt-1 text-xs font-bold text-primary">{feedback.bible_reference}</p>}
                  </div>
                </div>
              )}
              <h2 id="question-title" className="mb-6 text-xl font-black leading-snug sm:text-2xl">{session.question.prompt}</h2>
              {session.game_mode === '4_images_1_mot' ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {session.question.image_urls.map((imageUrl, index) => (
                      <div key={`${session.question.id}-${imageUrl}`} className="aspect-square overflow-hidden rounded-2xl border border-border/70 bg-muted/40 shadow-sm">
                        <img src={imageUrl} alt={`Indice biblique ${index + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="flex min-h-14 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border/70 bg-muted/30 p-3" aria-label="Réponse composée">
                    {Array.from({ length: session.question.answer_length }, (_value, index) => {
                      const letterIndex = selectedLetters[index];
                      return (
                        <button
                          key={`answer-${index}`}
                          type="button"
                          disabled={letterIndex === undefined || answerMutation.isPending}
                          onClick={() => setSelectedLetters((current) => current.filter((_selected, selectedIndex) => selectedIndex !== index))}
                          aria-label={letterIndex === undefined ? `Case ${index + 1} vide` : `Retirer la lettre ${session.question.letter_bank[letterIndex]}`}
                          className={`flex h-10 w-9 items-center justify-center rounded-xl border text-lg font-black transition sm:h-12 sm:w-11 ${letterIndex === undefined ? 'border-dashed border-border bg-background/50 text-transparent' : 'border-primary/20 bg-card text-primary shadow-sm'}`}
                        >
                          {letterIndex === undefined ? '_' : session.question.letter_bank[letterIndex]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {session.question.letter_bank.map((letter, index) => {
                      const isSelected = selectedLetters.includes(index);
                      return (
                        <button
                          key={`${session.question.id}-letter-${index}`}
                          type="button"
                          disabled={isSelected || selectedLetters.length >= session.question.answer_length || answerMutation.isPending}
                          onClick={() => setSelectedLetters((current) => [...current, index])}
                          aria-label={`Choisir la lettre ${letter}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-card text-lg font-black text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="outline" disabled={!selectedLetters.length || answerMutation.isPending} onClick={() => setSelectedLetters([])} className="rounded-xl">
                      Effacer
                    </Button>
                    <Button
                      type="button"
                      disabled={selectedLetters.length !== session.question.answer_length || answerMutation.isPending}
                      onClick={() => submitAnswer(selectedLetters.map((index) => session.question.letter_bank[index]).join(''))}
                      className="gap-2 rounded-xl px-5 font-bold"
                    >
                      
                      Valider ma réponse <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {session.question.choices.map((choice, index) => (
                    <button
                      key={`${session.question.id}-${index}`}
                      type="button"
                      disabled={answerMutation.isPending}
                      onClick={() => submitAnswer(index)}
                      className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-left text-sm font-bold transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-elev-1 disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-black text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">{String.fromCharCode(65 + index)}</span>
                      <span>{choice}</span>
                    </button>
                  ))}
                </div>
              )}
              {answerMutation.isPending && <p className="mt-5 text-center text-sm text-muted-foreground">Vérification de votre réponse…</p>}
            </div>
          </section>
        ) : completedResult ? (
          <section className="mx-auto max-w-2xl rounded-[2rem] border border-emerald-500/20 bg-card/90 p-7 text-center shadow-elev-3 sm:p-10">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-600"><Award className="h-8 w-8" /></span>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Partie terminée</p>
            <h2 className="mt-2 text-3xl font-black">Bravo pour votre persévérance !</h2>
            <p className="mt-3 text-muted-foreground">Vous avez gagné <strong className="text-foreground">{completedResult.session_points} jetons</strong>. Votre total est maintenant de <strong className="text-primary">{completedResult.total_points} jetons</strong>.</p>
            <Button type="button" onClick={() => setCompletedResult(null)} className="mt-6 gap-2 rounded-full px-6">
              <RotateCcw className="h-4 w-4" /> Choisir un autre défi
            </Button>
          </section>
        ) : (
          <>
            <section aria-labelledby="game-modes-title">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">À vous de jouer</p>
                <h2 id="game-modes-title" className="mt-1 text-2xl font-black">Choisissez votre jeu</h2>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {gameModes.map((mode, index) => (
                  <button
                    key={mode.id}
                    type="button"
                    disabled={startMutation.isPending || isLoadingSummary || !summary}
                    onClick={() => {
                      setSelectedMode(mode.id);
                      startMutation.mutate({ game_mode: mode.id, difficulty: selectedDifficulty });
                    }}
                    aria-label={`Commencer ${mode.label}, niveau ${selectedDifficulty}`}
                    className={`glass-card group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition duration-300 hover:-translate-y-1 hover:shadow-elev-3 active:scale-[0.97] motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 sm:min-h-52 sm:rounded-3xl sm:p-4 ${selectedMode === mode.id ? 'border-primary/50 shadow-elev-2 ring-2 ring-primary/30' : 'border-white/20'}`}
                  >
                    <img src={gameModeImages[mode.id]} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/10 transition-colors duration-300 group-hover:from-slate-950/90" />
                    <span className="relative flex w-full items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white shadow-lg backdrop-blur-sm transition duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] sm:h-12 sm:w-12 sm:rounded-2xl"><mode.icon className="h-5 w-5" /></span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white/90 backdrop-blur-sm transition duration-300 group-hover:bg-white/20"><ArrowUpRight className="h-4 w-4" /></span>
                    </span>
                    <span className="relative mt-5">
                      <span className="block font-black text-white drop-shadow-md">{mode.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-white/80 drop-shadow">{mode.description}</span>
                      <span className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-white">Jouer maintenant <ArrowRight className="inline h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                        <span className="text-[9px] font-semibold tabular-nums text-white/65">{String(index + 1).padStart(2, '0')}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section aria-labelledby="levels-title" className="rounded-[2rem] border border-border/70 bg-card/80 p-5 shadow-elev-2 sm:p-7">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Progressez étape par étape</p>
                  <h2 id="levels-title" className="mt-1 text-2xl font-black">Choisissez votre niveau</h2>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">{summary?.points ?? 0} jetons</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                {availableLevels.map((level, index) => {
                  const unlocked = (summary?.points ?? 0) >= level.min_points;
                  return (
                    <button
                      key={level.difficulty}
                      type="button"
                      disabled={!unlocked || startMutation.isPending || isLoadingSummary}
                      onClick={() => setSelectedDifficulty(level.difficulty)}
                      className={`relative flex min-h-28 flex-col justify-between rounded-2xl border p-3 text-left transition sm:rounded-3xl sm:p-4 ${selectedDifficulty === level.difficulty ? 'border-primary/40 bg-primary/5 ring-2 ring-primary/10' : 'border-border/70 bg-background/65'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${levelStyles[index]}`}>{unlocked ? <span className="text-xs font-black">{level.difficulty}</span> : <LockKeyhole className="h-4 w-4" />}</span>
                      <span className="mt-3">
                        <span className="block text-xs font-extrabold sm:text-sm">{level.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{level.min_points === 0 ? 'Accessible' : `${level.min_points} jetons requis`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p role="status" className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
                <Gamepad2 className="h-4 w-4 shrink-0 text-primary" />
                {startMutation.isPending ? 'Préparation de la partie…' : `Cliquez sur un jeu pour commencer directement · Niveau ${selectedDifficulty}`}
              </p>
            </section>

            <section aria-labelledby="rewards-title" className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Vos efforts récompensés</p>
                  <h2 id="rewards-title" className="mt-1 text-2xl font-black">La boutique des cadeaux</h2>
                </div>
                <Crown className="mb-1 h-6 w-6 text-amber-500" />
              </div>
              {!summary?.rewards?.length ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aucun cadeau n’est disponible pour le moment.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.rewards.map((reward, index) => {
                    const hasPoints = (summary?.points ?? 0) >= reward.points_required;
                    const waiting = ['pending', 'approved'].includes(reward.claim_status);
                    return (
                      <article key={reward.id} className="relative flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl border border-border/70 bg-card/85 p-5 shadow-elev-1">
                        <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${index % 2 ? 'bg-violet-500/10' : 'bg-amber-500/10'}`} />
                        <div className="relative">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Award className="h-5 w-5" /></span>
                          <h3 className="mt-3 font-black">{reward.name}</h3>
                          {reward.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reward.description}</p>}
                          <p className="mt-2 text-xs font-bold text-primary">{reward.points_required} jetons {reward.stock !== null ? `· ${reward.stock} en stock` : ''}</p>
                        </div>
                        {waiting ? (
                          <span className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${reward.claim_status === 'approved' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                            {reward.claim_status === 'approved' ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {formatClaimStatus(reward.claim_status)}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={!hasPoints || reward.stock === 0 || claimMutation.isPending}
                            onClick={() => claimMutation.mutate(reward.id)}
                            className="mt-4 w-full rounded-xl font-bold"
                          >
                            {hasPoints ? 'Réclamer ce cadeau' : `Encore ${reward.points_required - (summary?.points ?? 0)} jetons`}
                          </Button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {!!summary?.claims?.length && (
                <details className="rounded-2xl border border-border/70 bg-card/60 p-4">
                  <summary className="cursor-pointer text-sm font-bold">Historique de mes demandes</summary>
                  <div className="mt-3 divide-y divide-border/60">
                    {summary.claims.map((claim) => (
                      <div key={claim.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                        <span className="text-muted-foreground">{summary.rewards.find((reward) => reward.id === claim.reward_id)?.name || 'Cadeau'}</span>
                        <span className="font-bold">{formatClaimStatus(claim.status)}{claim.admin_note ? ` · ${claim.admin_note}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
