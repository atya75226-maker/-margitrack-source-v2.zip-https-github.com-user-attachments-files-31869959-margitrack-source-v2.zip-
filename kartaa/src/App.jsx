import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/AuthContext'
import { DataProvider } from './state/DataContext'
import { ToastProvider } from './state/ToastContext'
import { LanguageProvider } from './i18n'
import { ProLockProvider } from './components/ProLock'
import { Toaster, Spinner } from './components/ui'
import Reconnecting from './components/Reconnecting'
import AppLayout from './router/AppLayout'
import LandingPage from './features/landing/LandingPage'
import SignInPage from './features/auth/SignInPage'
import SignUpPage from './features/auth/SignUpPage'
import AuthCallbackPage from './features/auth/AuthCallbackPage'
import DashboardPage from './features/dashboard/DashboardPage'
import CardsPage from './features/cards/CardsPage'
import CardWizardPage from './features/cards/CardWizardPage'
import CardDetailPage from './features/cards/CardDetailPage'
import VaultsPage from './features/vault/VaultsPage'
import VaultCreatePage from './features/vault/VaultCreatePage'
import VaultDetailPage from './features/vault/VaultDetailPage'
import VaultAccessPage from './features/vault/VaultAccessPage'
import StatsPage from './features/stats/StatsPage'
import ScannerPage from './features/scanner/ScannerPage'
import ProfilePage from './features/profile/ProfilePage'
import SubscriptionPage from './features/profile/SubscriptionPage'
import PublicProfilePage from './features/public/PublicProfilePage'

function RequireAuth({ children }) {
  const { isAuthenticated, ready, reconnecting } = useAuth()
  const location = useLocation()
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }
  // Des jetons attendent dans le navigateur mais le serveur ne répond pas :
  // c'est une panne de réseau, pas une déconnexion. On ne réclame pas le mot
  // de passe pour quelque chose qui va revenir tout seul.
  if (!isAuthenticated && reconnecting) return <Reconnecting />
  if (!isAuthenticated) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  return children
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <ProLockProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/connexion" element={<SignInPage />} />
            <Route path="/inscription" element={<SignUpPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/c/:vaultId" element={<VaultAccessPage />} />

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="cartes" element={<CardsPage />} />
              <Route path="cartes/nouvelle" element={<CardWizardPage />} />
              <Route path="cartes/:cardId/modifier" element={<CardWizardPage />} />
              <Route path="cartes/:cardId" element={<CardDetailPage />} />
              <Route path="coffres" element={<VaultsPage />} />
              <Route path="coffres/nouveau" element={<VaultCreatePage />} />
              <Route path="coffres/:vaultId" element={<VaultDetailPage />} />
              <Route path="scanner" element={<ScannerPage />} />
              <Route path="statistiques" element={<StatsPage />} />
              <Route path="profil" element={<ProfilePage />} />
              <Route path="abonnement" element={<SubscriptionPage />} />
            </Route>

            <Route path="/:slug" element={<PublicProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
            </ProLockProvider>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  )
}
