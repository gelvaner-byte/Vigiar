import React, { useMemo, useState } from "react";
import { Wallet, Plus, Trash2, Check, Lock, Unlock, TrendingUp, Package } from "lucide-react";

/* ===== CAIXA — o dinheiro que entrou de verdade =====
   Serviço fechado NÃO vira faturamento sozinho: o que conta é o que o Gelvan lança aqui.
   No fim do mês ele informa o lucro, e a diferença é o que foi embora em mercadoria. */

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Aceita o que o Gelvan digita ("1.250,50" ou "1250.50") e também o número já salvo.
// Sem o atalho do typeof, 250.5 virava 2505: o ponto era lido como separador de milhar.
const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const limpo = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return Number(limpo) || 0;
};
const MES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hojeStr = () => new Date().toISOString().slice(0, 10);
const mesDe = (iso) => String(iso || "").slice(0, 7);
const rotuloMes = (m) => {
  const [a, mm] = String(m).split("-");
  return `${MES_NOME[Number(mm) - 1] || m} de ${a}`;
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const totalDoMes = (caixa, mes) =>
  (caixa || []).filter((l) => mesDe(l.data) === mes).reduce((s, l) => s + num(l.valor), 0);

// O que o painel e os agentes leem: nunca sai das ordens de serviço.
export function resumoCaixa(caixa = [], fechamentos = [], hoje = hojeStr()) {
  const mes = mesDe(hoje);
  const doMes = caixa.filter((l) => mesDe(l.data) === mes);
  const fechado = fechamentos.find((f) => f.id === mes) || null;
  const base = new Date(`${hoje}T12:00:00`);
  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    serie.push({ rotulo: MES_NOME[d.getMonth()].slice(0, 3), chave, valor: totalDoMes(caixa, chave) });
  }
  return {
    mes,
    vendasDoMes: doMes.reduce((s, l) => s + num(l.valor), 0),
    diasLancados: new Set(doMes.map((l) => l.data)).size,
    serie,
    fechamentoDoMes: fechado,
    mesesFechados: [...fechamentos].sort((a, b) => String(b.id).localeCompare(String(a.id))).slice(0, 12),
  };
}

function Lancar({ onLancar }) {
  const [data, setData] = useState(hojeStr());
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");

  const lancar = () => {
    const v = num(valor);
    if (v <= 0) return;
    onLancar({ id: uid(), data, valor: v, nota: nota.trim(), criadoEm: new Date().toISOString() });
    setValor("");
    setNota("");
  };

  return (
    <div className="cx-lancar">
      <div className="cx-campos">
        <label>
          <span>Dia</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          <span>Quanto entrou</span>
          <input inputMode="decimal" value={valor} placeholder="0,00"
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lancar()} />
        </label>
      </div>
      <label className="cx-nota-campo">
        <span>Do que foi (opcional)</span>
        <input value={nota} placeholder="Ex.: instalação Luana + venda de 2 câmeras"
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lancar()} />
      </label>
      <button className="cx-btn" onClick={lancar} disabled={num(valor) <= 0}>
        <Plus size={15} /> Lançar venda do dia
      </button>
      <span className="cx-dica">
        Lance o total que entrou no dia, serviço e mercadoria juntos, mão de obra incluída.
        Pode lançar mais de uma vez no mesmo dia.
      </span>
    </div>
  );
}

function Fechamento({ mes, vendas, fechamento, onFechar, onReabrir }) {
  const [lucro, setLucro] = useState(fechamento ? String(fechamento.lucro) : "");
  const l = num(lucro);
  const mercadoria = Math.max(0, vendas - l);
  const margem = vendas > 0 ? (l / vendas) * 100 : 0;
  const passouDoTotal = l > vendas;

  if (fechamento) {
    return (
      <div className="cx-fechado">
        <header><Lock size={14} /> {rotuloMes(mes)} fechado</header>
        <div className="cx-split">
          <div><b>{brl(fechamento.vendas)}</b><span>vendeu</span></div>
          <div className="lucro"><b>{brl(fechamento.lucro)}</b><span>lucro</span></div>
          <div className="merc"><b>{brl(fechamento.mercadoria)}</b><span>mercadoria e custos</span></div>
          <div><b>{fechamento.margem.toFixed(1)}%</b><span>margem</span></div>
        </div>
        <button className="cx-btn fantasma" onClick={() => onReabrir(mes)}>
          <Unlock size={14} /> Reabrir para corrigir
        </button>
      </div>
    );
  }

  return (
    <div className="cx-fechar">
      <header>Fechar {rotuloMes(mes)}</header>
      <p className="cx-dica">
        Você vendeu <b>{brl(vendas)}</b> neste mês. Diga quanto sobrou de lucro e eu separo
        o resto como mercadoria e custos.
      </p>
      <label>
        <span>Quanto sobrou de lucro</span>
        <input inputMode="decimal" value={lucro} placeholder="0,00" onChange={(e) => setLucro(e.target.value)} />
      </label>
      {l > 0 && (
        <div className={"cx-previa" + (passouDoTotal ? " erro" : "")}>
          {passouDoTotal ? (
            <span>O lucro não pode ser maior do que o que você vendeu ({brl(vendas)}).</span>
          ) : (
            <span>
              Lucro <b>{brl(l)}</b> · mercadoria e custos <b>{brl(mercadoria)}</b> · margem{" "}
              <b>{margem.toFixed(1)}%</b>
            </span>
          )}
        </div>
      )}
      <button className="cx-btn" disabled={l <= 0 || passouDoTotal || vendas <= 0}
        onClick={() => onFechar({ id: mes, mes, vendas, lucro: l, mercadoria, margem, fechadoEm: new Date().toISOString() })}>
        <Check size={15} /> Fechar o mês
      </button>
    </div>
  );
}

export default function Caixa({ caixa = [], fechamentos = [], onLancar, onApagar, onFecharMes, onReabrirMes }) {
  const hoje = hojeStr();
  const [mesVendo, setMesVendo] = useState(mesDe(hoje));
  const r = useMemo(() => resumoCaixa(caixa, fechamentos, hoje), [caixa, fechamentos, hoje]);

  const doMes = useMemo(
    () => caixa.filter((l) => mesDe(l.data) === mesVendo).sort((a, b) => String(b.data).localeCompare(String(a.data))),
    [caixa, mesVendo],
  );
  const vendasDoMesVendo = totalDoMes(caixa, mesVendo);
  const fechamentoVendo = fechamentos.find((f) => f.id === mesVendo) || null;

  // Meses que existem: os com lançamento, os fechados, e sempre o atual.
  const meses = useMemo(() => {
    const s = new Set([mesDe(hoje), ...caixa.map((l) => mesDe(l.data)), ...fechamentos.map((f) => f.id)]);
    return [...s].filter(Boolean).sort().reverse();
  }, [caixa, fechamentos, hoje]);

  const porDia = useMemo(() => {
    const m = new Map();
    doMes.forEach((l) => {
      if (!m.has(l.data)) m.set(l.data, []);
      m.get(l.data).push(l);
    });
    return [...m.entries()];
  }, [doMes]);

  return (
    <div className="cx">
      <Estilo />

      <div className="cx-topo">
        <div className="cx-numeros">
          <div><b>{brl(vendasDoMesVendo)}</b><span>vendido no mês</span></div>
          <div><b>{new Set(doMes.map((l) => l.data)).size}</b><span>dias lançados</span></div>
          <div><b>{doMes.length}</b><span>lançamentos</span></div>
        </div>
        <select className="cx-select" value={mesVendo} onChange={(e) => setMesVendo(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
      </div>

      {!fechamentoVendo && <Lancar onLancar={onLancar} />}

      <Fechamento mes={mesVendo} vendas={vendasDoMesVendo} fechamento={fechamentoVendo}
        onFechar={onFecharMes} onReabrir={onReabrirMes} />

      <div className="cx-dias">
        <h4>Lançamentos de {rotuloMes(mesVendo)}</h4>
        {porDia.length === 0 ? (
          <p className="cx-vazio">
            Nada lançado neste mês ainda. O que você fechar de serviço no app não entra aqui
            sozinho — o faturamento é o que você lançar.
          </p>
        ) : (
          porDia.map(([dia, itens]) => {
            const total = itens.reduce((s, l) => s + num(l.valor), 0);
            return (
              <div key={dia} className="cx-dia">
                <header>
                  <span>{new Date(`${dia}T12:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                  <b>{brl(total)}</b>
                </header>
                <ul>
                  {itens.map((l) => (
                    <li key={l.id}>
                      <span>{l.nota || "venda do dia"}</span>
                      <b>{brl(num(l.valor))}</b>
                      {!fechamentoVendo && (
                        <button onClick={() => onApagar(l.id)} aria-label="Apagar lançamento"><Trash2 size={13} /></button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>

      {r.mesesFechados.length > 0 && (
        <div className="cx-hist">
          <h4>Meses já fechados</h4>
          <ul>
            {r.mesesFechados.map((f) => (
              <li key={f.id}>
                <span>{rotuloMes(f.id)}</span>
                <em><TrendingUp size={11} /> {brl(f.lucro)}</em>
                <em className="merc"><Package size={11} /> {brl(f.mercadoria)}</em>
                <b>{f.margem.toFixed(1)}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.cx{display:flex;flex-direction:column;gap:16px;font-size:13px}
.cx h4{margin:0 0 9px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
  color:#ff9a45;font-family:ui-monospace,monospace}
.cx-dica{display:block;font-size:11.5px;line-height:1.5;color:#7e94b4}
.cx-dica b{color:#dce7f5}
.cx-vazio{margin:0;font-size:12.5px;line-height:1.55;color:#6f87a8}
.cx-topo{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cx-numeros{display:flex;gap:18px;flex:1;flex-wrap:wrap}
.cx-numeros b{display:block;font-size:19px;font-weight:800;font-family:ui-monospace,monospace;color:#fff}
.cx-numeros span{display:block;font-size:10px;color:#6f87a8;margin-top:2px}
.cx input,.cx-select{box-sizing:border-box;border-radius:9px;padding:10px 12px;font-size:13px;font-family:inherit;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;outline:none}
.cx input:focus,.cx-select:focus{border-color:#ff8c32}
.cx label{display:flex;flex-direction:column;gap:5px}
.cx label span{font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;color:#7e94b4}
.cx label input{width:100%}
.cx-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:none;border-radius:9px;
  padding:11px 16px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;background:#e2640a;color:#fff}
.cx-btn:disabled{opacity:.45;cursor:default}
.cx-btn.fantasma{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)}
.cx-lancar{display:flex;flex-direction:column;gap:10px;background:rgba(120,180,255,.05);
  border:1px solid rgba(120,180,255,.16);border-radius:12px;padding:13px}
.cx-campos{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:520px){.cx-campos{grid-template-columns:1fr 1fr}}
.cx-fechar,.cx-fechado{display:flex;flex-direction:column;gap:10px;border-radius:12px;padding:13px;
  background:rgba(255,140,50,.07);border:1px solid rgba(255,140,50,.3)}
.cx-fechar header,.cx-fechado header{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:800;
  letter-spacing:1.4px;text-transform:uppercase;color:#ff9a45;font-family:ui-monospace,monospace}
.cx-fechar p{margin:0}
.cx-previa{border-radius:9px;padding:10px 12px;font-size:12.5px;line-height:1.55;color:#dce7f5;
  background:rgba(34,211,154,.1);border:1px solid rgba(34,211,154,.3)}
.cx-previa b{color:#22d39a;font-family:ui-monospace,monospace}
.cx-previa.erro{background:rgba(255,107,107,.1);border-color:rgba(255,107,107,.35);color:#ff8f8f}
.cx-split{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
@media (min-width:560px){.cx-split{grid-template-columns:repeat(4,1fr)}}
.cx-split div{background:rgba(5,8,15,.4);border-radius:9px;padding:9px 11px}
.cx-split b{display:block;font-size:15px;font-weight:800;font-family:ui-monospace,monospace;color:#fff}
.cx-split .lucro b{color:#22d39a}
.cx-split .merc b{color:#ffb27a}
.cx-split span{display:block;font-size:10px;color:#6f87a8;margin-top:2px}
.cx-dias{display:flex;flex-direction:column;gap:9px}
.cx-dia{background:rgba(120,180,255,.04);border:1px solid rgba(120,180,255,.14);border-radius:11px;padding:10px 12px}
.cx-dia header{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:#8ba3c2;
  text-transform:capitalize;margin-bottom:6px}
.cx-dia header b{font-size:13.5px;color:#22d39a;font-family:ui-monospace,monospace}
.cx-dia ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.cx-dia li{display:flex;align-items:center;gap:9px;font-size:12.5px;color:#b9cbe4}
.cx-dia li span{flex:1;min-width:0}
.cx-dia li b{font-family:ui-monospace,monospace;color:#fff}
.cx-dia li button{flex-shrink:0;cursor:pointer;border:none;background:none;color:#ff8f8f;padding:2px}
.cx-hist ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cx-hist li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px;color:#b9cbe4;
  padding-bottom:6px;border-bottom:1px solid rgba(120,180,255,.1)}
.cx-hist li span{flex:1;min-width:110px;text-transform:capitalize}
.cx-hist li em{display:inline-flex;align-items:center;gap:4px;font-style:normal;color:#22d39a;font-family:ui-monospace,monospace}
.cx-hist li em.merc{color:#ffb27a}
.cx-hist li b{color:#fff;font-family:ui-monospace,monospace}
    `}</style>
  );
}
