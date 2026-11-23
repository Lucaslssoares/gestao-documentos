import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router";

interface Pasta {
  id: string;
  nome: string;
  total: number;
}

const BARRA = "#4e7a1c"; // verde escuro da marca: contraste ≥ 3:1 com o fundo branco
const TEXTO = "#5d6852";

/**
 * Quantidade de documentos por pasta raiz: barras horizontais de uma série só (sem legenda;
 * o título nomeia), ordenadas, valor no fim da barra e dica no hover. Clicar abre a pasta.
 */
export function DocumentosPorPasta({ pastas }: { pastas: Pasta[] }) {
  const navigate = useNavigate();
  // Pastas vazias não viram barra: aparecem só na nota abaixo do gráfico.
  const dados = pastas.filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  const vazias = pastas.length - dados.length;
  const altura = Math.max(dados.length * 34 + 8, 120);

  if (dados.length === 0) return <p className="py-6 text-center text-sm text-ink-muted">Nenhum documento cadastrado ainda.</p>;

  return (
    <>
    <div style={{ height: altura }} role="img" aria-label={`Documentos por pasta: ${dados.map((d) => `${d.nome} ${d.total}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="nome"
            width={112}
            tickLine={false}
            axisLine={false}
            tick={{ fill: TEXTO, fontSize: 13 }}
          />
          <Tooltip
            cursor={{ fill: "rgb(122 165 42 / 0.08)", radius: 6 }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-lg border border-line-soft bg-paper px-3 py-2 text-sm shadow-[var(--shadow-elevated)]">
                  <p className="font-semibold">{(payload[0].payload as Pasta).nome}</p>
                  <p className="text-ink-muted">
                    {(payload[0].payload as Pasta).total} documento(s) · clique para abrir
                  </p>
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="total"
            fill={BARRA}
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
            animationDuration={700}
            animationEasing="ease-out"
            cursor="pointer"
            onClick={(entrada) => navigate(`/documentos?categoria=${(entrada as unknown as Pasta).id}`)}
          >
            <LabelList dataKey="total" position="right" offset={8} style={{ fill: "#1c2616", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    {vazias > 0 && <p className="mt-2 text-xs text-ink-muted">{vazias} pasta(s) sem documentos.</p>}
    </>
  );
}
