import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MapPin, Phone, Mail, Clock, BookOpen, Heart, Calendar, CalendarDays, Share2, HandHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, staggerContainer, staggerItem } from '@/components/ui/AnimatedPage';
import { church } from '@/lib/church';
import homeHeroImage from '@/assets/home-hero.jpg';
import churchLogo from '@/assets/church-logo.jpg';
import dailyThoughtImage from '@/assets/daily-thought.jpg';
import QuickActions from '@/components/home/QuickActions';
import { useLanguage } from '@/lib/I18nContext';
import { isCurrentDailyThought, isUpcomingEvent } from '@/lib/contentDates';

export default function Home() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { data: branding = {} } = useQuery({ queryKey: ['app-branding'], queryFn: () => appClient.settings.branding() });
  const { data: verses = [] } = useQuery({ queryKey: ['daily-verse'], queryFn: () => appClient.entities.DailyVerse.list('-created_date', 1) });
  const { data: events = [] } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => appClient.entities.Event.list('date', 500),
    refetchInterval: 60_000,
  });
  const { data: thoughts = [] } = useQuery({
    queryKey: ['daily-thoughts'],
    queryFn: () => appClient.entities.DailyThought.list('-created_date', 200),
    refetchInterval: 60_000,
  });
  const { data: prayers = [] } = useQuery({ queryKey: ['recent-prayers'], queryFn: () => appClient.entities.PrayerRequest.filter({ status: 'active' }, '-created_date', 3) });

  const verse = verses[0];
  const upcomingEvents = events.filter((event) => isUpcomingEvent(event)).slice(0, 6);
  const currentThought = thoughts.find((thought) => isCurrentDailyThought(thought));
  const archivedThoughts = thoughts.filter((thought) => thought.id !== currentThought?.id);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* ── Background Mesh Gradient ── */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />

      {/* ── HERO SECTION ── */}
      <section className="relative flex min-h-[min(820px,92svh)] items-center justify-center overflow-hidden z-10">
        <img
          src={branding.logo_url || churchLogo}
          alt={`Logo de ${church.name}`}
          className="absolute left-4 top-4 z-30 h-16 w-16 rounded-2xl border border-white/40 bg-white p-1 shadow-elev-3 md:left-8 md:top-8 md:h-20 md:w-20"
        />
        <img
          src={branding.home_hero_url || homeHeroImage}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(9,12,34,.88)_0%,rgba(20,22,58,.68)_48%,rgba(14,18,40,.28)_100%)]" />
        <div aria-hidden="true" className="absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full border border-white/10 bg-primary/15 blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-12 left-1/4 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-5xl px-6 pt-20 text-center text-white stagger-children">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200 shadow-lg backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.9)]" />
            {t('Bienvenue à')}
          </p>
          <h1 className="mb-2 text-6xl font-black leading-none tracking-[-0.06em] text-white drop-shadow-2xl sm:text-7xl md:text-8xl">
            {church.shortName}
          </h1>
          <div className="mx-auto mb-7 h-1 w-20 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 shadow-[0_0_24px_rgba(252,211,77,.45)]" />
          <h2 className="mb-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            {church.name}
          </h2>
          <p className="mx-auto mb-9 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
            {t('Une communauté chrétienne au cœur de Brazzaville.')}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="h-14 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-8 text-base font-extrabold text-slate-950 shadow-[0_12px_35px_rgba(245,158,11,.28)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(245,158,11,.38)]">
              <Link to="/contact">
                <Phone className="w-5 h-5" />
                {t('Nous contacter')}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/35 bg-white/10 px-8 text-base font-bold text-white shadow-lg backdrop-blur-md transition hover:-translate-y-1 hover:border-white/60 hover:bg-white/20 hover:text-white">
              <Link to="/events">
                {t('Découvrir nos événements')}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-xs text-white/70 sm:text-sm">
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4" />{church.address}</span>
            <a className="flex items-center gap-2 hover:text-white transition-colors" href={`tel:${church.phone.replace(/\s/g, '')}`}>
              <Phone className="w-4 h-4" />{church.phone}
            </a>
            <a className="flex items-center gap-2 hover:text-white transition-colors" href={`mailto:${church.email}`}>
              <Mail className="w-4 h-4" />{church.email}
            </a>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-indigo-50 to-transparent pointer-events-none dark:from-background" />
      </section>

      <main className="relative isolate overflow-hidden bg-gradient-to-br from-indigo-50 via-violet-100/80 to-amber-50 dark:from-background dark:via-indigo-950/70 dark:to-background">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-16 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-[45%] h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative z-10">
      {currentThought && <motion.section
        aria-labelledby="daily-thought-title"
        className="mx-auto mb-12 mt-8 max-w-5xl px-4 md:px-8"
        variants={fadeUp}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        {currentThought.image_url ? (
          <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-slate-950 shadow-elev-3">
            <img src={currentThought.image_url} alt={currentThought.title || 'Pensée du jour'} className="mx-auto max-h-[75vh] w-full object-contain" />
            {(currentThought.title || currentThought.content || currentThought.author) && <div className="space-y-2 p-5 text-white sm:p-7">
              {currentThought.title && <h2 id="daily-thought-title" className="text-xl font-black sm:text-2xl">{currentThought.title}</h2>}
              {currentThought.content && <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-white/85 sm:text-base">{currentThought.content}</p>}
              {currentThought.author && <p className="border-t border-white/15 pt-3 text-sm font-bold text-amber-200">— {currentThought.author}</p>}
            </div>}
          </div>
        ) : <div className="relative isolate overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-elev-3">
          <img src={dailyThoughtImage} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-950/90 via-primary/85 to-violet-950/90" />
          <div className="relative z-10 p-5 text-white sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-amber-200 backdrop-blur"><Heart className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">Méditation · 24 h</p>
                <h2 id="daily-thought-title" className="text-xl font-black sm:text-2xl">{currentThought.title}</h2>
              </div>
            </div>
            <p className="max-w-3xl whitespace-pre-wrap text-base font-medium leading-relaxed text-white/95 sm:text-lg">{currentThought.content}</p>
            {currentThought.author && <p className="mt-5 border-t border-white/15 pt-4 text-sm font-bold text-amber-100">— {currentThought.author}</p>}
          </div>
        </div>}
      </motion.section>}

      {archivedThoughts.length > 0 && (
        <section className="mx-auto mb-12 max-w-5xl px-4 md:px-8">
          <details className="glass-card rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
            <summary className="cursor-pointer font-bold text-foreground">Archives des pensées ({archivedThoughts.length})</summary>
            <div className="mt-4 space-y-3">
              {archivedThoughts.map((thought) => (
                <article key={thought.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  {thought.image_url && <img src={thought.image_url} alt={thought.title || 'Pensée archivée'} className="mb-3 max-h-96 w-full rounded-xl bg-slate-950 object-contain" />}
                  <h3 className="font-bold">{thought.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{thought.content}</p>
                  <p className="mt-3 text-xs font-semibold text-primary">{thought.author || 'Église UCE'} · {thought.created_date ? format(new Date(thought.created_date), 'd MMMM yyyy · HH:mm', { locale: fr }) : ''}</p>
                </article>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* ── VERSET DU JOUR ── */}
      {verse && (
        <section className="px-4 md:px-8 -mt-8 relative z-10 max-w-5xl mx-auto mb-12">
          <div className="glass-card border-gradient rounded-3xl bg-gradient-to-br from-indigo-950 via-primary to-violet-900 p-6 md:p-8 shadow-elev-4 text-white overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-accent/20 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-accent" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-amber-300">{t('Verset du jour')}</span>
              </div>
              <blockquote className="text-2xl md:text-3xl font-bold italic leading-relaxed mb-4">"{verse.text}"</blockquote>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-sm font-bold text-white/90">— {verse.reference}</span>
                <button onClick={() => navigator.share?.({ text: `"${verse.text}" — ${verse.reference}` })} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all backdrop-blur-sm">
                  <Share2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ACCÈS RAPIDE ── */}
      <motion.div variants={fadeUp} initial={reduceMotion ? false : 'hidden'} whileInView="visible" viewport={{ once: true }}>
        <QuickActions />
      </motion.div>

      {/* ── ÉVÉNEMENTS À VENIR ── */}
      <motion.section
        className="mx-auto mb-16 max-w-5xl px-4 md:px-8"
        variants={fadeUp}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className="mb-7 flex items-end justify-between gap-4 sm:mb-8">
          <div className="flex items-center gap-3">
            <span className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-card/80 text-primary shadow-sm sm:flex">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent sm:text-xs">{t('Participez')}</p>
              <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">{t('Événements à Venir')}</h2>
            </div>
          </div>
          <Link to="/events" className="group flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/75 px-3.5 py-2 text-xs font-bold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm">
            {t('Voir tout')} <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 py-14 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('Aucun événement à venir')}</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-5"
            variants={staggerContainer}
            initial={reduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {upcomingEvents.slice(0, 3).map((event) => (
              <motion.div key={event.id} variants={staggerItem} whileHover={reduceMotion ? undefined : { y: -5 }}>
              <Link to="/events" className="glass-card group block overflow-hidden rounded-3xl border-border/70 bg-card/80 shadow-elev-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-elev-3">
                <div className="relative h-44 overflow-hidden bg-primary/5 sm:h-52">
                  <img
                    src={event.image_url || `https://images.unsplash.com/photo-1438232992991-995b671a1b65?w=600&q=70`}
                    alt={event.title}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1438232992991-995b671a1b65?w=600&q=70'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
                  {/* Date badge */}
                  {event.date && (
                    <div className="absolute left-4 top-4 min-w-[54px] rounded-2xl border border-white/40 bg-card/90 px-3 py-2 text-center text-foreground shadow-elev-2 backdrop-blur-md">
                      <div className="text-xs font-bold uppercase leading-none">
                        {format(new Date(event.date), 'MMM', { locale: fr })}
                      </div>
                      <div className="text-2xl font-black leading-none">
                        {format(new Date(event.date), 'd')}
                      </div>
                    </div>
                  )}
                  <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur-md transition group-hover:rotate-45 group-hover:bg-primary">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="p-4 sm:p-5">
                  <h3 className="mb-3 line-clamp-2 text-base font-black leading-tight text-foreground sm:text-lg">{event.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {event.time && <span className="flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1.5"><Clock className="h-3.5 w-3.5 text-primary" />{event.time}</span>}
                    {event.location && <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" /><span className="truncate">{event.location}</span></span>}
                  </div>
                </div>
              </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* ── DEMANDES DE PRIÈRE ── */}
      <motion.section
        className="mx-auto mb-16 max-w-5xl px-4 md:px-8"
        variants={fadeUp}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className="mb-7 flex items-end justify-between gap-4 sm:mb-8">
          <div className="flex items-center gap-3">
            <span className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/10 bg-rose-500/5 text-rose-500 shadow-sm sm:flex">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500 sm:text-xs">Ensemble dans la foi</p>
              <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">Mur de prière</h2>
            </div>
          </div>
          <Link to="/prayers" className="group flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/75 px-3.5 py-2 text-xs font-bold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm">
            Voir tout <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {prayers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 py-14 text-center sm:col-span-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t('Aucune demande de prière')}</p>
            </div>
          ) : (
            prayers.map((prayer) => (
              <article key={prayer.id} className="glass-card group rounded-3xl border-border/70 bg-card/80 p-4 shadow-elev-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elev-2 sm:p-5">
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                      <Heart className="h-4 w-4" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/5 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-300">
                      <Heart className="h-3.5 w-3.5 fill-current" />
                      {prayer.prayer_count || 0} prières
                    </span>
                  </div>
                  <p className="mb-5 flex-1 text-sm leading-relaxed text-foreground line-clamp-3">{prayer.content}</p>
                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {prayer.is_anonymous ? 'Anonyme' : prayer.author_name || 'Membre'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Porté en prière</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </motion.section>

      {/* ── BANNIÈRE DONATION ── */}
      <motion.section
        className="relative mx-4 mb-16 max-w-5xl overflow-hidden rounded-[2rem] border border-white/20 shadow-elev-3 md:mx-auto md:rounded-[2.5rem]"
        variants={fadeUp}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=70" alt="Don" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-indigo-950/60 to-amber-950/60" />
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative z-10 p-7 text-center text-white sm:p-10 md:p-14">
          <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-300 backdrop-blur">
            <HandHeart className="h-6 w-6" />
          </span>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300 sm:text-xs">Soutenez notre mission</p>
          <h2 className="mb-5 text-3xl font-black leading-tight tracking-tight text-white drop-shadow-lg sm:text-4xl">
            Ensemble nous<br />bâtissons l'avenir
          </h2>
          <p className="mx-auto mb-7 max-w-md text-sm leading-relaxed text-white/80 sm:mb-9">
            Votre générosité permet de transformer des vies et de répandre l'espérance dans notre communauté.
          </p>
          <Button asChild size="lg" className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-9 text-sm font-black text-slate-950 shadow-elev-3 transition hover:-translate-y-0.5 hover:from-amber-300 hover:to-amber-400 hover:shadow-elev-4 sm:px-12 sm:text-base">
            <Link to="/donations">
              Faire un Don
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.section>

        </div>
      </main>
    </div>
  );
}
