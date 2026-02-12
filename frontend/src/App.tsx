import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import MyFridgePage from "./pages/MyFridgePage";
import MarketplacePage from "./pages/MarketplacePage";
import CreateListingPage from "./pages/CreateListingPage";
import EditListingPage from "./pages/EditListingPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import MyListingsPage from "./pages/MyListingsPage";
import MyPurchasesPage from "./pages/MyPurchasesPage";
import MessagesPage from "./pages/MessagesPage";
import ConversationPage from "./pages/ConversationPage";
import EcoPointsPage from "./pages/EcoPointsPage.tsx";
import BadgesPage from "./pages/BadgesPage";
import AccountPage from "./pages/AccountPage";
import NotificationsPage from "./pages/NotificationsPage";
import RewardsPage from "./pages/RewardsPage";
import MyRedemptionsPage from "./pages/MyRedemptionsPage";
import EcoLockerHomePage from "./features/ecolocker/pages/EcoLockerHomePage";
import SelectLockerPage from "./features/ecolocker/pages/SelectLockerPage";
import LockerPaymentPage from "./features/ecolocker/pages/LockerPaymentPage";
import LockerOrdersPage from "./features/ecolocker/pages/LockerOrdersPage";
import LockerOrderDetailPage from "./features/ecolocker/pages/LockerOrderDetailPage";
import LockerNotificationsPage from "./features/ecolocker/pages/LockerNotificationsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="myfridge" element={<MyFridgePage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="marketplace/create" element={<CreateListingPage />} />
        <Route path="marketplace/my-listings" element={<MyListingsPage />} />
        <Route path="marketplace/my-purchases" element={<MyPurchasesPage />} />
        <Route path="marketplace/:id" element={<ListingDetailPage />} />
        <Route path="marketplace/:id/edit" element={<EditListingPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<ConversationPage />} />
        <Route path="ecopoints" element={<EcoPointsPage />} />
        <Route path="ecoboard" element={<Navigate to="/ecopoints" replace />} />
        <Route path="badges" element={<BadgesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="rewards/my-redemptions" element={<MyRedemptionsPage />} />
        <Route path="ecolocker" element={<EcoLockerHomePage />} />
        <Route path="ecolocker/select-locker" element={<SelectLockerPage />} />
        <Route path="ecolocker/payment/:orderId" element={<LockerPaymentPage />} />
        <Route path="ecolocker/orders" element={<LockerOrdersPage />} />
        <Route path="ecolocker/orders/:orderId" element={<LockerOrderDetailPage />} />
        <Route path="ecolocker/notifications" element={<LockerNotificationsPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}

export default App;
