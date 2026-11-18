import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowUpRight, Check, LoaderCircle, Pencil, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { navigationItems } from '@/lib/navigation';
import { useLanguage } from '@/lib/I18nContext';

/** @typedef {{ quick_actions?: string[] }} UserProfile */

const DEFAULT_PATHS = ['/events', '/prayers', '/sermons', '/groups', '/teams', '/donations'];
const quickActionItems = navigationItems.filter((item) => item.path !== '/');
const actionTones = [
  'from-sky-500/10 via-blue-500/5 to-transparent',
  'from-rose-500/10 via-pink-500/5 to-transparent',
  'from-violet-500/10 via-purple-500/5 to-transparent',
  'from-amber-500/10 via-orange-500/5 to-transparent',
  'from-emerald-500/10 via-teal-500/5 to-transparent',
  'from-indigo-500/10 via-cyan-500/5 to-transparent',
];

export default function QuickActions() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draftPaths, setDraftPaths] = useState(DEFAULT_PATHS);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const selectedPaths = useMemo(() => {
    const savedPaths = user?.quick_actions;
    return Array.isArray(savedPaths)
      ? savedPaths.filter((path) => quickActionItems.some((item) => item.path === path))
      : DEFAULT_PATHS;
  }, [user?.quick_actions]);
  const visibleItems = quickActionItems.filter((item) => selectedPaths.includes(item.path));

  useEffect(() => {
    if (isEditing) setDraftPaths(selectedPaths);
  }, [isEditing, selectedPaths]);

  const saveMutation = useMutation({
    /** @param {string[]} paths */
    mutationFn: (paths) => appClient.auth.updateMe({ quick_actions: paths }),
    onSuccess: (_result, paths) => {
      queryClient.setQueryData(['me'], (current) => {
        const profile = /** @type {UserProfile | undefined} */ (current);
        return profile ? { ...profile, quick_actions: paths } : profile;
      });
      setIsEditing(false);
      toast.success(t('Vos accès rapides ont été mis à jour.'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer vos accès rapides.'),
  });

  const togglePath = (path, checked) => {
    setDraftPaths((current) => checked
      ? [...current, path]
      : current.filter((selectedPath) => selectedPath !== path));
  };

  return (
    <>
      <section aria-labelledby="quick-actions-title" className="relative isolate mb-16 px-4 md:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -inset-x-8 -inset-y-8 -z-10 rounded-[4rem] bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 p-4 text-foreground shadow-elev-3 backdrop-blur-xl sm:p-6 md:rounded-[2.5rem] md:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-accent/5 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-8 z-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative z-10 mb-6 flex items-end justify-between gap-3 md:mb-8">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs">
                <Sparkles className="h-3.5 w-3.5 text-accent" />{t('Votre espace')}
              </p>
              <h2 id="quick-actions-title" className="text-3xl font-black leading-none tracking-tight sm:text-4xl">{t('Accès rapide')}<span className="text-primary">.</span></h2>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{t('Vos espaces préférés, à portée de main.')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="h-10 shrink-0 gap-2 rounded-full border-border/70 bg-background/70 px-3 text-xs font-bold sm:h-11 sm:px-5 sm:text-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('Personnaliser')}</span>
              <span className="sm:hidden">{t('Modifier')}</span>
            </Button>
          </div>

          {visibleItems.length === 0 ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="group flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-background/50 p-6 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-110"><Sparkles className="h-6 w-6" /></span>
              {t('Ajoutez vos premiers accès rapides')}
            </button>
          ) : (
            <div className="relative z-10 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
              {visibleItems.map((item, index) => (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{ animationDelay: `${index * 65}ms` }}
                  className="glass-card group relative flex min-h-36 flex-col justify-between rounded-2xl bg-background/70 p-3.5 transition duration-300 hover:-translate-y-1 hover:bg-card hover:shadow-elev-3 active:scale-[0.97] motion-reduce:transition-none sm:min-h-40 sm:rounded-3xl sm:p-4"
                >
                  <span aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br opacity-70 transition duration-300 group-hover:opacity-100 ${actionTones[index % actionTones.length]}`} />
                  <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/[0.04] blur-2xl transition duration-500 group-hover:scale-150" />
                  <span className="relative flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card shadow-sm transition duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] sm:h-12 sm:w-12 sm:rounded-2xl">
                      <item.icon className={`h-5 w-5 ${item.color}`} />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition duration-300 group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="relative mt-5 flex items-end justify-between gap-1.5">
                    <span className="min-w-0 text-left text-xs font-bold leading-tight text-foreground sm:text-sm">{t(item.label)}</span>
                    <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground/60 sm:text-[10px]">{String(index + 1).padStart(2, '0')}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="glass-card border-gradient max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-xl shadow-elev-4">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="h-5 w-5 text-primary" />{t('Personnaliser mes accès')}
            </DialogTitle>
            <DialogDescription>
              {t('Cochez les espaces que vous souhaitez retrouver sur l’accueil. Votre sélection est enregistrée sur votre compte.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickActionItems.map((item) => {
              const isSelected = draftPaths.includes(item.path);
              return (
                <label
                  key={item.path}
                  className={`flex min-h-16 cursor-pointer items-center gap-2.5 rounded-2xl border p-3 transition ${
                    isSelected ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/60 bg-background/50 hover:bg-muted/60'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => togglePath(item.path, checked === true)}
                    aria-label={`${t('Afficher')} ${t(item.label)} ${t('dans les accès rapides')}`}
                  />
                  <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{t(item.label)}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
            <span className="text-xs text-muted-foreground">{draftPaths.length} espace{draftPaths.length === 1 ? '' : 's'} sélectionné{draftPaths.length === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={saveMutation.isPending}>
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate(draftPaths)}
                disabled={saveMutation.isPending}
                className="min-w-28 rounded-xl font-bold"
              >
                {saveMutation.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
