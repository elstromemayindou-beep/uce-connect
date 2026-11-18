import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import webPush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerQuizRoutes } from './quiz.js';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const appOrigin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
const clientBuildDirectory = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const pushConfigValues = [
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
  process.env.VAPID_SUBJECT,
];
const pushConfigured = pushConfigValues.every(Boolean);
const bibleConfig = {
  apiKey: process.env.API_BIBLE_API_KEY,
  frenchId: process.env.API_BIBLE_FRENCH_ID,
  lingalaId: process.env.API_BIBLE_LINGALA_ID,
};
const cinetPayConfig = {
  apiKey: process.env.CINETPAY_API_KEY,
  siteId: process.env.CINETPAY_SITE_ID,
};
const cinetPayConfigured = Object.values(cinetPayConfig).every(Boolean);
const cinetPayBaseUrl = 'https://api-checkout.cinetpay.com/v2';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

function getSupabaseAdminClient() {
  if (!supabaseAdminKey) return null;
  return createClient(process.env.SUPABASE_URL, supabaseAdminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

if (pushConfigValues.some(Boolean) && !pushConfigured) {
  throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be configured together.');
}
if (pushConfigured) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}
if ([
  bibleConfig.apiKey,
  bibleConfig.frenchId,
  bibleConfig.lingalaId,
].some(Boolean) && ![
  bibleConfig.apiKey,
  bibleConfig.frenchId,
  bibleConfig.lingalaId,
].every(Boolean)) {
  throw new Error('API_BIBLE_API_KEY, API_BIBLE_FRENCH_ID and API_BIBLE_LINGALA_ID must be configured together.');
}
if (Object.values(cinetPayConfig).some(Boolean) && !cinetPayConfigured) {
  throw new Error('CINETPAY_API_KEY and CINETPAY_SITE_ID must be configured together.');
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured.');
}

app.use(cors({ origin: appOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/db-health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok' });
  } catch (error) {
    console.error('Database readiness check failed:', error);
    response.status(503).json({ status: 'unavailable', error: 'La base de données est temporairement inaccessible.' });
  }
});

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL']);
const STAFF_ROLES = new Set([
  ...ADMIN_ROLES,
  'RESP_DEPARTEMENT',
  'SECRETAIRE_DEPARTEMENT',
  'RESP_COMMISSION',
  'SECRETAIRE_COMMISSION',
]);
const FINANCE_ROLES = new Set(['TRESORIER', 'CONTROLEUR_FIN']);
const CAMPAIGN_MANAGEMENT_ROLES = new Set([...ADMIN_ROLES, ...FINANCE_ROLES]);
const MEMBER_MANAGEMENT_ROLES = new Set([...STAFF_ROLES, 'GESTIONNAIRE_MEMBRES']);
const EVENT_MANAGEMENT_ROLES = new Set([...STAFF_ROLES, 'SECRETAIRE_GENERAL']);
const ORGANIZATION_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL']);
const ENTITY_FIELDS = {
  Campaign: new Set(['title', 'description', 'goal_amount', 'raised_amount', 'currency', 'image_url', 'is_active', 'end_date']),
  Community: new Set(['name', 'description', 'city', 'country', 'logo_url', 'pastor_name', 'leader_name', 'member_count', 'contact_email', 'contact_phone', 'is_international']),
  DailyVerse: new Set(['text', 'reference', 'date']),
  DailyThought: new Set(['title', 'content', 'author']),
  Donation: new Set(['amount', 'type', 'payment_method', 'payment_reference', 'donor_name', 'donor_email', 'donor_member_id', 'donor_anonymous', 'currency', 'status', 'campaign_id']),
  Event: new Set(['title', 'description', 'type', 'date', 'time', 'location', 'image_url', 'department', 'status', 'capacity']),
  GalleryCategory: new Set(['name', 'description', 'color']),
  GalleryPhoto: new Set(['title', 'caption', 'image_url', 'album', 'service_date', 'category_id']),
  Group: new Set(['name', 'type', 'description', 'community_id', 'leader_email', 'members']),
  JournalEntry: new Set(['title', 'content', 'type', 'mood', 'entry_date', 'scripture']),
  PrayerRequest: new Set(['content', 'is_anonymous', 'is_private', 'author_name', 'status', 'prayer_count', 'prayed_by']),
  Sermon: new Set(['title', 'description', 'type', 'category', 'speaker', 'date', 'video_url', 'audio_url', 'stream_url', 'thumbnail_url', 'pdf_url', 'docx_url', 'duration', 'duration_minutes', 'scripture', 'series_name']),
  Team: new Set(['name', 'type', 'description', 'leader_email', 'members', 'image_url']),
};

function isFinance(identity) {
  return isSystemAdministrator(identity) || identity.roles.some((role) => FINANCE_ROLES.has(role));
}

function isTreasurer(identity) {
  return isSystemAdministrator(identity) || identity.roles.includes('TRESORIER');
}

function isFinancialController(identity) {
  return isSystemAdministrator(identity) || identity.roles.includes('CONTROLEUR_FIN');
}

function isSystemAdministrator(identity) {
  return identity.roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role));
}

function isPastor(identity) {
  return identity.roles.includes('PASTEUR_PRINCIPAL');
}

function canManageMembers(identity) {
  return isPastor(identity) || identity.roles.some((role) => (
    [...ORGANIZATION_ADMIN_ROLES, 'GESTIONNAIRE_MEMBRES'].includes(role)
  ));
}

function canManageOrganizationStructure(identity) {
  return identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role));
}

function canManageStudyContent(identity) {
  return isPastor(identity) || isSystemAdministrator(identity);
}

function isCommunication(identity) {
  return identity.roleAssignments.some((assignment) => assignment.departement_code === 'COM'
    && (assignment.niveau_portee === 'departement'
      && ['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT'].includes(assignment.code)
      || assignment.niveau_portee === 'commission'
      && ['RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code)));
}

function canManageNotifications(identity) {
  return isSystemAdministrator(identity) || isCommunication(identity);
}

function canManagePhotoGallery(identity) {
  return isChurchWideStaff(identity) || isCommunication(identity);
}

function getBibleId(language) {
  if (language === 'fr') return bibleConfig.frenchId;
  if (language === 'ln') return bibleConfig.lingalaId;
  return null;
}

async function requestBibleApi(path) {
  const response = await fetch(`https://api.scripture.api.bible/v1${path}`, {
    headers: { 'api-key': bibleConfig.apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.message || 'La source biblique est temporairement indisponible.');
    error.status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw error;
  }
  if (!result || !Object.hasOwn(result, 'data')) {
    throw new Error('La source biblique a renvoyé une réponse invalide.');
  }
  return result.data;
}

async function dispatchPushNotification(notificationId) {
  const claimed = await prisma.$queryRaw`
    UPDATE public.uce_notifications
    SET dispatch_status='processing',dispatch_attempted_at=now()
    WHERE id=${notificationId}::uuid AND dispatch_status='pending'
      AND scheduled_at<=now()
    RETURNING id,eglise_id,title,message,url
  `;
  const notification = claimed[0];
  if (!notification) return null;

  const subscriptions = await prisma.$queryRaw`
    SELECT DISTINCT s.id,s.endpoint,s.p256dh,s.auth_secret
    FROM public.uce_notification_recipients r
    JOIN public.uce_push_subscriptions s
      ON s.profile_id=r.profile_id AND s.eglise_id=r.eglise_id
    WHERE r.notification_id=${notification.id}::uuid
      AND r.eglise_id=${notification.eglise_id}::uuid
  `;
  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
      }, JSON.stringify({
        title: notification.title,
        body: notification.message.slice(0, 240),
        url: notification.url || '/',
      }));
      delivered += 1;
    } catch (error) {
      failed += 1;
      if ([404, 410].includes(error.statusCode)) {
        await prisma.$executeRaw`
          DELETE FROM public.uce_push_subscriptions WHERE id=${subscription.id}::uuid
        `;
      } else {
        console.error('Push delivery failed:', {
          notificationId: notification.id,
          subscriptionId: subscription.id,
          statusCode: error.statusCode,
        });
      }
    }
  }

  await prisma.$executeRaw`
    UPDATE public.uce_notifications
    SET dispatch_status=${failed ? 'failed' : 'sent'},
      delivery_count=${delivered},failure_count=${failed},
      dispatch_error=${failed ? `${failed} notification(s) n’ont pas été livrées.` : null}
    WHERE id=${notification.id}::uuid AND dispatch_status='processing'
  `;
  return { delivered, failed };
}

async function dispatchPendingNotifications() {
  await prisma.$executeRaw`
    UPDATE public.uce_notifications
    SET dispatch_status='pending'
    WHERE dispatch_status='processing'
      AND dispatch_attempted_at < now() - interval '10 minutes'
  `;
  const pending = await prisma.$queryRaw`
    SELECT id FROM public.uce_notifications
    WHERE dispatch_status='pending' AND scheduled_at<=now()
    ORDER BY scheduled_at,created_at
    LIMIT 25
  `;
  for (const { id } of pending) {
    await dispatchPushNotification(id);
  }
}

async function dispatchStudyReminders() {
  if (!pushConfigured) return;
  const reminderDate = getChurchAccountingDate();
  const dueMembers = await prisma.$queryRaw`
    SELECT p.profile_id,array_agg(p.lesson_id) AS lesson_ids,
      count(*)::int AS lesson_count
    FROM public.uce_study_progress p
    JOIN public.profils_utilisateurs profile
      ON profile.id=p.profile_id AND profile.eglise_id=p.eglise_id AND profile.statut='actif'
    WHERE p.opened_at IS NULL
      AND (p.last_reminder_date IS NULL OR p.last_reminder_date<${reminderDate}::date)
      AND EXISTS (
        SELECT 1 FROM public.uce_study_group_members gm
        WHERE gm.eglise_id=p.eglise_id AND gm.group_id=p.group_id
          AND gm.profile_id=p.profile_id
      )
      AND EXISTS (
        SELECT 1 FROM public.uce_push_subscriptions subscription
        WHERE subscription.eglise_id=p.eglise_id AND subscription.profile_id=p.profile_id
      )
    GROUP BY p.profile_id
    ORDER BY p.profile_id
    LIMIT 100
  `;
  for (const member of dueMembers) {
    const claimed = await prisma.$queryRaw`
      UPDATE public.uce_study_progress
      SET last_reminder_date=${reminderDate}::date,updated_at=now()
      WHERE profile_id=${member.profile_id}::uuid
        AND lesson_id=ANY(${member.lesson_ids}::uuid[])
        AND opened_at IS NULL
        AND (last_reminder_date IS NULL OR last_reminder_date<${reminderDate}::date)
        AND EXISTS (
          SELECT 1 FROM public.uce_study_group_members gm
          WHERE gm.eglise_id=uce_study_progress.eglise_id
            AND gm.group_id=uce_study_progress.group_id
            AND gm.profile_id=uce_study_progress.profile_id
        )
      RETURNING lesson_id
    `;
    if (!claimed.length) continue;
    const subscriptions = await prisma.$queryRaw`
      SELECT endpoint,p256dh,auth_secret FROM public.uce_push_subscriptions
      WHERE profile_id=${member.profile_id}::uuid
    `;
    const count = claimed.length;
    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, JSON.stringify({
          title: 'Rappel de formation',
          body: count === 1
            ? 'Un cours vous attend. Ouvrez votre formation pour le suivre.'
            : `${count} cours vous attendent. Ouvrez votre formation pour les suivre.`,
          url: '/studies',
        }));
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await prisma.$executeRaw`
            DELETE FROM public.uce_push_subscriptions WHERE endpoint=${subscription.endpoint}
          `;
        } else {
          console.error('Study reminder delivery failed:', error);
        }
      }
    }
  }
}

function isChurchWideStaff(identity) {
  return identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role) || role === 'SECRETAIRE_GENERAL');
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function writeAuditEvent(tx, { churchId, actorId, action, entityType, entityId, details = {} }) {
  await tx.$executeRaw`
    INSERT INTO public.uce_audit_events
      (eglise_id,actor_id,action,entity_type,entity_id,details)
    VALUES (
      ${churchId}::uuid,${actorId}::uuid,${action},${entityType},
      ${entityId}::uuid,${JSON.stringify(details)}::jsonb
    )
  `;
}

function isSafeWebUrl(value, { allowRelative = false } = {}) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (allowRelative && value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isSupportedStreamUrl(value) {
  if (!isSafeWebUrl(value)) return false;
  const hostname = new URL(value).hostname.toLowerCase();
  return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
    'facebook.com', 'www.facebook.com', 'fb.watch', 'twitch.tv', 'www.twitch.tv'].includes(hostname);
}

function normalizeScopeName(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase()
    : '';
}

function canManageEventScope(identity, event) {
  if (isChurchWideStaff(identity)) return true;
  const department = normalizeScopeName(event?.department);
  if (!department) return false;
  return identity.roleAssignments.some((assignment) => (
    [assignment.departement_code, assignment.departement_nom, assignment.commission_code, assignment.commission_nom]
      .some((value) => normalizeScopeName(value) === department)
  ));
}

function getEventReminderDate(event) {
  if (typeof event.date !== 'string') return null;
  const date = event.date.slice(0, 10);
  const time = typeof event.time === 'string' && /^\d{2}:\d{2}$/.test(event.time)
    ? event.time
    : '09:00';
  const eventAt = new Date(`${date}T${time}:00+01:00`);
  if (!Number.isFinite(eventAt.getTime())) return null;
  return new Date(Math.max(Date.now(), eventAt.getTime() - 2 * 60 * 60 * 1000));
}

function sanitizePayload(entity, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Le contenu envoyé est invalide.');
    error.status = 400;
    throw error;
  }
  const allowedFields = ENTITY_FIELDS[entity];
  if (!allowedFields) {
    const error = new Error('Ce type de contenu n’est pas pris en charge.');
    error.status = 404;
    throw error;
  }
  const payload = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowedFields.has(key)) payload[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(payload)) > 64_000) {
    const error = new Error('Le contenu dépasse la taille autorisée.');
    error.status = 413;
    throw error;
  }
  return payload;
}

function validateDailyThought(payload) {
  const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
  const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
  const author = typeof payload?.author === 'string' ? payload.author.trim() : '';
  if (title.length < 2 || title.length > 160 || content.length < 2 || content.length > 3000 || author.length > 160) {
    const error = new Error('Le titre, le texte ou le nom de la pensée du jour est invalide.');
    error.status = 400;
    throw error;
  }
  return { title, content, author };
}

function validateMediaPayload(entity, payload, { partial = false } = {}) {
  const invalid = () => {
    const error = new Error(entity === 'Event'
      ? 'Un événement doit avoir un titre, une date et une légende descriptive. Si une affiche est fournie, son lien doit être HTTPS.'
      : 'Les informations ou les liens de cette prédication sont invalides.');
    error.status = 400;
    throw error;
  };
  if (!['Event', 'Sermon'].includes(entity)) return;
  if (Object.hasOwn(payload, 'title')
    && (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.trim().length > 160)) invalid();
  if (Object.hasOwn(payload, 'description')
    && (typeof payload.description !== 'string' || payload.description.length > 2000)) invalid();
  if (entity === 'Event') {
    const validEventDate = (value) => typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
      && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!partial && (typeof payload.title !== 'string' || !payload.title.trim()
      || typeof payload.description !== 'string' || !payload.description.trim()
      || !validEventDate(payload.date))) invalid();
    if (Object.hasOwn(payload, 'image_url') && payload.image_url && !isSafeWebUrl(payload.image_url)) invalid();
    if (Object.hasOwn(payload, 'type') && !['service', 'conference', 'camp', 'retreat', 'youth', 'prayer', 'other'].includes(payload.type)) invalid();
    if (Object.hasOwn(payload, 'date') && payload.date && !validEventDate(payload.date)) invalid();
    if (Object.hasOwn(payload, 'time') && payload.time
      && (typeof payload.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.time))) invalid();
    if (Object.hasOwn(payload, 'location') && (typeof payload.location !== 'string' || payload.location.length > 200)) invalid();
    if (Object.hasOwn(payload, 'department') && (typeof payload.department !== 'string' || payload.department.length > 160)) invalid();
    if (Object.hasOwn(payload, 'capacity') && payload.capacity !== null && payload.capacity !== ''
      && (!Number.isInteger(Number(payload.capacity)) || Number(payload.capacity) < 1 || Number(payload.capacity) > 100_000)) invalid();
  } else {
    const mediaFields = ['video_url', 'audio_url', 'stream_url', 'thumbnail_url', 'pdf_url', 'docx_url'];
    if (mediaFields.some((field) => Object.hasOwn(payload, field) && payload[field] && !isSafeWebUrl(payload[field]))) invalid();
    if (Object.hasOwn(payload, 'category') && !['sermon', 'affirmation', 'formation'].includes(payload.category)) invalid();
    if (Object.hasOwn(payload, 'type') && !['preaching', 'course', 'testimony', 'worship', 'live'].includes(payload.type)) invalid();
    if (Object.hasOwn(payload, 'duration_minutes')
      && (!Number.isInteger(Number(payload.duration_minutes)) || Number(payload.duration_minutes) < 0 || Number(payload.duration_minutes) > 1440)) invalid();
    if (Object.hasOwn(payload, 'duration')
      && (typeof payload.duration !== 'string' || payload.duration.length > 40)) invalid();
    if (Object.hasOwn(payload, 'speaker') && (typeof payload.speaker !== 'string' || payload.speaker.length > 160)) invalid();
    if (Object.hasOwn(payload, 'series_name') && (typeof payload.series_name !== 'string' || payload.series_name.length > 160)) invalid();
    if (Object.hasOwn(payload, 'date') && payload.date && !Number.isFinite(Date.parse(payload.date))) invalid();
    if (Object.hasOwn(payload, 'scripture') && (typeof payload.scripture !== 'string' || payload.scripture.length > 300)) invalid();
  }
}

function validateGalleryPhotoPayload(payload) {
  const invalid = () => {
    const error = new Error('Ajoutez une image valide, un titre, un album et la date du culte.');
    error.status = 400;
    throw error;
  };
  if (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.trim().length > 160
    || typeof payload.album !== 'string' || !payload.album.trim() || payload.album.trim().length > 120
    || typeof payload.caption !== 'string' || payload.caption.length > 1200
    || typeof payload.service_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.service_date)
    || !Number.isFinite(Date.parse(`${payload.service_date}T00:00:00Z`))
    || new Date(`${payload.service_date}T00:00:00Z`).toISOString().slice(0, 10) !== payload.service_date
    || !isUuid(payload.category_id)
    || !isSafeWebUrl(payload.image_url)) invalid();
  payload.title = payload.title.trim();
  payload.album = payload.album.trim();
  payload.caption = payload.caption.trim();
}

function validateGalleryCategoryPayload(payload) {
  const invalid = () => {
    const error = new Error('Indiquez un nom de catégorie valide (2 à 60 caractères).');
    error.status = 400;
    throw error;
  };
  if (typeof payload.name !== 'string' || payload.name.trim().length < 2 || payload.name.trim().length > 60
    || typeof payload.description !== 'string' || payload.description.length > 300
    || typeof payload.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(payload.color)) invalid();
  payload.name = payload.name.trim();
  payload.description = payload.description.trim();
}

function getChurchAccountingDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Brazzaville',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function postFinanceJournal(tx, {
  egliseId,
  actorId,
  sourceType,
  sourceId,
  description,
  amount,
  debitCode,
  creditCode,
  memberId = null,
}) {
  const accountCodes = [debitCode, creditCode];
  const accounts = await tx.$queryRaw`
    SELECT id,code FROM public.finance_accounts
    WHERE eglise_id=${egliseId}::uuid AND code=ANY(${accountCodes}::text[]) AND is_active=true
  `;
  const accountMap = new Map(accounts.map((account) => [account.code, account]));
  if (!accountMap.has(debitCode) || !accountMap.has(creditCode)) {
    const error = new Error('Le plan de comptes financier est incomplet. Vérifiez la migration de comptabilité.');
    error.status = 503;
    throw error;
  }
  const entryDate = getChurchAccountingDate();
  const year = Number(entryDate.slice(0, 4));
  const sequenceRows = await tx.$queryRaw`
    INSERT INTO public.finance_sequences (eglise_id,sequence_name,sequence_year,last_value)
    VALUES (${egliseId}::uuid,'JOURNAL',${year},1)
    ON CONFLICT (eglise_id,sequence_name,sequence_year)
    DO UPDATE SET last_value=public.finance_sequences.last_value+1
    RETURNING last_value
  `;
  const entryNumber = `UCE-${sourceType === 'expense' ? 'DEP' : 'REC'}-${year}-${String(sequenceRows[0].last_value).padStart(6, '0')}`;
  const journalRows = await tx.$queryRaw`
    INSERT INTO public.finance_journals
      (eglise_id,entry_number,entry_date,source_type,source_id,description,created_by)
    VALUES
      (${egliseId}::uuid,${entryNumber},${entryDate}::date,${sourceType},${sourceId}::uuid,${description},${actorId}::uuid)
    RETURNING id
  `;
  const journalId = journalRows[0].id;

  await tx.$executeRaw`
    INSERT INTO public.finance_journal_lines
      (eglise_id,journal_id,line_number,account_id,member_id,description,debit_amount,credit_amount)
    VALUES
      (${egliseId}::uuid,${journalId}::uuid,1,${accountMap.get(debitCode).id}::uuid,${memberId}::uuid,${description},${amount},0),
      (${egliseId}::uuid,${journalId}::uuid,2,${accountMap.get(creditCode).id}::uuid,${memberId}::uuid,${description},0,${amount})
  `;
  await tx.$executeRaw`
    UPDATE public.finance_journals
    SET status='posted',posted_by=${actorId}::uuid,posted_at=now()
    WHERE id=${journalId}::uuid
  `;
  await tx.$executeRaw`
    INSERT INTO public.finance_audit_events
      (eglise_id,actor_id,action,entity_type,entity_id,details)
    VALUES
      (${egliseId}::uuid,${actorId}::uuid,'journal_posted','finance_journal',${journalId}::uuid,
       ${JSON.stringify({ entry_number: entryNumber, source_type: sourceType, amount, debit_code: debitCode, credit_code: creditCode })}::jsonb)
  `;
  return { id: journalId, entryNumber };
}

function getDonationAccountCodes(type, paymentMethod) {
  const debitCodeByMethod = {
    cash: 'CASH_XAF',
    mtn_momo: 'MTN_MOMO_XAF',
    airtel_money: 'AIRTEL_MONEY_XAF',
    visa: 'VISA_CLEARING_XAF',
    mobile_money: 'CINETPAY_MOBILE_XAF',
    card: 'CINETPAY_CARD_XAF',
  };
  const creditCodeByType = {
    tithe: 'INCOME_TITHE',
    offering: 'INCOME_OFFERING',
    campaign: 'INCOME_CAMPAIGN',
    special: 'INCOME_OTHER',
    solidarity: 'INCOME_OTHER',
  };
  const debitCode = debitCodeByMethod[paymentMethod];
  const creditCode = creditCodeByType[type];
  if (!debitCode || !creditCode) {
    const error = new Error('Le mode de paiement ou la catégorie ne peut pas être comptabilisé.');
    error.status = 400;
    throw error;
  }
  return { debitCode, creditCode };
}

async function addToCampaignRaisedAmount(tx, egliseId, campaignId, amount) {
  if (!campaignId) return;
  const updated = await tx.$queryRaw`
    UPDATE public.uce_app_records
    SET payload=jsonb_set(
      payload,
      '{raised_amount}',
      to_jsonb(COALESCE(NULLIF(payload->>'raised_amount','')::numeric,0)+${amount}::numeric),
      true
    ),updated_at=now()
    WHERE id=${campaignId}::uuid
      AND eglise_id=${egliseId}::uuid
      AND entity_type='Campaign'
    RETURNING id
  `;
  if (!updated[0]) {
    const error = new Error('La cagnotte associée à ce paiement est introuvable.');
    error.status = 409;
    throw error;
  }
}

function getCinetPayBaseOrigin() {
  const configuredOrigin = appOrigin;
  const origin = new URL(configuredOrigin);
  if (!['https:', 'http:'].includes(origin.protocol)
    || (origin.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(origin.hostname))
    || (process.env.NODE_ENV === 'production'
      && (origin.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname)))) {
    throw new Error('APP_ORIGIN must use HTTPS outside local development.');
  }
  return origin.origin;
}

function getCinetPayNotifyUrl() {
  const notifyUrl = process.env.CINETPAY_NOTIFY_URL
    || `${getCinetPayBaseOrigin()}/api/payments/cinetpay/notify`;
  const parsed = new URL(notifyUrl);
  const isLocalHost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  const isLocalDevelopmentUrl = process.env.NODE_ENV !== 'production'
    && parsed.protocol === 'http:'
    && isLocalHost;
  if ((parsed.protocol !== 'https:' && !isLocalDevelopmentUrl)
    || (process.env.NODE_ENV === 'production' && isLocalHost)) {
    throw new Error('CINETPAY_NOTIFY_URL must use HTTPS outside local development.');
  }
  return parsed.href;
}

if (cinetPayConfigured) {
  getCinetPayBaseOrigin();
  getCinetPayNotifyUrl();
}

async function requestCinetPay(path, payload) {
  let response;
  try {
    response = await fetch(`${cinetPayBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    const error = new Error('Le service de paiement est momentanément injoignable.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') {
    const error = new Error('Le service de paiement a renvoyé une réponse invalide.');
    error.status = 502;
    throw error;
  }
  return result;
}

async function getCinetPayReadiness(egliseId) {
  if (!cinetPayConfigured) {
    return { enabled: false, reason: 'Les identifiants du compte marchand CinetPay ne sont pas configurés sur le serveur.' };
  }

  const requiredTables = await prisma.$queryRaw`
    SELECT to_regclass('public.uce_cinetpay_transactions') AS transactions_table,
      to_regclass('public.finance_accounts') AS accounts_table
  `;
  if (!requiredTables[0]?.transactions_table || !requiredTables[0]?.accounts_table) {
    return { enabled: false, reason: 'Les migrations de paiement et de comptabilité doivent être appliquées à la base.' };
  }

  const requiredCodes = [
    'CINETPAY_MOBILE_XAF',
    'CINETPAY_CARD_XAF',
    'INCOME_TITHE',
    'INCOME_OFFERING',
    'INCOME_CAMPAIGN',
    'INCOME_OTHER',
  ];
  const accounts = await prisma.$queryRaw`
    SELECT code FROM public.finance_accounts
    WHERE eglise_id=${egliseId}::uuid
      AND code=ANY(${requiredCodes}::text[])
      AND is_active=true
  `;
  const activeCodes = new Set(accounts.map((account) => account.code));
  const missingCodes = requiredCodes.filter((code) => !activeCodes.has(code));
  if (missingCodes.length) {
    return {
      enabled: false,
      reason: 'Les comptes internes nécessaires aux paiements CinetPay ne sont pas tous disponibles ou actifs.',
    };
  }

  return { enabled: true, reason: null };
}

async function verifyCinetPayStatus(transactionId) {
  const result = await requestCinetPay('/payment/check', {
    apikey: cinetPayConfig.apiKey,
    site_id: cinetPayConfig.siteId,
    transaction_id: transactionId,
  });
  if (String(result.code) !== '00' || !result.data || typeof result.data !== 'object') {
    const error = new Error('Le statut du paiement n’a pas pu être vérifié auprès de CinetPay.');
    error.status = 502;
    throw error;
  }
  const providerTransactionId = String(result.data.transaction_id || '');
  const amount = Number(result.data.amount);
  const currency = String(result.data.currency || '').toUpperCase();
  if (providerTransactionId !== transactionId || !Number.isSafeInteger(amount) || !currency) {
    const error = new Error('Les informations retournées par CinetPay ne correspondent pas à la transaction.');
    error.status = 409;
    throw error;
  }
  return {
    status: String(result.data.status || '').toUpperCase(),
    amount,
    currency,
    paymentMethod: String(result.data.payment_method || '').toUpperCase(),
    code: String(result.code),
  };
}

function normalizeCinetPayPaymentMethod(providerMethod, requestedMethod) {
  if (['VISA', 'MASTERCARD', 'CARD', 'CREDIT_CARD'].includes(providerMethod)) return 'card';
  if (['MOBILE_MONEY', 'MTN', 'MTN_MOMO', 'AIRTEL', 'AIRTEL_MONEY', 'OM'].includes(providerMethod)) return 'mobile_money';
  return requestedMethod;
}

async function reconcileCinetPayTransaction(transactionId) {
  const transactions = await prisma.$queryRaw`
    SELECT t.id,t.eglise_id,t.donation_id,t.profile_id,t.transaction_id,
      t.payment_method,t.amount,t.currency,t.status,t.provider_status,
      d.payload AS donation
    FROM public.uce_cinetpay_transactions t
    JOIN public.uce_app_records d ON d.id=t.donation_id AND d.eglise_id=t.eglise_id
    WHERE t.transaction_id=${transactionId}
    LIMIT 1
  `;
  const transaction = transactions[0];
  if (!transaction) {
    const error = new Error('Transaction de paiement introuvable.');
    error.status = 404;
    throw error;
  }
  if (transaction.status === 'accepted' || ['refused', 'failed'].includes(transaction.status)) {
    return {
      transaction_id: transaction.transaction_id,
      status: transaction.status,
      donation_id: transaction.donation_id,
    };
  }

  const provider = await verifyCinetPayStatus(transaction.transaction_id);
  if (provider.amount !== Number(transaction.amount) || provider.currency !== transaction.currency) {
    const error = new Error('Le montant ou la devise confirmés par CinetPay ne correspondent pas au paiement.');
    error.status = 409;
    throw error;
  }
  const normalizedStatus = provider.status === 'ACCEPTED'
    ? 'accepted'
    : ['REFUSED', 'CANCELLED', 'CANCELED', 'EXPIRED'].includes(provider.status)
      ? 'refused'
      : 'pending';

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT t.id,t.eglise_id,t.donation_id,t.profile_id,t.transaction_id,
        t.payment_method,t.amount,t.currency,t.status,d.payload AS donation
      FROM public.uce_cinetpay_transactions t
      JOIN public.uce_app_records d ON d.id=t.donation_id AND d.eglise_id=t.eglise_id
      WHERE t.transaction_id=${transactionId}
      FOR UPDATE OF t
    `;
    const current = locked[0];
    if (!current) {
      const error = new Error('Transaction de paiement introuvable.');
      error.status = 404;
      throw error;
    }
    if (current.status === 'accepted' || ['refused', 'failed'].includes(current.status)) {
      return { transaction_id: current.transaction_id, status: current.status, donation_id: current.donation_id };
    }

    if (normalizedStatus === 'accepted') {
      const donationRows = await tx.$queryRaw`
        UPDATE public.uce_app_records
        SET payload=payload || ${JSON.stringify({
          status: 'received',
          payment_method: normalizeCinetPayPaymentMethod(provider.paymentMethod, current.payment_method),
          payment_reference: current.transaction_id,
          confirmed_at: new Date().toISOString(),
          confirmation_source: 'cinetpay',
        })}::jsonb,
        updated_at=now()
        WHERE id=${current.donation_id}::uuid
          AND eglise_id=${current.eglise_id}::uuid
          AND entity_type='Donation'
          AND payload->>'status'='pending'
        RETURNING payload
      `;
      if (!donationRows[0]) {
        const error = new Error('Le don a déjà été traité ou ne peut plus être confirmé.');
        error.status = 409;
        throw error;
      }
      const donation = donationRows[0].payload;
      const { debitCode, creditCode } = getDonationAccountCodes(donation.type, donation.payment_method);
      const memberRows = donation.donor_member_id ? [] : await tx.$queryRaw`
        SELECT id FROM public.membres
        WHERE profil_utilisateur_id=${current.profile_id}::uuid
          AND eglise_id=${current.eglise_id}::uuid
        LIMIT 1
      `;
      const journal = await postFinanceJournal(tx, {
        egliseId: current.eglise_id,
        actorId: current.profile_id,
        sourceType: 'receipt',
        sourceId: current.donation_id,
        description: `${donation.type === 'tithe' ? 'Dîme' : 'Don'} · ${donation.donor_name || 'Membre'} · CinetPay`,
        amount: Number(current.amount),
        debitCode,
        creditCode,
        memberId: donation.donor_member_id || memberRows[0]?.id || null,
      });
      await addToCampaignRaisedAmount(tx, current.eglise_id, donation.campaign_id, Number(current.amount));
      await tx.uce_app_records.update({
        where: { id: current.donation_id },
        data: { payload: { ...donation, receipt_number: journal.entryNumber, journal_id: journal.id } },
      });
    } else if (normalizedStatus === 'refused') {
      await tx.$executeRaw`
        UPDATE public.uce_app_records
        SET payload=payload || ${JSON.stringify({ status: 'refused', confirmation_source: 'cinetpay' })}::jsonb,
          updated_at=now()
        WHERE id=${current.donation_id}::uuid AND eglise_id=${current.eglise_id}::uuid
          AND entity_type='Donation' AND payload->>'status'='pending'
      `;
    }

    await tx.$executeRaw`
      UPDATE public.uce_cinetpay_transactions
      SET status=${normalizedStatus},provider_status=${provider.status},
        provider_code=${provider.code},provider_payment_method=${provider.paymentMethod || null},
        verified_at=now(),updated_at=now()
      WHERE id=${current.id}::uuid
    `;
    return {
      transaction_id: current.transaction_id,
      status: normalizedStatus,
      donation_id: current.donation_id,
    };
  });
  return result;
}

app.post('/api/payments/cinetpay/notify', async (request, response) => {
  if (!cinetPayConfigured) {
    response.status(503).json({ error: 'Le paiement CinetPay n’est pas configuré.' });
    return;
  }
  const transactionId = request.body?.cpm_trans_id || request.body?.transaction_id;
  if (typeof transactionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(transactionId)) {
    response.status(400).json({ error: 'La référence de transaction est invalide.' });
    return;
  }
  try {
    await reconcileCinetPayTransaction(transactionId);
    response.status(200).send('OK');
  } catch (error) {
    if (error.status === 404) {
      response.status(404).send('NOT FOUND');
      return;
    }
    console.error('CinetPay notification reconciliation failed:', error);
    response.status(error.status || 500).send('RETRY');
  }
});

app.post('/api/auth/register', async (request, response, next) => {
  const body = request.body || {};
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!fullName || fullName.length > 150
    || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || phone.length > 30 || password.length < 8 || password.length > 72) {
    response.status(400).json({ error: 'Les informations saisies sont invalides. Vérifie le nom, l’adresse e-mail et le mot de passe (8 caractères minimum).' });
    return;
  }

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts.length > 1 ? nameParts[0] : null;
  const familyName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
  const otherNames = nameParts.slice(2).join(' ') || null;
  if (nameParts.some((part) => part.length > 100)
    || familyName.length > 100 || otherNames?.length > 100) {
    response.status(400).json({ error: 'Le nom saisi est trop long pour une fiche membre.' });
    return;
  }

  try {
    const churches = await prisma.$queryRaw`
      SELECT id FROM public.eglises
      WHERE upper(sigle)='UCE' AND actif=true
      LIMIT 1
    `;
    if (!churches[0]) {
      response.status(503).json({ error: 'Les inscriptions sont temporairement indisponibles.' });
      return;
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appOrigin}/login`,
        data: { full_name: fullName },
      },
    });
    if (error) {
      response.status(error.status && error.status < 500 ? error.status : 400).json({ error: error.message });
      return;
    }
    if (!data.user || !data.user.identities?.length) {
      response.status(202).json({
        message: 'Si cette adresse peut être utilisée, un e-mail de confirmation sera envoyé. L’accès à l’application sera activé après le rattachement du compte à une fiche membre.',
      });
      return;
    }

    let needsReview = false;
    try {
      needsReview = await prisma.$transaction(async (tx) => {
        const existingMembers = await tx.$queryRaw`
          SELECT id FROM public.membres
          WHERE eglise_id=${churches[0].id}::uuid
            AND profil_utilisateur_id IS NULL
            AND lower(email)=lower(${email})
          ORDER BY created_at
          LIMIT 2
          FOR UPDATE
        `;
        const ambiguousMatch = existingMembers.length > 1;
        await tx.$executeRaw`
          INSERT INTO public.profils_utilisateurs
            (id,eglise_id,nom_affichage,telephone,statut)
          VALUES (
            ${data.user.id}::uuid,${churches[0].id}::uuid,${fullName},${phone || null},
            ${ambiguousMatch ? 'en_attente' : 'actif'}
          )
        `;

        if (existingMembers[0]) {
          if (ambiguousMatch) return true;
          const linked = await tx.$queryRaw`
            UPDATE public.membres
            SET profil_utilisateur_id=${data.user.id}::uuid,
              telephone=COALESCE(telephone,${phone || null}),
              updated_at=now()
            WHERE id=${existingMembers[0].id}::uuid
              AND eglise_id=${churches[0].id}::uuid
              AND profil_utilisateur_id IS NULL
            RETURNING id
          `;
          if (!linked[0]) {
            const error = new Error('Cette fiche membre vient d’être rattachée à un autre compte.');
            error.status = 409;
            throw error;
          }
          await writeAuditEvent(tx, {
            churchId: churches[0].id,
            actorId: data.user.id,
            action: 'member_self_registered',
            entityType: 'member',
            entityId: linked[0].id,
          });
          return false;
        }

        const memberRows = await tx.$queryRaw`
          INSERT INTO public.membres
            (eglise_id,profil_utilisateur_id,numero_membre,nom,postnom,prenom,telephone,email,date_adhesion,statut)
          VALUES (
            ${churches[0].id}::uuid,${data.user.id}::uuid,${`UCE-${randomUUID().slice(0, 8).toUpperCase()}`},
            ${familyName},${otherNames},${firstName},${phone || null},${email},CURRENT_DATE,'actif'
          )
          RETURNING id
        `;
        await writeAuditEvent(tx, {
          churchId: churches[0].id,
          actorId: data.user.id,
          action: 'member_self_registered',
          entityType: 'member',
          entityId: memberRows[0].id,
        });
        return false;
      });
    } catch (error) {
      console.error('New account profile registration failed:', error);
      response.status(503).json({
        error: 'Le compte a été créé, mais sa fiche membre n’a pas pu être enregistrée. Contacte l’administration pour activer ton accès.',
      });
      return;
    }

    response.status(needsReview ? 202 : 201).json({
      message: needsReview
        ? 'Compte créé. Plusieurs fiches correspondent à cette adresse : l’administration doit vérifier l’annuaire avant d’activer le compte.'
        : 'Compte créé et inscrit comme membre. Vérifie ton e-mail si une confirmation est demandée, puis connecte-toi.',
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api', async (request, response, next) => {
  try {
    const accessToken = request.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!accessToken) {
      response.status(401).json({ error: 'Authentification requise.' });
      return;
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      response.status(401).json({ error: 'Session Supabase invalide ou expirée.' });
      return;
    }

    const profileRows = await prisma.$queryRaw`
      SELECT p.id, p.eglise_id, p.nom_affichage, p.telephone, p.photo_url,
             p.preferences, e.nom AS eglise_nom, e.sigle, e.adresse, e.ville,
             e.pays, e.email AS eglise_email, e.telephone AS eglise_telephone, e.devise
      FROM public.profils_utilisateurs p
      JOIN public.eglises e ON e.id = p.eglise_id
      WHERE p.id = ${user.id}::uuid
        AND upper(e.sigle) = 'UCE'
        AND e.actif = true
        AND p.statut = 'actif'
      LIMIT 1
    `;
    const profile = profileRows[0];
    if (!profile) {
      response.status(403).json({ error: 'Votre compte n’est pas encore rattaché à un profil UCE actif.', code: 'profile_not_registered' });
      return;
    }

    const [roleRows, members] = await Promise.all([
      prisma.$queryRaw`
        SELECT r.code, r.nom, r.niveau_portee,
               ur.departement_id, d.code AS departement_code, d.nom AS departement_nom,
               ur.commission_id, c.code AS commission_code, c.nom AS commission_nom
        FROM public.utilisateur_roles ur
        JOIN public.roles r ON r.id = ur.role_id AND r.eglise_id = ur.eglise_id
        LEFT JOIN public.departements d ON d.id = ur.departement_id AND d.eglise_id = ur.eglise_id
        LEFT JOIN public.commissions c ON c.id = ur.commission_id AND c.departement_id = ur.departement_id
        WHERE ur.profil_utilisateur_id = ${user.id}::uuid
          AND ur.eglise_id = ${profile.eglise_id}::uuid
          AND ur.statut = 'active'
          AND ur.date_debut <= CURRENT_DATE
          AND (ur.date_fin IS NULL OR ur.date_fin >= CURRENT_DATE)
          AND r.actif = true
      `,
      prisma.membres.findFirst({
        where: { profil_utilisateur_id: user.id, eglise_id: profile.eglise_id },
        select: { id: true, nom: true, postnom: true, prenom: true, email: true, telephone: true, photo_url: true },
      }),
    ]);

    request.identity = {
      authUser: user,
      profile,
      member: members,
      roles: [...new Set(roleRows.map((role) => role.code))],
      roleAssignments: roleRows,
    };
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/api/payments/cinetpay/config', async (request, response, next) => {
  try {
    response.json(await getCinetPayReadiness(request.identity.profile.eglise_id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/cinetpay/initialize', async (request, response, next) => {
  try {
    const readiness = await getCinetPayReadiness(request.identity.profile.eglise_id);
    if (!readiness.enabled) {
      response.status(503).json({ error: readiness.reason });
      return;
    }
    const identity = request.identity;
    const {
      amount: rawAmount,
      type,
      payment_method: paymentMethod,
      campaign_id: campaignId,
    } = request.body || {};
    const amount = Number(rawAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0
      || !['tithe', 'offering', 'campaign', 'special', 'solidarity'].includes(type)
      || !['mobile_money', 'card'].includes(paymentMethod)) {
      response.status(400).json({ error: 'Le montant, le type de don ou le moyen de paiement est invalide.' });
      return;
    }
    if (type === 'campaign') {
      if (!isUuid(campaignId)) {
        response.status(400).json({ error: 'Sélectionnez une cagnotte active pour votre contribution.' });
        return;
      }
      const campaign = await prisma.uce_app_records.findFirst({
        where: {
          id: campaignId,
          eglise_id: identity.profile.eglise_id,
          entity_type: 'Campaign',
        },
        select: { id: true, payload: true },
      });
      if (!campaign || campaign.payload.is_active === false) {
        response.status(404).json({ error: 'Cette cagnotte n’est plus disponible.' });
        return;
      }
    }
    const currency = String(identity.profile.devise || 'XAF').toUpperCase();
    if (currency !== 'XAF') {
      response.status(400).json({ error: 'CinetPay est configuré ici uniquement pour les paiements en XAF.' });
      return;
    }
    const customerPhone = String(request.body?.customer_phone || identity.profile.telephone || identity.member?.telephone || identity.authUser.phone || '').trim();
    if (!/^\+?[0-9][0-9\s().-]{6,19}$/.test(customerPhone)) {
      response.status(400).json({ error: 'Ajoutez un numéro de téléphone valide à votre profil avant de payer.' });
      return;
    }
    const customerEmail = String(request.body?.customer_email || identity.member?.email || identity.authUser.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 254) {
      response.status(400).json({ error: 'Une adresse e-mail valide est requise par le guichet de paiement.' });
      return;
    }

    const fullName = [identity.member?.prenom, identity.member?.nom, identity.member?.postnom]
      .filter(Boolean).join(' ').trim() || identity.profile.nom_affichage || 'Membre UCE';
    const [customerName, ...surnameParts] = fullName.split(/\s+/);
    const customerSurname = surnameParts.join(' ') || customerName;
    const transactionId = randomUUID();
    const egliseId = identity.profile.eglise_id;
    const donationPayload = {
      amount,
      currency,
      type,
      ...(type === 'campaign' ? { campaign_id: campaignId } : {}),
      payment_method: paymentMethod,
      payment_reference: null,
      payment_provider: 'cinetpay',
      transaction_id: transactionId,
      donor_name: fullName,
      donor_email: customerEmail,
      donor_member_id: identity.member?.id || null,
      donor_profile_id: identity.authUser.id,
      donor_anonymous: false,
      status: 'pending',
    };
    const transaction = await prisma.$transaction(async (tx) => {
      const donation = await tx.uce_app_records.create({
        data: {
          eglise_id: egliseId,
          entity_type: 'Donation',
          created_by: identity.authUser.id,
          payload: donationPayload,
        },
      });
      const rows = await tx.$queryRaw`
        INSERT INTO public.uce_cinetpay_transactions
          (eglise_id,donation_id,profile_id,transaction_id,payment_method,amount,currency,status)
        VALUES (${egliseId}::uuid,${donation.id}::uuid,${identity.authUser.id}::uuid,
          ${transactionId},${paymentMethod},${amount},${currency},'initializing')
        RETURNING id
      `;
      return { donationId: donation.id, transactionRowId: rows[0].id };
    });

    const origin = getCinetPayBaseOrigin();
    const customerPhoneNumber = customerPhone.replace(/[^\d+]/g, '');
    const initResult = await requestCinetPay('/payment', {
      apikey: cinetPayConfig.apiKey,
      site_id: cinetPayConfig.siteId,
      transaction_id: transactionId,
      amount,
      currency,
      description: `${type === 'tithe' ? 'Dîme' : 'Don'} UCE`,
      customer_id: identity.authUser.id,
      customer_name: customerName,
      customer_surname: customerSurname,
      customer_email: customerEmail,
      customer_phone_number: customerPhoneNumber,
      customer_address: identity.profile.adresse || identity.profile.ville || 'Brazzaville',
      customer_city: identity.profile.ville || 'Brazzaville',
      customer_country: 'CG',
      customer_state: identity.profile.ville || 'Brazzaville',
      customer_zip_code: '00000',
      notify_url: getCinetPayNotifyUrl(),
      return_url: `${origin}/donations?cinetpay_transaction_id=${encodeURIComponent(transactionId)}`,
      channels: paymentMethod === 'card' ? 'CREDIT_CARD' : 'MOBILE_MONEY',
      lang: 'fr',
      metadata: JSON.stringify({ donation_id: transaction.donationId }),
    });
    const paymentUrl = typeof initResult?.data?.payment_url === 'string' ? initResult.data.payment_url : '';
    let parsedPaymentUrl;
    try {
      parsedPaymentUrl = new URL(paymentUrl);
    } catch {
      parsedPaymentUrl = null;
    }
    if (String(initResult.code) !== '201'
      || !parsedPaymentUrl
      || parsedPaymentUrl.protocol !== 'https:'
      || !(parsedPaymentUrl.hostname.toLowerCase() === 'cinetpay.com'
        || parsedPaymentUrl.hostname.toLowerCase().endsWith('.cinetpay.com'))) {
      await prisma.$transaction(async (tx) => {
        const failed = await tx.$queryRaw`
          UPDATE public.uce_cinetpay_transactions
          SET status='failed',provider_code=${String(initResult.code || 'invalid_response')},
            updated_at=now()
          WHERE id=${transaction.transactionRowId}::uuid AND status='initializing'
          RETURNING donation_id
        `;
        if (!failed.length) return;
        await tx.$executeRaw`
          UPDATE public.uce_app_records
          SET payload=payload || ${JSON.stringify({ status: 'failed' })}::jsonb,updated_at=now()
          WHERE id=${transaction.donationId}::uuid AND eglise_id=${egliseId}::uuid
            AND entity_type='Donation' AND payload->>'status'='pending'
        `;
      });
      response.status(502).json({ error: 'CinetPay n’a pas pu créer la page de paiement. Aucun don n’a été comptabilisé.' });
      return;
    }
    await prisma.$executeRaw`
      UPDATE public.uce_cinetpay_transactions
      SET status=CASE WHEN status='accepted' THEN status ELSE 'pending' END,
        payment_url=${paymentUrl},provider_code=${String(initResult.code)},updated_at=now()
      WHERE id=${transaction.transactionRowId}::uuid AND status IN ('initializing','accepted')
    `;
    response.status(201).json({
      transaction_id: transactionId,
      payment_url: paymentUrl,
      status: 'pending',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/payments/cinetpay/:transactionId', async (request, response, next) => {
  try {
    if (!cinetPayConfigured) {
      response.status(503).json({ error: 'Le paiement CinetPay n’est pas configuré.' });
      return;
    }
    if (!/^[0-9a-f-]{36}$/i.test(request.params.transactionId)) {
      response.status(400).json({ error: 'La référence de transaction est invalide.' });
      return;
    }
    const transactions = await prisma.$queryRaw`
      SELECT id,profile_id FROM public.uce_cinetpay_transactions
      WHERE transaction_id=${request.params.transactionId}
        AND eglise_id=${request.identity.profile.eglise_id}::uuid
      LIMIT 1
    `;
    if (!transactions[0] || transactions[0].profile_id !== request.identity.authUser.id) {
      response.status(404).json({ error: 'Transaction introuvable.' });
      return;
    }
    const status = await reconcileCinetPayTransaction(request.params.transactionId);
    const donations = await prisma.uce_app_records.findFirst({
      where: {
        id: status.donation_id,
        eglise_id: request.identity.profile.eglise_id,
        entity_type: 'Donation',
      },
    });
    response.json({
      transaction_id: status.transaction_id,
      status: status.status,
      donation: donations ? { ...donations.payload, id: donations.id, created_date: donations.created_at } : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/me', (request, response) => {
  const { authUser, profile, member, roles } = request.identity;
  const fullName = [member?.prenom, member?.nom, member?.postnom].filter(Boolean).join(' ')
    || profile.nom_affichage
    || authUser.email;
  const role = roles.some((item) => ADMIN_ROLES.has(item)) ? 'admin'
    : roles.includes('PASTEUR_PRINCIPAL') ? 'pastor'
      : roles.some((item) => STAFF_ROLES.has(item)) ? 'leader' : 'member';
  response.json({
    ...(profile.preferences || {}),
    id: authUser.id,
    email: member?.email || authUser.email,
    full_name: fullName,
    phone: profile.telephone || member?.telephone || '',
    photo_url: profile.photo_url || member?.photo_url || '',
    role,
    roles,
    role_assignments: request.identity.roleAssignments.map((assignment) => ({
      code: assignment.code,
      name: assignment.nom,
      scope: assignment.niveau_portee,
      department: assignment.departement_id ? {
        id: assignment.departement_id,
        code: assignment.departement_code,
        name: assignment.departement_nom,
      } : null,
      commission: assignment.commission_id ? {
        id: assignment.commission_id,
        code: assignment.commission_code,
        name: assignment.commission_nom,
      } : null,
    })),
    eglise_id: profile.eglise_id,
    church: {
      name: profile.eglise_nom,
      sigle: profile.sigle,
      address: profile.adresse,
      city: profile.ville,
      country: profile.pays,
      email: profile.eglise_email,
      phone: profile.eglise_telephone,
      currency: profile.devise,
    },
    preferences: profile.preferences || {},
  });
});

app.get('/api/dashboard/summary', async (request, response, next) => {
  try {
    const egliseId = request.identity.profile.eglise_id;
    const today = getChurchAccountingDate();
    const monthStart = `${today.slice(0, 7)}-01`;
    const [members, events, prayers, pendingProfiles] = await Promise.all([
      prisma.$queryRaw`
        SELECT count(*)::int AS active_members,
          count(*) FILTER (WHERE date_adhesion>=${monthStart}::date)::int AS new_members_this_month
        FROM public.membres
        WHERE eglise_id=${egliseId}::uuid AND statut='actif'
      `,
      prisma.$queryRaw`
        SELECT count(DISTINCT e.id)::int AS upcoming_events,
          count(r.id) FILTER (WHERE r.status IN ('registered','present'))::int AS upcoming_event_signups
        FROM public.uce_app_records e
        LEFT JOIN public.uce_event_registrations r
          ON r.event_id=e.id AND r.eglise_id=e.eglise_id
        WHERE e.eglise_id=${egliseId}::uuid AND e.entity_type='Event'
          AND COALESCE(e.payload->>'date','')>=${today}
      `,
      prisma.$queryRaw`
        SELECT count(*)::int AS active_prayers
        FROM public.uce_app_records
        WHERE eglise_id=${egliseId}::uuid AND entity_type='PrayerRequest'
          AND payload->>'status'='active'
      `,
      canManageMembers(request.identity) ? prisma.$queryRaw`
        SELECT count(*)::int AS pending_member_profiles
        FROM public.profils_utilisateurs
        WHERE eglise_id=${egliseId}::uuid AND statut='en_attente'
      ` : Promise.resolve([{ pending_member_profiles: null }]),
    ]);

    let financial = null;
    if (isFinance(request.identity) || isPastor(request.identity)) {
      const [receipts, expenses] = await Promise.all([
        prisma.$queryRaw`
          SELECT COALESCE(SUM(
            CASE WHEN payload->>'amount' ~ '^[0-9]+([.][0-9]+)?$'
              THEN (payload->>'amount')::numeric ELSE 0 END
          ),0)::text AS amount
          FROM public.uce_app_records
          WHERE eglise_id=${egliseId}::uuid AND entity_type='Donation'
            AND payload->>'status'='received'
            AND created_at>=${monthStart}::date
        `,
        prisma.$queryRaw`
          SELECT COALESCE(SUM(amount),0)::text AS amount
          FROM public.finance_expenses
          WHERE eglise_id=${egliseId}::uuid AND status='paid'
            AND paid_at>=${monthStart}::date
        `,
      ]);
      financial = {
        receipts: receipts[0].amount,
        expenses: expenses[0].amount,
        currency: request.identity.profile.devise || 'XAF',
      };
    }

    response.json({
      ...members[0],
      ...events[0],
      ...prayers[0],
      ...pendingProfiles[0],
      financial,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/activity', async (request, response, next) => {
  try {
    const identity = request.identity;
    const [donations, journal, prayers, lessons] = await Promise.all([
      prisma.uce_app_records.findMany({
        where: {
          eglise_id: identity.profile.eglise_id,
          entity_type: 'Donation',
          OR: [
            { created_by: identity.authUser.id },
            { payload: { path: ['donor_profile_id'], equals: identity.authUser.id } },
            ...(identity.member?.id
              ? [{ payload: { path: ['donor_member_id'], equals: identity.member.id } }]
              : []),
          ],
        },
        orderBy: { created_at: 'desc' },
        take: 100,
      }),
      prisma.uce_app_records.findMany({
        where: {
          eglise_id: identity.profile.eglise_id,
          entity_type: 'JournalEntry',
          created_by: identity.authUser.id,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      prisma.uce_app_records.findMany({
        where: {
          eglise_id: identity.profile.eglise_id,
          entity_type: 'PrayerRequest',
          created_by: identity.authUser.id,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      prisma.$queryRaw`
        SELECT l.id,l.title,l.scripture,l.created_at,g.id AS group_id,g.title AS group_title,p.opened_at
        FROM public.uce_study_lessons l
        JOIN public.uce_study_groups g
          ON g.id=l.group_id AND g.eglise_id=l.eglise_id
        LEFT JOIN public.uce_study_progress p
          ON p.lesson_id=l.id AND p.eglise_id=l.eglise_id AND p.profile_id=${identity.authUser.id}::uuid
        WHERE l.eglise_id=${identity.profile.eglise_id}::uuid
          AND EXISTS (
            SELECT 1 FROM public.uce_study_group_members m
            WHERE m.group_id=g.id AND m.eglise_id=g.eglise_id
              AND m.profile_id=${identity.authUser.id}::uuid
          )
        ORDER BY l.created_at DESC
        LIMIT 100
      `,
    ]);

    response.json({
      donations: donations.map((record) => ({
        ...record.payload,
        id: record.id,
        created_at: record.created_at,
      })),
      journal: journal.map((record) => ({
        ...record.payload,
        id: record.id,
        created_at: record.created_at,
      })),
      prayers: prayers.map((record) => ({
        ...record.payload,
        id: record.id,
        created_at: record.created_at,
      })),
      lessons,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/settings/branding', async (request, response, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT valeur FROM public.parametres_eglise
      WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
        AND cle='app_branding'
      LIMIT 1
    `;
    response.json(rows[0]?.valeur || {});
  } catch (error) {
    next(error);
  }
});

app.patch('/api/settings/branding', async (request, response, next) => {
  try {
    if (!isSystemAdministrator(request.identity)) {
      response.status(403).json({ error: 'Seul l’administrateur général peut modifier le design de l’application.' });
      return;
    }
    const input = request.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      response.status(400).json({ error: 'Les paramètres de design sont invalides.' });
      return;
    }
    const settings = {};
    for (const key of ['logo_url', 'home_hero_url', 'pastor_photo_url', 'teams_hero_url', 'background_url']) {
      if (Object.hasOwn(input, key)) {
        const value = input[key];
        if (typeof value !== 'string' || value.length > 2048
          || (value && !isSafeWebUrl(value, { allowRelative: true }))) {
          response.status(400).json({ error: `L’adresse de l’image « ${key} » est invalide.` });
          return;
        }
        settings[key] = value;
      }
    }
    for (const key of ['pastor_name', 'pastor_role', 'pastor_email', 'pastor_phone']) {
      if (Object.hasOwn(input, key)) {
        const value = typeof input[key] === 'string' ? input[key].trim() : '';
        if (value.length > 200 || (key === 'pastor_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
          response.status(400).json({ error: `La valeur du champ « ${key} » est invalide.` });
          return;
        }
        settings[key] = value;
      }
    }
    if (Object.hasOwn(input, 'leaders')) {
      if (!Array.isArray(input.leaders) || input.leaders.length > 30) {
        response.status(400).json({ error: 'La liste des responsables est invalide.' });
        return;
      }
      const leaders = [];
      for (const leader of input.leaders) {
        if (!leader || typeof leader !== 'object' || Array.isArray(leader)
          || Object.keys(leader).some((key) => !['name', 'role', 'bio', 'email', 'phone', 'photo_url'].includes(key))) {
          response.status(400).json({ error: 'Une fiche responsable contient des champs non autorisés.' });
          return;
        }
        const cleanLeader = {
          name: typeof leader.name === 'string' ? leader.name.trim() : '',
          role: typeof leader.role === 'string' ? leader.role.trim() : '',
          bio: typeof leader.bio === 'string' ? leader.bio.trim() : '',
          email: typeof leader.email === 'string' ? leader.email.trim() : '',
          phone: typeof leader.phone === 'string' ? leader.phone.trim() : '',
          photo_url: typeof leader.photo_url === 'string' ? leader.photo_url.trim() : '',
        };
        if (!cleanLeader.name || !cleanLeader.role || cleanLeader.name.length > 120 || cleanLeader.role.length > 120 || cleanLeader.bio.length > 1000
          || cleanLeader.email.length > 254 || (cleanLeader.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanLeader.email))
          || cleanLeader.phone.length > 40 || cleanLeader.photo_url.length > 2048
          || (cleanLeader.photo_url && !isSafeWebUrl(cleanLeader.photo_url, { allowRelative: true }))) {
          response.status(400).json({ error: 'Une fiche responsable contient des informations invalides.' });
          return;
        }
        leaders.push(cleanLeader);
      }
      settings.leaders = leaders;
    }
    for (const key of ['primary_color', 'accent_color']) {
      if (Object.hasOwn(input, key)) {
        if (typeof input[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(input[key])) {
          response.status(400).json({ error: 'Les couleurs doivent être au format hexadécimal #RRGGBB.' });
          return;
        }
        settings[key] = input[key];
      }
    }
    if (Object.hasOwn(input, 'font_family')) {
      if (!['Inter', 'Arial', 'Georgia'].includes(input.font_family)) {
        response.status(400).json({ error: 'La police choisie n’est pas autorisée.' });
        return;
      }
      settings.font_family = input.font_family;
    }
    if (Object.hasOwn(input, 'button_style')) {
      if (!['rounded', 'pill', 'square'].includes(input.button_style)) {
        response.status(400).json({ error: 'Le style de bouton choisi n’est pas autorisé.' });
        return;
      }
      settings.button_style = input.button_style;
    }
    if (Object.hasOwn(input, 'glass_opacity')) {
      const opacity = Number(input.glass_opacity);
      if (!Number.isFinite(opacity) || opacity < 0.35 || opacity > 0.95) {
        response.status(400).json({ error: 'L’opacité doit être comprise entre 35 % et 95 %.' });
        return;
      }
      settings.glass_opacity = opacity;
    }
    if (Object.keys(settings).length === 0) {
      response.status(400).json({ error: 'Aucun paramètre de design valide à enregistrer.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.parametres_eglise (eglise_id,cle,valeur,description,updated_at)
      VALUES (${request.identity.profile.eglise_id}::uuid,'app_branding',${JSON.stringify(settings)}::jsonb,
        'Identité visuelle et préférences de présentation de l’application',now())
      ON CONFLICT (eglise_id,cle) DO UPDATE
      SET valeur=COALESCE(public.parametres_eglise.valeur,'{}'::jsonb) || EXCLUDED.valeur,
        updated_at=now()
      RETURNING valeur
    `;
    response.json(rows[0].valeur);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bible/versions', async (_request, response, next) => {
  try {
    if (!bibleConfig.apiKey) {
      response.status(503).json({ error: 'La source biblique doit encore être configurée par l’administration.' });
      return;
    }
    const [french, lingala] = await Promise.all([
      requestBibleApi(`/bibles/${encodeURIComponent(bibleConfig.frenchId)}`),
      requestBibleApi(`/bibles/${encodeURIComponent(bibleConfig.lingalaId)}`),
    ]);
    response.json([
      { language: 'fr', id: french.id, name: french.name, abbreviation: french.abbreviation },
      { language: 'ln', id: lingala.id, name: lingala.name, abbreviation: lingala.abbreviation },
    ]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bible/books', async (request, response, next) => {
  try {
    const bibleId = getBibleId(request.query.language);
    if (!bibleId || !bibleConfig.apiKey) {
      response.status(503).json({ error: 'Cette version biblique n’est pas encore configurée.' });
      return;
    }
    const result = await requestBibleApi(`/bibles/${encodeURIComponent(bibleId)}/books`);
    response.json(result.books || []);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bible/chapters', async (request, response, next) => {
  try {
    const bibleId = getBibleId(request.query.language);
    const bookId = request.query.book;
    if (!bibleId || !bibleConfig.apiKey) {
      response.status(503).json({ error: 'Cette version biblique n’est pas encore configurée.' });
      return;
    }
    if (typeof bookId !== 'string' || !/^[a-z0-9._-]{1,60}$/i.test(bookId)) {
      response.status(400).json({ error: 'Le livre biblique sélectionné est invalide.' });
      return;
    }
    const result = await requestBibleApi(
      `/bibles/${encodeURIComponent(bibleId)}/books/${encodeURIComponent(bookId)}/chapters`,
    );
    response.json(result.chapters || []);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bible/passage', async (request, response, next) => {
  try {
    const bibleId = getBibleId(request.query.language);
    const passageId = request.query.passage;
    if (!bibleId || !bibleConfig.apiKey) {
      response.status(503).json({ error: 'Cette version biblique n’est pas encore configurée.' });
      return;
    }
    if (typeof passageId !== 'string' || !/^[a-z0-9._-]{1,80}$/i.test(passageId)) {
      response.status(400).json({ error: 'Le chapitre biblique sélectionné est invalide.' });
      return;
    }
    const passage = await requestBibleApi(
      `/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(passageId)}?content-type=text`,
    );
    response.json(passage);
  } catch (error) {
    next(error);
  }
});

app.get('/api/bible/search', async (request, response, next) => {
  try {
    const bibleId = getBibleId(request.query.language);
    const query = request.query.q;
    if (!bibleId || !bibleConfig.apiKey) {
      response.status(503).json({ error: 'Cette version biblique n’est pas encore configurée.' });
      return;
    }
    if (typeof query !== 'string' || !query.trim() || query.length > 100) {
      response.status(400).json({ error: 'Saisis un terme de recherche de 1 à 100 caractères.' });
      return;
    }
    const params = new URLSearchParams({ query: query.trim(), limit: '20' });
    const result = await requestBibleApi(
      `/bibles/${encodeURIComponent(bibleId)}/search?${params.toString()}`,
    );
    response.json({ verses: result.verses || [] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/push/config', (_request, response) => {
  response.json({
    enabled: pushConfigured,
    public_key: pushConfigured ? process.env.VAPID_PUBLIC_KEY : null,
  });
});

app.post('/api/push/subscriptions', async (request, response, next) => {
  try {
    if (!pushConfigured) {
      response.status(503).json({ error: 'Les alertes téléphone ne sont pas encore configurées par l’administration.' });
      return;
    }
    const { endpoint, keys } = request.body || {};
    let endpointUrl;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      endpointUrl = null;
    }
    if (typeof endpoint !== 'string' || endpoint.length > 2048 || endpointUrl?.protocol !== 'https:'
      || !keys || typeof keys.p256dh !== 'string' || keys.p256dh.length > 256
      || typeof keys.auth !== 'string' || keys.auth.length > 256) {
      response.status(400).json({ error: 'L’abonnement aux alertes de cet appareil est invalide.' });
      return;
    }
    await prisma.$executeRaw`
      INSERT INTO public.uce_push_subscriptions
        (eglise_id,profile_id,endpoint,p256dh,auth_secret)
      VALUES (${request.identity.profile.eglise_id}::uuid,
        ${request.identity.authUser.id}::uuid,${endpoint},${keys.p256dh},${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET
        eglise_id=EXCLUDED.eglise_id,profile_id=EXCLUDED.profile_id,
        p256dh=EXCLUDED.p256dh,auth_secret=EXCLUDED.auth_secret,updated_at=now()
    `;
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/push/subscriptions', async (request, response, next) => {
  try {
    const { endpoint } = request.body || {};
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      response.status(400).json({ error: 'L’abonnement à supprimer est invalide.' });
      return;
    }
    const result = await prisma.$executeRaw`
      DELETE FROM public.uce_push_subscriptions
      WHERE endpoint=${endpoint}
        AND eglise_id=${request.identity.profile.eglise_id}::uuid
        AND profile_id=${request.identity.authUser.id}::uuid
    `;
    if (!result) {
      response.status(404).json({ error: 'Cet appareil n’est pas abonné aux alertes.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/livestreams', async (request, response, next) => {
  try {
    const streams = await prisma.$queryRaw`
      SELECT id,title,description,stream_url,starts_at,status,created_at,updated_at
      FROM public.uce_livestreams
      WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
      ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
        CASE WHEN status='scheduled' THEN starts_at END ASC NULLS LAST,
        CASE WHEN status='ended' THEN COALESCE(starts_at,updated_at) END DESC NULLS LAST,
        created_at DESC
      LIMIT 100
    `;
    response.json(streams);
  } catch (error) {
    next(error);
  }
});

app.post('/api/livestreams', async (request, response, next) => {
  try {
    if (!isPastor(request.identity) && !isSystemAdministrator(request.identity)) {
      response.status(403).json({ error: 'La gestion des directs est réservée au pasteur et à l’administration.' });
      return;
    }
    const { title, description = '', stream_url: streamUrl, starts_at: startsAt = null, status = 'scheduled' } = request.body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 160
      || typeof description !== 'string' || description.length > 2000
      || !isSupportedStreamUrl(streamUrl) || !['scheduled', 'live', 'ended'].includes(status)
      || (startsAt !== null && (!Number.isFinite(Date.parse(startsAt))))) {
      response.status(400).json({ error: 'Le titre, la description, le lien du direct ou la programmation est invalide.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.uce_livestreams
        (eglise_id,title,description,stream_url,starts_at,status,created_by)
      VALUES (${request.identity.profile.eglise_id}::uuid,${title.trim()},${description.trim()},
        ${streamUrl},${startsAt ? new Date(startsAt) : null}::timestamptz,${status},
        ${request.identity.authUser.id}::uuid)
      RETURNING id,title,description,stream_url,starts_at,status,created_at,updated_at
    `;
    response.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/livestreams/:id', async (request, response, next) => {
  try {
    if (!isPastor(request.identity) && !isSystemAdministrator(request.identity)) {
      response.status(403).json({ error: 'La gestion des directs est réservée au pasteur et à l’administration.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'Le direct sélectionné est invalide.' });
      return;
    }
    const body = request.body || {};
    const allowed = ['title', 'description', 'stream_url', 'starts_at', 'status'];
    if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))
      || (Object.hasOwn(body, 'title') && (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 160))
      || (Object.hasOwn(body, 'description') && (typeof body.description !== 'string' || body.description.length > 2000))
      || (Object.hasOwn(body, 'stream_url') && !isSupportedStreamUrl(body.stream_url))
      || (Object.hasOwn(body, 'status') && !['scheduled', 'live', 'ended'].includes(body.status))
      || (Object.hasOwn(body, 'starts_at') && body.starts_at !== null && !Number.isFinite(Date.parse(body.starts_at)))) {
      response.status(400).json({ error: 'Les modifications du direct sont invalides.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      UPDATE public.uce_livestreams
      SET title=COALESCE(${Object.hasOwn(body, 'title') ? body.title.trim() : null},title),
        description=COALESCE(${Object.hasOwn(body, 'description') ? body.description.trim() : null},description),
        stream_url=COALESCE(${body.stream_url || null},stream_url),
        starts_at=CASE WHEN ${Object.hasOwn(body, 'starts_at')} THEN ${body.starts_at ? new Date(body.starts_at) : null}::timestamptz ELSE starts_at END,
        status=COALESCE(${body.status || null},status),updated_at=now()
      WHERE id=${request.params.id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
      RETURNING id,title,description,stream_url,starts_at,status,created_at,updated_at
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Direct introuvable.' });
      return;
    }
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/livestreams/:id', async (request, response, next) => {
  try {
    if (!isPastor(request.identity) && !isSystemAdministrator(request.identity)) {
      response.status(403).json({ error: 'La gestion des directs est réservée au pasteur et à l’administration.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'Le direct sélectionné est invalide.' });
      return;
    }
    const result = await prisma.$executeRaw`
      DELETE FROM public.uce_livestreams
      WHERE id=${request.params.id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
    `;
    if (!result) {
      response.status(404).json({ error: 'Direct introuvable.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/studies/members', async (request, response, next) => {
  try {
    if (!canManageStudyContent(request.identity)) {
      response.status(403).json({ error: 'La préparation des formations est réservée au pasteur et à l’administration.' });
      return;
    }
    const members = await prisma.$queryRaw`
      SELECT m.id AS member_id,m.profil_utilisateur_id AS profile_id,
        CONCAT_WS(' ',m.prenom,m.nom,m.postnom) AS full_name,m.numero_membre
      FROM public.membres m
      JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
      WHERE m.eglise_id=${request.identity.profile.eglise_id}::uuid AND p.statut='actif'
      ORDER BY m.nom,m.prenom,m.postnom LIMIT 1000
    `;
    response.json(members);
  } catch (error) {
    next(error);
  }
});

app.get('/api/studies/groups', async (request, response, next) => {
  try {
    const groups = await prisma.$queryRaw`
      SELECT g.id,g.title,g.description,g.created_by,g.created_at,g.updated_at,
        (g.created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)}) AS is_creator,
        (SELECT count(*)::int FROM public.uce_study_group_members m
          WHERE m.group_id=g.id AND m.eglise_id=g.eglise_id) AS member_count
      FROM public.uce_study_groups g
      WHERE g.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND (g.created_by=${request.identity.authUser.id}::uuid
          OR ${isSystemAdministrator(request.identity)}
          OR EXISTS (
            SELECT 1 FROM public.uce_study_group_members m
            WHERE m.group_id=g.id AND m.eglise_id=g.eglise_id
              AND m.profile_id=${request.identity.authUser.id}::uuid
          ))
      ORDER BY g.updated_at DESC
    `;
    response.json(groups);
  } catch (error) {
    next(error);
  }
});

app.post('/api/studies/groups', async (request, response, next) => {
  try {
    if (!canManageStudyContent(request.identity)) {
      response.status(403).json({ error: 'La gestion des formations est réservée au pasteur et à l’administration.' });
      return;
    }
    const { title, description = '', member_ids: memberIds = [] } = request.body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 160
      || typeof description !== 'string' || description.length > 2000
      || !Array.isArray(memberIds) || memberIds.length > 200
      || memberIds.some((id) => !isUuid(id)) || new Set(memberIds).size !== memberIds.length) {
      response.status(400).json({ error: 'Le nom, la description ou la liste des membres est invalide.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const group = await prisma.$transaction(async (tx) => {
      const profiles = memberIds.length ? await tx.$queryRaw`
        SELECT m.id AS member_id,m.profil_utilisateur_id AS profile_id
        FROM public.membres m
        JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
        WHERE m.eglise_id=${egliseId}::uuid AND m.id=ANY(${memberIds}::uuid[]) AND p.statut='actif'
      ` : [];
      if (profiles.length !== memberIds.length) {
        const error = new Error('Un ou plusieurs membres n’ont pas de compte actif dans cette église.');
        error.status = 400;
        throw error;
      }
      const rows = await tx.$queryRaw`
        INSERT INTO public.uce_study_groups (eglise_id,title,description,created_by)
        VALUES (${egliseId}::uuid,${title.trim()},${description.trim()},${request.identity.authUser.id}::uuid)
        RETURNING id,title,description,created_by,created_at,updated_at
      `;
      const created = rows[0];
      if (profiles.length) {
        await tx.$executeRaw`
          INSERT INTO public.uce_study_group_members
            (eglise_id,group_id,member_id,profile_id,added_by)
          SELECT ${egliseId}::uuid,${created.id}::uuid,m.id,m.profil_utilisateur_id,
            ${request.identity.authUser.id}::uuid
          FROM public.membres m
          WHERE m.eglise_id=${egliseId}::uuid AND m.id=ANY(${memberIds}::uuid[])
        `;
      }
      return { ...created, member_count: profiles.length, is_creator: true };
    });
    response.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

app.get('/api/studies/groups/:id/members', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La formation sélectionnée est invalide.' });
      return;
    }
    const members = await prisma.$queryRaw`
      SELECT g.created_by,m.member_id,m.profile_id,m.full_name,m.numero_membre
      FROM public.uce_study_groups g
      LEFT JOIN (
        SELECT gm.group_id,gm.eglise_id,gm.member_id,gm.profile_id,
          CONCAT_WS(' ',m.prenom,m.nom,m.postnom) AS full_name,m.numero_membre
        FROM public.uce_study_group_members gm
        JOIN public.membres m ON m.id=gm.member_id AND m.eglise_id=gm.eglise_id
      ) m ON m.group_id=g.id AND m.eglise_id=g.eglise_id
      WHERE g.id=${request.params.id}::uuid
        AND g.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND (g.created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
        AND ${canManageStudyContent(request.identity)}
      ORDER BY m.full_name
    `;
    if (!members.length) {
      response.status(404).json({ error: 'Formation introuvable ou consultation non autorisée.' });
      return;
    }
    response.json(members.filter((member) => member.member_id));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/studies/groups/:id/members', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La formation sélectionnée est invalide.' });
      return;
    }
    const { member_ids: memberIds } = request.body || {};
    if (!Array.isArray(memberIds) || memberIds.length > 200
      || memberIds.some((id) => !isUuid(id)) || new Set(memberIds).size !== memberIds.length) {
      response.status(400).json({ error: 'La liste des membres est invalide.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const result = await prisma.$transaction(async (tx) => {
      const groups = await tx.$queryRaw`
        SELECT id FROM public.uce_study_groups
        WHERE id=${request.params.id}::uuid AND eglise_id=${egliseId}::uuid
          AND (created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
          AND ${canManageStudyContent(request.identity)}
        FOR UPDATE
      `;
      if (!groups[0]) {
        const error = new Error('Formation introuvable ou modification non autorisée.');
        error.status = 404;
        throw error;
      }
      const profiles = memberIds.length ? await tx.$queryRaw`
        SELECT m.id AS member_id,m.profil_utilisateur_id AS profile_id
        FROM public.membres m
        JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
        WHERE m.eglise_id=${egliseId}::uuid AND m.id=ANY(${memberIds}::uuid[]) AND p.statut='actif'
      ` : [];
      if (profiles.length !== memberIds.length) {
        const error = new Error('Un ou plusieurs membres n’ont pas de compte actif dans cette église.');
        error.status = 400;
        throw error;
      }
      await tx.$executeRaw`
        DELETE FROM public.uce_study_group_members
        WHERE eglise_id=${egliseId}::uuid AND group_id=${request.params.id}::uuid
      `;
      if (profiles.length) {
        await tx.$executeRaw`
          INSERT INTO public.uce_study_group_members (eglise_id,group_id,member_id,profile_id,added_by)
          SELECT ${egliseId}::uuid,${request.params.id}::uuid,m.id,m.profil_utilisateur_id,
            ${request.identity.authUser.id}::uuid
          FROM public.membres m
          WHERE m.eglise_id=${egliseId}::uuid AND m.id=ANY(${memberIds}::uuid[])
        `;
        await tx.$executeRaw`
          INSERT INTO public.uce_study_progress (eglise_id,group_id,lesson_id,profile_id)
          SELECT ${egliseId}::uuid,${request.params.id}::uuid,l.id,m.profil_utilisateur_id
          FROM public.uce_study_lessons l
          JOIN public.membres m ON m.eglise_id=l.eglise_id
          WHERE l.eglise_id=${egliseId}::uuid AND l.group_id=${request.params.id}::uuid
            AND m.id=ANY(${memberIds}::uuid[])
          ON CONFLICT (lesson_id,profile_id) DO NOTHING
        `;
      }
      await tx.$executeRaw`
        UPDATE public.uce_study_groups SET updated_at=now()
        WHERE id=${request.params.id}::uuid AND eglise_id=${egliseId}::uuid
      `;
      return profiles.length;
    });
    response.json({ member_count: result });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/studies/groups/:id', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id) || !canManageStudyContent(request.identity)) {
      response.status(403).json({ error: 'La modification de la formation est réservée au pasteur et à l’administration.' });
      return;
    }
    const body = request.body || {};
    const allowed = ['title', 'description'];
    const title = body.title === undefined ? null : typeof body.title === 'string' ? body.title.trim() : '';
    const description = body.description === undefined ? null : typeof body.description === 'string' ? body.description.trim() : '';
    if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))
      || (title !== null && (!title || title.length > 160))
      || (description !== null && description.length > 2000)) {
      response.status(400).json({ error: 'Le titre ou la description de la formation est invalide.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      UPDATE public.uce_study_groups SET
        title=COALESCE(${title},title),
        description=COALESCE(${description},description),
        updated_at=now()
      WHERE id=${request.params.id}::uuid
        AND eglise_id=${request.identity.profile.eglise_id}::uuid
        AND (created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
      RETURNING id,title,description,created_by,created_at,updated_at
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Formation introuvable ou modification non autorisée.' });
      return;
    }
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/studies/groups/:id', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La formation sélectionnée est invalide.' });
      return;
    }
    const result = await prisma.$executeRaw`
      DELETE FROM public.uce_study_groups
      WHERE id=${request.params.id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
        AND (created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
        AND ${canManageStudyContent(request.identity)}
    `;
    if (!result) {
      response.status(404).json({ error: 'Formation introuvable ou suppression non autorisée.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/studies/groups/:id/lessons', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La formation sélectionnée est invalide.' });
      return;
    }
    const group = await prisma.$queryRaw`
      SELECT id FROM public.uce_study_groups g
      WHERE g.id=${request.params.id}::uuid AND g.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND (g.created_by=${request.identity.authUser.id}::uuid
          OR ${isSystemAdministrator(request.identity)}
          OR EXISTS (SELECT 1 FROM public.uce_study_group_members m
            WHERE m.group_id=g.id AND m.eglise_id=g.eglise_id
              AND m.profile_id=${request.identity.authUser.id}::uuid))
    `;
    if (!group[0]) {
      response.status(404).json({ error: 'Formation introuvable ou accès non autorisé.' });
      return;
    }
    if (request.identity.member?.id) {
      await prisma.$executeRaw`
        INSERT INTO public.uce_study_progress (eglise_id,group_id,lesson_id,profile_id)
        SELECT l.eglise_id,l.group_id,l.id,${request.identity.authUser.id}::uuid
        FROM public.uce_study_lessons l
        WHERE l.eglise_id=${request.identity.profile.eglise_id}::uuid
          AND l.group_id=${request.params.id}::uuid
          AND EXISTS (SELECT 1 FROM public.uce_study_group_members gm
            WHERE gm.group_id=l.group_id AND gm.eglise_id=l.eglise_id
              AND gm.profile_id=${request.identity.authUser.id}::uuid)
        ON CONFLICT (lesson_id,profile_id) DO NOTHING
      `;
    }
    const lessons = await prisma.$queryRaw`
      SELECT l.id,l.title,l.scripture,l.content,l.video_url,l.created_by,l.created_at,l.updated_at,
        (p.opened_at IS NOT NULL) AS is_completed,p.opened_at
      FROM public.uce_study_lessons l
      LEFT JOIN public.uce_study_progress p
        ON p.lesson_id=l.id AND p.profile_id=${request.identity.authUser.id}::uuid
      WHERE l.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND l.group_id=${request.params.id}::uuid
      ORDER BY l.created_at DESC
    `;
    response.json(lessons);
  } catch (error) {
    next(error);
  }
});

app.post('/api/studies/groups/:id/lessons', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La formation sélectionnée est invalide.' });
      return;
    }
    const { title, scripture = '', content, video_url: videoUrl = '' } = request.body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 160
      || typeof scripture !== 'string' || scripture.length > 300
      || typeof content !== 'string' || !content.trim() || content.length > 30000
      || (videoUrl && !isSupportedStreamUrl(videoUrl))) {
      response.status(400).json({ error: 'Le titre, le passage, le contenu ou le lien vidéo du cours est invalide.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.uce_study_lessons
        (eglise_id,group_id,title,scripture,content,video_url,created_by)
      SELECT g.eglise_id,g.id,${title.trim()},${scripture.trim()},${content.trim()},
        ${videoUrl || null},${request.identity.authUser.id}::uuid
      FROM public.uce_study_groups g
      WHERE g.id=${request.params.id}::uuid AND g.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND (g.created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
        AND ${canManageStudyContent(request.identity)}
      RETURNING id,title,scripture,content,video_url,created_by,created_at,updated_at
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Formation introuvable ou création de cours non autorisée.' });
      return;
    }
    await prisma.$executeRaw`
      INSERT INTO public.uce_study_progress (eglise_id,group_id,lesson_id,profile_id)
      SELECT ${request.identity.profile.eglise_id}::uuid,${request.params.id}::uuid,
        ${rows[0].id}::uuid,gm.profile_id
      FROM public.uce_study_group_members gm
      WHERE gm.group_id=${request.params.id}::uuid
        AND gm.eglise_id=${request.identity.profile.eglise_id}::uuid
      ON CONFLICT (lesson_id,profile_id) DO NOTHING
    `;
    response.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/studies/lessons/:id', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'Le cours sélectionné est invalide.' });
      return;
    }
    if (!canManageStudyContent(request.identity)) {
      response.status(403).json({ error: 'La modification des cours est réservée au pasteur et à l’administration.' });
      return;
    }
    const body = request.body || {};
    const allowed = ['title', 'scripture', 'content', 'video_url'];
    const title = body.title === undefined ? null : typeof body.title === 'string' ? body.title.trim() : '';
    const scripture = body.scripture === undefined ? null : typeof body.scripture === 'string' ? body.scripture.trim() : '';
    const content = body.content === undefined ? null : typeof body.content === 'string' ? body.content.trim() : '';
    const videoUrl = body.video_url === undefined ? null : body.video_url;
    if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))
      || (title !== null && (!title || title.length > 160))
      || (scripture !== null && scripture.length > 300)
      || (content !== null && (!content || content.length > 30000))
      || (videoUrl !== null && videoUrl !== '' && !isSupportedStreamUrl(videoUrl))) {
      response.status(400).json({ error: 'Les modifications du cours sont invalides.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      UPDATE public.uce_study_lessons l SET
        title=COALESCE(${title},l.title),
        scripture=COALESCE(${scripture},l.scripture),
        content=COALESCE(${content},l.content),
        video_url=CASE WHEN ${videoUrl !== null} THEN ${videoUrl || null} ELSE l.video_url END,
        updated_at=now()
      FROM public.uce_study_groups g
      WHERE l.id=${request.params.id}::uuid AND l.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND g.id=l.group_id AND g.eglise_id=l.eglise_id
        AND (g.created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
      RETURNING l.id,l.title,l.scripture,l.content,l.video_url,l.created_by,l.created_at,l.updated_at
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Cours introuvable ou modification non autorisée.' });
      return;
    }
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/studies/lessons/:id', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'Le cours sélectionné est invalide.' });
      return;
    }
    const result = await prisma.$executeRaw`
      DELETE FROM public.uce_study_lessons l
      USING public.uce_study_groups g
      WHERE l.id=${request.params.id}::uuid AND l.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND g.id=l.group_id AND g.eglise_id=l.eglise_id
        AND (g.created_by=${request.identity.authUser.id}::uuid OR ${isSystemAdministrator(request.identity)})
        AND ${canManageStudyContent(request.identity)}
    `;
    if (!result) {
      response.status(404).json({ error: 'Cours introuvable ou suppression non autorisée.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/studies/lessons/:id/open', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id) || !request.identity.member?.id) {
      response.status(400).json({ error: 'Le cours ou le profil membre est invalide.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.uce_study_progress
        (eglise_id,group_id,lesson_id,profile_id,opened_at)
      SELECT l.eglise_id,l.group_id,l.id,${request.identity.authUser.id}::uuid,now()
      FROM public.uce_study_lessons l
      JOIN public.uce_study_group_members gm
        ON gm.group_id=l.group_id AND gm.eglise_id=l.eglise_id
        AND gm.profile_id=${request.identity.authUser.id}::uuid
      WHERE l.id=${request.params.id}::uuid
        AND l.eglise_id=${request.identity.profile.eglise_id}::uuid
      ON CONFLICT (lesson_id,profile_id) DO UPDATE
        SET opened_at=COALESCE(public.uce_study_progress.opened_at,now()),
          updated_at=now()
      RETURNING lesson_id,opened_at
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Cours introuvable ou accès non autorisé.' });
      return;
    }
    response.json({ completed: true, opened_at: rows[0].opened_at });
  } catch (error) {
    next(error);
  }
});

app.get('/api/notifications', async (request, response, next) => {
  try {
    if (!canManageNotifications(request.identity)) {
      response.status(403).json({ error: 'La gestion des alertes est réservée au département Communication.' });
      return;
    }
    const notifications = await prisma.$queryRaw`
      SELECT n.id,n.category,n.title,n.message,n.url,n.target_type,n.target_id,
        n.scheduled_at,n.created_at,n.dispatch_status,n.delivery_count,
        n.failure_count,n.dispatch_error,
        (SELECT count(*)::int FROM public.uce_notification_recipients r
          WHERE r.notification_id=n.id AND r.eglise_id=n.eglise_id) AS recipient_count
      FROM public.uce_notifications n
      WHERE n.eglise_id=${request.identity.profile.eglise_id}::uuid
      ORDER BY n.created_at DESC
      LIMIT 50
    `;
    response.json(notifications);
  } catch (error) {
    next(error);
  }
});

app.post('/api/notifications', async (request, response, next) => {
  try {
    if (!canManageNotifications(request.identity)) {
      response.status(403).json({ error: 'La diffusion des alertes est réservée au département Communication.' });
      return;
    }
    if (!pushConfigured) {
      response.status(503).json({ error: 'Les alertes téléphone ne sont pas configurées. Renseignez les clés VAPID côté serveur.' });
      return;
    }
    const body = request.body || {};
    const { category, title, message, target_type: targetType, target_id: targetId = null, url = '', scheduled_at: scheduledAt = null } = body;
    const validCategories = ['general', 'prayer', 'service', 'fundraiser', 'event', 'department', 'commission'];
    if (!validCategories.includes(category) || typeof title !== 'string' || !title.trim() || title.trim().length > 160
      || typeof message !== 'string' || !message.trim() || message.trim().length > 240
      || !['church', 'department', 'commission'].includes(targetType)
      || (targetType === 'church' ? targetId !== null : !isUuid(targetId))
      || (url && !isSafeWebUrl(url, { allowRelative: true }))
      || (scheduledAt !== null && !Number.isFinite(Date.parse(scheduledAt)))) {
      response.status(400).json({ error: 'La notification, sa cible, son lien ou sa date de diffusion est invalide.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const recipients = targetType === 'church'
      ? await prisma.$queryRaw`
        SELECT p.id AS profile_id FROM public.profils_utilisateurs p
        WHERE p.eglise_id=${egliseId}::uuid AND p.statut='actif'
      `
      : await prisma.$queryRaw`
        SELECT DISTINCT p.id AS profile_id
        FROM public.affectations a
        JOIN public.membres m ON m.id=a.membre_id AND m.eglise_id=a.eglise_id
        JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
        WHERE a.eglise_id=${egliseId}::uuid AND p.statut='actif'
          AND a.statut='active' AND a.date_debut<=CURRENT_DATE
          AND (a.date_fin IS NULL OR a.date_fin>=CURRENT_DATE)
          AND ((${targetType === 'department'} AND a.departement_id=${targetId}::uuid)
            OR (${targetType === 'commission'} AND a.commission_id=${targetId}::uuid))
      `;
    const recipientIds = recipients.map((recipient) => recipient.profile_id);
    if (recipientIds.length === 0) {
      response.status(409).json({ error: 'Aucun membre connecté n’est rattaché à cette audience.' });
      return;
    }
    const notification = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        INSERT INTO public.uce_notifications
          (eglise_id,category,title,message,url,target_type,target_id,scheduled_at,created_by)
        VALUES (${egliseId}::uuid,${category},${title.trim()},${message.trim()},${url || null},
          ${targetType},${targetId}::uuid,${scheduledAt ? new Date(scheduledAt) : new Date()},
          ${request.identity.authUser.id}::uuid)
        RETURNING id,category,title,message,url,target_type,target_id,scheduled_at,created_at
      `;
      await tx.$executeRaw`
        INSERT INTO public.uce_notification_recipients (eglise_id,notification_id,profile_id)
        SELECT ${egliseId}::uuid,${rows[0].id}::uuid,recipient_id
        FROM unnest(${recipientIds}::uuid[]) AS recipient_id
      `;
      await writeAuditEvent(tx, {
        churchId: egliseId,
        actorId: request.identity.authUser.id,
        action: 'notification_sent',
        entityType: 'notification',
        entityId: rows[0].id,
        details: { category, target_type: targetType, recipient_count: recipientIds.length },
      });
      return rows[0];
    });
    const dispatch = new Date(notification.scheduled_at) <= new Date()
      ? await dispatchPushNotification(notification.id)
      : null;
    const dispatchState = await prisma.$queryRaw`
      SELECT dispatch_status,delivery_count,failure_count,dispatch_error
      FROM public.uce_notifications
      WHERE id=${notification.id}::uuid AND eglise_id=${egliseId}::uuid
    `;
    response.status(201).json({
      ...notification,
      ...dispatchState[0],
      recipient_count: recipientIds.length,
      dispatch,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/finance/cash-sessions', async (request, response, next) => {
  try {
    if (!isFinance(request.identity)) {
      response.status(403).json({ error: 'La consultation des sessions de caisse est réservée à la trésorerie.' });
      return;
    }

    const sessions = await prisma.$queryRaw`
      SELECT s.id,s.label,s.status,s.opening_cash::text AS opening_cash,
        s.counted_cash::text AS counted_cash,s.expected_cash::text AS closed_expected_cash,
        s.variance::text AS variance,s.opened_by,s.opened_at,s.closed_by,s.closed_at,
        COALESCE(d.cash_received,0)::text AS cash_received,
        COALESCE(e.cash_expenses,0)::text AS cash_expenses,
        CASE WHEN s.status='open'
          THEN (s.opening_cash+COALESCE(d.cash_received,0)-COALESCE(e.cash_expenses,0))::text
          ELSE s.expected_cash::text
        END AS expected_cash
      FROM public.finance_cash_sessions s
      LEFT JOIN LATERAL (
        SELECT SUM((r.payload->>'amount')::numeric) AS cash_received
        FROM public.uce_app_records r
        WHERE r.eglise_id=s.eglise_id AND r.entity_type='Donation'
          AND r.payload->>'cash_session_id'=s.id::text
          AND r.payload->>'status'='received' AND r.payload->>'payment_method'='cash'
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT SUM(x.amount) AS cash_expenses
        FROM public.finance_expenses x
        WHERE x.eglise_id=s.eglise_id AND x.cash_session_id=s.id
          AND x.status='paid' AND x.payment_method='cash'
      ) e ON true
      WHERE s.eglise_id=${request.identity.profile.eglise_id}::uuid
      ORDER BY s.opened_at DESC
      LIMIT 30
    `;
    response.json({
      active: sessions.find((session) => session.status === 'open') || null,
      sessions,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/finance/cash-sessions', async (request, response, next) => {
  try {
    if (!isTreasurer(request.identity)) {
      response.status(403).json({ error: 'Seule la trésorerie peut ouvrir une session de caisse.' });
      return;
    }
    const label = typeof request.body?.label === 'string' ? request.body.label.trim() : '';
    if (!label || label.length > 160) {
      response.status(400).json({ error: 'Indiquez le culte ou l’activité de la session (1 à 160 caractères).' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const actorId = request.identity.authUser.id;
    const session = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM public.eglises WHERE id=${egliseId}::uuid FOR UPDATE
      `;
      const existing = await tx.$queryRaw`
        SELECT id FROM public.finance_cash_sessions
        WHERE eglise_id=${egliseId}::uuid AND status='open'
        FOR UPDATE
      `;
      if (existing[0]) {
        const error = new Error('Une session de caisse est déjà ouverte. Clôturez-la avant d’en ouvrir une autre.');
        error.status = 409;
        throw error;
      }
      const rows = await tx.$queryRaw`
        INSERT INTO public.finance_cash_sessions (eglise_id,label,opened_by)
        VALUES (${egliseId}::uuid,${label},${actorId}::uuid)
        RETURNING id,label,status,opening_cash::text AS opening_cash,opened_by,opened_at
      `;
      await tx.$executeRaw`
        INSERT INTO public.finance_audit_events (eglise_id,actor_id,action,entity_type,entity_id,details)
        VALUES (${egliseId}::uuid,${actorId}::uuid,'cash_session_opened','finance_cash_session',
          ${rows[0].id}::uuid,${JSON.stringify({ label, opening_cash: '0' })}::jsonb)
      `;
      return rows[0];
    });
    response.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

app.post('/api/finance/cash-sessions/:id/close', async (request, response, next) => {
  try {
    if (!isTreasurer(request.identity)) {
      response.status(403).json({ error: 'Seule la trésorerie peut clôturer une session de caisse.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La session de caisse sélectionnée est invalide.' });
      return;
    }
    const countedInput = String(request.body?.counted_cash ?? '');
    if (!/^\d{1,20}$/.test(countedInput)) {
      response.status(400).json({ error: 'Le comptage réel doit être un montant entier positif ou nul.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const actorId = request.identity.authUser.id;
    const countedCash = BigInt(countedInput);
    const session = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        SELECT id,label,opening_cash::text AS opening_cash
        FROM public.finance_cash_sessions
        WHERE id=${request.params.id}::uuid AND eglise_id=${egliseId}::uuid AND status='open'
        FOR UPDATE
      `;
      const activeSession = rows[0];
      if (!activeSession) {
        const error = new Error('Session introuvable ou déjà clôturée.');
        error.status = 409;
        throw error;
      }
      const totals = await tx.$queryRaw`
        SELECT
          COALESCE((
            SELECT SUM((r.payload->>'amount')::numeric)
            FROM public.uce_app_records r
            WHERE r.eglise_id=${egliseId}::uuid AND r.entity_type='Donation'
              AND r.payload->>'cash_session_id'=${activeSession.id}::text
              AND r.payload->>'status'='received' AND r.payload->>'payment_method'='cash'
          ),0)::text AS cash_received,
          COALESCE((
            SELECT SUM(x.amount)
            FROM public.finance_expenses x
            WHERE x.eglise_id=${egliseId}::uuid AND x.cash_session_id=${activeSession.id}::uuid
              AND x.status='paid' AND x.payment_method='cash'
          ),0)::text AS cash_expenses
      `;
      const expectedCash = BigInt(activeSession.opening_cash)
        + BigInt(totals[0].cash_received)
        - BigInt(totals[0].cash_expenses);
      if (expectedCash < 0n) {
        const error = new Error('Le solde théorique de la caisse est négatif. Vérifiez les dépenses en espèces avant clôture.');
        error.status = 409;
        throw error;
      }
      const variance = countedCash - expectedCash;
      const closed = await tx.$queryRaw`
        UPDATE public.finance_cash_sessions
        SET status='closed',counted_cash=${countedCash.toString()}::numeric,
          expected_cash=${expectedCash.toString()}::numeric,variance=${variance.toString()}::numeric,
          closed_by=${actorId}::uuid,closed_at=now()
        WHERE id=${activeSession.id}::uuid AND eglise_id=${egliseId}::uuid AND status='open'
        RETURNING id,label,status,opening_cash::text AS opening_cash,
          counted_cash::text AS counted_cash,expected_cash::text AS expected_cash,
          variance::text AS variance,opened_by,opened_at,closed_by,closed_at
      `;
      await tx.$executeRaw`
        INSERT INTO public.finance_audit_events (eglise_id,actor_id,action,entity_type,entity_id,details)
        VALUES (${egliseId}::uuid,${actorId}::uuid,'cash_session_closed','finance_cash_session',
          ${activeSession.id}::uuid,
          ${JSON.stringify({
            expected_cash: expectedCash.toString(),
            counted_cash: countedCash.toString(),
            variance: variance.toString(),
          })}::jsonb)
      `;
      return closed[0];
    });
    response.json(session);
  } catch (error) {
    next(error);
  }
});

app.get('/api/finance/members', async (request, response, next) => {
  try {
    if (!isFinance(request.identity)) {
      response.status(403).json({ error: 'La consultation des membres est réservée à la trésorerie.' });
      return;
    }

    const members = await prisma.$queryRaw`
      SELECT m.id AS member_id, m.profil_utilisateur_id AS profile_id,
        CONCAT_WS(' ',m.prenom,m.nom,m.postnom) AS full_name,
        m.numero_membre, m.email
      FROM public.membres m
      WHERE m.eglise_id=${request.identity.profile.eglise_id}::uuid
      ORDER BY m.nom,m.prenom,m.postnom
      LIMIT 500
    `;
    response.json(members);
  } catch (error) {
    next(error);
  }
});

app.get('/api/finance/ledger', async (request, response, next) => {
  try {
    if (!isFinance(request.identity)) {
      response.status(403).json({ error: 'Le grand livre est réservé à la trésorerie.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const [accounts, journals, totals] = await Promise.all([
      prisma.$queryRaw`
        SELECT a.id,a.code,a.label,a.account_class,a.account_type,a.syscohada_code,a.is_active,
          COALESCE(SUM(l.debit_amount) FILTER (WHERE j.id IS NOT NULL),0)::text AS debit_total,
          COALESCE(SUM(l.credit_amount) FILTER (WHERE j.id IS NOT NULL),0)::text AS credit_total,
          CASE WHEN a.account_type IN ('asset','expense')
            THEN COALESCE(SUM(l.debit_amount-l.credit_amount) FILTER (WHERE j.id IS NOT NULL),0)
            ELSE COALESCE(SUM(l.credit_amount-l.debit_amount) FILTER (WHERE j.id IS NOT NULL),0)
          END::text AS balance
        FROM public.finance_accounts a
        LEFT JOIN public.finance_journal_lines l ON l.account_id=a.id AND l.eglise_id=a.eglise_id
        LEFT JOIN public.finance_journals j ON j.id=l.journal_id AND j.status='posted'
        WHERE a.eglise_id=${egliseId}::uuid
        GROUP BY a.id
        ORDER BY a.account_class,a.code
      `,
      prisma.$queryRaw`
        SELECT j.id,j.entry_number,j.entry_date,j.source_type,j.description,j.created_at,
          COALESCE(jsonb_agg(jsonb_build_object(
            'line_number',l.line_number,'account_code',a.code,'account_label',a.label,
            'member_id',l.member_id,'line_description',l.description,
            'debit',l.debit_amount,'credit',l.credit_amount
          ) ORDER BY l.line_number) FILTER (WHERE l.id IS NOT NULL),'[]'::jsonb) AS lines
        FROM public.finance_journals j
        LEFT JOIN public.finance_journal_lines l ON l.journal_id=j.id AND l.eglise_id=j.eglise_id
        LEFT JOIN public.finance_accounts a ON a.id=l.account_id AND a.eglise_id=l.eglise_id
        WHERE j.eglise_id=${egliseId}::uuid AND j.status='posted'
        GROUP BY j.id
        ORDER BY j.entry_date DESC,j.created_at DESC
        LIMIT 200
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(l.debit_amount),0)::text AS debits,
          COALESCE(SUM(l.credit_amount),0)::text AS credits,
          COUNT(DISTINCT j.id)::int AS posted_entries
        FROM public.finance_journals j
        JOIN public.finance_journal_lines l ON l.journal_id=j.id
        WHERE j.eglise_id=${egliseId}::uuid AND j.status='posted'
      `,
    ]);
    response.json({ accounts, journals, totals: totals[0] });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/finance/accounts/:id', async (request, response, next) => {
  try {
    if (!isFinancialController(request.identity)) {
      response.status(403).json({ error: 'Seul le contrôleur financier peut configurer le plan de comptes.' });
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
      response.status(400).json({ error: 'Le compte sélectionné est invalide.' });
      return;
    }
    const syscohadaCode = typeof request.body?.syscohada_code === 'string'
      ? request.body.syscohada_code.trim()
      : '';
    if (!/^[1-8][0-9]{0,9}$/.test(syscohadaCode)) {
      response.status(400).json({ error: 'Le numéro de compte SYSCOHADA doit contenir de 1 à 10 chiffres et commencer par sa classe comptable.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const account = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        UPDATE public.finance_accounts a
        SET syscohada_code=${syscohadaCode},updated_at=now()
        WHERE a.id=${request.params.id}::uuid AND a.eglise_id=${egliseId}::uuid
          AND NOT EXISTS (
            SELECT 1 FROM public.finance_journal_lines l
            WHERE l.account_id=a.id AND l.eglise_id=a.eglise_id
          )
        RETURNING a.id,a.code,a.label,a.account_class,a.account_type,a.syscohada_code,a.is_active
      `;
      if (!rows[0]) {
        const error = new Error('Compte introuvable ou déjà utilisé dans une écriture; son mapping historique ne peut pas être modifié.');
        error.status = 409;
        throw error;
      }
      await tx.$executeRaw`
        INSERT INTO public.finance_audit_events (eglise_id,actor_id,action,entity_type,entity_id,details)
        VALUES (${egliseId}::uuid,${request.identity.authUser.id}::uuid,'account_mapped','finance_account',
          ${request.params.id}::uuid,${JSON.stringify({ syscohada_code: syscohadaCode })}::jsonb)
      `;
      return rows[0];
    });
    response.json(account);
  } catch (error) {
    next(error);
  }
});

app.get('/api/finance/expenses', async (request, response, next) => {
  try {
    if (!isFinance(request.identity)) {
      response.status(403).json({ error: 'Les dépenses sont réservées à la trésorerie.' });
      return;
    }
    const expenses = await prisma.$queryRaw`
      SELECT id,expense_number,category,description,vendor_name,invoice_reference,
        amount::text,currency,status,payment_method,payment_reference,requested_by,
        reviewed_by,reviewed_at,pastor_approved_by,pastor_approved_at,
        rejection_reason,paid_by,paid_at,journal_id,created_at
      FROM public.finance_expenses
      WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
      ORDER BY created_at DESC
      LIMIT 200
    `;
    response.json(expenses);
  } catch (error) {
    next(error);
  }
});

app.get('/api/finance/daily-report', async (request, response, next) => {
  try {
    if (!isPastor(request.identity) && !isSystemAdministrator(request.identity)) {
      response.status(403).json({ error: 'Le rapport financier quotidien est réservé au pasteur principal et à l’administration générale.' });
      return;
    }
    const reportDate = typeof request.query.date === 'string' ? request.query.date : getChurchAccountingDate();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(reportDate)
      ? new Date(`${reportDate}T00:00:00.000Z`)
      : null;
    if (!parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== reportDate) {
      response.status(400).json({ error: 'La date du rapport doit être une date valide au format AAAA-MM-JJ.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const [receiptTotals, receiptTypes, paidExpenses, pendingPastor] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count,
          COALESCE(SUM((r.payload->>'amount')::numeric),0)::text AS total,
          COALESCE(SUM((r.payload->>'amount')::numeric) FILTER (WHERE r.payload->>'payment_method'='cash'),0)::text AS cash_total,
          COALESCE(SUM((r.payload->>'amount')::numeric) FILTER (WHERE r.payload->>'payment_method'<>'cash'),0)::text AS electronic_total
        FROM public.uce_app_records r
        WHERE r.eglise_id=${egliseId}::uuid AND r.entity_type='Donation'
          AND r.payload->>'status'='received'
          AND (COALESCE(NULLIF(r.payload->>'confirmed_at','')::timestamptz,r.created_at)
            AT TIME ZONE 'Africa/Brazzaville')::date=${reportDate}::date
      `,
      prisma.$queryRaw`
        SELECT r.payload->>'type' AS type,
          COUNT(*)::int AS count,
          COALESCE(SUM((r.payload->>'amount')::numeric),0)::text AS total
        FROM public.uce_app_records r
        WHERE r.eglise_id=${egliseId}::uuid AND r.entity_type='Donation'
          AND r.payload->>'status'='received'
          AND (COALESCE(NULLIF(r.payload->>'confirmed_at','')::timestamptz,r.created_at)
            AT TIME ZONE 'Africa/Brazzaville')::date=${reportDate}::date
        GROUP BY r.payload->>'type'
        ORDER BY r.payload->>'type'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count,
          COALESCE(SUM(amount),0)::text AS total
        FROM public.finance_expenses
        WHERE eglise_id=${egliseId}::uuid AND status='paid'
          AND (paid_at AT TIME ZONE 'Africa/Brazzaville')::date=${reportDate}::date
      `,
      prisma.$queryRaw`
        SELECT x.id,x.expense_number,x.category,x.description,x.vendor_name,x.invoice_reference,
          x.amount::text AS amount,x.currency,x.requested_by,x.created_at,
          COALESCE(p.nom_affichage,'Trésorerie') AS requester_name
        FROM public.finance_expenses x
        LEFT JOIN public.profils_utilisateurs p ON p.id=x.requested_by
        WHERE x.eglise_id=${egliseId}::uuid AND x.status='pending_pastor'
        ORDER BY x.created_at ASC
        LIMIT 100
      `,
    ]);
    response.json({
      date: reportDate,
      receipts: { ...receiptTotals[0], by_type: receiptTypes },
      disbursements: paidExpenses[0],
      pending_pastor_approval: pendingPastor,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/finance/expenses', async (request, response, next) => {
  try {
    if (!isTreasurer(request.identity)) {
      response.status(403).json({ error: 'Seul le trésorier peut soumettre une dépense à validation.' });
      return;
    }
    const body = request.body || {};
    const amount = Number(body.amount);
    const categories = new Set(['general', 'ministry', 'event', 'solidarity', 'maintenance']);
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const vendorName = typeof body.vendor_name === 'string' ? body.vendor_name.trim() : '';
    const invoiceReference = typeof body.invoice_reference === 'string' ? body.invoice_reference.trim() : '';
    if (!Number.isSafeInteger(amount) || amount <= 0 || !categories.has(body.category)
      || !description || description.length > 500 || !vendorName || vendorName.length > 160
      || invoiceReference.length > 120) {
      response.status(400).json({ error: 'Le montant, la catégorie, le motif ou le bénéficiaire de la dépense est invalide.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const entryDate = getChurchAccountingDate();
    const year = Number(entryDate.slice(0, 4));
    const expense = await prisma.$transaction(async (tx) => {
      const sequenceRows = await tx.$queryRaw`
        INSERT INTO public.finance_sequences (eglise_id,sequence_name,sequence_year,last_value)
        VALUES (${egliseId}::uuid,'EXPENSE',${year},1)
        ON CONFLICT (eglise_id,sequence_name,sequence_year)
        DO UPDATE SET last_value=public.finance_sequences.last_value+1
        RETURNING last_value
      `;
      const expenseNumber = `UCE-DEP-${year}-${String(sequenceRows[0].last_value).padStart(6, '0')}`;
      const rows = await tx.$queryRaw`
        INSERT INTO public.finance_expenses
          (eglise_id,expense_number,category,description,vendor_name,invoice_reference,amount,currency,requested_by)
        VALUES
          (${egliseId}::uuid,${expenseNumber},${body.category},${description},${vendorName},
           ${invoiceReference || null},${amount},'XAF',${request.identity.authUser.id}::uuid)
        RETURNING *
      `;
      await tx.$executeRaw`
        INSERT INTO public.finance_audit_events (eglise_id,actor_id,action,entity_type,entity_id,details)
        VALUES (${egliseId}::uuid,${request.identity.authUser.id}::uuid,'expense_submitted','finance_expense',
          ${rows[0].id}::uuid,${JSON.stringify({ expense_number: expenseNumber, amount, category: body.category })}::jsonb)
      `;
      return rows[0];
    });
    response.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/finance/expenses/:id', async (request, response, next) => {
  try {
    const requestedAction = request.body?.action;
    const isPastorDecision = ['pastor_approve', 'pastor_reject'].includes(requestedAction);
    if (!isFinance(request.identity) && !(isPastor(request.identity) && isPastorDecision)) {
      response.status(403).json({ error: 'La gestion des dépenses est réservée à la trésorerie.' });
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
      response.status(400).json({ error: 'La dépense sélectionnée est invalide.' });
      return;
    }

    const { action } = request.body || {};
    const egliseId = request.identity.profile.eglise_id;
    const actorId = request.identity.authUser.id;
    if (['approve', 'reject', 'pastor_approve', 'pastor_reject'].includes(action)) {
      const isControllerDecision = ['approve', 'reject'].includes(action);
      const isPastorDecision = ['pastor_approve', 'pastor_reject'].includes(action);
      if (isControllerDecision && !isFinancialController(request.identity)) {
        response.status(403).json({ error: 'Seul le contrôleur financier peut effectuer le premier contrôle d’une dépense.' });
        return;
      }
      if (isPastorDecision && !isPastor(request.identity)) {
        response.status(403).json({ error: 'Seul le pasteur principal peut donner l’approbation finale d’une dépense.' });
        return;
      }
      const reason = typeof request.body.reason === 'string' ? request.body.reason.trim() : '';
      const isRejection = action === 'reject' || action === 'pastor_reject';
      if (isRejection && (!reason || reason.length > 300)) {
        response.status(400).json({ error: 'Un motif de rejet de 1 à 300 caractères est requis.' });
        return;
      }
      const rows = await prisma.$transaction(async (tx) => {
        const updated = await tx.$queryRaw`
          UPDATE public.finance_expenses
          SET status=${isControllerDecision
            ? (action === 'approve' ? 'pending_pastor' : 'rejected')
            : (action === 'pastor_approve' ? 'approved' : 'rejected')},
            reviewed_by=CASE WHEN ${isControllerDecision} THEN ${actorId}::uuid ELSE reviewed_by END,
            reviewed_at=CASE WHEN ${isControllerDecision} THEN now() ELSE reviewed_at END,
            pastor_approved_by=CASE WHEN ${isPastorDecision} THEN ${actorId}::uuid ELSE pastor_approved_by END,
            pastor_approved_at=CASE WHEN ${isPastorDecision} THEN now() ELSE pastor_approved_at END,
            rejection_reason=${isRejection ? reason : null},updated_at=now()
          WHERE id=${request.params.id}::uuid AND eglise_id=${egliseId}::uuid
            AND status=${isControllerDecision ? 'pending_review' : 'pending_pastor'}
            AND requested_by<>${actorId}::uuid
            AND (${isControllerDecision} OR reviewed_by IS DISTINCT FROM ${actorId}::uuid)
          RETURNING *
        `;
        if (!updated[0]) {
          const error = new Error('Dépense introuvable, déjà traitée, ou l’approbateur ne peut pas valider sa propre demande.');
          error.status = 409;
          throw error;
        }
        const auditAction = action === 'approve' ? 'expense_controller_approved'
          : action === 'reject' ? 'expense_controller_rejected'
            : action === 'pastor_approve' ? 'expense_pastor_approved' : 'expense_pastor_rejected';
        await tx.$executeRaw`
          INSERT INTO public.finance_audit_events (eglise_id,actor_id,action,entity_type,entity_id,details)
          VALUES (${egliseId}::uuid,${actorId}::uuid,${auditAction},
            'finance_expense',${request.params.id}::uuid,${JSON.stringify({ reason: reason || null })}::jsonb)
        `;
        return updated[0];
      });
      response.json(rows[0]);
      return;
    }

    if (action !== 'pay' || !isTreasurer(request.identity)) {
      response.status(403).json({ error: 'Action de dépense non autorisée.' });
      return;
    }
    const paymentMethod = request.body.payment_method;
    const paymentReference = typeof request.body.payment_reference === 'string' ? request.body.payment_reference.trim() : '';
    if (!['cash', 'mtn_momo', 'airtel_money', 'visa'].includes(paymentMethod)
      || paymentReference.length > 120 || (paymentMethod !== 'cash' && !paymentReference)) {
      response.status(400).json({ error: 'Le mode ou la référence du paiement de la dépense est invalide.' });
      return;
    }
    const paidExpense = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        SELECT * FROM public.finance_expenses
        WHERE id=${request.params.id}::uuid AND eglise_id=${egliseId}::uuid AND status='approved'
        FOR UPDATE
      `;
      const expense = rows[0];
      if (!expense) {
        const error = new Error('Seule une dépense approuvée et non encore payée peut être réglée.');
        error.status = 409;
        throw error;
      }
      let cashSessionId = null;
      if (paymentMethod === 'cash') {
        const sessions = await tx.$queryRaw`
          SELECT id,opening_cash::text AS opening_cash
          FROM public.finance_cash_sessions
          WHERE eglise_id=${egliseId}::uuid AND status='open'
          FOR UPDATE
        `;
        if (!sessions[0]) {
          const error = new Error('Ouvrez une session de caisse avant de régler une dépense en espèces.');
          error.status = 409;
          throw error;
        }
        cashSessionId = sessions[0].id;
        const totals = await tx.$queryRaw`
          SELECT
            COALESCE((
              SELECT SUM((r.payload->>'amount')::numeric)
              FROM public.uce_app_records r
              WHERE r.eglise_id=${egliseId}::uuid AND r.entity_type='Donation'
                AND r.payload->>'cash_session_id'=${cashSessionId}::text
                AND r.payload->>'status'='received' AND r.payload->>'payment_method'='cash'
            ),0)::text AS cash_received,
            COALESCE((
              SELECT SUM(x.amount)
              FROM public.finance_expenses x
              WHERE x.eglise_id=${egliseId}::uuid AND x.cash_session_id=${cashSessionId}::uuid
                AND x.status='paid' AND x.payment_method='cash'
            ),0)::text AS cash_expenses
        `;
        const availableCash = BigInt(sessions[0].opening_cash)
          + BigInt(totals[0].cash_received)
          - BigInt(totals[0].cash_expenses);
        if (availableCash < BigInt(String(expense.amount))) {
          const error = new Error('Le solde disponible dans la session de caisse est insuffisant pour régler cette dépense en espèces.');
          error.status = 409;
          throw error;
        }
      }
      const expenseCodeByCategory = {
        general: 'EXPENSE_GENERAL',
        ministry: 'EXPENSE_MINISTRY',
        event: 'EXPENSE_EVENT',
        solidarity: 'EXPENSE_SOLIDARITY',
        maintenance: 'EXPENSE_MAINTENANCE',
      };
      const { debitCode } = getDonationAccountCodes('offering', paymentMethod);
      const journal = await postFinanceJournal(tx, {
        egliseId,
        actorId,
        sourceType: 'expense',
        sourceId: expense.id,
        description: `${expense.expense_number} · ${expense.description}`,
        amount: Number(expense.amount),
        debitCode: expenseCodeByCategory[expense.category],
        creditCode: debitCode,
      });
      const updated = await tx.$queryRaw`
        UPDATE public.finance_expenses
        SET status='paid',payment_method=${paymentMethod},payment_reference=${paymentReference || null},
          cash_session_id=${cashSessionId}::uuid,paid_by=${actorId}::uuid,paid_at=now(),
          journal_id=${journal.id}::uuid,updated_at=now()
        WHERE id=${expense.id}::uuid AND eglise_id=${egliseId}::uuid AND status='approved'
        RETURNING *
      `;
      await tx.$executeRaw`
        INSERT INTO public.finance_audit_events (eglise_id,actor_id,action,entity_type,entity_id,details)
        VALUES (${egliseId}::uuid,${actorId}::uuid,'expense_paid','finance_expense',${expense.id}::uuid,
          ${JSON.stringify({ expense_number: expense.expense_number, journal_number: journal.entryNumber, payment_method: paymentMethod })}::jsonb)
      `;
      return updated[0];
    });
    response.json(paidExpense);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/me', async (request, response, next) => {
  try {
    const payload = request.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      response.status(400).json({ error: 'Les données du profil sont invalides.' });
      return;
    }
    const allowedPreferences = ['age', 'gender', 'country', 'city', 'spiritual_role', 'bio', 'community_id', 'reading_plan'];
    const preferences = { ...(request.identity.profile.preferences || {}) };
    for (const key of allowedPreferences) {
      if (Object.hasOwn(payload, key)) preferences[key] = payload[key];
    }
    if (Object.hasOwn(payload, 'bible_reading')) {
      const plan = payload.bible_reading;
      const planDays = { hope: 7, jesus: 21, psalms: 30 };
      if (plan !== null && (typeof plan !== 'object' || Array.isArray(plan)
        || !Object.hasOwn(planDays, plan.plan_id)
        || typeof plan.started_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.started_on)
        || !Number.isFinite(Date.parse(`${plan.started_on}T00:00:00Z`))
        || new Date(`${plan.started_on}T00:00:00Z`).toISOString().slice(0, 10) !== plan.started_on
        || !Array.isArray(plan.completed_days) || plan.completed_days.length > planDays[plan.plan_id]
        || plan.completed_days.some((day) => !Number.isInteger(day) || day < 1 || day > planDays[plan.plan_id])
        || new Set(plan.completed_days).size !== plan.completed_days.length)) {
        response.status(400).json({ error: 'La progression du parcours biblique est invalide.' });
        return;
      }
      preferences.bible_reading = plan === null ? null : {
        plan_id: plan.plan_id,
        started_on: plan.started_on,
        completed_days: [...plan.completed_days].sort((a, b) => a - b),
      };
    }
    if (Object.hasOwn(payload, 'quick_actions')) {
      const allowedQuickActions = new Set([
        '/communities', '/events', '/gallery', '/sermons', '/live', '/bible',
        '/studies', '/prayers', '/groups', '/teams', '/donations', '/journal',
        '/leadership', '/profile', '/admin', '/contact', '/map',
      ]);
      if (!Array.isArray(payload.quick_actions) || payload.quick_actions.length > allowedQuickActions.size
        || payload.quick_actions.some((path) => typeof path !== 'string' || !allowedQuickActions.has(path))
        || new Set(payload.quick_actions).size !== payload.quick_actions.length) {
        response.status(400).json({ error: 'La liste des accès rapides est invalide.' });
        return;
      }
      preferences.quick_actions = payload.quick_actions;
    }
    await prisma.profils_utilisateurs.update({
      where: { id: request.identity.authUser.id },
      data: {
        preferences,
        ...(typeof payload.phone === 'string' ? { telephone: payload.phone.slice(0, 30) } : {}),
        ...(typeof payload.photo_url === 'string' ? { photo_url: payload.photo_url.slice(0, 2048) } : {}),
        updated_at: new Date(),
      },
    });
    if (typeof payload.phone === 'string') {
      await prisma.membres.updateMany({
        where: { profil_utilisateur_id: request.identity.authUser.id, eglise_id: request.identity.profile.eglise_id },
        data: { telephone: payload.phone.slice(0, 30) },
      });
    }
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/departments', async (request, response, next) => {
  try {
    const [departments, commissions] = await Promise.all([
      prisma.$queryRaw`
        SELECT id,code,nom,description
        FROM public.departements
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid AND statut='actif'
        ORDER BY nom
      `,
      prisma.$queryRaw`
        SELECT c.id,c.departement_id,c.code,c.nom,c.description
        FROM public.commissions c
        WHERE c.eglise_id=${request.identity.profile.eglise_id}::uuid AND c.statut='actif'
        ORDER BY c.nom
      `,
    ]);
    response.json(departments.map((department) => ({
      ...department,
      commissions: commissions.filter((commission) => commission.departement_id === department.id),
    })));
  } catch (error) {
    next(error);
  }
});

async function canAccessDepartmentChat(identity, departmentId) {
  const elevated = isChurchWideStaff(identity);
  const rows = await prisma.$queryRaw`
    SELECT d.id
    FROM public.departements d
    WHERE d.id=${departmentId}::uuid
      AND d.eglise_id=${identity.profile.eglise_id}::uuid
      AND d.statut='actif'
      AND (${elevated}::boolean OR (
        EXISTS (
          SELECT 1 FROM public.utilisateur_roles ur
          JOIN public.roles r ON r.id=ur.role_id AND r.eglise_id=ur.eglise_id
          WHERE ur.profil_utilisateur_id=${identity.authUser.id}::uuid
            AND ur.eglise_id=d.eglise_id AND ur.departement_id=d.id
            AND ur.statut='active' AND ur.date_debut<=CURRENT_DATE
            AND (ur.date_fin IS NULL OR ur.date_fin>=CURRENT_DATE) AND r.actif=true
        )
        OR EXISTS (
          SELECT 1 FROM public.affectations a
          JOIN public.membres m ON m.id=a.membre_id AND m.eglise_id=a.eglise_id
          WHERE m.profil_utilisateur_id=${identity.authUser.id}::uuid
            AND a.eglise_id=d.eglise_id AND a.departement_id=d.id
            AND a.statut='active' AND a.date_debut<=CURRENT_DATE
            AND (a.date_fin IS NULL OR a.date_fin>=CURRENT_DATE)
            AND m.statut='actif'
        )
      ))
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

app.get('/api/department-chats', async (request, response, next) => {
  try {
    const identity = request.identity;
    const elevated = isChurchWideStaff(identity);
    const departments = await prisma.$queryRaw`
      SELECT d.id,d.code,d.nom,d.description,
        latest.contenu AS dernier_message,
        latest.created_at AS dernier_message_at,
        latest.auteur_nom AS dernier_message_auteur,
        COALESCE(members.member_count,0)::int AS membre_count
      FROM public.departements d
      LEFT JOIN LATERAL (
        SELECT msg.contenu,msg.created_at,
          COALESCE(NULLIF(BTRIM(p.nom_affichage),''),NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),'Membre') AS auteur_nom
        FROM public.uce_department_chat_messages msg
        JOIN public.profils_utilisateurs p ON p.id=msg.auteur_id AND p.eglise_id=msg.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE msg.eglise_id=d.eglise_id AND msg.departement_id=d.id
        ORDER BY msg.created_at DESC LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT m.id) AS member_count
        FROM public.affectations a
        JOIN public.membres m ON m.id=a.membre_id AND m.eglise_id=a.eglise_id
        LEFT JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
        WHERE a.eglise_id=d.eglise_id AND a.departement_id=d.id AND a.statut='active'
          AND a.date_debut<=CURRENT_DATE AND (a.date_fin IS NULL OR a.date_fin>=CURRENT_DATE)
          AND m.statut='actif' AND (p.id IS NULL OR p.statut='actif')
      ) members ON true
      WHERE d.eglise_id=${identity.profile.eglise_id}::uuid AND d.statut='actif'
        AND (
          ${elevated}::boolean
          OR EXISTS (
            SELECT 1 FROM public.utilisateur_roles ur
            JOIN public.roles r ON r.id=ur.role_id AND r.eglise_id=ur.eglise_id
            WHERE ur.profil_utilisateur_id=${identity.authUser.id}::uuid AND ur.eglise_id=d.eglise_id
              AND ur.departement_id=d.id AND ur.statut='active' AND ur.date_debut<=CURRENT_DATE
              AND (ur.date_fin IS NULL OR ur.date_fin>=CURRENT_DATE) AND r.actif=true
          )
          OR EXISTS (
            SELECT 1 FROM public.affectations a
            JOIN public.membres m ON m.id=a.membre_id AND m.eglise_id=a.eglise_id
            LEFT JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
            WHERE m.profil_utilisateur_id=${identity.authUser.id}::uuid AND a.eglise_id=d.eglise_id
              AND a.departement_id=d.id AND a.statut='active' AND a.date_debut<=CURRENT_DATE
              AND (a.date_fin IS NULL OR a.date_fin>=CURRENT_DATE) AND m.statut='actif'
              AND (p.id IS NULL OR p.statut='actif')
          )
        )
      ORDER BY COALESCE(latest.created_at,d.created_at) DESC,d.nom
    `;
    response.json(departments);
  } catch (error) {
    next(error);
  }
});

app.get('/api/department-chats/:departmentId', async (request, response, next) => {
  try {
    if (!isUuid(request.params.departmentId) || !await canAccessDepartmentChat(request.identity, request.params.departmentId)) {
      response.status(404).json({ error: 'Ce salon départemental est introuvable ou vous n’y avez pas accès.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const departmentId = request.params.departmentId;
    const [departmentRows, messages, meetings] = await Promise.all([
      prisma.$queryRaw`SELECT id,code,nom,description FROM public.departements WHERE id=${departmentId}::uuid AND eglise_id=${egliseId}::uuid AND statut='actif' LIMIT 1`,
      prisma.$queryRaw`
        SELECT msg.id,msg.contenu,msg.created_at,msg.auteur_id AS author_id,
          COALESCE(NULLIF(BTRIM(p.nom_affichage),''),NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),'Membre') AS author_name
        FROM (
          SELECT id,eglise_id,departement_id,auteur_id,contenu,created_at
          FROM public.uce_department_chat_messages
          WHERE eglise_id=${egliseId}::uuid AND departement_id=${departmentId}::uuid
          ORDER BY created_at DESC LIMIT 100
        ) msg
        JOIN public.profils_utilisateurs p ON p.id=msg.auteur_id AND p.eglise_id=msg.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        ORDER BY msg.created_at ASC
      `,
      prisma.$queryRaw`
        SELECT mt.id,mt.titre,mt.description,mt.lieu_ou_lien AS location_or_link,
          mt.commence_a AS starts_at,mt.organisateur_id AS organizer_id,
          COALESCE(NULLIF(BTRIM(p.nom_affichage),''),NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),'Membre') AS organizer_name
        FROM public.uce_department_chat_meetings mt
        JOIN public.profils_utilisateurs p ON p.id=mt.organisateur_id AND p.eglise_id=mt.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE mt.eglise_id=${egliseId}::uuid AND mt.departement_id=${departmentId}::uuid
          AND mt.commence_a >= now()-interval '7 days'
        ORDER BY mt.commence_a ASC LIMIT 30
      `,
    ]);
    if (!departmentRows[0]) {
      response.status(404).json({ error: 'Ce département est introuvable.' });
      return;
    }
    response.json({ department: departmentRows[0], messages, meetings, current_user_id: request.identity.authUser.id });
  } catch (error) {
    next(error);
  }
});

app.post('/api/department-chats/:departmentId/messages', async (request, response, next) => {
  try {
    const { departmentId } = request.params;
    const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';
    if (!isUuid(departmentId) || !content || content.length > 4000) {
      response.status(400).json({ error: 'Le message est vide ou dépasse 4 000 caractères.' });
      return;
    }
    if (!await canAccessDepartmentChat(request.identity, departmentId)) {
      response.status(404).json({ error: 'Ce salon départemental est introuvable ou vous n’y avez pas accès.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.uce_department_chat_messages (eglise_id,departement_id,auteur_id,contenu)
      VALUES (${request.identity.profile.eglise_id}::uuid,${departmentId}::uuid,${request.identity.authUser.id}::uuid,${content})
      RETURNING id,contenu,created_at,auteur_id AS author_id
    `;
    const authorName = request.identity.profile.nom_affichage || request.identity.authUser.user_metadata?.full_name || 'Membre';
    response.status(201).json({ ...rows[0], author_name: authorName });
  } catch (error) {
    next(error);
  }
});

app.post('/api/department-chats/:departmentId/meetings', async (request, response, next) => {
  try {
    const { departmentId } = request.params;
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
    const locationOrLink = typeof request.body?.location_or_link === 'string' ? request.body.location_or_link.trim() : '';
    const startsAt = typeof request.body?.starts_at === 'string' ? new Date(request.body.starts_at) : null;
    if (!isUuid(departmentId) || !title || title.length > 160 || description.length > 2000
      || locationOrLink.length > 500 || !startsAt || !Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) {
      response.status(400).json({ error: 'Vérifiez le titre, les informations et choisissez une date future pour la réunion.' });
      return;
    }
    if (!await canAccessDepartmentChat(request.identity, departmentId)) {
      response.status(404).json({ error: 'Ce salon départemental est introuvable ou vous n’y avez pas accès.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.uce_department_chat_meetings
        (eglise_id,departement_id,organisateur_id,titre,description,lieu_ou_lien,commence_a)
      VALUES (
        ${request.identity.profile.eglise_id}::uuid,${departmentId}::uuid,${request.identity.authUser.id}::uuid,
        ${title},${description || null},${locationOrLink || null},${startsAt}
      )
      RETURNING id,titre AS title,description,lieu_ou_lien AS location_or_link,commence_a AS starts_at
    `;
    response.status(201).json({ ...rows[0], organizer_id: request.identity.authUser.id, organizer_name: request.identity.profile.nom_affichage || 'Membre' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/members', async (request, response, next) => {
  try {
    if (!canManageMembers(request.identity)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour consulter les membres.' });
      return;
    }
    const members = await prisma.$queryRaw`
      SELECT m.id AS member_id,m.numero_membre,m.nom,m.postnom,m.prenom,m.sexe,
        m.date_naissance,m.telephone,m.email,m.adresse,m.date_adhesion,m.statut,
        m.photo_url,m.profil_utilisateur_id AS profile_id,p.statut AS profile_status,
        p.nom_affichage,
        CASE WHEN m.statut='actif' AND (p.id IS NULL OR p.statut='actif') THEN true ELSE false END AS is_active
      FROM public.membres m
      LEFT JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
      WHERE m.eglise_id=${request.identity.profile.eglise_id}::uuid
      ORDER BY m.nom,m.prenom,m.postnom
      LIMIT 2000
    `;
    response.json(members);
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/members/available-users', async (request, response, next) => {
  try {
    if (!canManageMembers(request.identity)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour consulter les comptes de l’application.' });
      return;
    }
    const users = await prisma.$queryRaw`
      SELECT p.id AS profile_id,
        COALESCE(NULLIF(BTRIM(p.nom_affichage),''),'Utilisateur UCE') AS display_name,
        p.telephone,p.photo_url,p.preferences,p.statut AS profile_status,
        au.email,p.created_at
      FROM public.profils_utilisateurs p
      JOIN auth.users au ON au.id=p.id
      WHERE p.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND p.statut IN ('actif','en_attente')
        AND NOT EXISTS (
          SELECT 1 FROM public.membres m
          WHERE m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        )
      ORDER BY p.created_at DESC
      LIMIT 500
    `;
    response.json(users.map((profile) => ({
      ...profile,
      gender: profile.preferences?.gender || '',
    })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/members/import-user/:profileId', async (request, response, next) => {
  try {
    if (!canManageMembers(request.identity)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour ajouter ce compte à l’annuaire.' });
      return;
    }
    if (!isUuid(request.params.profileId)) {
      response.status(400).json({ error: 'Le compte sélectionné est invalide.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const member = await prisma.$transaction(async (tx) => {
      const profiles = await tx.$queryRaw`
        SELECT p.id,p.nom_affichage,p.telephone,p.photo_url,p.preferences,p.statut,au.email
        FROM public.profils_utilisateurs p
        JOIN auth.users au ON au.id=p.id
        WHERE p.id=${request.params.profileId}::uuid
          AND p.eglise_id=${egliseId}::uuid AND p.statut IN ('actif','en_attente')
        FOR UPDATE
      `;
      const profile = profiles[0];
      if (!profile) {
        const error = new Error('Ce compte actif de l’église est introuvable.');
        error.status = 404;
        throw error;
      }
      const linked = await tx.$queryRaw`
        SELECT id FROM public.membres
        WHERE profil_utilisateur_id=${profile.id}::uuid AND eglise_id=${egliseId}::uuid
        LIMIT 1
      `;
      if (linked[0]) {
        const error = new Error('Ce compte est déjà rattaché à un membre.');
        error.status = 409;
        throw error;
      }
      const emailMatches = profile.email ? await tx.$queryRaw`
        SELECT id FROM public.membres
        WHERE eglise_id=${egliseId}::uuid
          AND profil_utilisateur_id IS NULL
          AND lower(email)=lower(${profile.email})
        ORDER BY created_at
        LIMIT 2
        FOR UPDATE
      ` : [];
      if (emailMatches.length > 1) {
        const error = new Error('Plusieurs fiches membre utilisent cette adresse e-mail. Corrige les doublons avant de rattacher le compte.');
        error.status = 409;
        throw error;
      }
      const displayName = typeof profile.nom_affichage === 'string' && profile.nom_affichage.trim()
        ? profile.nom_affichage.trim()
        : 'Utilisateur UCE';
      const lastName = displayName.slice(0, 100);
      const postName = displayName.length > 100 ? displayName.slice(100, 200) : null;
      const gender = profile.preferences?.gender;
      const normalizedGender = gender === 'male' || gender === 'homme'
        ? 'homme'
        : gender === 'female' || gender === 'femme' ? 'femme' : null;
      const rows = emailMatches[0] ? await tx.$queryRaw`
        UPDATE public.membres
        SET profil_utilisateur_id=${profile.id}::uuid,
          telephone=COALESCE(telephone,${profile.telephone}),
          updated_at=now()
        WHERE id=${emailMatches[0].id}::uuid AND eglise_id=${egliseId}::uuid
        RETURNING id AS member_id,numero_membre,nom,postnom,prenom,sexe,date_naissance,
          telephone,email,adresse,date_adhesion,statut,photo_url,
          profil_utilisateur_id AS profile_id,true AS is_active
      ` : await tx.$queryRaw`
        INSERT INTO public.membres
          (eglise_id,profil_utilisateur_id,numero_membre,nom,postnom,sexe,telephone,email,photo_url,date_adhesion,statut)
        VALUES (
          ${egliseId}::uuid,${profile.id}::uuid,${`UCE-${randomUUID().slice(0, 8).toUpperCase()}`},
          ${lastName},${postName},${normalizedGender},${profile.telephone},${profile.email},${profile.photo_url},CURRENT_DATE,'actif'
        )
        RETURNING id AS member_id,numero_membre,nom,postnom,prenom,sexe,date_naissance,
          telephone,email,adresse,date_adhesion,statut,photo_url,
          profil_utilisateur_id AS profile_id,true AS is_active
      `;
      await writeAuditEvent(tx, {
        churchId: egliseId,
        actorId: request.identity.authUser.id,
        action: 'member_account_linked',
        entityType: 'member',
        entityId: rows[0].member_id,
        details: { profile_id: profile.id, matched_existing_record: Boolean(emailMatches[0]) },
      });
      await tx.$executeRaw`
        UPDATE public.profils_utilisateurs
        SET statut='actif',updated_at=now()
        WHERE id=${profile.id}::uuid AND eglise_id=${egliseId}::uuid
      `;
      return rows[0];
    });
    response.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/members', async (request, response, next) => {
  try {
    if (!canManageMembers(request.identity)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour ajouter un membre.' });
      return;
    }
    const body = request.body || {};
    const name = typeof body.nom === 'string' ? body.nom.trim() : '';
    const firstName = typeof body.prenom === 'string' ? body.prenom.trim() : '';
    const surname = typeof body.postnom === 'string' ? body.postnom.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.telephone === 'string' ? body.telephone.trim() : '';
    const address = typeof body.adresse === 'string' ? body.adresse.trim() : '';
    const sex = typeof body.sexe === 'string' ? body.sexe.trim() : '';
    if (!name || name.length > 100 || firstName.length > 100 || surname.length > 100
      || email.length > 150 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      || phone.length > 30 || address.length > 2000
      || (sex && !['homme', 'femme', 'male', 'female'].includes(sex.toLowerCase()))
      || (body.date_naissance && !Number.isFinite(Date.parse(body.date_naissance)))
      || (body.date_adhesion && !Number.isFinite(Date.parse(body.date_adhesion)))) {
      response.status(400).json({ error: 'Les informations du membre sont invalides.' });
      return;
    }
    const member = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        INSERT INTO public.membres
          (eglise_id,numero_membre,nom,postnom,prenom,sexe,date_naissance,telephone,email,adresse,date_adhesion,statut)
        VALUES (
          ${request.identity.profile.eglise_id}::uuid,
          ${`UCE-${randomUUID().slice(0, 8).toUpperCase()}`},
          ${name},${surname || null},${firstName || null},${sex || null},
          ${body.date_naissance ? new Date(body.date_naissance) : null}::date,
          ${phone || null},${email || null},${address || null},
          ${body.date_adhesion ? new Date(body.date_adhesion) : new Date()}::date,'actif'
        )
        RETURNING id AS member_id,numero_membre,nom,postnom,prenom,sexe,date_naissance,
          telephone,email,adresse,date_adhesion,statut,photo_url,
          profil_utilisateur_id AS profile_id,true AS is_active
      `;
      await writeAuditEvent(tx, {
        churchId: request.identity.profile.eglise_id,
        actorId: request.identity.authUser.id,
        action: 'member_created',
        entityType: 'member',
        entityId: rows[0].member_id,
      });
      return rows[0];
    });
    response.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/members/:id', async (request, response, next) => {
  try {
    if (!canManageMembers(request.identity)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour modifier un membre.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'Le membre sélectionné est invalide.' });
      return;
    }
    const body = request.body || {};
    const allowed = ['nom', 'postnom', 'prenom', 'sexe', 'date_naissance', 'telephone', 'email', 'adresse', 'date_adhesion', 'active'];
    if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
      response.status(400).json({ error: 'Les champs de modification du membre sont invalides.' });
      return;
    }
    const normalized = {
      nom: body.nom === undefined ? null : typeof body.nom === 'string' ? body.nom.trim() : '',
      postnom: body.postnom === undefined ? null : typeof body.postnom === 'string' ? body.postnom.trim() : '',
      prenom: body.prenom === undefined ? null : typeof body.prenom === 'string' ? body.prenom.trim() : '',
      sexe: body.sexe === undefined ? null : typeof body.sexe === 'string' ? body.sexe.trim() : '',
      telephone: body.telephone === undefined ? null : typeof body.telephone === 'string' ? body.telephone.trim() : '',
      email: body.email === undefined ? null : typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
      adresse: body.adresse === undefined ? null : typeof body.adresse === 'string' ? body.adresse.trim() : '',
    };
    if (normalized.nom !== null && (!normalized.nom || normalized.nom.length > 100)
      || normalized.postnom?.length > 100 || normalized.prenom?.length > 100
      || normalized.telephone?.length > 30 || normalized.adresse?.length > 2000
      || normalized.email?.length > 150
      || (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email))
      || (normalized.sexe && !['homme', 'femme', 'male', 'female'].includes(normalized.sexe.toLowerCase()))
      || (body.date_naissance !== undefined && body.date_naissance !== null && !Number.isFinite(Date.parse(body.date_naissance)))
      || (body.date_adhesion !== undefined && body.date_adhesion !== null && !Number.isFinite(Date.parse(body.date_adhesion)))
      || (body.active !== undefined && typeof body.active !== 'boolean')) {
      response.status(400).json({ error: 'Les informations du membre sont invalides.' });
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        UPDATE public.membres SET
          nom=COALESCE(${normalized.nom},nom),
          postnom=CASE WHEN ${body.postnom !== undefined} THEN ${normalized.postnom || null} ELSE postnom END,
          prenom=CASE WHEN ${body.prenom !== undefined} THEN ${normalized.prenom || null} ELSE prenom END,
          sexe=CASE WHEN ${body.sexe !== undefined} THEN ${normalized.sexe || null} ELSE sexe END,
          date_naissance=CASE WHEN ${body.date_naissance !== undefined} THEN ${body.date_naissance ? new Date(body.date_naissance) : null}::date ELSE date_naissance END,
          telephone=CASE WHEN ${body.telephone !== undefined} THEN ${normalized.telephone || null} ELSE telephone END,
          email=CASE WHEN ${body.email !== undefined} THEN ${normalized.email || null} ELSE email END,
          adresse=CASE WHEN ${body.adresse !== undefined} THEN ${normalized.adresse || null} ELSE adresse END,
          date_adhesion=CASE WHEN ${body.date_adhesion !== undefined} THEN ${body.date_adhesion ? new Date(body.date_adhesion) : null}::date ELSE date_adhesion END,
          statut=CASE WHEN ${body.active === false} THEN 'archive' WHEN ${body.active === true} THEN 'actif' ELSE statut END,
          updated_at=now()
        WHERE id=${request.params.id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
        RETURNING id AS member_id,numero_membre,nom,postnom,prenom,sexe,date_naissance,
          telephone,email,adresse,date_adhesion,statut,photo_url,
          profil_utilisateur_id AS profile_id
      `;
      const member = rows[0];
      if (member && body.active !== undefined && member.profile_id) {
        await tx.$executeRaw`
          UPDATE public.profils_utilisateurs SET statut=${body.active ? 'actif' : 'inactif'},updated_at=now()
          WHERE id=${member.profile_id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
        `;
      }
      if (member) {
        await writeAuditEvent(tx, {
          churchId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          action: body.active === undefined ? 'member_updated' : body.active ? 'member_reactivated' : 'member_archived',
          entityType: 'member',
          entityId: member.member_id,
          details: { fields: Object.keys(body) },
        });
      }
      return member;
    });
    if (!updated) {
      response.status(404).json({ error: 'Membre introuvable.' });
      return;
    }
    response.json({ ...updated, is_active: updated.statut === 'actif' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/audit', async (request, response, next) => {
  try {
    const canViewAdministration = request.identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role));
    const canViewFinance = isFinance(request.identity) || isPastor(request.identity);
    if (!canViewAdministration && !canViewFinance) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour consulter l’historique des actions.' });
      return;
    }
    const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 100, 1), 200);
    const [administrationEvents, financeEvents] = await Promise.all([
      canViewAdministration ? prisma.$queryRaw`
        SELECT a.id,a.actor_id,
          COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Administrateur') AS actor_name,
          a.action,a.entity_type,a.entity_id,a.details,a.created_at,'administration' AS source
        FROM public.uce_audit_events a
        LEFT JOIN public.profils_utilisateurs p ON p.id=a.actor_id AND p.eglise_id=a.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE a.eglise_id=${request.identity.profile.eglise_id}::uuid
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      ` : [],
      canViewFinance ? prisma.$queryRaw`
        SELECT a.id,a.actor_id,
          COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Utilisateur') AS actor_name,
          a.action,a.entity_type,a.entity_id,a.details,a.created_at,'finance' AS source
        FROM public.finance_audit_events a
        LEFT JOIN public.profils_utilisateurs p ON p.id=a.actor_id AND p.eglise_id=a.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE a.eglise_id=${request.identity.profile.eglise_id}::uuid
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      ` : [],
    ]);
    response.json([...administrationEvents, ...financeEvents]
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      .slice(0, limit));
  } catch (error) {
    next(error);
  }
});

app.post('/api/organization/departments', async (request, response, next) => {
  try {
    if (!canManageOrganizationStructure(request.identity)) {
      response.status(403).json({ error: 'La gestion de la structure est réservée à l’administration de l’église.' });
      return;
    }
    const { code, name, description = '' } = request.body || {};
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!/^[A-Z0-9_-]{2,30}$/.test(normalizedCode) || !normalizedName || normalizedName.length > 150
      || typeof description !== 'string' || description.length > 2000) {
      response.status(400).json({ error: 'Le code, le nom ou la description du département est invalide.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.departements (eglise_id,code,nom,description,statut)
      VALUES (${request.identity.profile.eglise_id}::uuid,${normalizedCode},${normalizedName},
        ${description.trim()},'actif')
      RETURNING id,code,nom,description,statut
    `;
    response.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/organization/departments/:id', async (request, response, next) => {
  try {
    if (!canManageOrganizationStructure(request.identity)) {
      response.status(403).json({ error: 'La gestion de la structure est réservée à l’administration de l’église.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'Le département sélectionné est invalide.' });
      return;
    }
    const { code, name, description, active } = request.body || {};
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : null;
    const normalizedName = typeof name === 'string' ? name.trim() : null;
    if (Object.keys(request.body || {}).some((key) => !['code', 'name', 'description', 'active'].includes(key))
      || !Object.keys(request.body || {}).length
      || (code !== undefined && !/^[A-Z0-9_-]{2,30}$/.test(normalizedCode || ''))
      || (name !== undefined && (!normalizedName || normalizedName.length > 150))
      || (description !== undefined && (typeof description !== 'string' || description.length > 2000))
      || (active !== undefined && typeof active !== 'boolean')) {
      response.status(400).json({ error: 'Les modifications du département sont invalides.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      UPDATE public.departements SET
        code=COALESCE(${normalizedCode},code),
        nom=COALESCE(${normalizedName},nom),
        description=CASE WHEN ${description !== undefined} THEN ${description === null ? null : description.trim()} ELSE description END,
        statut=CASE WHEN ${active === false} THEN 'inactif' WHEN ${active === true} THEN 'actif' ELSE statut END,
        updated_at=now()
      WHERE id=${request.params.id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
      RETURNING id,code,nom,description,statut
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Département introuvable.' });
      return;
    }
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/organization/commissions', async (request, response, next) => {
  try {
    if (!canManageOrganizationStructure(request.identity)) {
      response.status(403).json({ error: 'La gestion de la structure est réservée à l’administration de l’église.' });
      return;
    }
    const { department_id: departmentId, code, name, description = '' } = request.body || {};
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!isUuid(departmentId) || !/^[A-Z0-9_-]{2,30}$/.test(normalizedCode)
      || !normalizedName || normalizedName.length > 150 || typeof description !== 'string' || description.length > 2000) {
      response.status(400).json({ error: 'Le département, le code, le nom ou la description de la commission est invalide.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      INSERT INTO public.commissions (eglise_id,departement_id,code,nom,description,statut)
      SELECT eglise_id,id,${normalizedCode},${normalizedName},${description.trim()},'actif'
      FROM public.departements
      WHERE id=${departmentId}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid AND statut='actif'
      RETURNING id,departement_id,code,nom,description,statut
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Département actif introuvable.' });
      return;
    }
    response.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/organization/commissions/:id', async (request, response, next) => {
  try {
    if (!canManageOrganizationStructure(request.identity)) {
      response.status(403).json({ error: 'La gestion de la structure est réservée à l’administration de l’église.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La commission sélectionnée est invalide.' });
      return;
    }
    const { code, name, description, active } = request.body || {};
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : null;
    const normalizedName = typeof name === 'string' ? name.trim() : null;
    if (Object.keys(request.body || {}).some((key) => !['code', 'name', 'description', 'active'].includes(key))
      || !Object.keys(request.body || {}).length
      || (code !== undefined && !/^[A-Z0-9_-]{2,30}$/.test(normalizedCode || ''))
      || (name !== undefined && (!normalizedName || normalizedName.length > 150))
      || (description !== undefined && (typeof description !== 'string' || description.length > 2000))
      || (active !== undefined && typeof active !== 'boolean')) {
      response.status(400).json({ error: 'Les modifications de la commission sont invalides.' });
      return;
    }
    const rows = await prisma.$queryRaw`
      UPDATE public.commissions SET
        code=COALESCE(${normalizedCode},code),
        nom=COALESCE(${normalizedName},nom),
        description=CASE WHEN ${description !== undefined} THEN ${description === null ? null : description.trim()} ELSE description END,
        statut=CASE WHEN ${active === false} THEN 'inactif' WHEN ${active === true} THEN 'actif' ELSE statut END,
        updated_at=now()
      WHERE id=${request.params.id}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
      RETURNING id,departement_id,code,nom,description,statut
    `;
    if (!rows[0]) {
      response.status(404).json({ error: 'Commission introuvable.' });
      return;
    }
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/organization/structure', async (request, response, next) => {
  try {
    if (!canManageOrganizationStructure(request.identity)) {
      response.status(403).json({ error: 'La gestion de la structure est réservée à l’administration de l’église.' });
      return;
    }
    const [departments, commissions] = await Promise.all([
      prisma.$queryRaw`
        SELECT id,code,nom,description,statut
        FROM public.departements
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
        ORDER BY nom
      `,
      prisma.$queryRaw`
        SELECT id,departement_id,code,nom,description,statut
        FROM public.commissions
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
        ORDER BY nom
      `,
    ]);
    response.json(departments.map((department) => ({
      ...department,
      commissions: commissions.filter((commission) => commission.departement_id === department.id),
    })));
  } catch (error) {
    next(error);
  }
});

app.get('/api/organization', async (request, response, next) => {
  try {
    const identity = request.identity;
    const canViewAll = identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role)
      || ['GESTIONNAIRE_MEMBRES', 'SECRETAIRE_GENERAL'].includes(role));
    const departmentIds = new Set(identity.roleAssignments
      .filter((assignment) => assignment.niveau_portee === 'departement' && assignment.departement_id)
      .map((assignment) => assignment.departement_id));
    const commissionIds = new Set(identity.roleAssignments
      .filter((assignment) => assignment.niveau_portee === 'commission' && assignment.commission_id)
      .map((assignment) => assignment.commission_id));
    if (!canViewAll && departmentIds.size === 0 && commissionIds.size === 0) {
      response.status(403).json({ error: 'Aucun périmètre organisationnel n’est associé à votre compte.' });
      return;
    }

    const [departments, commissions] = await Promise.all([
      prisma.$queryRaw`
        SELECT d.id,d.code,d.nom,d.description,
          (SELECT COUNT(*)::int FROM public.affectations a
           WHERE a.eglise_id=d.eglise_id AND a.departement_id=d.id AND a.statut='active'
             AND a.date_debut<=CURRENT_DATE AND (a.date_fin IS NULL OR a.date_fin>=CURRENT_DATE)) AS nombre_membres
        FROM public.departements d
        WHERE d.eglise_id=${identity.profile.eglise_id}::uuid AND d.statut='actif'
        ORDER BY d.nom
      `,
      prisma.$queryRaw`
        SELECT c.id,c.departement_id,c.code,c.nom,c.description,
          (SELECT COUNT(*)::int FROM public.affectations a
           WHERE a.eglise_id=c.eglise_id AND a.commission_id=c.id AND a.statut='active'
             AND a.date_debut<=CURRENT_DATE AND (a.date_fin IS NULL OR a.date_fin>=CURRENT_DATE)) AS nombre_membres
        FROM public.commissions c
        WHERE c.eglise_id=${identity.profile.eglise_id}::uuid AND c.statut='actif'
        ORDER BY c.nom
      `,
    ]);

    const visibleDepartments = departments
      .filter((department) => canViewAll || departmentIds.has(department.id)
        || commissions.some((commission) => commission.departement_id === department.id && commissionIds.has(commission.id)))
      .map((department) => ({
        ...department,
        ...(!canViewAll && !departmentIds.has(department.id) ? { nombre_membres: null } : {}),
        commissions: commissions.filter((commission) => commission.departement_id === department.id
          && (canViewAll || departmentIds.has(department.id) || commissionIds.has(commission.id))),
      }));
    response.json(visibleDepartments);
  } catch (error) {
    next(error);
  }
});

app.get('/api/organization/admin', async (request, response, next) => {
  try {
    if (!request.identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role))) {
      response.status(403).json({ error: 'La gestion des rôles est réservée à l’administration de l’église.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const [roles, departments, commissions, members, assignments] = await Promise.all([
      prisma.$queryRaw`
        SELECT r.id,r.code,r.nom,r.niveau_portee,
          COALESCE(array_agg(DISTINCT p.module) FILTER (WHERE p.module IS NOT NULL),'{}') AS modules
        FROM public.roles r
        LEFT JOIN public.role_permissions rp ON rp.role_id=r.id AND rp.eglise_id=r.eglise_id
        LEFT JOIN public.permissions p ON p.id=rp.permission_id
        WHERE r.eglise_id=${egliseId}::uuid AND r.actif=true
        GROUP BY r.id ORDER BY r.nom
      `,
      prisma.$queryRaw`
        SELECT id,code,nom FROM public.departements
        WHERE eglise_id=${egliseId}::uuid AND statut='actif' ORDER BY nom
      `,
      prisma.$queryRaw`
        SELECT c.id,c.departement_id,c.code,c.nom
        FROM public.commissions c
        WHERE c.eglise_id=${egliseId}::uuid AND c.statut='actif' ORDER BY c.nom
      `,
      prisma.$queryRaw`
        SELECT p.id AS profile_id,
          COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Membre') AS nom,
          m.email
        FROM public.profils_utilisateurs p
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE p.eglise_id=${egliseId}::uuid AND p.statut='actif'
        ORDER BY nom
      `,
      prisma.$queryRaw`
        SELECT ur.id,ur.profil_utilisateur_id AS profile_id,r.code AS role_code,r.nom AS role_nom,
          r.niveau_portee,d.nom AS departement_nom,c.nom AS commission_nom,
          COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Membre') AS membre_nom,
          m.email
        FROM public.utilisateur_roles ur
        JOIN public.roles r ON r.id=ur.role_id AND r.eglise_id=ur.eglise_id
        JOIN public.profils_utilisateurs p ON p.id=ur.profil_utilisateur_id AND p.eglise_id=ur.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        LEFT JOIN public.departements d ON d.id=ur.departement_id AND d.eglise_id=ur.eglise_id
        LEFT JOIN public.commissions c ON c.id=ur.commission_id AND c.departement_id=ur.departement_id
        WHERE ur.eglise_id=${egliseId}::uuid AND ur.statut='active'
          AND ur.date_debut<=CURRENT_DATE AND (ur.date_fin IS NULL OR ur.date_fin>=CURRENT_DATE)
          AND r.actif=true
        ORDER BY membre_nom,r.nom,d.nom,c.nom
      `,
    ]);
    const assignableRoles = roles.map((role) => ({
      ...role,
      assignable: role.code !== 'SUPER_ADMIN' || request.identity.roles.includes('SUPER_ADMIN'),
    }));
    response.json({
      roles: assignableRoles,
      departments,
      commissions,
      members,
      assignments,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/organization/accounts', async (request, response, next) => {
  let createdAuthUserId = null;
  const adminClient = getSupabaseAdminClient();
  try {
    if (!request.identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role))) {
      response.status(403).json({ error: 'Seule l’administration de l’église peut créer un compte responsable.' });
      return;
    }
    if (!adminClient) {
      response.status(503).json({ error: 'La création de comptes nécessite la clé serveur Supabase (SUPABASE_SERVICE_ROLE_KEY).' });
      return;
    }

    const body = request.body || {};
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const roleId = body.role_id;
    const departmentId = body.department_id || null;
    const commissionId = body.commission_id || null;
    if (!fullName || fullName.length > 150 || email.length > 150
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || phone.length > 30 || password.length < 8 || password.length > 72
      || !isUuid(roleId) || (departmentId && !isUuid(departmentId)) || (commissionId && !isUuid(commissionId))) {
      response.status(400).json({ error: 'Vérifie le nom, l’adresse e-mail, le mot de passe (8 caractères minimum) et le rôle.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const roleRows = await prisma.$queryRaw`
      SELECT id,code,niveau_portee FROM public.roles
      WHERE id=${roleId}::uuid AND eglise_id=${egliseId}::uuid AND actif=true LIMIT 1
    `;
    const role = roleRows[0];
    if (!role) {
      response.status(400).json({ error: 'Le rôle sélectionné est introuvable ou inactif.' });
      return;
    }
    if (role.code === 'SUPER_ADMIN' && !request.identity.roles.includes('SUPER_ADMIN')) {
      response.status(403).json({ error: 'Seul un super administrateur peut attribuer ce rôle technique.' });
      return;
    }
    if ((role.niveau_portee === 'eglise' && (departmentId || commissionId))
      || (role.niveau_portee === 'departement' && (!departmentId || commissionId))
      || (role.niveau_portee === 'commission' && (!departmentId || !commissionId))
      || !['eglise', 'departement', 'commission'].includes(role.niveau_portee)) {
      response.status(400).json({ error: 'Le périmètre sélectionné ne correspond pas à la portée du rôle.' });
      return;
    }
    if (departmentId) {
      const rows = await prisma.$queryRaw`SELECT id FROM public.departements WHERE id=${departmentId}::uuid AND eglise_id=${egliseId}::uuid AND statut='actif' LIMIT 1`;
      if (!rows[0]) {
        response.status(400).json({ error: 'Le département sélectionné est introuvable ou inactif.' });
        return;
      }
    }
    if (commissionId) {
      const rows = await prisma.$queryRaw`SELECT id FROM public.commissions WHERE id=${commissionId}::uuid AND departement_id=${departmentId}::uuid AND eglise_id=${egliseId}::uuid AND statut='actif' LIMIT 1`;
      if (!rows[0]) {
        response.status(400).json({ error: 'La commission sélectionnée ne correspond pas au département.' });
        return;
      }
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      response.status(error?.status && error.status < 500 ? error.status : 400).json({ error: error?.message || 'Le compte Supabase n’a pas pu être créé.' });
      return;
    }
    createdAuthUserId = data.user.id;

    const nameParts = fullName.split(' ');
    const firstName = nameParts.length > 1 ? nameParts.shift() : null;
    const familyName = nameParts.join(' ') || fullName;
    const member = await prisma.$transaction(async (tx) => {
      const profiles = await tx.$queryRaw`
        INSERT INTO public.profils_utilisateurs (id,eglise_id,nom_affichage,telephone,statut)
        VALUES (${createdAuthUserId}::uuid,${egliseId}::uuid,${fullName},${phone || null},'actif')
        RETURNING id
      `;
      const members = await tx.$queryRaw`
        INSERT INTO public.membres
          (eglise_id,profil_utilisateur_id,numero_membre,nom,prenom,telephone,email,date_adhesion,statut)
        VALUES (
          ${egliseId}::uuid,${createdAuthUserId}::uuid,${`UCE-${randomUUID().slice(0, 8).toUpperCase()}`},
          ${familyName},${firstName},${phone || null},${email},CURRENT_DATE,'actif'
        )
        RETURNING id
      `;
      const assignment = await tx.utilisateur_roles.create({
        data: {
          eglise_id: egliseId,
          profil_utilisateur_id: profiles[0].id,
          role_id: roleId,
          departement_id: departmentId,
          commission_id: commissionId,
          attribue_par: request.identity.authUser.id,
          statut: 'active',
        },
      });
      return { memberId: members[0].id, assignmentId: assignment.id };
    });

    try {
      await writeAuditEvent(prisma, {
        churchId: egliseId,
        actorId: request.identity.authUser.id,
        action: 'staff_account_created',
        entityType: 'member',
        entityId: member.memberId,
        details: { email, role_code: role.code, assignment_id: member.assignmentId },
      });
    } catch (auditError) {
      console.error('Could not write staff account creation audit event:', auditError);
    }
    response.status(201).json({ success: true, profile_id: createdAuthUserId, role: role.code });
  } catch (error) {
    if (createdAuthUserId && adminClient) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(createdAuthUserId);
      if (deleteError) console.error('Could not roll back the newly created auth user:', deleteError);
    }
    next(error);
  }
});

app.patch('/api/organization/accounts/:profileId/password', async (request, response, next) => {
  try {
    if (!request.identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role))) {
      response.status(403).json({ error: 'Seule l’administration de l’église peut réinitialiser un mot de passe.' });
      return;
    }
    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      response.status(503).json({ error: 'La réinitialisation nécessite la clé serveur Supabase (SUPABASE_SERVICE_ROLE_KEY).' });
      return;
    }
    const { profileId } = request.params;
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!isUuid(profileId) || password.length < 8 || password.length > 72) {
      response.status(400).json({ error: 'Le compte ou le nouveau mot de passe est invalide (8 caractères minimum).' });
      return;
    }
    const profiles = await prisma.$queryRaw`
      SELECT p.id FROM public.profils_utilisateurs p
      WHERE p.id=${profileId}::uuid AND p.eglise_id=${request.identity.profile.eglise_id}::uuid AND p.statut='actif'
        AND EXISTS (
          SELECT 1 FROM public.utilisateur_roles ur
          JOIN public.roles r ON r.id=ur.role_id AND r.eglise_id=ur.eglise_id
          WHERE ur.profil_utilisateur_id=p.id AND ur.eglise_id=p.eglise_id
            AND ur.statut='active' AND ur.date_debut<=CURRENT_DATE
            AND (ur.date_fin IS NULL OR ur.date_fin>=CURRENT_DATE) AND r.actif=true
        )
      LIMIT 1
    `;
    if (!profiles[0]) {
      response.status(404).json({ error: 'Ce compte actif de l’église est introuvable.' });
      return;
    }
    const { error } = await adminClient.auth.admin.updateUserById(profileId, { password });
    if (error) {
      response.status(error.status && error.status < 500 ? error.status : 400).json({ error: error.message });
      return;
    }
    try {
      await writeAuditEvent(prisma, {
        churchId: request.identity.profile.eglise_id,
        actorId: request.identity.authUser.id,
        action: 'staff_password_reset',
        entityType: 'profile',
        entityId: profileId,
        details: {},
      });
    } catch (auditError) {
      console.error('Could not write staff password reset audit event:', auditError);
    }
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/organization/assignments', async (request, response, next) => {
  try {
    if (!request.identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role))) {
      response.status(403).json({ error: 'Seule l’administration de l’église peut attribuer des rôles.' });
      return;
    }
    const { profile_id: profileId, role_id: roleId, department_id: departmentId = null, commission_id: commissionId = null } = request.body || {};
    const isUuid = (value) => typeof value === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!isUuid(profileId) || !isUuid(roleId)
      || (departmentId !== null && !isUuid(departmentId))
      || (commissionId !== null && !isUuid(commissionId))) {
      response.status(400).json({ error: 'Le membre, le rôle ou le périmètre est invalide.' });
      return;
    }

    const egliseId = request.identity.profile.eglise_id;
    const [roleRows, profileRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT id,code,niveau_portee FROM public.roles
        WHERE id=${roleId}::uuid AND eglise_id=${egliseId}::uuid AND actif=true
        LIMIT 1
      `,
      prisma.$queryRaw`
        SELECT id FROM public.profils_utilisateurs
        WHERE id=${profileId}::uuid AND eglise_id=${egliseId}::uuid AND statut='actif'
        LIMIT 1
      `,
    ]);
    const role = roleRows[0];
    if (!role || !profileRows[0]) {
      response.status(400).json({ error: 'Le membre ou le rôle est introuvable ou inactif.' });
      return;
    }
    if (role.code === 'SUPER_ADMIN' && !request.identity.roles.includes('SUPER_ADMIN')) {
      response.status(403).json({ error: 'Seul un super administrateur peut attribuer ce rôle technique.' });
      return;
    }
    if ((role.niveau_portee === 'eglise' && (departmentId || commissionId))
      || (role.niveau_portee === 'departement' && (!departmentId || commissionId))
      || (role.niveau_portee === 'commission' && (!departmentId || !commissionId))
      || !['eglise', 'departement', 'commission'].includes(role.niveau_portee)) {
      response.status(400).json({ error: 'Le périmètre sélectionné ne correspond pas à la portée de ce rôle.' });
      return;
    }

    if (departmentId) {
      const departmentRows = await prisma.$queryRaw`
        SELECT id FROM public.departements
        WHERE id=${departmentId}::uuid AND eglise_id=${egliseId}::uuid AND statut='actif'
        LIMIT 1
      `;
      if (!departmentRows[0]) {
        response.status(400).json({ error: 'Le département est introuvable ou inactif.' });
        return;
      }
    }
    if (commissionId) {
      const commissionRows = await prisma.$queryRaw`
        SELECT id FROM public.commissions
        WHERE id=${commissionId}::uuid AND departement_id=${departmentId}::uuid
          AND eglise_id=${egliseId}::uuid AND statut='actif'
        LIMIT 1
      `;
      if (!commissionRows[0]) {
        response.status(400).json({ error: 'La commission ne correspond pas au département sélectionné.' });
        return;
      }
    }

    const duplicates = await prisma.$queryRaw`
      SELECT id FROM public.utilisateur_roles
      WHERE profil_utilisateur_id=${profileId}::uuid AND role_id=${roleId}::uuid AND eglise_id=${egliseId}::uuid
        AND departement_id IS NOT DISTINCT FROM ${departmentId}::uuid
        AND commission_id IS NOT DISTINCT FROM ${commissionId}::uuid
        AND statut='active' AND date_debut<=CURRENT_DATE
        AND (date_fin IS NULL OR date_fin>=CURRENT_DATE)
      LIMIT 1
    `;
    if (duplicates[0]) {
      response.status(409).json({ error: 'Ce rôle est déjà attribué à ce membre pour ce périmètre.' });
      return;
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.utilisateur_roles.create({
        data: {
          eglise_id: egliseId,
          profil_utilisateur_id: profileId,
          role_id: roleId,
          departement_id: departmentId,
          commission_id: commissionId,
          attribue_par: request.identity.authUser.id,
          statut: 'active',
        },
      });
      await writeAuditEvent(tx, {
        churchId: egliseId,
        actorId: request.identity.authUser.id,
        action: 'role_assigned',
        entityType: 'role_assignment',
        entityId: created.id,
        details: { profile_id: profileId, role_code: role.code },
      });
      return created;
    });
    response.status(201).json({ success: true, id: assignment.id });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/organization/assignments/:id', async (request, response, next) => {
  try {
    if (!request.identity.roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role))) {
      response.status(403).json({ error: 'Seule l’administration de l’église peut modifier les rôles.' });
      return;
    }
    if (request.body?.action !== 'revoke') {
      response.status(400).json({ error: 'L’action demandée est invalide.' });
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
      response.status(400).json({ error: 'Cette attribution est invalide.' });
      return;
    }
    const egliseId = request.identity.profile.eglise_id;
    const assignment = await prisma.$queryRaw`
      SELECT ur.id,r.code FROM public.utilisateur_roles ur
      JOIN public.roles r ON r.id=ur.role_id AND r.eglise_id=ur.eglise_id
      WHERE ur.id=${request.params.id}::uuid AND ur.eglise_id=${egliseId}::uuid AND ur.statut='active'
      LIMIT 1
    `;
    if (!assignment[0]) {
      response.status(404).json({ error: 'Cette attribution est introuvable ou déjà révoquée.' });
      return;
    }
    if (ADMIN_ROLES.has(assignment[0].code)) {
      const activeAdmins = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS nombre FROM public.utilisateur_roles ur
        JOIN public.roles r ON r.id=ur.role_id AND r.eglise_id=ur.eglise_id
        WHERE ur.eglise_id=${egliseId}::uuid AND r.actif=true
          AND r.code=ANY(${[...ADMIN_ROLES]}::text[]) AND ur.statut='active'
          AND ur.date_debut<=CURRENT_DATE AND (ur.date_fin IS NULL OR ur.date_fin>=CURRENT_DATE)
      `;
      if (activeAdmins[0].nombre <= 1) {
        response.status(409).json({ error: 'Impossible de révoquer le dernier rôle administrateur actif de l’église.' });
        return;
      }
    }
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.utilisateur_roles.updateMany({
        where: {
          id: request.params.id,
          eglise_id: egliseId,
          statut: 'active',
        },
        data: { statut: 'revoque', date_fin: new Date(), updated_at: new Date() },
      });
      if (updated.count) {
        await writeAuditEvent(tx, {
          churchId: egliseId,
          actorId: request.identity.authUser.id,
          action: 'role_revoked',
          entityType: 'role_assignment',
          entityId: request.params.id,
          details: { role_code: assignment[0].code },
        });
      }
      return updated;
    });
    if (result.count === 0) {
      response.status(404).json({ error: 'Cette attribution est introuvable ou déjà révoquée.' });
      return;
    }
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/events/:id/registration', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'L’événement sélectionné est invalide.' });
      return;
    }
    const result = await prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw`
        SELECT payload FROM public.uce_app_records
        WHERE id=${request.params.id}::uuid
          AND eglise_id=${request.identity.profile.eglise_id}::uuid
          AND entity_type='Event'
        FOR UPDATE
      `;
      const event = events[0]?.payload;
      if (!event) {
        const error = new Error('Cet événement est introuvable.');
        error.status = 404;
        throw error;
      }
      if (event.date && event.date < getChurchAccountingDate()) {
        const error = new Error('Les inscriptions à cet événement sont terminées.');
        error.status = 409;
        throw error;
      }

      const registrations = await tx.$queryRaw`
        SELECT id,status FROM public.uce_event_registrations
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND event_id=${request.params.id}::uuid
          AND profile_id=${request.identity.profile.id}::uuid
        FOR UPDATE
      `;
      if (registrations[0] && registrations[0].status !== 'cancelled') {
        return { registered: true };
      }

      const counts = await tx.$queryRaw`
        SELECT count(*)::int AS count
        FROM public.uce_event_registrations
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND event_id=${request.params.id}::uuid
          AND status IN ('registered','present','absent')
      `;
      const capacity = Number(event.capacity);
      if (Number.isInteger(capacity) && capacity > 0 && counts[0].count >= capacity) {
        const error = new Error('Cet événement a atteint sa capacité maximale.');
        error.status = 409;
        throw error;
      }

      await tx.$executeRaw`
        INSERT INTO public.uce_event_registrations
          (eglise_id,event_id,profile_id,status)
        VALUES (
          ${request.identity.profile.eglise_id}::uuid,
          ${request.params.id}::uuid,
          ${request.identity.profile.id}::uuid,
          'registered'
        )
        ON CONFLICT (eglise_id,event_id,profile_id)
        DO UPDATE SET status='registered',marked_by=NULL,updated_at=now()
        WHERE public.uce_event_registrations.status='cancelled'
      `;
      await writeAuditEvent(tx, {
        churchId: request.identity.profile.eglise_id,
        actorId: request.identity.authUser.id,
        action: 'event_registration_created',
        entityType: 'event',
        entityId: request.params.id,
      });
      let reminder = null;
      const reminderDate = pushConfigured ? getEventReminderDate(event) : null;
      if (reminderDate) {
        const eventTime = typeof event.time === 'string' && /^\d{2}:\d{2}$/.test(event.time)
          ? ` à ${event.time}`
          : '';
        const rows = await tx.$queryRaw`
          INSERT INTO public.uce_notifications
            (eglise_id,category,title,message,url,target_type,target_id,scheduled_at,created_by,source_event_id,source_profile_id)
          VALUES (
            ${request.identity.profile.eglise_id}::uuid,'event','Rappel d’événement',
            ${`${event.title}${eventTime}${event.location ? ` · ${event.location}` : ''}`.slice(0, 240)},
            '/events','church',NULL,${reminderDate},${request.identity.profile.id}::uuid,
            ${request.params.id}::uuid,${request.identity.profile.id}::uuid
          )
          RETURNING id,scheduled_at
        `;
        await tx.$executeRaw`
          INSERT INTO public.uce_notification_recipients (eglise_id,notification_id,profile_id)
          VALUES (
            ${request.identity.profile.eglise_id}::uuid,
            ${rows[0].id}::uuid,
            ${request.identity.profile.id}::uuid
          )
        `;
        reminder = rows[0];
      }
      return { registered: true, reminder };
    });
    if (result.reminder && new Date(result.reminder.scheduled_at) <= new Date()) {
      await dispatchPushNotification(result.reminder.id);
    }
    response.status(201).json({
      registered: result.registered,
      reminder_scheduled: Boolean(result.reminder),
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/events/:id/registration', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'L’événement sélectionné est invalide.' });
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        UPDATE public.uce_event_registrations r
        SET status='cancelled',updated_at=now()
        FROM public.uce_app_records e
        WHERE r.eglise_id=${request.identity.profile.eglise_id}::uuid
          AND r.event_id=${request.params.id}::uuid
          AND r.profile_id=${request.identity.profile.id}::uuid
          AND r.status='registered'
          AND e.id=r.event_id AND e.eglise_id=r.eglise_id AND e.entity_type='Event'
        RETURNING r.id
      `;
      if (rows[0]) {
        await writeAuditEvent(tx, {
          churchId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          action: 'event_registration_cancelled',
          entityType: 'event',
          entityId: request.params.id,
        });
        await tx.$executeRaw`
          DELETE FROM public.uce_notifications
          WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
            AND source_event_id=${request.params.id}::uuid
            AND source_profile_id=${request.identity.profile.id}::uuid
            AND dispatch_status='pending'
        `;
      }
      return rows;
    });
    if (!updated[0]) {
      response.status(409).json({ error: 'Aucune inscription active ne peut être annulée.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/events/:id/registrations', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'L’événement sélectionné est invalide.' });
      return;
    }
    const events = await prisma.$queryRaw`
      SELECT payload FROM public.uce_app_records
      WHERE id=${request.params.id}::uuid
        AND eglise_id=${request.identity.profile.eglise_id}::uuid
        AND entity_type='Event'
    `;
    const event = events[0]?.payload;
    if (!event) {
      response.status(404).json({ error: 'Cet événement est introuvable.' });
      return;
    }
    if (!isChurchWideStaff(request.identity) && !canManageEventScope(request.identity, event)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour gérer les présences de cet événement.' });
      return;
    }
    const registrations = await prisma.$queryRaw`
      SELECT r.profile_id,
        COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Membre UCE') AS full_name,
        r.status,r.updated_at
      FROM public.uce_event_registrations r
      JOIN public.profils_utilisateurs p ON p.id=r.profile_id AND p.eglise_id=r.eglise_id
      LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
      WHERE r.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND r.event_id=${request.params.id}::uuid
        AND r.status IN ('registered','present','absent')
      ORDER BY full_name
    `;
    response.json(registrations);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/events/:id/registrations/:profileId', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id) || !isUuid(request.params.profileId)
      || !['present', 'absent'].includes(request.body?.status)) {
      response.status(400).json({ error: 'Le statut de présence ou le membre sélectionné est invalide.' });
      return;
    }
    const events = await prisma.$queryRaw`
      SELECT payload FROM public.uce_app_records
      WHERE id=${request.params.id}::uuid
        AND eglise_id=${request.identity.profile.eglise_id}::uuid
        AND entity_type='Event'
    `;
    const event = events[0]?.payload;
    if (!event) {
      response.status(404).json({ error: 'Cet événement est introuvable.' });
      return;
    }
    if (!isChurchWideStaff(request.identity) && !canManageEventScope(request.identity, event)) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour gérer les présences de cet événement.' });
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        UPDATE public.uce_event_registrations
        SET status=${request.body.status},marked_by=${request.identity.profile.id}::uuid,updated_at=now()
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND event_id=${request.params.id}::uuid
          AND profile_id=${request.params.profileId}::uuid
          AND status IN ('registered','present','absent')
        RETURNING profile_id,status,updated_at
      `;
      if (rows[0]) {
        await writeAuditEvent(tx, {
          churchId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          action: 'event_attendance_updated',
          entityType: 'event',
          entityId: request.params.id,
          details: { profile_id: request.params.profileId, status: request.body.status },
        });
      }
      return rows;
    });
    if (!updated[0]) {
      response.status(404).json({ error: 'Inscription introuvable pour cet événement.' });
      return;
    }
    response.json(updated[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/gallery/interaction-counts', async (request, response, next) => {
  try {
    const counts = await prisma.$queryRaw`
      WITH photos AS (
        SELECT id
        FROM public.uce_app_records
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND entity_type='GalleryPhoto'
      ), likes AS (
        SELECT l.photo_id,count(*)::int AS like_count
        FROM public.uce_gallery_likes l
        JOIN photos p ON p.id=l.photo_id
        WHERE l.eglise_id=${request.identity.profile.eglise_id}::uuid
        GROUP BY l.photo_id
      ), comments AS (
        SELECT c.photo_id,count(*)::int AS comment_count
        FROM public.uce_gallery_comments c
        JOIN photos p ON p.id=c.photo_id
        WHERE c.eglise_id=${request.identity.profile.eglise_id}::uuid
        GROUP BY c.photo_id
      )
      SELECT p.id,
        COALESCE(l.like_count,0)::int AS like_count,
        COALESCE(c.comment_count,0)::int AS comment_count
      FROM photos p
      LEFT JOIN likes l ON l.photo_id=p.id
      LEFT JOIN comments c ON c.photo_id=p.id
    `;
    response.json(counts);
  } catch (error) {
    next(error);
  }
});

app.get('/api/gallery/:id/interactions', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La photo sélectionnée est invalide.' });
      return;
    }
    const photo = await prisma.uce_app_records.findFirst({
      where: {
        id: request.params.id,
        eglise_id: request.identity.profile.eglise_id,
        entity_type: 'GalleryPhoto',
      },
      select: { id: true },
    });
    if (!photo) {
      response.status(404).json({ error: 'Cette photo est introuvable.' });
      return;
    }
    const [likeRows, comments] = await Promise.all([
      prisma.$queryRaw`
        SELECT count(*)::int AS like_count,
          COALESCE(bool_or(profile_id=${request.identity.profile.id}::uuid),false) AS liked_by_me
        FROM public.uce_gallery_likes
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND photo_id=${photo.id}::uuid
      `,
      prisma.$queryRaw`
        SELECT c.id,c.profile_id,c.content,c.created_at,
          COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Membre UCE') AS author_name
        FROM public.uce_gallery_comments c
        JOIN public.profils_utilisateurs p ON p.id=c.profile_id AND p.eglise_id=c.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE c.eglise_id=${request.identity.profile.eglise_id}::uuid
          AND c.photo_id=${photo.id}::uuid
        ORDER BY c.created_at DESC
        LIMIT 100
      `,
    ]);
    response.json({
      like_count: likeRows[0]?.like_count || 0,
      liked_by_me: Boolean(likeRows[0]?.liked_by_me),
      comments,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/gallery/:id/like', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La photo sélectionnée est invalide.' });
      return;
    }
    const result = await prisma.$transaction(async (tx) => {
      const photo = await tx.$queryRaw`
        SELECT id FROM public.uce_app_records
        WHERE id=${request.params.id}::uuid
          AND eglise_id=${request.identity.profile.eglise_id}::uuid
          AND entity_type='GalleryPhoto'
        FOR UPDATE
      `;
      if (!photo[0]) {
        const error = new Error('Cette photo est introuvable.');
        error.status = 404;
        throw error;
      }
      const removed = await tx.$queryRaw`
        DELETE FROM public.uce_gallery_likes
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND photo_id=${photo[0].id}::uuid
          AND profile_id=${request.identity.profile.id}::uuid
        RETURNING profile_id
      `;
      const liked = !removed[0];
      if (liked) {
        await tx.$executeRaw`
          INSERT INTO public.uce_gallery_likes (eglise_id,photo_id,profile_id)
          VALUES (
            ${request.identity.profile.eglise_id}::uuid,
            ${photo[0].id}::uuid,
            ${request.identity.profile.id}::uuid
          )
          ON CONFLICT (eglise_id,photo_id,profile_id) DO NOTHING
        `;
      }
      const counts = await tx.$queryRaw`
        SELECT count(*)::int AS like_count
        FROM public.uce_gallery_likes
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND photo_id=${photo[0].id}::uuid
      `;
      return { liked, like_count: counts[0].like_count };
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/gallery/:id/comments', async (request, response, next) => {
  try {
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'La photo sélectionnée est invalide.' });
      return;
    }
    const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';
    if (!content || content.length > 2000) {
      response.status(400).json({ error: 'Le commentaire est obligatoire et limité à 2 000 caractères.' });
      return;
    }
    const comments = await prisma.$queryRaw`
      WITH photo AS (
        SELECT id,eglise_id FROM public.uce_app_records
        WHERE id=${request.params.id}::uuid
          AND eglise_id=${request.identity.profile.eglise_id}::uuid
          AND entity_type='GalleryPhoto'
      ), inserted AS (
        INSERT INTO public.uce_gallery_comments (eglise_id,photo_id,profile_id,content)
        SELECT photo.eglise_id,photo.id,${request.identity.profile.id}::uuid,${content}
        FROM photo
        RETURNING id,eglise_id,photo_id,profile_id,content,created_at
      )
      SELECT i.id,i.profile_id,i.content,i.created_at,
        COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Membre UCE') AS author_name
      FROM inserted i
      JOIN public.profils_utilisateurs p ON p.id=i.profile_id AND p.eglise_id=i.eglise_id
      LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
    `;
    if (!comments[0]) {
      response.status(404).json({ error: 'Cette photo est introuvable.' });
      return;
    }
    response.status(201).json(comments[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/gallery/:photoId/comments/:commentId', async (request, response, next) => {
  try {
    if (!isUuid(request.params.photoId) || !isUuid(request.params.commentId)) {
      response.status(400).json({ error: 'Le commentaire sélectionné est invalide.' });
      return;
    }
    const result = await prisma.$queryRaw`
      DELETE FROM public.uce_gallery_comments c
      USING public.uce_app_records photo
      WHERE c.id=${request.params.commentId}::uuid
        AND c.photo_id=${request.params.photoId}::uuid
        AND c.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND photo.id=c.photo_id AND photo.eglise_id=c.eglise_id
        AND photo.entity_type='GalleryPhoto'
        AND (c.profile_id=${request.identity.profile.id}::uuid OR ${canManagePhotoGallery(request.identity)})
      RETURNING c.id
    `;
    if (!result[0]) {
      response.status(404).json({ error: 'Commentaire introuvable ou non autorisé.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/entities/:entity', async (request, response, next) => {
  try {
    const { entity } = request.params;
    if (entity === 'Community') {
      const church = await prisma.eglises.findUnique({
        where: { id: request.identity.profile.eglise_id },
        include: { _count: { select: { membres: true } } },
      });
      if (!church) {
        response.status(404).json({ error: 'Église UCE introuvable.' });
        return;
      }
      const records = await prisma.uce_app_records.findMany({
        where: { eglise_id: church.id, entity_type: entity },
        orderBy: { created_at: 'desc' },
        take: 200,
      });
      response.json([
        {
          id: church.id,
          name: church.nom,
          description: church.description,
          city: church.ville,
          country: church.pays,
          contact_email: church.email,
          contact_phone: church.telephone,
          logo_url: church.logo_url,
          member_count: church._count.membres,
          is_international: false,
        },
        ...records.map((record) => ({ ...record.payload, id: record.id })),
      ]);
      return;
    }
    if (entity === 'User') {
      if (!request.identity.roles.some((role) => MEMBER_MANAGEMENT_ROLES.has(role))) {
        response.status(403).json({ error: 'Vous n’avez pas les droits pour consulter les membres.' });
        return;
      }
      const canViewAllMembers = request.identity.roles.some((role) => (
        ORGANIZATION_ADMIN_ROLES.has(role) || role === 'GESTIONNAIRE_MEMBRES'
      ));
      const departmentIds = request.identity.roleAssignments
        .filter((assignment) => assignment.niveau_portee === 'departement' && assignment.departement_id)
        .map((assignment) => assignment.departement_id);
      const commissionIds = request.identity.roleAssignments
        .filter((assignment) => assignment.niveau_portee === 'commission' && assignment.commission_id)
        .map((assignment) => assignment.commission_id);
      const members = await prisma.$queryRaw`
        SELECT COALESCE(m.profil_utilisateur_id,m.id) AS id,
          CONCAT_WS(' ',m.prenom,m.nom,m.postnom) AS full_name,m.email,m.telephone AS phone,
          m.photo_url,p.preferences->>'role' AS role
        FROM public.membres m
        LEFT JOIN public.profils_utilisateurs p ON p.id=m.profil_utilisateur_id AND p.eglise_id=m.eglise_id
        WHERE m.eglise_id=${request.identity.profile.eglise_id}::uuid
          AND (${canViewAllMembers} OR EXISTS (
            SELECT 1 FROM public.affectations af
            WHERE af.membre_id=m.id AND af.eglise_id=m.eglise_id AND af.statut='active'
              AND af.date_debut<=CURRENT_DATE AND (af.date_fin IS NULL OR af.date_fin>=CURRENT_DATE)
              AND (af.departement_id=ANY(${departmentIds}::uuid[])
                OR af.commission_id=ANY(${commissionIds}::uuid[]))
          ))
        ORDER BY m.nom,m.prenom
        LIMIT 200
      `;
      response.json(members.map((member) => ({ ...member, role: member.role || 'member' })));
      return;
    }
    if (!ENTITY_FIELDS[entity]) {
      response.status(404).json({ error: 'Ce type de contenu n’est pas pris en charge.' });
      return;
    }
    const maxLimit = entity === 'Event' ? 500 : 200;
    const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 100, 1), maxLimit);
    const filter = request.query.filter ? JSON.parse(request.query.filter) : {};
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      response.status(400).json({ error: 'Le filtre demandé est invalide.' });
      return;
    }

    const records = await prisma.uce_app_records.findMany({
      where: {
        eglise_id: request.identity.profile.eglise_id,
        entity_type: entity,
        ...(entity === 'Donation' && !isFinance(request.identity) ? {
          OR: [
            { created_by: request.identity.authUser.id },
            { payload: { path: ['donor_profile_id'], equals: request.identity.authUser.id } },
            ...(request.identity.member?.id
              ? [{ payload: { path: ['donor_member_id'], equals: request.identity.member.id } }]
              : []),
          ],
        } : {}),
        ...(entity === 'JournalEntry' ? { created_by: request.identity.authUser.id } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    });
    const sortParameter = String(request.query.sort || '-created_date');
    const descending = sortParameter.startsWith('-');
    const sortField = descending ? sortParameter.slice(1) : sortParameter;
    const filteredRecords = records
      .filter((record) => entity !== 'PrayerRequest' || record.payload?.is_private !== true
        || record.created_by === request.identity.authUser.id || isChurchWideStaff(request.identity))
      .filter((record) => Object.entries(filter).every(([key, value]) => record.payload?.[key] === value))
      .sort((a, b) => {
        const left = sortField === 'created_date' || sortField === 'created_at' ? a.created_at : a.payload?.[sortField];
        const right = sortField === 'created_date' || sortField === 'created_at' ? b.created_at : b.payload?.[sortField];
        const comparison = String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
        return descending ? -comparison : comparison;
      })
      .slice(0, limit);
    const registrationRows = entity === 'Event' && filteredRecords.length ? await prisma.$queryRaw`
      SELECT r.event_id,
        count(*) FILTER (WHERE status IN ('registered','present','absent'))::int AS attendee_count,
        bool_or(r.profile_id=${request.identity.profile.id}::uuid
          AND status IN ('registered','present','absent')) AS is_registered,
        EXISTS (
          SELECT 1 FROM public.uce_notifications n
          WHERE n.source_event_id=r.event_id
            AND n.source_profile_id=${request.identity.profile.id}::uuid
            AND n.eglise_id=r.eglise_id
            AND n.dispatch_status='pending'
        ) AS reminder_scheduled
      FROM public.uce_event_registrations r
      WHERE r.eglise_id=${request.identity.profile.eglise_id}::uuid
        AND r.event_id=ANY(${filteredRecords.map((record) => record.id)}::uuid[])
      GROUP BY r.event_id,r.eglise_id
    ` : [];
    const registrationsByEvent = new Map(registrationRows.map((row) => [row.event_id, row]));
    const categoryIds = entity === 'GalleryPhoto'
      ? [...new Set(filteredRecords.map((record) => record.payload?.category_id).filter(isUuid))]
      : [];
    const galleryCategories = categoryIds.length ? await prisma.uce_app_records.findMany({
      where: {
        eglise_id: request.identity.profile.eglise_id,
        entity_type: 'GalleryCategory',
        id: { in: categoryIds },
      },
      select: { id: true, payload: true },
    }) : [];
    const galleryCategoriesById = new Map(galleryCategories.map((record) => [record.id, record.payload]));
    const filtered = filteredRecords.map((record) => {
      const { attendees: legacyAttendees, ...payload } = record.payload;
      const registration = registrationsByEvent.get(record.id);
      const galleryCategory = galleryCategoriesById.get(payload.category_id);
      return {
        ...payload,
        ...(entity === 'GalleryPhoto' ? {
          category_name: galleryCategory?.name || 'Catégorie supprimée',
          category_color: galleryCategory?.color || '#64748b',
        } : {}),
        ...(entity === 'Event' ? {
          attendee_count: (registration?.attendee_count || 0) + (legacyAttendees?.length || 0),
          is_registered: registration
            ? Boolean(registration.is_registered)
            : Array.isArray(legacyAttendees) && legacyAttendees.includes(request.identity.authUser.email),
          reminder_scheduled: Boolean(registration?.reminder_scheduled),
        } : {}),
        id: record.id,
        created_by: record.created_by,
        created_date: record.created_at,
        updated_date: record.updated_at,
      };
    });
    response.json(filtered);
  } catch (error) {
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'Le filtre demandé est invalide.' });
      return;
    }
    next(error);
  }
});

app.post('/api/entities/:entity', async (request, response, next) => {
  try {
    const { entity } = request.params;
    if (entity === 'PrayerRequest' || entity === 'JournalEntry' || entity === 'Donation') {
      const payload = sanitizePayload(entity, request.body);
      if (entity === 'Team') {
        payload.name = typeof payload.name === 'string' ? payload.name.trim() : '';
        payload.type = payload.type || 'other';
        payload.description = typeof payload.description === 'string' ? payload.description.trim() : '';
        payload.leader_email = typeof payload.leader_email === 'string' ? payload.leader_email.trim() : '';
        payload.members = Array.isArray(payload.members) ? payload.members : [];
        if (!payload.name || payload.name.length > 160 || payload.description.length > 2000
          || !['worship', 'preaching', 'children', 'missions', 'prayer', 'media', 'hospitality', 'youth', 'other'].includes(payload.type)
          || payload.leader_email.length > 254
          || (payload.leader_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.leader_email))
          || (payload.image_url && !isSafeWebUrl(payload.image_url, { allowRelative: true }))) {
          response.status(400).json({ error: 'Les informations de l’équipe sont invalides.' });
          return;
        }
      }
      if (entity === 'Donation') {
        if (isFinance(request.identity) && !isTreasurer(request.identity)) {
          response.status(403).json({ error: 'Seul le trésorier peut enregistrer un encaissement à la caisse.' });
          return;
        }
        const amount = Number(payload.amount);
        if (!Number.isSafeInteger(amount) || amount <= 0
          || !['tithe', 'offering', 'campaign', 'special', 'solidarity'].includes(payload.type)
          || !['cash', 'mtn_momo', 'airtel_money', 'visa', 'mobile_money', 'card'].includes(payload.payment_method)) {
          response.status(400).json({ error: 'Le montant, le type ou le mode de contribution est invalide.' });
          return;
        }
        payload.amount = amount;
        payload.currency = request.identity.profile.devise || 'XAF';
        if (payload.type === 'campaign') {
          if (!isUuid(payload.campaign_id)) {
            response.status(400).json({ error: 'Sélectionnez une cagnotte pour ce don.' });
            return;
          }
        } else {
          delete payload.campaign_id;
        }
        if (isFinance(request.identity)) {
          const paymentReference = typeof payload.payment_reference === 'string' ? payload.payment_reference.trim() : '';
          if (paymentReference.length > 120 || (payload.payment_method !== 'cash' && !paymentReference)) {
            response.status(400).json({ error: 'La référence du paiement électronique est obligatoire et limitée à 120 caractères.' });
            return;
          }
          payload.payment_reference = paymentReference || null;
          const anonymous = payload.donor_anonymous === true;
          const donorName = typeof payload.donor_name === 'string' ? payload.donor_name.trim() : '';
          const donorEmail = typeof payload.donor_email === 'string' ? payload.donor_email.trim() : '';
          const memberId = typeof payload.donor_member_id === 'string' ? payload.donor_member_id : '';
          if (anonymous && (memberId || donorName || donorEmail)) {
            response.status(400).json({ error: 'Un don anonyme ne peut pas contenir d’identité de donateur.' });
            return;
          }
          if (memberId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
            response.status(400).json({ error: 'Le membre sélectionné est invalide.' });
            return;
          }
          if ((!anonymous && !memberId && !donorName) || donorName.length > 120 || donorEmail.length > 254
            || (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail))) {
            response.status(400).json({ error: 'Les informations du donateur sont invalides.' });
            return;
          }
          if (anonymous) {
            payload.donor_name = null;
            payload.donor_email = null;
            payload.donor_member_id = null;
            payload.donor_profile_id = null;
          } else if (memberId) {
            const memberRows = await prisma.$queryRaw`
              SELECT m.id,m.profil_utilisateur_id,
                CONCAT_WS(' ',m.prenom,m.nom,m.postnom) AS full_name,m.email
              FROM public.membres m
              WHERE m.id=${memberId}::uuid
                AND m.eglise_id=${request.identity.profile.eglise_id}::uuid
              LIMIT 1
            `;
            const member = memberRows[0];
            if (!member) {
              response.status(400).json({ error: 'Le membre sélectionné n’appartient pas à cette église.' });
              return;
            }
            payload.donor_name = member.full_name;
            payload.donor_email = member.email || null;
            payload.donor_member_id = member.id;
            payload.donor_profile_id = member.profil_utilisateur_id;
          } else {
            payload.donor_name = donorName;
            payload.donor_email = donorEmail || null;
            payload.donor_member_id = null;
            payload.donor_profile_id = null;
          }
          payload.donor_anonymous = anonymous;
          payload.status = 'received';
          payload.confirmed_by = request.identity.authUser.id;
          payload.confirmed_at = new Date().toISOString();
        } else {
          if (!['mtn_momo', 'airtel_money', 'visa', 'mobile_money', 'card'].includes(payload.payment_method)) {
            response.status(403).json({ error: 'Les membres peuvent uniquement déclarer un paiement électronique.' });
            return;
          }
          delete payload.payment_reference;
          payload.status = 'pending';
          payload.donor_name = [request.identity.member?.prenom, request.identity.member?.nom, request.identity.member?.postnom]
            .filter(Boolean).join(' ') || request.identity.profile.nom_affichage || null;
          payload.donor_email = request.identity.authUser.email;
          payload.donor_member_id = null;
          payload.donor_profile_id = request.identity.authUser.id;
          payload.donor_anonymous = false;
        }
      }
      if (entity === 'PrayerRequest') {
        if (payload.is_private !== undefined && typeof payload.is_private !== 'boolean') {
          response.status(400).json({ error: 'Choisissez si la demande doit rester privée.' });
          return;
        }
        payload.is_private = payload.is_private === true;
        const memberName = [
          request.identity.member?.prenom,
          request.identity.member?.nom,
          request.identity.member?.postnom,
        ].filter(Boolean).join(' ').trim();
        const profileName = typeof request.identity.profile.nom_affichage === 'string'
          ? request.identity.profile.nom_affichage.trim()
          : '';
        const authName = typeof request.identity.authUser.user_metadata?.full_name === 'string'
          ? request.identity.authUser.user_metadata.full_name.trim()
          : '';
        payload.author_name = payload.is_anonymous
          ? null
          : memberName || profileName || authName || request.identity.authUser.email || 'Utilisateur UCE';
        payload.status = 'active';
        payload.prayed_by = [];
        payload.prayer_count = 0;
      }
      const createRecord = async (tx) => {
        if (entity === 'Donation' && payload.type === 'campaign') {
          const campaignsForDonation = await tx.$queryRaw`
            SELECT id FROM public.uce_app_records
            WHERE id=${payload.campaign_id}::uuid
              AND eglise_id=${request.identity.profile.eglise_id}::uuid
              AND entity_type='Campaign'
              AND payload->>'is_active'='true'
            FOR UPDATE
          `;
          if (!campaignsForDonation[0]) {
            const error = new Error('Cette cagnotte n’est plus disponible.');
            error.status = 409;
            throw error;
          }
        }
        if (entity === 'Donation' && isFinance(request.identity) && payload.payment_method === 'cash') {
          const sessions = await tx.$queryRaw`
            SELECT id FROM public.finance_cash_sessions
            WHERE eglise_id=${request.identity.profile.eglise_id}::uuid AND status='open'
            FOR UPDATE
          `;
          if (!sessions[0]) {
            const error = new Error('Ouvrez une session de caisse avant d’enregistrer un encaissement en espèces.');
            error.status = 409;
            throw error;
          }
          payload.cash_session_id = sessions[0].id;
        }
        let record = await tx.uce_app_records.create({
          data: {
            eglise_id: request.identity.profile.eglise_id,
            entity_type: entity,
            created_by: request.identity.authUser.id,
            payload,
          },
        });
        if (entity === 'Donation' && isFinance(request.identity) && payload.status === 'received') {
          const { debitCode, creditCode } = getDonationAccountCodes(payload.type, payload.payment_method);
          const journal = await postFinanceJournal(tx, {
            egliseId: request.identity.profile.eglise_id,
            actorId: request.identity.authUser.id,
            sourceType: 'receipt',
            sourceId: record.id,
            description: `${payload.type === 'tithe' ? 'Dîme' : 'Don'} · ${payload.donor_anonymous ? 'Anonyme' : payload.donor_name}`,
            amount: payload.amount,
            debitCode,
            creditCode,
            memberId: payload.donor_member_id,
          });
          await addToCampaignRaisedAmount(
            tx,
            request.identity.profile.eglise_id,
            payload.campaign_id,
            payload.amount,
          );
          record = await tx.uce_app_records.update({
            where: { id: record.id },
            data: {
              payload: { ...record.payload, receipt_number: journal.entryNumber, journal_id: journal.id },
            },
          });
        }
        return record;
      };
      const record = entity === 'Donation' && isFinance(request.identity)
        ? await prisma.$transaction(createRecord)
        : await createRecord(prisma);
      response.status(201).json({ ...record.payload, id: record.id, created_date: record.created_at });
      return;
    }

    const requiredRoles = {
      Campaign: CAMPAIGN_MANAGEMENT_ROLES,
      Community: ADMIN_ROLES,
      DailyVerse: STAFF_ROLES,
      DailyThought: STAFF_ROLES,
      Event: EVENT_MANAGEMENT_ROLES,
      GalleryCategory: STAFF_ROLES,
      GalleryPhoto: STAFF_ROLES,
      Group: ADMIN_ROLES,
      Sermon: STAFF_ROLES,
      Team: ADMIN_ROLES,
    }[entity];
    const hasRequiredRole = requiredRoles
      && request.identity.roles.some((role) => requiredRoles.has(role));
    const canCreate = entity === 'Event'
      ? hasRequiredRole && canManageEventScope(request.identity, request.body)
      : ['GalleryCategory', 'GalleryPhoto'].includes(entity)
        ? canManagePhotoGallery(request.identity)
      : ['DailyVerse', 'DailyThought', 'Sermon'].includes(entity)
        ? hasRequiredRole && isChurchWideStaff(request.identity)
        : hasRequiredRole;
    if (!canCreate) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour créer ce contenu.' });
      return;
    }
    const payload = sanitizePayload(entity, request.body);
    if (entity === 'DailyThought') Object.assign(payload, validateDailyThought(payload));
    if (entity === 'GalleryPhoto') validateGalleryPhotoPayload(payload);
    if (entity === 'GalleryCategory') validateGalleryCategoryPayload(payload);
    if (entity === 'GalleryPhoto') {
      const categories = await prisma.uce_app_records.findFirst({
        where: {
          id: payload.category_id,
          eglise_id: request.identity.profile.eglise_id,
          entity_type: 'GalleryCategory',
        },
        select: { id: true },
      });
      if (!categories) {
        response.status(400).json({ error: 'Sélectionnez une catégorie active de la photothèque.' });
        return;
      }
    }
    if (entity === 'GalleryCategory') {
      const duplicates = await prisma.$queryRaw`
        SELECT id FROM public.uce_app_records
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND entity_type='GalleryCategory'
          AND lower(payload->>'name')=lower(${payload.name})
        LIMIT 1
      `;
      if (duplicates[0]) {
        response.status(409).json({ error: 'Cette catégorie existe déjà.' });
        return;
      }
    }
    if (entity === 'Campaign') {
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      const description = typeof payload.description === 'string' ? payload.description.trim() : '';
      const goalAmount = Number(payload.goal_amount);
      const imageUrl = typeof payload.image_url === 'string' ? payload.image_url.trim() : '';
      const endDate = payload.end_date;
      const parsedEndDate = typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        ? new Date(`${endDate}T00:00:00.000Z`)
        : null;
      const validEndDate = endDate == null || (
        parsedEndDate
        && Number.isFinite(parsedEndDate.getTime())
        && parsedEndDate.toISOString().slice(0, 10) === endDate
      );
      if (!title || title.length > 160 || description.length > 2000
        || !Number.isSafeInteger(goalAmount) || goalAmount <= 0
        || (imageUrl && !isSafeWebUrl(imageUrl))
        || !validEndDate) {
        response.status(400).json({ error: 'Indiquez un titre, un objectif valide et des informations de cagnotte correctes.' });
        return;
      }
      payload.title = title;
      payload.description = description;
      payload.goal_amount = goalAmount;
      payload.raised_amount = 0;
      payload.currency = request.identity.profile.devise || 'XAF';
      payload.image_url = imageUrl || null;
      payload.is_active = true;
      payload.end_date = endDate || null;
    }
    validateMediaPayload(entity, payload);
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.uce_app_records.create({
        data: {
          eglise_id: request.identity.profile.eglise_id,
          entity_type: entity,
          created_by: request.identity.authUser.id,
          payload,
        },
      });
      if (entity === 'Event') {
        await writeAuditEvent(tx, {
          churchId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          action: 'event_created',
          entityType: 'event',
          entityId: created.id,
        });
      }
      return created;
    });
    response.status(201).json({ ...record.payload, id: record.id, created_date: record.created_at });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/entities/:entity/:id', async (request, response, next) => {
  try {
    const { entity, id } = request.params;
    const current = await prisma.uce_app_records.findFirst({
      where: { id, eglise_id: request.identity.profile.eglise_id, entity_type: entity },
    });
    if (!current) {
      response.status(404).json({ error: 'Contenu introuvable.' });
      return;
    }

    const body = request.body;
    if (entity === 'Donation') {
      if (!isFinancialController(request.identity)) {
        response.status(403).json({ error: 'Seul le contrôleur financier peut confirmer indépendamment un paiement déclaré.' });
        return;
      }
      if (body?.action !== 'confirm' || current.payload.status !== 'pending') {
        response.status(409).json({ error: 'Cette déclaration ne peut pas être confirmée.' });
        return;
      }
      if (current.payload.payment_provider === 'cinetpay') {
        response.status(409).json({ error: 'Ce paiement doit être confirmé par la vérification CinetPay, pas manuellement.' });
        return;
      }
      const paymentReference = typeof body.payment_reference === 'string' ? body.payment_reference.trim() : '';
      if (paymentReference.length > 120 || (current.payload.payment_method !== 'cash' && !paymentReference)) {
        response.status(400).json({ error: 'La référence du paiement électronique est obligatoire et limitée à 120 caractères.' });
        return;
      }
      const updated = await prisma.$transaction(async (tx) => {
        const updatedRows = await tx.$queryRaw`
          UPDATE public.uce_app_records
          SET payload=payload || ${JSON.stringify({
            status: 'received',
            payment_reference: paymentReference || current.payload.payment_reference || null,
            confirmed_by: request.identity.authUser.id,
            confirmed_at: new Date().toISOString(),
          })}::jsonb, updated_at=now()
          WHERE id=${current.id}::uuid
            AND eglise_id=${request.identity.profile.eglise_id}::uuid
            AND entity_type='Donation'
            AND payload->>'status'='pending'
          RETURNING id,payload,created_at,updated_at
        `;
        if (!updatedRows[0]) {
          const error = new Error('Cette déclaration a déjà été traitée par la trésorerie.');
          error.status = 409;
          throw error;
        }
        const donation = updatedRows[0].payload;
        const { debitCode, creditCode } = getDonationAccountCodes(donation.type, donation.payment_method);
        const journal = await postFinanceJournal(tx, {
          egliseId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          sourceType: 'receipt',
          sourceId: current.id,
          description: `${donation.type === 'tithe' ? 'Dîme' : 'Don'} · ${donation.donor_anonymous ? 'Anonyme' : donation.donor_name}`,
          amount: Number(donation.amount),
          debitCode,
          creditCode,
          memberId: donation.donor_member_id,
        });
        const finalRecord = await tx.uce_app_records.update({
          where: { id: current.id },
          data: {
            payload: { ...donation, receipt_number: journal.entryNumber, journal_id: journal.id },
            updated_at: new Date(),
          },
        });
        await addToCampaignRaisedAmount(
          tx,
          request.identity.profile.eglise_id,
          donation.campaign_id,
          Number(donation.amount),
        );
        return finalRecord;
      });
      response.json({ ...updated.payload, id: updated.id, created_date: updated.created_at });
      return;
    }

    if (['Group', 'Team'].includes(entity)) {
      const membershipKey = 'members';
      if (Object.keys(body || {}).length === 1 && Array.isArray(body[membershipKey])) {
        const existingMembers = Array.isArray(current.payload[membershipKey]) ? current.payload[membershipKey] : [];
        let members;
        if (entity === 'Team') {
          members = [...existingMembers];
          if (!members.some((member) => member?.email === request.identity.authUser.email)) {
            const name = [request.identity.member?.prenom, request.identity.member?.nom, request.identity.member?.postnom]
              .filter(Boolean).join(' ') || request.identity.profile.nom_affichage || request.identity.authUser.email;
            members.push({ email: request.identity.authUser.email, name, role: 'Membre' });
          }
        } else {
          members = [...new Set([...existingMembers, request.identity.authUser.email])];
        }
        const updated = await prisma.uce_app_records.update({
          where: { id: current.id },
          data: { payload: { ...current.payload, [membershipKey]: members }, updated_at: new Date() },
        });
        response.json({ ...updated.payload, id: updated.id, created_date: updated.created_at });
        return;
      }
    }

    const canEditOwn = ['PrayerRequest', 'JournalEntry'].includes(entity) && current.created_by === request.identity.authUser.id;
    const canEditStaff = ['PrayerRequest', 'Event', 'Sermon', 'Community', 'DailyVerse', 'DailyThought'].includes(entity)
      && (isChurchWideStaff(request.identity)
        || entity === 'Event' && canManageEventScope(request.identity, current.payload))
      || ['GalleryCategory', 'GalleryPhoto'].includes(entity) && canManagePhotoGallery(request.identity)
      || entity === 'Campaign' && request.identity.roles.some((role) => CAMPAIGN_MANAGEMENT_ROLES.has(role));
    const canEditOrganization = ['Group', 'Team'].includes(entity)
      && request.identity.roles.some((role) => ADMIN_ROLES.has(role));
    const prayerParticipation = entity === 'PrayerRequest'
      && Object.keys(body || {}).every((key) => ['prayed_by', 'prayer_count'].includes(key))
      && Object.keys(body || {}).length > 0;
    if (!canEditOwn && !canEditStaff && !canEditOrganization && !prayerParticipation) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour modifier ce contenu.' });
      return;
    }

    const payload = prayerParticipation
      ? {
          prayed_by: [...new Set([...(Array.isArray(current.payload.prayed_by) ? current.payload.prayed_by : []), request.identity.authUser.id])],
          prayer_count: (Array.isArray(current.payload.prayed_by) ? current.payload.prayed_by : []).includes(request.identity.authUser.id)
            ? Number(current.payload.prayer_count || 0)
            : Number(current.payload.prayer_count || 0) + 1,
        }
      : sanitizePayload(entity, body);
    if (entity === 'PrayerRequest' && Object.hasOwn(payload, 'is_private') && typeof payload.is_private !== 'boolean') {
      response.status(400).json({ error: 'Le réglage de confidentialité est invalide.' });
      return;
    }
    if (entity === 'DailyThought') Object.assign(payload, validateDailyThought({ ...current.payload, ...payload }));
    if (entity === 'GalleryCategory') {
      const validatedCategory = { ...current.payload, ...payload };
      validateGalleryCategoryPayload(validatedCategory);
      const duplicates = await prisma.$queryRaw`
        SELECT id FROM public.uce_app_records
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
          AND entity_type='GalleryCategory'
          AND lower(payload->>'name')=lower(${validatedCategory.name})
          AND id<>${current.id}::uuid
        LIMIT 1
      `;
      if (duplicates[0]) {
        response.status(409).json({ error: 'Cette catégorie existe déjà.' });
        return;
      }
      for (const key of Object.keys(payload)) payload[key] = validatedCategory[key];
    }
    if (entity === 'GalleryPhoto') {
      const validatedPhoto = { ...current.payload, ...payload };
      validateGalleryPhotoPayload(validatedPhoto);
      const category = await prisma.uce_app_records.findFirst({
        where: {
          id: validatedPhoto.category_id,
          eglise_id: request.identity.profile.eglise_id,
          entity_type: 'GalleryCategory',
        },
        select: { id: true },
      });
      if (!category) {
        response.status(400).json({ error: 'Sélectionnez une catégorie active de la photothèque.' });
        return;
      }
      for (const key of Object.keys(payload)) payload[key] = validatedPhoto[key];
    }
    if (['Event', 'Sermon'].includes(entity) && !prayerParticipation) {
      validateMediaPayload(entity, { ...current.payload, ...payload });
    }
    if (entity === 'Team' && !prayerParticipation) {
      if (Object.hasOwn(payload, 'name') && (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 160)
        || Object.hasOwn(payload, 'description') && (typeof payload.description !== 'string' || payload.description.length > 2000)
        || Object.hasOwn(payload, 'type') && !['worship', 'preaching', 'children', 'missions', 'prayer', 'media', 'hospitality', 'youth', 'other'].includes(payload.type)
        || Object.hasOwn(payload, 'leader_email') && (typeof payload.leader_email !== 'string' || payload.leader_email.length > 254
          || (payload.leader_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.leader_email)))
        || Object.hasOwn(payload, 'image_url') && payload.image_url && !isSafeWebUrl(payload.image_url, { allowRelative: true })) {
        response.status(400).json({ error: 'Les informations de l’équipe sont invalides.' });
        return;
      }
      if (Object.hasOwn(payload, 'name')) payload.name = payload.name.trim();
      if (Object.hasOwn(payload, 'description')) payload.description = payload.description.trim();
      if (Object.hasOwn(payload, 'leader_email')) payload.leader_email = payload.leader_email.trim();
    }
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.uce_app_records.update({
        where: { id: current.id },
        data: {
          payload: { ...current.payload, ...payload },
          ...(entity === 'DailyThought' ? { created_at: new Date() } : {}),
          updated_at: new Date(),
        },
      });
      if (entity === 'Event') {
        await writeAuditEvent(tx, {
          churchId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          action: 'event_updated',
          entityType: 'event',
          entityId: current.id,
          details: { fields: Object.keys(payload) },
        });
        const reminderScheduleChanged = ['date', 'time'].some((field) => Object.hasOwn(payload, field));
        const reminderDate = pushConfigured ? getEventReminderDate(record.payload) : null;
        const reminderContentChanged = Object.keys(payload).some((field) => ['title', 'date', 'time', 'location'].includes(field));
        if (pushConfigured && reminderDate && reminderContentChanged) {
          const reminderTime = typeof record.payload.time === 'string' && /^\d{2}:\d{2}$/.test(record.payload.time)
            ? ` à ${record.payload.time}`
            : '';
          await tx.$executeRaw`
            UPDATE public.uce_notifications n
            SET title='Rappel d’événement',
              message=${`${record.payload.title}${reminderTime}${record.payload.location ? ` · ${record.payload.location}` : ''}`.slice(0, 240)},
              scheduled_at=${reminderDate},
              dispatch_status=CASE WHEN ${reminderScheduleChanged} THEN 'pending' ELSE dispatch_status END,
              dispatch_attempted_at=CASE WHEN ${reminderScheduleChanged} THEN NULL ELSE dispatch_attempted_at END,
              delivery_count=CASE WHEN ${reminderScheduleChanged} THEN 0 ELSE delivery_count END,
              failure_count=CASE WHEN ${reminderScheduleChanged} THEN 0 ELSE failure_count END,
              dispatch_error=CASE WHEN ${reminderScheduleChanged} THEN NULL ELSE dispatch_error END
            WHERE n.eglise_id=${request.identity.profile.eglise_id}::uuid
              AND n.source_event_id=${current.id}::uuid
              AND n.source_profile_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.uce_event_registrations r
                WHERE r.eglise_id=n.eglise_id AND r.event_id=n.source_event_id
                  AND r.profile_id=n.source_profile_id
                  AND r.status IN ('registered','present','absent')
              )
          `;
        } else if (pushConfigured && reminderScheduleChanged && !reminderDate) {
          await tx.$executeRaw`
            DELETE FROM public.uce_notifications
            WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
              AND source_event_id=${current.id}::uuid AND dispatch_status='pending'
          `;
        }
      }
      return record;
    });
    response.json({ ...updated.payload, id: updated.id, created_date: updated.created_at });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/entities/Team/:id', async (request, response, next) => {
  try {
    if (!request.identity.roles.some((role) => ADMIN_ROLES.has(role))) {
      response.status(403).json({ error: 'La suppression des équipes est réservée à l’administration de l’église.' });
      return;
    }
    if (!isUuid(request.params.id)) {
      response.status(400).json({ error: 'L’équipe sélectionnée est invalide.' });
      return;
    }
    const result = await prisma.uce_app_records.deleteMany({
      where: {
        id: request.params.id,
        eglise_id: request.identity.profile.eglise_id,
        entity_type: 'Team',
      },
    });
    if (!result.count) {
      response.status(404).json({ error: 'Équipe introuvable.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/entities/:entity/:id', async (request, response, next) => {
  try {
    const { entity, id } = request.params;
    if (!['DailyThought', 'Event', 'GalleryCategory', 'GalleryPhoto', 'Sermon', 'Group'].includes(entity)) {
      response.status(404).json({ error: 'Cette suppression n’est pas prise en charge.' });
      return;
    }
    if (!isUuid(id)) {
      response.status(400).json({ error: 'Le contenu sélectionné est invalide.' });
      return;
    }
    const current = await prisma.uce_app_records.findFirst({
      where: { id, eglise_id: request.identity.profile.eglise_id, entity_type: entity },
    });
    if (!current) {
      response.status(404).json({ error: 'Contenu introuvable.' });
      return;
    }
    const canDelete = entity === 'DailyThought'
      ? isChurchWideStaff(request.identity)
      : entity === 'Event'
        ? isChurchWideStaff(request.identity) || canManageEventScope(request.identity, current.payload)
      : ['GalleryCategory', 'GalleryPhoto'].includes(entity)
        ? canManagePhotoGallery(request.identity)
        : request.identity.roles.some((role) => ADMIN_ROLES.has(role));
    if (!canDelete) {
      response.status(403).json({ error: 'Vous n’avez pas les droits pour supprimer ce contenu.' });
      return;
    }
    if (entity === 'GalleryCategory') {
      const photoCount = await prisma.uce_app_records.count({
        where: {
          eglise_id: request.identity.profile.eglise_id,
          entity_type: 'GalleryPhoto',
          payload: { path: ['category_id'], equals: id },
        },
      });
      if (photoCount) {
        response.status(409).json({ error: `Cette catégorie est utilisée par ${photoCount} photo${photoCount > 1 ? 's' : ''}. Reclassez-les avant de la supprimer.` });
        return;
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.uce_app_records.delete({ where: { id } });
      if (entity === 'Event') {
        await writeAuditEvent(tx, {
          churchId: request.identity.profile.eglise_id,
          actorId: request.identity.authUser.id,
          action: 'event_deleted',
          entityType: 'event',
          entityId: id,
        });
      }
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

registerQuizRoutes(app, prisma);

app.use(express.static(clientBuildDirectory, { index: false }));
if (process.env.NODE_ENV === 'production') {
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path === '/api' || request.path.startsWith('/api/')) {
      next();
      return;
    }
    response.sendFile(resolve(clientBuildDirectory, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error, _request, response, _next) => {
  console.error('API request failed:', error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  response.status(status).json({
    error: status === 500 ? 'Une erreur serveur est survenue.' : error.message,
    ...(error instanceof Prisma.PrismaClientKnownRequestError ? { code: error.code } : {}),
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`UCE server listening on port ${port}`);
});

const pushDispatchTimer = pushConfigured
  ? setInterval(() => {
    dispatchPendingNotifications().catch((error) => {
      console.error('Scheduled push dispatch failed:', error);
    });
    dispatchStudyReminders().catch((error) => {
      console.error('Daily study reminder dispatch failed:', error);
    });
  }, 30_000)
  : null;
pushDispatchTimer?.unref();

async function shutdown() {
  if (pushDispatchTimer) clearInterval(pushDispatchTimer);
  server.close();
  await prisma.$disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
