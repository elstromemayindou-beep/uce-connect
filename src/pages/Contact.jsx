import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowUpRight, Mail, MapPin, MessageCircle, Phone, Send, Sparkles } from 'lucide-react';
import churchLogo from '@/assets/church-logo.jpg';
import homeHeroImage from '@/assets/home-hero.jpg';
import { church as defaultChurch } from '@/lib/church';

export default function Contact() {
  const { data: user, isLoading, error } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const church = {
    ...defaultChurch,
    ...(user?.church || {}),
    shortName: user?.church?.sigle || defaultChurch.shortName,
  };
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const initializedForm = useRef(false);

  useEffect(() => {
    if (!user || initializedForm.current) return;
    setName(user.full_name || '');
    setEmail(user.email || '');
    initializedForm.current = true;
  }, [user]);

  const emailLink = useMemo(() => {
    if (!church.email || !subject.trim() || !message.trim()) return '';
    const body = [
      `Nom : ${name.trim() || 'Non renseigné'}`,
      `E-mail de réponse : ${email.trim() || 'Non renseigné'}`,
      '',
      message.trim(),
    ].join('\n');
    return `mailto:${church.email}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body)}`;
  }, [church.email, email, message, name, subject]);

  const whatsappLink = useMemo(() => {
    const phone = (church.phone || '').replace(/\D/g, '');
    if (!phone || !message.trim()) return '';
    const text = [
      `Bonjour, je vous contacte depuis l’application ${church.shortName || 'UCE'}.`,
      `Nom : ${name.trim() || 'Non renseigné'}`,
      `E-mail : ${email.trim() || 'Non renseigné'}`,
      `Sujet : ${subject.trim() || 'Demande de renseignement'}`,
      '',
      message.trim(),
    ].join('\n');
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }, [church.phone, church.shortName, email, message, name, subject]);

  if (isLoading) {
    return <p className="p-8 text-center text-muted-foreground">Chargement des coordonnées…</p>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-violet-500/10 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur transition hover:text-primary">
          <ArrowLeft className="h-4 w-4" />Accueil
        </Link>

        <header className="glass-panel relative isolate mb-6 overflow-hidden rounded-[2rem] p-6 text-white md:mb-8 md:p-10">
          <img src={homeHeroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-indigo-950/85 to-primary/75" />
          <div aria-hidden="true" className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] bg-white p-2 shadow-xl ring-1 ring-black/5">
              <img src={churchLogo} alt="" className="h-full w-full rounded-[1.1rem] object-contain" />
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                <Sparkles className="h-4 w-4" />Nous sommes à votre écoute
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Contacter le secrétariat</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
                Une question, une demande de prière ou besoin d’informations ? Écrivez-nous par e-mail ou poursuivez la conversation sur WhatsApp.
              </p>
            </div>
          </div>
        </header>

        {error && (
          <p role="status" className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Les coordonnées personnalisées n’ont pas pu être chargées. Les coordonnées générales de l’église sont affichées.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="glass-panel rounded-[2rem] p-5 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Votre message</p>
              <h2 className="mt-1 text-2xl font-black">Comment pouvons-nous vous aider ?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choisissez un canal après avoir rédigé votre message. Il sera ouvert dans votre application de messagerie.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Votre nom</Label>
                  <Input id="contact-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom et prénom" className="h-12 rounded-2xl bg-background/70" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Votre e-mail</Label>
                  <Input id="contact-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" className="h-12 rounded-2xl bg-background/70" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-subject">Sujet</Label>
                <Input id="contact-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Objet de votre demande" className="h-12 rounded-2xl bg-background/70" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Votre message</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Écrivez votre message ici…"
                  rows={6}
                  className="resize-y rounded-2xl bg-background/70 leading-relaxed"
                />
              </div>

              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                {church.email ? (
                  <Button asChild disabled={!emailLink} className="h-12 justify-between rounded-2xl bg-primary px-5 font-bold shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
                    <a href={emailLink || undefined} aria-disabled={!emailLink}>
                      <span className="flex items-center gap-2"><Send className="h-4 w-4" />Écrire par e-mail</span>
                      <ArrowUpRight className="h-4 w-4 opacity-70" />
                    </a>
                  </Button>
                ) : (
                  <Button type="button" disabled className="h-12 rounded-2xl font-bold">E-mail non disponible</Button>
                )}
                {church.phone ? (
                  <Button asChild disabled={!whatsappLink} className="h-12 justify-between rounded-2xl bg-[#168c56] px-5 font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-[#117747]">
                    <a href={whatsappLink || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!whatsappLink}>
                      <span className="flex items-center gap-2"><WhatsAppIcon />Continuer sur WhatsApp</span>
                      <ArrowUpRight className="h-4 w-4 opacity-70" />
                    </a>
                  </Button>
                ) : (
                  <Button type="button" disabled className="h-12 rounded-2xl font-bold">WhatsApp non disponible</Button>
                )}
              </div>
              {(!subject.trim() || !message.trim()) && (
                <p className="text-center text-xs text-muted-foreground">Renseignez le sujet et le message pour choisir un canal d’envoi.</p>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="glass-panel rounded-[2rem] p-6 sm:p-7">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Secrétariat de l’église</p>
              <h2 className="mt-1 text-xl font-black">{church.name || church.shortName || 'Église UCE'}</h2>
              <div className="mt-5 space-y-3">
                {church.email && (
                  <a href={`mailto:${church.email}`} className="flex items-start gap-3 rounded-2xl bg-background/65 p-3 text-sm transition hover:bg-primary/5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="break-all font-medium">{church.email}</span>
                  </a>
                )}
                {church.phone && (
                  <a href={`tel:${church.phone.replace(/\s/g, '')}`} className="flex items-start gap-3 rounded-2xl bg-background/65 p-3 text-sm transition hover:bg-primary/5">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium">{church.phone}</span>
                  </a>
                )}
                {church.address && (
                  <div className="flex items-start gap-3 rounded-2xl bg-background/65 p-3 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium">{church.address}{church.city ? `, ${church.city}` : ''}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-[2rem] bg-gradient-to-br from-indigo-600 via-primary to-violet-700 p-6 text-white shadow-xl shadow-primary/15 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Nous trouver</p>
              <h2 className="mt-2 text-2xl font-black">À bientôt à l’église</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                {church.address || 'Retrouvez-nous à Brazzaville.'}{church.city ? `, ${church.city}` : ''}
              </p>
              <Link to="/map" className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold backdrop-blur transition hover:bg-white/20">
                Nous trouver sur la carte <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
      <path d="M20.52 3.48A11.82 11.82 0 0 0 12.1 0C5.54 0 .2 5.34.2 11.9c0 2.1.55 4.14 1.6 5.95L.1 24l6.3-1.65a11.9 11.9 0 0 0 5.7 1.45h.01c6.55 0 11.9-5.34 11.9-11.9a11.82 11.82 0 0 0-3.49-8.42ZM12.1 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89a9.83 9.83 0 0 1 6.99 2.9 9.83 9.83 0 0 1 2.9 6.99c0 5.45-4.44 9.89-9.9 9.89Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.48-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}
