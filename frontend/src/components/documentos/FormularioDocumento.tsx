import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import { achatarCategorias, chaves, useCategorias, useEmpresas, useEquipe, useSetores, useTipos } from "../../lib/consultas";
import type { DocumentoDetalhe } from "../../lib/tipos";
import { Botao } from "../ui/Botao";
import { Campo, Carregando, MensagemErro } from "../ui/Basicos";
import { AreaUpload } from "./AreaUpload";
import { CamposPersonalizados } from "./CamposPersonalizados";
import { NovaEmpresaModal } from "./NovaEmpresaModal";
import { SeletorTags } from "./SeletorTags";

interface Dados {
  titulo: string;
  descricao: string;
  tipo_id: string;
  categoria_id: string;
  empresa_id: string;
  filial_id: string;
  setor_id: string;
  contraparte_id: string;
  responsavel_id: string;
  data_documento: string;
  data_validade: string;
  status: "ativo" | "arquivado" | "cancelado";
  metadados: Record<string, unknown>;
  tags: string[];
}

/** Formulário de cadastro (com arquivo) e de edição de um documento. */
export function FormularioDocumento({ documento, categoriaInicial }: { documento?: DocumentoDetalhe; categoriaInicial?: string | null }) {
  const edicao = Boolean(documento);
  const { perfil, podeEditarRaiz } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const categorias = useCategorias();
  const tipos = useTipos();
  const empresas = useEmpresas();
  const setores = useSetores();
  const equipe = useEquipe();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [novaEmpresa, setNovaEmpresa] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState<Dados>(() => ({
    titulo: documento?.titulo ?? "",
    descricao: documento?.descricao ?? "",
    tipo_id: documento?.tipo_id ?? "",
    categoria_id: documento?.categoria_id ?? categoriaInicial ?? "",
    empresa_id: documento?.empresa_id ?? "",
    filial_id: documento?.filial_id ?? "",
    setor_id: documento?.setor_id ?? perfil?.setor_id ?? "",
    contraparte_id: documento?.contraparte_id ?? "",
    responsavel_id: documento?.responsavel_id ?? perfil?.id ?? "",
    data_documento: documento?.data_documento ?? "",
    data_validade: documento?.data_validade ?? "",
    status: documento?.status ?? "ativo",
    metadados: documento?.metadados ?? {},
    tags: documento?.tags.map((t) => t.id) ?? [],
  }));
  const definir = <K extends keyof Dados>(campo: K, valor: Dados[K]) => setDados((d) => ({ ...d, [campo]: valor }));

  // Só categorias em que o usuário pode cadastrar.
  const opcoesCategoria = useMemo(
    () => achatarCategorias(categorias.data ?? []).filter((c) => podeEditarRaiz(c.raiz_id) && c.ativo),
    [categorias.data, podeEditarRaiz],
  );
  const empresasGrupo = empresas.data?.filter((e) => e.tipo === "grupo") ?? [];
  const contrapartes = empresas.data?.filter((e) => e.tipo !== "grupo") ?? [];
  const empresaSelecionada = empresas.data?.find((e) => e.id === dados.empresa_id);
  const tipo = tipos.data?.find((t) => t.id === dados.tipo_id);

  // Empresa do grupo padrão quando há só uma.
  if (!edicao && !dados.empresa_id && empresasGrupo.length === 1) definir("empresa_id", empresasGrupo[0]!.id);

  function trocarTipo(tipoId: string) {
    const novo = tipos.data?.find((t) => t.id === tipoId);
    setDados((d) => {
      const chaves = new Set(novo?.campos.map((c) => c.chave));
      const metadados = Object.fromEntries(Object.entries(d.metadados).filter(([k]) => chaves.has(k)));
      const sugerida = novo?.categoria_padrao_id && opcoesCategoria.some((c) => c.id === novo.categoria_padrao_id) ? novo.categoria_padrao_id : null;
      return { ...d, tipo_id: tipoId, metadados, categoria_id: d.categoria_id || sugerida || "" };
    });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!edicao && !arquivo) return setErro(new Error("Selecione o arquivo do documento."));
    if (tipo?.exige_validade && !dados.data_validade) return setErro(new Error(`O tipo "${tipo.nome}" exige a data de validade.`));

    const campos = {
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      tipo_id: dados.tipo_id,
      categoria_id: dados.categoria_id,
      empresa_id: dados.empresa_id,
      filial_id: dados.filial_id,
      setor_id: dados.setor_id,
      contraparte_id: dados.contraparte_id,
      responsavel_id: dados.responsavel_id,
      data_documento: dados.data_documento,
      data_validade: dados.data_validade,
    };

    setSalvando(true);
    try {
      let id = documento?.id;
      if (documento) {
        await api(`/documentos/${documento.id}`, {
          method: "PATCH",
          json: { ...campos, status: dados.status, metadados: dados.metadados, tags: dados.tags },
        });
        toast.success("Documento atualizado.");
      } else {
        const form = new FormData();
        form.append("arquivo", arquivo!);
        for (const [chave, valor] of Object.entries(campos)) form.append(chave, valor);
        form.append("metadados", JSON.stringify(dados.metadados));
        form.append("tags", JSON.stringify(dados.tags));
        const criado = await api<{ id: string }>("/documentos", { method: "POST", body: form });
        id = criado.id;
        toast.success("Documento enviado. O texto será indexado em instantes.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chaves.documentos }),
        queryClient.invalidateQueries({ queryKey: chaves.painel }),
        queryClient.invalidateQueries({ queryKey: chaves.categorias }),
        id ? queryClient.invalidateQueries({ queryKey: chaves.documento(id) }) : null,
      ]);
      navigate(`/documentos/${id}`, { replace: edicao });
    } catch (err) {
      setErro(err);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSalvando(false);
    }
  }

  if (categorias.isLoading || tipos.isLoading) return <Carregando />;

  return (
    <form onSubmit={salvar} className="space-y-5">
      {erro !== null && <MensagemErro erro={erro} />}

      {!edicao && (
        <section className="cartao p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Arquivo</h2>
          <AreaUpload
            arquivo={arquivo}
            aoEscolher={(a) => {
              setArquivo(a);
              if (a && !dados.titulo) definir("titulo", a.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
            }}
          />
        </section>
      )}

      <section className="cartao grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="font-semibold sm:col-span-2">Identificação</h2>
        <Campo rotulo="Nome do documento" htmlFor="titulo" obrigatorio className="sm:col-span-2">
          <input id="titulo" required maxLength={300} className="campo" value={dados.titulo} onChange={(e) => definir("titulo", e.target.value)} />
        </Campo>
        <Campo rotulo="Tipo de documento" htmlFor="tipo" obrigatorio>
          <select id="tipo" required className="campo" value={dados.tipo_id} onChange={(e) => trocarTipo(e.target.value)}>
            <option value="">Selecione...</option>
            {tipos.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Categoria / pasta" htmlFor="categoria" obrigatorio ajuda={opcoesCategoria.length === 0 ? "Você não tem permissão de cadastro em nenhuma categoria." : undefined}>
          <select id="categoria" required className="campo" value={dados.categoria_id} onChange={(e) => definir("categoria_id", e.target.value)}>
            <option value="">Selecione...</option>
            {opcoesCategoria.map((c) => (
              <option key={c.id} value={c.id}>
                {String.fromCharCode(160).repeat(2 * (c.nivel - 1))}
                {c.nivel === 1 ? c.nome : `› ${c.nome}`}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Descrição" htmlFor="descricao" className="sm:col-span-2">
          <textarea id="descricao" rows={2} maxLength={5000} className="campo" value={dados.descricao} onChange={(e) => definir("descricao", e.target.value)} />
        </Campo>
      </section>

      {tipo && tipo.campos.length > 0 && (
        <section className="cartao p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Dados do {tipo.nome.toLowerCase()}</h2>
          <CamposPersonalizados campos={tipo.campos} valores={dados.metadados} aoMudar={(chave, valor) => definir("metadados", { ...dados.metadados, [chave]: valor })} />
        </section>
      )}

      <section className="cartao grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="font-semibold sm:col-span-2">Organização</h2>
        <Campo rotulo="Empresa" htmlFor="empresa">
          <select id="empresa" className="campo" value={dados.empresa_id} onChange={(e) => setDados((d) => ({ ...d, empresa_id: e.target.value, filial_id: "" }))}>
            <option value="">—</option>
            {empresasGrupo.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome_fantasia ?? e.razao_social}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Filial" htmlFor="filial">
          <select id="filial" className="campo" value={dados.filial_id} disabled={!empresaSelecionada?.filiais.length} onChange={(e) => definir("filial_id", e.target.value)}>
            <option value="">—</option>
            {empresaSelecionada?.filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Setor responsável" htmlFor="setor">
          <select id="setor" className="campo" value={dados.setor_id} onChange={(e) => definir("setor_id", e.target.value)}>
            <option value="">—</option>
            {setores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Responsável" htmlFor="responsavel">
          <select id="responsavel" className="campo" value={dados.responsavel_id} onChange={(e) => definir("responsavel_id", e.target.value)}>
            <option value="">—</option>
            {equipe.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Contraparte (fornecedor, cliente...)" htmlFor="contraparte" className="sm:col-span-2">
          <div className="flex gap-2">
            <select id="contraparte" className="campo" value={dados.contraparte_id} onChange={(e) => definir("contraparte_id", e.target.value)}>
              <option value="">—</option>
              {contrapartes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome_fantasia ? `${e.nome_fantasia} (${e.razao_social})` : e.razao_social}
                </option>
              ))}
            </select>
            <Botao variante="secundario" icone={Plus} onClick={() => setNovaEmpresa(true)}>
              <span className="sr-only sm:not-sr-only">Nova</span>
            </Botao>
          </div>
        </Campo>
        <Campo rotulo="Tags" className="sm:col-span-2">
          <SeletorTags selecionadas={dados.tags} aoMudar={(tags) => definir("tags", tags)} />
        </Campo>
      </section>

      <section className="cartao grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <h2 className="font-semibold sm:col-span-3">Datas e situação</h2>
        <Campo rotulo="Data do documento" htmlFor="data-documento">
          <input id="data-documento" type="date" className="campo" value={dados.data_documento} onChange={(e) => definir("data_documento", e.target.value)} />
        </Campo>
        <Campo rotulo="Validade / vencimento" htmlFor="data-validade" obrigatorio={tipo?.exige_validade} ajuda="Usada nos alertas de vencimento.">
          <input id="data-validade" type="date" className="campo" value={dados.data_validade} onChange={(e) => definir("data_validade", e.target.value)} />
        </Campo>
        {edicao && (
          <Campo rotulo="Status" htmlFor="status">
            <select id="status" className="campo" value={dados.status} onChange={(e) => definir("status", e.target.value as Dados["status"])}>
              <option value="ativo">Ativo</option>
              <option value="arquivado">Arquivado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Campo>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => navigate(-1)}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={salvando}>
          {edicao ? "Salvar alterações" : "Enviar documento"}
        </Botao>
      </div>

      <NovaEmpresaModal aberto={novaEmpresa} aoFechar={() => setNovaEmpresa(false)} aoCriar={(e) => definir("contraparte_id", e.id)} />
    </form>
  );
}
