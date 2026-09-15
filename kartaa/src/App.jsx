import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/AuthContext'
import { DataProvider } from './state/DataContext'
import { ToastProvider } from './state/ToastContext'
import { LanguageProvider } from './i18n'
import { ProLockProvider } from './components/ProLock'
import { Toaster, Spinner } from './components/ui'
import Reconnecting from './components/Reconnecting'
import PwaBanners from './components/PwaBanners'
import { estInstallee } from './lib/pwa'
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
import DiagnosticPage from './features/diagnostic/DiagnosticPage'

/**
 * Écran d'attente affiché tant que la session n'est pas tranchée.
 *
 * Rien ne doit être décidé avant : ni redirection vers la connexion, ni
 * affichage de la page vitrine. « Session en cours de lecture » et « aucune
 * session » sont deux états distincts, et les confondre revient à déconnecter
 * quelqu'un qui ne l'est pas.
 */
function Patientez() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 text-brand-600">
      <Spinner size={28} />
    </div>
  )
}

/**
 * Page vitrine pour les visiteurs, tableau de bord pour les personnes déjà
 * connectées. Sans cette bascule, revenir sur l'adresse du site affichait la
 * vitrine et son bouton « Se connecter » — ce qui se lit comme une déconnexion,
 * alors que la session était intacte.
 */
function AccueilOuApplication() {
  const { isAuthenticated, ready } = useAuth()
  if (!ready) return <Patientez />
  if (isAuthenticated) return <Navigate to="/app" replace />
  // Lancée depuis son icône, l'application ne doit jamais s'ouvrir sur la page
  // vitrine : le manifeste démarre sur /app, mais une fenêtre autonome peut
  // atterrir sur « / » (lien partagé, page d'accueil du navigateur, retour
  // arrière). Sans compte, on emmène vers la connexion, pas vers le marketing.
  if (estInstallee()) return <Navigate to="/connexion" replace />
  return <LandingPage />
}

/** Les écrans de connexion n'ont plus lieu d'être une fois la session ouverte. */
function SiDeconnecte({ children }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Patientez />
  if (isAuthenticated) return <Navigate to={location.state?.from || '/app'} replace />
  return children
}

function RequireAuth({ children }) {
  const { isAuthenticated, ready, reconnecting } = useAuth()
  const location = useLocation()
  if (!ready) return <Patientez />
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
            <Route path="/" element={<AccueilOuApplication />} />
            <Route path="/connexion" element={<SiDeconnecte><SignInPage /></SiDeconnecte>} />
            <Route path="/inscription" element={<SiDeconnecte><SignUpPage /></SiDeconnecte>} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            {/* Trois adresses pour un même écran : /coffre est celle des QR Codes
                d'aujourd'hui, /c celle des codes déjà imprimés, /vault un alias
                lisible. Aucune ne demande de compte. */}
            <Route path="/coffre/:vaultId" element={<VaultAccessPage />} />
            <Route path="/vault/:vaultId" element={<VaultAccessPage />} />
            <Route path="/c/:vaultId" element={<VaultAccessPage />} />
            <Route path="/diagnostic" element={<DiagnosticPage />} />

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
          <PwaBanners />
            </ProLockProvider>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  )
}
