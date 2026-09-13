import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./contexts/AuthContext";
import { usePreferences } from "./contexts/PreferencesContext";
import { LegalProvider, useLegal } from "./contexts/LegalContext";
import { RequireAuth } from "./components/auth/RequireAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LandingPage } from "./components/LandingPage";
import { PrivacyPolicy } from "./components/legal/PrivacyPolicy";
import { TermsOfService } from "./components/legal/TermsOfService";
import { useProducts } from "./hooks/useProducts";
import { useSales } from "./hooks/useSales";
import { useExpenses } from "./hooks/useExpenses";
import { useTeamMembers } from "./hooks/useTeamMembers";
import { useSubscription } from "./hooks/useSubscription";
import { useStock } from "./hooks/useStock";
import { usePermissions } from "./hooks/usePermissions";
import { APP_PATH, SIGNUP_PATH, isAppRoute, isStandalone, navigate, useRoute } from "./lib/routes";
import { NAV_ICONS } from "./components/ui/Icons";
import { Dashboard } from "./components/Dashboard";
import { DailyBrief } from "./components/DailyBrief";
import { ProductsTab } from "./components/ProductsTab";
import { SalesTab } from "./components/SalesTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { StockTab } from "./components/StockTab";
import { SettingsTab } from "./components/SettingsTab";
import { ProfileScreen } from "./components/ProfileScreen";
import { AccessManager } from "./components/AccessManager";
import { AdvisorPage } from "./components/AdvisorPage";
import { SubscriptionScreen } from "./components/SubscriptionScreen";
import { TrialBanner } from "./components/TrialBanner";
import { FloatingAssistant } from "./components/FloatingAssistant";
import { ReceiptModal } from "./components/ReceiptModal";

// Chaque onglet déclare la permission qu'il exige. La navigation ne montre
// que ce à quoi l'utilisateur a droit — les politiques RLS restent la
// véritable protection côté base.
const NAV = [
  { id: "dashboard", key: "nav_home", perm: "dashboard" },
  { id: "sales", key: "nav_sales", perm: "sales" },
  { id: "products", key: "nav_products", perm: "products" },
  { id: "stock", key: "nav_stock", perm: "stock" },
  { id: "expenses", key: "nav_expenses", perm: "expenses" },
  { id: "assistant", key: "nav_assistant", perm: "reports" },
  { id: "settings", key: "nav_settings", perm: "settings" },
];

function AppContent() {
  const [showSubscription, setShowSubscription] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAccess, setShowAccess] = useState(false);

  const { restaurant, restaurantId, role, profile } = useAuth();
  const { palette, t } = usePreferences();
  const { can, isOwner } = usePermissions();

  const { products, addProduct, deleteProduct } = useProducts(restaurantId);
  const { sales, addSalesBatch, deleteSale } = useSales(restaurantId);
  const { expenses, addExpense, deleteExpense } = useExpenses(restaurantId);
  const { members, addMember, updateMember, removeMember } = useTeamMembers(restaurantId);
  const stock = useStock(restaurantId);
  const {
    isTrial, isExpired, daysRemaining, loading: subLoading,
    subscription, plans, isActive, subscribeViaChariow,
  } = useSubscription(restaurantId);

  const visibleNav = useMemo(() => NAV.filter((item) => can(item.perm)), [can]);
  const [tab, setTab] = useState("dashboard");

  // Si l'onglet courant n'est plus autorisé (droits modifiés en direct par
  // le propriétaire), on bascule sur le premier onglet accessible.
  useEffect(() => {
    if (visibleNav.length === 0) return;
    if (!visibleNav.some((n) => n.id === tab)) {
      setTab(visibleNav[0].id);
    }
  }, [visibleNav, tab]);

  const subscriptionProps = {
    subscription, plans, loading: subLoading, isActive, isExpired, subscribeViaChariow,
  };

  if (subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: palette.bg }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#7C5CFF", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // Essai terminé ou abonnement inactif : accès aux fonctionnalités bloqué.
  if (!isActive) {
    return (
      <div className="min-h-screen pb-6" style={{ backgroundColor: palette.bg }}>
        <header className="p-4">
          <p className="font-semibold font-display" style={{ color: palette.ink }}>
            {restaurant?.name}
          </p>
        </header>
        <main className="px-4"><SubscriptionScreen {...subscriptionProps} /></main>
      </div>
    );
  }

  // Compte sans aucune permission : on l'informe plutôt que d'afficher
  // une application vide.
  if (visibleNav.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: palette.bg }}>
        <div className="max-w-sm text-center rounded-3xl p-7" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}>
          <p className="font-semibold mb-2" style={{ color: palette.ink }}>
            Aucun accès attribué
          </p>
          <p className="text-sm" style={{ color: palette.muted }}>
            Votre compte existe, mais le propriétaire du restaurant ne vous a encore donné
            accès à aucune partie de Margitrack. Contactez-le pour obtenir vos permissions.
          </p>
        </div>
      </div>
    );
  }

  if (showAccess) {
    return <AccessManager onBack={() => setShowAccess(false)} members={members} />;
  }

  if (showProfile) {
    return <ProfileScreen onBack={() => setShowProfile(false)} />;
  }

  if (showSubscription) {
    return (
      <div className="min-h-screen pb-6" style={{ backgroundColor: palette.bg }}>
        <header className="flex items-center gap-3 p-4">
          <button
            onClick={() => setShowSubscription(false)}
            className="text-sm font-medium"
            style={{ color: "#7C5CFF" }}
          >
            ← {t("back")}
          </button>
        </header>
        <main className="px-4"><SubscriptionScreen {...subscriptionProps} /></main>
      </div>
    );
  }

  const canEditCatalog = can("products");
  const canEditExpenses = can("expenses");

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.bg }}>
      <header
        className="shadow-sm sticky top-0 z-10"
        style={{ backgroundColor: palette.card, borderBottom: `1px solid ${palette.line}` }}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Margitrack" className="w-8 h-8 rounded-lg object-contain shrink-0" />
            <div>
              <p className="font-semibold font-display" style={{ color: palette.ink }}>
                {restaurant?.name}
              </p>
              <p className="text-xs" style={{ color: palette.muted }}>
                {profile?.full_name} — <span className="capitalize">{String(role || "").replace(/_/g, " ")}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {can("reports") && (
              <button
                onClick={() => setShowReceipt(true)}
                className="text-xs font-medium"
                style={{ color: palette.muted }}
              >
                {t("receipt")}
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowSubscription(true)}
                className="text-xs font-medium"
                style={{ color: "#7C5CFF" }}
              >
                {t("go_pro")}
              </button>
            )}
          </div>
        </div>
        <TrialBanner
          isTrial={isTrial}
          isExpired={isExpired}
          daysRemaining={daysRemaining}
          onUpgrade={() => setShowSubscription(true)}
        />
      </header>

      <main className="p-4 pb-24">
        {tab === "dashboard" && can("dashboard") && (
          <>
            {/* Le résumé de la veille ouvre la journée, puis s'efface une fois
                lu : l'accueil doit rester tourné vers l'activité en cours. */}
            <DailyBrief restaurantId={restaurantId} />
            <Dashboard products={products} sales={sales} expenses={expenses} stock={stock} />
          </>
        )}
        {tab === "products" && can("products") && (
          <ProductsTab products={products} onAdd={addProduct} onDelete={deleteProduct} canEdit={canEditCatalog} />
        )}
        {tab === "sales" && can("sales") && (
          <SalesTab
            products={products}
            sales={sales}
            onAddBatch={addSalesBatch}
            onDelete={deleteSale}
            canDelete={can("sales")}
          />
        )}
        {tab === "stock" && can("stock") && (
          <StockTab
            stock={stock}
            products={products}
            canEdit={can("stock")}
            canSell={can("sales")}
            onRecordSale={addSalesBatch}
          />
        )}
        {tab === "expenses" && can("expenses") && (
          <ExpensesTab expenses={expenses} onAdd={addExpense} onDelete={deleteExpense} canEdit={canEditExpenses} />
        )}
        {tab === "assistant" && can("reports") && (
          <div className="h-[calc(100vh-190px)]">
            <AdvisorPage restaurantId={restaurantId} />
          </div>
        )}
        {tab === "settings" && can("settings") && (
          <SettingsTab
            members={members}
            onAddMember={addMember}
            onUpdateMember={updateMember}
            onRemoveMember={removeMember}
            restaurant={restaurant}
            onOpenSubscription={() => setShowSubscription(true)}
            onOpenProfile={() => setShowProfile(true)}
            onOpenAccess={() => setShowAccess(true)}
          />
        )}
      </main>

      {tab !== "assistant" && can("reports") && <FloatingAssistant restaurantId={restaurantId} />}

      {showReceipt && (
        <ReceiptModal
          restaurantName={restaurant?.name ?? "Mon restaurant"}
          restaurantId={restaurantId}
          products={products}
          sales={sales}
          expenses={expenses}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Icônes seules : avec leurs libellés, sept onglets ne tenaient pas sur
          un écran de téléphone et le dernier était coupé. Une grille à
          colonnes égales garantit que tous restent visibles et alignés, quel
          que soit le nombre d'onglets auxquels l'utilisateur a droit. */}
      <nav
        className="fixed bottom-0 left-0 right-0 grid z-10"
        style={{
          gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))`,
          backgroundColor: palette.card,
          borderTop: `1px solid ${palette.line}`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {visibleNav.map((item) => {
          const Icon = NAV_ICONS[item.id];
          const active = tab === item.id;
          const label = t(item.key);
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              // Sans texte visible, le nom de l'onglet doit rester accessible
              // aux lecteurs d'écran et s'afficher au survol.
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
              className="relative flex items-center justify-center h-14 transition-colors"
              style={{ color: active ? "#7C5CFF" : palette.muted }}
            >
              {/* Repère de l'onglet actif, puisqu'il n'y a plus de libellé. */}
              <span
                className="absolute top-0 h-0.5 w-8 rounded-full transition-opacity"
                style={{ backgroundColor: "#7C5CFF", opacity: active ? 1 : 0 }}
              />
              <Icon size={23} strokeWidth={active ? 2.1 : 1.75} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Le site vitrine et l'application sont deux territoires distincts, separes
// par l'URL : "/" presente Margitrack, "/app" est l'application. Seule cette
// derniere est installable, et son scope l'empeche d'afficher la vitrine.
function AppRouter() {
  const path = useRoute();
  const inApp = isAppRoute(path);

  // Filet de securite : si l'application installee se retrouvait malgre tout
  // sur la page d'accueil (ancien raccourci, lien partage), on la ramene
  // immediatement vers l'application.
  useEffect(() => {
    if (!inApp && isStandalone()) navigate(APP_PATH, { replace: true });
  }, [inApp]);

  if (!inApp) {
    return (
      <LandingPage
        onStart={() => navigate(SIGNUP_PATH)}
        onLogin={() => navigate(APP_PATH)}
      />
    );
  }

  return (
    <RequireAuth initialMode={path === SIGNUP_PATH ? "signup" : "login"}>
      <AppContent />
    </RequireAuth>
  );
}

function LegalPageGate({ children }) {
  const { page } = useLegal();
  return (
    <>
      {children}
      {page === "privacy" && (<div className="fixed inset-0 z-50 overflow-y-auto"><PrivacyPolicy /></div>)}
      {page === "terms" && (<div className="fixed inset-0 z-50 overflow-y-auto"><TermsOfService /></div>)}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LegalProvider>
        <LegalPageGate>
          <AppRouter />
        </LegalPageGate>
      </LegalProvider>
    </ErrorBoundary>
  );
}
