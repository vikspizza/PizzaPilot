import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import OrderSuccess from "@/pages/order-success";
import Login from "@/pages/login";
import Profile from "@/pages/profile";
import About from "@/pages/about";
import FAQs from "@/pages/faqs";
import Privacy from "@/pages/privacy";
import Review from "@/pages/review";
import PastExperiments from "@/pages/past-experiments";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/past-experiments" component={PastExperiments} />
      <Route path="/about" component={About} />
      <Route path="/faqs" component={FAQs} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/admin" component={Admin} />
      <Route path="/success" component={OrderSuccess} />
      <Route path="/login" component={Login} />
      <Route path="/profile" component={Profile} />
      <Route path="/review/:orderId" component={Review} />
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
