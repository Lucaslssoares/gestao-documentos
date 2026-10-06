import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Categoria, Empresa, MembroEquipe, Painel, Setor, Tag, TipoDocumento } from "./tipos";

// Dados de apoio (mudam pouco): cache de 5 minutos.
const CINCO_MINUTOS = 5 * 60_000;

export const chaves = {
  categorias: ["categorias"] as const,
  tipos: ["tipos-documento"] as const,
  empresas: ["empresas"] as const,
  setores: ["setores"] as const,
  tags: ["tags"] as const,
  equipe: ["equipe"] as const,
  painel: ["painel"] as const,
  documentos: ["documentos"] as const,
  documento: (id: string) => ["documento", id] as const,
  historico: (id: string) => ["historico", id] as const,
};

/** Resumo do painel (também alimenta os contadores da barra lateral). */
export function usePainel() {
  return useQuery({ queryKey: chaves.painel, queryFn: () => api<Painel>("/dashboard"), staleTime: 60_000 });
}

export function useCategorias() {
  return useQuery({ queryKey: chaves.categorias, queryFn: () => api<Categoria[]>("/categorias"), staleTime: CINCO_MINUTOS });
}

export function useTipos() {
  return useQuery({ queryKey: chaves.tipos, queryFn: () => api<TipoDocumento[]>("/tipos-documento"), staleTime: CINCO_MINUTOS });
}

export function useEmpresas() {
  return useQuery({
    queryKey: chaves.empresas,
    queryFn: () => api<{ itens: Empresa[] }>("/empresas?por_pagina=500").then((r) => r.itens),
    staleTime: CINCO_MINUTOS,
  });
}

export function useSetores() {
  return useQuery({ queryKey: chaves.setores, queryFn: () => api<Setor[]>("/setores"), staleTime: CINCO_MINUTOS });
}

export function useTags() {
  return useQuery({ queryKey: chaves.tags, queryFn: () => api<Tag[]>("/tags"), staleTime: CINCO_MINUTOS });
}

export function useEquipe() {
  return useQuery({ queryKey: chaves.equipe, queryFn: () => api<MembroEquipe[]>("/equipe"), staleTime: CINCO_MINUTOS });
}

/** Lista plana da árvore de categorias, com o caminho completo ("Jurídico › Contratos"). */
export function achatarCategorias(arvore: Categoria[]): (Categoria & { caminho: string })[] {
  const saida: (Categoria & { caminho: string })[] = [];
  const visitar = (nos: Categoria[], prefixo: string) => {
    for (const no of nos) {
      const caminho = prefixo ? `${prefixo} › ${no.nome}` : no.nome;
      saida.push({ ...no, caminho });
      visitar(no.filhos, caminho);
    }
  };
  visitar(arvore, "");
  return saida;
}
