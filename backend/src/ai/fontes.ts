/** Fonte que embasa uma resposta do assistente — vira link clicável no front-end. */
export interface Fonte {
  id: string; // "F1", "F2"...
  tipo: "documento" | "trecho";
  titulo: string;
  detalhe?: string;
  documento_id: string;
  pagina?: number | null;
  trecho?: string;
}

/**
 * Numera as fontes devolvidas pelas ferramentas ([F1], [F2]...).
 * O modelo cita esses identificadores no texto; ao final, só as fontes citadas vão para o usuário.
 */
export class RegistroFontes {
  private readonly porChave = new Map<string, Fonte>();

  registrar(chave: string, fonte: Omit<Fonte, "id">): string {
    const existente = this.porChave.get(chave);
    if (existente) return existente.id;
    const id = `F${this.porChave.size + 1}`;
    this.porChave.set(chave, { id, ...fonte });
    return id;
  }

  /** Fontes citadas no texto, na ordem da primeira citação. */
  citadas(texto: string): Fonte[] {
    const ids = [...new Set([...texto.matchAll(/\[F(\d+)\]/g)].map((m) => `F${m[1]}`))];
    const todas = new Map([...this.porChave.values()].map((f) => [f.id, f]));
    return ids.map((id) => todas.get(id)).filter((f): f is Fonte => Boolean(f));
  }

  get total(): number {
    return this.porChave.size;
  }
}

/** Remove marcadores [F#] do histórico — os números valem só para a resposta em que foram gerados. */
export function semCitacoes(texto: string): string {
  return texto.replace(/\s?\[F\d+\]/g, "");
}
