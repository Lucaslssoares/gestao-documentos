import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { chaves, useTags } from "../../lib/consultas";
import type { Tag } from "../../lib/tipos";

/** Seleção múltipla de tags, com criação de novas na hora. */
export function SeletorTags({ selecionadas, aoMudar }: { selecionadas: string[]; aoMudar: (ids: string[]) => void }) {
  const tags = useTags();
  const queryClient = useQueryClient();
  const [nova, setNova] = useState("");
  const [criando, setCriando] = useState(false);

  function alternar(id: string) {
    aoMudar(selecionadas.includes(id) ? selecionadas.filter((t) => t !== id) : [...selecionadas, id]);
  }

  async function criar() {
    const nome = nova.trim();
    if (!nome) return;
    setCriando(true);
    try {
      const tag = await api<Tag>("/tags", { method: "POST", json: { nome } });
      await queryClient.invalidateQueries({ queryKey: chaves.tags });
      if (!selecionadas.includes(tag.id)) aoMudar([...selecionadas, tag.id]);
      setNova("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a tag.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.data?.map((t) => {
          const ativa = selecionadas.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={ativa}
              onClick={() => alternar(t.id)}
              className={clsx(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                ativa ? "border-primary-dark bg-primary-dark text-white" : "border-line bg-paper text-ink hover:bg-surface-2",
              )}
            >
              {t.nome}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={nova}
          maxLength={40}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void criar();
            }
          }}
          placeholder="Nova tag..."
          aria-label="Nome da nova tag"
          className="campo h-9 max-w-56 py-1 text-sm"
        />
        <button
          type="button"
          onClick={criar}
          disabled={!nova.trim() || criando}
          className="inline-flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary-dark hover:bg-surface-2 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Adicionar
        </button>
      </div>
    </div>
  );
}
