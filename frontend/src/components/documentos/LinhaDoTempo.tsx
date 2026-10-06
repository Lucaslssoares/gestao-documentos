import {
  ArrowRightLeft,
  Download,
  Eye,
  FilePlus2,
  FileX2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { formatarDataHora } from "../../lib/format";
import { detalheEvento } from "../../lib/textos";
import type { EventoHistorico } from "../../lib/tipos";

const ACOES: Record<string, { rotulo: string; icone: LucideIcon }> = {
  criar: { rotulo: "enviou o documento", icone: FilePlus2 },
  atualizar: { rotulo: "alterou informações", icone: Pencil },
  mover: { rotulo: "moveu de categoria", icone: ArrowRightLeft },
  substituir_arquivo: { rotulo: "substituiu o arquivo", icone: RefreshCw },
  adicionar_tag: { rotulo: "adicionou a tag", icone: Tag },
  remover_tag: { rotulo: "removeu a tag", icone: Tag },
  excluir: { rotulo: "enviou para a lixeira", icone: Trash2 },
  restaurar: { rotulo: "restaurou da lixeira", icone: RotateCcw },
  excluir_definitivo: { rotulo: "excluiu definitivamente", icone: FileX2 },
  visualizar: { rotulo: "visualizou", icone: Eye },
  baixar: { rotulo: "baixou o arquivo", icone: Download },
};

export function LinhaDoTempo({ eventos }: { eventos: EventoHistorico[] }) {
  if (eventos.length === 0) return <p className="py-6 text-center text-sm text-ink-muted">Nenhum registro ainda.</p>;
  return (
    <ol className="relative ml-3 border-l border-line-soft">
      {eventos.map((evento) => {
        const acao = ACOES[evento.acao] ?? { rotulo: evento.acao, icone: Pencil };
        const detalhe = detalheEvento(evento);
        return (
          <li key={evento.id} className="mb-4 ml-5 last:mb-0">
            <span className="absolute -left-3 flex size-6 items-center justify-center rounded-full border border-line-soft bg-paper text-primary-dark">
              <acao.icone className="size-3.5" aria-hidden />
            </span>
            <p className="text-sm">
              <span className="font-semibold">{evento.ator_nome}</span> {acao.rotulo}
              {detalhe && <span className="text-ink-muted"> — {detalhe}</span>}
            </p>
            <p className="text-xs text-ink-muted">{formatarDataHora(evento.criado_em)}</p>
          </li>
        );
      })}
    </ol>
  );
}
