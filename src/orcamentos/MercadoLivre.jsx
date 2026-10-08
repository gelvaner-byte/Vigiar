import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, RefreshCw, Link2, Unlink, AlertTriangle, Star, Package, MessageCircle, Check } from "lucide-react";
import { supabase } from "./supabaseOrc";

/* ============ MERCADO LIVRE — conta conectada, dados reais ============ */

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const curto = (v) => {
  const n = Number(v) || 0;
  return n >= 1000 ? `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k` : brl(n);
};
// Comissão clássica do ML + custo fixo por item barato: estimativa, ajustável nos custos.
const TAXA_PADRAO = 0.14;

export async function buscarDadosML() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch("/api/ml/dados", { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

// Margem líquida de um anúncio, usando os custos que o dono cadastrou.
export function margemDoItem(item, custo) {
  if (!custo || !custo.compra) return null;
  const taxa = custo.taxa != null ? Number(custo.taxa) / 100 : TAXA_PADRAO;
  const imposto = (Number(custo.imposto) || 0) / 100;
  const saida = Number(custo.compra) + (Number(custo.frete) || 0) + (Number(custo.extra) || 0);
  const liquido = item.preco - item.preco * taxa - item.preco * imposto - saida;
  return { lucro: liquido, margem: item.preco ? (liquido / item.preco) * 100 : 0 };
}

export default function MercadoLivre({ dados, carregando, onAtualizar, custos, onSalvarCusto, metaMargem = 35, onToast }) {
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});

  const conectar = async () => {
    const { data } = await supabase.auth.getSession();
    window.location.href = `/api/ml/conectar?token=${encodeURIComponent(data.session?.access_token || "")}`;
  };
  const desconectar = async () => {
    const { data } = await supabase.auth.getSession();
    await fetch("/api/ml/desconectar", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token}` } });
    onToast && onToast("Mercado Livre desconectado.");
    onAtualizar();
  };

  const porId = useMemo(() => new Map((custos || []).map((c) => [c.id, c])), [custos]);

  const abaixoDaMeta = useMemo(() => {
    if (!dados?.anuncios?.lista) return [];
    return dados.anuncios.lista
      .map((i) => ({ item: i, m: margemDoItem(i, porId.get(i.id)) }))
      .filter((x) => x.m && x.m.margem < metaMargem)
      .sort((a, b) => a.m.margem - b.m.margem);
  }, [dados, porId, metaMargem]);

  if (!dados) {
    return <p className="ml-dim">{carregando ? "Consultando o Mercado Livre…" : "Sem informação da conta."}</p>;
  }

  if (!dados.configurado) {
    return (
      <div className="ml-aviso">
        <AlertTriangle size={15} />
        <span>Integração ainda não configurada no servidor. Falta cadastrar o aplicativo do Mercado Livre (eu te passo o passo a passo).</span>
      </div>
    );
  }

  if (!dados.conectado) {
    return (
      <div className="ml-conectar">
        {dados.erro && <div className="ml-aviso"><AlertTriangle size={15} /><span>{dados.erro}</span></div>}
        <p className="ml-dim">Ligue sua conta do Mercado Livre para o TRON enxergar anúncios, vendas, reputação e perguntas de verdade. Só leitura: nada é alterado lá.</p>
        <button className="ml-btn" onClick={conectar}><Link2 size={15} /> Conectar Mercado Livre</button>
      </div>
    );
  }

  if (dados.erro) {
    return (
      <div className="ml-conectar">
        <div className="ml-aviso"><AlertTriangle size={15} /><span>{dados.erro}</span></div>
        <button className="ml-btn" onClick={onAtualizar}><RefreshCw size={15} /> Tentar de novo</button>
      </div>
    );
  }

  const v = dados.vendas30dias;
  const salvarCusto = () => {
    onSalvarCusto({
      id: editando.id, titulo: editando.titulo,
      compra: Number(form.compra) || 0, frete: Number(form.frete) || 0,
      imposto: Number(form.imposto) || 0, extra: Number(form.extra) || 0,
      taxa: form.taxa === "" || form.taxa == null ? null : Number(form.taxa),
    });
    setEditando(null);
  };

  if (editando) {
    const campos = [
      ["compra", "Quanto você paga no produto (R$)"],
      ["frete", "Frete que você paga por venda (R$)"],
      ["extra", "Embalagem e outros (R$)"],
      ["imposto", "Imposto (%)"],
      ["taxa", `Comissão do ML (%) — deixe vazio para usar ${TAXA_PADRAO * 100}%`],
    ];
    return (
      <div className="ml-form">
        <strong>{editando.titulo}</strong>
        <span className="ml-dim">Preço anunciado: {brl(editando.preco)}</span>
        {campos.map(([k, rot]) => (
          <label key={k}>
            <span>{rot}</span>
            <input type="number" step="0.01" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <div className="ml-form-btns">
          <button className="ml-btn" onClick={salvarCusto}><Check size={15} /> Salvar custos</button>
          <button className="ml-btn fraco" onClick={() => setEditando(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ml">
      <div className="ml-topo">
        <span className="ml-conta"><ShoppingCart size={14} /> {dados.conta.apelido}</span>
        <button className="ml-mini" onClick={onAtualizar} disabled={carregando}>
          <RefreshCw size={13} /> {carregando ? "lendo…" : "atualizar"}
        </button>
        <button className="ml-mini" onClick={desconectar}><Unlink size={13} /> desconectar</button>
      </div>

      <div className="ml-nums">
        <div><b>{curto(v.faturado)}</b><span>vendido em 30 dias</span></div>
        <div><b>{v.pedidos}</b><span>pedidos</span></div>
        <div><b>{curto(v.ticketMedio)}</b><span>ticket médio</span></div>
        <div><b>{dados.anuncios.ativos}</b><span>anúncios ativos</span></div>
        <div><b>{dados.anuncios.pausados}</b><span>pausados</span></div>
        <div className={dados.perguntasSemResposta ? "alerta" : ""}>
          <b>{dados.perguntasSemResposta}</b><span>perguntas sem resposta</span>
        </div>
      </div>

      <div className="ml-rep">
        <Star size={13} />
        <span>
          Reputação: <b>{dados.reputacao.nivel || "sem nível"}</b>
          {dados.reputacao.status ? ` · ${dados.reputacao.status}` : ""}
          {dados.reputacao.vendasTotais != null ? ` · ${dados.reputacao.vendasTotais} vendas` : ""}
        </span>
      </div>

      {abaixoDaMeta.length > 0 && (
        <div className="ml-aviso">
          <AlertTriangle size={15} />
          <span>{abaixoDaMeta.length} anúncio(s) abaixo da meta de {metaMargem}% de margem. O pior: {abaixoDaMeta[0].item.titulo} com {abaixoDaMeta[0].m.margem.toFixed(0)}%.</span>
        </div>
      )}

      {v.maisVendidos.length > 0 && (
        <>
          <div className="ml-tit"><Package size={13} /> Mais vendidos em 30 dias</div>
          <ul className="ml-lista">
            {v.maisVendidos.slice(0, 5).map((p) => (
              <li key={p.id}><b>{p.unidades}x</b> {p.titulo}<span className="ml-val">{curto(p.valor)}</span></li>
            ))}
          </ul>
        </>
      )}

      <div className="ml-tit"><ShoppingCart size={13} /> Anúncios · toque para cadastrar custo e ver a margem</div>
      <ul className="ml-anuncios">
        {dados.anuncios.lista.slice(0, 20).map((i) => {
          const custo = porId.get(i.id);
          const m = margemDoItem(i, custo);
          return (
            <li key={i.id} onClick={() => { setEditando(i); setForm(custo || {}); }}>
              {i.foto && <img src={i.foto} alt="" />}
              <span className="ml-an-txt">
                <b>{i.titulo}</b>
                <em>{brl(i.preco)} · {i.estoque} em estoque · {i.vendidos} vendidos{i.situacao === "paused" ? " · pausado" : ""}</em>
              </span>
              {m
                ? <span className={"ml-margem" + (m.margem < metaMargem ? " ruim" : " boa")}>{m.margem.toFixed(0)}%</span>
                : <span className="ml-margem sem">custo?</span>}
            </li>
          );
        })}
      </ul>

      <p className="ml-dim ml-rodape">
        <MessageCircle size={12} /> Dados lidos agora da sua conta. Só leitura: o sistema não altera anúncio, preço nem estoque.
      </p>

      <style>{`
.ml{display:flex;flex-direction:column;gap:10px}
.ml-dim{color:#6f87a8;font-size:12.5px;line-height:1.55;margin:0}
.ml-rodape{display:flex;align-items:center;gap:6px;font-size:11px}
.ml-topo{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ml-conta{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#ffe3cc;
  background:rgba(255,140,50,.15);border:1px solid rgba(255,140,50,.4);border-radius:99px;padding:5px 11px}
.ml-mini{margin-left:auto;display:inline-flex;align-items:center;gap:5px;background:rgba(120,180,255,.08);
  border:1px solid rgba(120,180,255,.2);color:#8ba0bd;border-radius:99px;padding:5px 10px;font-size:11px;
  font-family:inherit;cursor:pointer}
.ml-mini + .ml-mini{margin-left:0}
.ml-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.ml-nums div{background:rgba(120,180,255,.05);border:1px solid rgba(120,180,255,.14);border-radius:10px;padding:9px 10px}
.ml-nums b{display:block;font-size:17px;font-weight:800;font-family:ui-monospace,monospace;color:#fff}
.ml-nums span{display:block;font-size:10px;color:#6f87a8;margin-top:2px;line-height:1.3}
.ml-nums .alerta{border-color:rgba(255,107,107,.4)}
.ml-nums .alerta b{color:#ff6b6b}
.ml-rep{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#b9cbe4}
.ml-rep svg{color:#fbbf24}
.ml-tit{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;letter-spacing:1px;
  text-transform:uppercase;color:#ff9a45;font-family:ui-monospace,monospace;margin-top:4px}
.ml-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.ml-lista li{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#b9cbe4}
.ml-lista b{color:#fff}
.ml-val{margin-left:auto;font-weight:800;color:#22d39a;font-family:ui-monospace,monospace}
.ml-anuncios{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;max-height:300px;overflow-y:auto}
.ml-anuncios li{display:flex;align-items:center;gap:9px;background:rgba(120,180,255,.05);
  border:1px solid rgba(120,180,255,.14);border-radius:10px;padding:8px 10px;cursor:pointer}
.ml-anuncios img{width:34px;height:34px;border-radius:7px;object-fit:cover;flex-shrink:0}
.ml-an-txt{flex:1;display:flex;flex-direction:column;min-width:0}
.ml-an-txt b{font-size:12.5px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ml-an-txt em{font-style:normal;font-size:11px;color:#6f87a8}
.ml-margem{font-size:12px;font-weight:800;font-family:ui-monospace,monospace;white-space:nowrap}
.ml-margem.boa{color:#22d39a}
.ml-margem.ruim{color:#ff6b6b}
.ml-margem.sem{color:#6f87a8;font-weight:600}
.ml-aviso{display:flex;align-items:flex-start;gap:8px;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.35);
  color:#ffc9c9;border-radius:11px;padding:10px 12px;font-size:12.5px;line-height:1.5}
.ml-aviso svg{flex-shrink:0;margin-top:1px}
.ml-conectar{display:flex;flex-direction:column;gap:11px}
.ml-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#e2640a;color:#fff;border:none;
  border-radius:11px;padding:12px 16px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer}
.ml-btn.fraco{background:rgba(120,180,255,.1);color:#b9cbe4;border:1px solid rgba(120,180,255,.22)}
.ml-form{display:flex;flex-direction:column;gap:9px}
.ml-form strong{font-size:13.5px;color:#fff}
.ml-form label{display:flex;flex-direction:column;gap:4px}
.ml-form label span{font-size:11px;color:#6f87a8}
.ml-form input{background:rgba(120,180,255,.07);border:1px solid rgba(120,180,255,.22);color:#fff;border-radius:9px;
  padding:10px;font-size:14px;font-family:inherit;outline:none}
.ml-form-btns{display:flex;gap:8px;margin-top:4px}
.ml-form-btns .ml-btn{flex:1}
      `}</style>
    </div>
  );
}
