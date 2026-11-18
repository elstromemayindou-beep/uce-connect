import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, Shield } from 'lucide-react';
import { appClient } from '@/api/appClient';

const actionLabels = {
  event_attendance_updated: 'Présence mise à jour',
  event_created: 'Événement créé',
  event_deleted: 'Événement supprimé',
  event_registration_cancelled: 'Inscription annulée',
  event_registration_created: 'Inscription à un événement',
  event_updated: 'Événement modifié',
  expense_controller_approved: 'Dépense approuvée',
  expense_created: 'Dépense créée',
  expense_paid: 'Dépense payée',
  journal_posted: 'Écriture comptable enregistrée',
  member_account_linked: 'Compte rattaché à un membre',
  member_archived: 'Membre archivé',
  member_created: 'Membre ajouté',
  member_reactivated: 'Membre réactivé',
  member_self_registered: 'Inscription d’un membre',
  member_updated: 'Fiche membre modifiée',
  notification_sent: 'Notification diffusée',
  role_assigned: 'Rôle attribué',
  role_revoked: 'Rôle révoqué',
};

function getAuditDetails(event) {
  const fields = event.details?.fields;
  if (Array.isArray(fields) && fields.length) return `Champs modifiés : ${fields.join(', ')}`;
  if (event.details?.status === 'present') return 'Participant marqué présent';
  if (event.details?.status === 'absent') return 'Participant marqué absent';
  if (event.details?.recipient_count) return `${event.details.recipient_count} destinataire(s)`;
  if (event.details?.matched_existing_record) return 'Fiche existante réutilisée';
  if (event.details?.target_type) return `Audience : ${event.details.target_type}`;
  return '';
}

export default function AuditLog() {
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => appClient.admin.audit(200),
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link to="/admin" className="text-sm font-bold text-primary">← Retour à l’administration</Link>
      <header className="glass-panel rounded-3xl p-6 md:p-8">
        <History className="mb-4 h-10 w-10 text-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Administration</p>
        <h1 className="mt-1 text-3xl font-black">Historique des actions</h1>
        <p className="mt-2 text-muted-foreground">Suivi des changements importants dans les membres, les rôles, les activités et les finances.</p>
      </header>

      <section className="glass-panel rounded-3xl p-4 md:p-6">
        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">Chargement de l’historique…</p>
        ) : isError ? (
          <p role="alert" className="py-10 text-center text-destructive">Impossible de charger l’historique ou accès non autorisé.</p>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Shield className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p>Aucune action enregistrée pour le moment.</p>
          </div>
        ) : (
          <ol className="divide-y divide-border/60">
            {events.map((event) => (
              <li key={`${event.source}-${event.id}`} className="flex flex-wrap gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{actionLabels[event.action] || event.action}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.actor_name} · {event.source === 'finance' ? 'Finances' : 'Administration'}
                  </p>
                  {getAuditDetails(event) && <p className="mt-1 text-xs text-muted-foreground">{getAuditDetails(event)}</p>}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={event.created_at}>
                  {format(new Date(event.created_at), 'dd MMM yyyy · HH:mm', { locale: fr })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
