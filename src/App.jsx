import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider, useLanguage } from '@/lib/I18nContext';
import { PwaProvider } from '@/lib/PwaContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';

const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Communities = lazy(() => import('./pages/Communities'));
const Events = lazy(() => import('./pages/Events'));
const PhotoGallery = lazy(() => import('./pages/PhotoGallery'));
const Sermons = lazy(() => import('./pages/Sermons'));
const Bible = lazy(() => import('./pages/Bible'));
const Prayers = lazy(() => import('./pages/Prayers'));
const Groups = lazy(() => import('./pages/Groups'));
const Teams = lazy(() => import('./pages/Teams'));
const Donations = lazy(() => import('./pages/Donations'));
const FinanceAccounts = lazy(() => import('./pages/FinanceAccounts'));
const FinanceReport = lazy(() => import('./pages/FinanceReport'));
const Admin = lazy(() => import('./pages/Admin'));
const Journal = lazy(() => import('./pages/Journal'));
const Quiz = lazy(() => import('./pages/Quiz'));
const AdminQuiz = lazy(() => import('./pages/AdminQuiz'));
const Leadership = lazy(() => import('./pages/Leadership'));
const Contact = lazy(() => import('./pages/Contact'));
const ChurchMap = lazy(() => import('./pages/ChurchMap'));
const Live = lazy(() => import('./pages/Live'));
const BibleStudies = lazy(() => import('./pages/BibleStudies'));
const Notifications = lazy(() => import('./pages/Notifications'));
const AppDesign = lazy(() => import('./pages/AppDesign'));
const AdminLeadership = lazy(() => import('./pages/AdminLeadership'));
const Login = lazy(() => import('./pages/Login'));
const MemberManagement = lazy(() => import('./pages/MemberManagement'));
const OrganizationWorkspace = lazy(() => import('./pages/OrganizationWorkspace'));
const RoleAssignments = lazy(() => import('./pages/RoleAssignments'));
const DepartmentChat = lazy(() => import('./pages/DepartmentChat'));
const OrganizationManagement = lazy(() => import('./pages/OrganizationManagement'));
const ContentManagement = lazy(() => import('./pages/ContentManagement'));
const AuditLog = lazy(() => import('./pages/AuditLog'));

const AuthenticatedApp = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const { isLoadingAuth, isAuthenticated, user, authError, retryProfile } = useAuth();

  if (location.pathname === '/login') {
    return <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center">{t('Chargement…')}</div>}><Login /></Suspense>;
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;
  if (authError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <section role="alert" className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-elev-3">
          <h1 className="text-xl font-black">{t('Connexion temporairement indisponible')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{authError?.message || t('Impossible de charger votre profil.')}</p>
          <button type="button" disabled={isLoadingAuth} onClick={() => retryProfile().catch(() => {})} className="mt-6 min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60">
            {isLoadingAuth ? t('Nouvelle tentative…') : t('Réessayer')}
          </button>
        </section>
      </main>
    );
  }

  // Render the main app
  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center">{t('Chargement…')}</div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/events" element={<Events />} />
          <Route path="/gallery" element={<PhotoGallery />} />
          <Route path="/admin/gallery" element={<PhotoGallery adminMode />} />
          <Route path="/sermons" element={<Sermons />} />
          <Route path="/bible" element={<Bible />} />
          <Route path="/prayers" element={<Prayers />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/department-chat" element={<DepartmentChat />} />
          <Route path="/admin/teams" element={<Teams adminMode />} />
          <Route path="/donations" element={<Donations />} />
          <Route path="/admin/finance" element={<Donations financeMode />} />
          <Route path="/admin/finance/accounts" element={<FinanceAccounts />} />
          <Route path="/admin/finance/report" element={<FinanceReport />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/members" element={<MemberManagement />} />
          <Route path="/admin/groups" element={<OrganizationManagement />} />
          <Route path="/admin/content" element={<ContentManagement />} />
          <Route path="/admin/organisation" element={<RoleAssignments />} />
          <Route path="/admin/departements/:departmentId" element={<OrganizationWorkspace />} />
          <Route path="/admin/commissions/:commissionId" element={<OrganizationWorkspace />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/admin/quiz" element={<AdminQuiz />} />
          <Route path="/leadership" element={<Leadership />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/map" element={<ChurchMap />} />
          <Route path="/live" element={<Live />} />
          <Route path="/studies" element={<BibleStudies />} />
          <Route path="/admin/live" element={<Live adminMode />} />
          <Route path="/admin/studies" element={<BibleStudies adminMode />} />
          <Route path="/admin/notifications" element={<Notifications />} />
          <Route path="/admin/design" element={<AppDesign />} />
          <Route path="/admin/responsibles" element={<AdminLeadership />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <PwaProvider>
      <LanguageProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <AuthenticatedApp />
            </Router>
            <Toaster position="top-center" richColors />
          </QueryClientProvider>
        </AuthProvider>
      </LanguageProvider>
    </PwaProvider>
  )
}

export default App
