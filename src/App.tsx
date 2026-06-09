import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { ReactNode } from "react";

import Login from "./pages/Login";
import DriverRegister from "./pages/DriverRegister";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverWallet from "./pages/driver/DriverWallet";
import OperatorDashboard from "./pages/operator/OperatorDashboard";
import OrderList from "./pages/shared/OrderList";
import CreateOrder from "./pages/shared/CreateOrder";
import LabelPrint from "./pages/shared/LabelPrint";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import SourceSystems from "./pages/admin/SourceSystems";
import Reports from "./pages/admin/Reports";
import PwaSettings from "./pages/admin/PwaSettings";
import WalletManagement from "./pages/admin/WalletManagement";
import OnlyHubIntegration from "./pages/admin/OnlyHubIntegration";
import PartnerPortal from "./pages/portal/PartnerPortal";
import NotFound from "./pages/NotFound";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";

const queryClient = new QueryClient();

function RequireAuth({ children, allowedRoles }: { children: ReactNode; allowedRoles: string[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Уншиж байна...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Уншиж байна...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "driver") return <Navigate to="/driver" replace />;
  if (role === "operator") return <Navigate to="/operator" replace />;
  if (role === "main_admin") return <Navigate to="/admin" replace />;
  return <div className="flex items-center justify-center h-screen text-muted-foreground">Эрх олгогдоогүй байна. Админтай холбогдоно уу.</div>;
}

function LayoutWrap({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PwaInstallPrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register-driver" element={<DriverRegister />} />

            {/* Partner portal: embedded by external admin panels via token, no app login required */}
            <Route path="/portal" element={<PartnerPortal />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* Driver */}
            <Route path="/driver" element={<RequireAuth allowedRoles={["driver"]}><LayoutWrap><DriverDashboard /></LayoutWrap></RequireAuth>} />
            <Route path="/driver/wallet" element={<RequireAuth allowedRoles={["driver"]}><LayoutWrap><DriverWallet /></LayoutWrap></RequireAuth>} />

            {/* Operator */}
            <Route path="/operator" element={<RequireAuth allowedRoles={["operator"]}><LayoutWrap><OperatorDashboard /></LayoutWrap></RequireAuth>} />
            <Route path="/operator/orders" element={<RequireAuth allowedRoles={["operator"]}><LayoutWrap><OrderList /></LayoutWrap></RequireAuth>} />
            <Route path="/operator/create" element={<RequireAuth allowedRoles={["operator"]}><LayoutWrap><CreateOrder /></LayoutWrap></RequireAuth>} />
            <Route path="/operator/print" element={<RequireAuth allowedRoles={["operator"]}><LayoutWrap><LabelPrint /></LayoutWrap></RequireAuth>} />

            {/* Admin */}
            <Route path="/admin" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><AdminDashboard /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/orders" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><OrderList /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/create" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><CreateOrder /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/drivers" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><OrderList /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><UserManagement /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/sources" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><SourceSystems /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/reports" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><Reports /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/print" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><LabelPrint /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/settings" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><SourceSystems /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/pwa" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><PwaSettings /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/wallet" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><WalletManagement /></LayoutWrap></RequireAuth>} />
            <Route path="/admin/only-hub" element={<RequireAuth allowedRoles={["main_admin"]}><LayoutWrap><OnlyHubIntegration /></LayoutWrap></RequireAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
