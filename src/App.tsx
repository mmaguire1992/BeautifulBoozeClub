import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Enquiries from "./pages/Enquiries";
import NewEnquiry from "./pages/NewEnquiry";
import Quotes from "./pages/Quotes";
import NewQuote from "./pages/NewQuote";
import QuoteDetails from "./pages/QuoteDetails";
import Bookings from "./pages/Bookings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import GoogleCalendar from "./pages/GoogleCalendar";
import Login from "./pages/Login";
import { AuthProvider, RequireAuth } from "./auth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/enquiries"
              element={
                <RequireAuth>
                  <Layout>
                    <Enquiries />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/enquiries/new"
              element={
                <RequireAuth>
                  <Layout>
                    <NewEnquiry />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/quotes"
              element={
                <RequireAuth>
                  <Layout>
                    <Quotes />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/quotes/new"
              element={
                <RequireAuth>
                  <Layout>
                    <NewQuote />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/quotes/:quoteId"
              element={
                <RequireAuth>
                  <Layout>
                    <QuoteDetails />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/quotes/:quoteId/edit"
              element={
                <RequireAuth>
                  <Layout>
                    <NewQuote />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/bookings"
              element={
                <RequireAuth>
                  <Layout>
                    <Bookings />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/google-calendar"
              element={
                <RequireAuth>
                  <Layout>
                    <GoogleCalendar />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Layout>
                    <Settings />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
