import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, Check, CircleHelp, Gift, Gamepad2, Pencil, Plus, RotateCcw, Save, Trash2, X,
} from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ImageUploadField from '@/components/media/ImageUploadField';

const gameModes = [
  ['qcm', 'Quiz biblique'],
  ['vrai_faux', 'Vrai ou faux'],
  ['citation', 'Paroles & citations'],
  ['chronologie', 'Chronologie biblique'],
  ['lieux', 'Lieux de la Bible'],
  ['personnage', 'Personnages'],
  ['livre', 'Livres bibliques'],
  ['vie_chretienne', 'Vie chrétienne'],
  ['4_images_1_mot', '4 images, 1 réponse'],
];

const emptyQuestion = {
  game_mode: 'qcm',
  difficulty: '1',
  prompt: '',
  choices: '',
  correct_option: '0',
  answer_text: '',
  image_urls: ['', '', '', ''],
  explanation: '',
  bible_reference: '',
  is_active: true,
};

const emptyReward = {
  name: '',
  description: '',
  points_required: '',
  stock: '',
  is_active: true,
};

function messageOf(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function ClaimStatus({ status }) {
  const labels = { pending: 'En attente', approved: 'Validée', rejected: 'Refusée' };
  const style = status === 'approved'
    ? 'bg-emerald-500/10 text-emerald-700'
    : status === 'rejected'
      ? 'bg-rose-500/10 text-rose-700'
      : 'bg-amber-500/10 text-amber-700';
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}>{labels[status] || status}</span>;
}

export default function AdminQuiz() {
  const queryClient = useQueryClient();
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [rewardForm, setRewardForm] = useState(emptyReward);
  const [editingReward, setEditingReward] = useState(null);

  const questionsQuery = useQuery({
    queryKey: ['admin-quiz-questions'],
    queryFn: () => appClient.quiz.admin.questions(),
  });
  const rewardsQuery = useQuery({
    queryKey: ['admin-quiz-rewards'],
    queryFn: () => appClient.quiz.admin.rewards(),
  });
  const claimsQuery = useQuery({
    queryKey: ['admin-quiz-claims'],
    queryFn: () => appClient.quiz.admin.claims(),
  });

  const refreshAdminData = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-quiz-questions'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-quiz-rewards'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-quiz-claims'] }),
  ]);

  const saveQuestion = useMutation({
    mutationFn: ({ id, data }) => id
      ? appClient.quiz.admin.updateQuestion(id, data)
      : appClient.quiz.admin.createQuestion(data),
    onSuccess: () => {
      refreshAdminData();
      setQuestionForm(emptyQuestion);
      setEditingQuestion(null);
      toast.success('Question enregistrée.');
    },
    onError: (error) => toast.error(messageOf(error, 'Impossible d’enregistrer la question.')),
  });

  const archiveQuestion = useMutation({
    mutationFn: (id) => appClient.quiz.admin.deleteQuestion(id),
    onSuccess: () => {
      refreshAdminData();
      toast.success('Question désactivée.');
    },
    onError: (error) => toast.error(messageOf(error, 'Impossible de désactiver la question.')),
  });

  const saveReward = useMutation({
    mutationFn: ({ id, data }) => id
      ? appClient.quiz.admin.updateReward(id, data)
      : appClient.quiz.admin.createReward(data),
    onSuccess: () => {
      refreshAdminData();
      setRewardForm(emptyReward);
      setEditingReward(null);
      toast.success('Récompense enregistrée.');
    },
    onError: (error) => toast.error(messageOf(error, 'Impossible d’enregistrer la récompense.')),
  });

  const archiveReward = useMutation({
    mutationFn: (id) => appClient.quiz.admin.deleteReward(id),
    onSuccess: () => {
      refreshAdminData();
      toast.success('Récompense désactivée.');
    },
    onError: (error) => toast.error(messageOf(error, 'Impossible de désactiver la récompense.')),
  });

  const reviewClaim = useMutation({
    mutationFn: ({ id, status }) => appClient.quiz.admin.reviewClaim(id, { status }),
    onSuccess: () => {
      refreshAdminData();
      toast.success('Demande traitée.');
    },
    onError: (error) => toast.error(messageOf(error, 'Impossible de traiter la demande.')),
  });

  const handleQuestionSubmit = (event) => {
    event.preventDefault();
    const isImagePuzzle = questionForm.game_mode === '4_images_1_mot';
    const data = {
      ...questionForm,
      difficulty: Number(questionForm.difficulty),
      correct_option: isImagePuzzle ? -1 : Number(questionForm.correct_option),
      choices: isImagePuzzle ? [] : questionForm.choices.split('\n').map((choice) => choice.trim()).filter(Boolean),
    };
    saveQuestion.mutate({ id: editingQuestion, data });
  };

  const handleRewardSubmit = (event) => {
    event.preventDefault();
    saveReward.mutate({
      id: editingReward,
      data: {
        ...rewardForm,
        points_required: Number(rewardForm.points_required),
        stock: rewardForm.stock === '' ? null : Number(rewardForm.stock),
      },
    });
  };

  const selectQuestion = (question) => {
    setEditingQuestion(question.id);
    setQuestionForm({
      game_mode: question.game_mode,
      difficulty: String(question.difficulty),
      prompt: question.prompt,
      choices: question.choices.join('\n'),
      correct_option: String(question.correct_option),
      answer_text: question.answer_text || '',
      image_urls: question.image_urls || ['', '', '', ''],
      explanation: question.explanation,
      bible_reference: question.bible_reference,
      is_active: question.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectReward = (reward) => {
    setEditingReward(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description,
      points_required: String(reward.points_required),
      stock: reward.stock === null ? '' : String(reward.stock),
      is_active: reward.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pendingClaims = (claimsQuery.data || []).filter((claim) => claim.status === 'pending').length;
  const anyError = questionsQuery.isError || rewardsQuery.isError || claimsQuery.isError;
  const isImagePuzzle = questionForm.game_mode === '4_images_1_mot';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-violet-50 to-amber-50 dark:from-background dark:via-indigo-950/25 dark:to-background">
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 md:px-8 md:py-12">
        <header className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-gradient-to-br from-slate-950 via-indigo-950 to-primary p-6 text-white shadow-elev-4 sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                <Gamepad2 className="h-4 w-4" /> Espace de gestion
              </span>
              <h1 className="text-3xl font-black sm:text-4xl">Quiz biblique</h1>
              <p className="mt-2 max-w-xl text-sm text-white/70">Gérez les questions, les cadeaux et les demandes des participants.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <Gift className="h-5 w-5 text-amber-300" />
              <span className="text-sm font-bold">{pendingClaims} demande{pendingClaims === 1 ? '' : 's'} à traiter</span>
            </div>
          </div>
        </header>

        {anyError && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Certaines données n’ont pas pu être chargées. Actualisez la page pour réessayer.
          </div>
        )}

        <Tabs defaultValue="questions" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-card/80 p-1.5 shadow-sm">
            <TabsTrigger value="questions" className="min-h-11 rounded-xl text-xs font-bold sm:text-sm">Questions</TabsTrigger>
            <TabsTrigger value="rewards" className="min-h-11 rounded-xl text-xs font-bold sm:text-sm">Récompenses</TabsTrigger>
            <TabsTrigger value="claims" className="min-h-11 rounded-xl text-xs font-bold sm:text-sm">
              Demandes{pendingClaims > 0 ? ` · ${pendingClaims}` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-5">
            <form onSubmit={handleQuestionSubmit} className="space-y-5 rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-elev-2 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{editingQuestion ? 'Modifier' : 'Nouveau contenu'}</p>
                  <h2 className="mt-1 text-xl font-black">{editingQuestion ? 'Modifier une question' : 'Ajouter une question'}</h2>
                </div>
                {editingQuestion && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingQuestion(null); setQuestionForm(emptyQuestion); }} className="gap-1.5 rounded-xl">
                    <X className="h-4 w-4" /> Annuler
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quiz-game-mode">Jeu</Label>
                  <select id="quiz-game-mode" value={questionForm.game_mode} onChange={(event) => setQuestionForm({ ...questionForm, game_mode: event.target.value })} className="h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm">
                    {gameModes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-difficulty">Niveau</Label>
                  <select id="quiz-difficulty" value={questionForm.difficulty} onChange={(event) => setQuestionForm({ ...questionForm, difficulty: event.target.value })} className="h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm">
                    {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Niveau {level}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiz-prompt">Question</Label>
                <Textarea id="quiz-prompt" required minLength={5} maxLength={500} rows={2} value={questionForm.prompt} onChange={(event) => setQuestionForm({ ...questionForm, prompt: event.target.value })} placeholder="Saisissez la question…" className="rounded-2xl" />
              </div>
              {isImagePuzzle ? (
                <div className="space-y-4 rounded-3xl border border-fuchsia-500/15 bg-fuchsia-500/[0.03] p-4 sm:p-5">
                  <div className="space-y-2">
                    <Label htmlFor="quiz-answer-text">Réponse attendue</Label>
                    <Input id="quiz-answer-text" required minLength={2} maxLength={40} value={questionForm.answer_text} onChange={(event) => setQuestionForm({ ...questionForm, answer_text: event.target.value })} placeholder="Ex. NOÉ" className="rounded-xl" />
                    <p className="text-xs text-muted-foreground">Les accents, espaces et majuscules seront ignorés lors de la validation.</p>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-bold">Les quatre images indices</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {questionForm.image_urls.map((imageUrl, index) => (
                        <ImageUploadField
                          key={index}
                          id={`quiz-image-${index}`}
                          label={`Image ${index + 1}`}
                          value={imageUrl}
                          onChange={(value) => setQuestionForm((current) => ({
                            ...current,
                            image_urls: current.image_urls.map((url, imageIndex) => imageIndex === index ? value : url),
                          }))}
                          previewClassName="aspect-square w-full object-cover"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                  <div className="space-y-2">
                    <Label htmlFor="quiz-choices">Réponses proposées</Label>
                    <Textarea id="quiz-choices" required rows={4} value={questionForm.choices} onChange={(event) => setQuestionForm({ ...questionForm, choices: event.target.value })} placeholder={'Une réponse par ligne\nExemple : Noé'} className="rounded-2xl" />
                    <p className="text-xs text-muted-foreground">De 2 à 6 choix, un par ligne. Les réponses seront présentées dans un ordre aléatoire.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiz-correct-option">Index de la bonne réponse</Label>
                    <Input id="quiz-correct-option" type="number" min="0" max="5" required value={questionForm.correct_option} onChange={(event) => setQuestionForm({ ...questionForm, correct_option: event.target.value })} className="rounded-xl" />
                    <div className="rounded-2xl bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                      <CircleHelp className="mb-1 h-4 w-4 text-primary" />
                      Indiquez 0 pour le premier choix, 1 pour le second, etc.
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quiz-explanation">Explication après la réponse</Label>
                  <Textarea id="quiz-explanation" maxLength={1200} rows={2} value={questionForm.explanation} onChange={(event) => setQuestionForm({ ...questionForm, explanation: event.target.value })} placeholder="Expliquez brièvement la réponse…" className="rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-reference">Référence biblique</Label>
                  <Input id="quiz-reference" maxLength={160} value={questionForm.bible_reference} onChange={(event) => setQuestionForm({ ...questionForm, bible_reference: event.target.value })} placeholder="Ex. Genèse 6:13-22" className="rounded-xl" />
                </div>
              </div>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={questionForm.is_active} onChange={(event) => setQuestionForm({ ...questionForm, is_active: event.target.checked })} className="h-4 w-4 accent-primary" />
                Question active
              </label>
              <Button type="submit" disabled={saveQuestion.isPending} className="gap-2 rounded-xl px-5 font-bold">
                {editingQuestion ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saveQuestion.isPending ? 'Enregistrement…' : editingQuestion ? 'Enregistrer les modifications' : 'Ajouter la question'}
              </Button>
            </form>

            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Bibliothèque de questions</p>
                  <h2 className="text-xl font-black">{questionsQuery.data?.length || 0} question{questionsQuery.data?.length === 1 ? '' : 's'}</h2>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => questionsQuery.refetch()} className="gap-2 rounded-xl"><RotateCcw className="h-4 w-4" /> Actualiser</Button>
              </div>
              {questionsQuery.isLoading ? <LoadingCard /> : !questionsQuery.data?.length ? <EmptyCard label="Aucune question à afficher." /> : (
                <div className="grid gap-3">
                  {questionsQuery.data.map((question) => (
                    <article key={question.id} className={`rounded-3xl border bg-card/85 p-4 shadow-sm sm:p-5 ${question.is_active ? 'border-border/70' : 'border-border/40 opacity-60'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary">{gameModes.find(([id]) => id === question.game_mode)?.[1] || question.game_mode}</span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">Niveau {question.difficulty}</span>
                            {!question.is_active && <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold text-slate-600">Désactivée</span>}
                          </div>
                          <h3 className="font-extrabold leading-snug">{question.prompt}</h3>
                          {question.game_mode === '4_images_1_mot' ? (
                            <>
                              <div className="mt-3 grid max-w-56 grid-cols-4 gap-1">
                                {question.image_urls.map((imageUrl, index) => <img key={`${question.id}-${index}`} src={imageUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
                              </div>
                              <p className="mt-2 text-xs font-bold text-emerald-700">Réponse : {question.answer_text}</p>
                            </>
                          ) : (
                            <>
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{question.choices.join(' · ')}</p>
                              <p className="mt-2 text-xs font-bold text-emerald-700">Réponse : {question.choices[question.correct_option]}</p>
                            </>
                          )}
                          {question.bible_reference && <p className="mt-1 text-[10px] font-semibold text-primary">{question.bible_reference}</p>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button type="button" variant="outline" size="icon" aria-label="Modifier la question" onClick={() => selectQuestion(question)} className="h-9 w-9 rounded-xl"><Pencil className="h-4 w-4" /></Button>
                          {question.is_active && <Button type="button" variant="outline" size="icon" aria-label="Désactiver la question" disabled={archiveQuestion.isPending} onClick={() => archiveQuestion.mutate(question.id)} className="h-9 w-9 rounded-xl text-rose-600 hover:bg-rose-500/5"><Archive className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-5">
            <form onSubmit={handleRewardSubmit} className="space-y-5 rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-elev-2 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">{editingReward ? 'Modifier' : 'Boutique du quiz'}</p>
                  <h2 className="mt-1 text-xl font-black">{editingReward ? 'Modifier un cadeau' : 'Ajouter un cadeau'}</h2>
                </div>
                {editingReward && <Button type="button" variant="outline" size="sm" onClick={() => { setEditingReward(null); setRewardForm(emptyReward); }} className="gap-1.5 rounded-xl"><X className="h-4 w-4" /> Annuler</Button>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reward-name">Nom du cadeau</Label>
                  <Input id="reward-name" required minLength={2} maxLength={120} value={rewardForm.name} onChange={(event) => setRewardForm({ ...rewardForm, name: event.target.value })} placeholder="Ex. Tasse UCE" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-points">Jetons nécessaires</Label>
                  <Input id="reward-points" type="number" min="1" step="1" required value={rewardForm.points_required} onChange={(event) => setRewardForm({ ...rewardForm, points_required: event.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reward-description">Description</Label>
                  <Textarea id="reward-description" maxLength={500} rows={2} value={rewardForm.description} onChange={(event) => setRewardForm({ ...rewardForm, description: event.target.value })} placeholder="Détails du cadeau…" className="rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-stock">Stock disponible</Label>
                  <Input id="reward-stock" type="number" min="0" step="1" value={rewardForm.stock} onChange={(event) => setRewardForm({ ...rewardForm, stock: event.target.value })} placeholder="Laisser vide pour un stock illimité" className="rounded-xl" />
                  <p className="text-xs text-muted-foreground">Le stock diminue à la validation d’une demande.</p>
                </div>
              </div>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={rewardForm.is_active} onChange={(event) => setRewardForm({ ...rewardForm, is_active: event.target.checked })} className="h-4 w-4 accent-primary" />
                Cadeau visible dans la boutique
              </label>
              <Button type="submit" disabled={saveReward.isPending} className="gap-2 rounded-xl px-5 font-bold">
                {editingReward ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saveReward.isPending ? 'Enregistrement…' : editingReward ? 'Enregistrer les modifications' : 'Ajouter le cadeau'}
              </Button>
            </form>

            {rewardsQuery.isLoading ? <LoadingCard /> : !rewardsQuery.data?.length ? <EmptyCard label="Aucun cadeau enregistré." /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {rewardsQuery.data.map((reward) => (
                  <article key={reward.id} className={`rounded-3xl border bg-card/85 p-5 shadow-sm ${reward.is_active ? 'border-border/70' : 'border-border/40 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Gift className="h-5 w-5" /></span>
                        <h3 className="font-black">{reward.name}</h3>
                        {reward.description && <p className="mt-1 text-xs text-muted-foreground">{reward.description}</p>}
                        <p className="mt-2 text-xs font-bold text-primary">{reward.points_required} jetons · {reward.stock === null ? 'Stock illimité' : `${reward.stock} en stock`}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{reward.pending_claim_count} demande(s) en attente · {reward.claim_count} demande(s) au total</p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="icon" aria-label="Modifier le cadeau" onClick={() => selectReward(reward)} className="h-9 w-9 rounded-xl"><Pencil className="h-4 w-4" /></Button>
                        {reward.is_active && <Button type="button" variant="outline" size="icon" aria-label="Désactiver le cadeau" disabled={archiveReward.isPending} onClick={() => archiveReward.mutate(reward.id)} className="h-9 w-9 rounded-xl text-rose-600"><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="claims" className="space-y-3">
            <div className="rounded-3xl border border-border/70 bg-card/80 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Suivi des demandes</p>
              <h2 className="mt-1 text-xl font-black">Validation des cadeaux</h2>
              <p className="mt-1 text-sm text-muted-foreground">Les jetons ne sont pas débités; le stock est réservé lorsqu’une demande est validée.</p>
            </div>
            {claimsQuery.isLoading ? <LoadingCard /> : !claimsQuery.data?.length ? <EmptyCard label="Aucune demande de cadeau pour le moment." /> : (
              <div className="space-y-3">
                {claimsQuery.data.map((claim) => (
                  <article key={claim.id} className="rounded-3xl border border-border/70 bg-card/85 p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black">{claim.reward_name}</h3>
                          <ClaimStatus status={claim.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{claim.member_name}{claim.member_phone ? ` · ${claim.member_phone}` : ''}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{claim.points_required} jetons requis · Demande du {new Date(claim.created_at).toLocaleDateString('fr-FR')}</p>
                        {claim.admin_note && <p className="mt-2 rounded-xl bg-muted/60 p-2 text-xs">Note : {claim.admin_note}</p>}
                      </div>
                      {claim.status === 'pending' && (
                        <div className="flex w-full gap-2 sm:w-auto">
                          <Button type="button" disabled={reviewClaim.isPending} onClick={() => reviewClaim.mutate({ id: claim.id, status: 'approved' })} className="flex-1 gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 sm:flex-none">
                            <Check className="h-4 w-4" /> Valider
                          </Button>
                          <Button type="button" variant="outline" disabled={reviewClaim.isPending} onClick={() => reviewClaim.mutate({ id: claim.id, status: 'rejected' })} className="flex-1 gap-1.5 rounded-xl text-rose-600 sm:flex-none">
                            <X className="h-4 w-4" /> Refuser
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoadingCard() {
  return <div className="animate-pulse rounded-3xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">Chargement des données…</div>;
}

function EmptyCard({ label }) {
  return <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 p-8 text-center text-sm text-muted-foreground">{label}</div>;
}
