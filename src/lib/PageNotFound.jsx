import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-7xl font-black text-muted-foreground/30">404</h1>
        <h2 className="text-2xl font-bold">Page introuvable</h2>
        <Button asChild><Link to="/">Retour à l’accueil</Link></Button>
      </div>
    </main>
  );
}
