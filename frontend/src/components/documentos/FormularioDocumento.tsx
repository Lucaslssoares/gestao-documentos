import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Plus, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import { achatarCategorias, chaves, useCategorias, useEmpresas, useEquipe, useSetores, useTipos } from "../../lib/consultas";
import { formatarTamanho } from "../../lib/format";
import type { DocumentoDetalhe } from "../../lib/tipos";
import { Botao } from "../ui/Botao";
import { Campo, Carregando, MensagemErro } from "../ui/Basicos";
import { AreaUpload } from "./AreaUpload";
import { CamposPersonalizados } from "./CamposPersonalizados";
import { IconeArquivo } from "./Indicadores";
import { NovaEmpresaModal } from "./NovaEmpresaModal";
import { SeletorTags } from "./SeletorTags";

/** Etapas do cadastro: só as duas primeiras são obrigatórias. */
const ETAPAS = [
  { titulo: "Arquivo", descricao: "Escolha o arquivo" },
  { titulo: "Classificação", descricao: "Nome, tipo, pasta e datas" },
  { titulo: "Organização", descricao: "Opcional" },
] as const;

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
  const [etapa, setEtapa] = useState(0);
  const [alcancada, setAlcancada] = useState(0);
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

  function irPara(nova: number) {
    setErro(null);
    setEtapa(nova);
    setAlcancada((a) => Math.max(a, nova));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function escolherArquivo(a: File | null) {
    setArquivo(a);
    if (a && !dados.titulo) definir("titulo", a.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    // Escolheu o arquivo: segue direto para a classificação.
    if (a && !edicao) irPara(1);
  }

  // O botão que enviou o formulário diz se é para avançar de etapa ou salvar.
  // A validação nativa (required) já rodou nos campos da etapa visível.
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const acao = ((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset.acao;
    if (!edicao && acao === "avancar") {
      if (etapa === 0 && !arquivo) return setErro(new Error("Escolha o arquivo do documento para continuar."));
      return irPara(etapa + 1);
    }
    void salvar();
  }

  async function salvar() {
    setErro(null);
    if (!edicao && !arquivo) {
      setEtapa(0);
      return setErro(new Error("Selecione o arquivo do documento."));
    }
    if (!dados.titulo.trim() || !dados.tipo_id || !dados.categoria_id) {
      setEtapa(1);
      return setErro(new Error("Preencha nome, tipo e pasta do documento."));
    }
    if (tipo?.exige_validade && !dados.data_validade) {
      if (!edicao) setEtapa(1);
      return setErro(new Error(`O tipo "${tipo.nome}" exige a data de validade.`));
    }

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

  const secaoArquivo = (
    <section className="cartao p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Qual arquivo você quer guardar?</h2>
      <p className="mb-4 text-sm text-ink-muted">Ao escolher, você segue direto para a classificação.</p>
      <AreaUpload arquivo={arquivo} aoEscolher={escolherArquivo} />
    </section>
  );

  const resumoArquivo = arquivo && (
    <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-success-faint px-3 py-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-paper text-primary-dark">
        <IconeArquivo mime={arquivo.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{arquivo.name}</span>
        <span className="block text-xs text-ink-muted">{formatarTamanho(arquivo.size)}</span>
      </span>
      <button type="button" onClick={() => irPara(0)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-dark hover:bg-paper">
        Trocar
      </button>
    </div>
  );

  const secaoIdentificacao = (
    <section className="cartao grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="font-semibold sm:col-span-2">Identificação</h2>
      <Campo rotulo="Nome do documento" htmlFor="titulo" obrigatorio className="sm:col-span-2">
        <input id="titulo" required maxLength={300} className="campo" value={dados.titulo} onChange={(e) => definir("titulo", e.target.value)} />
      </Campo>
      <Campo rotulo="Tipo de documento" htmlFor="tipo" obrigatorio ajuda="O tipo sugere a pasta e mostra os campos próprios dele.">
        <select id="tipo" required className="campo" value={dados.tipo_id} onChange={(e) => trocarTipo(e.target.value)}>
          <option value="">Selecione...</option>
          {tipos.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Pasta" htmlFor="categoria" obrigatorio ajuda={opcoesCategoria.length === 0 ? "Você não tem permissão de cadastro em nenhuma pasta." : undefined}>
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
  );

  const secaoCampos = tipo && tipo.campos.length > 0 && (
    <section className="cartao p-4 sm:p-6">
      <h2 className="mb-3 font-semibold">Dados do {tipo.nome.toLowerCase()}</h2>
      <CamposPersonalizados campos={tipo.campos} valores={dados.metadados} aoMudar={(chave, valor) => definir("metadados", { ...dados.metadados, [chave]: valor })} />
    </section>
  );

  const secaoDatas = (
    <section className="cartao grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
      <h2 className="font-semibold sm:col-span-3">Datas{edicao && " e situação"}</h2>
      <Campo rotulo="Data do documento" htmlFor="data-documento">
        <input id="data-documento" type="date" className="campo" value={dados.data_documento} onChange={(e) => definir("data_documento", e.target.value)} />
      </Campo>
      <Campo rotulo="Validade / vencimento" htmlFor="data-validade" obrigatorio={tipo?.exige_validade} ajuda="Usada nos alertas de vencimento.">
        <input
          id="data-validade"
          type="date"
          required={tipo?.exige_validade}
          className="campo"
          value={dados.data_validade}
          onChange={(e) => definir("data_validade", e.target.value)}
        />
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
  );

  const secaoOrganizacao = (
    <section className="cartao grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
      <div className="sm:col-span-2">
        <h2 className="font-semibold">Organização</h2>
        {!edicao && <p className="text-sm text-ink-muted">Tudo aqui é opcional, mas ajuda a encontrar o documento depois.</p>}
      </div>
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
  );

  const modal = <NovaEmpresaModal aberto={novaEmpresa} aoFechar={() => setNovaEmpresa(false)} aoCriar={(e) => definir("contraparte_id", e.id)} />;

  if (edicao) {
    return (
      <form onSubmit={aoEnviar} className="space-y-5">
        {erro !== null && <MensagemErro erro={erro} />}
        {secaoIdentificacao}
        {secaoCampos}
        {secaoDatas}
        {secaoOrganizacao}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => navigate(-1)}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando}>
            Salvar alterações
          </Botao>
        </div>
        {modal}
      </form>
    );
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-5">
      <Etapas atual={etapa} alcancada={alcancada} aoIr={irPara} />
      {erro !== null && <MensagemErro erro={erro} />}

      {etapa === 0 && secaoArquivo}
      {etapa === 1 && (
        <>
          {resumoArquivo}
          {secaoIdentificacao}
          {secaoCampos}
          {secaoDatas}
        </>
      )}
      {etapa === 2 && (
        <>
          {resumoArquivo}
          {secaoOrganizacao}
        </>
      )}

      {/* "Enviar" vem antes no HTML para ser o botão do Enter; a ordem visual é ajustada com CSS. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Botao variante="fantasma" icone={ArrowLeft} onClick={() => (etapa === 0 ? navigate(-1) : irPara(etapa - 1))} className="sm:mr-auto">
          {etapa === 0 ? "Cancelar" : "Voltar"}
        </Botao>
        {etapa === 0 && (
          <Botao type="submit" data-acao="avancar" disabled={!arquivo}>
            Continuar <ArrowRight className="size-4" aria-hidden />
          </Botao>
        )}
        {etapa >= 1 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao type="submit" icone={Send} carregando={salvando} className="sm:order-2">
              Enviar documento
            </Botao>
            {etapa === 1 && (
              <Botao type="submit" variante="secundario" data-acao="avancar" className="sm:order-1">
                Mais detalhes <span className="font-normal text-ink-muted">(opcional)</span>
              </Botao>
            )}
          </div>
        )}
      </div>
      {modal}
    </form>
  );
}

/** Indicador de etapas: clicável só para voltar às etapas já visitadas. */
function Etapas({ atual, alcancada, aoIr }: { atual: number; alcancada: number; aoIr: (etapa: number) => void }) {
  return (
    <ol className="cartao flex items-center gap-2 p-3 sm:gap-3 sm:p-4" aria-label="Etapas do cadastro">
      {ETAPAS.map((e, i) => {
        const feita = i < atual;
        const ativa = i === atual;
        const clicavel = i <= alcancada && !ativa;
        return (
          <li key={e.titulo} className={clsx("flex min-w-0 items-center gap-2 sm:gap-3", i < ETAPAS.length - 1 && "flex-1")}>
            <button
              type="button"
              disabled={!clicavel}
              onClick={() => aoIr(i)}
              aria-current={ativa ? "step" : undefined}
              className="flex min-w-0 items-center gap-2.5 rounded-lg text-left disabled:cursor-default"
            >
              <span
                className={clsx(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  feita && "bg-primary-dark text-white",
                  ativa && "bg-success-soft text-primary-dark ring-2 ring-primary",
                  !feita && !ativa && "bg-surface-2 text-ink-muted",
                )}
              >
                {feita ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={clsx("min-w-0", !ativa && "hidden sm:block")}>
                <span className={clsx("block truncate text-sm font-semibold", ativa ? "text-ink" : "text-ink-muted")}>{e.titulo}</span>
                <span className="block truncate text-xs text-ink-muted">{e.descricao}</span>
              </span>
            </button>
            {i < ETAPAS.length - 1 && <span className={clsx("h-0.5 min-w-4 flex-1 rounded-full", feita ? "bg-primary" : "bg-line-soft")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
