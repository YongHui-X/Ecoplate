import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
// import MyFridgePage from "./pages/MyFridgePage";
import MarketplacePage from "./pages/MarketplacePage";
import CreateListingPage from "./pages/CreateListingPage";
import EditListingPage from "./pages/EditListingPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import MyListingsPage from "./pages/MyListingsPage";
import MessagesPage from "./pages/MessagesPage";
import ConversationPage from "./pages/ConversationPage";
import EcoBoardPage from "./pages/EcoBoardPage";
import EcopointsPage from "./pages/Ecopoints";
import BadgesPage from "./pages/BadgesPage";
import AccountPage from "./pages/AccountPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
        {/* <Route path="myfridge" element={<MyFridgePage />} /> */}
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="marketplace/create" element={<CreateListingPage />} />
        <Route path="marketplace/my-listings" element={<MyListingsPage />} />
        <Route path="marketplace/:id" element={<ListingDetailPage />} />
        <Route path="marketplace/:id/edit" element={<EditListingPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<ConversationPage />} />
        <Route path="ecoboard" element={<EcoBoardPage />} />
        <Route path="ecopoints" element={<EcopointsPage />} />
        <Route path="badges" element={<BadgesPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}

export default App;
