import clsx from "clsx";
import {
  BadgeCheck,
  BookOpenCheck,
  ClipboardList,
  FileCheck2,
  FilePen,
  FileSignature,
  FileText,
  FlaskConical,
  HeartPulse,
  Landmark,
  Leaf,
  Mail,
  Megaphone,
  Receipt,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Stamp,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Categoria, TipoDocumento } from "../../lib/tipos";

const ICONE_TIPO: Record<string, LucideIcon> = {
  contrato: FileSignature,
  aditivo: FilePen,
  procuracao: Stamp,
  parecer: BookOpenCheck,
  notificacao: Megaphone,
  nota_fiscal: Receipt,
  comprovante: ReceiptText,
  relatorio: ClipboardList,
  guia_imposto: Landmark,
  certidao: BadgeCheck,
  proposta: FileCheck2,
  pedido_compra: ShoppingCart,
  documento_colaborador: UserRound,
  atestado: HeartPulse,
  oficio: Mail,
  memorando: Mail,
  ordem_servico: Wrench,
  relatorio_operacional: ClipboardList,
  licenca_ambiental: Leaf,
  apolice_seguro: ShieldCheck,
  laudo_tecnico: FlaskConical,
};

export function IconeTipo({ codigo, className }: { codigo: string; className?: string }) {
  const Icone = ICONE_TIPO[codigo] ?? FileText;
  return <Icone className={clsx("size-5", className)} aria-hidden />;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Escolha do tipo em cartões agrupados pela área (pasta padrão do tipo), com busca.
 * Depois de escolhido, vira um cartão compacto com "Trocar".
 */
export function SeletorTipo({
  tipos,
  categorias,
  valor,
  aoEscolher,
}: {
  tipos: TipoDocumento[];
  categorias: Categoria[];
  valor: string;
  aoEscolher: (tipoId: string) => void;
}) {
  const [aberto, setAberto] = useState(!valor);
  const [busca, setBusca] = useState("");
  const atual = tipos.find((t) => t.id === valor);

  const grupos = useMemo(() => {
    const raizDe = new Map<string, string>();
    const visitar = (lista: Categoria[], raiz?: string) =>
      lista.forEach((c) => {
        raizDe.set(c.id, raiz ?? c.nome);
        visitar(c.filhos ?? [], raiz ?? c.nome);
      });
    visitar(categorias);
    const termo = semAcento(busca.trim());
    const mapa = new Map<string, TipoDocumento[]>();
    for (const t of tipos) {
      if (termo && !semAcento(`${t.nome} ${t.descricao ?? ""}`).includes(termo)) continue;
      const area = (t.categoria_padrao_id && raizDe.get(t.categoria_padrao_id)) || "Outros";
      mapa.set(area, [...(mapa.get(area) ?? []), t]);
    }
    return [...mapa.entries()].sort(([a], [b]) => (a === "Outros" ? 1 : b === "Outros" ? -1 : a.localeCompare(b)));
  }, [tipos, categorias, busca]);

  if (atual && !aberto) {
    return (
      <motion.div layout className="flex items-center gap-3 rounded-xl border border-primary/30 bg-success-faint p-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary-dark text-white">
          <IconeTipo codigo={atual.codigo} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-ink-muted">Tipo de documento</span>
          <span className="block truncate font-semibold">{atual.nome}</span>
        </span>
        <button type="button" onClick={() => setAberto(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-paper">
          Trocar tipo
        </button>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          autoFocus={!valor}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar tipo — ex.: contrato, licença, nota fiscal"
          aria-label="Buscar tipo de documento"
          className="campo pl-10"
        />
      </div>
      <div className="rolagem-fina max-h-[26rem] space-y-4 overflow-y-auto pr-1" role="radiogroup" aria-label="Tipo de documento">
        <AnimatePresence initial={false}>
          {grupos.map(([area, lista]) => (
            <motion.div key={area} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">{area}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((t) => {
                  const ativo = t.id === valor;
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        aoEscolher(t.id);
                        setAberto(false);
                        setBusca("");
                      }}
                      className={clsx(
                        "group flex items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow]",
                        ativo ? "border-primary-dark bg-success-soft shadow-sm" : "border-line-soft bg-white hover:border-primary/50 hover:shadow-[var(--shadow-card)]",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          ativo ? "bg-primary-dark text-white" : "bg-surface-2 text-primary-dark group-hover:bg-success-soft",
                        )}
                      >
                        <IconeTipo codigo={t.codigo} className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{t.nome}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {t.campos.length ? `${t.campos.length} campos próprios` : "Sem campos próprios"}
                          {t.exige_validade && " · com validade"}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {grupos.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Nenhum tipo encontrado para “{busca}”.</p>}
      </div>
    </div>
  );
}
