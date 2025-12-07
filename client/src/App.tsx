import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Monitoring from "@/pages/monitoring";
import Tracking from "@/pages/tracking";
import Import from "@/pages/import";
import Settings from "@/pages/settings";
import Cumplidos from "@/pages/cumplidos";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/monitoring" component={Monitoring} />
      <Route path="/tracking" component={Tracking} />
      <Route path="/import" component={Import} />
      <Route path="/cumplidos" component={Cumplidos} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
