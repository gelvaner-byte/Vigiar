import React, { useMemo, useState } from "react";
import { Brain, Plus, Trash2, Check, X, Search, Pencil } from "lucide-react";

/* ============ CÉREBRO — o que a empresa sabe ============ */
// Cada memória é um pedaço de conhecimento que o TRON passa a usar em toda resposta:
// preço, garantia, fornecedor, procedimento, modelo de mensagem.

export const CATEGORIAS = [
  "Preços", "Garantia", "Fornecedores", "Procedimentos",
  "Mensagens prontas", "Regras da casa", "Marketing", "Outros",
];
const COR = {
  "Preços": "#22d39a", "Garantia": "#7aa7ff", "Fornecedores": "#ffb55c",
  "Procedimentos": "#ff8c32", "Mensagens prontas": "#c89bff",
  "Regras da casa": "#ff6b6b", "Marketing": "#5cd9ff", "Outros": "#8ba0bd",
};
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const hojeISO = () => new Date().toISOString().slice(0, 10);

// Mapa das memórias: o centro é o Cérebro, os ramos são as categorias.
function Mapa({ memorias, aoTocar }) {
  const grupos = useMemo(() => {
    const m = {};
    memorias.forEach((x) => {
      const k = x.categoria || "Outros";
      (m[k] = m[k] || []).push(x);
    });
    return Object.entries(m);
  }, [memorias]);

  if (!grupos.length) return null;
  const L = 320, C = L / 2, raio = 92;

  return (
    <svg className="cer-mapa" viewBox={`0 0 ${L} ${L}`} role="img" aria-label="Mapa das memórias">
      {grupos.map(([nome, itens], i) => {
        const ang = (i / grupos.length) * Math.PI * 2 - Math.PI / 2;
        const x = C + Math.cos(ang) * raio;
        const y = C + Math.sin(ang) * raio;
        const cor = COR[nome] || "#8ba0bd";
        return (
          <g key={nome}>
            <line x1={C} y1={C} x2={x} y2={y} stroke={cor} strokeOpacity="0.35" strokeWidth="1" />
            {itens.slice(0, 7).map((it, j) => {
              const a2 = ang + (j - (Math.min(itens.length, 7) - 1) / 2) * 0.34;
              const x2 = C + Math.cos(a2) * (raio + 48);
              const y2 = C + Math.sin(a2) * (raio + 48);
              return (
                <g key={it.id} className="cer-no" onClick={() => aoTocar(it)}>
                  <line x1={x} y1={y} x2={x2} y2={y2} stroke={cor} strokeOpacity="0.2" strokeWidth="1" />
                  <circle cx={x2} cy={y2} r="4.5" fill={cor} fillOpacity="0.85" />
                  <title>{it.titulo}</title>
                </g>
              );
            })}
            <circle cx={x} cy={y} r="7" fill={cor} />
            <text x={x} y={y + 19} textAnchor="middle" fill="#b9cbe4" fontSize="9">{nome} {itens.length}</text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r="20" fill="#e2640a" fillOpacity="0.2" stroke="#ff8c32" />
      <circle cx={C} cy={C} r="9" fill="#ff8c32" />
      <text x={C} y={C + 34} textAnchor="middle" fill="#ff9a45" fontSize="10" fontWeight="700">CÉREBRO</text>
    </svg>
  );
}

export default function Cerebro({ memorias, onSalvar, onExcluir, onToast }) {
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState(null); // memória sendo criada/editada

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...memorias]
      .filter((m) => !q || `${m.titulo} ${m.conteudo} ${m.categoria}`.toLowerCase().includes(q))
      .sort((a, b) => String(a.categoria).localeCompare(String(b.categoria)) || String(a.titulo).localeCompare(String(b.titulo)));
  }, [memorias, busca]);

  const novo = () => setEdit({ id: uid(), titulo: "", categoria: "Preços", conteudo: "", criadoEm: hojeISO() });

  const salvar = () => {
    if (!edit.titulo.trim() || !edit.conteudo.trim()) {
      onToast && onToast("Precisa de um título e do conteúdo.");
      return;
    }
    onSalvar({ ...edit, titulo: edit.titulo.trim(), conteudo: edit.conteudo.trim(), atualizadoEm: hojeISO() });
    setEdit(null);
  };

  return (
    <div className="cer">
      {edit ? (
        <div className="cer-form">
          <input className="cer-in" autoFocus value={edit.titulo} placeholder="Título — ex.: Preço da câmera bullet"
            onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} />
          <select className="cer-in" value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea className="cer-in cer-ta" rows={5} value={edit.conteudo}
            placeholder={"O que o TRON precisa saber. Ex.:\nCâmera bullet 1080p: R$ 250 a unidade instalada.\nAbaixo de 4 câmeras não compensa deslocamento."}
            onChange={(e) => setEdit({ ...edit, conteudo: e.target.value })} />
          <div className="cer-btns">
            <button className="cer-sim" onClick={salvar}><Check size={14} /> Guardar</button>
            <button className="cer-nao" onClick={() => setEdit(null)}><X size={14} /> Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="cer-topo">
            <span className="cer-busca">
              <Search size={13} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar no Cérebro…" />
            </span>
            <button className="cer-novo" onClick={novo}><Plus size={14} /> Ensinar</button>
          </div>

          {memorias.length === 0 ? (
            <p className="cer-vazio">
              O Cérebro está vazio. Ensine o que a Vigiar sabe — preço de câmera, prazo de garantia,
              fornecedor de cabo, como você fala com cliente. O TRON passa a usar isso em toda resposta.
            </p>
          ) : (
            <>
              <Mapa memorias={memorias} aoTocar={(m) => setEdit({ ...m })} />
              <div className="cer-lista">
                {lista.map((m) => (
                  <article key={m.id} className="cer-item" style={{ "--c": COR[m.categoria] || "#8ba0bd" }}>
                    <header>
                      <span className="cer-cat">{m.categoria}</span>
                      <strong>{m.titulo}</strong>
                      <button onClick={() => setEdit({ ...m })} aria-label="Editar"><Pencil size={13} /></button>
                      <button onClick={() => onExcluir(m.id)} aria-label="Apagar"><Trash2 size={13} /></button>
                    </header>
                    <p>{m.conteudo}</p>
                  </article>
                ))}
                {lista.length === 0 && <p className="cer-vazio">Nada encontrado para "{busca}".</p>}
              </div>
            </>
          )}
        </>
      )}

      <style>{`
.cer{display:flex;flex-direction:column;gap:12px}
.cer-topo{display:flex;gap:8px;align-items:center}
.cer-busca{flex:1;display:flex;align-items:center;gap:7px;background:rgba(120,180,255,.07);
  border:1px solid rgba(120,180,255,.22);border-radius:10px;padding:0 10px;color:#6f87a8}
.cer-busca input{flex:1;background:none;border:none;outline:none;color:#fff;font-family:inherit;font-size:13.5px;padding:10px 0}
.cer-novo{display:inline-flex;align-items:center;gap:6px;background:#e2640a;color:#fff;border:none;border-radius:10px;
  padding:10px 13px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap}
.cer-mapa{width:100%;max-width:330px;margin:0 auto;display:block}
.cer-no{cursor:pointer}
.cer-no:hover circle{r:6}
.cer-lista{display:flex;flex-direction:column;gap:9px;max-height:300px;overflow-y:auto;padding-right:4px}
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
.cer-in:focus{border-color:#ff8c32}
.cer-ta{resize:vertical;line-height:1.5}
.cer-btns{display:flex;gap:8px}
.cer-btns button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:9px;
  padding:10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer}
.cer-sim{background:#22d39a;color:#04261a}
.cer-nao{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)!important}
      `}</style>
    </div>
  );
}
