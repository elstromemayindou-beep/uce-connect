import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CheckCircle2, Clock3, HandCoins, ShieldCheck, XCircle } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isSystemAdministrator } from '@/lib/navigation';
import { toast } from 'sonner';

const categoryLabels = {
  general: 'Fonctionnement général',
  ministry: 'Ministères',
  event: 'Événements',
  solidarity: 'Solidarité',
  maintenance: 'Entretien et maintenance',
};

const typeLabels = {
  tithe: 'Dîmes',
  offering: 'Offrandes',
  campaign: 'Cagnottes',
  special: 'Dons spéciaux',
  solidarity: 'Solidarité',
};

function getLocalDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Brazzaville' });
}

export default function FinanceReport() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(getLocalDate);
  const [expenseToReject, setExpenseToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => appClient.auth.me(),
  });
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isPastor = roles.includes('PASTEUR_PRINCIPAL');
  const canAccess = Boolean(isPastor || isSystemAdministrator(user));
  const reportQuery = useQuery({
    queryKey: ['finance-daily-report', date],
    queryFn: () => appClient.finance.dailyReport(date),
    enabled: Boolean(user?.id && canAccess && date),
  });
  const reviewMutation = useMutation({
    /** @param {{ id: string, action: 'pastor_approve' | 'pastor_reject', reason?: string }} data */
    mutationFn: ({ id, ...data }) => appClient.finance.updateExpense(id, data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['finance-daily-report'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      setExpenseToReject(null);
      setRejectionReason('');
      toast.success(variables.action === 'pastor_approve'
        ? 'Décaissement approuvé par le pasteur. La trésorerie peut maintenant le régler.'
        : 'Demande de décaissement rejetée.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer cette décision.'),
  });

  if (isLoadingUser) return <p className="p-8 text-center text-muted-foreground">Chargement de vos autorisations…</p>;
  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-black">Accès réservé à la direction</h1>
        <p className="mt-2 text-muted-foreground">Le rapport quotidien est réservé au pasteur principal et à l’administration générale.</p>
        <Link to="/admin" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
          <ArrowLeft className="h-4 w-4" />Retour à l’administration
        </Link>
      </div>
    );
  }

  const report = reportQuery.data;
  const receipts = report?.receipts || {};
  const disbursements = report?.disbursements || {};
  const pendingExpenses = report?.pending_pastor_approval || [];
  const formatAmount = (value) => (Number(value) || 0).toLocaleString();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft className="h-4 w-4" />Retour à l’administration
      </Link>
      <header className="glass-panel flex flex-wrap items-end justify-between gap-4 rounded-3xl p-6 md:p-8">
        <div>
          <HandCoins className="mb-4 h-10 w-10 text-primary" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Espace du pasteur principal</p>
          <h1 className="mt-1 text-3xl font-black">Rapport financier quotidien</h1>
          <p className="mt-2 text-muted-foreground">Consultez les mouvements du jour et donnez l’approbation finale aux décaissements contrôlés.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finance-report-date">Date du rapport</Label>
          <Input id="finance-report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-w-44 rounded-xl" />
        </div>
      </header>

      {reportQuery.isError && (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossible de charger le rapport. Vérifiez que la migration des approbations du pasteur a été appliquée.
        </p>
      )}
      {reportQuery.isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Chargement du rapport…</p>
      ) : report ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">Encaissements</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{formatAmount(receipts.total)} XAF</p>
              <p className="mt-1 text-xs text-muted-foreground">{receipts.count || 0} opération(s)</p>
            </article>
            <article className="glass-panel rounded-2xl p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Banknote className="h-4 w-4" />Espèces reçues</p>
              <p className="mt-2 text-2xl font-black">{formatAmount(receipts.cash_total)} XAF</p>
            </article>
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">Paiements électroniques</p>
              <p className="mt-2 text-2xl font-black">{formatAmount(receipts.electronic_total)} XAF</p>
            </article>
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">Décaissements réglés</p>
              <p className="mt-2 text-2xl font-black text-amber-700">{formatAmount(disbursements.total)} XAF</p>
              <p className="mt-1 text-xs text-muted-foreground">{disbursements.count || 0} dépense(s) payée(s)</p>
            </article>
          </section>

          <section className="glass-panel space-y-4 rounded-3xl p-5 md:p-7">
            <h2 className="text-xl font-black">Détail des encaissements</h2>
            {receipts.by_type?.length ? (
              <div className="divide-y divide-border/60">
                {receipts.by_type.map((item) => (
                  <div key={item.type} className="flex justify-between gap-4 py-3 text-sm">
                    <span>{typeLabels[item.type] || item.type}</span>
                    <span className="font-bold">{formatAmount(item.total)} XAF · {item.count} opération(s)</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Aucun encaissement confirmé à cette date.</p>
            )}
          </section>

          <section className="glass-panel space-y-4 rounded-3xl p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Décaissements à approuver</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ces demandes ont d’abord été contrôlées par le contrôleur financier. Après votre approbation, elles pourront être réglées par la trésorerie.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-800">
                <Clock3 className="h-3.5 w-3.5" />{pendingExpenses.length} en attente
              </span>
            </div>
            {pendingExpenses.length === 0 ? (
              <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Aucun décaissement en attente d’approbation finale.</p>
            ) : (
              <div className="space-y-3">
                {pendingExpenses.map((expense) => (
                  <article key={expense.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{expense.description}</p>
                      <p className="text-sm text-muted-foreground">{categoryLabels[expense.category] || expense.category} · {expense.vendor_name} · {expense.expense_number}</p>
                      <p className="text-xs text-muted-foreground">Soumis par {expense.requester_name}{expense.invoice_reference ? ` · Pièce ${expense.invoice_reference}` : ''}</p>
                    </div>
                    <p className="font-black text-primary">{formatAmount(expense.amount)} {expense.currency}</p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => reviewMutation.mutate({ id: expense.id, action: 'pastor_approve' })}
                      disabled={reviewMutation.isPending || expense.requested_by === user?.id || !isPastor}
                      className="rounded-xl"
                    >
                      <CheckCircle2 className="h-4 w-4" />Approuver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExpenseToReject(expense);
                        setRejectionReason('');
                      }}
                      disabled={reviewMutation.isPending || expense.requested_by === user?.id || !isPastor}
                      className="rounded-xl"
                    >
                      <XCircle className="h-4 w-4" />Rejeter
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Rapport consultatif établi à partir des encaissements confirmés et des dépenses effectivement réglées. Les opérations en attente ne sont pas incluses dans les totaux.
          </p>
        </>
      ) : null}

      <Dialog
        open={Boolean(expenseToReject)}
        onOpenChange={(open) => {
          if (!open && !reviewMutation.isPending) {
            setExpenseToReject(null);
            setRejectionReason('');
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Rejeter le décaissement</DialogTitle>
          </DialogHeader>
          {expenseToReject && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{expenseToReject.description} · {formatAmount(expenseToReject.amount)} {expenseToReject.currency}</p>
              <div className="space-y-1.5">
                <Label htmlFor="pastor-rejection-reason">Motif du rejet</Label>
                <Textarea id="pastor-rejection-reason" maxLength={300} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Expliquez la décision au trésorier." />
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full rounded-xl"
                onClick={() => reviewMutation.mutate({ id: expenseToReject.id, action: 'pastor_reject', reason: rejectionReason.trim() })}
                disabled={reviewMutation.isPending || !rejectionReason.trim() || !isPastor}
              >
                {reviewMutation.isPending ? 'Enregistrement…' : 'Confirmer le rejet'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
