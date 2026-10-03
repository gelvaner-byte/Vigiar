import React, { useMemo, useState } from "react";
import { Plus, Trash2, Check, X, Search, Pencil, Sparkles } from "lucide-react";

/* ============ CÉREBRO — o que a empresa sabe ============ */
// Cada memória é um pedaço de conhecimento que o TRON usa em toda resposta:
// preço, garantia, fornecedor, procedimento, modelo de mensagem.

export const CATEGORIAS = [
  "Preços", "Garantia", "Fornecedores", "Procedimentos",
  "Mensagens prontas", "Regras da casa", "Marketing", "Outros",
];
const COR = {
  "Preços": "#4ade80", "Garantia": "#60a5fa", "Fornecedores": "#fbbf24",
  "Procedimentos": "#fb923c", "Mensagens prontas": "#c084fc",
  "Regras da casa": "#f87171", "Marketing": "#38bdf8", "Outros": "#94a3b8",
};
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const hojeISO = () => new Date().toISOString().slice(0, 10);

// Mesma memória cai sempre no mesmo lugar do mapa (posição vem do id).
function semente(txt) {
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
}

const L = 760, A = 440, CX = L / 2, CY = A / 2;

function montarMapa(memorias) {
  const porCat = {};
  memorias.forEach((m) => {
    const k = m.categoria || "Outros";
    (porCat[k] = porCat[k] || []).push(m);
  });
  const cats = Object.entries(porCat);
  return cats.map(([nome, itens], i) => {
    const r = semente(nome);
    const ang = (i / cats.length) * Math.PI * 2 + r() * 0.3;
    const dist = 115 + r() * 65;
    const x = CX + Math.cos(ang) * dist * 1.35;
    const y = CY + Math.sin(ang) * dist * 0.82;
    const filhos = itens.map((m, j) => {
      const rr = semente(m.id + j);
      const a2 = ang + (rr() - 0.5) * 1.5;
      const d2 = 52 + rr() * 74;
      return { memoria: m, x: x + Math.cos(a2) * d2 * 1.25, y: y + Math.sin(a2) * d2 * 0.85 };
    });
    return { nome, cor: COR[nome] || "#94a3b8", x, y, itens, filhos };
  });
}

// Linha curva, como no mapa de referência.
const curva = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
  const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
};

function Mapa({ memorias, aoTocar }) {
  const ramos = useMemo(() => montarMapa(memorias), [memorias]);
  const poeira = useMemo(() => {
    const r = semente("poeira-vigiar");
    return Array.from({ length: 34 }, () => ({
      x: r() * L, y: r() * A, raio: 1 + r() * 1.8, op: 0.08 + r() * 0.2,
    }));
  }, []);

  return (
    <div className="cer-tela">
      <svg viewBox={`0 0 ${L} ${A}`} className="cer-svg" role="img" aria-label="Mapa do Cérebro">
        <defs>
          <radialGradient id="cerNucleo" cx="50%" cy="42%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="45%" stopColor="#5b8cff" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <radialGradient id="cerHalo" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#5b8cff" stopOpacity="0.40" />
            <stop offset="100%" stopColor="#5b8cff" stopOpacity="0" />
          </radialGradient>
          <filter id="cerBrilho" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {poeira.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.raio} fill="#93b4ff" opacity={p.op} />
        ))}

        <circle cx={CX} cy={CY} r="150" fill="url(#cerHalo)" />

        {ramos.map((ramo) => (
          <g key={ramo.nome}>
            <path d={curva(CX, CY, ramo.x, ramo.y)} fill="none" stroke={ramo.cor} strokeOpacity="0.32" strokeWidth="1" />
            {ramo.filhos.map((f, i) => (
              <path key={i} d={curva(ramo.x, ramo.y, f.x, f.y)} fill="none" stroke={ramo.cor} strokeOpacity="0.16" strokeWidth="0.8" />
            ))}
            {ramo.filhos.map((f, i) => (
              <g key={`n${i}`} className="cer-no" onClick={() => aoTocar(f.memoria)}>
                <circle cx={f.x} cy={f.y} r="9" fill="transparent" />
                <circle cx={f.x} cy={f.y} r="3.4" fill={ramo.cor} fillOpacity="0.9" />
                <title>{f.memoria.titulo}</title>
              </g>
            ))}
            <circle cx={ramo.x} cy={ramo.y} r="9" fill="#0b1220" stroke={ramo.cor} strokeWidth="1.6" filter="url(#cerBrilho)" />
            <circle cx={ramo.x} cy={ramo.y} r="3.2" fill={ramo.cor} />
            <text x={ramo.x} y={ramo.y + 24} textAnchor="middle" className="cer-rot">
              {ramo.nome.toLowerCase()} <tspan className="cer-qtd">{ramo.itens.length}</tspan>
            </text>
          </g>
        ))}

        <circle cx={CX} cy={CY} r="30" fill="url(#cerNucleo)" filter="url(#cerBrilho)" className="cer-pulsa" />
        <text x={CX} y={CY + 52} textAnchor="middle" className="cer-centro">Cérebro</text>
      </svg>
    </div>
  );
}

export default function Cerebro({ memorias, onSalvar, onExcluir, onToast }) {
  const [busca, setBusca] = useState("");
  const [rapido, setRapido] = useState("");
  const [edit, setEdit] = useState(null);
  const [verLista, setVerLista] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return memorias.filter((m) => `${m.titulo} ${m.conteudo} ${m.categoria}`.toLowerCase().includes(q));
  }, [memorias, busca]);

  const abrirNovo = (texto = "") =>
    setEdit({ id: uid(), titulo: texto.slice(0, 60), categoria: "Preços", conteudo: texto, criadoEm: hojeISO() });

  const salvar = () => {
    if (!edit.titulo.trim() || !edit.conteudo.trim()) {
      onToast && onToast("Precisa de um título e do conteúdo.");
      return;
    }
    onSalvar({ ...edit, titulo: edit.titulo.trim(), conteudo: edit.conteudo.trim(), atualizadoEm: hojeISO() });
    setEdit(null);
    setRapido("");
  };

  const Item = ({ m }) => (
    <article className="cer-item" style={{ "--c": COR[m.categoria] || "#94a3b8" }}>
      <header>
        <span className="cer-cat">{m.categoria}</span>
        <strong>{m.titulo}</strong>
        <button onClick={() => setEdit({ ...m })} aria-label="Editar"><Pencil size={13} /></button>
        <button onClick={() => onExcluir(m.id)} aria-label="Apagar"><Trash2 size={13} /></button>
      </header>
      <p>{m.conteudo}</p>
    </article>
  );

  if (edit) {
    return (
      <div className="cer">
        <div className="cer-form">
          <input className="cer-in" autoFocus value={edit.titulo} placeholder="Título — ex.: Preço da câmera bullet"
            onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} />
          <select className="cer-in" value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea className="cer-in cer-ta" rows={5} value={edit.conteudo}
            placeholder={"O que o TRON precisa saber. Ex.:\nCâmera bullet 1080p: R$ 250 o ponto instalado, cabo até 30 m incluso."}
            onChange={(e) => setEdit({ ...edit, conteudo: e.target.value })} />
          <div className="cer-btns">
            <button className="cer-sim" onClick={salvar}><Check size={14} /> Guardar</button>
            <button className="cer-nao" onClick={() => setEdit(null)}><X size={14} /> Cancelar</button>
          </div>
        </div>
        <Estilo />
      </div>
    );
  }

  return (
    <div className="cer">
      <div className="cer-add">
        <Sparkles size={15} />
        <input value={rapido} onChange={(e) => setRapido(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && rapido.trim()) abrirNovo(rapido.trim()); }}
          placeholder="Ensinar algo novo ao Cérebro — preço, regra, fornecedor, jeito de responder…" />
        <button onClick={() => abrirNovo(rapido.trim())}><Plus size={14} /> Guardar</button>
      </div>

      <div className="cer-buscar">
        <Search size={13} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar nas memórias — título ou trecho…" />
        {memorias.length > 0 && (
          <button className="cer-ver" onClick={() => setVerLista((v) => !v)}>
            {verLista ? "Ver mapa" : `Ver as ${memorias.length}`}
          </button>
        )}
      </div>

      {memorias.length === 0 ? (
        <p className="cer-vazio">
          O Cérebro está vazio. Ensine o que a Vigiar sabe — preço de câmera, prazo de garantia,
          fornecedor de cabo, como você fala com cliente. O TRON passa a usar isso em toda resposta.
        </p>
      ) : busca.trim() ? (
        <div className="cer-lista">
          {lista.length === 0 ? <p className="cer-vazio">Nada encontrado para "{busca}".</p>
            : lista.map((m) => <Item key={m.id} m={m} />)}
        </div>
      ) : verLista ? (
        <div className="cer-lista">
          {[...memorias].sort((a, b) => String(a.categoria).localeCompare(String(b.categoria))).map((m) => <Item key={m.id} m={m} />)}
        </div>
      ) : (
        <Mapa memorias={memorias} aoTocar={(m) => setEdit({ ...m })} />
      )}

      <Estilo />
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.cer{display:flex;flex-direction:column;gap:10px}
.cer-add,.cer-buscar{display:flex;align-items:center;gap:9px;background:rgba(10,18,32,.9);
  border:1px solid rgba(120,180,255,.2);border-radius:12px;padding:0 12px;color:#6f87a8}
.cer-add{border-color:rgba(124,58,237,.4);background:linear-gradient(90deg,rgba(91,140,255,.12),rgba(124,58,237,.1))}
.cer-add svg{color:#a78bfa}
.cer-add input,.cer-buscar input{flex:1;min-width:0;background:none;border:none;outline:none;color:#fff;
  font-family:inherit;font-size:13.5px;padding:12px 0}
.cer-add button{display:inline-flex;align-items:center;gap:5px;background:#5b8cff;color:#fff;border:none;border-radius:9px;
  padding:8px 12px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap}
.cer-ver{background:rgba(120,180,255,.12);border:1px solid rgba(120,180,255,.25);color:#b9cbe4;border-radius:99px;
  padding:6px 11px;font-size:11.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap}
.cer-tela{position:relative;border-radius:14px;overflow:hidden;background:#070b14;
  width:90%;margin:0 auto;
  background-image:radial-gradient(60% 50% at 50% 50%,rgba(91,140,255,.1),transparent 70%);
  border:1px solid rgba(120,180,255,.12)}
.cer-svg{width:100%;height:auto;display:block}
.cer-no{cursor:pointer}
.cer-no:hover circle:last-of-type{r:5.5}
.cer-rot{fill:#8aa0bf;font-size:10.5px;font-family:ui-monospace,monospace}
.cer-qtd{fill:#52698c;font-size:9.5px}
.cer-centro{fill:#cbd9f5;font-size:12px;font-weight:600;letter-spacing:.5px}
.cer-pulsa{animation:cerpulsa 3.6s ease-in-out infinite;transform-origin:center}
@keyframes cerpulsa{0%,100%{opacity:.92}50%{opacity:1}}
.cer-lista{display:flex;flex-direction:column;gap:9px;max-height:330px;overflow-y:auto;padding-right:4px}
.cer-item{background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14);border-left:3px solid var(--c);
  border-radius:10px;padding:10px 12px}
.cer-item header{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.cer-item header strong{flex:1;font-size:13.5px;color:#fff;min-width:0}
.cer-item header button{background:none;border:none;color:#6f87a8;cursor:pointer;padding:2px}
.cer-cat{font-size:9.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--c);
  background:rgba(255,255,255,.05);border-radius:99px;padding:3px 8px;white-space:nowrap}
.cer-item p{margin:0;font-size:12.5px;color:#b9cbe4;line-height:1.5;white-space:pre-wrap}
.cer-vazio{font-size:13px;color:#6f87a8;line-height:1.55;margin:4px 0}
.cer-form{display:flex;flex-direction:column;gap:9px}
.cer-in{background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;border-radius:10px;
  padding:11px 12px;font-size:14px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
.cer-in:focus{border-color:#5b8cff}
.cer-ta{resize:vertical;line-height:1.5}
.cer-btns{display:flex;gap:8px}
.cer-btns button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:9px;
  padding:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer}
.cer-sim{background:#22d39a;color:#04261a}
.cer-nao{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)!important}
    `}</style>
  );
}
