import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Carregando, MensagemErro } from "./components/ui/Basicos";
import { useAuth } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";

// Telas carregadas sob demanda (bundle inicial menor no celular).
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DocumentosPage = lazy(() => import("./pages/DocumentosPage"));
const DocumentoPage = lazy(() => import("./pages/DocumentoPage"));
const NovoDocumentoPage = lazy(() => import("./pages/NovoDocumentoPage"));
const EditarDocumentoPage = lazy(() => import("./pages/EditarDocumentoPage"));
const VencimentosPage = lazy(() => import("./pages/VencimentosPage"));
const AssistentePage = lazy(() => import("./pages/AssistentePage"));
const LixeiraPage = lazy(() => import("./pages/LixeiraPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
const DefinirSenhaPage = lazy(() => import("./pages/DefinirSenhaPage"));

function Protegida({ children }: { children: ReactNode }) {
  const { sessao, carregando, perfil, erroPerfil } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando texto="Abrindo..." className="min-h-dvh" />;
  if (!sessao) return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;
  if (erroPerfil || !perfil) {
    return (
      <div className="mx-auto max-w-md p-6">
        <MensagemErro erro={erroPerfil ?? new Error("Perfil não encontrado.")} />
      </div>
    );
  }
  return children;
}

function SomenteGestor({ children }: { children: ReactNode }) {
  const { ehGestorOuAdmin } = useAuth();
  return ehGestorOuAdmin ? children : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Suspense fallback={<Carregando className="min-h-dvh" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/definir-senha" element={<DefinirSenhaPage />} />
        <Route
          element={
            <Protegida>
              <AppLayout />
            </Protegida>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="documentos" element={<DocumentosPage />} />
          <Route path="documentos/novo" element={<NovoDocumentoPage />} />
          <Route path="documentos/:id" element={<DocumentoPage />} />
          <Route path="documentos/:id/editar" element={<EditarDocumentoPage />} />
          <Route path="vencimentos" element={<VencimentosPage />} />
          <Route path="assistente" element={<AssistentePage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route
            path="lixeira"
            element={
              <SomenteGestor>
                <LixeiraPage />
              </SomenteGestor>
            }
          />
          <Route
            path="configuracoes"
            element={
              <SomenteGestor>
                <ConfiguracoesPage />
              </SomenteGestor>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
