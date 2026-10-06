import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { chaves } from "../../lib/consultas";
import { ROTULO_TIPO_EMPRESA } from "../../lib/textos";
import type { Empresa, TipoEmpresa } from "../../lib/tipos";
import { Botao } from "../ui/Botao";
import { Campo, MensagemErro } from "../ui/Basicos";
import { Modal } from "../ui/Modal";

/** Cadastro rápido de empresa (usado no formulário de documento e nos cadastros). */
export function NovaEmpresaModal({
  aberto,
  aoFechar,
  aoCriar,
  tipoPadrao = "fornecedor",
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar?: (empresa: Empresa) => void;
  tipoPadrao?: TipoEmpresa;
}) {
  const queryClient = useQueryClient();
  const [dados, setDados] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", tipo: tipoPadrao, email: "" });
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const empresa = await api<Empresa>("/empresas", { method: "POST", json: dados });
      await queryClient.invalidateQueries({ queryKey: chaves.empresas });
      toast.success("Empresa cadastrada.");
      aoCriar?.(empresa);
      setDados({ razao_social: "", nome_fantasia: "", cnpj: "", tipo: tipoPadrao, email: "" });
      aoFechar();
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova empresa"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form="form-nova-empresa" carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="form-nova-empresa" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Razão social" htmlFor="emp-razao" obrigatorio className="sm:col-span-2">
          <input id="emp-razao" required className="campo" value={dados.razao_social} onChange={(e) => setDados({ ...dados, razao_social: e.target.value })} />
        </Campo>
        <Campo rotulo="Nome fantasia" htmlFor="emp-fantasia">
          <input id="emp-fantasia" className="campo" value={dados.nome_fantasia} onChange={(e) => setDados({ ...dados, nome_fantasia: e.target.value })} />
        </Campo>
        <Campo rotulo="CNPJ" htmlFor="emp-cnpj">
          <input id="emp-cnpj" inputMode="numeric" className="campo" value={dados.cnpj} onChange={(e) => setDados({ ...dados, cnpj: e.target.value })} />
        </Campo>
        <Campo rotulo="Tipo" htmlFor="emp-tipo">
          <select id="emp-tipo" className="campo" value={dados.tipo} onChange={(e) => setDados({ ...dados, tipo: e.target.value as TipoEmpresa })}>
            {Object.entries(ROTULO_TIPO_EMPRESA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="E-mail" htmlFor="emp-email">
          <input id="emp-email" type="email" className="campo" value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
        </Campo>
        {erro !== null && (
          <div className="sm:col-span-2">
            <MensagemErro erro={erro} />
          </div>
        )}
      </form>
    </Modal>
  );
}
