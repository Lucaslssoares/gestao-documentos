import type { CampoPersonalizado } from "../../lib/tipos";
import { Campo } from "../ui/Basicos";

/** Renderiza os campos próprios do tipo de documento (ex.: nº e valor do contrato, chave da NF). */
export function CamposPersonalizados({
  campos,
  valores,
  aoMudar,
}: {
  campos: CampoPersonalizado[];
  valores: Record<string, unknown>;
  aoMudar: (chave: string, valor: unknown) => void;
}) {
  if (campos.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {campos.map((campo) => {
        const id = `campo-${campo.chave}`;
        const valor = valores[campo.chave];
        const comum = { id, name: campo.chave, required: campo.obrigatorio, className: "campo" };

        let entrada;
        switch (campo.tipo) {
          case "texto_longo":
            entrada = <textarea {...comum} rows={3} value={String(valor ?? "")} onChange={(e) => aoMudar(campo.chave, e.target.value)} />;
            break;
          case "numero":
          case "moeda":
            entrada = (
              <div className="relative">
                {campo.tipo === "moeda" && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">R$</span>}
                <input
                  {...comum}
                  type="number"
                  inputMode="decimal"
                  step={campo.tipo === "moeda" ? "0.01" : "any"}
                  min={campo.tipo === "moeda" ? 0 : undefined}
                  className={campo.tipo === "moeda" ? "campo pl-10" : "campo"}
                  value={valor === undefined || valor === null ? "" : String(valor)}
                  onChange={(e) => aoMudar(campo.chave, e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
            );
            break;
          case "data":
            entrada = <input {...comum} type="date" value={String(valor ?? "")} onChange={(e) => aoMudar(campo.chave, e.target.value || null)} />;
            break;
          case "booleano":
            entrada = (
              <select {...comum} value={valor === true ? "true" : valor === false ? "false" : ""} onChange={(e) => aoMudar(campo.chave, e.target.value === "" ? null : e.target.value === "true")}>
                <option value="">—</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            );
            break;
          case "selecao":
            entrada = (
              <select {...comum} value={String(valor ?? "")} onChange={(e) => aoMudar(campo.chave, e.target.value || null)}>
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
            entrada = <input {...comum} type="text" value={String(valor ?? "")} onChange={(e) => aoMudar(campo.chave, e.target.value)} />;
        }

        return (
          <Campo key={campo.chave} rotulo={campo.rotulo} htmlFor={id} obrigatorio={campo.obrigatorio} className={campo.tipo === "texto_longo" ? "sm:col-span-2" : undefined}>
            {entrada}
          </Campo>
        );
      })}
    </div>
  );
}
