import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/** @typedef {import('@supabase/supabase-js').Session | null} Session */
/** @typedef {'user_not_registered' | 'unknown'} AuthErrorType */
/** @typedef {{ type: AuthErrorType, message: string }} AuthError */
/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} [email]
 * @property {string} [full_name]
 * @property {string} [phone]
 * @property {string} [country]
 * @property {string} [city]
 * @property {string} [gender]
 * @property {string | number} [age]
 * @property {string} [spiritual_role]
 * @property {string} [bio]
 * @property {string} [community_id]
 * @property {string} [reading_plan]
 * @property {string} [photo_url]
 * @property {string} [role]
 * @property {string[]} [roles]
 * @property {Array<{
 *   code: string,
 *   name: string,
 *   scope: string,
 *   department: { id: string, code: string, name: string } | null,
 *   commission: { id: string, code: string, name: string } | null
 * }>} [role_assignments]
 */
/**
 * @typedef {Object} AuthContextValue
 * @property {UserProfile | null} user
 * @property {Session} session
 * @property {boolean} isAuthenticated
 * @property {boolean} isLoadingAuth
 * @property {boolean} isLoadingPublicSettings
 * @property {AuthError | null} authError
 * @property {null} appPublicSettings
 * @property {(shouldRedirect?: boolean) => Promise<void>} logout
 * @property {() => void} navigateToLogin
 * @property {() => Promise<Session>} checkAppState
 * @property {() => Promise<void>} retryProfile
 */

/** @type {React.Context<AuthContextValue | null>} */
const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null));

/** @param {{ children: React.ReactNode }} props */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(/** @type {Session} */ (null));
  const [user, setUser] = useState(/** @type {UserProfile | null} */ (null));
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(/** @type {AuthError | null} */ (null));

  useEffect(() => {
    let active = true;
    let loadGeneration = 0;

    /** @param {unknown} error @returns {AuthError} */
    const toAuthError = (error) => {
      const code = error !== null && typeof error === 'object' && 'code' in error
        && typeof error.code === 'string'
        ? error.code
        : undefined;
      return {
        type: code === 'profile_not_registered' ? 'user_not_registered' : 'unknown',
        message: error instanceof Error ? error.message : 'Impossible de charger votre profil.',
      };
    };

    /** @param {Session} nextSession */
    const loadProfile = async (nextSession) => {
      if (!active) return;
      const generation = ++loadGeneration;
      setSession(nextSession);
      setUser(null);
      setAuthError(null);
      if (!nextSession) {
        setIsLoadingAuth(false);
        return;
      }

      setIsLoadingAuth(true);
      try {
        const profile = await apiRequest('/me', { accessToken: nextSession.access_token });
        if (active && generation === loadGeneration) setUser(profile);
      } catch (error) {
        if (active && generation === loadGeneration) setAuthError(toAuthError(error));
      } finally {
        if (active && generation === loadGeneration) setIsLoadingAuth(false);
      }
    };

    supabase.auth.getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (error) throw error;
        return loadProfile(initialSession);
      })
      .catch((error) => {
        if (active) {
          setAuthError(toAuthError(error));
          setIsLoadingAuth(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadProfile(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (shouldRedirect) window.location.assign('/login');
  };

  const navigateToLogin = () => window.location.assign('/login');

  const retryProfile = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(currentSession);
      if (!currentSession) {
        setUser(null);
        return;
      }
      const profile = await apiRequest('/me', { accessToken: currentSession.access_token });
      setUser(profile);
    } catch (error) {
      setAuthError({
        type: error && typeof error === 'object' && error.code === 'profile_not_registered' ? 'user_not_registered' : 'unknown',
        message: error instanceof Error ? error.message : 'Impossible de charger votre profil.',
      });
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: Boolean(session),
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: () => supabase.auth.getSession().then(({ data }) => data.session),
      retryProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
