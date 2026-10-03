import React, { useMemo, useState } from "react";
import {
  ShieldCheck, X, Lock, TrendingUp, FileText, Wrench, Users, Package,
  AlertTriangle, Megaphone, Bot, CircleDollarSign,
} from "lucide-react";
import { supabase } from "./supabaseOrc";

/* ============ Centro de Comando — área restrita do dono ============ */

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inicioDoMes = (iso) => iso.slice(0, 7);
const itensTotal = (itens) => (itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
const valorOS = (os) =>
  os.valor !== undefined && os.valor !== null && os.valor !== "" ? Number(os.valor) || 0 : itensTotal(os.itens);
const diasEntre = (isoA, isoB) => Math.round((new Date(isoB) - new Date(isoA)) / 86400000);

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
        <h2>Área restrita</h2>
        <p>Confirme sua senha para abrir o Centro de Comando.</p>
        <input type="password" autoFocus value={senha} onChange={(ev) => setSenha(ev.target.value)}
          placeholder="Sua senha" autoComplete="current-password" required />
        {erro && <span className="cmd-erro">{erro}</span>}
        <button type="submit" disabled={indo}>{indo ? "Verificando…" : "Entrar"}</button>
        <button type="button" className="cmd-cancelar" onClick={onFechar}>Cancelar</button>
      </form>
    </div>
  );
}

function Modulo({ icon, titulo, children, destaque }) {
  return (
    <section className={"cmd-mod" + (destaque ? " destaque" : "")}>
      <header>{icon}<span>{titulo}</span></header>
      <div className="cmd-mod-corpo">{children}</div>
    </section>
  );
}

function Numero({ valor, rotulo, cor }) {
  return (
    <div className="cmd-num">
      <b style={cor ? { color: cor } : undefined}>{valor}</b>
      <span>{rotulo}</span>
    </div>
  );
}

export default function Comando({ orcamentos, ordens, clientes, email, onFechar }) {
  const [liberado, setLiberado] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = inicioDoMes(hoje);

  const d = useMemo(() => {
    const osMes = ordens.filter((o) => o.status === "concluida" && (o.dataServico || "").startsWith(mes));
    const faturadoMes = osMes.reduce((s, o) => s + valorOS(o), 0);
    const ticket = osMes.length ? faturadoMes / osMes.length : 0;

    const enviados = orcamentos.filter((o) => o.status === "enviado");
    const paradosNoEnviado = enviados
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

    const novosClientes = clientes.filter((c) => (c.criadoEm || "").startsWith(mes)).length;

    return {
      faturadoMes, ticket, osMes: osMes.length, enviados, paradosNoEnviado, taxa, aprovados: aprovados.length,
      aEnviar, atrasadosEnvio, visitasAtrasadas, osAtrasadas, osSemana, devolver, porVendedora, porOrigem, novosClientes,
    };
  }, [orcamentos, ordens, clientes, hoje, mes]);

  const alertas = d.atrasadosEnvio.length + d.visitasAtrasadas.length + d.osAtrasadas.length + d.paradosNoEnviado.length;

  const AGENTES = [
    { nome: "Vendas", icon: <TrendingUp size={15} />, faz: "Cobra orçamento parado e escreve o follow-up" },
    { nome: "Tráfego", icon: <Megaphone size={15} />, faz: "Diz onde investir e o que cortar" },
    { nome: "Financeiro", icon: <CircleDollarSign size={15} />, faz: "Risco de caixa, inadimplência e margem" },
    { nome: "Técnico", icon: <Wrench size={15} />, faz: "Rota do dia e material da semana" },
  ];

  return (
    <div className="cmd-tela">
      <Estilo />
      <header className="cmd-topo">
        <div className="cmd-marca">
          <span className="cmd-logo"><ShieldCheck size={20} /></span>
          <div>
            <h1>CENTRO DE COMANDO</h1>
            <p>Vigiar · visão geral da empresa</p>
          </div>
        </div>
        <button className="cmd-x" onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
      </header>

      {!liberado ? (
        <Tranca email={email} onLiberado={() => setLiberado(true)} onFechar={onFechar} />
      ) : (
        <div className="cmd-grade">
          <Modulo icon={<CircleDollarSign size={15} />} titulo="Faturamento do mês" destaque>
            <div className="cmd-nums">
              <Numero valor={brl(d.faturadoMes)} rotulo="serviços concluídos" cor="#22d39a" />
              <Numero valor={d.osMes} rotulo="serviços no mês" />
              <Numero valor={brl(d.ticket)} rotulo="ticket médio" />
            </div>
          </Modulo>

          <Modulo icon={<AlertTriangle size={15} />} titulo={`Precisa de você (${alertas})`} destaque={alertas > 0}>
            {alertas === 0 ? <p className="cmd-ok">Nada atrasado. Tudo em dia.</p> : (
              <ul className="cmd-lista">
                {d.atrasadosEnvio.length > 0 && <li><b>{d.atrasadosEnvio.length}</b> orçamento(s) com prazo de envio vencido</li>}
                {d.visitasAtrasadas.length > 0 && <li><b>{d.visitasAtrasadas.length}</b> visita(s) de orçamento atrasada(s)</li>}
                {d.osAtrasadas.length > 0 && <li><b>{d.osAtrasadas.length}</b> serviço(s) agendado(s) que já passaram da data</li>}
                {d.paradosNoEnviado.length > 0 && <li><b>{d.paradosNoEnviado.length}</b> orçamento(s) enviados sem resposta há 3 dias ou mais</li>}
              </ul>
            )}
          </Modulo>

          <Modulo icon={<FileText size={15} />} titulo="Funil de orçamentos">
            <div className="cmd-nums">
              <Numero valor={d.aEnviar.length} rotulo="montar / enviar" />
              <Numero valor={d.enviados.length} rotulo="aguardando cliente" />
              <Numero valor={`${d.taxa}%`} rotulo="taxa de fechamento" cor={d.taxa >= 40 ? "#22d39a" : d.taxa < 20 ? "#ff6b6b" : undefined} />
            </div>
            {d.paradosNoEnviado.length > 0 && (
              <ul className="cmd-lista cmd-scroll">
                {d.paradosNoEnviado.slice(0, 6).map((o) => (
                  <li key={o.id}><b>{o.dias}d</b> parado · Nº {o.numero} · {o.cliente} · {brl(itensTotal(o.itens))}</li>
                ))}
              </ul>
            )}
          </Modulo>

          <Modulo icon={<Wrench size={15} />} titulo="Operação">
            <div className="cmd-nums">
              <Numero valor={d.osSemana.length} rotulo="serviços nos 7 dias" />
              <Numero valor={d.osAtrasadas.length} rotulo="atrasados" cor={d.osAtrasadas.length ? "#ff6b6b" : undefined} />
              <Numero valor={d.devolver.length} rotulo="materiais a devolver" />
            </div>
            {d.devolver.length > 0 && (
              <ul className="cmd-lista cmd-scroll">
                {d.devolver.slice(0, 6).map((m, i) => (
                  <li key={i}>OS {m.os} · {m.qtd} {m.un} de {m.descricao} <span className="cmd-dim">({m.cliente})</span></li>
                ))}
              </ul>
            )}
          </Modulo>

          <Modulo icon={<Users size={15} />} titulo="Vendedoras">
            {d.porVendedora.length === 0 ? <p className="cmd-dim">Sem orçamentos ainda.</p> : (
              <ul className="cmd-lista">
                {d.porVendedora.slice(0, 5).map((v) => (
                  <li key={v.nome}>
                    <b>{v.nome}</b> · {v.aprovados}/{v.total} fechados
                    <span className="cmd-valor">{brl(v.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Modulo>

          <Modulo icon={<Megaphone size={15} />} titulo="De onde vem o dinheiro">
            {d.porOrigem.length === 0 ? <p className="cmd-dim">Cadastre a origem dos clientes para ver isto.</p> : (
              <ul className="cmd-lista">
                {d.porOrigem.slice(0, 5).map((o) => (
                  <li key={o.nome}>
                    <b>{o.nome}</b> · {o.servicos} serviço(s)
                    <span className="cmd-valor">{brl(o.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Modulo>

          <Modulo icon={<Package size={15} />} titulo="Base de clientes">
            <div className="cmd-nums">
              <Numero valor={clientes.length} rotulo="clientes cadastrados" />
              <Numero valor={d.novosClientes} rotulo="novos no mês" />
              <Numero valor={d.aprovados} rotulo="orçamentos aprovados" />
            </div>
          </Modulo>

          <Modulo icon={<Bot size={15} />} titulo="Agentes de IA">
            <p className="cmd-dim">Ainda não ativados. Cada um entra quando você quiser, um por vez.</p>
            <ul className="cmd-agentes">
              {AGENTES.map((a) => (
                <li key={a.nome}>
                  <span className="cmd-ag-ico">{a.icon}</span>
                  <span className="cmd-ag-txt"><b>{a.nome}</b><em>{a.faz}</em></span>
                  <span className="cmd-ag-tag">a ativar</span>
                </li>
              ))}
            </ul>
          </Modulo>
        </div>
      )}
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.cmd-tela{position:fixed;inset:0;z-index:70;overflow-y:auto;background:#070c14;color:#e6edf7;
  background-image:radial-gradient(90% 60% at 50% 0%,rgba(226,100,10,.22),transparent 70%);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.cmd-topo{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 18px;background:rgba(7,12,20,.92);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(6px)}
.cmd-marca{display:flex;align-items:center;gap:12px}
.cmd-logo{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;color:#fff;
  background:#e2640a;box-shadow:0 0 22px rgba(226,100,10,.55)}
.cmd-topo h1{margin:0;font-size:15px;letter-spacing:2.5px;font-weight:800}
.cmd-topo p{margin:2px 0 0;font-size:11px;color:#8ba0bd;letter-spacing:.4px}
.cmd-x{width:38px;height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);
  color:#e6edf7;display:grid;place-items:center;cursor:pointer}

.cmd-tranca{display:flex;align-items:center;justify-content:center;padding:40px 20px}
.cmd-tranca form{width:100%;max-width:340px;display:flex;flex-direction:column;align-items:center;gap:10px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:28px 22px;text-align:center}
.cmd-cadeado{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#e2640a;
  background:rgba(226,100,10,.14);border:1px solid rgba(226,100,10,.4)}
.cmd-tranca h2{margin:6px 0 0;font-size:17px}
.cmd-tranca p{margin:0 0 6px;font-size:13px;color:#8ba0bd;line-height:1.5}
.cmd-tranca input{width:100%;box-sizing:border-box;border-radius:11px;padding:12px;font-size:16px;font-family:inherit;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);color:#fff;outline:none}
.cmd-tranca input:focus{border-color:#e2640a}
.cmd-tranca button{width:100%;border:none;border-radius:11px;padding:12px;font-size:15px;font-weight:700;
  font-family:inherit;background:#e2640a;color:#fff;cursor:pointer}
.cmd-tranca button:disabled{opacity:.6}
.cmd-cancelar{background:transparent!important;color:#8ba0bd!important;font-weight:600!important}
.cmd-erro{color:#ff6b6b;font-size:13px;font-weight:600}

.cmd-grade{display:grid;grid-template-columns:1fr;gap:12px;padding:16px;max-width:1280px;margin:0 auto}
@media (min-width:760px){.cmd-grade{grid-template-columns:repeat(2,1fr);padding:22px}}
@media (min-width:1120px){.cmd-grade{grid-template-columns:repeat(3,1fr)}}
.cmd-mod{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden}
.cmd-mod.destaque{border-color:rgba(226,100,10,.45);box-shadow:0 0 0 1px rgba(226,100,10,.12),0 10px 30px rgba(0,0,0,.35)}
.cmd-mod header{display:flex;align-items:center;gap:8px;padding:12px 14px;font-size:12px;font-weight:800;
  letter-spacing:1.2px;text-transform:uppercase;color:#f0a35f;border-bottom:1px solid rgba(255,255,255,.08)}
.cmd-mod-corpo{padding:14px}
.cmd-nums{display:flex;gap:14px;flex-wrap:wrap}
.cmd-num{flex:1;min-width:92px}
.cmd-num b{display:block;font-size:22px;font-weight:800;line-height:1.15}
.cmd-num span{display:block;font-size:11px;color:#8ba0bd;margin-top:3px;line-height:1.3}
.cmd-lista{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.cmd-lista li{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:13px;color:#cbd8ea;
  padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.06)}
.cmd-lista li:last-child{border-bottom:none;padding-bottom:0}
.cmd-lista b{color:#fff}
.cmd-scroll{max-height:168px;overflow-y:auto}
.cmd-valor{margin-left:auto;font-weight:800;color:#22d39a}
.cmd-dim{color:#8ba0bd;font-size:13px;margin:0;line-height:1.5}
.cmd-ok{color:#22d39a;font-size:14px;font-weight:700;margin:0}
.cmd-agentes{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
.cmd-agentes li{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:9px 11px}
.cmd-ag-ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;
  background:rgba(226,100,10,.16);color:#f0a35f}
.cmd-ag-txt{display:flex;flex-direction:column;min-width:0}
.cmd-ag-txt b{font-size:13px}
.cmd-ag-txt em{font-style:normal;font-size:11px;color:#8ba0bd}
.cmd-ag-tag{margin-left:auto;font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;
  color:#8ba0bd;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:3px 8px;white-space:nowrap}
    `}</style>
  );
}
