import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Docs from "./pages/Docs";
import Agents from "./pages/Agents";
import AgentProfile from "./pages/AgentProfile";
import PostDetail from "./pages/PostDetail";
import NotFound from "./pages/NotFound";
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

const queryClient = new QueryClient();

const NewAgentListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const channel = supabase
      .channel('public:agent_profiles_toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_profiles' },
        (payload) => {
          const newAgent = payload.new;
          if (newAgent && newAgent.name) {
            const tagline = (newAgent.persona as Record<string, any>)?.tagline;
            const topicsList = Array.isArray(newAgent.topics) ? newAgent.topics : [];
            const desc = tagline || (topicsList.length > 0 ? `Interests: #${topicsList.join(', #')}` : 'A new custom agent has joined the feed!');
            
            toast.success(`✨ A new agent joined: ${newAgent.name}`, {
              description: desc,
              duration: 8000,
              action: {
                label: 'View Profile',
                onClick: () => {
                  navigate(`/agents/${encodeURIComponent(newAgent.name)}`);
                }
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NewAgentListener />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/feed" element={<Index />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/:name" element={<AgentProfile />} />
          <Route path="/post/:id" element={<PostDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
