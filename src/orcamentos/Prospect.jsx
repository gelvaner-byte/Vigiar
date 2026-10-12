import React, { useMemo, useState } from "react";
import {
  Search, RefreshCw, Copy, MapPin, Phone, Mail, Globe, Target,
  ChevronRight, AlertTriangle, Check, Building2, TrendingUp,
} from "lucide-react";
import { supabase } from "./supabaseOrc";

/* ===== TRON PROSPECT — central de prospecção ===== */

export const ROTULO_ESTAGIO = {
  identificado: "Cliente identificado",
  pesquisa_concluida: "Pesquisa concluída",
  qualificado: "Cliente qualificado",
  aguardando_contato: "Aguardando contato",
  contato_realizado: "Contato realizado",
  aguardando_resposta: "Aguardando resposta",
  interessado: "Cliente interessado",
  visita_agendada: "Visita técnica agendada",
  orcamento_em_elaboracao: "Orçamento em elaboração",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  contrato_fechado: "Contrato fechado",
  perdido: "Oportunidade perdida",
};
const ORDEM_ESTAGIO = Object.keys(ROTULO_ESTAGIO);

const ROTULO_SEGMENTO = {
  administradora: "Administradora", condominio: "Condomínio", comercio: "Comércio",
  industria: "Indústria", construtora: "Construtora", outro: "Outro",
};
const ROTULO_EQUIP = {
  confirmados: "Confirmados", nao_confirmados: "Não confirmados", nao_identificados: "Não identificados",
};
const COR_PRIORIDADE = { alta: "#22d39a", media: "#ff9a45", acompanhar: "#78a8e0", baixa: "#6f87a8" };

async function comToken(caminho, opcoes = {}) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(caminho, {
    ...opcoes,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${data.session?.access_token}`,
      ...(opcoes.headers || {}),
    },
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo.erro || "Deu erro na prospecção.");
  return corpo;
}

export const buscarProspect = () => comToken("/api/prospect/dados");

export const pesquisarProspect = (pedido, segmentos) =>
  comToken("/api/prospect/pesquisar", { method: "POST", body: JSON.stringify({ pedido, segmentos }) });

export const moverProspect = (leadId, estagio, anotacao) =>
  comToken("/api/prospect/atualizar", { method: "POST", body: JSON.stringify({ leadId, estagio, anotacao }) });

// O que o TRON precisa saber da prospecção, em tamanho de bolso.
export function contextoProspect(p) {
  if (!p) return null;
  const leads = p.leads || [];
  const ultimo = (p.relatorios || [])[0] || null;
  const resumir = (l) => ({
    id: l.id, nome: l.nome, cidade: l.cidade, bairro: l.bairro, segmento: l.segmento,
    pontuacao: l.pontuacao, prioridade: l.prioridade, estagio: l.estagio,
    servico: l.servicoRecomendado, telefone: l.telefone, email: l.email,
    equipamentos: l.equipamentos, confiabilidade: l.confiabilidade,
    porque: l.justificativa,
  });
  const aguardando = leads.filter((l) => ["pesquisa_concluida", "qualificado", "aguardando_contato"].includes(l.estagio));
  const andamento = leads.filter((l) => !["pesquisa_concluida", "qualificado", "aguardando_contato", "perdido", "contrato_fechado"].includes(l.estagio));
  return {
    cidades: p.cfg?.cidades, metaDiaria: p.cfg?.metaDiaria,
    total: leads.length,
    relatorioDeHoje: ultimo,
    naoContatados: aguardando.length,
    melhoresParaAbordar: aguardando.sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 12).map(resumir),
    emAndamento: andamento.slice(0, 12).map(resumir),
    fechados: leads.filter((l) => l.estagio === "contrato_fechado").length,
    perdidos: leads.filter((l) => l.estagio === "perdido").length,
  };
}

function Pontos({ valor, prioridade }) {
  const cor = COR_PRIORIDADE[prioridade] || "#6f87a8";
  return (
    <span className="pro-pontos" style={{ color: cor, borderColor: `${cor}66`, background: `${cor}1a` }}>
      {valor}
    </span>
  );
}

function Copiar({ texto, rotulo, onToast }) {
  if (!texto) return null;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); onToast && onToast(`${rotulo} copiado.`); }
    catch { onToast && onToast("Não consegui copiar."); }
  };
  return <button className="pro-copiar" onClick={copiar} title={`Copiar ${rotulo}`}><Copy size={12} /> {rotulo}</button>;
}

function Ficha({ lead, onFechar, onMover, onToast }) {
  const [anotacao, setAnotacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const a = lead.abordagem || {};

  const mover = async (estagio) => {
    setSalvando(true);
    try { await onMover(lead.id, estagio, anotacao); setAnotacao(""); }
    finally { setSalvando(false); }
  };

  return (
    <div className="pro-ficha">
      <header>
        <div>
          <h3>{lead.nome}</h3>
          <p><MapPin size={12} /> {lead.bairro ? `${lead.bairro} · ` : ""}{lead.cidade} · {ROTULO_SEGMENTO[lead.segmento] || lead.segmento}</p>
        </div>
        <Pontos valor={lead.pontuacao} prioridade={lead.prioridade} />
        <button className="pro-x" onClick={onFechar}>✕</button>
      </header>

      <div className="pro-ficha-corpo">
        <section>
          <h4>Contato comercial</h4>
          <ul className="pro-contatos">
            {lead.telefone && <li><Phone size={13} /> {lead.telefone} <Copiar texto={lead.telefone} rotulo="telefone" onToast={onToast} /></li>}
            {lead.whatsapp && <li><Phone size={13} /> {lead.whatsapp} (WhatsApp) <Copiar texto={lead.whatsapp} rotulo="whatsapp" onToast={onToast} /></li>}
            {lead.email && <li><Mail size={13} /> {lead.email} <Copiar texto={lead.email} rotulo="e-mail" onToast={onToast} /></li>}
            {lead.site && <li><Globe size={13} /> <a href={lead.site} target="_blank" rel="noreferrer">{lead.site}</a></li>}
            {lead.paginaContato && <li><Globe size={13} /> <a href={lead.paginaContato} target="_blank" rel="noreferrer">página de contato</a></li>}
            {lead.endereco && <li><MapPin size={13} /> {lead.endereco}</li>}
          </ul>
        </section>

        <section>
          <h4>Por que vale a pena</h4>
          <p className="pro-txt">{lead.justificativa || "—"}</p>
          <p className="pro-servico"><Target size={13} /> <b>{lead.servicoRecomendado || "A definir"}</b></p>
          {!!(lead.evidencias || []).length && (
            <ul className="pro-lista">{lead.evidencias.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          <p className="pro-equip">
            Equipamentos: <b>{ROTULO_EQUIP[lead.equipamentos]}</b>
            {lead.equipamentosDetalhe ? ` — ${lead.equipamentosDetalhe}` : ""}
          </p>
          {!!(lead.pendencias || []).length && (
            <p className="pro-pend"><AlertTriangle size={12} /> A confirmar: {lead.pendencias.join(" · ")}</p>
          )}
        </section>

        <section>
          <h4>Como a pontuação foi feita</h4>
          <ul className="pro-criterios">
            {(lead.criterios || []).map((c) => (
              <li key={c.chave}>
                <span>{c.texto}</span>
                <b>{c.pontos}/{c.peso}</b>
              </li>
            ))}
          </ul>
          <p className="pro-dim">Confiabilidade das informações: {lead.confiabilidade}</p>
        </section>

        <section>
          <h4>Abordagem pronta — você envia, não o sistema</h4>
          {a.whatsapp && (
            <div className="pro-msg">
              <span>WhatsApp</span>
              <p>{a.whatsapp}</p>
              <Copiar texto={a.whatsapp} rotulo="mensagem" onToast={onToast} />
            </div>
          )}
          {a.email?.corpo && (
            <div className="pro-msg">
              <span>E-mail — {a.email.assunto}</span>
              <p>{a.email.corpo}</p>
              <Copiar texto={`${a.email.assunto}\n\n${a.email.corpo}`} rotulo="e-mail" onToast={onToast} />
            </div>
          )}
          {a.ligacao && (
            <div className="pro-msg"><span>Ligação</span><p>{a.ligacao}</p><Copiar texto={a.ligacao} rotulo="roteiro" onToast={onToast} /></div>
          )}
          {!!(a.perguntas || []).length && (
            <>
              <h4>Perguntas para a primeira conversa</h4>
              <ul className="pro-lista">{a.perguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
          {a.proximoPasso && <p className="pro-txt"><b>Próximo passo:</b> {a.proximoPasso}</p>}
        </section>

        <section>
          <h4>Onde isso foi lido</h4>
          <ul className="pro-fontes">
            {(lead.fontes || []).map((f, i) => (
              <li key={i}><a href={f.url || f} target="_blank" rel="noreferrer">{(f.url || f).replace(/^https?:\/\//, "").slice(0, 60)}</a>{f.oQue ? ` — ${f.oQue}` : ""}</li>
            ))}
          </ul>
        </section>

        <section>
          <h4>Em que pé está</h4>
          <select className="pro-select" value={lead.estagio} onChange={(e) => mover(e.target.value)} disabled={salvando}>
            {ORDEM_ESTAGIO.map((s) => <option key={s} value={s}>{ROTULO_ESTAGIO[s]}</option>)}
          </select>
          <textarea className="pro-nota" rows={2} value={anotacao} placeholder="Anote o que aconteceu no contato…"
            onChange={(e) => setAnotacao(e.target.value)} />
          <button className="pro-btn" disabled={salvando || !anotacao.trim()} onClick={() => mover(lead.estagio)}>
            <Check size={13} /> Guardar anotação
          </button>
          {!!(lead.historico || []).length && (
            <ul className="pro-hist">
              {[...lead.historico].reverse().slice(0, 8).map((h, i) => (
                <li key={i}>
                  <b>{new Date(h.em).toLocaleDateString("pt-BR")}</b>{" "}
                  {h.nota ? h.nota : `${ROTULO_ESTAGIO[h.de] || h.de} → ${ROTULO_ESTAGIO[h.para] || h.para}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Prospect({ dados, carregando, onAtualizar, onPesquisar, onMover, onToast }) {
  const [aberto, setAberto] = useState(null);
  const [cidade, setCidade] = useState("");
  const [segmento, setSegmento] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [so, setSo] = useState("naoContatados");
  const [busca, setBusca] = useState("");
  const [pedido, setPedido] = useState("");
  const [pesquisando, setPesquisando] = useState(false);

  const leads = dados?.leads || [];
  const relatorio = (dados?.relatorios || [])[0] || null;

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (cidade && l.cidade !== cidade) return false;
      if (segmento && l.segmento !== segmento) return false;
      if (prioridade && l.prioridade !== prioridade) return false;
      if (so === "naoContatados" && !["pesquisa_concluida", "qualificado", "aguardando_contato"].includes(l.estagio)) return false;
      if (so === "andamento" && ["pesquisa_concluida", "qualificado", "aguardando_contato", "perdido", "contrato_fechado"].includes(l.estagio)) return false;
      if (t && !`${l.nome} ${l.bairro} ${l.servicoRecomendado}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [leads, cidade, segmento, prioridade, so, busca]);

  const pesquisarAgora = async () => {
    setPesquisando(true);
    try {
      const r = await onPesquisar(pedido.trim());
      onToast && onToast(r?.relatorio?.recado || "Pesquisa concluída.");
      setPedido("");
    } catch (e) {
      onToast && onToast("Não deu: " + String(e.message || e));
    } finally {
      setPesquisando(false);
    }
  };

  const cidades = [...new Set(leads.map((l) => l.cidade).filter(Boolean))];

  if (!dados && carregando) return <p className="pro-dim">Carregando a prospecção…</p>;
  if (dados && !dados.configurado) {
    return <p className="pro-dim">O TRON PROSPECT precisa da chave da Anthropic na Vercel para pesquisar.</p>;
  }

  return (
    <div className="pro">
      <Estilo />

      <div className="pro-topo">
        <div className="pro-numeros">
          <div><b>{leads.length}</b><span>na base</span></div>
          <div><b>{leads.filter((l) => ["pesquisa_concluida", "qualificado", "aguardando_contato"].includes(l.estagio)).length}</b><span>a contatar</span></div>
          <div><b>{leads.filter((l) => l.prioridade === "alta").length}</b><span>prioridade alta</span></div>
          <div><b>{leads.filter((l) => l.estagio === "contrato_fechado").length}</b><span>fechados</span></div>
        </div>
        <button className="pro-btn fantasma" onClick={onAtualizar} disabled={carregando}>
          <RefreshCw size={13} className={carregando ? "girando" : ""} /> Atualizar
        </button>
      </div>

      {relatorio && (
        <div className="pro-relatorio">
          <header><TrendingUp size={13} /> RELATÓRIO DE {new Date(`${relatorio.data}T12:00`).toLocaleDateString("pt-BR")}</header>
          <p>{relatorio.recado}</p>
          <ul>
            <li><b>{relatorio.novos}</b> novos</li>
            <li><b>{relatorio.qualificados}</b> qualificados</li>
            <li><b>{relatorio.alta}</b> prioridade alta</li>
            <li><b>{relatorio.recorrentes}</b> com cara de contrato mensal</li>
            <li><b>{relatorio.consultasWeb}</b> buscas na web</li>
          </ul>
          {!!(relatorio.falhas || []).length && (
            <p className="pro-pend"><AlertTriangle size={12} /> {relatorio.falhas.join(" · ")}</p>
          )}
        </div>
      )}

      {!dados?.rotinaPronta && (
        <p className="pro-aviso">
          <AlertTriangle size={13} /> A rotina automática das 10h ainda não roda: falta a chave de serviço
          do Supabase na Vercel. Pesquisar à mão aqui já funciona.
        </p>
      )}

      <div className="pro-pedido">
        <input value={pedido} onChange={(e) => setPedido(e.target.value)} disabled={pesquisando}
          placeholder="Procurar agora: ex. administradoras de condomínio em Nova Lima"
          onKeyDown={(e) => e.key === "Enter" && !pesquisando && pesquisarAgora()} />
        <button className="pro-btn" onClick={pesquisarAgora} disabled={pesquisando}>
          <Search size={13} /> {pesquisando ? "Pesquisando…" : "Pesquisar"}
        </button>
      </div>
      {pesquisando && <p className="pro-dim">Procurando na web. Isso leva cerca de um minuto.</p>}

      <div className="pro-filtros">
        <input className="pro-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome…" />
        <select value={so} onChange={(e) => setSo(e.target.value)}>
          <option value="naoContatados">A contatar</option>
          <option value="andamento">Em andamento</option>
          <option value="">Todos</option>
        </select>
        <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
          <option value="">Toda cidade</option>
          {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={segmento} onChange={(e) => setSegmento(e.target.value)}>
          <option value="">Todo segmento</option>
          {Object.entries(ROTULO_SEGMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
          <option value="">Toda prioridade</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="acompanhar">Acompanhar</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>

      {lista.length === 0 ? (
        <p className="pro-dim">
          {leads.length === 0
            ? "Ainda não há ninguém na base. Peça uma pesquisa acima, ou espere a rotina das 10h."
            : "Nenhum cliente com esses filtros."}
        </p>
      ) : (
        <ul className="pro-leads">
          {lista.map((l) => (
            <li key={l.id} onClick={() => setAberto(l.id)}>
              <span className="pro-ico"><Building2 size={15} /></span>
              <div className="pro-lead-txt">
                <b>{l.nome}</b>
                <em>{l.bairro ? `${l.bairro} · ` : ""}{l.cidade} · {ROTULO_SEGMENTO[l.segmento] || l.segmento}</em>
                <i>{l.servicoRecomendado}</i>
              </div>
              <div className="pro-lead-dir">
                <Pontos valor={l.pontuacao} prioridade={l.prioridade} />
                <span className="pro-estagio">{ROTULO_ESTAGIO[l.estagio]}</span>
              </div>
              <ChevronRight size={15} className="pro-seta" />
            </li>
          ))}
        </ul>
      )}

      {aberto && leads.find((l) => l.id === aberto) && (
        <Ficha lead={leads.find((l) => l.id === aberto)} onFechar={() => setAberto(null)}
          onMover={onMover} onToast={onToast} />
      )}
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.pro{display:flex;flex-direction:column;gap:12px;font-size:13px}
.pro-dim{color:#6f87a8;font-size:12.5px;margin:0;line-height:1.5}
.pro-topo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pro-numeros{display:flex;gap:16px;flex:1;flex-wrap:wrap}
.pro-numeros b{display:block;font-size:19px;font-weight:800;font-family:ui-monospace,monospace;color:#fff}
.pro-numeros span{display:block;font-size:10px;color:#6f87a8;margin-top:2px}
.pro-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:9px;
  padding:9px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;background:#e2640a;color:#fff}
.pro-btn:disabled{opacity:.6;cursor:default}
.pro-btn.fantasma{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)}
.girando{animation:progira 1s linear infinite}
@keyframes progira{to{transform:rotate(360deg)}}

.pro-relatorio{background:rgba(120,180,255,.06);border:1px solid rgba(120,180,255,.18);border-radius:11px;padding:11px 13px}
.pro-relatorio header{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800;letter-spacing:1.6px;
  color:#ff9a45;font-family:ui-monospace,monospace;margin-bottom:7px}
.pro-relatorio p{margin:0 0 8px;color:#dce7f5;line-height:1.5}
.pro-relatorio ul{list-style:none;margin:0;padding:0;display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:#8ba3c2}
.pro-relatorio ul b{color:#fff;font-family:ui-monospace,monospace}
.pro-aviso{display:flex;align-items:flex-start;gap:7px;margin:0;font-size:12px;line-height:1.5;color:#ffb27a;
  background:rgba(255,140,50,.08);border:1px solid rgba(255,140,50,.3);border-radius:10px;padding:10px 12px}

.pro-pedido{display:flex;gap:8px}
.pro-pedido input{flex:1;min-width:0;border-radius:9px;padding:10px 12px;font-size:13px;font-family:inherit;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;outline:none}
.pro-pedido input:focus{border-color:#ff8c32}

.pro-filtros{display:flex;gap:7px;flex-wrap:wrap}
.pro-filtros select,.pro-busca{border-radius:8px;padding:8px 10px;font-size:12px;font-family:inherit;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.2);color:#dce7f5;outline:none}
.pro-busca{flex:1;min-width:140px}

.pro-leads{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;max-height:460px;overflow-y:auto}
.pro-leads li{display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 11px;border-radius:10px;
  background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.pro-leads li:hover{border-color:rgba(255,140,50,.4);background:rgba(255,140,50,.06)}
.pro-ico{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;color:#ff9a45;
  background:rgba(255,140,50,.12);border:1px solid rgba(255,140,50,.26)}
.pro-lead-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.pro-lead-txt b{color:#fff;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pro-lead-txt em{font-style:normal;font-size:11px;color:#7e94b4}
.pro-lead-txt i{font-style:normal;font-size:11px;color:#22d39a}
.pro-lead-dir{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.pro-estagio{font-size:9.5px;color:#7e94b4;text-transform:uppercase;letter-spacing:.5px}
.pro-seta{color:#4f688a;flex-shrink:0}
.pro-pontos{font-family:ui-monospace,monospace;font-weight:800;font-size:13px;border:1px solid;border-radius:99px;padding:2px 9px}

.pro-ficha{position:fixed;inset:0;z-index:90;background:#070c15;overflow-y:auto;padding:0 0 30px}
.pro-ficha header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:14px 18px;
  background:rgba(7,12,21,.95);border-bottom:1px solid rgba(120,180,255,.16);backdrop-filter:blur(8px)}
.pro-ficha header div{flex:1;min-width:0}
.pro-ficha h3{margin:0;font-size:16px;color:#fff}
.pro-ficha header p{margin:3px 0 0;font-size:11.5px;color:#7e94b4;display:flex;align-items:center;gap:5px}
.pro-x{width:34px;height:34px;flex-shrink:0;border-radius:9px;border:1px solid rgba(120,180,255,.22);
  background:rgba(120,180,255,.08);color:#e8f0fb;cursor:pointer;font-size:15px}
.pro-ficha-corpo{max-width:720px;margin:0 auto;padding:16px 18px;display:flex;flex-direction:column;gap:20px}
.pro-ficha-corpo section{display:flex;flex-direction:column;gap:8px}
.pro-ficha-corpo h4{margin:0;font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;
  color:#ff9a45;font-family:ui-monospace,monospace}
.pro-txt{margin:0;color:#dce7f5;line-height:1.55}
.pro-servico{display:flex;align-items:center;gap:6px;margin:0;color:#22d39a}
.pro-contatos,.pro-lista,.pro-fontes,.pro-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.pro-contatos li{display:flex;align-items:center;gap:7px;color:#dce7f5;flex-wrap:wrap}
.pro-lista li{color:#b9cbe4;line-height:1.5;padding-left:13px;position:relative}
.pro-lista li::before{content:"▸";position:absolute;left:0;color:#ff9a45}
.pro-fontes li{font-size:11.5px;color:#7e94b4}
.pro-fontes a,.pro-contatos a{color:#78a8e0}
.pro-equip{margin:0;font-size:12px;color:#8ba3c2}
.pro-pend{display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:#ffb27a}
.pro-criterios{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.pro-criterios li{display:flex;gap:10px;font-size:12px;color:#b9cbe4;border-bottom:1px solid rgba(120,180,255,.1);padding-bottom:5px}
.pro-criterios li span{flex:1}
.pro-criterios li b{color:#fff;font-family:ui-monospace,monospace}
.pro-copiar{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(120,180,255,.22);border-radius:7px;
  background:rgba(120,180,255,.08);color:#b9cbe4;font-size:10.5px;font-family:inherit;padding:3px 8px;cursor:pointer}
.pro-msg{background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.16);border-radius:10px;padding:10px 12px}
.pro-msg span{display:block;font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:#ff9a45;
  font-family:ui-monospace,monospace;margin-bottom:6px}
.pro-msg p{margin:0 0 8px;color:#dce7f5;line-height:1.6;white-space:pre-wrap}
.pro-select,.pro-nota{width:100%;box-sizing:border-box;border-radius:9px;padding:10px;font-size:13px;font-family:inherit;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;outline:none}
.pro-nota{resize:vertical}
.pro-hist li{font-size:11.5px;color:#8ba3c2}
.pro-hist b{color:#b9cbe4;font-family:ui-monospace,monospace}
    `}</style>
  );
}
