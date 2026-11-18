import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellOff, LoaderCircle } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function decodeApplicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = window.atob(`${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export default function PushDeviceSettings() {
  const { data: config, isLoading: isLoadingConfig, isError: isConfigError } = useQuery({
    queryKey: ['push-config'],
    queryFn: () => appClient.push.config(),
  });
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const supported = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(subscription));
    }).catch((error) => {
      console.error('Unable to inspect push subscription:', error);
    });
  }, [supported]);

  const enable = async () => {
    if (!supported) {
      toast.error('Les alertes push ne sont pas prises en charge par ce navigateur.');
      return;
    }
    if (!config?.enabled || !config.public_key) {
      toast.error('Les alertes téléphone ne sont pas encore configurées par l’administration.');
      return;
    }
    setIsWorking(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        toast.error('Autorise les notifications dans les réglages du téléphone pour recevoir les alertes.');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(config.public_key),
        });
      await appClient.push.subscribe(subscription.toJSON());
      setIsSubscribed(true);
      toast.success('Les alertes de l’église seront affichées sur cet appareil.');
    } catch (error) {
      toast.error(error.message || 'Impossible d’activer les alertes sur cet appareil.');
    } finally {
      setIsWorking(false);
    }
  };

  const disable = async () => {
    setIsWorking(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await appClient.push.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success('Les alertes ont été désactivées sur cet appareil.');
    } catch (error) {
      toast.error(error.message || 'Impossible de désactiver les alertes.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="bg-card border border-border/50 rounded-3xl p-6 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-lg">Alertes sur ce téléphone</h3>
          <p className="text-sm text-muted-foreground">
            Les annonces de l’église s’afficheront dans la barre de notifications de ton appareil, pas dans une boîte de réception de l’application.
          </p>
        </div>
      </div>
      {!supported ? (
        <p className="text-sm text-muted-foreground">Ce navigateur ne prend pas en charge les notifications push.</p>
      ) : isConfigError ? (
        <p role="alert" className="text-sm text-destructive">Impossible de vérifier la configuration des alertes. Réessaie plus tard.</p>
      ) : !isLoadingConfig && !config?.enabled ? (
        <p className="text-sm text-muted-foreground">Le service d’alertes doit être configuré par l’administration avant l’activation.</p>
      ) : permission === 'denied' ? (
        <p className="text-sm text-amber-700">Les notifications sont bloquées par ton navigateur. Réactive-les dans ses réglages.</p>
      ) : (
        <>
          <Button type="button" onClick={isSubscribed ? disable : enable} disabled={isWorking || isLoadingConfig}>
            {isWorking || isLoadingConfig ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {isSubscribed ? 'Désactiver sur cet appareil' : 'Activer les alertes téléphone'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Sur iPhone, ajoute d’abord UCE Connect à l’écran d’accueil et ouvre l’application installée pour autoriser les alertes.
          </p>
        </>
      )}
    </section>
  );
}
