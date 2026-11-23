import clsx from "clsx";
import { CircleCheck } from "lucide-react";
import { decodificarChave, erroDoFormato, mascarar } from "../../lib/campos";
import type { CampoPersonalizado } from "../../lib/tipos";
import { Campo } from "../ui/Basicos";

/**
 * Campos próprios do tipo de documento, agrupados em seções (Identificação, Valores,
 * Vigência...), com máscara (CNPJ, chave da NF-e, competência), unidade e dicas.
 * A chave de acesso da NF-e preenche número, série, modelo e CNPJ do emitente.
 */
export function CamposPersonalizados({
  campos,
  valores,
  aoMudar,
}: {
  campos: CampoPersonalizado[];
  valores: Record<string, unknown>;
  aoMudar: (mudancas: Record<string, unknown>) => void;
}) {
  if (campos.length === 0) return null;

  // Agrupa mantendo a ordem em que os grupos aparecem.
  const grupos: { nome: string; campos: CampoPersonalizado[] }[] = [];
  for (const campo of campos) {
    const nome = campo.grupo ?? "";
    const grupo = grupos.find((g) => g.nome === nome);
    if (grupo) grupo.campos.push(campo);
    else grupos.push({ nome, campos: [campo] });
  }

  function mudarChave(campo: CampoPersonalizado, texto: string) {
    const mudancas: Record<string, unknown> = { [campo.chave]: texto };
    // Chave válida: completa o que estiver vazio com os dados que ela carrega.
    const dados = campo.formato === "chave_nfe" ? decodificarChave(texto) : null;
    if (dados) {
      const existe = (chave: string) => campos.some((c) => c.chave === chave) && !valores[chave];
      if (existe("numero")) mudancas.numero = dados.numero;
      if (existe("serie")) mudancas.serie = dados.serie;
      if (existe("cnpj_emitente")) mudancas.cnpj_emitente = mascarar("cnpj", dados.cnpj_emitente);
      if (dados.modelo && existe("modelo")) mudancas.modelo = dados.modelo;
    }
    aoMudar(mudancas);
  }

  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
        <fieldset key={grupo.nome || "campos"} className="min-w-0">
          {grupo.nome && <legend className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{grupo.nome}</legend>}
          <div className="grid gap-4 sm:grid-cols-2">
            {grupo.campos.map((campo) => (
              <CampoDoTipo key={campo.chave} campo={campo} valor={valores[campo.chave]} aoMudar={(v) => (campo.formato === "chave_nfe" ? mudarChave(campo, String(v ?? "")) : aoMudar({ [campo.chave]: v }))} />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function CampoDoTipo({ campo, valor, aoMudar }: { campo: CampoPersonalizado; valor: unknown; aoMudar: (valor: unknown) => void }) {
  const id = `campo-${campo.chave}`;
  const comum = { id, name: campo.chave, required: campo.obrigatorio, placeholder: campo.placeholder, className: "campo" };
  const texto = valor === undefined || valor === null ? "" : String(valor);
  const erroFormato = campo.formato ? erroDoFormato(campo.formato, texto) : null;
  const largo = campo.tipo === "texto_longo" || campo.formato === "chave_nfe";

  let entrada;
  switch (campo.tipo) {
    case "texto_longo":
      entrada = <textarea {...comum} rows={3} value={texto} onChange={(e) => aoMudar(e.target.value)} />;
      break;
    case "numero":
    case "moeda":
      entrada = (
        <div className="relative">
          {campo.tipo === "moeda" && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-ink-muted">R$</span>}
          <input
            {...comum}
            type="number"
            inputMode="decimal"
            step={campo.tipo === "moeda" ? "0.01" : "any"}
            min={campo.tipo === "moeda" ? 0 : undefined}
            placeholder={campo.placeholder ?? (campo.tipo === "moeda" ? "0,00" : undefined)}
            className={clsx("campo", campo.tipo === "moeda" && "pl-11", campo.sufixo && "pr-14")}
            value={texto}
            onChange={(e) => aoMudar(e.target.value === "" ? null : Number(e.target.value))}
          />
          {campo.sufixo && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-ink-muted">{campo.sufixo}</span>}
        </div>
      );
      break;
    case "data":
      entrada = <input {...comum} type="date" value={texto} onChange={(e) => aoMudar(e.target.value || null)} />;
      break;
    case "booleano":
      // Sim/Não como botões: mais rápido que um select de duas opções.
      entrada = (
        <div role="radiogroup" aria-labelledby={`${id}-rotulo`} className="flex gap-2">
          {[
            { v: true, r: "Sim" },
            { v: false, r: "Não" },
          ].map((o) => (
            <button
              key={o.r}
              type="button"
              role="radio"
              aria-checked={valor === o.v}
              onClick={() => aoMudar(valor === o.v ? null : o.v)}
              className={clsx(
                "h-11 flex-1 rounded-xl border text-sm font-medium transition-[background-color,border-color,color,transform] active:scale-[0.98]",
                valor === o.v ? "border-primary-dark bg-success-soft text-primary-dark" : "border-line bg-white text-ink-muted hover:border-primary/50",
              )}
            >
              {o.r}
            </button>
          ))}
        </div>
      );
      break;
    case "selecao":
      entrada = (
        <select {...comum} value={texto} onChange={(e) => aoMudar(e.target.value || null)}>
          <option value="">Selecione...</option>
          {campo.opcoes?.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      );
      break;
    default:
      entrada = campo.formato ? (
        <div className="relative">
          <input
            {...comum}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={campo.placeholder ?? { cnpj: "00.000.000/0000-00", chave_nfe: "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000", competencia: "MM/AAAA" }[campo.formato]}
            className={clsx("campo font-mono tracking-tight", erroFormato && "border-danger focus:border-danger focus:ring-danger/15", texto && !erroFormato && "pr-10")}
            aria-invalid={Boolean(erroFormato)}
            value={mascarar(campo.formato, texto)}
            onChange={(e) => aoMudar(mascarar(campo.formato!, e.target.value))}
          />
          {texto && !erroFormato && <CircleCheck className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-success" aria-label="Válido" />}
        </div>
      ) : (
        <input {...comum} type="text" value={texto} onChange={(e) => aoMudar(e.target.value)} />
      );
  }

  return (
    <Campo
      rotulo={campo.rotulo}
      htmlFor={campo.tipo === "booleano" ? undefined : id}
      obrigatorio={campo.obrigatorio}
      className={largo ? "sm:col-span-2" : undefined}
      ajuda={erroFormato ? <span className="text-danger">{erroFormato}</span> : campo.ajuda}
    >
      {entrada}
    </Campo>
  );
}
