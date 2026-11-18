import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { church } from '@/lib/church';
import churchLogo from '@/assets/church-logo.jpg';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoadingAuth, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [loginMethod, setLoginMethod] = useState('email');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovery, setIsRecovery] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'recovery');

  useEffect(() => {
    if (isAuthenticated && user && !isRecovery) navigate('/', { replace: true });
  }, [isAuthenticated, user, isRecovery, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'Impossible de créer le compte.');
        toast.success(result.message);
        setIsRegistering(false);
        setFullName('');
        setEmail('');
        setPhone('');
        setPassword('');
        return;
      }
      if (loginMethod === 'phone' && !isRecovery && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
        throw new Error('Saisis le numéro au format international, par exemple +242061234567.');
      }
      if (isRecovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      } else if (loginMethod === 'phone') {
        const response = await fetch('/api/auth/login-phone', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), password }),
        });
        const session = await response.json();
        if (!response.ok) throw new Error(session?.error || 'Connexion impossible.');
        const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      toast.success(isRecovery ? 'Mot de passe mis à jour.' : 'Connexion réussie.');
      if (isRecovery) {
        setIsRecovery(false);
        navigate('/', { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'Connexion impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!email.trim()) {
      toast.error('Saisis ton adresse e-mail pour recevoir un lien de réinitialisation.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?mode=recovery`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Si cette adresse est connue, un lien de réinitialisation va être envoyé.');
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-surface pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center px-4 py-10 min-h-screen">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <img src={churchLogo} alt={`Logo de ${church.name}`} className="mx-auto h-20 w-24 object-contain rounded-2xl shadow-elev-3 border border-white/40 bg-white p-1" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent rounded-full ring-1 ring-background" />
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-none">{isRecovery ? 'Nouveau mot de passe' : isRegistering ? 'Créer un compte' : `${church.shortName} Connect`}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{church.name}</p>
          </div>
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 shadow-elev-4 space-y-6">
            {authError && (
              <p role="alert" className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-medium">
                {authError.message}
              </p>
            )}
            {isRegistering && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nom complet</Label>
                  <Input id="full-name" autoComplete="name" maxLength={150} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registration-phone">Téléphone (facultatif)</Label>
                  <Input id="registration-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
              </>
            )}
            {!isRecovery && !isRegistering && (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
                  <Button type="button" variant={loginMethod === 'email' ? 'default' : 'outline'} className={loginMethod === 'email' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-background text-foreground hover:bg-muted'} onClick={() => setLoginMethod('email')}>E-mail</Button>
                  <Button type="button" variant={loginMethod === 'phone' ? 'default' : 'outline'} className={loginMethod === 'phone' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-background text-foreground hover:bg-muted'} onClick={() => setLoginMethod('phone')}>Téléphone</Button>
                </div>
                {loginMethod === 'phone' ? (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Numéro de téléphone</Label>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} placeholder="+242061234567" onChange={(event) => setPhone(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Utilise le numéro international associé à ton compte UCE.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">Adresse e-mail</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                )}
              </>
            )}
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input id="email" type="email" autoComplete="email" maxLength={150} required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">{isRecovery ? 'Nouveau mot de passe' : 'Mot de passe'}</Label>
              <Input id="password" type="password" autoComplete={isRecovery || isRegistering ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
              {!isRecovery && !isRegistering && loginMethod === 'email' && (
                <button type="button" className="text-sm text-primary hover:text-accent-foreground transition-colors" onClick={requestPasswordReset}>
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-accent to-primary text-accent-foreground font-bold shadow-elev-3 hover:shadow-elev-4 hover:-translate-y-0.5" disabled={isSubmitting || isLoadingAuth}>
              {(isSubmitting || isLoadingAuth) && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {isRecovery ? 'Mettre à jour le mot de passe' : isRegistering ? 'Créer mon compte' : 'Se connecter'}
            </Button>
            {!isRecovery && !isRegistering && <p className="text-center text-xs text-muted-foreground">La connexion par téléphone nécessite un numéro vérifié et un mot de passe.</p>}
            {isRegistering && <p className="text-center text-xs text-muted-foreground">Ton compte sera inscrit dans l’annuaire des membres. Vérifie ton e-mail si une confirmation est demandée avant de te connecter.</p>}
          </form>
          {!isRecovery && (
            <p className="text-center text-sm">
              {isRegistering ? 'Tu as déjà un compte ? ' : 'Pas encore de compte ? '}
              <button type="button" className="font-bold text-primary underline-offset-4 hover:underline" onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Se connecter' : 'Créer un compte'}
              </button>
            </p>
          )}
          <p className="text-center text-sm">
            <Link to="/" className="text-primary hover:text-accent-foreground underline-offset-4 hover:underline transition-colors">Retour à l’accueil</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
