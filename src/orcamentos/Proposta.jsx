import React, { useState } from "react";
import {
  FileText, Check, X, Share2, Download, RefreshCw, AlertTriangle, Pencil, Sparkles, ImagePlus,
} from "lucide-react";
import { supabase } from "./supabaseOrc";
import {
  montarProposta, pendenciasDaProposta, propostaDesatualizada, propostaEmTexto, textoPadrao,
} from "./proposta.js";
import {
  MAX_FOTOS, deArquivo, deEndereco, fotosDoItem, fotosDoLocal, legendaCompleta, mover,
  pesoDasFotos, pesoLegivel, sugerirDosAnuncios, uid,
} from "./imagens.js";
import { buscarDadosML } from "./MercadoLivre.jsx";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");

// Pede o texto ao agente. Se ele não responder, a proposta sai pelo modelo padrão do app:
// o Gelvan nunca fica sem conseguir mandar nada.
export async function redigir(orc, politicas) {
  const dados = {
    descricaoServico: orc.descricaoServico || "",
    local: [orc.endereco, orc.bairro].filter(Boolean).join(" - "),
    tipoCliente: /condom[íi]nio|edif[íi]cio|residencial/i.test(orc.cliente || "") ? "condomínio" : "",
    itens: (orc.itens || []).map((i) => ({
      descricao: i.descricao, qtd: i.qtd, doCliente: !!i.materialDoCliente,
    })),
  };
  try {
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/tron", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ tarefa: "proposta", dados }),
    });
    const corpo = await r.json();
    if (!r.ok || !corpo.texto) throw new Error(corpo.erro || "o agente não respondeu");
    return { texto: corpo.texto, aviso: "" };
  } catch (e) {
    return {
      texto: textoPadrao(orc, politicas),
      aviso: `O agente não respondeu (${String(e.message || e)}). Montei a proposta com o texto padrão da Vigiar — revise e ajuste antes de enviar.`,
    };
  }
}

function Secao({ titulo, children }) {
  return (
    <section className="pp-secao">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

// Uma foto na proposta: imagem e legenda andam juntas, inclusive na quebra de página.
function Foto({ img, grande }) {
  const leg = legendaCompleta(img);
  return (
    <figure className={"pp-foto" + (grande ? " g" : "")}>
      <img src={img.src} alt={img.legenda || "Foto da proposta"} />
      {leg && <figcaption>{leg}</figcaption>}
    </figure>
  );
}

// Painel de edição das fotos. Só aparece no modo editar e nunca sai no PDF.
function Fotos({ imagens, itens, sugestoes, ocupado, onAdicionar, onUsarSugestao, onMudar, onMover, onRemover }) {
  const arquivo = (e) => {
    const lista = [...(e.target.files || [])];
    e.target.value = "";
    if (lista.length) onAdicionar(lista);
  };

  return (
    <div className="pp-fotos-ed">
      <div className="pp-fotos-topo">
        <label className="pp-btn-foto">
          <ImagePlus size={15} /> Adicionar imagens
          <input type="file" accept="image/*" multiple onChange={arquivo} hidden />
        </label>
        <span className="pp-peso">
          {imagens.length}/{MAX_FOTOS} fotos
          {imagens.length > 0 ? ` · ${pesoLegivel(pesoDasFotos(imagens))}` : ""}
        </span>
      </div>
      {ocupado && <p className="pp-dica">Preparando as fotos…</p>}

      {sugestoes.length > 0 && (
        <div className="pp-sugestoes">
          <h4>Fotos dos produtos do orçamento</h4>
          <p className="pp-dica">Achei estas no seu cadastro do Mercado Livre, pelos itens que você listou.</p>
          <ul>
            {sugestoes.map((s) => (
              <li key={`${s.itemIndex}-${s.url}`}>
                <img src={s.url} alt="" />
                <div>
                  <b>{s.itemDescricao}</b>
                  <em>{s.titulo}</em>
                </div>
                <button onClick={() => onUsarSugestao(s)} disabled={ocupado}>Usar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {imagens.length === 0 ? (
        <p className="pp-dica">
          Sem fotos, a proposta sai só com texto. Foto do modelo do equipamento e do lugar
          onde vai ser instalado ajudam o síndico a entender o que está contratando.
        </p>
      ) : (
        <ul className="pp-fotos-lista">
          {imagens.map((img, i) => (
            <li key={img.id}>
              <img src={img.src} alt="" />
              <div className="pp-foto-campos">
                <input value={img.legenda} placeholder="Legenda da foto"
                  onChange={(e) => onMudar(img.id, { legenda: e.target.value })} />
                <select value={img.tipo === "produto" ? `item:${img.itemIndex}` : "local"}
                  onChange={(e) => {
                    const v = e.target.value;
                    onMudar(img.id, v === "local"
                      ? { tipo: "local", itemIndex: null }
                      : { tipo: "produto", itemIndex: Number(v.split(":")[1]) });
                  }}>
                  <option value="local">Fotos do local e da instalação</option>
                  {itens.map((it, k) => (
                    <option key={k} value={`item:${k}`}>Junto do item: {it.descricao || `item ${k + 1}`}</option>
                  ))}
                </select>
                <label className="pp-ilustra">
                  <input type="checkbox" checked={!!img.ilustrativa}
                    onChange={(e) => onMudar(img.id, { ilustrativa: e.target.checked })} />
                  <span>Imagem ilustrativa</span>
                </label>
              </div>
              <div className="pp-foto-botoes">
                <button onClick={() => onMover(img.id, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                <button onClick={() => onMover(img.id, 1)} disabled={i === imagens.length - 1} aria-label="Descer">↓</button>
                <button className="rem" onClick={() => onRemover(img.id)} aria-label="Remover"><X size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Proposta({ orc, politicas, proposta, quemSou, onSalvar, onShare, onToast, onFechar }) {
  const [p, setP] = useState(proposta || null);
  const [gerando, setGerando] = useState(!proposta);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  const imagens = (p && p.imagens) || [];
  const gravarImagens = (lista) => {
    const nova = { ...p, imagens: lista };
    setP(nova);
    onSalvar(nova, { silencioso: true });
  };

  const adicionar = async (arquivos) => {
    const cabe = MAX_FOTOS - imagens.length;
    if (cabe <= 0) { onToast && onToast(`A proposta já tem ${MAX_FOTOS} fotos.`); return; }
    setOcupado(true);
    const novas = [];
    for (const f of arquivos.slice(0, cabe)) {
      try {
        const r = await deArquivo(f);
        novas.push({ id: uid(), src: r.src, legenda: "", tipo: "local", itemIndex: null,
          ilustrativa: false, origem: "envio", largura: r.largura, altura: r.altura });
      } catch (e) { onToast && onToast(String(e.message || e)); }
    }
    if (arquivos.length > cabe) onToast && onToast(`Entraram ${cabe}: o limite é ${MAX_FOTOS} fotos.`);
    if (novas.length) gravarImagens([...imagens, ...novas]);
    setOcupado(false);
  };

  const usarSugestao = async (sug) => {
    if (imagens.length >= MAX_FOTOS) { onToast && onToast(`A proposta já tem ${MAX_FOTOS} fotos.`); return; }
    setOcupado(true);
    try {
      const r = await deEndereco(sug.url);
      gravarImagens([...imagens, {
        id: uid(), src: r.src, legenda: sug.itemDescricao, tipo: "produto", itemIndex: sug.itemIndex,
        ilustrativa: false, origem: "anuncio", largura: r.largura, altura: r.altura,
      }]);
    } catch (e) {
      onToast && onToast(String(e.message || e));
    } finally {
      setOcupado(false);
    }
  };

  const pendencias = pendenciasDaProposta(orc, politicas);
  const velha = p && propostaDesatualizada(orc, p);

  const gerar = async () => {
    setGerando(true);
    setAviso("");
    const { texto, aviso: av } = await redigir(orc, politicas);
    const nova = montarProposta({ orc, politicas, texto, autor: quemSou });
    setP(nova);
    setAviso(av);
    setGerando(false);
    onSalvar(nova, { silencioso: true });
  };

  // Primeira abertura sem proposta: já gera.
  const [iniciou, setIniciou] = useState(false);
  if (!iniciou) {
    setIniciou(true);
    if (!proposta) gerar();
    // Fotos dos produtos: vêm do cadastro do Mercado Livre. Sem conexão, segue sem sugestão.
    buscarDadosML()
      .then((ml) => setSugestoes(sugerirDosAnuncios(orc, ml?.anuncios?.lista || [])))
      .catch(() => {});
  }

  const setTexto = (campo, valor) => {
    const nova = { ...p, texto: { ...p.texto, [campo]: valor } };
    setP(nova);
    onSalvar(nova, { silencioso: true });
  };
  const setEtapa = (i, valor) =>
    setTexto("etapas", p.texto.etapas.map((e, j) => (j === i ? valor : e)));
  const addEtapa = () => setTexto("etapas", [...p.texto.etapas, ""]);
  const delEtapa = (i) => setTexto("etapas", p.texto.etapas.filter((_, j) => j !== i));

  const enviar = () => {
    if (pendencias.length) { onToast && onToast("Falta preencher: " + pendencias.join(", ")); return; }
    const marcada = { ...p, enviadaEm: new Date().toISOString(), enviadaPor: quemSou || "" };
    setP(marcada);
    onSalvar(marcada, { marcarEnviado: true });
    onShare({ titulo: `Proposta — Orçamento Nº ${p.comercial.numero}`, texto: propostaEmTexto(marcada) });
  };

  if (gerando || !p) {
    return (
      <div className="pp-tela">
        <Estilo />
        <header className="pp-topo">
          <span><FileText size={17} /> Proposta comercial</span>
          <button onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
        </header>
        <div className="pp-carregando">
          <Sparkles size={22} />
          <p>Escrevendo a proposta a partir do orçamento…</p>
        </div>
      </div>
    );
  }

  const c = p.comercial;

  return (
    <div className="pp-tela">
      <Estilo />
      <header className="pp-topo">
        <span><FileText size={17} /> Proposta — Orçamento Nº {c.numero}</span>
        <button className={"pp-ed" + (editando ? " on" : "")} onClick={() => setEditando((v) => !v)}>
          <Pencil size={14} /> {editando ? "Ver pronta" : "Editar textos"}
        </button>
        <button onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
      </header>

      <div className="pp-rolo">
        {velha && (
          <div className="pp-alerta">
            <AlertTriangle size={16} />
            <span>
              <b>O orçamento mudou depois que esta proposta foi feita.</b> Os valores abaixo são
              os de antes. Gere de novo antes de enviar.
            </span>
            <button onClick={gerar}><RefreshCw size={14} /> Gerar de novo</button>
          </div>
        )}
        {!!pendencias.length && (
          <div className="pp-alerta falta">
            <AlertTriangle size={16} />
            <span><b>Falta preencher no orçamento:</b> {pendencias.join(" · ")}</span>
          </div>
        )}
        {aviso && <div className="pp-alerta falta"><AlertTriangle size={16} /><span>{aviso}</span></div>}
        {p.enviadaEm && (
          <div className="pp-enviada">
            <Check size={15} /> Enviada em {new Date(p.enviadaEm).toLocaleString("pt-BR")}
            {p.enviadaPor ? ` por ${p.enviadaPor}` : ""}
          </div>
        )}

        {editando && (
          <Fotos
            imagens={imagens}
            itens={c.itens}
            sugestoes={sugestoes}
            ocupado={ocupado}
            onAdicionar={adicionar}
            onUsarSugestao={usarSugestao}
            onMudar={(id, campos) => gravarImagens(imagens.map((i) => (i.id === id ? { ...i, ...campos } : i)))}
            onMover={(id, passo) => gravarImagens(mover(imagens, id, passo))}
            onRemover={(id) => gravarImagens(imagens.filter((i) => i.id !== id))}
          />
        )}

        <div className="pp-folha" id="pp-folha">
          <div className="pp-cab">
            <div className="pp-marca">
              <span className="pp-logo">V</span>
              <div>
                <b>VIGIAR SISTEMAS</b>
                <em>Segurança eletrônica · Belo Horizonte</em>
              </div>
            </div>
            <div className="pp-cab-dir">
              <b>PROPOSTA COMERCIAL</b>
              <span>Orçamento Nº {c.numero}</span>
              <span>{fmt(c.emitidoEm)}</span>
            </div>
          </div>

          <div className="pp-para">
            <div><span>Cliente</span><b>{c.cliente.nome || "—"}</b></div>
            {c.local && <div><span>Local do serviço</span><b>{c.local}</b></div>}
            {c.cliente.telefone && <div><span>Contato</span><b>{c.cliente.telefone}</b></div>}
          </div>

          <Secao titulo="A necessidade">
            {editando
              ? <textarea rows={2} value={p.texto.necessidade} onChange={(e) => setTexto("necessidade", e.target.value)} />
              : <p>{p.texto.necessidade}</p>}
          </Secao>

          <Secao titulo="O que propomos">
            {editando
              ? <textarea rows={4} value={p.texto.solucao} onChange={(e) => setTexto("solucao", e.target.value)} />
              : <p>{p.texto.solucao}</p>}
          </Secao>

          {(editando || p.texto.etapas.length > 0) && (
            <Secao titulo="Como fazemos">
              {editando ? (
                <>
                  {p.texto.etapas.map((e, i) => (
                    <div key={i} className="pp-etapa-ed">
                      <input value={e} onChange={(ev) => setEtapa(i, ev.target.value)} />
                      <button onClick={() => delEtapa(i)} aria-label="Remover"><X size={13} /></button>
                    </div>
                  ))}
                  <button className="pp-add" onClick={addEtapa}>+ Adicionar etapa</button>
                </>
              ) : (
                <ol className="pp-etapas">{p.texto.etapas.map((e, i) => <li key={i}>{e}</li>)}</ol>
              )}
            </Secao>
          )}

          {c.materiaisDoCliente.length > 0 && (
            <Secao titulo="Material por conta do cliente">
              <p>{c.materiaisDoCliente.join(" · ")}</p>
            </Secao>
          )}

          <Secao titulo="Investimento">
            {c.somenteTotal ? (
              <>
                <p className="pp-so-total">Valor fechado para o serviço descrito acima.</p>
                {imagens.some((i) => i.tipo === "produto") && (
                  <div className="pp-fotos-grade">
                    {imagens.filter((i) => i.tipo === "produto").map((f) => <Foto key={f.id} img={f} />)}
                  </div>
                )}
              </>
            ) : (
              <table className="pp-tab">
                <thead>
                  <tr><th>Item</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {c.itens.map((i, k) => {
                    const fotos = fotosDoItem(imagens, k);
                    return (
                      <React.Fragment key={k}>
                        <tr>
                          <td>{i.descricao}{i.doCliente ? " (material do cliente)" : ""}</td>
                          <td>{i.qtd} {i.unidade}</td>
                          <td>{brl(i.unitario)}</td>
                          <td>{brl(i.total)}</td>
                        </tr>
                        {fotos.length > 0 && (
                          <tr className="pp-linha-foto">
                            <td colSpan={4}>
                              <div className="pp-fotos-item">
                                {fotos.map((f) => <Foto key={f.id} img={f} />)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {c.desconto > 0 && (
                    <tr className="pp-desc"><td colSpan={3}>Desconto</td><td>-{brl(c.desconto)}</td></tr>
                  )}
                </tbody>
              </table>
            )}
            <div className="pp-total"><span>Total</span><b>{brl(c.total)}</b></div>
          </Secao>

          {fotosDoLocal(imagens).length > 0 && (
            <Secao titulo="Fotos do local e da instalação">
              <div className="pp-fotos-grade">
                {fotosDoLocal(imagens).map((f) => <Foto key={f.id} img={f} grande={fotosDoLocal(imagens).length === 1} />)}
              </div>
            </Secao>
          )}

          <Secao titulo="Condições">
            <ul className="pp-cond">
              {c.pagamento && <li><b>Pagamento:</b> {c.pagamento}</li>}
              {c.prazoExecucao && <li><b>Prazo de execução:</b> {c.prazoExecucao}</li>}
              <li><b>Validade desta proposta:</b> {c.validadeDias} dias{c.valeAte ? ` — até ${fmt(c.valeAte)}` : ""}</li>
              <li><b>Garantia:</b> {c.garantia.frase}</li>
              {c.observacoes && <li><b>Observações:</b> {c.observacoes}</li>}
            </ul>
          </Secao>

          <Secao titulo="Para aprovar">
            {editando
              ? <textarea rows={2} value={p.texto.fechamento} onChange={(e) => setTexto("fechamento", e.target.value)} />
              : <p>{p.texto.fechamento}</p>}
            <p className="pp-aprovar">
              É só responder esta proposta confirmando. Assim que você aprovar, agendamos a
              execução e o serviço entra na nossa agenda.
            </p>
          </Secao>

          <footer className="pp-rodape">
            VIGIAR SISTEMAS · Segurança eletrônica · Belo Horizonte / MG
            {p.porIA ? "" : " · texto padrão"}
          </footer>
        </div>
      </div>

      <div className="pp-acoes">
        <button className="pp-btn fantasma" onClick={gerar}><RefreshCw size={15} /> Gerar de novo</button>
        <button className="pp-btn fantasma" onClick={() => window.print()}><Download size={15} /> PDF</button>
        <button className="pp-btn" onClick={enviar} disabled={!!pendencias.length}>
          <Share2 size={15} /> Enviar ao cliente
        </button>
      </div>
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.pp-tela{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;background:#f6f1ea}
.pp-topo{display:flex;align-items:center;gap:10px;padding:13px 16px;background:#fff;border-bottom:1px solid #f0d8c0}
.pp-topo > span:first-child{flex:1;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#5a3a20}
.pp-topo > button{width:36px;height:36px;display:grid;place-items:center;border-radius:9px;cursor:pointer;
  color:#8a6a4a;background:#fff;border:1px solid #f0d8c0}
.pp-ed{width:auto!important;display:inline-flex;align-items:center;gap:6px;padding:0 12px!important;
  font-size:12px;font-family:inherit;font-weight:600}
.pp-ed.on{color:#fff!important;background:#e2640a!important;border-color:#e2640a!important}
.pp-rolo{flex:1;overflow-y:auto;padding:16px}
.pp-carregando{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#8a6a4a}
.pp-carregando svg{color:#e2640a}
.pp-alerta{display:flex;align-items:flex-start;gap:9px;max-width:780px;margin:0 auto 12px;padding:11px 13px;
  border-radius:11px;font-size:12.5px;line-height:1.5;background:#fff4e8;border:1px solid #f0c9a0;color:#8a4a10}
.pp-alerta.falta{background:#fdecec;border-color:#f0b4b4;color:#9a2b2b}
.pp-alerta span{flex:1}
.pp-alerta button{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;cursor:pointer;font-family:inherit;
  font-size:11.5px;font-weight:700;color:#fff;background:#e2640a;border:none;border-radius:8px;padding:7px 11px}
.pp-enviada{display:flex;align-items:center;gap:7px;max-width:780px;margin:0 auto 12px;padding:9px 13px;
  border-radius:11px;font-size:12.5px;background:#e8f7ee;border:1px solid #a8ddbd;color:#176b3a}

.pp-folha{max-width:780px;margin:0 auto;background:#fff;border:1px solid #e8d5c0;border-radius:4px;
  padding:34px 38px;color:#2f2318;line-height:1.6}
.pp-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;
  padding-bottom:16px;border-bottom:3px solid #e2640a;margin-bottom:22px}
.pp-marca{display:flex;align-items:center;gap:11px}
.pp-logo{width:44px;height:44px;display:grid;place-items:center;border-radius:10px;background:#e2640a;
  color:#fff;font-size:22px;font-weight:800}
.pp-marca b{display:block;font-size:17px;letter-spacing:1px;color:#5a3a20}
.pp-marca em{font-style:normal;font-size:11px;color:#9a7b60}
.pp-cab-dir{text-align:right}
.pp-cab-dir b{display:block;font-size:12px;letter-spacing:1.5px;color:#e2640a}
.pp-cab-dir span{display:block;font-size:11.5px;color:#9a7b60}
.pp-para{display:flex;flex-wrap:wrap;gap:22px;margin-bottom:24px}
.pp-para span{display:block;font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:#b07a45}
.pp-para b{font-size:14px;color:#2f2318}
.pp-secao{margin-bottom:22px}
.pp-secao h3{margin:0 0 8px;font-size:10.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#e2640a}
.pp-secao p{margin:0 0 6px;font-size:13.5px}
.pp-secao textarea,.pp-etapa-ed input{width:100%;box-sizing:border-box;font-family:inherit;font-size:13.5px;
  padding:9px 11px;border-radius:8px;border:1px solid #e2640a;background:#fffaf5;color:#2f2318;resize:vertical}
.pp-etapa-ed{display:flex;gap:6px;margin-bottom:6px}
.pp-etapa-ed button{width:32px;flex-shrink:0;border-radius:8px;cursor:pointer;color:#9a2b2b;
  background:#fdecec;border:1px solid #f0b4b4}
.pp-add{cursor:pointer;font-family:inherit;font-size:12px;color:#e2640a;background:none;border:none;padding:4px 0}
.pp-etapas{margin:0;padding-left:20px;font-size:13.5px}
.pp-etapas li{margin-bottom:5px}
.pp-tab{width:100%;border-collapse:collapse;font-size:13px}
.pp-tab th{text-align:left;font-size:9.5px;letter-spacing:.8px;text-transform:uppercase;color:#b07a45;
  padding:0 8px 7px 0;border-bottom:1px solid #e8d5c0}
.pp-tab td{padding:8px 8px 8px 0;border-bottom:1px solid #f3e7da;vertical-align:top}
.pp-tab th:last-child,.pp-tab td:last-child{text-align:right;padding-right:0}
.pp-tab th:nth-child(2),.pp-tab td:nth-child(2),.pp-tab th:nth-child(3),.pp-tab td:nth-child(3){text-align:right}
.pp-desc td{color:#9a2b2b}
.pp-so-total{font-style:italic;color:#6a5340}
.pp-total{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding:11px 14px;
  border-radius:9px;background:#fff4e8;border:1px solid #f0c9a0}
.pp-total span{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#b07a45}
.pp-total b{font-size:21px;color:#e2640a}
.pp-cond{margin:0;padding-left:18px;font-size:13px}
.pp-cond li{margin-bottom:5px}
.pp-aprovar{font-size:13px;color:#6a5340}
.pp-rodape{margin-top:26px;padding-top:12px;border-top:1px solid #e8d5c0;text-align:center;
  font-size:10.5px;color:#9a7b60}

/* fotos na folha */
.pp-foto{margin:0;break-inside:avoid;page-break-inside:avoid}
.pp-foto img{display:block;width:100%;height:auto;border-radius:6px;border:1px solid #e8d5c0;
  background:#fff;object-fit:contain}
.pp-foto figcaption{margin-top:5px;font-size:10.5px;line-height:1.4;color:#6a5340}
.pp-foto.g img{max-height:420px;object-fit:contain}
.pp-fotos-item{display:flex;gap:10px;flex-wrap:wrap;padding:4px 0 10px}
.pp-fotos-item .pp-foto{width:150px}
.pp-linha-foto td{border-bottom:1px solid #f3e7da;padding-top:0}
.pp-fotos-grade{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.pp-fotos-grade .pp-foto img{max-height:260px;object-fit:cover}
.pp-fotos-grade .pp-foto.g{grid-column:1/-1}
.pp-fotos-grade .pp-foto.g img{object-fit:contain}

/* painel de edição das fotos — nunca sai no PDF */
.pp-fotos-ed{max-width:780px;margin:0 auto 14px;background:#fff;border:1px solid #f0d8c0;
  border-radius:12px;padding:14px}
.pp-fotos-topo{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pp-btn-foto{display:inline-flex;align-items:center;gap:7px;cursor:pointer;border-radius:9px;
  padding:10px 14px;font-size:12.5px;font-weight:700;background:#e2640a;color:#fff}
.pp-peso{font-size:11.5px;color:#9a7b60}
.pp-dica{margin:8px 0 0;font-size:11.5px;line-height:1.5;color:#9a7b60}
.pp-sugestoes{margin-top:14px;padding-top:12px;border-top:1px solid #f3e7da}
.pp-sugestoes h4{margin:0;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#e2640a}
.pp-sugestoes ul{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.pp-sugestoes li{display:flex;align-items:center;gap:10px}
.pp-sugestoes li img{width:44px;height:44px;flex-shrink:0;border-radius:8px;object-fit:cover;border:1px solid #e8d5c0}
.pp-sugestoes li div{flex:1;min-width:0}
.pp-sugestoes li b{display:block;font-size:12.5px;color:#5a3a20}
.pp-sugestoes li em{font-style:normal;font-size:11px;color:#9a7b60;display:block;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.pp-sugestoes li button{flex-shrink:0;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;
  color:#e2640a;background:#fff4e8;border:1px solid #f0c9a0;border-radius:8px;padding:7px 12px}
.pp-fotos-lista{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.pp-fotos-lista li{display:flex;gap:10px;align-items:flex-start;padding-top:10px;border-top:1px solid #f3e7da}
.pp-fotos-lista li > img{width:72px;height:72px;flex-shrink:0;border-radius:8px;object-fit:cover;border:1px solid #e8d5c0}
.pp-foto-campos{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.pp-foto-campos input[type=text],.pp-foto-campos input:not([type]),.pp-foto-campos select{
  width:100%;box-sizing:border-box;font-family:inherit;font-size:12.5px;padding:8px 10px;
  border-radius:8px;border:1px solid #f0d8c0;background:#fff;color:#2f2318}
.pp-ilustra{display:flex;align-items:center;gap:7px;font-size:12px;color:#5a3a20;cursor:pointer}
.pp-ilustra input{width:16px;height:16px;accent-color:#e2640a}
.pp-foto-botoes{display:flex;flex-direction:column;gap:5px;flex-shrink:0}
.pp-foto-botoes button{width:30px;height:28px;display:grid;place-items:center;cursor:pointer;
  border-radius:7px;font-family:inherit;color:#8a6a4a;background:#fff;border:1px solid #f0d8c0}
.pp-foto-botoes button:disabled{opacity:.35;cursor:default}
.pp-foto-botoes .rem{color:#9a2b2b;background:#fdecec;border-color:#f0b4b4}

.pp-acoes{display:flex;gap:9px;padding:12px 16px;background:#fff;border-top:1px solid #f0d8c0}
.pp-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;
  border:none;border-radius:10px;padding:12px;font-size:13px;font-weight:700;font-family:inherit;
  background:#e2640a;color:#fff}
.pp-btn:disabled{opacity:.45;cursor:default}
.pp-btn.fantasma{background:#fff;color:#8a6a4a;border:1px solid #f0d8c0}

/* O PDF sai da impressão do navegador: só a folha vai para o papel, em A4. */
@media print{
  body *{visibility:hidden!important}
  .pp-folha,.pp-folha *{visibility:visible!important}
  .pp-tela{position:static!important;background:#fff!important}
  .pp-rolo{overflow:visible!important;padding:0!important}
  .pp-topo,.pp-acoes,.pp-alerta,.pp-enviada,.pp-fotos-ed{display:none!important}
  .pp-foto,.pp-foto img,.pp-foto figcaption{break-inside:avoid!important;page-break-inside:avoid!important}
  .pp-fotos-grade{grid-template-columns:repeat(2,1fr)}
  .pp-linha-foto{break-inside:avoid!important}
  .pp-folha{position:absolute;left:0;top:0;width:100%;max-width:none;border:none;padding:0;border-radius:0}
  .pp-secao,.pp-tab tr,.pp-cab{break-inside:avoid}
  @page{size:A4;margin:14mm}
}
    `}</style>
  );
}
