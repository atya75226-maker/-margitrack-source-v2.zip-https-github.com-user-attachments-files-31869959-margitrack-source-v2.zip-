import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/AuthContext'
import { DataProvider } from './state/DataContext'
import { ToastProvider } from './state/ToastContext'
import { Toaster, Spinner } from './components/ui'
import AppLayout from './router/AppLayout'
import LandingPage from './features/landing/LandingPage'
import SignInPage from './features/auth/SignInPage'
import SignUpPage from './features/auth/SignUpPage'
import DashboardPage from './features/dashboard/DashboardPage'
import CardsPage from './features/cards/CardsPage'
import CardWizardPage from './features/cards/CardWizardPage'
import CardDetailPage from './features/cards/CardDetailPage'
import VaultsPage from './features/vault/VaultsPage'
import VaultCreatePage from './features/vault/VaultCreatePage'
import VaultDetailPage from './features/vault/VaultDetailPage'
import VaultAccessPage from './features/vault/VaultAccessPage'
import StatsPage from './features/stats/StatsPage'
import ProfilePage from './features/profile/ProfilePage'
import PublicProfilePage from './features/public/PublicProfilePage'

function RequireAuth({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  return children
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/connexion" element={<SignInPage />} />
            <Route path="/inscription" element={<SignUpPage />} />
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
              <Route path="statistiques" element={<StatsPage />} />
              <Route path="profil" element={<ProfilePage />} />
            </Route>

            <Route path="/:slug" element={<PublicProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
