import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const entityNames = [
  'Campaign', 'Community', 'DailyThought', 'DailyVerse', 'Donation', 'Event', 'GalleryCategory', 'GalleryPhoto',
  'Group', 'JournalEntry', 'PrayerRequest', 'Sermon', 'Team', 'User',
];

/**
 * @typedef {{
 *   list: (sort?: string, limit?: number) => Promise<any>,
 *   filter: (filters?: Record<string, unknown>, sort?: string, limit?: number) => Promise<any>,
 *   create: (data: Record<string, unknown>) => Promise<any>,
 *   update: (id: string, data: Record<string, unknown>) => Promise<any>,
 *   remove: (id: string) => Promise<any>,
 * }} EntityClient
 */

/** @type {Record<string, EntityClient>} */
const entities = Object.fromEntries(entityNames.map((name) => [name, {
  list: (sort, limit) => {
    const query = new URLSearchParams();
    if (sort) query.set('sort', sort);
    if (limit) query.set('limit', String(limit));
    return apiRequest(`/entities/${name}${query.size ? `?${query}` : ''}`);
  },
  filter: (filters, sort, limit) => {
    const query = new URLSearchParams({ filter: JSON.stringify(filters || {}) });
    if (sort) query.set('sort', sort);
    if (limit) query.set('limit', String(limit));
    return apiRequest(`/entities/${name}?${query}`);
  },
  create: (data) => apiRequest(`/entities/${name}`, { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  remove: (id) => apiRequest(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}]));

export const appClient = {
  entities,
  organization: {
    departments: () => apiRequest('/departments'),
    tree: () => apiRequest('/organization'),
    admin: () => apiRequest('/organization/admin'),
    roleRequests: () => apiRequest('/organization/role-requests'),
    roleRequestOptions: () => apiRequest('/organization/role-request-options'),
    createRoleRequest: (data) => apiRequest('/organization/role-requests', { method: 'POST', body: data }),
    decideRoleRequest: (id, data) => apiRequest(`/organization/role-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    structure: () => apiRequest('/organization/structure'),
    createDepartment: (data) => apiRequest('/organization/departments', { method: 'POST', body: data }),
    updateDepartment: (id, data) => apiRequest(`/organization/departments/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    createCommission: (data) => apiRequest('/organization/commissions', { method: 'POST', body: data }),
    updateCommission: (id, data) => apiRequest(`/organization/commissions/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    /** @param {{ profile_id: string, role_id: string, department_id?: string | null, commission_id?: string | null }} data */
    assignRole: (data) => apiRequest('/organization/assignments', { method: 'POST', body: data }),
    /** @param {Record<string, unknown>} data */
    createResponsibleAccount: (data) => apiRequest('/organization/accounts', { method: 'POST', body: data }),
    /** @param {string} profileId @param {string} password */
    resetResponsiblePassword: (profileId, password) => apiRequest(`/organization/accounts/${encodeURIComponent(profileId)}/password`, { method: 'PATCH', body: { password } }),
    /** @param {string} id */
    revokeRole: (id) => apiRequest(`/organization/assignments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { action: 'revoke' },
    }),
  },
  departmentChat: {
    list: () => apiRequest('/department-chats'),
    /** @param {string} departmentId */
    room: (departmentId) => apiRequest(`/department-chats/${encodeURIComponent(departmentId)}`),
    /** @param {string} departmentId @param {{ content: string }} data */
    sendMessage: (departmentId, data) => apiRequest(`/department-chats/${encodeURIComponent(departmentId)}/messages`, { method: 'POST', body: data }),
    /** @param {string} departmentId @param {Record<string, unknown>} data */
    createMeeting: (departmentId, data) => apiRequest(`/department-chats/${encodeURIComponent(departmentId)}/meetings`, { method: 'POST', body: data }),
  },
  finance: {
    members: () => apiRequest('/finance/members'),
    ledger: () => apiRequest('/finance/ledger'),
    expenses: () => apiRequest('/finance/expenses'),
    /** @param {string} date */
    dailyReport: (date) => apiRequest(`/finance/daily-report?date=${encodeURIComponent(date)}`),
    cashSessions: () => apiRequest('/finance/cash-sessions'),
    /** @param {{ label: string }} data */
    openCashSession: (data) => apiRequest('/finance/cash-sessions', { method: 'POST', body: data }),
    /** @param {string} id @param {{ counted_cash: string }} data */
    closeCashSession: (id, data) => apiRequest(`/finance/cash-sessions/${encodeURIComponent(id)}/close`, { method: 'POST', body: data }),
    /** @param {string} id @param {{ syscohada_code: string }} data */
    mapAccount: (id, data) => apiRequest(`/finance/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    /** @param {{ category: string, description: string, vendor_name: string, invoice_reference?: string, amount: number }} data */
    createExpense: (data) => apiRequest('/finance/expenses', { method: 'POST', body: data }),
    /** @param {string} id @param {Record<string, unknown>} data */
    updateExpense: (id, data) => apiRequest(`/finance/expenses/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  },
  settings: {
    branding: () => apiRequest('/settings/branding'),
    /** @param {Record<string, unknown>} data */
    saveBranding: (data) => apiRequest('/settings/branding', { method: 'PATCH', body: data }),
  },
  bible: {
    versions: () => apiRequest('/bible/versions'),
    /** @param {string} language */
    books: (language) => apiRequest(`/bible/books?language=${encodeURIComponent(language)}`),
    /** @param {string} language @param {string} book */
    chapters: (language, book) => apiRequest(`/bible/chapters?language=${encodeURIComponent(language)}&book=${encodeURIComponent(book)}`),
    /** @param {string} language @param {string} passage */
    passage: (language, passage) => apiRequest(`/bible/passage?language=${encodeURIComponent(language)}&passage=${encodeURIComponent(passage)}`),
    /** @param {string} language @param {string} query */
    search: (language, query) => apiRequest(`/bible/search?language=${encodeURIComponent(language)}&q=${encodeURIComponent(query)}`),
  },
  livestreams: {
    list: () => apiRequest('/livestreams'),
    /** @param {Record<string, unknown>} data */
    create: (data) => apiRequest('/livestreams', { method: 'POST', body: data }),
    /** @param {string} id @param {Record<string, unknown>} data */
    update: (id, data) => apiRequest(`/livestreams/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    /** @param {string} id */
    delete: (id) => apiRequest(`/livestreams/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  studies: {
    groups: () => apiRequest('/studies/groups'),
    members: () => apiRequest('/studies/members'),
    /** @param {Record<string, unknown>} data */
    createGroup: (data) => apiRequest('/studies/groups', { method: 'POST', body: data }),
    /** @param {string} id */
    groupMembers: (id) => apiRequest(`/studies/groups/${encodeURIComponent(id)}/members`),
    /** @param {string} id @param {Record<string, unknown>} data */
    updateMembers: (id, data) => apiRequest(`/studies/groups/${encodeURIComponent(id)}/members`, { method: 'PATCH', body: data }),
    /** @param {string} id */
    deleteGroup: (id) => apiRequest(`/studies/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** @param {string} id @param {Record<string, unknown>} data */
    updateGroup: (id, data) => apiRequest(`/studies/groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    /** @param {string} id */
    lessons: (id) => apiRequest(`/studies/groups/${encodeURIComponent(id)}/lessons`),
    /** @param {string} id @param {Record<string, unknown>} data */
    createLesson: (id, data) => apiRequest(`/studies/groups/${encodeURIComponent(id)}/lessons`, { method: 'POST', body: data }),
    /** @param {string} id @param {Record<string, unknown>} data */
    updateLesson: (id, data) => apiRequest(`/studies/lessons/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    /** @param {string} id */
    deleteLesson: (id) => apiRequest(`/studies/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** @param {string} id */
    openLesson: (id) => apiRequest(`/studies/lessons/${encodeURIComponent(id)}/open`, { method: 'POST' }),
  },
  members: {
    list: () => apiRequest('/admin/members'),
    availableUsers: () => apiRequest('/admin/members/available-users'),
    /** @param {string} profileId */
    importUser: (profileId) => apiRequest(`/admin/members/import-user/${encodeURIComponent(profileId)}`, { method: 'POST' }),
    /** @param {Record<string, unknown>} data */
    create: (data) => apiRequest('/admin/members', { method: 'POST', body: data }),
    /** @param {string} id @param {Record<string, unknown>} data */
    update: (id, data) => apiRequest(`/admin/members/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
  },
  admin: {
    audit: (limit = 100) => apiRequest(`/admin/audit?limit=${encodeURIComponent(String(limit))}`),
  },
  dashboard: {
    summary: () => apiRequest('/dashboard/summary'),
  },
  events: {
    /** @param {string} id */
    register: (id) => apiRequest(`/events/${encodeURIComponent(id)}/registration`, { method: 'POST', body: {} }),
    /** @param {string} id */
    unregister: (id) => apiRequest(`/events/${encodeURIComponent(id)}/registration`, { method: 'DELETE' }),
    /** @param {string} id */
    registrations: (id) => apiRequest(`/events/${encodeURIComponent(id)}/registrations`),
    /** @param {string} eventId @param {string} profileId @param {'present' | 'absent'} status */
    setAttendance: (eventId, profileId, status) => apiRequest(
      `/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(profileId)}`,
      { method: 'PATCH', body: { status } },
    ),
  },
  gallery: {
    interactionCounts: () => apiRequest('/gallery/interaction-counts'),
    /** @param {string} photoId */
    interactions: (photoId) => apiRequest(`/gallery/${encodeURIComponent(photoId)}/interactions`),
    /** @param {string} photoId */
    toggleLike: (photoId) => apiRequest(`/gallery/${encodeURIComponent(photoId)}/like`, { method: 'POST', body: {} }),
    /** @param {string} photoId @param {{ content: string }} data */
    addComment: (photoId, data) => apiRequest(`/gallery/${encodeURIComponent(photoId)}/comments`, { method: 'POST', body: data }),
    /** @param {string} photoId @param {string} commentId */
    deleteComment: (photoId, commentId) => apiRequest(
      `/gallery/${encodeURIComponent(photoId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' },
    ),
  },
  quiz: {
    summary: () => apiRequest('/quiz/summary'),
    /** @param {{ game_mode: string, difficulty: number }} data */
    startSession: (data) => apiRequest('/quiz/sessions', { method: 'POST', body: data }),
    /** @param {string} sessionId @param {{ question_index: number, choice?: number | null, answer?: string }} data */
    answer: (sessionId, data) => apiRequest(`/quiz/sessions/${encodeURIComponent(sessionId)}/answer`, { method: 'POST', body: data }),
    /** @param {string} rewardId */
    claimReward: (rewardId) => apiRequest(`/quiz/rewards/${encodeURIComponent(rewardId)}/claims`, { method: 'POST', body: {} }),
    admin: {
      questions: () => apiRequest('/admin/quiz/questions'),
      /** @param {Record<string, unknown>} data */
      createQuestion: (data) => apiRequest('/admin/quiz/questions', { method: 'POST', body: data }),
      /** @param {string} id @param {Record<string, unknown>} data */
      updateQuestion: (id, data) => apiRequest(`/admin/quiz/questions/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
      /** @param {string} id */
      deleteQuestion: (id) => apiRequest(`/admin/quiz/questions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      rewards: () => apiRequest('/admin/quiz/rewards'),
      /** @param {Record<string, unknown>} data */
      createReward: (data) => apiRequest('/admin/quiz/rewards', { method: 'POST', body: data }),
      /** @param {string} id @param {Record<string, unknown>} data */
      updateReward: (id, data) => apiRequest(`/admin/quiz/rewards/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
      /** @param {string} id */
      deleteReward: (id) => apiRequest(`/admin/quiz/rewards/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      claims: () => apiRequest('/admin/quiz/claims'),
      /** @param {string} id @param {{ status: 'approved' | 'rejected', admin_note?: string }} data */
      reviewClaim: (id, data) => apiRequest(`/admin/quiz/claims/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    },
  },
  notifications: {
    list: () => apiRequest('/notifications'),
    /** @param {Record<string, unknown>} data */
    create: (data) => apiRequest('/notifications', { method: 'POST', body: data }),
  },
  payments: {
    cinetpayConfig: () => apiRequest('/payments/cinetpay/config'),
    /** @param {{ amount: number, type: string, payment_method: string, campaign_id?: string, customer_phone: string, customer_email: string }} data */
    initializeCinetPay: (data) => apiRequest('/payments/cinetpay/initialize', { method: 'POST', body: data }),
    /** @param {string} transactionId */
    cinetpayStatus: (transactionId) => apiRequest(`/payments/cinetpay/${encodeURIComponent(transactionId)}`),
  },
  push: {
    config: () => apiRequest('/push/config'),
    /** @param {PushSubscriptionJSON} subscription */
    subscribe: (subscription) => apiRequest('/push/subscriptions', { method: 'POST', body: subscription }),
    /** @param {string} endpoint */
    unsubscribe: (endpoint) => apiRequest('/push/subscriptions', { method: 'DELETE', body: { endpoint } }),
  },
  auth: {
    me: () => apiRequest('/me'),
    activity: () => apiRequest('/me/activity'),
    /** @param {Record<string, unknown>} data */
    updateMe: (data) => apiRequest('/me', { method: 'PATCH', body: data }),
    logout: async (shouldRedirect = true) => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (shouldRedirect) window.location.assign('/login');
    },
    redirectToLogin: () => window.location.assign('/login'),
  },
  integrations: {
    Core: {
      /** @param {{ file: File }} options */
      UploadFile: async ({ file }) => {
        if (!file.type.startsWith('image/')) {
          throw new Error('Choisissez un fichier image.');
        }
        if (file.size > 8 * 1024 * 1024) {
          throw new Error('La taille de l’image ne peut pas dépasser 8 Mo.');
        }
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Connectez-vous avant d’envoyer un fichier.');
        const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin';
        const path = `profiles/${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from('uce-uploads').upload(path, file, {
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });
        if (error) throw error;
        const { data } = supabase.storage.from('uce-uploads').getPublicUrl(path);
        return { file_url: data.publicUrl };
      },
      /** @param {{ file: File, kind: 'audio' | 'pdf' | 'docx' }} options */
      UploadSermonFile: async ({ file, kind }) => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const fileRules = {
          audio: {
            extensions: ['mp3', 'm4a', 'wav', 'ogg', 'webm', 'aac', 'flac'],
            mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac'],
            maxSize: 48 * 1024 * 1024,
            label: 'audio',
            maxSizeLabel: '48 Mo',
          },
          pdf: {
            extensions: ['pdf'],
            mimeTypes: ['application/pdf'],
            maxSize: 20 * 1024 * 1024,
            label: 'PDF',
            maxSizeLabel: '20 Mo',
          },
          docx: {
            extensions: ['docx'],
            mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            maxSize: 20 * 1024 * 1024,
            label: 'DOCX',
            maxSizeLabel: '20 Mo',
          },
        };
        const rules = fileRules[kind];
        if (!rules || !rules.extensions.includes(extension)
          || (file.type && file.type !== 'application/octet-stream' && !rules.mimeTypes.includes(file.type))) {
          throw new Error(`Choisissez un fichier ${rules?.label || 'compatible'}.`);
        }
        if (file.size > rules.maxSize) {
          throw new Error(`La taille du fichier ${rules.label} ne peut pas dépasser ${rules.maxSizeLabel}.`);
        }
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Connectez-vous avant d’envoyer un fichier.');
        const safeExtension = extension.replace(/[^a-z0-9]/g, '').slice(0, 10);
        const path = `profiles/${user.id}/${crypto.randomUUID()}.${safeExtension}`;
        const { error } = await supabase.storage.from('uce-uploads').upload(path, file, {
          upsert: false,
          contentType: file.type || rules.mimeTypes[0],
        });
        if (error) throw error;
        const { data } = supabase.storage.from('uce-uploads').getPublicUrl(path);
        return { file_url: data.publicUrl };
      },
    },
  },
};
