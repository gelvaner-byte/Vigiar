import React, { useMemo, useState } from "react";
import {
  ShieldCheck, X, Lock, TrendingUp, FileText, Wrench, Users, Package,
  AlertTriangle, Megaphone, Bot, CircleDollarSign, Activity, Radio, Brain,
} from "lucide-react";
import { supabase } from "./supabaseOrc";
import TronChat from "./Tron.jsx";
import CerebroPainel from "./Cerebro.jsx";

/* ============ Centro de Comando — área restrita do dono ============ */

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const curto = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return brl(n);
};
const itensTotal = (itens) => (itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
const valorOS = (os) =>
  os.valor !== undefined && os.valor !== null && os.valor !== "" ? Number(os.valor) || 0 : itensTotal(os.itens);
const diasEntre = (isoA, isoB) => Math.round((new Date(isoB) - new Date(isoA)) / 86400000);
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Pede a senha de novo antes de abrir o painel: entrar no app não basta.
function Tranca({ email, onLiberado, onFechar }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setIndo(true);
    setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setIndo(false);
    if (error) setErro("Senha incorreta.");
    else onLiberado();
  };

  return (
    <div className="cmd-tranca">
      <form onSubmit={entrar}>
        <span className="cmd-cadeado"><Lock size={24} /></span>
        <h2>ÁREA RESTRITA</h2>
        <p>Confirme sua senha para abrir o Centro de Comando.</p>
        <input type="password" autoFocus value={senha} onChange={(ev) => setSenha(ev.target.value)}
          placeholder="Sua senha" autoComplete="current-password" required />
        {erro && <span className="cmd-erro">{erro}</span>}
        <button type="submit" disabled={indo}>{indo ? "VERIFICANDO…" : "DESBLOQUEAR"}</button>
        <button type="button" className="cmd-cancelar" onClick={onFechar}>Cancelar</button>
      </form>
    </div>
  );
}

// Gráfico de faturamento dos últimos meses, desenhado na mão (sem biblioteca).
function Grafico({ serie }) {
  const w = 280, h = 64;
  const max = Math.max(...serie.map((s) => s.valor), 1);
  const passo = serie.length > 1 ? w / (serie.length - 1) : w;
  const pontos = serie.map((s, i) => [i * passo, h - (s.valor / max) * (h - 8) - 4]);
  const linha = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${linha} L${w},${h} L0,${h} Z`;
  return (
    <div className="cmd-graf">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="cmdfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8c32" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff8c32" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cmdfill)" />
        <path d={linha} fill="none" stroke="#ff8c32" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pontos.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pontos.length - 1 ? 3.5 : 2} fill="#ff8c32" />)}
      </svg>
      <div className="cmd-graf-eixo">{serie.map((s) => <span key={s.rotulo}>{s.rotulo}</span>)}</div>
    </div>
  );
}

function Painel({ icon, titulo, children, alerta, className = "" }) {
  return (
    <section className={`cmd-painel ${className}${alerta ? " alerta" : ""}`}>
      <header>{icon}<span>{titulo}</span><i className="cmd-led" /></header>
      <div className="cmd-corpo">{children}</div>
    </section>
  );
}

export default function Comando({ orcamentos, ordens, clientes, cerebro = [], onSalvarMemoria, onExcluirMemoria, vendedoras = [], acoesTron, onToast, email, onFechar }) {
  const [liberado, setLiberado] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = hoje.slice(0, 7);

  const d = useMemo(() => {
    const concluidas = ordens.filter((o) => o.status === "concluida");
    const osMes = concluidas.filter((o) => (o.dataServico || "").startsWith(mes));
    const faturadoMes = osMes.reduce((s, o) => s + valorOS(o), 0);
    const ticket = osMes.length ? faturadoMes / osMes.length : 0;

    // últimos 6 meses de faturamento
    const base = new Date();
    const serie = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const chave = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      serie.push({
        rotulo: MES_CURTO[dt.getMonth()],
        valor: concluidas.filter((o) => (o.dataServico || "").startsWith(chave)).reduce((s, o) => s + valorOS(o), 0),
      });
    }

    const enviados = orcamentos.filter((o) => o.status === "enviado");
    const parados = enviados
      .map((o) => ({ ...o, dias: o.dataEnvio ? diasEntre(o.dataEnvio, hoje) : null }))
      .filter((o) => o.dias != null && o.dias >= 3)
      .sort((a, b) => b.dias - a.dias);
    const decididos = orcamentos.filter((o) => ["aprovado", "recusado"].includes(o.status));
    const aprovados = orcamentos.filter((o) => o.status === "aprovado");
    const taxa = decididos.length ? Math.round((aprovados.length / decididos.length) * 100) : 0;

    const aEnviar = orcamentos.filter((o) => o.status === "a_enviar");
    const atrasadosEnvio = aEnviar.filter((o) => o.prazoEnvio && o.prazoEnvio < hoje);
    const visitasAtrasadas = orcamentos.filter((o) => o.status === "agendado" && o.dataVisita && o.dataVisita < hoje);
    const osAtrasadas = ordens.filter((o) => o.status === "agendada" && o.dataServico && o.dataServico < hoje);
    const osSemana = ordens.filter((o) => o.status === "agendada" && o.dataServico >= hoje && diasEntre(hoje, o.dataServico) <= 7);
    const emAberto = orcamentos.filter((o) => ["agendado", "a_enviar", "enviado"].includes(o.status));
    const valorEmJogo = enviados.reduce((s, o) => s + itensTotal(o.itens), 0);

    const devolver = ordens.flatMap((o) =>
      (Array.isArray(o.materiais) ? o.materiais : [])
        .filter((m) => m.pegoNaLoja && (Number(m.qtdPega) || 0) - (Number(m.qtdUsada) || 0) > 0)
        .map((m) => ({ os: o.numero, cliente: o.cliente, descricao: m.descricao, qtd: (Number(m.qtdPega) || 0) - (Number(m.qtdUsada) || 0), un: m.unidade || "UN" })),
    );

    const porVendedora = Object.values(orcamentos.reduce((m, o) => {
      const n = (o.vendedor || "").trim() || "Sem vendedor";
      m[n] = m[n] || { nome: n, total: 0, aprovados: 0, valor: 0 };
      m[n].total += 1;
      if (o.status === "aprovado") { m[n].aprovados += 1; m[n].valor += itensTotal(o.itens); }
      return m;
    }, {})).sort((a, b) => b.valor - a.valor);

    const mapaCli = new Map(clientes.map((c) => [c.id, c]));
    const porOrigem = Object.values(ordens.reduce((m, os) => {
      if (os.status === "cancelada") return m;
      const c = mapaCli.get(os.clienteId);
      const k = (c && String(c.origem || "").trim()) || "Sem origem";
      m[k] = m[k] || { nome: k, valor: 0, servicos: 0 };
      m[k].valor += valorOS(os);
      m[k].servicos += 1;
      return m;
    }, {})).sort((a, b) => b.valor - a.valor);

    return {
      faturadoMes, ticket, osMes: osMes.length, serie, enviados, parados, taxa, aprovados: aprovados.length,
      aEnviar, atrasadosEnvio, visitasAtrasadas, osAtrasadas, osSemana, devolver, porVendedora, porOrigem,
      emAberto: emAberto.length, valorEmJogo,
      novosClientes: clientes.filter((c) => (c.criadoEm || "").startsWith(mes)).length,
    };
  }, [orcamentos, ordens, clientes, hoje, mes]);

  const alertas = d.atrasadosEnvio.length + d.visitasAtrasadas.length + d.osAtrasadas.length + d.parados.length;

  const AGENTES = [
    { nome: "VENDAS", icon: <TrendingUp size={16} />, faz: "cobra orçamento parado" },
    { nome: "TRÁFEGO", icon: <Megaphone size={16} />, faz: "onde investir e o que cortar" },
    { nome: "FINANCEIRO", icon: <CircleDollarSign size={16} />, faz: "caixa, margem e inadimplência" },
    { nome: "TÉCNICO", icon: <Wrench size={16} />, faz: "rota do dia e material" },
    { nome: "CLIENTES", icon: <Users size={16} />, faz: "pós-venda e manutenção" },
    { nome: "ESTOQUE", icon: <Package size={16} />, faz: "o que falta comprar" },
  ];

  return (
    <div className="cmd-tela">
      <Estilo />
      <div className="cmd-grid-bg" aria-hidden="true" />

      <header className="cmd-topo">
        <div className="cmd-marca">
          <span className="cmd-logo"><ShieldCheck size={20} /></span>
          <div>
            <h1>VIGIAR <em>COMMAND CENTER</em></h1>
            <p>ÁREA RESTRITA · {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
        <button className="cmd-x" onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
      </header>

      {!liberado ? (
        <Tranca email={email} onLiberado={() => setLiberado(true)} onFechar={onFechar} />
      ) : (
        <div className="cmd-sala">
          {/* ===== núcleo ===== */}
          <div className="cmd-nucleo">
            <div className="cmd-anel a1" />
            <div className="cmd-anel a2" />
            <div className="cmd-anel a3" />
            <div className="cmd-centro">
              <span className="cmd-centro-rot">FATURADO EM {MES_CURTO[new Date().getMonth()].toUpperCase()}</span>
              <strong>{curto(d.faturadoMes)}</strong>
              <span className="cmd-centro-sub">{d.osMes} serviço(s) concluído(s)</span>
            </div>
          </div>

          <div className="cmd-faixa">
            <div className="cmd-chip"><b>{d.emAberto}</b><span>orçamentos abertos</span></div>
            <div className="cmd-chip"><b>{curto(d.valorEmJogo)}</b><span>em jogo</span></div>
            <div className="cmd-chip"><b>{d.taxa}%</b><span>fechamento</span></div>
            <div className="cmd-chip"><b>{curto(d.ticket)}</b><span>ticket médio</span></div>
            <div className="cmd-chip"><b>{d.osSemana.length}</b><span>serviços em 7 dias</span></div>
            <div className={"cmd-chip" + (alertas ? " perigo" : "")}><b>{alertas}</b><span>pendências</span></div>
          </div>

          <div className="cmd-grade">
            <Painel icon={<Bot size={14} />} titulo="TRON · seu braço direito" className="cmd-tron">
              <TronChat
                clientes={clientes}
                orcamentos={orcamentos}
                ordens={ordens}
                cerebro={cerebro}
                vendedoras={vendedoras}
                acoes={acoesTron}
                onToast={onToast}
              />
            </Painel>

            <Painel icon={<Brain size={14} />} titulo={`Cérebro · ${cerebro.length} memória${cerebro.length === 1 ? "" : "s"}`} className="cmd-cerebro">
              <CerebroPainel
                memorias={cerebro}
                onSalvar={onSalvarMemoria}
                onExcluir={onExcluirMemoria}
                onToast={onToast}
              />
            </Painel>

            <Painel icon={<Activity size={14} />} titulo="Faturamento · 6 meses">
              <Grafico serie={d.serie} />
            </Painel>

            <Painel icon={<AlertTriangle size={14} />} titulo={`Precisa de você · ${alertas}`} alerta={alertas > 0}>
              {alertas === 0 ? <p className="cmd-ok">▸ Nada atrasado. Tudo em dia.</p> : (
                <ul className="cmd-lista">
                  {d.atrasadosEnvio.length > 0 && <li><b>{d.atrasadosEnvio.length}</b> orçamento(s) com prazo de envio vencido</li>}
                  {d.visitasAtrasadas.length > 0 && <li><b>{d.visitasAtrasadas.length}</b> visita(s) de orçamento atrasada(s)</li>}
                  {d.osAtrasadas.length > 0 && <li><b>{d.osAtrasadas.length}</b> serviço(s) que passaram da data</li>}
                  {d.parados.length > 0 && <li><b>{d.parados.length}</b> orçamento(s) enviados sem resposta há 3+ dias</li>}
                </ul>
              )}
            </Painel>

            <Painel icon={<FileText size={14} />} titulo="Funil de orçamentos">
              <div className="cmd-funil">
                <div><b>{d.aEnviar.length}</b><span>montar / enviar</span></div>
                <div><b>{d.enviados.length}</b><span>aguardando cliente</span></div>
                <div><b>{d.aprovados}</b><span>aprovados</span></div>
              </div>
              {d.parados.length > 0 && (
                <ul className="cmd-lista cmd-rola">
                  {d.parados.slice(0, 6).map((o) => (
                    <li key={o.id}><b>{o.dias}d</b> parado · Nº {o.numero} · {o.cliente}<span className="cmd-valor">{curto(itensTotal(o.itens))}</span></li>
                  ))}
                </ul>
              )}
            </Painel>

            <Painel icon={<Megaphone size={14} />} titulo="De onde vem o dinheiro">
              {d.porOrigem.length === 0 ? <p className="cmd-dim">Cadastre a origem dos clientes para ver isto.</p> : (
                <ul className="cmd-barras">
                  {d.porOrigem.slice(0, 5).map((o, i) => {
                    const topo = d.porOrigem[0].valor || 1;
                    return (
                      <li key={o.nome}>
                        <span className="cmd-barra-rot">{o.nome}<em>{curto(o.valor)}</em></span>
                        <span className="cmd-barra"><i style={{ width: `${Math.max((o.valor / topo) * 100, 4)}%`, opacity: 1 - i * 0.14 }} /></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>

            <Painel icon={<Users size={14} />} titulo="Vendedoras">
              {d.porVendedora.length === 0 ? <p className="cmd-dim">Sem orçamentos ainda.</p> : (
                <ul className="cmd-lista">
                  {d.porVendedora.slice(0, 5).map((v) => (
                    <li key={v.nome}><b>{v.nome}</b> · {v.aprovados}/{v.total} fechados<span className="cmd-valor">{curto(v.valor)}</span></li>
                  ))}
                </ul>
              )}
            </Painel>

            <Painel icon={<Wrench size={14} />} titulo="Operação">
              <div className="cmd-funil">
                <div><b>{d.osSemana.length}</b><span>próximos 7 dias</span></div>
                <div><b className={d.osAtrasadas.length ? "ruim" : ""}>{d.osAtrasadas.length}</b><span>atrasados</span></div>
                <div><b>{d.devolver.length}</b><span>a devolver</span></div>
              </div>
              {d.devolver.length > 0 && (
                <ul className="cmd-lista cmd-rola">
                  {d.devolver.slice(0, 6).map((m, i) => (
                    <li key={i}>OS {m.os} · <b>{m.qtd} {m.un}</b> de {m.descricao}</li>
                  ))}
                </ul>
              )}
            </Painel>

            <Painel icon={<Radio size={14} />} titulo="Status do sistema" className="cmd-status">
              <ul className="cmd-sis">
                <li><i className="on" /> Banco de dados <em>conectado</em></li>
                <li><i className="on" /> Sincronização em tempo real <em>ativa</em></li>
                <li><i className="on" /> Clientes cadastrados <em>{clientes.length}</em></li>
                <li><i className="on" /> Novos clientes no mês <em>{d.novosClientes}</em></li>
                <li><i className="off" /> Backup automático no Drive <em>a configurar</em></li>
              </ul>
            </Painel>

            <Painel icon={<Bot size={14} />} titulo="Outros agentes" className="cmd-ia">
              <p className="cmd-dim">O TRON já está ativo. Estes são os próximos — cada um entra quando você quiser.</p>
              <ul className="cmd-nos">
                {AGENTES.map((a) => (
                  <li key={a.nome}>
                    <span className="cmd-no-ico">{a.icon}</span>
                    <b>{a.nome}</b>
                    <em>{a.faz}</em>
                    <span className="cmd-no-tag">a ativar</span>
                  </li>
                ))}
              </ul>
            </Painel>
          </div>
        </div>
      )}
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.cmd-tela{position:fixed;inset:0;z-index:70;overflow-y:auto;background:#05080f;color:#e8f0fb;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.cmd-grid-bg{position:fixed;inset:0;pointer-events:none;
  background-image:linear-gradient(rgba(120,180,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(120,180,255,.06) 1px,transparent 1px);
  background-size:42px 42px;
  -webkit-mask-image:radial-gradient(120% 90% at 50% 0%,#000 25%,transparent 85%);
  mask-image:radial-gradient(120% 90% at 50% 0%,#000 25%,transparent 85%)}
.cmd-tela::before{content:"";position:fixed;inset:0;pointer-events:none;
  background:radial-gradient(70% 45% at 50% 0%,rgba(255,140,50,.25),transparent 70%),
             radial-gradient(45% 40% at 100% 100%,rgba(60,140,255,.14),transparent 70%)}

.cmd-topo{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:13px 18px;background:rgba(5,8,15,.86);border-bottom:1px solid rgba(120,180,255,.16);backdrop-filter:blur(8px)}
.cmd-marca{display:flex;align-items:center;gap:12px}
.cmd-logo{width:40px;height:40px;display:grid;place-items:center;color:#fff;background:#e2640a;
  box-shadow:0 0 26px rgba(255,140,50,.6);clip-path:polygon(22% 0,100% 0,100% 78%,78% 100%,0 100%,0 22%)}
.cmd-topo h1{margin:0;font-size:14px;letter-spacing:3px;font-weight:800;font-family:ui-monospace,"Courier New",monospace}
.cmd-topo h1 em{font-style:normal;color:#ff9a45}
.cmd-topo p{margin:3px 0 0;font-size:10px;color:#6f87a8;letter-spacing:2px;font-family:ui-monospace,monospace}
.cmd-x{width:38px;height:38px;border-radius:10px;border:1px solid rgba(120,180,255,.22);background:rgba(120,180,255,.08);
  color:#e8f0fb;display:grid;place-items:center;cursor:pointer}

/* tranca */
.cmd-tranca{position:relative;display:flex;align-items:center;justify-content:center;padding:44px 20px}
.cmd-tranca form{width:100%;max-width:350px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;
  background:rgba(10,18,32,.8);border:1px solid rgba(120,180,255,.2);padding:30px 24px;
  clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)}
.cmd-cadeado{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;color:#ff9a45;
  background:rgba(255,140,50,.12);border:1px solid rgba(255,140,50,.45);box-shadow:0 0 30px rgba(255,140,50,.25)}
.cmd-tranca h2{margin:6px 0 0;font-size:15px;letter-spacing:3px;font-family:ui-monospace,monospace}
.cmd-tranca p{margin:0 0 6px;font-size:13px;color:#7e94b4;line-height:1.5}
.cmd-tranca input{width:100%;box-sizing:border-box;border-radius:9px;padding:12px;font-size:16px;font-family:inherit;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.25);color:#fff;outline:none}
.cmd-tranca input:focus{border-color:#ff8c32;box-shadow:0 0 0 3px rgba(255,140,50,.18)}
.cmd-tranca button{width:100%;border:none;border-radius:9px;padding:12px;font-size:13px;font-weight:800;letter-spacing:2px;
  font-family:ui-monospace,monospace;background:#e2640a;color:#fff;cursor:pointer}
.cmd-tranca button:disabled{opacity:.6}
.cmd-cancelar{background:transparent!important;color:#6f87a8!important;letter-spacing:1px!important;font-weight:600!important}
.cmd-erro{color:#ff6b6b;font-size:13px;font-weight:600}

/* núcleo */
.cmd-sala{position:relative;max-width:1340px;margin:0 auto;padding:22px 16px 40px}
.cmd-nucleo{position:relative;height:216px;display:grid;place-items:center;margin:6px 0 10px}
.cmd-anel{position:absolute;border-radius:50%;border:1px solid rgba(255,140,50,.35)}
.cmd-anel.a1{width:196px;height:196px;border-style:dashed;animation:cmdgira 26s linear infinite}
.cmd-anel.a2{width:152px;height:152px;border-color:rgba(120,180,255,.3);animation:cmdgira 16s linear infinite reverse}
.cmd-anel.a3{width:244px;height:244px;border-color:rgba(255,140,50,.14);animation:cmdpulso 3.4s ease-in-out infinite}
@keyframes cmdgira{to{transform:rotate(360deg)}}
@keyframes cmdpulso{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.06);opacity:1}}
.cmd-centro{position:relative;width:150px;height:150px;border-radius:50%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:3px;text-align:center;padding:10px;
  background:radial-gradient(circle at 50% 35%,rgba(255,140,50,.3),rgba(5,8,15,.95) 70%);
  box-shadow:0 0 60px rgba(255,140,50,.35),inset 0 0 30px rgba(255,140,50,.18);border:1px solid rgba(255,140,50,.5)}
.cmd-centro strong{font-size:24px;font-weight:800;line-height:1;font-family:ui-monospace,monospace;color:#fff}
.cmd-centro-rot{font-size:8.5px;letter-spacing:1.6px;color:#ff9a45;font-family:ui-monospace,monospace}
.cmd-centro-sub{font-size:10px;color:#7e94b4;line-height:1.3}

/* faixa de números */
.cmd-faixa{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px}
@media (min-width:700px){.cmd-faixa{grid-template-columns:repeat(6,1fr)}}
.cmd-chip{background:rgba(10,18,32,.75);border:1px solid rgba(120,180,255,.16);padding:10px 12px;
  clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)}
.cmd-chip b{display:block;font-size:19px;font-weight:800;font-family:ui-monospace,monospace;color:#fff}
.cmd-chip span{display:block;font-size:10px;color:#6f87a8;margin-top:3px;letter-spacing:.4px}
.cmd-chip.perigo{border-color:rgba(255,107,107,.5)}
.cmd-chip.perigo b{color:#ff6b6b}

/* painéis */
.cmd-grade{display:grid;grid-template-columns:1fr;gap:12px}
@media (min-width:760px){.cmd-grade{grid-template-columns:repeat(2,1fr)}}
@media (min-width:760px){.cmd-tron{grid-column:span 2}}
@media (min-width:1120px){.cmd-grade{grid-template-columns:repeat(3,1fr)}
  .cmd-tron{grid-column:span 2;grid-row:span 2}
  .cmd-ia{grid-column:span 2}}
.cmd-painel{background:rgba(10,18,32,.72);border:1px solid rgba(120,180,255,.16);backdrop-filter:blur(3px);
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
.cmd-painel.alerta{border-color:rgba(255,107,107,.45)}
.cmd-painel header{display:flex;align-items:center;gap:8px;padding:11px 14px;font-size:10.5px;font-weight:800;
  letter-spacing:2px;text-transform:uppercase;color:#ff9a45;border-bottom:1px solid rgba(120,180,255,.14);
  font-family:ui-monospace,monospace}
.cmd-led{margin-left:auto;width:7px;height:7px;border-radius:50%;background:#22d39a;box-shadow:0 0 10px #22d39a;animation:cmdled 2.2s ease-in-out infinite}
.cmd-painel.alerta .cmd-led{background:#ff6b6b;box-shadow:0 0 10px #ff6b6b}
@keyframes cmdled{0%,100%{opacity:1}50%{opacity:.25}}
.cmd-corpo{padding:14px}

.cmd-funil{display:flex;gap:12px}
.cmd-funil div{flex:1}
.cmd-funil b{display:block;font-size:21px;font-weight:800;font-family:ui-monospace,monospace;color:#fff}
.cmd-funil b.ruim{color:#ff6b6b}
.cmd-funil span{display:block;font-size:10px;color:#6f87a8;margin-top:2px}

.cmd-lista{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.cmd-lista li{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:#b9cbe4;
  padding-bottom:8px;border-bottom:1px solid rgba(120,180,255,.1)}
.cmd-lista li:last-child{border-bottom:none;padding-bottom:0}
.cmd-lista b{color:#fff}
.cmd-rola{max-height:150px;overflow-y:auto}
.cmd-valor{margin-left:auto;font-weight:800;color:#22d39a;font-family:ui-monospace,monospace}
.cmd-dim{color:#6f87a8;font-size:12.5px;margin:0;line-height:1.5}
.cmd-ok{color:#22d39a;font-size:13px;font-weight:700;margin:0;font-family:ui-monospace,monospace}

.cmd-graf{display:flex;flex-direction:column;gap:6px}
.cmd-graf svg{width:100%;height:72px;display:block}
.cmd-graf-eixo{display:flex;justify-content:space-between;font-size:10px;color:#6f87a8;font-family:ui-monospace,monospace}

.cmd-barras{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
.cmd-barra-rot{display:flex;justify-content:space-between;font-size:12px;color:#b9cbe4;margin-bottom:5px}
.cmd-barra-rot em{font-style:normal;color:#22d39a;font-weight:800;font-family:ui-monospace,monospace}
.cmd-barra{display:block;height:7px;background:rgba(120,180,255,.12);border-radius:99px;overflow:hidden}
.cmd-barra i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#ff8c32,#ffc178)}

.cmd-sis{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px;font-size:12.5px;color:#b9cbe4}
.cmd-sis li{display:flex;align-items:center;gap:9px}
.cmd-sis i{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.cmd-sis i.on{background:#22d39a;box-shadow:0 0 9px #22d39a}
.cmd-sis i.off{background:#6f87a8}
.cmd-sis em{margin-left:auto;font-style:normal;font-size:11px;color:#6f87a8;font-family:ui-monospace,monospace;text-transform:uppercase;letter-spacing:.6px}

.cmd-nos{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:1fr;gap:9px}
@media (min-width:560px){.cmd-nos{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1120px){.cmd-nos{grid-template-columns:repeat(3,1fr)}}
.cmd-nos li{display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:rgba(120,180,255,.05);
  border:1px solid rgba(120,180,255,.16);padding:10px;
  clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)}
.cmd-no-ico{width:30px;height:30px;display:grid;place-items:center;flex-shrink:0;color:#ff9a45;
  background:rgba(255,140,50,.14);border:1px solid rgba(255,140,50,.3);border-radius:8px}
.cmd-nos b{font-size:12px;letter-spacing:1.4px;font-family:ui-monospace,monospace}
.cmd-nos em{width:100%;font-style:normal;font-size:10.5px;color:#6f87a8;padding-left:39px;margin-top:-4px}
.cmd-no-tag{margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#6f87a8;
  border:1px solid rgba(120,180,255,.22);border-radius:99px;padding:3px 8px;white-space:nowrap}
    `}</style>
  );
}
