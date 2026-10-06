import { Fragment, type ReactNode } from "react";
import type { Fonte } from "../../lib/tipos";

/**
 * Renderiza a resposta do assistente (markdown simples: parágrafos, listas, **negrito**)
 * e transforma as citações [F1] em marcadores clicáveis ligados às fontes.
 */
export function TextoResposta({ texto, fontes, aoClicarFonte }: { texto: string; fontes: Fonte[]; aoClicarFonte: (fonte: Fonte) => void }) {
  const porId = new Map(fontes.map((f) => [f.id, f]));
  const blocos = texto.split(/\n{2,}/).filter((b) => b.trim());

  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed">
      {blocos.map((bloco, i) => {
        const linhas = bloco.split("\n");
        const ehLista = linhas.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (ehLista) {
          const numerada = /^\s*\d/.test(linhas[0] ?? "");
          const Lista = numerada ? "ol" : "ul";
          return (
            <Lista key={i} className={numerada ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
              {linhas.map((l, j) => (
                <li key={j}>{formatarLinha(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), porId, aoClicarFonte)}</li>
              ))}
            </Lista>
          );
        }
        const titulo = /^#{1,4}\s+/.test(bloco);
        return (
          <p key={i} className={titulo ? "font-semibold" : undefined}>
            {linhas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {formatarLinha(l.replace(/^#{1,4}\s+/, ""), porId, aoClicarFonte)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function formatarLinha(linha: string, porId: Map<string, Fonte>, aoClicarFonte: (f: Fonte) => void): ReactNode[] {
  // Divide em: **negrito** | [F1] | texto
  return linha.split(/(\*\*[^*]+\*\*|\[F\d+\])/g).map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**")) return <strong key={i}>{parte.slice(2, -2)}</strong>;
    const citacao = /^\[(F\d+)\]$/.exec(parte);
    if (citacao) {
      const fonte = porId.get(citacao[1]!);
      if (!fonte) return null; // fonte ainda não chegou (streaming) ou inexistente
      return (
        <button
          key={i}
          type="button"
          onClick={() => aoClicarFonte(fonte)}
          title={fonte.titulo}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-warning-soft px-1 align-text-top text-[11px] font-semibold text-primary-dark hover:bg-primary hover:text-white"
        >
          {citacao[1]!.slice(1)}
        </button>
      );
    }
    return <Fragment key={i}>{parte}</Fragment>;
  });
}
