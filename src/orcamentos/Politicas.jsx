import React, { useState } from "react";
import { ScrollText, Check, Plus, Trash2 } from "lucide-react";
import { lerPoliticas, prazoGarantia } from "./politicas.js";

/* Área administrativa das regras comerciais. O que está aqui vale para o app inteiro
   e para todos os agentes — por isso mexer aqui muda o que o TRON responde. */

function Linhas({ titulo, itens, onMudar, placeholder }) {
  return (
    <div className="pol-bloco">
      <h4>{titulo}</h4>
      <ul>
        {itens.map((t, i) => (
          <li key={i}>
            <input value={t} onChange={(e) => onMudar(itens.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" onClick={() => onMudar(itens.filter((_, j) => j !== i))} aria-label="Remover">
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="pol-add" onClick={() => onMudar([...itens, ""])}>
        <Plus size={13} /> {placeholder}
      </button>
    </div>
  );
}

export default function Politicas({ politicas, onSalvar, onToast }) {
  const [p, setP] = useState(() => lerPoliticas(politicas));
  const [salvando, setSalvando] = useState(false);

  const mudou = JSON.stringify(lerPoliticas(politicas)) !== JSON.stringify(p);
  const set = (campo, valor) => setP((a) => ({ ...a, [campo]: valor }));
  const setGar = (qual, campo, valor) =>
    setP((a) => ({ ...a, garantia: { ...a.garantia, [qual]: { ...a.garantia[qual], [campo]: valor } } }));

  const salvar = async () => {
    setSalvando(true);
    try {
      const limpa = { ...p, cobertura: p.cobertura.filter((t) => t.trim()), exclusoes: p.exclusoes.filter((t) => t.trim()) };
      await onSalvar(limpa);
      setP(lerPoliticas(limpa));
      onToast && onToast("Políticas atualizadas. Valem para documentos novos.");
    } catch (e) {
      onToast && onToast("Não deu para salvar: " + String(e.message || e));
    } finally {
      setSalvando(false);
    }
  };

  const g = prazoGarantia("comProduto", p);
  const s = prazoGarantia("soMaoDeObra", p);

  return (
    <div className="pol">
      <Estilo />
      <p className="pol-intro">
        <ScrollText size={14} /> O que está aqui é a regra oficial da casa. Vale para todo documento
        novo e para todas as respostas do TRON e dos outros agentes.
        <b> Documento já emitido não muda.</b>
      </p>

      <div className="pol-grade">
        <div className="pol-bloco">
          <h4>Validade do orçamento</h4>
          <div className="pol-num">
            <input type="number" min="1" value={p.validadeDias}
              onChange={(e) => set("validadeDias", Math.max(1, Number(e.target.value) || 1))} />
            <span>dias corridos, contados do envio</span>
          </div>
        </div>

        <div className="pol-bloco">
          <h4>Garantia — produto com instalação nossa</h4>
          <div className="pol-num">
            <input type="number" min="1" value={p.garantia.comProduto.meses}
              onChange={(e) => setGar("comProduto", "meses", Math.max(1, Number(e.target.value) || 1))} />
            <span>meses</span>
          </div>
        </div>

        <div className="pol-bloco">
          <h4>Garantia — somente mão de obra</h4>
          <div className="pol-num">
            <input type="number" min="1" value={p.garantia.soMaoDeObra.dias}
              onChange={(e) => setGar("soMaoDeObra", "dias", Math.max(1, Number(e.target.value) || 1))} />
            <span>dias</span>
          </div>
        </div>
      </div>

      <Linhas titulo="A garantia cobre" itens={p.cobertura} onMudar={(v) => set("cobertura", v)} placeholder="Adicionar cobertura" />
      <Linhas titulo="A garantia não cobre" itens={p.exclusoes} onMudar={(v) => set("exclusoes", v)} placeholder="Adicionar exclusão" />

      <div className="pol-bloco">
        <h4>Observação legal (sai nos documentos)</h4>
        <textarea rows={2} value={p.observacao} onChange={(e) => set("observacao", e.target.value)} />
        <span className="pol-dim">
          A garantia legal do Código de Defesa do Consumidor existe sempre e não pode ser reduzida.
          O prazo que você define aqui é contratual e se soma a ela.
        </span>
      </div>

      <div className="pol-resumo">
        <b>Como fica:</b> orçamento válido por {p.validadeDias} dias · produto com instalação
        nossa {g.texto} de garantia · serviço sem produto {s.texto}.
      </div>

      <div className="pol-rodape">
        {p.atualizadoEm && (
          <span className="pol-dim">
            Última mudança em {new Date(p.atualizadoEm).toLocaleDateString("pt-BR")}
            {p.atualizadoPor ? ` por ${p.atualizadoPor}` : ""}
          </span>
        )}
        <button className="pol-btn" onClick={salvar} disabled={!mudou || salvando}>
          <Check size={14} /> {salvando ? "Salvando…" : mudou ? "Salvar políticas" : "Tudo salvo"}
        </button>
      </div>
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.pol{display:flex;flex-direction:column;gap:16px;font-size:13px}
.pol-intro{display:flex;align-items:flex-start;gap:8px;margin:0;line-height:1.55;color:#b9cbe4}
.pol-intro b{color:#fff}
.pol-dim{display:block;font-size:11.5px;line-height:1.5;color:#6f87a8;margin-top:5px}
.pol-grade{display:grid;grid-template-columns:1fr;gap:12px}
@media (min-width:720px){.pol-grade{grid-template-columns:repeat(3,1fr)}}
.pol-bloco{display:flex;flex-direction:column;gap:7px}
.pol-bloco h4{margin:0;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
  color:#ff9a45;font-family:ui-monospace,monospace}
.pol-num{display:flex;align-items:center;gap:9px}
.pol-num input{width:90px}
.pol-num span{font-size:12px;color:#8ba3c2}
.pol input,.pol textarea{box-sizing:border-box;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;
  background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;outline:none}
.pol input:focus,.pol textarea:focus{border-color:#ff8c32}
.pol textarea{width:100%;resize:vertical}
.pol-bloco ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.pol-bloco li{display:flex;gap:6px}
.pol-bloco li input{flex:1;min-width:0}
.pol-bloco li button{width:34px;flex-shrink:0;border-radius:8px;cursor:pointer;color:#ff8f8f;
  background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.3)}
.pol-add{align-self:flex-start;display:inline-flex;align-items:center;gap:5px;cursor:pointer;
  border-radius:8px;padding:6px 11px;font-size:11.5px;font-family:inherit;color:#b9cbe4;
  background:rgba(120,180,255,.08);border:1px solid rgba(120,180,255,.22)}
.pol-resumo{background:rgba(34,211,154,.08);border:1px solid rgba(34,211,154,.3);border-radius:10px;
  padding:11px 13px;line-height:1.6;color:#dce7f5}
.pol-resumo b{color:#22d39a}
.pol-rodape{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pol-rodape .pol-dim{flex:1;margin:0}
.pol-btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:9px;padding:10px 16px;
  font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;background:#e2640a;color:#fff}
.pol-btn:disabled{opacity:.5;cursor:default}
    `}</style>
  );
}
