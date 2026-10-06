import { supabase } from "./supabase";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

export class ErroApi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly campos?: { campo: string; mensagem: string }[],
  ) {
    super(message);
    this.name = "ErroApi";
  }
}

async function cabecalhos(extra?: HeadersInit): Promise<Headers> {
  const headers = new Headers(extra);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function tratarErro(res: Response): Promise<never> {
  let corpo: { erro?: string; campos?: { campo: string; mensagem: string }[] } | null = null;
  try {
    corpo = await res.json();
  } catch {
    /* corpo vazio ou não-JSON */
  }
  const detalhe = corpo?.campos?.map((c) => c.mensagem).join(" ");
  throw new ErroApi(corpo?.erro ? (detalhe ? `${corpo.erro} ${detalhe}` : corpo.erro) : `Erro ${res.status}`, res.status, corpo?.campos);
}

type Opcoes = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

/** Chamada à API do backend com o token da sessão. */
export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { json, ...resto } = opcoes;
  const headers = await cabecalhos(resto.headers);
  let body = resto.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  const res = await fetch(`${BASE}${caminho}`, { ...resto, headers, body });
  if (!res.ok) await tratarErro(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Monta a query string ignorando valores vazios. */
export function qs(parametros: Record<string, string | number | undefined | null | string[]>): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    if (Array.isArray(valor)) {
      if (valor.length) busca.set(chave, valor.join(","));
    } else busca.set(chave, String(valor));
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

/** Baixa o arquivo de um documento (com o token) e devolve um Blob. */
export async function baixarArquivo(documentoId: string, opcoes: { versao?: number; download?: boolean } = {}): Promise<Blob> {
  const headers = await cabecalhos();
  const res = await fetch(`${BASE}/documentos/${documentoId}/arquivo${qs({ versao: opcoes.versao, download: opcoes.download ? "1" : undefined })}`, {
    headers,
  });
  if (!res.ok) await tratarErro(res);
  return res.blob();
}

/** Dispara o download no navegador. */
export async function salvarArquivo(documentoId: string, nomeArquivo: string, versao?: number): Promise<void> {
  const blob = await baixarArquivo(documentoId, { versao, download: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Lê um stream Server-Sent Events de um POST (o EventSource nativo só faz GET). */
export async function postSse(
  caminho: string,
  corpo: unknown,
  aoEvento: (evento: string, dados: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await cabecalhos({ "Content-Type": "application/json", Accept: "text/event-stream" });
  const res = await fetch(`${BASE}${caminho}`, { method: "POST", headers, body: JSON.stringify(corpo), signal });
  if (!res.ok || !res.body) await tratarErro(res);

  const leitor = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    buffer += value;
    let fim: number;
    while ((fim = buffer.indexOf("\n\n")) >= 0) {
      const bloco = buffer.slice(0, fim);
      buffer = buffer.slice(fim + 2);
      const evento = /^event: (.*)$/m.exec(bloco)?.[1] ?? "message";
      const dados = /^data: (.*)$/m.exec(bloco)?.[1];
      if (dados !== undefined) aoEvento(evento, JSON.parse(dados));
    }
  }
}
