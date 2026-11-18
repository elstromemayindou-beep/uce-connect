import React from 'react';
import { LogOut, UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function UserNotRegisteredError() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-8 text-center shadow-sm">
        <UserRoundX className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-black">Profil UCE introuvable</h1>
        <p className="text-muted-foreground">
          Ton compte n’est pas encore rattaché à un profil UCE actif. Si tu viens de créer ton compte, vérifie que ton adresse e-mail a été confirmée. Sinon, contacte l’administration de l’Église UCE.
        </p>
        <Button className="w-full" onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </Button>
      </div>
    </div>
  );
}
