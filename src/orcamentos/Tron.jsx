import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Check, X, Loader, Copy, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { supabase } from "./supabaseOrc";

/* ============ TRON — assistente do Centro de Comando ============ */

const itensTotal = (itens) => (itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
const valorOS = (os) =>
  os.valor !== undefined && os.valor !== null && os.valor !== "" ? Number(os.valor) || 0 : itensTotal(os.itens);
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Retrato enxuto do sistema: só o que o TRON precisa para responder e agir.
function montarContexto({ clientes, orcamentos, ordens, vendedoras, hoje }) {
  return {
    hoje,
    expediente: "segunda a sexta, 08:00 às 18:00",
    vendedoras: vendedoras.map((v) => v.nome),
    clientes: clientes.map((c) => ({
      id: c.id, nome: c.nome, telefone: c.telefone, endereco: [c.endereco, c.bairro].filter(Boolean).join(" - "),
      origem: c.origem || "",
    })),
    orcamentos: orcamentos.map((o) => ({
      id: o.id, numero: o.numero, clienteId: o.clienteId, cliente: o.cliente, status: o.status,
      dataVisita: o.dataVisita, horaVisita: o.horaVisita || "", dataEnvio: o.dataEnvio || "",
      prazoEnvio: o.prazoEnvio || "", vendedor: o.vendedor || "", total: itensTotal(o.itens),
      oQueQuer: o.descricaoServico || "", levantamento: o.levantamento || "",
      pagamento: o.formaPagamento || "", duracaoServico: o.duracaoServico || 2,
    })),
    ordens: ordens.map((o) => ({
      id: o.id, numero: o.numero, clienteId: o.clienteId, cliente: o.cliente, status: o.status,
      dataServico: o.dataServico, horaServico: o.horaServico || "", duracaoHoras: o.duracaoHoras || 2,
      valor: valorOS(o), descricao: o.descricao || "", relatorio: o.relatorio || "",
      materiaisPendentes: (Array.isArray(o.materiais) ? o.materiais : [])
        .filter((m) => m.pegoNaLoja && (Number(m.qtdPega) || 0) - (Number(m.qtdUsada) || 0) > 0)
        .map((m) => `${(Number(m.qtdPega) || 0) - (Number(m.qtdUsada) || 0)} ${m.unidade || "UN"} de ${m.descricao}`),
    })),
  };
}

/* ===== voz: o próprio celular/computador fala, sem custo nenhum ===== */
const TEM_VOZ = typeof window !== "undefined" && "speechSynthesis" in window;
const KEY_VOZ = "vigiar:tron:voz";

// Escolhe a melhor voz instalada: as "Natural"/"Online" do Windows e as do Google
// soam bem mais humanas que a padrão do sistema.
const BOAS = [/natural/i, /online/i, /google/i, /francisca/i, /thal[ií]ta/i, /luciana/i, /ant[oô]nio/i];
function vozBrasileira() {
  const vozes = (window.speechSynthesis.getVoices() || []).filter((v) => /^pt/i.test(v.lang));
  if (!vozes.length) return null;
  const br = vozes.filter((v) => /pt[-_]BR/i.test(v.lang));
  const lista = br.length ? br : vozes;
  for (const padrao of BOAS) {
    const achou = lista.find((v) => padrao.test(v.name));
    if (achou) return achou;
  }
  return lista[0];
}
// Tira marcações e links para a leitura não ficar esquisita.
function paraFalar(texto) {
  return String(texto)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/R\$ ?([\d.]+),(\d{2})/g, (_, inteiro, centavos) =>
      `${inteiro.replace(/\./g, "")} reais${centavos !== "00" ? ` e ${Number(centavos)} centavos` : ""}`)
    .replace(/(\d+)%/g, "$1 por cento")
    .replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => (m === "00" ? `${Number(h)} horas` : `${Number(h)} e ${Number(m)}`))
    .replace(/[*_`#>•·|]/g, " ")
    .replace(/^\s*[-–]\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
// Quebra em frases e emenda uma na outra: some a pausa longa e o corte de texto
// grande que os navegadores fazem, deixando a leitura mais natural.
function falar(texto) {
  if (!TEM_VOZ) return;
  const limpo = paraFalar(texto);
  if (!limpo) return;
  window.speechSynthesis.cancel();
  const voz = vozBrasileira();
  const pedacos = limpo.match(/[^.!?\n]+[.!?]*/g) || [limpo];
  pedacos.forEach((pedaco) => {
    const frase = pedaco.trim();
    if (!frase) return;
    const fala = new SpeechSynthesisUtterance(frase);
    if (voz) fala.voice = voz;
    fala.lang = (voz && voz.lang) || "pt-BR";
    fala.rate = 1.0;   // ritmo de conversa
    fala.pitch = 1.0;
    window.speechSynthesis.speak(fala);
  });
}

const ROTULO_ACAO = {
  criar_cliente: "Cadastrar cliente",
  criar_orcamento: "Agendar visita de orçamento",
  agendar_servico: "Agendar serviço (criar OS)",
  mudar_status_orcamento: "Mudar situação do orçamento",
};

function Acao({ bloco, clientes, onConfirmar, onRecusar, estado }) {
  const e = bloco.input || {};
  const nomeCliente = (id) => (clientes.find((c) => c.id === id) || {}).nome || id || "—";
  const linhas = [];
  if (bloco.name === "criar_cliente") {
    linhas.push(["Nome", e.nome], ["Telefone", e.telefone], ["Endereço", [e.endereco, e.bairro].filter(Boolean).join(" - ")], ["Origem", e.origem]);
  } else if (bloco.name === "criar_orcamento") {
    linhas.push(["Cliente", nomeCliente(e.clienteId)], ["Visita", `${e.dataVisita || ""} ${e.horaVisita || ""}`], ["O que quer", e.descricaoServico], ["Vendedor", e.vendedor]);
  } else if (bloco.name === "agendar_servico") {
    linhas.push(["Cliente", nomeCliente(e.clienteId)], ["Data", `${e.dataServico || ""} ${e.horaServico || ""}`],
      ["Duração", `${e.duracaoHoras || 2}h`], ["Serviço", e.descricao], ["Valor", e.valor ? brl(e.valor) : "—"]);
  } else if (bloco.name === "mudar_status_orcamento") {
    linhas.push(["Orçamento", e.orcamentoId], ["Nova situação", e.status], ["Motivo", e.motivo]);
  }

  return (
    <div className={"tron-acao" + (estado ? ` ${estado}` : "")}>
      <header><AlertTriangle size={14} /> {ROTULO_ACAO[bloco.name] || bloco.name}</header>
      <dl>
        {linhas.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {estado === "feito" ? <p className="tron-feito">✓ Feito</p>
        : estado === "recusado" ? <p className="tron-recusado">Cancelado</p>
          : (
            <div className="tron-acao-btns">
              <button className="sim" onClick={onConfirmar}><Check size={14} /> Confirmar</button>
              <button className="nao" onClick={onRecusar}><X size={14} /> Agora não</button>
            </div>
          )}
    </div>
  );
}

export default function Tron({ clientes, orcamentos, ordens, vendedoras, acoes, onToast }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [conversa, setConversa] = useState([]); // formato da API: {role, content}
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const [estados, setEstados] = useState({}); // id do tool_use -> feito | recusado
  const [voz, setVoz] = useState(() => {
    try { return localStorage.getItem(KEY_VOZ) !== "0"; } catch { return true; }
  });
  const fim = useRef(null);

  const alternarVoz = () => {
    const novo = !voz;
    setVoz(novo);
    try { localStorage.setItem(KEY_VOZ, novo ? "1" : "0"); } catch { /* ignora */ }
    if (!novo && TEM_VOZ) window.speechSynthesis.cancel();
  };

  const contexto = useMemo(
    () => montarContexto({ clientes, orcamentos, ordens, vendedoras, hoje }),
    [clientes, orcamentos, ordens, vendedoras, hoje],
  );

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [conversa, pensando]);

  async function chamar(mensagens) {
    setPensando(true);
    setErro("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch("/api/tron", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensagens, contexto }),
      });
      const resposta = await r.json();
      if (!r.ok) { setErro(resposta.erro || "Falha ao falar com o TRON."); return null; }
      const nova = [...mensagens, { role: "assistant", content: resposta.content }];
      setConversa(nova);
      // Fala a resposta assim que ela chega (se a voz estiver ligada).
      if (voz) {
        const texto = (resposta.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ");
        if (texto.trim()) falar(texto);
      }
      return nova;
    } catch (e) {
      setErro("Sem conexão com o TRON: " + String(e.message || e));
      return null;
    } finally {
      setPensando(false);
    }
  }

  const enviar = async (e, textoDireto) => {
    e?.preventDefault();
    const pergunta = String(textoDireto ?? texto).trim();
    if (!pergunta || pensando) return;
    setTexto("");
    const mensagens = [...conversa, { role: "user", content: [{ type: "text", text: pergunta }] }];
    setConversa(mensagens);
    await chamar(mensagens);
  };

  // Confirmou: executa a ação de verdade e devolve o resultado para o TRON continuar.
  const confirmar = async (bloco) => {
    setEstados((s) => ({ ...s, [bloco.id]: "fazendo" }));
    let resultado;
    try {
      resultado = await acoes(bloco.name, bloco.input || {});
      setEstados((s) => ({ ...s, [bloco.id]: "feito" }));
      onToast && onToast(resultado.mensagem || "Feito.");
    } catch (err) {
      resultado = { ok: false, mensagem: String(err.message || err) };
      setEstados((s) => ({ ...s, [bloco.id]: "" }));
      onToast && onToast("Não deu: " + resultado.mensagem);
    }
    const mensagens = [...conversa, {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: bloco.id, content: JSON.stringify(resultado) }],
    }];
    setConversa(mensagens);
    await chamar(mensagens);
  };

  const recusar = async (bloco) => {
    setEstados((s) => ({ ...s, [bloco.id]: "recusado" }));
    const mensagens = [...conversa, {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: bloco.id, content: "O Gelvan não confirmou esta ação." }],
    }];
    setConversa(mensagens);
    await chamar(mensagens);
  };

  const copiar = async (t) => {
    try { await navigator.clipboard.writeText(t); onToast && onToast("Copiado."); }
    catch { onToast && onToast("Não consegui copiar."); }
  };

  const sugestoes = [
    "Quem eu preciso cobrar hoje?",
    "Como está o mês até agora?",
    "Qual origem está dando mais lucro?",
    "O que tenho para fazer esta semana?",
  ];

  return (
    <div className="tron">
      <div className="tron-conversa">
        {conversa.length === 0 && !pensando && (
          <div className="tron-vazio">
            <span className="tron-ava"><Bot size={20} /></span>
            <p>Sou o <b>TRON</b>. Vejo seus clientes, orçamentos, serviços e agenda. Pergunte o que quiser — e, quando for mexer no sistema, eu mostro antes e você confirma.</p>
            <div className="tron-sug">
              {sugestoes.map((s) => (
                <button key={s} onClick={() => enviar(null, s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {conversa.map((m, i) => {
          const blocos = Array.isArray(m.content) ? m.content : [{ type: "text", text: String(m.content) }];
          return blocos.map((b, j) => {
            if (b.type === "text" && b.text?.trim()) {
              return (
                <div key={`${i}-${j}`} className={"tron-msg " + (m.role === "user" ? "eu" : "ele")}>
                  <p>{b.text}</p>
                  {m.role === "assistant" && (
                    <button className="tron-copiar" onClick={() => copiar(b.text)} title="Copiar"><Copy size={12} /></button>
                  )}
                </div>
              );
            }
            if (b.type === "tool_use") {
              return (
                <Acao key={b.id} bloco={b} clientes={clientes} estado={estados[b.id]}
                  onConfirmar={() => confirmar(b)} onRecusar={() => recusar(b)} />
              );
            }
            return null;
          });
        })}

        {pensando && <div className="tron-msg ele pensando"><Loader size={14} /> pensando…</div>}
        {erro && <div className="tron-erro"><AlertTriangle size={14} /> {erro}</div>}
        <div ref={fim} />
      </div>

      <form className="tron-barra" onSubmit={enviar}>
        {TEM_VOZ && (
          <button type="button" className={"tron-voz" + (voz ? " on" : "")} onClick={alternarVoz}
            title={voz ? "Desligar a voz" : "Ligar a voz"} aria-label={voz ? "Desligar a voz" : "Ligar a voz"}>
            {voz ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        )}
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Fale com o TRON…" disabled={pensando} />
        <button type="submit" disabled={pensando || !texto.trim()} aria-label="Enviar"><Send size={16} /></button>
      </form>

      <style>{`
.tron{display:flex;flex-direction:column;gap:10px}
.tron-conversa{display:flex;flex-direction:column;gap:10px;max-height:460px;overflow-y:auto;padding-right:4px}
.tron-vazio{text-align:center;padding:10px 4px}
.tron-ava{width:44px;height:44px;border-radius:50%;display:inline-grid;place-items:center;color:#ff9a45;
  background:rgba(255,140,50,.14);border:1px solid rgba(255,140,50,.45);box-shadow:0 0 24px rgba(255,140,50,.25)}
.tron-vazio p{font-size:13px;color:#b9cbe4;line-height:1.55;margin:10px 0 14px}
.tron-sug{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}
.tron-sug button{background:rgba(120,180,255,.08);border:1px solid rgba(120,180,255,.22);color:#b9cbe4;
  border-radius:99px;padding:7px 12px;font-size:12px;font-family:inherit;cursor:pointer}
.tron-msg{position:relative;font-size:13.5px;line-height:1.55;padding:11px 13px;border-radius:12px;max-width:92%}
.tron-msg p{margin:0;white-space:pre-wrap}
.tron-msg.eu{align-self:flex-end;background:rgba(255,140,50,.16);border:1px solid rgba(255,140,50,.35);color:#ffe3cc}
.tron-msg.ele{align-self:flex-start;background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.18);color:#dce7f6;padding-right:30px}
.tron-msg.pensando{display:flex;align-items:center;gap:7px;color:#6f87a8;font-family:ui-monospace,monospace;font-size:12px}
.tron-msg.pensando svg{animation:tronroda 1s linear infinite}
@keyframes tronroda{to{transform:rotate(360deg)}}
.tron-copiar{position:absolute;top:7px;right:7px;background:none;border:none;color:#6f87a8;cursor:pointer;padding:2px}
.tron-erro{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#ff9c9c;background:rgba(255,107,107,.1);
  border:1px solid rgba(255,107,107,.35);border-radius:10px;padding:10px 12px;line-height:1.45}
.tron-acao{background:rgba(255,140,50,.07);border:1px solid rgba(255,140,50,.4);border-radius:12px;padding:11px 13px}
.tron-acao header{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:1.4px;
  text-transform:uppercase;color:#ff9a45;font-family:ui-monospace,monospace;margin-bottom:9px}
.tron-acao dl{margin:0;display:flex;flex-direction:column;gap:5px}
.tron-acao dl div{display:flex;gap:8px;font-size:12.5px}
.tron-acao dt{color:#6f87a8;min-width:78px}
.tron-acao dd{margin:0;color:#fff;font-weight:600}
.tron-acao-btns{display:flex;gap:8px;margin-top:11px}
.tron-acao-btns button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;
  border-radius:9px;padding:9px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer}
.tron-acao-btns .sim{background:#22d39a;color:#04261a}
.tron-acao-btns .nao{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)}
.tron-feito{margin:10px 0 0;color:#22d39a;font-weight:700;font-size:12.5px}
.tron-recusado{margin:10px 0 0;color:#6f87a8;font-size:12.5px}
.tron-barra{display:flex;gap:8px}
.tron-barra input{flex:1;background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;
  border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;outline:none}
.tron-barra input:focus{border-color:#ff8c32}
.tron-barra button{width:46px;border:none;border-radius:10px;background:#e2640a;color:#fff;cursor:pointer;display:grid;place-items:center}
.tron-barra button:disabled{opacity:.45}
.tron-voz{background:rgba(120,180,255,.1)!important;border:1px solid rgba(120,180,255,.22)!important;color:#6f87a8!important}
.tron-voz.on{color:#22d39a!important;border-color:rgba(34,211,154,.45)!important}
      `}</style>
    </div>
  );
}
