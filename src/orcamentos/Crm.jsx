import React, { useMemo, useState } from "react";
import {
  Users, Search, Phone, Mail, MapPin, Plus, Check, X, Clock, AlertTriangle,
  FileText, Wrench, MessageCircle, CalendarClock, Trash2, Building2, Package, ChevronRight,
} from "lucide-react";
import {
  FUNCOES, MEIOS, MOTIVOS, TIPOS, agruparRetornos, clientesParecidos, contatoPrincipal,
  contatosDoCliente, ehColetivo, fichaDoCliente, linkWhatsApp, nomeDoTipo, procurar,
  proximoRetorno, situacaoDoRetorno, tipoDoCliente,
} from "./crm.js";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const ROTULO_ORC = {
  agendado: "Visita agendada", a_enviar: "Montar orçamento", enviado: "Aguardando cliente",
  aprovado: "Aprovado", recusado: "Recusado",
};
const ROTULO_OS = { agendada: "Agendada", concluida: "Concluída", cancelada: "Cancelada" };

/* ===== cadastro ===== */

function Cadastro({ inicial, clientes, onSalvar, onFechar, onToast }) {
  const [c, setC] = useState(() => ({
    id: inicial?.id || uid(),
    tipo: inicial?.tipo || "pf",
    nome: inicial?.nome || "",
    telefone: inicial?.telefone || "",
    email: inicial?.email || "",
    endereco: inicial?.endereco || "",
    bairro: inicial?.bairro || "",
    documento: inicial?.documento || "",
    observacoes: inicial?.observacoes || "",
    contatos: contatosDoCliente(inicial || {}),
    anotacoes: inicial?.anotacoes || [],
    interacoes: inicial?.interacoes || [],
    origem: inicial?.origem || "",
    criadoEm: inicial?.criadoEm || new Date().toISOString().slice(0, 10),
  }));
  const [erro, setErro] = useState("");
  const novo = !inicial;
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const coletivo = ehColetivo(c);

  const parecidos = useMemo(() => clientesParecidos(c, clientes), [c, clientes]);

  const setContato = (i, campos) =>
    setC((p) => ({ ...p, contatos: p.contatos.map((x, j) => (j === i ? { ...x, ...campos } : x)) }));
  const marcarPrincipal = (i) =>
    setC((p) => ({ ...p, contatos: p.contatos.map((x, j) => ({ ...x, principal: j === i })) }));
  const addContato = () =>
    setC((p) => ({ ...p, contatos: [...p.contatos, { id: uid(), nome: "", funcao: "", telefone: "", email: "", principal: !p.contatos.length }] }));
  const delContato = (i) =>
    setC((p) => {
      const lista = p.contatos.filter((_, j) => j !== i);
      return { ...p, contatos: lista.length && !lista.some((x) => x.principal) ? lista.map((x, j) => ({ ...x, principal: j === 0 })) : lista };
    });

  const salvar = () => {
    if (!c.nome.trim()) { setErro("O nome é obrigatório."); return; }
    const principal = c.contatos.find((x) => x.principal) || c.contatos[0];
    onSalvar({
      ...c, nome: c.nome.trim(),
      // Mantém telefone e e-mail soltos em dia: o resto do app lê desses campos.
      telefone: principal?.telefone || c.telefone,
      email: principal?.email || c.email,
    });
  };

  return (
    <div className="crm-sheet">
      <header>
        <b>{novo ? "Novo cliente" : c.nome}</b>
        <button onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
      </header>
      <div className="crm-sheet-corpo">
        <div className="crm-tipos">
          {TIPOS.map((t) => (
            <button key={t.id} className={c.tipo === t.id ? "on" : ""} onClick={() => set("tipo", t.id)}>
              {t.nome}
            </button>
          ))}
        </div>

        <label><span>{coletivo ? "Nome do condomínio ou empresa *" : "Nome *"}</span>
          <input value={c.nome} autoFocus={novo} onChange={(e) => { set("nome", e.target.value); setErro(""); }}
            placeholder={coletivo ? "Ex.: Condomínio Solar das Mangueiras" : "Ex.: Maria Silva"} /></label>
        {erro && <span className="crm-erro">{erro}</span>}

        {parecidos.length > 0 && (
          <div className="crm-dup">
            <AlertTriangle size={14} />
            <span>
              Já existe cadastro com {parecidos[0].porTelefone ? "esse telefone" : "esse e-mail"}:{" "}
              <b>{parecidos.map((p) => p.cliente.nome).join(", ")}</b>. Dá para salvar assim mesmo,
              mas confira se não é o mesmo cliente.
            </span>
          </div>
        )}

        <div className="crm-linha2">
          <label><span>Endereço</span>
            <input value={c.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua e número" /></label>
          <label><span>Bairro</span>
            <input value={c.bairro} onChange={(e) => set("bairro", e.target.value)} /></label>
        </div>
        <label><span>CPF / CNPJ</span>
          <input value={c.documento} onChange={(e) => set("documento", e.target.value)} placeholder="opcional" /></label>

        <div className="crm-contatos-ed">
          <div className="crm-bloco-topo">
            <h4>{coletivo ? "Quem fala pelo condomínio" : "Contato"}</h4>
            <button className="crm-link" onClick={addContato}><Plus size={13} /> Adicionar</button>
          </div>
          {c.contatos.length === 0 && (
            <p className="crm-dim">
              {coletivo
                ? "Cadastre o síndico, o zelador e quem mais atende. Dá para marcar quem é o principal."
                : "Adicione ao menos o telefone."}
            </p>
          )}
          {c.contatos.map((k, i) => (
            <div key={k.id || i} className={"crm-contato" + (k.principal ? " principal" : "")}>
              <div className="crm-linha2">
                <input value={k.nome} placeholder="Nome" onChange={(e) => setContato(i, { nome: e.target.value })} />
                {coletivo ? (
                  <select value={k.funcao || ""} onChange={(e) => setContato(i, { funcao: e.target.value })}>
                    <option value="">Função…</option>
                    {FUNCOES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <input value={k.funcao || ""} placeholder="Observação" onChange={(e) => setContato(i, { funcao: e.target.value })} />
                )}
              </div>
              <div className="crm-linha2">
                <input value={k.telefone} placeholder="(31) 00000-0000" inputMode="tel"
                  onChange={(e) => setContato(i, { telefone: e.target.value })} />
                <input value={k.email || ""} placeholder="e-mail" inputMode="email"
                  onChange={(e) => setContato(i, { email: e.target.value })} />
              </div>
              <div className="crm-contato-pe">
                <label className="crm-check">
                  <input type="radio" checked={!!k.principal} onChange={() => marcarPrincipal(i)} />
                  <span>Contato principal</span>
                </label>
                <button onClick={() => delContato(i)} aria-label="Remover"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>

        <label><span>Observações</span>
          <textarea rows={2} value={c.observacoes} onChange={(e) => set("observacoes", e.target.value)}
            placeholder="Como entrar, horário que atende, cuidado com cachorro…" /></label>
      </div>
      <footer>
        <button className="crm-btn" onClick={salvar}><Check size={15} /> Salvar</button>
      </footer>
    </div>
  );
}

/* ===== retorno ===== */

function NovoRetorno({ cliente, atendimentos, quemSou, onSalvar, onFechar }) {
  const [r, setR] = useState({
    data: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    motivo: MOTIVOS[0], detalhe: "", responsavel: quemSou || "", orcamentoId: "",
  });
  const set = (k, v) => setR((p) => ({ ...p, [k]: v }));
  return (
    <div className="crm-sheet">
      <header><b>Agendar retorno</b><button onClick={onFechar}><X size={18} /></button></header>
      <div className="crm-sheet-corpo">
        <p className="crm-dim">Para {cliente.nome}.</p>
        <div className="crm-linha2">
          <label><span>Quando</span>
            <input type="date" value={r.data} onChange={(e) => set("data", e.target.value)} /></label>
          <label><span>Quem faz</span>
            <input value={r.responsavel} onChange={(e) => set("responsavel", e.target.value)} /></label>
        </div>
        <label><span>Motivo</span>
          <select value={r.motivo} onChange={(e) => set("motivo", e.target.value)}>
            {MOTIVOS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select></label>
        <label><span>Detalhe</span>
          <input value={r.detalhe} onChange={(e) => set("detalhe", e.target.value)}
            placeholder="Ex.: cobrar resposta do orçamento do portão" /></label>
        {atendimentos.length > 0 && (
          <label><span>Ligado a qual orçamento (opcional)</span>
            <select value={r.orcamentoId} onChange={(e) => set("orcamentoId", e.target.value)}>
              <option value="">Nenhum</option>
              {atendimentos.map((a) => (
                <option key={a.orcamento.id} value={a.orcamento.id}>
                  Nº {a.orcamento.numero} — {a.orcamento.descricaoServico || "sem descrição"}
                </option>
              ))}
            </select></label>
        )}
      </div>
      <footer>
        <button className="crm-btn" disabled={!r.data}
          onClick={() => onSalvar({
            id: uid(), clienteId: cliente.id, cliente: cliente.nome, ...r,
            situacao: "aberto", criadoEm: new Date().toISOString(),
          })}>
          <Check size={15} /> Agendar
        </button>
      </footer>
    </div>
  );
}

/* ===== ficha ===== */

function Ficha({ cliente, dados, hoje, quemSou, onEditar, onRetorno, onInteracao, onConcluirRetorno, onAbrirOrc, onAbrirOs, onToast, onFechar }) {
  const [aba, setAba] = useState("atendimentos");
  const [interacao, setInteracao] = useState({ meio: "whatsapp", texto: "" });
  const f = dados;
  const contatos = contatosDoCliente(cliente);
  const principal = contatoPrincipal(cliente);
  const zap = linkWhatsApp(principal?.telefone, `Olá! Aqui é da Vigiar Sistemas.`);

  const registrar = () => {
    if (!interacao.texto.trim()) return;
    onInteracao(cliente, {
      id: uid(), em: new Date().toISOString(), meio: interacao.meio,
      texto: interacao.texto.trim(), por: quemSou || "",
    });
    setInteracao({ meio: interacao.meio, texto: "" });
  };

  return (
    <div className="crm-sheet larga">
      <header>
        <b>{cliente.nome}</b>
        <span className="crm-tipo">{nomeDoTipo(tipoDoCliente(cliente))}</span>
        <button onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
      </header>

      <div className="crm-sheet-corpo">
        <div className="crm-resumo">
          <div><b>{f.totais.orcamentos}</b><span>orçamentos</span></div>
          <div><b>{f.totais.concluidos}</b><span>serviços feitos</span></div>
          <div><b>{brl(f.totais.faturado)}</b><span>faturado</span></div>
          <div>
            <b className={f.diasSemContato > 90 ? "frio" : ""}>
              {f.diasSemContato == null ? "—" : `${f.diasSemContato}d`}
            </b>
            <span>sem contato</span>
          </div>
        </div>

        {f.proximoRetorno && (
          <div className={"crm-retorno-topo " + f.proximoRetorno.estado}>
            <Clock size={14} />
            <span>
              <b>{f.proximoRetorno.estado === "atrasado" ? "Retorno atrasado" : f.proximoRetorno.estado === "hoje" ? "Retorno hoje" : "Próximo retorno"}</b>
              {" "}{dia(f.proximoRetorno.data)} — {f.proximoRetorno.detalhe || f.proximoRetorno.motivo}
            </span>
            <button onClick={() => onConcluirRetorno(f.proximoRetorno)}>Concluir</button>
          </div>
        )}

        <div className="crm-acoes-topo">
          {zap && <a className="crm-btn zap" href={zap} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
          <button className="crm-btn fantasma" onClick={() => onRetorno(cliente)}><CalendarClock size={15} /> Agendar retorno</button>
          <button className="crm-btn fantasma" onClick={() => onEditar(cliente)}>Editar cadastro</button>
        </div>

        <nav className="crm-abas-ficha">
          {[["atendimentos", `Atendimentos (${f.atendimentos.length})`],
            ["contatos", `Contatos (${contatos.length})`],
            ["historico", `Histórico (${f.marcos.length})`],
            ["equipamentos", `Equipamentos (${f.equipamentos.length})`]].map(([id, nome]) => (
            <button key={id} className={aba === id ? "on" : ""} onClick={() => setAba(id)}>{nome}</button>
          ))}
        </nav>

        {aba === "atendimentos" && (
          f.atendimentos.length === 0 && f.avulsas.length === 0 ? (
            <p className="crm-dim">Nenhum atendimento ainda. Agende uma visita pela aba Orçamentos.</p>
          ) : (
            <div className="crm-atds">
              {f.atendimentos.map((a) => (
                <div key={a.orcamento.id} className="crm-atd">
                  <button className="crm-atd-topo" onClick={() => onAbrirOrc(a.orcamento)}>
                    <span className="crm-passo">{ROTULO_ORC[a.orcamento.status] || a.orcamento.status}</span>
                    <b>Nº {a.orcamento.numero}</b>
                    <em>{a.orcamento.descricaoServico || "sem descrição"}</em>
                    <ChevronRight size={14} />
                  </button>
                  <div className="crm-atd-linha">
                    <span><FileText size={12} /> Visita {dia(a.orcamento.dataVisita)}</span>
                    {a.proposta && (
                      <span className={a.proposta.enviadaEm ? "ok" : ""}>
                        Proposta {a.proposta.enviadaEm ? `enviada ${dia(a.proposta.enviadaEm)}` : "montada"}
                      </span>
                    )}
                    {a.ordens.map((s) => (
                      <button key={s.id} className="crm-chip" onClick={() => onAbrirOs(s)}>
                        <Wrench size={11} /> OS {s.numero} · {ROTULO_OS[s.status] || s.status}
                      </button>
                    ))}
                    {!!a.retornos.length && <span><Clock size={12} /> {a.retornos.length} retorno(s)</span>}
                  </div>
                </div>
              ))}
              {f.avulsas.map((s) => (
                <button key={s.id} className="crm-atd avulsa" onClick={() => onAbrirOs(s)}>
                  <span className="crm-passo">Serviço sem orçamento</span>
                  <b>OS Nº {s.numero}</b>
                  <em>{s.descricao || "—"} · {dia(s.dataServico)}</em>
                </button>
              ))}
            </div>
          )
        )}

        {aba === "contatos" && (
          contatos.length === 0 ? <p className="crm-dim">Sem contato cadastrado. Use Editar cadastro.</p> : (
            <ul className="crm-contatos">
              {contatos.map((k, i) => {
                const w = linkWhatsApp(k.telefone, "Olá! Aqui é da Vigiar Sistemas.");
                return (
                  <li key={k.id || i}>
                    <div>
                      <b>{k.nome || "sem nome"}{k.principal ? " · principal" : ""}</b>
                      {k.funcao && <em>{k.funcao}</em>}
                      {k.telefone && <span><Phone size={12} /> {k.telefone}</span>}
                      {k.email && <span><Mail size={12} /> {k.email}</span>}
                    </div>
                    {w && <a className="crm-btn zap pequeno" href={w} target="_blank" rel="noreferrer">
                      <MessageCircle size={13} /> WhatsApp
                    </a>}
                  </li>
                );
              })}
            </ul>
          )
        )}

        {aba === "historico" && (
          <>
            <div className="crm-registrar">
              <select value={interacao.meio} onChange={(e) => setInteracao((p) => ({ ...p, meio: e.target.value }))}>
                {MEIOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <input value={interacao.texto} placeholder="O que foi conversado?"
                onChange={(e) => setInteracao((p) => ({ ...p, texto: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && registrar()} />
              <button className="crm-btn" onClick={registrar} disabled={!interacao.texto.trim()}>
                <Plus size={14} /> Registrar
              </button>
            </div>
            {f.marcos.length === 0 ? <p className="crm-dim">Nada registrado ainda.</p> : (
              <ul className="crm-linha-tempo">
                {f.marcos.map((mk, i) => (
                  <li key={i} className={mk.o}>
                    <span className="crm-quando">{quando(mk.em)}</span>
                    <div>
                      {mk.o === "interacao" && (
                        <><b>{(MEIOS.find((x) => x.id === mk.dado.meio) || {}).nome || mk.dado.meio}</b> {mk.dado.texto}</>
                      )}
                      {mk.o === "anotacao" && <>{mk.dado.texto}</>}
                      {mk.o === "retorno" && (
                        <><b>Retorno concluído</b> {mk.dado.resultado || mk.dado.detalhe || mk.dado.motivo}</>
                      )}
                      {mk.dado.por && <em>{mk.dado.por}</em>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {aba === "equipamentos" && (
          f.equipamentos.length === 0 ? (
            <p className="crm-dim">
              Nada instalado ainda — a lista sai sozinha dos itens das ordens de serviço concluídas.
            </p>
          ) : (
            <ul className="crm-equip">
              {f.equipamentos.map((e, i) => (
                <li key={i}>
                  <Package size={14} />
                  <div>
                    <b>{e.qtd}x {e.nome}</b>
                    <em>Instalado em {dia(e.em)} · OS Nº {e.osNumero}</em>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

/* ===== painel ===== */

export default function Crm({ clientes = [], orcamentos = [], ordens = [], propostas = [], retornos = [],
  quemSou, onSalvarCliente, onSalvarRetorno, onAbrirOrc, onAbrirOs, onToast }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [aberta, setAberta] = useState(null);     // cliente da ficha
  const [editando, setEditando] = useState(null); // cliente em edição, ou {} para novo
  const [agendando, setAgendando] = useState(null);
  const [vendo, setVendo] = useState("clientes"); // clientes | retornos

  const grupos = useMemo(() => agruparRetornos(retornos, hoje), [retornos, hoje]);

  const lista = useMemo(() => {
    let base = procurar(clientes, busca);
    if (filtro === "pendentes") {
      base = base.filter((c) => {
        const p = proximoRetorno(retornos, c.id, hoje);
        return p && ["atrasado", "hoje"].includes(p.estado);
      });
    } else if (filtro === "sem_retorno") {
      base = base.filter((c) => !proximoRetorno(retornos, c.id, hoje));
    }
    return base.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  }, [clientes, busca, filtro, retornos, hoje]);

  const fichaDe = (c) => fichaDoCliente({ cliente: c, orcamentos, ordens, propostas, retornos, hoje });

  const concluirRetorno = (r, resultado) =>
    onSalvarRetorno({ ...r, situacao: "feito", concluidoEm: new Date().toISOString(), resultado: resultado || "", por: quemSou || "" });

  return (
    <div className="crm">
      <Estilo />

      <div className="crm-topo">
        <div className="crm-ver">
          <button className={vendo === "clientes" ? "on" : ""} onClick={() => setVendo("clientes")}>
            <Users size={14} /> Clientes <i>{clientes.length}</i>
          </button>
          <button className={vendo === "retornos" ? "on" : ""} onClick={() => setVendo("retornos")}>
            <Clock size={14} /> Retornos
            <i className={grupos.atrasados.length ? "urgente" : ""}>
              {grupos.atrasados.length + grupos.hoje.length}
            </i>
          </button>
        </div>
        <button className="crm-btn" onClick={() => setEditando({})}><Plus size={15} /> Novo cliente</button>
      </div>

      {vendo === "clientes" ? (
        <>
          <div className="crm-filtros">
            <div className="crm-busca">
              <Search size={14} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, telefone, empresa, condomínio, síndico…" />
            </div>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendentes">Com retorno pendente ou atrasado</option>
              <option value="sem_retorno">Sem retorno agendado</option>
            </select>
          </div>

          {lista.length === 0 ? (
            <p className="crm-dim">
              {clientes.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nada encontrado com esse filtro."}
            </p>
          ) : (
            <ul className="crm-lista">
              {lista.map((c) => {
                const p = proximoRetorno(retornos, c.id, hoje);
                const k = contatoPrincipal(c);
                const f = fichaDe(c);
                return (
                  <li key={c.id} onClick={() => setAberta(c)}>
                    <span className="crm-ini">{ehColetivo(c) ? <Building2 size={15} /> : String(c.nome || "?").charAt(0).toUpperCase()}</span>
                    <div className="crm-item-txt">
                      <b>{c.nome}</b>
                      <em>
                        {k?.nome && k.nome !== c.nome ? `${k.nome}${k.funcao ? ` (${k.funcao})` : ""} · ` : ""}
                        {k?.telefone || "sem telefone"}
                      </em>
                      <i>
                        {f.ultimaInteracao ? `Última: ${dia(f.ultimaInteracao)}` : "Sem contato registrado"}
                        {f.totais.orcamentos ? ` · ${f.totais.orcamentos} orçamento(s)` : ""}
                      </i>
                    </div>
                    {p && (
                      <span className={"crm-pin " + p.estado}>
                        {p.estado === "atrasado" ? "atrasado" : p.estado === "hoje" ? "hoje" : dia(p.data)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <div className="crm-retornos">
          {[["atrasados", "Atrasados", grupos.atrasados], ["hoje", "Hoje", grupos.hoje],
            ["futuros", "Próximos", grupos.futuros]].map(([id, nome, lista2]) => (
            <div key={id} className="crm-grupo">
              <h4 className={id}>{nome} · {lista2.length}</h4>
              {lista2.length === 0 ? <p className="crm-dim">Nada aqui.</p> : (
                <ul className="crm-ret-lista">
                  {lista2.map((r) => {
                    const c = clientes.find((x) => x.id === r.clienteId);
                    const w = linkWhatsApp(contatoPrincipal(c || {})?.telefone, "Olá! Aqui é da Vigiar Sistemas.");
                    return (
                      <li key={r.id}>
                        <div onClick={() => c && setAberta(c)}>
                          <b>{r.cliente || c?.nome || "cliente"}</b>
                          <em>{r.detalhe || r.motivo}</em>
                          <i>{dia(r.data)}{r.responsavel ? ` · ${r.responsavel}` : ""}</i>
                        </div>
                        {w && <a className="crm-btn zap pequeno" href={w} target="_blank" rel="noreferrer"><MessageCircle size={13} /></a>}
                        <button className="crm-btn pequeno" onClick={() => concluirRetorno(r)}><Check size={13} /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {aberta && (
        <Ficha
          cliente={clientes.find((c) => c.id === aberta.id) || aberta}
          dados={fichaDe(clientes.find((c) => c.id === aberta.id) || aberta)}
          hoje={hoje}
          quemSou={quemSou}
          onEditar={(c) => { setAberta(null); setEditando(c); }}
          onRetorno={(c) => setAgendando(c)}
          onInteracao={(c, i) => onSalvarCliente({ ...c, interacoes: [i, ...(c.interacoes || [])] })}
          onConcluirRetorno={concluirRetorno}
          onAbrirOrc={onAbrirOrc}
          onAbrirOs={onAbrirOs}
          onToast={onToast}
          onFechar={() => setAberta(null)}
        />
      )}

      {editando && (
        <Cadastro
          inicial={editando.id ? editando : null}
          clientes={clientes}
          onSalvar={(c) => { onSalvarCliente(c); setEditando(null); onToast(`${c.nome} salvo.`); }}
          onFechar={() => setEditando(null)}
          onToast={onToast}
        />
      )}

      {agendando && (
        <NovoRetorno
          cliente={agendando}
          atendimentos={fichaDe(agendando).atendimentos}
          quemSou={quemSou}
          onSalvar={(r) => { onSalvarRetorno(r); setAgendando(null); onToast("Retorno agendado."); }}
          onFechar={() => setAgendando(null)}
        />
      )}
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.crm{display:flex;flex-direction:column;gap:13px;font-size:13px}
.crm h4{margin:0;font-size:10px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;
  color:#ff9a45;font-family:"JetBrains Mono",ui-monospace,monospace}
.crm-dim{margin:0;font-size:12px;line-height:1.55;color:#7e94b4}
.crm-erro{font-size:12px;color:#ff8f8f}
.crm-topo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.crm-ver{display:flex;gap:7px;flex:1}
.crm-ver button{display:inline-flex;align-items:center;gap:7px;cursor:pointer;border-radius:10px;padding:9px 13px;
  font-size:12px;font-weight:700;font-family:inherit;color:#7e94b4;background:rgba(120,180,255,.06);
  border:1px solid rgba(120,180,255,.16)}
.crm-ver button.on{color:#fff;background:rgba(255,140,50,.16);border-color:rgba(255,140,50,.5)}
.crm-ver i{font-style:normal;font-size:10.5px;border-radius:99px;padding:2px 7px;background:rgba(120,180,255,.16)}
.crm-ver i.urgente{background:rgba(255,107,107,.3);color:#ff8f8f}
.crm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;border:none;
  border-radius:9px;padding:10px 14px;font-size:12.5px;font-weight:700;font-family:inherit;
  background:#e2640a;color:#fff;text-decoration:none}
.crm-btn:disabled{opacity:.45;cursor:default}
.crm-btn.fantasma{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)}
.crm-btn.zap{background:#1f9d55}
.crm-btn.pequeno{padding:7px 10px;font-size:11.5px}
.crm-link{display:inline-flex;align-items:center;gap:4px;cursor:pointer;border:none;background:none;
  font-family:inherit;font-size:11.5px;color:#ff9a45}

.crm-filtros{display:flex;gap:8px;flex-wrap:wrap}
.crm-busca{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:9px;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#7e94b4}
.crm-busca input{flex:1;border:none;background:none;padding:10px 0}
.crm input,.crm select,.crm textarea{box-sizing:border-box;border-radius:9px;padding:9px 11px;font-size:12.5px;
  font-family:inherit;background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;outline:none}
.crm input:focus,.crm select:focus,.crm textarea:focus{border-color:#ff8c32}
.crm textarea{width:100%;resize:vertical}

.crm-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.crm-lista li{display:flex;align-items:center;gap:11px;cursor:pointer;padding:11px 12px;border-radius:11px;
  background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.crm-lista li:hover{border-color:rgba(255,140,50,.4)}
.crm-ini{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;
  font-weight:800;color:#ff9a45;background:rgba(255,140,50,.14);border:1px solid rgba(255,140,50,.28)}
.crm-item-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.crm-item-txt b{color:#fff;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.crm-item-txt em{font-style:normal;font-size:11.5px;color:#8ba3c2}
.crm-item-txt i{font-style:normal;font-size:10.5px;color:#6f87a8}
.crm-pin{flex-shrink:0;font-size:10px;font-weight:700;border-radius:99px;padding:4px 9px;
  background:rgba(120,180,255,.14);color:#b9cbe4}
.crm-pin.atrasado{background:rgba(255,107,107,.22);color:#ff8f8f}
.crm-pin.hoje{background:rgba(255,140,50,.24);color:#ffb27a}

.crm-retornos{display:flex;flex-direction:column;gap:16px}
.crm-grupo h4.atrasados{color:#ff8f8f}
.crm-grupo h4.hoje{color:#ffb27a}
.crm-ret-lista{list-style:none;margin:9px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}
.crm-ret-lista li{display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:11px;
  background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.crm-ret-lista li > div{flex:1;min-width:0;cursor:pointer;display:flex;flex-direction:column;gap:2px}
.crm-ret-lista b{color:#fff;font-size:13px}
.crm-ret-lista em{font-style:normal;font-size:12px;color:#b9cbe4}
.crm-ret-lista i{font-style:normal;font-size:10.5px;color:#6f87a8}

.crm-sheet{position:fixed;inset:0;z-index:110;display:flex;flex-direction:column;background:#070c15}
.crm-sheet header{display:flex;align-items:center;gap:10px;padding:14px 18px;
  border-bottom:1px solid rgba(120,180,255,.16);background:rgba(7,12,21,.96)}
.crm-sheet header b{flex:1;font-size:16px;color:#fff}
.crm-sheet header button{width:34px;height:34px;display:grid;place-items:center;cursor:pointer;border-radius:9px;
  color:#b9cbe4;background:rgba(120,180,255,.08);border:1px solid rgba(120,180,255,.22)}
.crm-tipo{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#ff9a45;
  border:1px solid rgba(255,140,50,.4);border-radius:99px;padding:3px 9px}
.crm-sheet-corpo{flex:1;overflow-y:auto;padding:16px 18px 30px;max-width:820px;width:100%;margin:0 auto;
  display:flex;flex-direction:column;gap:12px}
.crm-sheet footer{padding:12px 18px;border-top:1px solid rgba(120,180,255,.16);background:rgba(7,12,21,.96)}
.crm-sheet footer .crm-btn{width:100%}
.crm-sheet label{display:flex;flex-direction:column;gap:5px}
.crm-sheet label > span{font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#7e94b4}
.crm-linha2{display:grid;grid-template-columns:1fr;gap:9px}
@media (min-width:560px){.crm-linha2{grid-template-columns:1fr 1fr}}
.crm-tipos{display:flex;gap:7px}
.crm-tipos button{flex:1;cursor:pointer;border-radius:9px;padding:10px;font-size:12px;font-weight:700;
  font-family:inherit;color:#7e94b4;background:rgba(120,180,255,.06);border:1px solid rgba(120,180,255,.16)}
.crm-tipos button.on{color:#fff;background:rgba(255,140,50,.16);border-color:rgba(255,140,50,.5)}
.crm-dup{display:flex;align-items:flex-start;gap:8px;border-radius:9px;padding:10px 12px;font-size:12px;
  line-height:1.5;color:#ffb27a;background:rgba(255,140,50,.09);border:1px solid rgba(255,140,50,.3)}
.crm-contatos-ed{display:flex;flex-direction:column;gap:9px}
.crm-bloco-topo{display:flex;align-items:center;justify-content:space-between}
.crm-contato{display:flex;flex-direction:column;gap:8px;padding:11px;border-radius:11px;
  background:rgba(120,180,255,.04);border:1px solid rgba(120,180,255,.14)}
.crm-contato.principal{border-color:rgba(255,140,50,.35)}
.crm-contato-pe{display:flex;align-items:center;justify-content:space-between}
.crm-check{flex-direction:row!important;align-items:center;gap:7px;font-size:12px;color:#b9cbe4;cursor:pointer}
.crm-check input{width:16px;height:16px;accent-color:#e2640a}
.crm-contato-pe button{cursor:pointer;border:none;background:none;color:#ff8f8f;padding:3px}

.crm-resumo{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
@media (min-width:560px){.crm-resumo{grid-template-columns:repeat(4,1fr)}}
.crm-resumo div{padding:10px 12px;border-radius:10px;background:rgba(120,180,255,.05);
  border:1px solid rgba(120,180,255,.14)}
.crm-resumo b{display:block;font-size:17px;font-family:"JetBrains Mono",ui-monospace,monospace;color:#fff}
.crm-resumo b.frio{color:#ff8f8f}
.crm-resumo span{display:block;font-size:10px;color:#6f87a8;margin-top:2px}
.crm-retorno-topo{display:flex;align-items:center;gap:9px;border-radius:10px;padding:10px 12px;font-size:12.5px;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.2);color:#b9cbe4}
.crm-retorno-topo.atrasado{background:rgba(255,107,107,.1);border-color:rgba(255,107,107,.3);color:#ff8f8f}
.crm-retorno-topo.hoje{background:rgba(255,140,50,.1);border-color:rgba(255,140,50,.3);color:#ffb27a}
.crm-retorno-topo span{flex:1}
.crm-retorno-topo button{cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;border-radius:7px;
  padding:6px 10px;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)}
.crm-acoes-topo{display:flex;gap:8px;flex-wrap:wrap}
.crm-abas-ficha{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.crm-abas-ficha::-webkit-scrollbar{display:none}
.crm-abas-ficha button{flex-shrink:0;white-space:nowrap;cursor:pointer;border-radius:99px;padding:7px 13px;
  font-size:11.5px;font-weight:700;font-family:inherit;color:#7e94b4;background:rgba(120,180,255,.06);
  border:1px solid rgba(120,180,255,.16)}
.crm-abas-ficha button.on{color:#fff;background:#e2640a;border-color:#e2640a}

.crm-atds{display:flex;flex-direction:column;gap:9px}
.crm-atd{display:flex;flex-direction:column;gap:7px;padding:11px 12px;border-radius:11px;text-align:left;
  background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.crm-atd.avulsa{cursor:pointer;font-family:inherit;color:inherit}
.crm-atd-topo{display:flex;align-items:center;gap:9px;flex-wrap:wrap;width:100%;cursor:pointer;
  background:none;border:none;padding:0;font-family:inherit;text-align:left}
.crm-passo{font-size:9.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#ff9a45;
  border:1px solid rgba(255,140,50,.35);border-radius:99px;padding:3px 8px}
.crm-atd b{color:#fff;font-size:13px}
.crm-atd em{font-style:normal;flex:1;min-width:0;font-size:12px;color:#8ba3c2;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.crm-atd-linha{display:flex;gap:9px;flex-wrap:wrap;align-items:center;font-size:11.5px;color:#7e94b4}
.crm-atd-linha span{display:inline-flex;align-items:center;gap:4px}
.crm-atd-linha .ok{color:#22d39a}
.crm-chip{display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-family:inherit;font-size:11px;
  color:#b9cbe4;background:rgba(120,180,255,.1);border:1px solid rgba(120,180,255,.2);
  border-radius:7px;padding:4px 8px}

.crm-contatos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.crm-contatos li{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;
  background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.crm-contatos li > div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.crm-contatos b{color:#fff;font-size:13px}
.crm-contatos em{font-style:normal;font-size:11px;color:#ff9a45}
.crm-contatos span{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#b9cbe4}

.crm-registrar{display:flex;gap:8px;flex-wrap:wrap}
.crm-registrar select{flex-shrink:0}
.crm-registrar input{flex:1;min-width:160px}
.crm-linha-tempo{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
.crm-linha-tempo li{display:flex;gap:11px;padding-bottom:9px;border-bottom:1px solid rgba(120,180,255,.1)}
.crm-quando{flex-shrink:0;width:104px;font-size:10.5px;color:#6f87a8;
  font-family:"JetBrains Mono",ui-monospace,monospace}
.crm-linha-tempo div{flex:1;min-width:0;font-size:12.5px;line-height:1.55;color:#b9cbe4}
.crm-linha-tempo b{color:#fff}
.crm-linha-tempo em{display:block;font-style:normal;font-size:10.5px;color:#6f87a8;margin-top:2px}

.crm-equip{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.crm-equip li{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;color:#ff9a45;
  background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.crm-equip b{display:block;color:#fff;font-size:13px}
.crm-equip em{font-style:normal;font-size:11px;color:#7e94b4}
    `}</style>
  );
}
