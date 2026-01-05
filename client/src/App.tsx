import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Monitoring from "@/pages/monitoring";
import Tracking from "@/pages/tracking";
import Import from "@/pages/import";
import Settings from "@/pages/settings";
import Cumplidos from "@/pages/cumplidos";
import Queries from "@/pages/queries";
import Login from "@/pages/login";
import Enrollment from "@/pages/enrollment";
import Despachos from "@/pages/despachos";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/monitoring">{() => <ProtectedRoute component={Monitoring} />}</Route>
      <Route path="/tracking">{() => <ProtectedRoute component={Tracking} />}</Route>
      <Route path="/import">{() => <ProtectedRoute component={Import} />}</Route>
      <Route path="/cumplidos">{() => <ProtectedRoute component={Cumplidos} />}</Route>
      <Route path="/queries">{() => <ProtectedRoute component={Queries} />}</Route>
      <Route path="/enrollment">{() => <ProtectedRoute component={Enrollment} />}</Route>
      <Route path="/despachos">{() => <ProtectedRoute component={Despachos} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
