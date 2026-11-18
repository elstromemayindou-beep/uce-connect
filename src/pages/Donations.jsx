import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HandCoins, Target, History, TrendingUp, Clock3, Gift, Search, ShieldCheck, UserRound, UserRoundX, Banknote, LockKeyhole, BookOpen, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageUploadField from '@/components/media/ImageUploadField';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isSystemAdministrator } from '@/lib/navigation';

const donationLabels = { tithe: 'Dîme', offering: 'Offrande', campaign: 'Campagne', special: 'Don spécial', solidarity: 'Solidarité' };
const donationIcons = { tithe: '🙏', offering: '💛', campaign: '🎯', special: '⭐', solidarity: '❤️' };
const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000];
const expenseCategoryLabels = {
  general: 'Fonctionnement général',
  ministry: 'Ministères',
  event: 'Événements',
  solidarity: 'Solidarité',
  maintenance: 'Entretien et maintenance',
};

const SOLIDARITY_CATEGORIES = [
  { id: 'orphans', emoji: '👦', label: 'Orphelins', desc: 'Soutenir les enfants sans famille' },
  { id: 'widows', emoji: '🙏', label: 'Veuves', desc: 'Aider les familles dans le besoin' },
  { id: 'sick', emoji: '🏥', label: 'Malades', desc: 'Frais médicaux & soutien' },
  { id: 'poor', emoji: '🌾', label: 'Démunis', desc: 'Nourriture & nécessités de base' },
];

/**
 * @typedef {{
 *   id: string,
 *   amount: number,
 *   currency?: string,
 *   type: string,
 *   payment_method: string,
 *   payment_reference?: string,
 *   donor_name?: string | null,
 *   donor_anonymous?: boolean,
 *   receipt_number?: string,
 *   status: string,
 *   created_date?: string,
 * }} DonationRecord
 */

function GivingCard({ icon: Icon, title, subtitle, gradient, onClick, image }) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden cursor-pointer group hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-2xl"
      style={{ minHeight: 160 }}
    >
      <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-85`} />
      <div className="relative z-10 p-6 h-full flex flex-col justify-between">
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-white font-black text-xl uppercase tracking-tight leading-none mb-1">{title}</h3>
          <p className="text-white/75 text-xs font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="absolute inset-0 ring-2 ring-inset ring-white/0 group-hover:ring-white/20 rounded-3xl transition-all" />
    </div>
  );
}

export default function Donations({ financeMode = false }) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const cinetPayTransactionId = searchParams.get('cinetpay_transaction_id') || '';
  const [showDonate, setShowDonate] = useState(false);
  const [donationType, setDonationType] = useState('tithe');
  const [solidarityCategory, setSolidarityCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorKind, setDonorKind] = useState('member');
  const [donorMemberId, setDonorMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  const { data: user, isLoading: isLoadingUser } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const isTreasury = Boolean(financeMode && (
    isSystemAdministrator(user)
    || user?.roles?.some((role) => ['TRESORIER', 'CONTROLEUR_FIN'].includes(role))
  ));
  const { data: cinetPayConfig, isError: cinetPayConfigError, isLoading: isLoadingCinetPayConfig } = useQuery({
    queryKey: ['cinetpay-config'],
    queryFn: () => appClient.payments.cinetpayConfig(),
    enabled: Boolean(user?.id && !financeMode),
  });
  const {
    data: cinetPayStatus,
    isFetching: isCheckingCinetPay,
    isError: cinetPayStatusError,
    refetch: refetchCinetPayStatus,
  } = useQuery({
    queryKey: ['cinetpay-status', cinetPayTransactionId],
    queryFn: () => appClient.payments.cinetpayStatus(cinetPayTransactionId),
    enabled: Boolean(user?.id && cinetPayTransactionId && !financeMode),
    refetchInterval: (query) => query.state.data?.status === 'pending'
      && query.state.dataUpdateCount < 60 ? 10_000 : false,
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => financeMode
      ? appClient.entities.Campaign.list('-created_date', 100)
      : appClient.entities.Campaign.filter({ is_active: true }),
    enabled: Boolean(user?.id && (!financeMode || isTreasury)),
  });
  const { data: financeMembers = [], isLoading: isLoadingMembers, isError: membersError } = useQuery({
    queryKey: ['finance-members', user?.id],
    queryFn: () => appClient.finance.members(),
    enabled: Boolean(user?.id && isTreasury),
  });
  const { data: financeLedger, isLoading: isLoadingLedger, isError: ledgerError } = useQuery({
    queryKey: ['finance-ledger'],
    queryFn: () => appClient.finance.ledger(),
    enabled: Boolean(user?.id && isTreasury),
  });
  const { data: financeExpenses = [], isLoading: isLoadingExpenses, isError: expensesError } = useQuery({
    queryKey: ['finance-expenses'],
    queryFn: () => appClient.finance.expenses(),
    enabled: Boolean(user?.id && isTreasury),
  });
  const { data: cashSessions, isLoading: isLoadingCashSessions, isError: cashSessionsError } = useQuery({
    queryKey: ['finance-cash-sessions'],
    queryFn: () => appClient.finance.cashSessions(),
    enabled: Boolean(user?.id && isTreasury),
  });
  const {
    data: myDonations = [],
    isLoading: isLoadingDonations,
    isError: donationsError,
  } = useQuery({
    queryKey: ['my-donations', user?.id, isTreasury],
    queryFn: () => appClient.entities.Donation.list('-created_date', 50),
    enabled: Boolean(user?.id && (!financeMode || isTreasury)),
  });
  useEffect(() => {
    if (['accepted', 'refused'].includes(cinetPayStatus?.status)) {
      queryClient.invalidateQueries({ queryKey: ['my-donations'] });
    }
  }, [cinetPayStatus?.status, queryClient]);

  const donateMutation = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: (data) => isTreasury
      ? appClient.entities.Donation.create(data)
      : appClient.payments.initializeCinetPay({
        amount: Number(data.amount),
        type: String(data.type),
        payment_method: String(data.payment_method),
        campaign_id: String(data.campaign_id || ''),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
      }),
    onSuccess: (result) => {
      if (!isTreasury) {
        if (result?.payment_url) window.location.assign(result.payment_url);
        else toast.error('CinetPay n’a pas renvoyé la page de paiement.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-donations'] });
      if (isTreasury) {
        queryClient.invalidateQueries({ queryKey: ['finance-cash-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      }
      setShowDonate(false); setAmount(''); setSolidarityCategory(''); setDonorName(''); setDonorEmail('');
      setDonorMemberId('');
      setDonorKind('member');
      setMemberSearch('');
      setPaymentReference('');
      toast.success('Encaissement enregistré et ajouté à l’historique du membre.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer cet engagement.'),
  });

  const openDonateFor = (type, campaignId = '') => {
    setDonationType(type);
    setSelectedCampaignId(campaignId);
    setPaymentMethod(isTreasury ? 'cash' : 'mobile_money');
    setDonorName('');
    setDonorEmail('');
    setDonorKind('member');
    setDonorMemberId('');
    setMemberSearch('');
    setPaymentReference('');
    setCustomerPhone(user?.phone || '');
    setCustomerEmail(user?.email || '');
    setShowDonate(true);
  };
  const receivedDonations = myDonations.filter((donation) => donation.status === 'received');
  const totalDonated = receivedDonations.reduce((acc, donation) => acc + (Number(donation.amount) || 0), 0);

  if (isLoadingUser) {
    return <div className="p-8 text-center text-muted-foreground">Chargement de votre espace…</div>;
  }

  if (financeMode && !isTreasury) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center p-6">
        <div className="glass-panel rounded-3xl p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-black">Accès réservé à la trésorerie</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cet espace est accessible uniquement aux comptes ayant le rôle Trésorier ou Contrôleur financier.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: 260 }}>
        <img
          src="https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=1200&q=80"
          alt="Dons"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/90 via-orange-600/85 to-amber-800/90" />
        <div className="relative px-6 py-12 md:px-12 text-white flex items-end justify-between min-h-[260px]">
          <div>
            <p className="text-white/60 font-bold tracking-[0.2em] text-xs uppercase mb-2">{isTreasury ? 'Espace de gestion' : 'Donnez avec joie'}</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none text-white">{isTreasury ? 'Tableau de' : 'Dons &'}</h1>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none text-amber-300">{isTreasury ? 'trésorerie' : 'Finances'}</h1>
            <p className="text-white/70 mt-3 text-sm">{isTreasury ? 'Suivi des dîmes et paiements réellement encaissés.' : "Chacun donnera selon l'intention de son cœur — 2 Cor. 9:7"}</p>
          </div>
          {myDonations.length > 0 && (
            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center hidden md:block">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Encaissements confirmés</p>
              <p className="text-2xl font-black">{totalDonated.toLocaleString()}</p>
              <p className="text-xs text-white/60">XAF encaissé</p>
            </div>
          )}
        </div>
      </div>

      {isTreasury ? (
        <FinanceWorkspace
          donations={myDonations}
          campaigns={campaigns}
          members={financeMembers}
          ledger={financeLedger}
          expenses={financeExpenses}
          activeCashSession={cashSessions?.active || null}
          cashSessions={cashSessions?.sessions || []}
          isLoadingCashSessions={isLoadingCashSessions}
          cashSessionsError={cashSessionsError}
          currentUserId={user?.id}
          isTreasurer={Boolean(isSystemAdministrator(user) || user?.roles?.includes('TRESORIER'))}
          isFinancialController={Boolean(isSystemAdministrator(user) || user?.roles?.includes('CONTROLEUR_FIN'))}
          isLoading={isLoadingDonations}
          hasError={donationsError}
          isLoadingMembers={isLoadingMembers}
          membersError={membersError}
          isLoadingLedger={isLoadingLedger}
          ledgerError={ledgerError}
          isLoadingExpenses={isLoadingExpenses}
          expensesError={expensesError}
          onRegister={() => openDonateFor('tithe')}
        />
      ) : (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
        {cinetPayTransactionId && (
          <div role="status" className={`rounded-2xl border p-4 text-sm ${
            cinetPayStatus?.status === 'accepted'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : cinetPayStatus?.status === 'refused'
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          }`}>
            {isCheckingCinetPay
              ? 'Vérification du paiement auprès de CinetPay…'
              : cinetPayStatus?.status === 'accepted'
                ? 'Paiement confirmé par CinetPay. Votre contribution est comptabilisée.'
                : cinetPayStatus?.status === 'refused'
                  ? 'Paiement refusé ou annulé. Aucun montant n’a été comptabilisé.'
                  : cinetPayStatus?.status === 'pending'
                    ? 'Paiement en attente de confirmation de CinetPay. Vérification automatique pendant 10 minutes; vous pourrez ensuite relancer la vérification manuellement.'
                    : cinetPayStatusError
                      ? 'Impossible de vérifier le statut auprès de CinetPay. Réessayez la vérification manuellement.'
                      : 'Le statut du paiement sera vérifié auprès de CinetPay.'}
            {cinetPayTransactionId && !['accepted', 'refused'].includes(cinetPayStatus?.status) && !isCheckingCinetPay && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={isCheckingCinetPay}
                onClick={() => refetchCinetPayStatus()}
              >
                Vérifier à nouveau
              </Button>
            )}
          </div>
        )}

        {/* Mobile total */}
        {myDonations.length > 0 && (
          <div className="md:hidden bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 rounded-3xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Total des encaissements confirmés</p>
              <p className="text-2xl font-black text-amber-600">{totalDonated.toLocaleString()} XAF</p>
            </div>
          </div>
        )}

        {/* === SECTION DÎME & OFFRANDE === */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 mb-1">Actes de culte</p>
          <h2 className="text-2xl font-black uppercase tracking-wide mb-4">Dîmes & Offrandes</h2>
          <div className="grid grid-cols-2 gap-4">
            <GivingCard
              icon={HandCoins}
              title="Dîme"
              subtitle="10% de vos revenus pour Dieu"
              gradient="from-violet-600 to-purple-800"
              image="https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=600&q=80"
              onClick={() => openDonateFor('tithe')}
            />
            <GivingCard
              icon={Gift}
              title="Offrande"
              subtitle="Offrez de bon cœur"
              gradient="from-amber-500 to-orange-700"
              image="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80"
              onClick={() => openDonateFor('offering')}
            />
          </div>
        </section>

        {/* === SECTION SOLIDARITÉ === */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500 mb-1">Amour du prochain</p>
          <h2 className="text-2xl font-black uppercase tracking-wide mb-4">Collecte de Solidarité</h2>
          <div className="relative rounded-3xl overflow-hidden shadow-xl mb-4">
            <img
              src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80"
              alt="Solidarité"
              className="w-full h-44 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-white font-black text-xl mb-1">Aidons nos frères dans le besoin</h3>
              <p className="text-white/70 text-sm">Orphelins, veuves, malades, démunis — personne ne sera laissé seul</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SOLIDARITY_CATEGORIES.map(cat => (
              <div
                key={cat.id}
                onClick={() => { setSolidarityCategory(cat.id); openDonateFor('solidarity'); }}
                className="bg-card border border-border/50 rounded-2xl p-4 cursor-pointer hover:border-red-400/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="text-3xl mb-2">{cat.emoji}</div>
                <h4 className="font-black text-sm">{cat.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
                <div className="mt-3 text-xs font-bold text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Contribuer →</div>
              </div>
            ))}
          </div>
        </section>

        {/* === SECTION CAMPAGNES === */}
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-1">Projets en cours</p>
          <h2 className="text-2xl font-black uppercase tracking-wide mb-4">Campagnes actives</h2>
          {campaigns.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-3xl">
              <Target className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">Aucune campagne active pour l'instant</p>
            </div>
          ) : campaigns.map((campaign) => {
            const progress = campaign.goal_amount > 0 ? Math.min(100, (campaign.raised_amount / campaign.goal_amount) * 100) : 0;
            return (
              <div key={campaign.id} className="bg-card border border-border/50 rounded-3xl overflow-hidden hover:shadow-xl transition-all mb-4">
                {campaign.image_url ? (
                  <img src={campaign.image_url} alt="" className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                    <Target className="w-12 h-12 text-primary/30" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-black text-xl mb-1">{campaign.title}</h3>
                  {campaign.description && <p className="text-sm text-muted-foreground mb-4">{campaign.description}</p>}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-black text-primary text-lg">{(campaign.raised_amount || 0).toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">{campaign.currency}</span></span>
                      <span className="text-muted-foreground">/ {campaign.goal_amount?.toLocaleString()} {campaign.currency}</span>
                    </div>
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 font-semibold">{Math.round(progress)}% atteint</p>
                  </div>
                  <Button
                    className="w-full rounded-2xl h-11 font-bold bg-amber-500 hover:bg-amber-400 text-black"
                    onClick={() => openDonateFor('campaign', campaign.id)}
                  >
                    <Target className="w-4 h-4 mr-2" />Contribuer
                  </Button>
                </div>
              </div>
            );
          })}
        </section>

        {/* === HISTORIQUE === */}
        {myDonations.length > 0 && (
          <section>
            <h2 className="text-2xl font-black uppercase tracking-wide mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />Mon Historique
            </h2>
            <div className="space-y-3">
              {myDonations.slice(0, 10).map((don) => (
                <div key={don.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {donationIcons[don.type] || '💛'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{donationLabels[don.type] || don.type}</p>
                    {don.created_date && <p className="text-xs text-muted-foreground">{format(new Date(don.created_date), 'd MMMM yyyy', { locale: fr })}</p>}
                    {don.receipt_number && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Reçu {don.receipt_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-primary">{don.amount?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{don.currency || 'XAF'}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                    {don.status === 'received' ? <ShieldCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    {don.status === 'received' ? 'Confirmé' : don.status === 'refused' || don.status === 'failed' ? 'Échoué' : don.payment_provider === 'cinetpay' ? 'En attente' : 'À vérifier'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}

      {/* Donate Dialog */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <span>{donationIcons[donationType] || '💛'}</span>
              {isTreasury ? `Encaisser : ${donationLabels[donationType] || 'Don'}` : donationLabels[donationType] || 'Don'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isTreasury && (
              <>
                <div className="space-y-1.5">
                  <Label className="font-semibold">Type d’encaissement</Label>
                  <Select value={donationType} onValueChange={setDonationType}>
                    <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tithe">Dîme</SelectItem>
                      <SelectItem value="offering">Offrande</SelectItem>
                      <SelectItem value="campaign">Cagnotte</SelectItem>
                      <SelectItem value="special">Don spécial</SelectItem>
                      <SelectItem value="solidarity">Solidarité</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold">Identification du donateur</Label>
                  <Select value={donorKind} onValueChange={(value) => {
                    setDonorKind(value);
                    setDonorMemberId('');
                    setDonorName('');
                    setDonorEmail('');
                  }}>
                    <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membre de l’église</SelectItem>
                      <SelectItem value="external">Autre donateur nommé</SelectItem>
                      <SelectItem value="anonymous">Don anonyme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {donorKind === 'member' && (
                  <div className="space-y-2">
                    <Label htmlFor="donor-member-search" className="font-semibold">Rechercher le membre</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="donor-member-search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Nom ou numéro de membre" className="h-11 rounded-2xl pl-9" />
                    </div>
                    {isLoadingMembers ? (
                      <p className="text-xs text-muted-foreground">Chargement des membres…</p>
                    ) : membersError ? (
                      <p role="alert" className="text-xs text-destructive">Impossible de charger la liste des membres. Actualisez la page pour réessayer.</p>
                    ) : financeMembers.length === 0 ? (
                      <p className="rounded-xl bg-muted/70 p-3 text-xs text-muted-foreground">
                        Aucun membre n’est enregistré. Choisissez « Autre donateur nommé » ou « Don anonyme » pour continuer.
                      </p>
                    ) : (
                      <Select value={donorMemberId} onValueChange={setDonorMemberId}>
                        <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger>
                        <SelectContent>
                          {financeMembers
                            .filter((member) => `${member.full_name || ''} ${member.numero_membre || ''}`.toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase()))
                            .slice(0, 100)
                            .map((member) => (
                              <SelectItem key={member.member_id} value={member.member_id}>
                                {member.full_name || `Membre ${member.numero_membre}`} · {member.numero_membre}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                    {donorMemberId && (
                      <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <UserRound className="h-3.5 w-3.5" />Cette dîme sera rattachée à l’historique du membre.
                      </p>
                    )}
                  </div>
                )}
                {donorKind === 'external' && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="donor-name" className="font-semibold">Nom du donateur</Label>
                      <Input id="donor-name" value={donorName} onChange={(event) => setDonorName(event.target.value)} maxLength={120} className="h-11 rounded-2xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="donor-email" className="font-semibold">E-mail (facultatif)</Label>
                      <Input id="donor-email" type="email" value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} maxLength={254} className="h-11 rounded-2xl" />
                    </div>
                  </>
                )}
                {donorKind === 'anonymous' && (
                  <p className="flex items-center gap-2 rounded-xl bg-muted/70 p-3 text-xs text-muted-foreground">
                    <UserRoundX className="h-4 w-4 shrink-0" />Aucun nom ni compte membre ne sera associé à cet encaissement.
                  </p>
                )}
              </>
            )}
            {donationType === 'campaign' && (
              <div className="space-y-1.5">
                <Label htmlFor="donation-campaign" className="font-semibold">Cagnotte</Label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger id="donation-campaign" className="h-11 rounded-2xl">
                    <SelectValue placeholder="Sélectionner une cagnotte" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.filter((campaign) => campaign.is_active !== false).map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>{campaign.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {campaigns.filter((campaign) => campaign.is_active !== false).length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune cagnotte active n’est disponible.</p>
                )}
              </div>
            )}
            {donationType === 'solidarity' && (
              <div className="grid grid-cols-2 gap-2">
                {SOLIDARITY_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSolidarityCategory(cat.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${solidarityCategory === cat.id ? 'bg-red-50 border-red-400 text-red-700' : 'border-border hover:border-red-300'}`}
                  >
                    <div className="text-xl mb-1">{cat.emoji}</div>
                    <div className="text-xs font-bold">{cat.label}</div>
                  </button>
                ))}
              </div>
            )}
            {!isTreasury && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cinetpay-phone" className="font-semibold">Téléphone pour le paiement</Label>
                  <Input id="cinetpay-phone" type="tel" autoComplete="tel" required value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+242…" className="h-11 rounded-2xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cinetpay-email" className="font-semibold">E-mail pour le reçu</Label>
                  <Input id="cinetpay-email" type="email" autoComplete="email" required value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="nom@exemple.com" className="h-11 rounded-2xl" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label className="font-semibold">Montant (XAF)</Label>
              <div className="flex gap-2 flex-wrap">
                {QUICK_AMOUNTS.map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${amount === String(v) ? 'bg-amber-500 text-black border-amber-500' : 'bg-muted border-border hover:border-amber-400'}`}
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
              <Input type="number" min="1" step="1" placeholder="Montant personnalisé..." value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-2xl mt-1" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">{isTreasury ? 'Mode réellement encaissé' : 'Moyen de paiement'}</Label>
              {!isTreasury && <p className="text-xs text-muted-foreground">Le guichet CinetPay vous demandera de confirmer l’opérateur ou la carte.</p>}
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isTreasury && <SelectItem value="cash">💵 Espèces reçues à la caisse</SelectItem>}
                  <SelectItem value="mobile_money">📱 Mobile Money</SelectItem>
                  <SelectItem value="card">💳 Carte bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isTreasury && paymentMethod !== 'cash' && (
              <div className="space-y-1.5">
                <Label htmlFor="payment-reference" className="font-semibold">Référence du paiement vérifié</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  maxLength={120}
                  placeholder="Numéro de transaction Mobile Money ou carte"
                  className="h-11 rounded-2xl"
                />
              </div>
            )}
            <Button
              className="w-full h-12 rounded-2xl font-bold bg-amber-500 hover:bg-amber-400 text-black text-base"
              onClick={() => donateMutation.mutate({
                amount: parseFloat(amount), type: donationType, payment_method: paymentMethod,
                donor_name: isTreasury && donorKind === 'external' ? donorName.trim() : undefined,
                donor_email: isTreasury && donorKind === 'external' ? donorEmail.trim() : undefined,
                donor_member_id: isTreasury && donorKind === 'member' ? donorMemberId : undefined,
                donor_anonymous: isTreasury && donorKind === 'anonymous',
                campaign_id: donationType === 'campaign' ? selectedCampaignId : undefined,
                payment_reference: isTreasury && paymentMethod !== 'cash' ? paymentReference.trim() : undefined,
                currency: 'XAF',
              })}
              disabled={
                !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || donateMutation.isPending
                || (!isTreasury && (cinetPayConfig?.enabled !== true || cinetPayConfigError || !customerPhone.trim() || !customerEmail.trim()))
                || (isTreasury && donorKind === 'member' && (!donorMemberId || isLoadingMembers || membersError))
                || (isTreasury && donorKind === 'external' && !donorName.trim())
                || (isTreasury && paymentMethod !== 'cash' && !paymentReference.trim())
                || (donationType === 'campaign' && !selectedCampaignId)
              }
            >
              {isTreasury ? <ShieldCheck className="w-5 h-5 mr-2" /> : <HandCoins className="w-5 h-5 mr-2" />}
              {isTreasury ? 'Confirmer l’encaissement' : donateMutation.isPending ? 'Connexion à CinetPay…' : 'Continuer vers le paiement'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {isTreasury
                ? 'Ne confirmez qu’un montant réellement reçu ou un paiement électronique vérifié par la trésorerie.'
                : cinetPayConfigError
                  ? 'Impossible de vérifier la configuration du paiement. Réessayez plus tard.'
                  : isLoadingCinetPayConfig
                    ? 'Vérification de la configuration de paiement…'
                  : cinetPayConfig?.enabled === true
                  ? 'Le grand livre est mis à jour uniquement après vérification serveur du paiement par CinetPay.'
                  : cinetPayConfig?.reason || 'Le paiement CinetPay n’est pas encore prêt. Contactez l’administration.'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanceWorkspace({
  donations,
  campaigns,
  members,
  ledger,
  expenses,
  activeCashSession,
  cashSessions,
  isLoadingCashSessions,
  cashSessionsError,
  currentUserId,
  isTreasurer,
  isFinancialController,
  isLoading,
  hasError,
  isLoadingMembers,
  membersError,
  isLoadingLedger,
  ledgerError,
  isLoadingExpenses,
  expensesError,
  onRegister,
}) {
  const queryClient = useQueryClient();
  const [cashSessionFormOpen, setCashSessionFormOpen] = useState(false);
  const [cashSessionLabel, setCashSessionLabel] = useState('Culte');
  const [closeCashSessionOpen, setCloseCashSessionOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [confirmingDonation, setConfirmingDonation] = useState(/** @type {DonationRecord | null} */ (null));
  const [confirmationReference, setConfirmationReference] = useState('');
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState({ category: 'general', description: '', vendor_name: '', invoice_reference: '', amount: '' });
  const [expenseToPay, setExpenseToPay] = useState(null);
  const [expenseToReject, setExpenseToReject] = useState(null);
  const [expenseRejectionReason, setExpenseRejectionReason] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('cash');
  const [expensePaymentReference, setExpensePaymentReference] = useState('');
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState({ title: '', description: '', goal_amount: '', image_url: '', end_date: '' });
  const [isUploadingCampaignImage, setIsUploadingCampaignImage] = useState(false);
  const refreshCashSession = () => queryClient.invalidateQueries({ queryKey: ['finance-cash-sessions'] });
  const openCashSessionMutation = useMutation({
    mutationFn: () => appClient.finance.openCashSession({ label: cashSessionLabel.trim() }),
    onSuccess: async () => {
      await refreshCashSession();
      setCashSessionFormOpen(false);
      setCashSessionLabel('Culte');
      toast.success('Caisse ouverte à 0 XAF. Les encaissements en espèces sont maintenant rattachés à cette session.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible d’ouvrir la caisse.'),
  });
  const closeCashSessionMutation = useMutation({
    mutationFn: () => appClient.finance.closeCashSession(activeCashSession.id, { counted_cash: countedCash }),
    onSuccess: async (session) => {
      await refreshCashSession();
      setCloseCashSessionOpen(false);
      setCountedCash('');
      const variance = Number(session.variance);
      toast.success(variance === 0
        ? 'Caisse clôturée. Le comptage correspond au solde théorique.'
        : `Caisse clôturée avec un écart de ${variance.toLocaleString()} XAF.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de clôturer la caisse.'),
  });
  const paymentMethods = {
    cash: 'Espèces',
    mtn_momo: 'MTN Mobile Money',
    airtel_money: 'Airtel Money',
    visa: 'Carte Visa',
    mobile_money: 'Mobile Money · CinetPay',
    card: 'Carte bancaire · CinetPay',
  };
  const receivedDonations = donations.filter((donation) => donation.status === 'received');
  const pendingDonations = donations.filter((donation) => donation.status !== 'received');
  const confirmMutation = useMutation({
    /** @param {{ donationId: string, paymentReference: string }} data */
    mutationFn: ({ donationId, paymentReference }) => appClient.entities.Donation.update(donationId, {
      action: 'confirm',
      payment_reference: paymentReference,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-donations'] });
      setConfirmingDonation(null);
      setConfirmationReference('');
      toast.success('Paiement vérifié et ajouté aux encaissements.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de confirmer ce paiement.'),
  });
  const createExpenseMutation = useMutation({
    /** @param {{ category: string, description: string, vendor_name: string, invoice_reference: string, amount: number }} data */
    mutationFn: (data) => appClient.finance.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      setExpenseFormOpen(false);
      setExpenseDraft({ category: 'general', description: '', vendor_name: '', invoice_reference: '', amount: '' });
      toast.success('Dépense transmise au contrôleur financier pour le premier contrôle.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de soumettre cette dépense.'),
  });
  const reviewExpenseMutation = useMutation({
    /** @param {{ id: string, action: 'approve' | 'reject', reason?: string }} data */
    mutationFn: ({ id, ...data }) => appClient.finance.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      setExpenseToReject(null);
      setExpenseRejectionReason('');
      toast.success('Décision enregistrée dans la piste d’audit.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de traiter cette dépense.'),
  });
  const payExpenseMutation = useMutation({
    /** @param {{ id: string, payment_method: string, payment_reference: string }} data */
    mutationFn: ({ id, ...data }) => appClient.finance.updateExpense(id, { action: 'pay', ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      refreshCashSession();
      queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      setExpenseToPay(null);
      setExpensePaymentReference('');
      toast.success('Dépense réglée et comptabilisée dans le journal.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de régler cette dépense.'),
  });
  const createCampaignMutation = useMutation({
    /** @param {Record<string, unknown>} data */
    mutationFn: (data) => appClient.entities.Campaign.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setCampaignFormOpen(false);
      setCampaignDraft({ title: '', description: '', goal_amount: '', image_url: '', end_date: '' });
      toast.success('Cagnotte créée et publiée.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Impossible de créer cette cagnotte.'),
  });
  const lastClosedCashSession = cashSessions.find((session) => session.status === 'closed');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <section className="glass-panel space-y-4 rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Banknote className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black">Caisse du culte</h2>
              {isLoadingCashSessions ? (
                <p className="mt-1 text-sm text-muted-foreground">Vérification de la session de caisse…</p>
              ) : cashSessionsError ? (
                <p role="alert" className="mt-1 text-sm text-destructive">Impossible de vérifier l’état de la caisse.</p>
              ) : activeCashSession ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Session ouverte · {activeCashSession.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ouverte le {format(new Date(activeCashSession.opened_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    {' · '}Solde théorique : {Number(activeCashSession.expected_cash).toLocaleString()} XAF
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Aucune session ouverte. Ouvrez la caisse avant de saisir les espèces du culte.</p>
              )}
            </div>
          </div>
          {activeCashSession && isTreasurer ? (
            <Button type="button" variant="outline" onClick={() => {
              setCountedCash('');
              setCloseCashSessionOpen(true);
            }} className="rounded-2xl font-bold">
              <LockKeyhole className="mr-2 h-4 w-4" />Clôturer la caisse
            </Button>
          ) : !activeCashSession && isTreasurer ? (
            <Button type="button" onClick={() => setCashSessionFormOpen(true)} disabled={isLoadingCashSessions || cashSessionsError} className="rounded-2xl font-bold">
              <Banknote className="mr-2 h-4 w-4" />Ouvrir la caisse
            </Button>
          ) : null}
        </div>
        {lastClosedCashSession && (
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 text-sm">
            <p className="text-muted-foreground">
              Dernière clôture · {lastClosedCashSession.label} · compté {Number(lastClosedCashSession.counted_cash).toLocaleString()} XAF
              {' · '}écart {Number(lastClosedCashSession.variance).toLocaleString()} XAF
            </p>
          </div>
        )}
        {cashSessionsError && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Le suivi de caisse nécessite la migration comptable des sessions de caisse.
          </p>
        )}
      </section>
      <div className="glass-panel flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total encaissé · 50 entrées récentes</p>
          <p className="text-3xl font-black text-primary">
            {receivedDonations.reduce((total, donation) => total + (Number(donation.amount) || 0), 0).toLocaleString()} XAF
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {receivedDonations.length} confirmé{receivedDonations.length === 1 ? '' : 's'} · {pendingDonations.length} en attente de vérification
          </p>
        </div>
        {isTreasurer && (
          <Button onClick={onRegister} disabled={!activeCashSession || isLoadingCashSessions || cashSessionsError} className="rounded-2xl font-bold">
            <HandCoins className="mr-2 h-4 w-4" />Enregistrer un encaissement
          </Button>
        )}
      </div>

      {ledgerError && <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Le grand livre est indisponible. Vérifiez que la migration comptable a été appliquée.</p>}
      <section className="glass-panel space-y-4 rounded-3xl p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Campagnes de cagnotte</h2>
            <p className="mt-1 text-sm text-muted-foreground">Créez une collecte avec un objectif et suivez sa progression sur la page publique des dons.</p>
          </div>
          {(isTreasurer || isFinancialController) && (
            <Button type="button" onClick={() => setCampaignFormOpen(true)} className="rounded-2xl font-bold">
              <Plus className="h-4 w-4" />Créer une cagnotte
            </Button>
          )}
        </div>
        {campaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Aucune cagnotte créée.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {campaigns.map((campaign) => {
              const goal = Number(campaign.goal_amount) || 0;
              const raised = Number(campaign.raised_amount) || 0;
              const progress = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
              return (
                <article key={campaign.id} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold">{campaign.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{campaign.is_active === false ? 'Clôturée' : 'Active'}{campaign.end_date ? ` · Fin ${campaign.end_date}` : ''}</p>
                    </div>
                    <Target className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="font-bold text-primary">{raised.toLocaleString()} {campaign.currency || 'XAF'}</span>
                    <span className="text-muted-foreground">Objectif {goal.toLocaleString()} {campaign.currency || 'XAF'}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {!ledgerError && (
        <section className="glass-panel space-y-5 rounded-3xl p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Grand livre en partie double</h2>
              <p className="mt-1 text-sm text-muted-foreground">Chaque encaissement confirmé et chaque dépense payée produit une écriture débit/crédit équilibrée et non modifiable.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin/finance/accounts"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
              >
                <BookOpen className="h-4 w-4" />Détails des comptes
              </Link>
              {!isLoadingLedger && ledger?.totals && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {ledger.totals.posted_entries} écritures · débits {Number(ledger.totals.debits).toLocaleString()} XAF · crédits {Number(ledger.totals.credits).toLocaleString()} XAF
                </span>
              )}
            </div>
          </div>
          {isLoadingLedger ? (
            <p className="py-5 text-center text-sm text-muted-foreground">Chargement du grand livre…</p>
          ) : ledger?.journals?.length ? (
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-3">N° journal</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Libellé</th><th className="px-4 py-3 text-right">Équilibre</th></tr>
                </thead>
                <tbody>
                  {ledger.journals.slice(0, 10).map((journal) => (
                    <tr key={journal.id} className="border-t border-border/50">
                      <td className="px-4 py-3 font-semibold">{journal.entry_number}</td>
                      <td className="px-4 py-3">{format(new Date(journal.entry_date), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3">{journal.description}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">Débit = crédit</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Le grand livre commencera à la première opération confirmée.</p>
          )}
        </section>
      )}

      <section className="glass-panel rounded-3xl p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Dépenses et contrôles</h2>
            <p className="mt-1 text-sm text-muted-foreground">Chaque décaissement doit être contrôlé par le contrôleur financier, puis approuvé par le pasteur principal avant règlement.</p>
          </div>
          {isTreasurer && (
            <Button type="button" onClick={() => setExpenseFormOpen(true)} className="rounded-2xl font-bold">
              <HandCoins className="mr-2 h-4 w-4" />Enregistrer une dépense
            </Button>
          )}
        </div>
        {expensesError ? (
          <p role="alert" className="py-5 text-center text-sm text-destructive">Impossible de charger les dépenses.</p>
        ) : isLoadingExpenses ? (
          <p className="py-5 text-center text-sm text-muted-foreground">Chargement des dépenses…</p>
        ) : expenses.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">Aucune dépense enregistrée.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <article key={expense.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{expense.description}</p>
                  <p className="text-sm text-muted-foreground">{expenseCategoryLabels[expense.category] || expense.category} · {expense.vendor_name} · {expense.expense_number}</p>
                  {expense.invoice_reference && <p className="text-xs text-muted-foreground">Pièce : {expense.invoice_reference}</p>}
                  {expense.rejection_reason && <p className="text-xs text-destructive">Rejet : {expense.rejection_reason}</p>}
                </div>
                <div className="text-right">
                  <p className="font-black text-primary">{Number(expense.amount).toLocaleString()} {expense.currency}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {expense.status === 'pending_review'
                      ? 'À contrôler'
                      : expense.status === 'pending_pastor'
                        ? 'En attente du pasteur'
                        : expense.status === 'approved'
                          ? 'Approuvée · à régler'
                          : expense.status === 'rejected' ? 'Rejetée' : 'Payée'}
                  </p>
                </div>
                {isFinancialController && expense.status === 'pending_review' && (
                  <>
                    <Button type="button" size="sm" onClick={() => reviewExpenseMutation.mutate({ id: expense.id, action: 'approve' })} disabled={reviewExpenseMutation.isPending || expense.requested_by === currentUserId} className="rounded-xl">
                      Transmettre au pasteur
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExpenseToReject(expense);
                        setExpenseRejectionReason('');
                      }}
                      disabled={reviewExpenseMutation.isPending || expense.requested_by === currentUserId}
                      className="rounded-xl"
                    >
                      Rejeter
                    </Button>
                  </>
                )}
                {isTreasurer && expense.status === 'approved' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExpenseToPay(expense);
                      setExpensePaymentMethod('cash');
                      setExpensePaymentReference('');
                    }}
                    className="rounded-xl"
                  >
                    Régler
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass-panel rounded-3xl p-5 md:p-7">
        <div className="mb-5">
          <h2 className="text-xl font-black">Registre de la trésorerie</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seuls les montants réellement reçus ou les paiements électroniques vérifiés sont comptés comme encaissés.
          </p>
          {membersError && <p role="alert" className="mt-2 text-sm text-destructive">La liste des membres n’a pas pu être chargée pour le moment.</p>}
          {!isLoadingMembers && !membersError && <p className="mt-2 text-xs text-muted-foreground">{members.length} membres disponibles pour rattacher une dîme à leur historique.</p>}
        </div>
        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">Chargement du registre…</p>
        ) : hasError ? (
          <p role="alert" className="py-10 text-center text-destructive">Impossible de charger le registre. Réessayez plus tard.</p>
        ) : donations.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Aucun engagement enregistré.</p>
        ) : (
          <div className="space-y-3">
            {donations.map((donation) => (
              <article key={donation.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-xl">
                  {donationIcons[donation.type] || '💛'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{donation.donor_name || 'Donateur non renseigné'}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {donationLabels[donation.type] || donation.type} · {paymentMethods[donation.payment_method] || 'Mode non précisé'}
                  </p>
                  {donation.payment_reference && <p className="truncate text-xs text-muted-foreground">Réf. {donation.payment_reference}</p>}
                  {donation.receipt_number && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Reçu {donation.receipt_number}</p>}
                  {donation.created_date && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(donation.created_date), 'd MMMM yyyy', { locale: fr })}
                    </p>
                  )}
                  {donation.donor_anonymous && <p className="text-xs font-medium text-muted-foreground">Don anonyme</p>}
                </div>
                <div className="text-right">
                  <p className="font-black text-primary">{Number(donation.amount || 0).toLocaleString()} {donation.currency || 'XAF'}</p>
                  <p className={`text-xs font-semibold ${donation.status === 'received' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {donation.status === 'received'
                      ? 'Encaissé'
                      : donation.status === 'refused' || donation.status === 'failed'
                        ? 'Échoué'
                        : donation.payment_provider === 'cinetpay' ? 'CinetPay · En attente' : 'À vérifier'}
                  </p>
                </div>
                {isFinancialController && donation.status === 'pending' && donation.payment_provider !== 'cinetpay' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setConfirmingDonation(donation);
                      setConfirmationReference('');
                    }}
                    className="rounded-xl"
                  >
                    Vérifier
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(confirmingDonation)}
        onOpenChange={(open) => {
          if (!open && !confirmMutation.isPending) {
            setConfirmingDonation(null);
            setConfirmationReference('');
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />Vérifier le paiement
            </DialogTitle>
          </DialogHeader>
          {confirmingDonation && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirmez uniquement après vérification effective du paiement{confirmingDonation.payment_method !== 'cash' ? ' dans le compte Mobile Money ou le relevé bancaire' : ' reçu à la caisse'}.
              </p>
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="font-bold">{confirmingDonation.donor_name || 'Donateur anonyme'}</p>
                <p className="text-muted-foreground">{donationLabels[confirmingDonation.type] || confirmingDonation.type} · {paymentMethods[confirmingDonation.payment_method] || 'Mode non précisé'}</p>
                <p className="mt-1 font-black text-primary">{Number(confirmingDonation.amount || 0).toLocaleString()} {confirmingDonation.currency || 'XAF'}</p>
              </div>
              {confirmingDonation.payment_method !== 'cash' && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmation-reference">Référence de transaction</Label>
                  <Input
                    id="confirmation-reference"
                    value={confirmationReference}
                    onChange={(event) => setConfirmationReference(event.target.value)}
                    maxLength={120}
                    placeholder="Référence visible sur le relevé"
                    className="h-11 rounded-2xl"
                  />
                </div>
              )}
              <Button
                type="button"
                className="h-11 w-full rounded-2xl font-bold"
                onClick={() => confirmMutation.mutate({
                  donationId: confirmingDonation.id,
                  paymentReference: confirmationReference.trim(),
                })}
                disabled={confirmMutation.isPending || (confirmingDonation.payment_method !== 'cash' && !confirmationReference.trim())}
              >
                {confirmMutation.isPending ? 'Vérification…' : 'Confirmer comme encaissé'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={campaignFormOpen}
        onOpenChange={(open) => {
          if (!open && !createCampaignMutation.isPending && !isUploadingCampaignImage) setCampaignFormOpen(false);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Target className="h-5 w-5 text-primary" />Créer une cagnotte
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-title">Nom de la cagnotte</Label>
              <Input id="campaign-title" value={campaignDraft.title} onChange={(event) => setCampaignDraft((current) => ({ ...current, title: event.target.value }))} maxLength={160} placeholder="Ex. Construction de la salle" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea id="campaign-description" value={campaignDraft.description} onChange={(event) => setCampaignDraft((current) => ({ ...current, description: event.target.value }))} maxLength={2000} placeholder="Expliquez l’objectif de cette collecte." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-goal">Objectif (XAF)</Label>
                <Input id="campaign-goal" type="number" min="1" step="1" value={campaignDraft.goal_amount} onChange={(event) => setCampaignDraft((current) => ({ ...current, goal_amount: event.target.value }))} placeholder="Ex. 500000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-end-date">Date de fin (facultative)</Label>
                <Input id="campaign-end-date" type="date" value={campaignDraft.end_date} onChange={(event) => setCampaignDraft((current) => ({ ...current, end_date: event.target.value }))} />
              </div>
            </div>
            <ImageUploadField
              id="campaign-image"
              label="Affiche de la cagnotte (facultative)"
              value={campaignDraft.image_url}
              onChange={(image_url) => setCampaignDraft((current) => ({ ...current, image_url }))}
              onUploadingChange={setIsUploadingCampaignImage}
            />
            <Button
              type="button"
              className="h-11 w-full rounded-2xl font-bold"
              onClick={() => createCampaignMutation.mutate({
                title: campaignDraft.title.trim(),
                description: campaignDraft.description.trim(),
                goal_amount: Number(campaignDraft.goal_amount),
                image_url: campaignDraft.image_url,
                end_date: campaignDraft.end_date || null,
              })}
              disabled={
                createCampaignMutation.isPending
                || isUploadingCampaignImage
                || !campaignDraft.title.trim()
                || !Number.isSafeInteger(Number(campaignDraft.goal_amount))
                || Number(campaignDraft.goal_amount) <= 0
              }
            >
              {createCampaignMutation.isPending ? 'Création…' : 'Créer et publier la cagnotte'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cashSessionFormOpen}
        onOpenChange={(open) => {
          if (!open && !openCashSessionMutation.isPending) setCashSessionFormOpen(false);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Ouvrir la caisse du culte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
              La caisse démarre à 0 XAF. Tous les encaissements et règlements en espèces seront enregistrés dans cette session jusqu’à sa clôture.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cash-session-label">Culte ou activité</Label>
              <Input
                id="cash-session-label"
                maxLength={160}
                value={cashSessionLabel}
                onChange={(event) => setCashSessionLabel(event.target.value)}
                placeholder="Ex. Culte du dimanche matin"
                className="h-11 rounded-2xl"
              />
            </div>
            <Button
              type="button"
              className="h-11 w-full rounded-2xl font-bold"
              onClick={() => openCashSessionMutation.mutate()}
              disabled={openCashSessionMutation.isPending || !cashSessionLabel.trim()}
            >
              {openCashSessionMutation.isPending ? 'Ouverture…' : 'Ouvrir à 0 XAF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closeCashSessionOpen}
        onOpenChange={(open) => {
          if (!open && !closeCashSessionMutation.isPending) setCloseCashSessionOpen(false);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Clôturer la caisse</DialogTitle>
          </DialogHeader>
          {activeCashSession && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="font-bold">{activeCashSession.label}</p>
                <p className="mt-1 text-muted-foreground">Solde théorique : {Number(activeCashSession.expected_cash).toLocaleString()} XAF</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-counted">Espèces réellement comptées (XAF)</Label>
                <Input
                  id="cash-counted"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>
              <p className="text-xs text-muted-foreground">L’écart entre le montant compté et le solde théorique sera conservé dans l’historique d’audit.</p>
              <Button
                type="button"
                className="h-11 w-full rounded-2xl font-bold"
                onClick={() => closeCashSessionMutation.mutate()}
                disabled={
                  closeCashSessionMutation.isPending
                  || !/^\d{1,20}$/.test(countedCash)
                }
              >
                {closeCashSessionMutation.isPending ? 'Clôture…' : 'Confirmer le comptage et clôturer'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={expenseFormOpen}
        onOpenChange={(open) => {
          if (!createExpenseMutation.isPending) setExpenseFormOpen(open);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Soumettre une dépense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">La dépense reste hors du grand livre jusqu’à son approbation indépendante et son paiement réel.</p>
            <div className="space-y-1.5">
              <Label>Catégorie comptable</Label>
              <Select value={expenseDraft.category} onValueChange={(category) => setExpenseDraft((draft) => ({ ...draft, category }))}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(expenseCategoryLabels).map(([category, label]) => <SelectItem key={category} value={category}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="expense-amount">Montant (XAF)</Label>
                <Input id="expense-amount" type="number" min="1" step="1" value={expenseDraft.amount} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, amount: event.target.value }))} className="h-11 rounded-2xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expense-vendor">Bénéficiaire / fournisseur</Label>
                <Input id="expense-vendor" maxLength={160} value={expenseDraft.vendor_name} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, vendor_name: event.target.value }))} className="h-11 rounded-2xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-description">Motif détaillé</Label>
              <Textarea id="expense-description" rows={3} maxLength={500} value={expenseDraft.description} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, description: event.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-invoice">Référence de facture / pièce (facultatif)</Label>
              <Input id="expense-invoice" maxLength={120} value={expenseDraft.invoice_reference} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, invoice_reference: event.target.value }))} className="h-11 rounded-2xl" />
            </div>
            <Button
              type="button"
              className="h-11 w-full rounded-2xl font-bold"
              onClick={() => createExpenseMutation.mutate({
                ...expenseDraft,
                amount: Number(expenseDraft.amount),
              })}
              disabled={
                createExpenseMutation.isPending
                || !Number.isSafeInteger(Number(expenseDraft.amount))
                || Number(expenseDraft.amount) <= 0
                || !expenseDraft.vendor_name.trim()
                || !expenseDraft.description.trim()
              }
            >
              {createExpenseMutation.isPending ? 'Envoi…' : 'Soumettre au contrôleur'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(expenseToPay)}
        onOpenChange={(open) => {
          if (!open && !payExpenseMutation.isPending) setExpenseToPay(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Régler la dépense approuvée</DialogTitle>
          </DialogHeader>
          {expenseToPay && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="font-bold">{expenseToPay.description}</p>
                <p className="text-muted-foreground">{expenseToPay.vendor_name} · {expenseToPay.expense_number}</p>
                <p className="mt-1 font-black text-primary">{Number(expenseToPay.amount).toLocaleString()} XAF</p>
              </div>
              <div className="space-y-1.5">
                <Label>Mode de règlement réel</Label>
                <Select value={expensePaymentMethod} onValueChange={setExpensePaymentMethod}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
                    <SelectItem value="airtel_money">Airtel Money</SelectItem>
                    <SelectItem value="visa">Carte Visa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {expensePaymentMethod !== 'cash' && (
                <div className="space-y-1.5">
                  <Label htmlFor="expense-payment-reference">Référence du paiement</Label>
                  <Input id="expense-payment-reference" maxLength={120} value={expensePaymentReference} onChange={(event) => setExpensePaymentReference(event.target.value)} className="h-11 rounded-2xl" />
                </div>
              )}
              <Button
                type="button"
                className="h-11 w-full rounded-2xl font-bold"
                onClick={() => payExpenseMutation.mutate({
                  id: expenseToPay.id,
                  payment_method: expensePaymentMethod,
                  payment_reference: expensePaymentReference.trim(),
                })}
                disabled={payExpenseMutation.isPending || (expensePaymentMethod !== 'cash' && !expensePaymentReference.trim())}
              >
                {payExpenseMutation.isPending ? 'Enregistrement…' : 'Confirmer le paiement réel'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(expenseToReject)}
        onOpenChange={(open) => {
          if (!open && !reviewExpenseMutation.isPending) {
            setExpenseToReject(null);
            setExpenseRejectionReason('');
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Rejeter la dépense</DialogTitle>
          </DialogHeader>
          {expenseToReject && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{expenseToReject.expense_number} · {expenseToReject.description}</p>
              <div className="space-y-1.5">
                <Label htmlFor="expense-rejection-reason">Motif du rejet</Label>
                <Textarea id="expense-rejection-reason" rows={3} maxLength={300} value={expenseRejectionReason} onChange={(event) => setExpenseRejectionReason(event.target.value)} className="rounded-2xl" />
              </div>
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full rounded-2xl font-bold"
                onClick={() => reviewExpenseMutation.mutate({
                  id: expenseToReject.id,
                  action: 'reject',
                  reason: expenseRejectionReason.trim(),
                })}
                disabled={reviewExpenseMutation.isPending || !expenseRejectionReason.trim()}
              >
                {reviewExpenseMutation.isPending ? 'Enregistrement…' : 'Confirmer le rejet'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// History icon local