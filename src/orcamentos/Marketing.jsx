import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Megaphone, Download, Copy, RefreshCw, Check, ImagePlus, Send, AlertTriangle,
  Clock, Sparkles, Trash2, Palette, Link2, X, Loader,
} from "lucide-react";
import { supabase } from "./supabaseOrc";
import { baixar, baixarTodas, montarArtes } from "./arte.js";
import { deArquivo, uid } from "./imagens.js";
import {
  ACOES, CHECAGENS, entregaDoDia, horarioSugerido, lerMarca, precisaTarjar, textoDaProxima,
} from "./marketing.js";

async function api(caminho, opcoes = {}, segundos = 120) {
  const { data } = await supabase.auth.getSession();
  const corte = new AbortController();
  const relogio = setTimeout(() => corte.abort(), segundos * 1000);
  try {
    const r = await fetch(caminho, {
      ...opcoes,
      signal: corte.signal,
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${data.session?.access_token}`,
        ...(opcoes.headers || {}),
      },
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.erro || `falhou (${r.status})`);
    return corpo;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("demorou demais e foi interrompido");
    throw e;
  } finally {
    clearTimeout(relogio);
  }
}

export const buscarMarketing = () => api("/api/marketing");

/* ===== envio de fotos e vídeos ===== */

function Midias({ midias, onEnviar, onMudar, onApagar, ocupado }) {
  const [abrindo, setAbrindo] = useState(null);

  const escolher = (e) => {
    const lista = [...(e.target.files || [])];
    e.target.value = "";
    if (lista.length) onEnviar(lista);
  };

  return (
    <div className="mk-bloco">
      <div className="mk-bloco-topo">
        <h4>Suas fotos e vídeos</h4>
        <label className="mk-btn pequeno">
          <ImagePlus size={14} /> Enviar
          <input type="file" accept="image/*,video/*" multiple onChange={escolher} hidden />
        </label>
      </div>
      {ocupado && <p className="mk-dim">Preparando os arquivos…</p>}

      {midias.length === 0 ? (
        <p className="mk-dim">
          Mande foto de instalação, de produto, de bastidor e de serviço pronto. O agente usa
          esse material nas artes — e sem ele a arte sai só com o fundo da marca.
        </p>
      ) : (
        <ul className="mk-midias">
          {midias.map((m) => {
            const pendente = precisaTarjar(m);
            return (
              <li key={m.id} className={m.conferida ? "" : "pendente"}>
                {m.tipo === "video"
                  ? <span className="mk-video">vídeo</span>
                  : <img src={m.src} alt="" onClick={() => setAbrindo(m)} />}
                <div className="mk-midia-campos">
                  <input value={m.assunto || ""} placeholder="Do que é esta foto?"
                    onChange={(e) => onMudar(m.id, { assunto: e.target.value })} />
                  <input value={m.nota || ""} placeholder="Observação (opcional)"
                    onChange={(e) => onMudar(m.id, { nota: e.target.value })} />
                  <label className="mk-check">
                    <input type="checkbox" checked={!!m.prioritaria}
                      onChange={(e) => onMudar(m.id, { prioritaria: e.target.checked })} />
                    <span>Usar no próximo post</span>
                  </label>

                  <details className="mk-conferir" open={!m.conferida}>
                    <summary>
                      {m.conferida
                        ? (pendente.length ? `⚠ ${pendente.length} ponto(s) a tarjar` : "✓ Conferida")
                        : "Conferir antes de usar"}
                    </summary>
                    <p className="mk-dim">
                      Marque o que aparece na foto. O que estiver marcado trava o uso até você
                      cobrir ou cortar — dado de cliente não vai para o Instagram.
                    </p>
                    {CHECAGENS.map((c) => (
                      <label key={c.id} className="mk-check">
                        <input type="checkbox" checked={!!m.riscos?.[c.id]}
                          onChange={(e) => onMudar(m.id, { riscos: { ...(m.riscos || {}), [c.id]: e.target.checked } })} />
                        <span>{c.texto}</span>
                      </label>
                    ))}
                    <label className="mk-check destaque">
                      <input type="checkbox" checked={!!m.conferida}
                        onChange={(e) => onMudar(m.id, { conferida: e.target.checked })} />
                      <span>Conferi esta foto</span>
                    </label>
                    <label className="mk-check">
                      <input type="checkbox" checked={!!m.ilustrativa}
                        onChange={(e) => onMudar(m.id, { ilustrativa: e.target.checked })} />
                      <span>É imagem ilustrativa, não é instalação nossa</span>
                    </label>
                  </details>
                </div>
                <button className="mk-rem" onClick={() => onApagar(m.id)} aria-label="Apagar"><Trash2 size={13} /></button>
              </li>
            );
          })}
        </ul>
      )}

      {abrindo && (
        <div className="mk-lupa" onClick={() => setAbrindo(null)}>
          <img src={abrindo.src} alt="" />
        </div>
      )}
    </div>
  );
}

/* ===== o post do dia ===== */

function Entrega({ entrega, marca, midias, onAjustar, onPublicado, onToast }) {
  const [artes, setArtes] = useState([]);
  const [montando, setMontando] = useState(true);
  const [pedido, setPedido] = useState("");

  useEffect(() => {
    let vivo = true;
    setMontando(true);
    montarArtes(entrega, marca, midias)
      .then((a) => { if (vivo) { setArtes(a); setMontando(false); } })
      .catch(() => { if (vivo) setMontando(false); });
    return () => { vivo = false; };
  }, [entrega, marca, midias]);

  const h = horarioSugerido(marca.insights, new Date(entrega.data).getDate());
  const legendaCheia = [
    entrega.legenda,
    (entrega.hashtags || []).length ? (entrega.hashtags || []).map((t) => `#${t}`).join(" ") : "",
  ].filter(Boolean).join("\n\n");

  const copiar = async (texto, oque) => {
    try { await navigator.clipboard.writeText(texto); onToast(`${oque} copiada.`); }
    catch { onToast("Não consegui copiar."); }
  };

  if (!entrega.ok) {
    return (
      <div className="mk-erro">
        <AlertTriangle size={17} />
        <div>
          <b>O post de {entrega.data} não saiu.</b>
          <p>{entrega.erro}</p>
          <p className="mk-dim">Use o botão Gerar agora aqui em cima para tentar de novo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mk-entrega">
      <div className="mk-entrega-topo">
        <div>
          <span className="mk-tag">{entrega.assuntoNome} · {entrega.formatoNome}</span>
          <h3>{entrega.titulo}</h3>
          <span className="mk-dim">
            {artes.length === 1 ? "Imagem única" : `Carrossel de ${artes.length} imagens`} · 1080×1350
            {entrega.publicadoEm ? " · já publicado" : ""}
          </span>
        </div>
      </div>

      {!!(entrega.avisos || []).length && (
        <div className="mk-aviso">
          <AlertTriangle size={14} />
          <span>{entrega.avisos.join(" · ")}</span>
        </div>
      )}

      {montando ? (
        <p className="mk-dim"><Loader size={14} /> Montando as artes…</p>
      ) : (
        <>
          <div className="mk-artes">
            {artes.map((a) => (
              <figure key={a.indice}>
                <img src={a.src} alt={`Arte ${a.indice + 1}`} />
                <figcaption>
                  <span>{a.indice + 1}</span>
                  <button onClick={() => baixar(a.nome, a.src)}><Download size={12} /> Baixar</button>
                </figcaption>
              </figure>
            ))}
          </div>
          <button className="mk-btn largo" onClick={() => baixarTodas(artes)}>
            <Download size={15} /> Baixar {artes.length > 1 ? `as ${artes.length} imagens na ordem` : "a imagem"}
          </button>
        </>
      )}

      <div className="mk-legenda">
        <div className="mk-bloco-topo">
          <h4>Legenda</h4>
          <button className="mk-btn pequeno fantasma" onClick={() => copiar(legendaCheia, "Legenda")}>
            <Copy size={13} /> Copiar
          </button>
        </div>
        <pre>{legendaCheia}</pre>
      </div>

      <div className="mk-duplo">
        <div className="mk-caixa">
          <h4><Clock size={13} /> Melhor hora para publicar</h4>
          <b>{h.hora}</b>
          <p className="mk-dim">
            {h.porque}
            {h.teste ? " — é um teste: sem os seus Insights ainda, vale experimentar e comparar." : ""}
          </p>
        </div>
        <div className="mk-caixa">
          <h4><Sparkles size={13} /> Depois de publicar</h4>
          <p>{entrega.acao || ACOES[0]}</p>
        </div>
      </div>

      {!!(entrega.fontes || []).length && (
        <div className="mk-caixa">
          <h4><Link2 size={13} /> De onde veio a informação</h4>
          <ul className="mk-fontes">
            {entrega.fontes.map((f, i) => (
              <li key={i}><a href={f.url} target="_blank" rel="noreferrer">{f.titulo || f.url}</a></li>
            ))}
          </ul>
        </div>
      )}

      <div className="mk-ajuste">
        <input value={pedido} onChange={(e) => setPedido(e.target.value)}
          placeholder="Pedir ajuste: ex. deixa mais curto, foca no síndico, troca a chamada"
          onKeyDown={(e) => { if (e.key === "Enter" && pedido.trim()) { onAjustar(pedido.trim()); setPedido(""); } }} />
        <button className="mk-btn fantasma" disabled={!pedido.trim()}
          onClick={() => { onAjustar(pedido.trim()); setPedido(""); }}>
          <RefreshCw size={14} /> Refazer com ajuste
        </button>
      </div>

      <button className={"mk-btn largo" + (entrega.publicadoEm ? " fantasma" : " verde")}
        onClick={() => onPublicado(entrega)}>
        <Check size={15} /> {entrega.publicadoEm ? "Publicado ✓ (desmarcar)" : "Marcar como publicado"}
      </button>
    </div>
  );
}

/* ===== conversa com o especialista ===== */

function Chat({ retrato, onToast }) {
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fim = useRef(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, pensando]);

  const enviar = async (direto) => {
    const t = String(direto ?? texto).trim();
    if (!t || pensando) return;
    setTexto("");
    const novas = [...msgs, { role: "user", content: [{ type: "text", text: t }] }];
    setMsgs(novas);
    setPensando(true);
    try {
      const r = await api("/api/marketing?acao=chat", {
        method: "POST",
        body: JSON.stringify({ mensagens: novas.slice(-16), retrato }),
      });
      setMsgs([...novas, { role: "assistant", content: [{ type: "text", text: r.texto }] }]);
    } catch (e) {
      onToast("Não deu: " + String(e.message || e));
      setMsgs(novas);
    } finally {
      setPensando(false);
    }
  };

  const SUG = [
    "Monte meu calendário da semana",
    "O que eu posto nos Stories hoje?",
    "O que testar na semana que vem?",
  ];

  return (
    <div className="mk-chat">
      <div className="mk-chat-rolo">
        {msgs.length === 0 && (
          <div className="mk-chat-vazio">
            <Megaphone size={20} />
            <p>
              Sou o seu especialista de Instagram. Peço o que você precisa: calendário da semana,
              ideia de Story, o que fazer com um vídeo, ou cole os números do seu Insights que eu
              digo o que mudar.
            </p>
            <div className="mk-sug">
              {SUG.map((s) => <button key={s} onClick={() => enviar(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"mk-msg " + m.role}>
            {m.content.map((b, j) => b.type === "text" ? <p key={j}>{b.text}</p> : null)}
          </div>
        ))}
        {pensando && <div className="mk-msg assistant"><p className="mk-dim">Pensando…</p></div>}
        <div ref={fim} />
      </div>
      <form className="mk-chat-envio" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte ou cole os números do Insights…" disabled={pensando} />
        <button type="submit" disabled={pensando || !texto.trim()}><Send size={15} /></button>
      </form>
    </div>
  );
}

/* ===== identidade visual ===== */

function Marca({ marca, onMudar }) {
  const logo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = await deArquivo(f);
    onMudar({ logo: r.src });
  };
  return (
    <div className="mk-bloco">
      <div className="mk-bloco-topo"><h4><Palette size={13} /> Identidade da Vigiar</h4></div>
      <p className="mk-dim">Entra em toda arte: logo, cores e contato no rodapé.</p>
      <div className="mk-marca">
        <label className="mk-logo">
          {marca.logo ? <img src={marca.logo} alt="" /> : <span>sem logo</span>}
          <input type="file" accept="image/*" onChange={logo} hidden />
          <em>{marca.logo ? "Trocar" : "Enviar logo"}</em>
        </label>
        <div className="mk-marca-campos">
          <label><span>Telefone no rodapé</span>
            <input value={marca.telefone || ""} placeholder="(31) 0000-0000"
              onChange={(e) => onMudar({ telefone: e.target.value })} /></label>
          <label><span>Instagram</span>
            <input value={marca.instagram || ""} placeholder="@vigiarsistemas"
              onChange={(e) => onMudar({ instagram: e.target.value })} /></label>
          <div className="mk-cores">
            <label><span>Fundo</span>
              <input type="color" value={marca.corFundo} onChange={(e) => onMudar({ corFundo: e.target.value })} /></label>
            <label><span>Destaque</span>
              <input type="color" value={marca.corDestaque} onChange={(e) => onMudar({ corDestaque: e.target.value })} /></label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== painel ===== */

export default function Marketing({ dados, carregando, onAtualizar, onToast }) {
  const [aba, setAba] = useState("hoje");
  const [gerando, setGerando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const entregas = dados?.entregas || [];
  const midias = dados?.midias || [];
  const marca = lerMarca(dados?.cfg);
  const hoje = dados?.hoje || new Date().toISOString().slice(0, 10);
  const doDia = entregaDoDia(entregas, hoje);
  const ultima = doDia || entregas.find((e) => e.ok) || null;

  const retrato = useMemo(() => ({
    hoje,
    ultimosPosts: entregas.filter((e) => e.ok).slice(0, 10)
      .map((e) => ({ data: e.data, assunto: e.assuntoNome, formato: e.formatoNome, titulo: e.titulo, publicado: !!e.publicadoEm })),
    fotosDisponiveis: midias.filter((m) => m.conferida).length,
    fotosPendentesDeConferencia: midias.filter((m) => !m.conferida).length,
    insightsCadastrados: !!marca.insights,
  }), [entregas, midias, hoje, marca.insights]);

  const gerar = async (extra, pedido) => {
    setGerando(true);
    try {
      const r = await api("/api/marketing?acao=gerar", {
        method: "POST", body: JSON.stringify({ extra: !!extra, pedido: pedido || "" }),
      }, 180);
      onToast(r.jaExistia ? "O post de hoje já estava pronto." : "Post gerado.");
      await onAtualizar();
    } catch (e) {
      onToast("Não deu: " + String(e.message || e));
    } finally {
      setGerando(false);
    }
  };

  const salvar = async (corpo) => {
    try { await api("/api/marketing?acao=salvar", { method: "POST", body: JSON.stringify(corpo) }); await onAtualizar(); }
    catch (e) { onToast("Não consegui salvar: " + String(e.message || e)); }
  };

  const enviarMidias = async (arquivos) => {
    setOcupado(true);
    const novas = [];
    for (const f of arquivos) {
      const ehVideo = /^video\//.test(f.type);
      if (ehVideo) {
        novas.push({
          id: uid(), tipo: "video", nome: f.name, src: null, assunto: "", nota: "",
          prioritaria: false, conferida: false, riscos: {}, enviadaEm: new Date().toISOString(),
          aviso: "Vídeo fica registrado aqui para o Reel; a arte do feed usa foto.",
        });
        continue;
      }
      try {
        const r = await deArquivo(f);
        novas.push({
          id: uid(), tipo: "foto", nome: f.name, src: r.src, assunto: "", nota: "",
          prioritaria: false, conferida: false, ilustrativa: false, riscos: {},
          enviadaEm: new Date().toISOString(),
        });
      } catch (e) { onToast(String(e.message || e)); }
    }
    if (novas.length) await salvar({ midias: novas });
    setOcupado(false);
  };

  if (!dados && carregando) return <p className="mk-dim">Carregando o marketing…</p>;
  if (dados && !dados.configurado) {
    return <p className="mk-dim">O agente de marketing precisa da chave da Anthropic na Vercel.</p>;
  }

  return (
    <div className="mk">
      <Estilo />

      <div className="mk-topo">
        <div>
          <span className="mk-dim">Próxima entrega automática: <b>{textoDaProxima()}</b></span>
          {!dados?.rotinaPronta && (
            <span className="mk-aviso linha">
              <AlertTriangle size={12} /> A entrega automática precisa da chave de serviço do Supabase na Vercel.
            </span>
          )}
        </div>
        <button className="mk-btn" onClick={() => gerar(!!doDia)} disabled={gerando}>
          <RefreshCw size={14} className={gerando ? "mk-girando" : ""} />
          {gerando ? "Gerando…" : doDia ? "Gerar post extra" : "Gerar agora"}
        </button>
      </div>

      <nav className="mk-abas">
        {[["hoje", "Post de hoje"], ["midias", `Fotos (${midias.length})`],
          ["chat", "Falar com o agente"], ["historico", `Histórico (${entregas.length})`],
          ["marca", "Identidade"]].map(([id, nome]) => (
          <button key={id} className={aba === id ? "on" : ""} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </nav>

      {aba === "hoje" && (
        ultima ? (
          <Entrega
            entrega={ultima}
            marca={marca}
            midias={midias}
            onAjustar={(pedido) => gerar(true, pedido)}
            onPublicado={(e) => salvar({ entrega: { ...e, publicadoEm: e.publicadoEm ? null : new Date().toISOString() } })}
            onToast={onToast}
          />
        ) : (
          <p className="mk-dim">
            Ainda não há post. A primeira entrega automática sai {textoDaProxima()}, ou use
            o botão Gerar agora aqui em cima.
          </p>
        )
      )}

      {aba === "midias" && (
        <Midias
          midias={midias}
          ocupado={ocupado}
          onEnviar={enviarMidias}
          onMudar={(id, campos) => {
            const m = midias.find((x) => x.id === id);
            if (m) salvar({ midias: [{ ...m, ...campos }] });
          }}
          onApagar={(id) => {
            const m = midias.find((x) => x.id === id);
            if (m) salvar({ midias: [{ ...m, arquivada: true }] });
          }}
        />
      )}

      {aba === "chat" && <Chat retrato={retrato} onToast={onToast} />}

      {aba === "historico" && (
        entregas.length === 0 ? <p className="mk-dim">Sem entregas ainda.</p> : (
          <ul className="mk-hist">
            {entregas.map((e) => (
              <li key={e.id} className={e.ok ? "" : "falhou"}>
                <b>{new Date(`${e.data}T12:00`).toLocaleDateString("pt-BR")}</b>
                <span>{e.ok ? (e.titulo || e.assuntoNome) : `falhou: ${e.erro}`}</span>
                <em>{e.assuntoNome}{e.extra ? " · extra" : ""}{e.publicadoEm ? " · publicado" : ""}</em>
              </li>
            ))}
          </ul>
        )
      )}

      {aba === "marca" && <Marca marca={marca} onMudar={(campos) => salvar({ cfg: { ...marca, ...campos } })} />}
    </div>
  );
}

function Estilo() {
  return (
    <style>{`
.mk{display:flex;flex-direction:column;gap:14px;font-size:13px}
.mk h4{display:flex;align-items:center;gap:6px;margin:0;font-size:10px;font-weight:800;letter-spacing:1.3px;
  text-transform:uppercase;color:#ff9a45;font-family:"JetBrains Mono",ui-monospace,"Courier New",monospace}
.mk-dim{margin:0;font-size:12px;line-height:1.55;color:#7e94b4}
.mk-dim b{color:#dce7f5}
.mk-topo{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.mk-topo > div{flex:1;display:flex;flex-direction:column;gap:5px}
.mk-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;border:none;
  border-radius:9px;padding:10px 15px;font-size:12.5px;font-weight:700;font-family:inherit;background:#e2640a;color:#fff}
.mk-btn:disabled{opacity:.5;cursor:default}
.mk-btn.fantasma{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)}
.mk-btn.verde{background:#159b63}
.mk-btn.pequeno{padding:7px 11px;font-size:11.5px}
.mk-btn.largo{width:100%}
.mk-girando{animation:mkgira 1s linear infinite}
@keyframes mkgira{to{transform:rotate(360deg)}}
.mk-abas{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.mk-abas::-webkit-scrollbar{display:none}
.mk-abas button{flex-shrink:0;white-space:nowrap;cursor:pointer;border-radius:99px;padding:8px 14px;
  font-size:12px;font-weight:700;font-family:inherit;color:#7e94b4;background:rgba(120,180,255,.06);
  border:1px solid rgba(120,180,255,.16)}
.mk-abas button.on{color:#fff;background:#e2640a;border-color:#e2640a}
.mk-aviso{display:flex;align-items:center;gap:6px;border-radius:9px;padding:9px 11px;font-size:11.5px;
  line-height:1.5;color:#ffb27a;background:rgba(255,140,50,.09);border:1px solid rgba(255,140,50,.3)}
.mk-aviso.linha{padding:6px 9px;font-size:11px}
.mk-erro{display:flex;gap:10px;border-radius:11px;padding:13px;color:#ff8f8f;
  background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.3)}
.mk-erro b{color:#fff}
.mk-erro p{margin:4px 0 0;font-size:12.5px;line-height:1.5}

.mk-entrega{display:flex;flex-direction:column;gap:13px}
.mk-tag{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;
  color:#ff9a45;border:1px solid rgba(255,140,50,.4);border-radius:99px;padding:3px 9px}
.mk-entrega h3{margin:7px 0 3px;font-size:16px;color:#fff}
.mk-artes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.mk-artes figure{margin:0}
.mk-artes img{width:100%;display:block;border-radius:9px;border:1px solid rgba(120,180,255,.2)}
.mk-artes figcaption{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:11px;color:#7e94b4}
.mk-artes figcaption span{width:20px;height:20px;display:grid;place-items:center;border-radius:50%;
  background:rgba(255,140,50,.2);color:#ff9a45;font-weight:800;font-size:10px}
.mk-artes figcaption button{display:inline-flex;align-items:center;gap:4px;margin-left:auto;cursor:pointer;
  font-family:inherit;font-size:10.5px;color:#b9cbe4;background:rgba(120,180,255,.1);
  border:1px solid rgba(120,180,255,.2);border-radius:7px;padding:4px 8px}
.mk-legenda pre{margin:8px 0 0;padding:12px 14px;border-radius:10px;white-space:pre-wrap;word-break:break-word;
  font-family:inherit;font-size:13px;line-height:1.6;color:#dce7f5;background:rgba(120,180,255,.05);
  border:1px solid rgba(120,180,255,.16)}
.mk-bloco-topo{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mk-duplo{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:620px){.mk-duplo{grid-template-columns:1fr 1fr}}
.mk-caixa{border-radius:11px;padding:12px 14px;background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.16)}
.mk-caixa b{display:block;margin:6px 0 3px;font-size:21px;font-family:"JetBrains Mono",ui-monospace,"Courier New",monospace;color:#fff}
.mk-caixa p{margin:6px 0 0;font-size:12.5px;line-height:1.55;color:#b9cbe4}
.mk-fontes{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:12px}
.mk-fontes a{color:#78a8e0;word-break:break-all}
.mk-ajuste{display:flex;gap:8px;flex-wrap:wrap}
.mk-ajuste input{flex:1;min-width:200px}
.mk input,.mk textarea{box-sizing:border-box;border-radius:9px;padding:10px 12px;font-size:12.5px;
  font-family:inherit;background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;outline:none}
.mk input:focus{border-color:#ff8c32}

.mk-bloco{display:flex;flex-direction:column;gap:10px}
.mk-midias{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.mk-midias li{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:11px;
  background:rgba(120,180,255,.04);border:1px solid rgba(120,180,255,.14)}
.mk-midias li.pendente{border-color:rgba(255,140,50,.35)}
.mk-midias li > img{width:76px;height:76px;flex-shrink:0;border-radius:8px;object-fit:cover;cursor:zoom-in;
  border:1px solid rgba(120,180,255,.2)}
.mk-video{width:76px;height:76px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;
  font-size:11px;color:#7e94b4;background:rgba(120,180,255,.08);border:1px solid rgba(120,180,255,.2)}
.mk-midia-campos{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.mk-midia-campos input[type=text],.mk-midia-campos input:not([type]){width:100%}
.mk-check{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.4;color:#b9cbe4;cursor:pointer}
.mk-check input{width:16px;height:16px;flex-shrink:0;margin-top:1px;accent-color:#e2640a}
.mk-check.destaque{color:#22d39a;font-weight:600}
.mk-conferir{border-radius:9px;padding:8px 10px;background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14)}
.mk-conferir summary{cursor:pointer;font-size:11.5px;color:#ff9a45}
.mk-conferir > *{margin-top:6px}
.mk-rem{flex-shrink:0;cursor:pointer;border:none;background:none;color:#ff8f8f;padding:2px}
.mk-lupa{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;
  background:rgba(0,0,0,.85);cursor:zoom-out}
.mk-lupa img{max-width:100%;max-height:100%;border-radius:10px}

.mk-chat{display:flex;flex-direction:column;gap:10px;min-height:340px}
.mk-chat-rolo{flex:1;display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto}
.mk-chat-vazio{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;
  padding:22px 14px;color:#8ba3c2}
.mk-chat-vazio svg{color:#ff9a45}
.mk-chat-vazio p{margin:0;font-size:12.5px;line-height:1.6;max-width:440px}
.mk-sug{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}
.mk-sug button{cursor:pointer;font-family:inherit;font-size:11.5px;color:#b9cbe4;border-radius:99px;
  padding:7px 12px;background:rgba(120,180,255,.08);border:1px solid rgba(120,180,255,.2)}
.mk-msg{max-width:88%;border-radius:12px;padding:10px 13px;font-size:13px;line-height:1.6}
.mk-msg p{margin:0 0 7px;white-space:pre-wrap}
.mk-msg p:last-child{margin:0}
.mk-msg.user{align-self:flex-end;background:#e2640a;color:#fff}
.mk-msg.assistant{align-self:flex-start;background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.16);color:#dce7f5}
.mk-chat-envio{display:flex;gap:8px}
.mk-chat-envio input{flex:1}
.mk-chat-envio button{width:44px;display:grid;place-items:center;cursor:pointer;border:none;border-radius:9px;
  background:#e2640a;color:#fff}
.mk-chat-envio button:disabled{opacity:.45}

.mk-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.mk-hist li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px;color:#b9cbe4;
  padding-bottom:7px;border-bottom:1px solid rgba(120,180,255,.1)}
.mk-hist li.falhou{color:#ff8f8f}
.mk-hist b{font-family:"JetBrains Mono",ui-monospace,"Courier New",monospace;color:#fff}
.mk-hist span{flex:1;min-width:140px}
.mk-hist em{font-style:normal;font-size:10.5px;color:#6f87a8}

.mk-marca{display:flex;gap:14px;flex-wrap:wrap}
.mk-logo{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer}
.mk-logo img{width:84px;height:84px;border-radius:12px;object-fit:contain;background:#fff;
  border:1px solid rgba(120,180,255,.2)}
.mk-logo span{width:84px;height:84px;display:grid;place-items:center;border-radius:12px;font-size:11px;
  color:#6f87a8;background:rgba(120,180,255,.06);border:1px dashed rgba(120,180,255,.3)}
.mk-logo em{font-style:normal;font-size:11px;color:#ff9a45}
.mk-marca-campos{flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px}
.mk-marca-campos label{display:flex;flex-direction:column;gap:4px}
.mk-marca-campos span{font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#7e94b4}
.mk-cores{display:flex;gap:12px}
.mk-cores label{flex:1}
.mk-cores input{height:40px;padding:3px;cursor:pointer}
    `}</style>
  );
}
