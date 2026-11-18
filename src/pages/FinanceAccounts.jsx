import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSystemAdministrator } from '@/lib/navigation';
import { toast } from 'sonner';

const accountTypeLabels = {
  asset: 'Actif',
  liability: 'Passif',
  equity: 'Capitaux propres',
  income: 'Produit',
  expense: 'Charge',
};

export default function FinanceAccounts() {
  const queryClient = useQueryClient();
  const [accountCodes, setAccountCodes] = useState({});
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => appClient.auth.me(),
  });
  const canAccessFinance = Boolean(isSystemAdministrator(user)
    || user?.roles?.some((role) => ['TRESORIER', 'CONTROLEUR_FIN'].includes(role)));
  const isFinancialController = Boolean(isSystemAdministrator(user)
    || user?.roles?.includes('CONTROLEUR_FIN'));
  const {
    data: ledger,
    isLoading: isLoadingLedger,
    isError: ledgerError,
  } = useQuery({
    queryKey: ['finance-ledger'],
    queryFn: () => appClient.finance.ledger(),
    enabled: canAccessFinance,
  });
  const mapAccountMutation = useMutation({
    /** @param {{ id: string, syscohada_code: string }} data */
    mutationFn: ({ id, ...data }) => appClient.finance.mapAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      toast.success('Référence de compte enregistrée.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de modifier ce compte.'),
  });

  if (isLoadingUser) return <p className="p-8 text-center text-muted-foreground">Chargement de vos autorisations…</p>;
  if (!canAccessFinance) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-black">Accès réservé à la trésorerie</h1>
        <p className="mt-2 text-muted-foreground">Les détails des comptes ne sont pas associés à votre compte.</p>
        <Link to="/admin/finance" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
          <ArrowLeft className="h-4 w-4" />Retour à la trésorerie
        </Link>
      </div>
    );
  }

  const accounts = ledger?.accounts?.filter((account) => account.is_active) || [];
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin/finance" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft className="h-4 w-4" />Retour à la trésorerie
      </Link>
      <header className="glass-panel rounded-3xl p-6 md:p-8">
        <BookOpen className="mb-4 h-10 w-10 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Trésorerie</p>
        <h1 className="mt-1 text-3xl font-black">Détails des comptes</h1>
        <p className="mt-2 text-muted-foreground">
          Comptes internes, soldes et suivi des opérations de l’église.
        </p>
      </header>

      {ledgerError ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossible de charger les comptes. Vérifiez la migration comptable et les droits de la base.
        </p>
      ) : isLoadingLedger ? (
        <p className="py-10 text-center text-muted-foreground">Chargement des comptes…</p>
      ) : (
        <>
          <p className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            Le grand livre interne fonctionne sans numéro SYSCOHADA. Les éventuels codes affichés sont facultatifs et indicatifs ; ils ne constituent pas une validation comptable.
          </p>
          {accounts.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 p-5 text-sm text-muted-foreground">Aucun compte actif n’est disponible.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map((account) => (
                <article key={account.id} className="glass-panel space-y-4 rounded-3xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">{accountTypeLabels[account.account_type] || account.account_type}</p>
                      <h2 className="mt-1 text-lg font-black">{account.label}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Code interne {account.code} · Classe {account.account_class}
                      </p>
                    </div>
                    <p className="text-right text-xl font-black text-primary">
                      {Number(account.balance).toLocaleString()} XAF
                      <span className="block text-xs font-medium text-muted-foreground">Solde actuel</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Total débits</p>
                      <p className="font-bold">{Number(account.debit_total).toLocaleString()} XAF</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total crédits</p>
                      <p className="font-bold">{Number(account.credit_total).toLocaleString()} XAF</p>
                    </div>
                  </div>
                  {isFinancialController ? (
                    <div className="space-y-2">
                      <label htmlFor={`account-code-${account.id}`} className="text-sm font-semibold">Code SYSCOHADA facultatif (indicatif)</label>
                      <div className="flex gap-2">
                        <Input
                          id={`account-code-${account.id}`}
                          inputMode="numeric"
                          maxLength={10}
                          value={accountCodes[account.id] ?? account.syscohada_code ?? ''}
                          onChange={(event) => setAccountCodes((current) => ({ ...current, [account.id]: event.target.value }))}
                          placeholder="Code facultatif"
                          className="h-10 rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => mapAccountMutation.mutate({
                            id: account.id,
                            syscohada_code: accountCodes[account.id] ?? account.syscohada_code ?? '',
                          })}
                          disabled={mapAccountMutation.isPending || !(accountCodes[account.id] ?? account.syscohada_code)}
                          className="shrink-0 rounded-xl"
                        >
                          Enregistrer
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cette référence est informative et ne peut pas être modifiée après la première écriture du compte.
                      </p>
                    </div>
                  ) : account.syscohada_code ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />Code indicatif : {account.syscohada_code}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune référence externe (facultatif).</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
