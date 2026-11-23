import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import { App } from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ErroApi } from "./lib/api";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Não insiste em erros de permissão/validação.
      retry: (tentativas, erro) => !(erro instanceof ErroApi && erro.status < 500) && tentativas < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Animações respeitam "reduzir movimento" do sistema; dicas com atraso curto. */}
      <MotionConfig reducedMotion="user">
        <Tooltip.Provider delayDuration={250}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
            </AuthProvider>
          </BrowserRouter>
        </Tooltip.Provider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
