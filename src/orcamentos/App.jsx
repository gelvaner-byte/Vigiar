import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ShieldCheck, Bell, Home, FileText, Wrench, Plus, Trash2, Share2,
  Check, X, Clock, AlertTriangle, Phone, MapPin, Send, ChevronLeft,
  CalendarClock, CircleCheck, Pencil, ThumbsUp, ThumbsDown, Copy, Download,
  UserRound, Users, Star, Upload, LogOut, RefreshCw
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  carregarTudo, sincronizarLista, salvarRegistros, salvarConfig,
  assinarMudancas, lerCache, gravarCache,
} from "./storage";

/* ============ armazenamento ============ */
// Dados ficam no Supabase (compartilhados). Só a "vendedora ativa" é por aparelho.
const KEY_ATIVA = "vigiar:orc:vendedoraAtiva";
const lerAtiva = () => { try { return localStorage.getItem(KEY_ATIVA) || ""; } catch { return ""; } };
const gravarAtiva = (id) => { try { localStorage.setItem(KEY_ATIVA, id || ""); } catch { /* ignora */ } };

function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

// Aceita o backup deste app e também o formato do app antigo (chaves vigiar:*:v1).
function lerBackup(json) {
  const pegar = (...chaves) => {
    for (const k of chaves) {
      let v = json[k];
      if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* segue */ } }
      if (v != null) return v;
    }
    return null;
  };
  const orcamentos = pegar("orcamentos", "vigiar:orcamentos:v1") || [];
  const ordens = pegar("ordens", "vigiar:ordens:v1") || [];
  const vend = pegar("vendedoras", "vigiar:vendedoras:v1");
  const vendedoras = Array.isArray(vend) ? vend : (vend && vend.lista) || [];
  if (!Array.isArray(orcamentos) || !Array.isArray(ordens)) throw new Error("Arquivo de backup inválido.");
  return { orcamentos, ordens, vendedoras };
}
const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "Perfil";

/* ============ utilidades ============ */
const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const addDaysStr = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const brl = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const itemsTotal = (itens) =>
  (itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
const nextNumero = (arr) =>
  String((arr.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1)).padStart(4, "0");
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Link do Google Maps (no celular abre direto o app do Maps)
const CIDADE_PADRAO = "Belo Horizonte - MG";
const mapsUrl = (endereco, bairro) => {
  const end = String(endereco || "").trim();
  if (!end) return "";
  const partes = [end, bairro];
  if (!/belo horizonte|\bbh\b|\bmg\b/i.test(`${end} ${bairro || ""}`)) partes.push(CIDADE_PADRAO);
  const q = partes.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch (e) { return false; }
}

/* ============ dados da empresa (do modelo do orçamento) ============ */
const EMPRESA = {
  nome: "VIGIAR SISTEMAS ELETRÔNICO DE SEGURANÇA LTDA",
  cnpj: "03.574.806/0001-81",
  endereco: "Av. Portugal, nº 2501",
  bairro: "Santa Amélia",
  cidade: "Belo Horizonte - MG",
  cep: "31555-000",
  email: "vigiarsistemas@hotmail.com",
  fone: "(31) 3427-0281 / 3427-2242",
};

/* ============ gerador de PDF embutido (sem dependências externas) ============ */
const HELV = {32:278,33:278,34:355,35:556,36:556,37:889,38:667,39:191,40:333,41:333,42:389,43:584,44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,56:556,57:556,58:278,59:278,60:584,61:584,62:584,63:556,64:1015,65:667,66:667,67:722,68:722,69:667,70:611,71:778,72:722,73:278,74:500,75:667,76:556,77:833,78:722,79:778,80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:278,92:278,93:278,94:469,95:556,96:333,97:556,98:556,99:500,100:556,101:556,102:278,103:556,104:556,105:222,106:222,107:500,108:222,109:833,110:556,111:556,112:556,113:556,114:333,115:500,116:278,117:556,118:500,119:722,120:500,121:500,122:500,123:334,124:260,125:334,126:584};
const HELVB = {32:278,33:333,34:474,35:556,36:556,37:889,38:722,39:238,40:333,41:333,42:389,43:584,44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,56:556,57:556,58:333,59:333,60:584,61:584,62:584,63:611,64:975,65:722,66:722,67:722,68:722,69:667,70:611,71:778,72:722,73:278,74:556,75:722,76:611,77:833,78:722,79:778,80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:333,92:278,93:333,94:584,95:556,96:333,97:556,98:611,99:556,100:611,101:556,102:333,103:611,104:611,105:278,106:278,107:556,108:278,109:889,110:611,111:611,112:611,113:611,114:389,115:556,116:333,117:611,118:556,119:778,120:556,121:556,122:500,123:389,124:280,125:389,126:584};
function _w(code, bold) { const t = bold ? HELVB : HELV; return t[code] != null ? t[code] : 556; }
function _toWin(s) { return String(s).replace(/[   ⁠]/g, " ").replace(/[–—]/g, "-").replace(/[^\x00-\xFF]/g, "?"); }
function _measure(s, size, bold) { let w = 0; for (let i = 0; i < s.length; i++) w += _w(s.charCodeAt(i), bold); return (w / 1000) * size; }
function _esc(s) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function _wrap(s, size, bold, maxwPt) {
  const words = String(s).split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (_measure(_toWin(test), size, bold) <= maxwPt || !cur) cur = test;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function buildPDF(draw) {
  const Hp = 841.89, MM = 2.83465;
  const ops = [];
  const api = {
    MM, W: 210, RIGHT: 196,
    text(xmm, topmm, str, o = {}) {
      const { size = 9, bold = false, align = "left", color = [0, 0, 0] } = o;
      const font = bold ? "F2" : "F1";
      const txt = _toWin(str);
      let xpt = xmm * MM; const ypt = Hp - topmm * MM;
      if (align !== "left") { const wpt = _measure(txt, size, bold); xpt = align === "right" ? xmm * MM - wpt : xmm * MM - wpt / 2; }
      const [r, g, b] = color;
      ops.push(`${r} ${g} ${b} rg BT /${font} ${size} Tf ${xpt.toFixed(2)} ${ypt.toFixed(2)} Td (${_esc(txt)}) Tj ET`);
    },
    rect(xmm, topmm, wmm, hmm, color = [0, 0, 0]) {
      const [r, g, b] = color;
      const x = xmm * MM, w = wmm * MM, h = hmm * MM, y = Hp - (topmm + hmm) * MM;
      ops.push(`${r} ${g} ${b} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    },
    line(x1, y1, x2, y2, color = [0.6, 0.6, 0.6], lw = 0.4) {
      const [r, g, b] = color;
      ops.push(`${(lw * MM).toFixed(2)} w ${r} ${g} ${b} RG ${(x1 * MM).toFixed(2)} ${(Hp - y1 * MM).toFixed(2)} m ${(x2 * MM).toFixed(2)} ${(Hp - y2 * MM).toFixed(2)} l S`);
    },
    wrap: (s, size, bold, maxwmm) => _wrap(s, size, bold, maxwmm * MM),
  };
  draw(api);
  const content = ops.join("\n");
  const objs = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objs[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objs[6] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  let pdf = "%PDF-1.3\n"; const off = [];
  for (let i = 1; i <= 6; i++) { off[i] = pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) pdf += String(off[i]).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xFF;
  return new Blob([bytes], { type: "application/pdf" });
}
function gerarOrcamentoBlob(orc) {
  try {
    return buildPDF((p) => {
      const M = 14, RIGHT = p.RIGHT, W = p.W;
      const navy = [0.051, 0.110, 0.180], gray = [0.28, 0.28, 0.28], lineC = [0.59, 0.59, 0.59], lightRow = [0.957, 0.969, 0.984], white = [1, 1, 1];
      p.text(M, 18, EMPRESA.nome, { size: 12.5, bold: true });
      let hy = 24;
      [`CNPJ: ${EMPRESA.cnpj}`, EMPRESA.endereco, `${EMPRESA.bairro} - ${EMPRESA.cidade} - CEP: ${EMPRESA.cep}`, `E-mail: ${EMPRESA.email}`, `Fone: ${EMPRESA.fone}`].forEach((l) => { p.text(M, hy, l, { size: 8.5, color: gray }); hy += 4.3; });
      p.text(RIGHT, 18, fmtDate(todayStr()), { size: 8.5, align: "right", color: gray });
      p.text(RIGHT, 22.3, "Página: 1 / 1", { size: 8.5, align: "right", color: gray });
      let y = hy + 1; p.line(M, y, RIGHT, y, lineC, 0.4); y += 7;
      p.text(RIGHT, y, `Orçamento nº: ${orc.numero}`, { size: 11, bold: true, align: "right" });
      const cli = (lbl, val) => { p.text(M, y, lbl, { size: 9.2, bold: true }); p.text(M + 24, y, String(val || "-"), { size: 9.2 }); y += 5.4; };
      cli("Para:", orc.cliente || "CLIENTE S/ CADASTRO");
      cli("Endereço:", orc.endereco);
      if (orc.bairro) cli("Bairro:", orc.bairro);
      cli("Telefone:", orc.telefone);
      y += 2;
      const cX = { qtd: M, cod: M + 18, uni: M + 46, des: M + 68 };
      p.rect(M, y - 4.6, RIGHT - M, 7, navy);
      p.text(cX.qtd + 1, y, "Qtde", { size: 8.8, bold: true, color: white });
      p.text(cX.cod, y, "Código", { size: 8.8, bold: true, color: white });
      p.text(cX.uni, y, "Unid.", { size: 8.8, bold: true, color: white });
      p.text(cX.des, y, "Descrição", { size: 8.8, bold: true, color: white });
      y += 5.5;
      const desW = RIGHT - cX.des - 1;
      (orc.itens || []).forEach((it, idx) => {
        const linhas = p.wrap(String(it.descricao || ""), 9, false, desW);
        const alt = Math.max(linhas.length * 4.3, 5.6);
        if (idx % 2 === 1) p.rect(M, y - 3.8, RIGHT - M, alt, lightRow);
        p.text(cX.qtd + 1, y, String(it.qtd == null ? "" : it.qtd), { size: 9 });
        p.text(cX.cod, y, String(it.codigo || ""), { size: 9 });
        p.text(cX.uni, y, String(it.unidade || "UN"), { size: 9 });
        linhas.forEach((ln, k) => p.text(cX.des, y + k * 4.3, ln, { size: 9 }));
        y += alt;
      });
      y += 1; p.line(M, y, RIGHT, y, lineC, 0.4); y += 7.5;
      p.text(RIGHT - 44, y, "Valor Total", { size: 11.5, bold: true, align: "right" });
      p.text(RIGHT, y, brl(itemsTotal(orc.itens)), { size: 11.5, bold: true, align: "right" });
      y += 11;
      p.text(M, y, `Vendedor: ${orc.vendedor || "-"}`, { size: 9.2 });
      if (orc.observacoes) { y += 6; p.wrap(`Obs.: ${orc.observacoes}`, 9, false, RIGHT - M).forEach((ln, k) => p.text(M, y + k * 4.4, ln, { size: 9 })); }
      p.text(W / 2, 276, `ORÇAMENTO VÁLIDO POR ${orc.validadeDias || 7} DIAS!`, { size: 9.5, bold: true, align: "center", color: navy });
      p.text(W / 2, 282, "SUA SEGURANÇA EM PRIMEIRO LUGAR.", { size: 9.5, bold: true, align: "center", color: navy });
    });
  } catch (e) { console.error(e); return null; }
}

/* ============ desenho do orçamento em imagem (canvas) ============ */
function _cfont(ctx, sizePt, bold, S) { ctx.font = `${bold ? "bold " : ""}${(sizePt * 0.3528 * S).toFixed(1)}px Helvetica, Arial, sans-serif`; }
function _cwrap(ctx, text, maxWpx) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width <= maxWpx || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function desenharOrcamento(ctx, orc, S) {
  const mm = (v) => v * S;
  const W = 210, RIGHT = 196, M = 14;
  const navy = "#0d1c2e", gray = "#474747", lineC = "#969696", lightRow = "#f4f7fb", white = "#ffffff", black = "#141414";
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, mm(210), mm(297));
  ctx.textBaseline = "alphabetic";
  const T = (xmm, topmm, str, sizePt, opts = {}) => {
    const { bold = false, align = "left", color = black } = opts;
    _cfont(ctx, sizePt, bold, S); ctx.fillStyle = color; ctx.textAlign = align;
    ctx.fillText(String(str), mm(xmm), mm(topmm));
  };
  T(M, 18, EMPRESA.nome, 12.5, { bold: true });
  let hy = 24;
  [`CNPJ: ${EMPRESA.cnpj}`, EMPRESA.endereco, `${EMPRESA.bairro} - ${EMPRESA.cidade} - CEP: ${EMPRESA.cep}`, `E-mail: ${EMPRESA.email}`, `Fone: ${EMPRESA.fone}`].forEach((l) => { T(M, hy, l, 8.5, { color: gray }); hy += 4.3; });
  T(RIGHT, 18, fmtDate(todayStr()), 8.5, { align: "right", color: gray });
  T(RIGHT, 22.3, "Página: 1 / 1", 8.5, { align: "right", color: gray });
  let y = hy + 1;
  ctx.strokeStyle = lineC; ctx.lineWidth = Math.max(1, 0.4 * S);
  ctx.beginPath(); ctx.moveTo(mm(M), mm(y)); ctx.lineTo(mm(RIGHT), mm(y)); ctx.stroke();
  y += 7;
  T(RIGHT, y, `Orçamento nº: ${orc.numero}`, 11, { bold: true, align: "right" });
  const cli = (lbl, val) => { T(M, y, lbl, 9.2, { bold: true }); T(M + 24, y, String(val || "-"), 9.2); y += 5.4; };
  cli("Para:", orc.cliente || "CLIENTE S/ CADASTRO");
  cli("Endereço:", orc.endereco);
  if (orc.bairro) cli("Bairro:", orc.bairro);
  cli("Telefone:", orc.telefone);
  y += 2;
  const cX = { qtd: M, cod: M + 18, uni: M + 46, des: M + 68 };
  ctx.fillStyle = navy; ctx.fillRect(mm(M), mm(y - 4.6), mm(RIGHT - M), mm(7));
  T(cX.qtd + 1, y, "Qtde", 8.8, { bold: true, color: white });
  T(cX.cod, y, "Código", 8.8, { bold: true, color: white });
  T(cX.uni, y, "Unid.", 8.8, { bold: true, color: white });
  T(cX.des, y, "Descrição", 8.8, { bold: true, color: white });
  y += 5.5;
  const desWpx = mm(RIGHT - cX.des - 1);
  (orc.itens || []).forEach((it, idx) => {
    _cfont(ctx, 9, false, S);
    const linhas = _cwrap(ctx, String(it.descricao || ""), desWpx);
    const alt = Math.max(linhas.length * 4.3, 5.6);
    if (idx % 2 === 1) { ctx.fillStyle = lightRow; ctx.fillRect(mm(M), mm(y - 3.8), mm(RIGHT - M), mm(alt)); }
    T(cX.qtd + 1, y, String(it.qtd == null ? "" : it.qtd), 9);
    T(cX.cod, y, String(it.codigo || ""), 9);
    T(cX.uni, y, String(it.unidade || "UN"), 9);
    linhas.forEach((ln, k) => T(cX.des, y + k * 4.3, ln, 9));
    y += alt;
  });
  y += 1;
  ctx.strokeStyle = lineC; ctx.beginPath(); ctx.moveTo(mm(M), mm(y)); ctx.lineTo(mm(RIGHT), mm(y)); ctx.stroke();
  y += 7.5;
  T(RIGHT - 44, y, "Valor Total", 11.5, { bold: true, align: "right" });
  T(RIGHT, y, brl(itemsTotal(orc.itens)), 11.5, { bold: true, align: "right" });
  y += 11;
  T(M, y, `Vendedor: ${orc.vendedor || "-"}`, 9.2);
  if (orc.observacoes) { _cfont(ctx, 9, false, S); y += 6; _cwrap(ctx, `Obs.: ${orc.observacoes}`, mm(RIGHT - M)).forEach((ln, k) => T(M, y + k * 4.4, ln, 9)); }
  T(W / 2, 276, `ORÇAMENTO VÁLIDO POR ${orc.validadeDias || 7} DIAS!`, 9.5, { bold: true, align: "center", color: navy });
  T(W / 2, 282, "SUA SEGURANÇA EM PRIMEIRO LUGAR.", 9.5, { bold: true, align: "center", color: navy });
  ctx.textAlign = "left";
}

/* ============ status ============ */
const ORC_STATUS = {
  agendado: { label: "Visita agendada", cls: "blue" },
  a_enviar: { label: "Montar / enviar", cls: "amber" },
  enviado: { label: "Enviado", cls: "violet" },
  aprovado: { label: "Aprovado", cls: "green" },
  recusado: { label: "Recusado", cls: "gray" },
};
const OS_STATUS = {
  agendada: { label: "Agendada", cls: "blue" },
  concluida: { label: "Concluída", cls: "green" },
  cancelada: { label: "Cancelada", cls: "gray" },
};

/* ============ app ============ */
function App() {
  const [loading, setLoading] = useState(true);
  const [orcamentos, setOrcamentos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [view, setView] = useState("hoje");
  const [orcAberto, setOrcAberto] = useState(null); // objeto ou {novo:true}
  const [osAberta, setOsAberta] = useState(null);
  const [share, setShare] = useState(null); // {titulo, texto}
  const [toast, setToast] = useState("");
  const [vendedoras, setVendedoras] = useState([]);
  const [vendAtivaId, setVendAtivaIdState] = useState(lerAtiva);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [aviso, setAviso] = useState(""); // faixa fixa de problema de conexão/salvamento
  const carregouRef = useRef(false);

  const setVendAtivaId = (id) => { setVendAtivaIdState(id); gravarAtiva(id); };

  const recarregar = useCallback(async () => {
    try {
      const d = await carregarTudo();
      const vend = (d.config.vendedoras && d.config.vendedoras.lista) || [];
      setOrcamentos(d.orcamentos);
      setOrdens(d.ordens);
      setVendedoras(vend);
      gravarCache({ orcamentos: d.orcamentos, ordens: d.ordens, vendedoras: vend });
      setAviso((a) => (a.startsWith("Sem conexão") ? "" : a));
    } catch (e) {
      console.error(e);
      if (!carregouRef.current) {
        const c = lerCache();
        if (c) {
          setOrcamentos(c.orcamentos || []);
          setOrdens(c.ordens || []);
          setVendedoras(c.vendedoras || []);
        }
      }
      setAviso("Sem conexão com o banco de dados. Mostrando a última cópia salva neste aparelho.");
    } finally {
      carregouRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    return assinarMudancas(() => recarregar());
  }, [recarregar]);

  // Qualquer falha ao salvar vira um aviso fixo com botão "Tentar de novo".
  const falhaAoSalvar = (e) => {
    console.error(e);
    setAviso("ATENÇÃO: a última alteração NÃO foi salva no banco. Verifique a internet e toque em Tentar de novo.");
  };
  const tentarDeNovo = async () => {
    try {
      await salvarRegistros("orcamentos", orcamentos);
      await salvarRegistros("ordens", ordens);
      await salvarConfig("vendedoras", { lista: vendedoras });
      setAviso("");
      setToast("Tudo salvo no banco.");
      recarregar();
    } catch (e) { falhaAoSalvar(e); }
  };

  const updVendedoras = (next) => {
    setVendedoras(next);
    salvarConfig("vendedoras", { lista: next }).catch(falhaAoSalvar);
  };

  const exportarBackup = () => {
    const dados = { app: "vigiar-orcamentos", exportadoEm: new Date().toISOString(), orcamentos, ordens, vendedoras };
    baixarArquivo(`vigiar-orcamentos-backup-${todayStr()}.json`, JSON.stringify(dados, null, 2), "application/json");
  };
  const importarBackup = async (arquivo) => {
    try {
      const b = lerBackup(JSON.parse(await arquivo.text()));
      const idsOrc = new Set(orcamentos.map((x) => x.id));
      const idsOs = new Set(ordens.map((x) => x.id));
      const novosOrc = b.orcamentos.filter((x) => x && x.id && !idsOrc.has(x.id));
      const novasOs = b.ordens.filter((x) => x && x.id && !idsOs.has(x.id));
      const nomes = new Set(vendedoras.map((v) => v.nome));
      const novasVend = b.vendedoras.filter((v) => v && v.nome && !nomes.has(v.nome));
      await salvarRegistros("orcamentos", novosOrc);
      await salvarRegistros("ordens", novasOs);
      if (novasVend.length) await salvarConfig("vendedoras", { lista: [...vendedoras, ...novasVend] });
      await recarregar();
      setToast(`Importado: ${novosOrc.length} orçamento(s), ${novasOs.length} OS, ${novasVend.length} vendedora(s).`);
    } catch (e) {
      console.error(e);
      setToast("Não consegui importar: " + (e.message || "arquivo inválido"));
    }
  };

  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(tm);
  }, [toast]);

  const [previewOrc, setPreviewOrc] = useState(null);

  const updOrc = (next) => {
    const antes = orcamentos;
    setOrcamentos(next);
    sincronizarLista("orcamentos", antes, next).catch(falhaAoSalvar);
  };
  const updOs = (next) => {
    const antes = ordens;
    setOrdens(next);
    sincronizarLista("ordens", antes, next).catch(falhaAoSalvar);
  };

  const salvarOrc = (orc) => {
    const existe = orcamentos.some((x) => x.id === orc.id);
    const next = existe
      ? orcamentos.map((x) => (x.id === orc.id ? orc : x))
      : [...orcamentos, orc];
    updOrc(next);
    setOrcAberto(null);
  };
  const excluirOrc = (id) => { updOrc(orcamentos.filter((x) => x.id !== id)); setOrcAberto(null); };

  const salvarOs = (os) => {
    const existe = ordens.some((x) => x.id === os.id);
    const next = existe ? ordens.map((x) => (x.id === os.id ? os : x)) : [...ordens, os];
    updOs(next);
    setOsAberta(null);
  };
  const excluirOs = (id) => { updOs(ordens.filter((x) => x.id !== id)); setOsAberta(null); };

  const gerarOSdeOrcamento = (orc, dataServico) => {
    const os = {
      id: uid(),
      numero: nextNumero(ordens),
      orcamentoId: orc.id,
      orcamentoNum: orc.numero,
      cliente: orc.cliente,
      telefone: orc.telefone,
      endereco: orc.endereco,
      bairro: orc.bairro || "",
      descricao: orc.descricaoServico || "",
      itens: orc.itens || [],
      dataServico,
      horaServico: "",
      status: "agendada",
      observacoes: "",
      criadoEm: todayStr(),
    };
    updOs([...ordens, os]);
    setOrcAberto(null);
    setView("servicos");
  };

  const vendAtiva = vendedoras.find((v) => v.id === vendAtivaId) || null;
  const addVendedora = (nome) => {
    const nv = { id: uid(), nome: nome.trim() };
    updVendedoras([...vendedoras, nv]);
    if (!vendAtivaId) setVendAtivaId(nv.id);
  };
  const renameVendedora = (id, nome) => updVendedoras(vendedoras.map((v) => (v.id === id ? { ...v, nome } : v)));
  const removeVendedora = (id) => {
    updVendedoras(vendedoras.filter((v) => v.id !== id));
    if (vendAtivaId === id) setVendAtivaId("");
  };

  const t = todayStr();
  const atrasadosEnvio = orcamentos.filter((o) => o.status === "a_enviar" && o.prazoEnvio && o.prazoEnvio < t);
  const visitasAtrasadas = orcamentos.filter((o) => o.status === "agendado" && o.dataVisita && o.dataVisita < t);

  if (loading) {
    return (
      <div className="vg-root">
        <Estilos />
        <div className="vg-load"><ShieldCheck size={28} /><span>Carregando Vigiar…</span></div>
      </div>
    );
  }

  return (
    <div className="vg-root">
      <Estilos />
      <header className="vg-top">
        <div className="vg-brand">
          <span className="vg-logo"><ShieldCheck size={20} /></span>
          <div>
            <div className="vg-name">VIGIAR</div>
            <div className="vg-tag">Segurança eletrônica</div>
          </div>
        </div>
        <div className="vg-top-actions">
          <button className="vg-perfil" onClick={() => setPerfilAberto(true)}>
            <UserRound size={15} />
            <span>{vendAtiva ? primeiroNome(vendAtiva.nome) : "Perfil"}</span>
          </button>
          {(atrasadosEnvio.length + visitasAtrasadas.length) > 0 && (
            <button className="vg-bell" onClick={() => setView("hoje")}>
              <Bell size={18} />
              <span className="vg-bell-dot">{atrasadosEnvio.length + visitasAtrasadas.length}</span>
            </button>
          )}
        </div>
      </header>

      {aviso && (
        <div className="vg-aviso">
          <AlertTriangle size={16} />
          <span>{aviso}</span>
          <button onClick={aviso.startsWith("ATENÇÃO") ? tentarDeNovo : recarregar}>
            <RefreshCw size={14} /> Tentar de novo
          </button>
        </div>
      )}

      <main className="vg-main">
        {view === "hoje" && (
          <Hoje
            orcamentos={orcamentos}
            ordens={ordens}
            onAbrirOrc={setOrcAberto}
            onAbrirOs={setOsAberta}
            onShare={setShare}
          />
        )}
        {view === "orcamentos" && (
          <ListaOrcamentos orcamentos={orcamentos} onAbrir={setOrcAberto} />
        )}
        {view === "servicos" && (
          <ListaOrdens ordens={ordens} onAbrir={setOsAberta} onShare={setShare} />
        )}
      </main>

      <button
        className="vg-fab"
        onClick={() =>
          view === "servicos"
            ? setOsAberta({ novo: true })
            : setOrcAberto({ novo: true })
        }
        aria-label="Adicionar"
      >
        <Plus size={24} />
      </button>

      <nav className="vg-nav">
        <NavBtn ativo={view === "hoje"} onClick={() => setView("hoje")} icon={<Home size={20} />} label="Hoje" />
        <NavBtn ativo={view === "orcamentos"} onClick={() => setView("orcamentos")} icon={<FileText size={20} />} label="Orçamentos" />
        <NavBtn ativo={view === "servicos"} onClick={() => setView("servicos")} icon={<Wrench size={20} />} label="Serviços" />
      </nav>

      {orcAberto && (
        <SheetOrcamento
          inicial={orcAberto}
          orcamentos={orcamentos}
          vendedoras={vendedoras}
          vendedorPadrao={vendAtiva ? vendAtiva.nome : ""}
          onSalvar={salvarOrc}
          onExcluir={excluirOrc}
          onGerarOS={gerarOSdeOrcamento}
          onShare={setShare}
          onPreview={setPreviewOrc}
          onToast={setToast}
          onFechar={() => setOrcAberto(null)}
        />
      )}
      {osAberta && (
        <SheetOS
          inicial={osAberta}
          ordens={ordens}
          onSalvar={salvarOs}
          onExcluir={excluirOs}
          onShare={setShare}
          onFechar={() => setOsAberta(null)}
        />
      )}
      {share && <ModalShare titulo={share.titulo} texto={share.texto} onFechar={() => setShare(null)} />}
      {previewOrc && <PreviewOrcamento orc={previewOrc} onFechar={() => setPreviewOrc(null)} />}
      {perfilAberto && (
        <SheetVendedoras
          vendedoras={vendedoras}
          ativaId={vendAtivaId}
          onAdd={addVendedora}
          onRename={renameVendedora}
          onRemove={removeVendedora}
          onSetAtiva={setVendAtivaId}
          onExportar={exportarBackup}
          onImportar={importarBackup}
          onSair={() => supabase.auth.signOut()}
          onFechar={() => setPerfilAberto(false)}
        />
      )}
      {toast && <div className="vg-toast">{toast}</div>}
    </div>
  );
}

/* ============ HOJE / painel ============ */
function Hoje({ orcamentos, ordens, onAbrirOrc, onAbrirOs, onShare }) {
  const t = todayStr();
  const atrasadosEnvio = orcamentos.filter((o) => o.status === "a_enviar" && o.prazoEnvio && o.prazoEnvio < t);
  const visitasAtrasadas = orcamentos.filter((o) => o.status === "agendado" && o.dataVisita && o.dataVisita < t);
  const visitasHoje = orcamentos.filter((o) => o.status === "agendado" && o.dataVisita === t)
    .sort((a, b) => (a.horaVisita || "99").localeCompare(b.horaVisita || "99"));
  const aEnviar = orcamentos.filter((o) => o.status === "a_enviar");
  const osHoje = ordens.filter((o) => o.dataServico === t && o.status === "agendada")
    .sort((a, b) => (a.horaServico || "99").localeCompare(b.horaServico || "99"));

  const abertos = orcamentos.filter((o) => ["agendado", "a_enviar", "enviado"].includes(o.status)).length;
  const osPendentes = ordens.filter((o) => o.status === "agendada").length;

  const compartilharDia = () => {
    if (!osHoje.length) return;
    let txt = `*VIGIAR — Ordens de serviço de ${fmtDate(t)}*\n\n`;
    osHoje.forEach((o, i) => {
      txt += `${i + 1}) ${o.horaServico ? o.horaServico + " — " : ""}OS Nº ${o.numero} — ${o.cliente}\n`;
      const end = [o.endereco, o.bairro].filter(Boolean).join(" - ");
      if (end) txt += `   📍 ${end}\n   🗺️ ${mapsUrl(o.endereco, o.bairro)}\n`;
      if (o.telefone) txt += `   📞 ${o.telefone}\n`;
      if (o.descricao) txt += `   🔧 ${o.descricao}\n`;
      txt += "\n";
    });
    onShare({ titulo: `OS do dia (${osHoje.length})`, texto: txt.trim() });
  };

  return (
    <div className="vg-page vg-hoje">
      <div className="vg-hoje-head">
        <span className="vg-eyebrow">Painel</span>
        <h1 className="vg-h1">Hoje, {fmtDate(t)}</h1>
      </div>

      <div className="vg-stats">
        <div className="vg-stat"><b>{abertos}</b><span>orçamentos abertos</span></div>
        <div className="vg-stat"><b>{aEnviar.length}</b><span>p/ enviar</span></div>
        <div className="vg-stat"><b>{osPendentes}</b><span>serviços pendentes</span></div>
      </div>

      {atrasadosEnvio.length > 0 && (
        <Secao titulo="Orçamentos atrasados para enviar" perigo icon={<AlertTriangle size={16} />}>
          {atrasadosEnvio.map((o) => (
            <ItemAlerta key={o.id} alerta onClick={() => onAbrirOrc(o)}
              titulo={`Nº ${o.numero} · ${o.cliente}`}
              sub={`Prazo era ${fmtDate(o.prazoEnvio)}`} />
          ))}
        </Secao>
      )}

      {visitasAtrasadas.length > 0 && (
        <Secao titulo="Visitas de orçamento atrasadas" aviso icon={<Clock size={16} />}>
          {visitasAtrasadas.map((o) => (
            <ItemAlerta key={o.id} aviso onClick={() => onAbrirOrc(o)}
              titulo={`Nº ${o.numero} · ${o.cliente}`}
              sub={`Era ${fmtDate(o.dataVisita)}`} />
          ))}
        </Secao>
      )}

      <Secao titulo="Visitas de hoje" icon={<CalendarClock size={16} />}>
        {visitasHoje.length === 0 ? (
          <Vazio texto="Nenhuma visita de orçamento marcada para hoje." />
        ) : (
          visitasHoje.map((o) => (
            <ItemAlerta key={o.id} onClick={() => onAbrirOrc(o)} mapa={mapsUrl(o.endereco, o.bairro)}
              titulo={`${o.horaVisita ? o.horaVisita + "  ·  " : ""}Nº ${o.numero} · ${o.cliente}`}
              sub={[o.endereco, o.bairro].filter(Boolean).join(" - ") || o.descricaoServico || "Toque para abrir"} />
          ))
        )}
      </Secao>

      <Secao
        titulo="Ordens de serviço de hoje"
        icon={<Wrench size={16} />}
        acao={osHoje.length > 0 ? (
          <button className="vg-link" onClick={compartilharDia}><Share2 size={14} /> Gerar do dia</button>
        ) : null}
      >
        {osHoje.length === 0 ? (
          <Vazio texto="Nenhum serviço agendado para hoje." />
        ) : (
          osHoje.map((o) => (
            <ItemAlerta key={o.id} onClick={() => onAbrirOs(o)} mapa={mapsUrl(o.endereco, o.bairro)}
              titulo={`${o.horaServico ? o.horaServico + "  ·  " : ""}OS Nº ${o.numero} · ${o.cliente}`}
              sub={[o.endereco, o.bairro].filter(Boolean).join(" - ") || o.descricao || "Toque para abrir"} />
          ))
        )}
      </Secao>
    </div>
  );
}

/* ============ lista de orçamentos ============ */
function ListaOrcamentos({ orcamentos, onAbrir }) {
  const [filtro, setFiltro] = useState("todos");
  const [verDesemp, setVerDesemp] = useState(false);
  const t = todayStr();
  const filtros = [
    ["todos", "Todos"],
    ["agendado", "Agendados"],
    ["a_enviar", "P/ enviar"],
    ["enviado", "Enviados"],
    ["aprovado", "Aprovados"],
  ];
  const lista = useMemo(() => {
    const arr = filtro === "todos" ? orcamentos : orcamentos.filter((o) => o.status === filtro);
    return [...arr].sort((a, b) => (b.dataVisita || "").localeCompare(a.dataVisita || ""));
  }, [orcamentos, filtro]);

  const desempenho = useMemo(() => {
    const m = {};
    orcamentos.forEach((o) => {
      const nome = (o.vendedor || "").trim() || "Sem vendedor";
      if (!m[nome]) m[nome] = { nome, total: 0, aprovados: 0, vendido: 0 };
      m[nome].total += 1;
      if (o.status === "aprovado") { m[nome].aprovados += 1; m[nome].vendido += itemsTotal(o.itens); }
    });
    return Object.values(m).sort((a, b) => b.vendido - a.vendido || b.total - a.total);
  }, [orcamentos]);

  return (
    <div className="vg-page">
      <span className="vg-eyebrow">Orçamentos</span>
      <h1 className="vg-h1">Seus orçamentos</h1>

      {desempenho.length > 0 && (
        <div className="vg-desemp">
          <button className="vg-desemp-toggle" onClick={() => setVerDesemp((v) => !v)}>
            <span><Users size={15} /> Desempenho por vendedora</span>
            <ChevronLeft size={16} className={"vg-desemp-chev" + (verDesemp ? " open" : "")} />
          </button>
          {verDesemp && (
            <div className="vg-desemp-list">
              {desempenho.map((d) => (
                <div key={d.nome} className="vg-desemp-row">
                  <span className="vg-desemp-nome"><span className="vg-vend-av sm">{d.nome.charAt(0).toUpperCase()}</span>{d.nome}</span>
                  <div className="vg-desemp-nums">
                    <span><b>{d.total}</b> orç.</span>
                    <span><b>{d.aprovados}</b> aprov.</span>
                    <span className="vg-desemp-val">{brl(d.vendido)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="vg-chips">
        {filtros.map(([k, l]) => (
          <button key={k} className={`vg-chip ${filtro === k ? "on" : ""}`} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      {lista.length === 0 ? (
        <Vazio texto="Nenhum orçamento aqui ainda. Toque no + para agendar o primeiro." />
      ) : (
        <div className="vg-list">
          {lista.map((o) => {
            const atrasado = (o.status === "a_enviar" && o.prazoEnvio && o.prazoEnvio < t) ||
              (o.status === "agendado" && o.dataVisita && o.dataVisita < t);
            return (
              <button key={o.id} className="vg-card" onClick={() => onAbrir(o)}>
                <div className="vg-card-top">
                  <span className="vg-num">Nº {o.numero}</span>
                  <Badge st={ORC_STATUS[o.status]} />
                </div>
                <div className="vg-card-cli">{o.cliente || "Sem nome"}</div>
                <div className="vg-card-meta">
                  <span><CalendarClock size={13} /> {fmtDate(o.dataVisita)}</span>
                  {itemsTotal(o.itens) > 0 && <span className="vg-card-val">{brl(itemsTotal(o.itens))}</span>}
                </div>
                <div className="vg-card-foot">
                  {o.vendedor && <span className="vg-card-vend"><UserRound size={12} /> {o.vendedor}</span>}
                  {atrasado && <span className="vg-card-warn"><AlertTriangle size={12} /> Atrasado</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ lista de ordens ============ */
function ListaOrdens({ ordens, onAbrir, onShare }) {
  const [filtro, setFiltro] = useState("agendada");
  const filtros = [["agendada", "Agendadas"], ["concluida", "Concluídas"], ["todos", "Todas"]];
  const lista = useMemo(() => {
    const arr = filtro === "todos" ? ordens : ordens.filter((o) => o.status === filtro);
    return [...arr].sort((a, b) => (a.dataServico || "").localeCompare(b.dataServico || ""));
  }, [ordens, filtro]);

  return (
    <div className="vg-page">
      <span className="vg-eyebrow">Ordens de serviço</span>
      <h1 className="vg-h1">Seus serviços</h1>
      <div className="vg-chips">
        {filtros.map(([k, l]) => (
          <button key={k} className={`vg-chip ${filtro === k ? "on" : ""}`} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      {lista.length === 0 ? (
        <Vazio texto="Nenhuma ordem de serviço aqui. Aprove um orçamento para gerar uma, ou toque no +." />
      ) : (
        <div className="vg-list">
          {lista.map((o) => (
            <button key={o.id} className="vg-card" onClick={() => onAbrir(o)}>
              <div className="vg-card-top">
                <span className="vg-num">OS Nº {o.numero}</span>
                <Badge st={OS_STATUS[o.status]} />
              </div>
              <div className="vg-card-cli">{o.cliente || "Sem nome"}</div>
              <div className="vg-card-meta">
                <span><CalendarClock size={13} /> {fmtDate(o.dataServico)}</span>
                {itemsTotal(o.itens) > 0 && <span className="vg-card-val">{brl(itemsTotal(o.itens))}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ sheet de orçamento ============ */
function SheetOrcamento({ inicial, orcamentos, vendedoras = [], vendedorPadrao = "", onSalvar, onExcluir, onGerarOS, onShare, onPreview, onToast, onFechar }) {
  const novo = inicial.novo;
  const [o, setO] = useState(() =>
    novo
      ? {
          id: uid(), numero: nextNumero(orcamentos), cliente: "", telefone: "",
          endereco: "", bairro: "", descricaoServico: "", dataVisita: todayStr(), horaVisita: "",
          status: "agendado", prazoEnvio: "", itens: [], observacoes: "",
          vendedor: vendedorPadrao || "", validadeDias: 7, dataEnvio: "", criadoEm: todayStr(),
        }
      : { ...inicial, itens: inicial.itens ? [...inicial.itens] : [] }
  );
  const [prazo, setPrazo] = useState(addDaysStr(todayStr(), 2));
  const [dataServico, setDataServico] = useState(addDaysStr(todayStr(), 2));
  const [erroEnd, setErroEnd] = useState(false);
  const set = (k, v) => setO((p) => ({ ...p, [k]: v }));

  const setItem = (i, k, v) =>
    setO((p) => ({ ...p, itens: p.itens.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addItem = () => setO((p) => ({ ...p, itens: [...p.itens, { descricao: "", qtd: 1, unidade: "UN", codigo: "", valor: "" }] }));
  const delItem = (i) => setO((p) => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }));

  const total = itemsTotal(o.itens);

  const marcarVisitaFeita = () => onSalvar({ ...o, status: "a_enviar", prazoEnvio: prazo });
  const marcarEnviado = () => onSalvar({ ...o, status: "enviado", dataEnvio: todayStr() });
  const aprovar = () => onSalvar({ ...o, status: "aprovado" });
  const recusar = () => onSalvar({ ...o, status: "recusado" });

  const compartilhar = () => {
    let txt = `*VIGIAR — Segurança eletrônica*\n*Orçamento Nº ${o.numero}*\n\n`;
    if (o.cliente) txt += `Cliente: ${o.cliente}\n`;
    if (o.endereco) txt += `Endereço: ${o.endereco}\n`;
    if (o.descricaoServico) txt += `Serviço: ${o.descricaoServico}\n`;
    txt += `\n`;
    (o.itens || []).forEach((it) => {
      txt += `• ${it.qtd}x ${it.descricao || "item"} — ${brl((Number(it.qtd) || 0) * (Number(it.valor) || 0))}\n`;
    });
    txt += `\n*Total: ${brl(total)}*`;
    if (o.observacoes) txt += `\n\nObs.: ${o.observacoes}`;
    onShare({ titulo: `Orçamento Nº ${o.numero}`, texto: txt });
  };

  const tentarSalvar = () => {
    if (!o.endereco || !o.endereco.trim()) { setErroEnd(true); onToast && onToast("O endereço é obrigatório."); return; }
    onSalvar(o);
  };
  const abrirPreview = () => {
    if (!o.endereco || !o.endereco.trim()) { setErroEnd(true); onToast && onToast("Preencha o endereço para gerar o orçamento."); return; }
    onPreview && onPreview(o);
  };

  return (
    <Sheet onFechar={onFechar} titulo={novo ? "Novo orçamento" : `Orçamento Nº ${o.numero}`}>
      {!novo && (
        <div className="vg-sheet-status"><Badge st={ORC_STATUS[o.status]} big /></div>
      )}

      <Campo label="Cliente">
        <input className="vg-in" value={o.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nome do cliente" />
      </Campo>
      <div className="vg-row2">
        <Campo label="Telefone" icon={<Phone size={14} />}>
          <input className="vg-in" value={o.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
        </Campo>
        <Campo label="Data da visita" icon={<CalendarClock size={14} />}>
          <input type="date" className="vg-in" value={o.dataVisita} onChange={(e) => set("dataVisita", e.target.value)} />
        </Campo>
      </div>
      <Campo label="Horário da visita" icon={<Clock size={14} />}>
        <input type="time" className="vg-in" value={o.horaVisita || ""} onChange={(e) => set("horaVisita", e.target.value)} />
      </Campo>
      <Campo label="Endereço — rua e nº *" icon={<MapPin size={14} />}>
        <input
          className={"vg-in" + (erroEnd ? " vg-in-erro" : "")}
          value={o.endereco}
          onChange={(e) => { set("endereco", e.target.value); if (erroEnd) setErroEnd(false); }}
          placeholder="Ex.: Rua das Flores, 100 (obrigatório)"
        />
        {erroEnd && <span className="vg-erro">O endereço é obrigatório.</span>}
      </Campo>
      <Campo label="Bairro">
        <input className="vg-in" value={o.bairro || ""} onChange={(e) => set("bairro", e.target.value)} placeholder="Ex.: Santa Amélia" />
      </Campo>
      <BotaoMapa url={mapsUrl(o.endereco, o.bairro)} />
      <Campo label="O que o cliente quer">
        <input className="vg-in" value={o.descricaoServico} onChange={(e) => set("descricaoServico", e.target.value)} placeholder="Ex.: 4 câmeras + alarme + portão" />
      </Campo>
      <div className="vg-row2">
        <Campo label="Vendedor">
          {vendedoras.length ? (
            <select className="vg-in" value={o.vendedor || ""} onChange={(e) => set("vendedor", e.target.value)}>
              <option value="">Selecione…</option>
              {vendedoras.map((v) => <option key={v.id} value={v.nome}>{v.nome}</option>)}
              {o.vendedor && !vendedoras.some((v) => v.nome === o.vendedor) && <option value={o.vendedor}>{o.vendedor}</option>}
            </select>
          ) : (
            <input className="vg-in" value={o.vendedor || ""} onChange={(e) => set("vendedor", e.target.value)} placeholder="Cadastre em Perfil" />
          )}
        </Campo>
        <Campo label="Validade (dias)">
          <input type="number" min="1" className="vg-in" value={o.validadeDias ?? 7} onChange={(e) => set("validadeDias", e.target.value)} />
        </Campo>
      </div>

      {/* itens */}
      <div className="vg-itens-head">
        <span>Itens do orçamento</span>
        <button className="vg-link" onClick={addItem}><Plus size={14} /> Adicionar</button>
      </div>
      {o.itens.length === 0 && <div className="vg-itens-vazio">Adicione os equipamentos e serviços com seus valores.</div>}
      {o.itens.map((it, i) => (
        <div key={i} className="vg-item">
          <input className="vg-in vg-item-desc" value={it.descricao} onChange={(e) => setItem(i, "descricao", e.target.value)} placeholder="Descrição" />
          <div className="vg-item-row">
            <div className="vg-item-qtd">
              <span>Qtd</span>
              <input type="number" min="1" className="vg-in" value={it.qtd} onChange={(e) => setItem(i, "qtd", e.target.value)} />
            </div>
            <div className="vg-item-qtd">
              <span>Unid.</span>
              <input className="vg-in" value={it.unidade ?? "UN"} onChange={(e) => setItem(i, "unidade", e.target.value)} placeholder="UN" />
            </div>
            <div className="vg-item-val">
              <span>Código</span>
              <input className="vg-in" value={it.codigo || ""} onChange={(e) => setItem(i, "codigo", e.target.value)} placeholder="opcional" />
            </div>
          </div>
          <div className="vg-item-row">
            <div className="vg-item-val">
              <span>Valor unit.</span>
              <input type="number" min="0" step="0.01" className="vg-in" value={it.valor} onChange={(e) => setItem(i, "valor", e.target.value)} placeholder="0,00" />
            </div>
            <button className="vg-del" onClick={() => delItem(i)} aria-label="Remover"><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
      {o.itens.length > 0 && (
        <div className="vg-total"><span>Total</span><b>{brl(total)}</b></div>
      )}

      <Campo label="Observações">
        <textarea className="vg-in vg-ta" rows={2} value={o.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Condições, prazo de execução, garantia…" />
      </Campo>

      {/* ações por status */}
      {!novo && (
        <div className="vg-acoes">
          {o.status === "agendado" && (
            <div className="vg-acao-box">
              <label className="vg-acao-label">Marcar visita como feita e definir prazo para enviar o orçamento:</label>
              <div className="vg-acao-row">
                <input type="date" className="vg-in" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                <button className="vg-btn vg-btn-amber" onClick={marcarVisitaFeita}><Check size={16} /> Visita feita</button>
              </div>
            </div>
          )}
          {o.status === "a_enviar" && (
            <button className="vg-btn vg-btn-violet" onClick={marcarEnviado}><Send size={16} /> Marcar como enviado</button>
          )}
          {o.status === "enviado" && (
            <div className="vg-acao-row">
              <button className="vg-btn vg-btn-green" onClick={aprovar}><ThumbsUp size={16} /> Aprovado</button>
              <button className="vg-btn vg-btn-ghost" onClick={recusar}><ThumbsDown size={16} /> Recusado</button>
            </div>
          )}
          {o.status === "aprovado" && (
            <div className="vg-acao-box">
              <label className="vg-acao-label">Gerar a ordem de serviço e agendar a execução:</label>
              <div className="vg-acao-row">
                <input type="date" className="vg-in" value={dataServico} onChange={(e) => setDataServico(e.target.value)} />
                <button className="vg-btn vg-btn-green" onClick={() => onGerarOS(o, dataServico)}><Wrench size={16} /> Gerar OS</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* rodapé */}
      <div className="vg-sheet-foot">
        <button className="vg-btn vg-btn-primary" onClick={tentarSalvar}><Check size={16} /> Salvar</button>
        <button className="vg-btn vg-btn-ghost" onClick={abrirPreview}><Download size={16} /> Ver PDF</button>
      </div>
      {!novo && (
        <div className="vg-sheet-foot vg-foot2">
          <button className="vg-btn vg-btn-green" onClick={abrirPreview}><Send size={16} /> Enviar PDF no WhatsApp</button>
          <button className="vg-iconbtn" onClick={() => onExcluir(o.id)} aria-label="Excluir"><Trash2 size={18} /></button>
        </div>
      )}
    </Sheet>
  );
}

/* ============ sheet de OS ============ */
function SheetOS({ inicial, ordens, onSalvar, onExcluir, onShare, onFechar }) {
  const novo = inicial.novo;
  const [o, setO] = useState(() =>
    novo
      ? {
          id: uid(), numero: nextNumero(ordens), cliente: "", telefone: "",
          endereco: "", bairro: "", descricao: "", itens: [], dataServico: todayStr(), horaServico: "",
          status: "agendada", observacoes: "", criadoEm: todayStr(),
        }
      : { ...inicial, itens: inicial.itens ? [...inicial.itens] : [] }
  );
  const set = (k, v) => setO((p) => ({ ...p, [k]: v }));

  const compartilhar = () => {
    let txt = `*VIGIAR — Ordem de Serviço Nº ${o.numero}*\n\n`;
    if (o.cliente) txt += `Cliente: ${o.cliente}\n`;
    if (o.telefone) txt += `Telefone: ${o.telefone}\n`;
    if (o.endereco) txt += `Endereço: ${[o.endereco, o.bairro].filter(Boolean).join(" - ")}\n🗺️ ${mapsUrl(o.endereco, o.bairro)}\n`;
    txt += `Data: ${fmtDate(o.dataServico)}\n`;
    if (o.descricao) txt += `\nServiço: ${o.descricao}\n`;
    if ((o.itens || []).length) {
      txt += `\nItens:\n`;
      o.itens.forEach((it) => { txt += `• ${it.qtd}x ${it.descricao || "item"}\n`; });
    }
    if (o.observacoes) txt += `\nObs.: ${o.observacoes}`;
    onShare({ titulo: `OS Nº ${o.numero}`, texto: txt.trim() });
  };

  return (
    <Sheet onFechar={onFechar} titulo={novo ? "Nova ordem de serviço" : `OS Nº ${o.numero}`}>
      {!novo && <div className="vg-sheet-status"><Badge st={OS_STATUS[o.status]} big /></div>}
      {o.orcamentoNum && <div className="vg-from">Gerada do orçamento Nº {o.orcamentoNum}</div>}

      <Campo label="Cliente">
        <input className="vg-in" value={o.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nome do cliente" />
      </Campo>
      <div className="vg-row2">
        <Campo label="Telefone" icon={<Phone size={14} />}>
          <input className="vg-in" value={o.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
        </Campo>
        <Campo label="Data do serviço" icon={<CalendarClock size={14} />}>
          <input type="date" className="vg-in" value={o.dataServico} onChange={(e) => set("dataServico", e.target.value)} />
        </Campo>
      </div>
      <Campo label="Horário do serviço" icon={<Clock size={14} />}>
        <input type="time" className="vg-in" value={o.horaServico || ""} onChange={(e) => set("horaServico", e.target.value)} />
      </Campo>
      <Campo label="Endereço — rua e nº" icon={<MapPin size={14} />}>
        <input className="vg-in" value={o.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Ex.: Rua das Flores, 100" />
      </Campo>
      <Campo label="Bairro">
        <input className="vg-in" value={o.bairro || ""} onChange={(e) => set("bairro", e.target.value)} placeholder="Ex.: Santa Amélia" />
      </Campo>
      <BotaoMapa url={mapsUrl(o.endereco, o.bairro)} />
      <Campo label="Serviço a executar">
        <textarea className="vg-in vg-ta" rows={2} value={o.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex.: Instalar 4 câmeras, configurar DVR e app no celular" />
      </Campo>
      <Campo label="Observações">
        <textarea className="vg-in vg-ta" rows={2} value={o.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Material, acesso ao local, contato no dia…" />
      </Campo>

      {!novo && o.status === "agendada" && (
        <button className="vg-btn vg-btn-green vg-full" onClick={() => onSalvar({ ...o, status: "concluida" })}>
          <CircleCheck size={16} /> Marcar como concluída
        </button>
      )}
      {!novo && o.status === "concluida" && (
        <button className="vg-btn vg-btn-ghost vg-full" onClick={() => onSalvar({ ...o, status: "agendada" })}>
          Reabrir serviço
        </button>
      )}

      <div className="vg-sheet-foot">
        <button className="vg-btn vg-btn-primary" onClick={() => onSalvar(o)}><Check size={16} /> Salvar</button>
        {!novo && (
          <>
            <button className="vg-btn vg-btn-ghost" onClick={compartilhar}><Share2 size={16} /> Enviar</button>
            <button className="vg-iconbtn" onClick={() => onExcluir(o.id)} aria-label="Excluir"><Trash2 size={18} /></button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ============ modal compartilhar ============ */
function ModalShare({ titulo, texto, onFechar }) {
  const [copiado, setCopiado] = useState(false);
  const fazerCopia = async () => {
    const ok = await copiar(texto);
    setCopiado(ok);
    if (ok) setTimeout(() => setCopiado(false), 1800);
  };
  const whatsapp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };
  return (
    <div className="vg-overlay" onClick={onFechar}>
      <div className="vg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vg-modal-head">
          <strong>{titulo}</strong>
          <button className="vg-x" onClick={onFechar}><X size={18} /></button>
        </div>
        <textarea className="vg-share-ta" readOnly value={texto} />
        <div className="vg-modal-foot">
          <button className="vg-btn vg-btn-green" onClick={whatsapp}><Send size={16} /> WhatsApp</button>
          <button className="vg-btn vg-btn-ghost" onClick={fazerCopia}>
            {copiado ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ modal de preview / envio do orçamento ============ */
function PreviewOrcamento({ orc, onFechar }) {
  const [imgUrl, setImgUrl] = useState("");
  const [pngBlob, setPngBlob] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const S = 6.5;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(210 * S);
    canvas.height = Math.round(297 * S);
    const ctx = canvas.getContext("2d");
    try {
      desenharOrcamento(ctx, orc, S);
      setImgUrl(canvas.toDataURL("image/png"));
      canvas.toBlob((b) => setPngBlob(b), "image/png");
    } catch (e) { console.error(e); setMsg("Não consegui gerar a imagem do orçamento."); }
  }, [orc]);

  const baixarPDF = () => {
    try {
      const blob = gerarOrcamentoBlob(orc);
      if (!blob) { setMsg("Não consegui gerar o PDF."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Orcamento_${orc.numero}.pdf`; a.rel = "noopener";
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
      setMsg("Se o download não começar, segure a imagem acima e toque em Compartilhar.");
    } catch (e) { setMsg("Não consegui baixar o PDF. Segure a imagem acima e toque em Compartilhar."); }
  };

  const compartilhar = async () => {
    const titulo = `Orçamento nº ${orc.numero} — VIGIAR`;
    try {
      const blob = gerarOrcamentoBlob(orc);
      const f = new File([blob], `Orcamento_${orc.numero}.pdf`, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: titulo });
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try {
      if (pngBlob) {
        const f2 = new File([pngBlob], `Orcamento_${orc.numero}.png`, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [f2] })) {
          await navigator.share({ files: [f2], title: titulo });
          return;
        }
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
    setMsg("Para enviar: segure a imagem acima, toque em Compartilhar e escolha o WhatsApp.");
  };

  return (
    <div className="vg-overlay" onClick={onFechar}>
      <div className="vg-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="vg-sheet-head">
          <button className="vg-x" onClick={onFechar}><ChevronLeft size={20} /></button>
          <strong>Orçamento Nº {orc.numero}</strong>
          <span style={{ width: 32 }} />
        </div>
        <div className="vg-sheet-body">
          <p className="vg-prev-dica"><b>Para enviar no WhatsApp:</b> segure a imagem abaixo e toque em <b>Compartilhar</b> → escolha o WhatsApp. Ou use os botões no rodapé.</p>
          {imgUrl
            ? <img src={imgUrl} alt={`Orçamento ${orc.numero}`} className="vg-prev-img" />
            : <div className="vg-prev-load">Gerando orçamento…</div>}
          {msg && <p className="vg-prev-msg">{msg}</p>}
          <div className="vg-sheet-foot">
            <button className="vg-btn vg-btn-green" onClick={compartilhar}><Send size={16} /> Compartilhar</button>
            <button className="vg-btn vg-btn-ghost" onClick={baixarPDF}><Download size={16} /> Baixar PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ gerenciamento de vendedoras (perfis) ============ */
function SheetVendedoras({ vendedoras, ativaId, onAdd, onRename, onRemove, onSetAtiva, onExportar, onImportar, onSair, onFechar }) {
  const [novo, setNovo] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");

  const adicionar = () => { const n = novo.trim(); if (!n) return; onAdd(n); setNovo(""); };
  const salvarEdicao = () => { if (editNome.trim()) onRename(editId, editNome.trim()); setEditId(null); setEditNome(""); };

  return (
    <Sheet onFechar={onFechar} titulo="Vendedoras">
      <p className="vg-prev-dica">A <b>vendedora ativa</b> entra automaticamente como vendedor nos novos orçamentos. Toque numa vendedora para deixá-la ativa.</p>

      <div className="vg-vend-add">
        <input className="vg-in" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome da vendedora"
          onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} />
        <button className="vg-btn vg-btn-primary vg-vend-addbtn" onClick={adicionar}><Plus size={16} /> Add</button>
      </div>

      {vendedoras.length === 0 ? (
        <Vazio texto="Nenhuma vendedora cadastrada ainda. Adicione acima — você pode cadastrar as 3." />
      ) : (
        <div className="vg-vend-list">
          {vendedoras.map((v) => (
            <div key={v.id} className={"vg-vend-row" + (v.id === ativaId ? " on" : "")}>
              {editId === v.id ? (
                <>
                  <input className="vg-in" value={editNome} onChange={(e) => setEditNome(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") salvarEdicao(); }} />
                  <button className="vg-iconbtn vg-iconbtn-ok" onClick={salvarEdicao} aria-label="Salvar"><Check size={18} /></button>
                </>
              ) : (
                <>
                  <button className="vg-vend-nome" onClick={() => onSetAtiva(v.id)}>
                    <span className="vg-vend-av">{primeiroNome(v.nome).charAt(0).toUpperCase()}</span>
                    <span className="vg-vend-txt">{v.nome}</span>
                    {v.id === ativaId && <span className="vg-vend-tag"><Star size={11} /> Ativa</span>}
                  </button>
                  <button className="vg-iconbtn" onClick={() => { setEditId(v.id); setEditNome(v.nome); }} aria-label="Editar"><Pencil size={16} /></button>
                  <button className="vg-iconbtn" onClick={() => onRemove(v.id)} aria-label="Excluir"><Trash2 size={16} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {onExportar && (
        <div className="vg-backup">
          <div className="vg-itens-head"><span>Backup dos dados</span></div>
          <p className="vg-prev-dica">Os dados ficam salvos na nuvem. Mesmo assim, baixe um backup de vez em quando e guarde num lugar seguro (Google Drive, e-mail).</p>
          <div className="vg-acao-row">
            <button className="vg-btn vg-btn-ghost" onClick={onExportar}><Download size={16} /> Baixar backup</button>
            <label className="vg-btn vg-btn-ghost vg-file">
              <Upload size={16} /> Importar backup
              <input type="file" accept=".json,application/json" hidden
                onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onImportar(f); e.target.value = ""; }} />
            </label>
          </div>
          <p className="vg-backup-nota">Importar só <b>adiciona</b> o que ainda não existe. Nada que já está salvo é apagado ou substituído.</p>
          <button className="vg-btn vg-btn-ghost vg-full vg-sair" onClick={onSair}><LogOut size={16} /> Sair</button>
        </div>
      )}
    </Sheet>
  );
}

/* ============ peças reutilizáveis ============ */
function NavBtn({ ativo, onClick, icon, label }) {
  return (
    <button className={`vg-navbtn ${ativo ? "on" : ""}`} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  );
}
function Badge({ st, big }) {
  if (!st) return null;
  return <span className={`vg-badge ${st.cls} ${big ? "big" : ""}`}>{st.label}</span>;
}
function Secao({ titulo, icon, children, acao, perigo, aviso }) {
  return (
    <section className={`vg-secao ${perigo ? "perigo" : ""} ${aviso ? "aviso" : ""}`}>
      <div className="vg-secao-head">
        <span className="vg-secao-tit">{icon}{titulo}</span>
        {acao}
      </div>
      <div className="vg-secao-body">{children}</div>
    </section>
  );
}
function ItemAlerta({ titulo, sub, onClick, alerta, aviso, mapa }) {
  return (
    <div className="vg-alerta-wrap">
      <button className={`vg-alerta ${alerta ? "a-perigo" : ""} ${aviso ? "a-aviso" : ""}`} onClick={onClick}>
        <div className="vg-alerta-txt">
          <strong>{titulo}</strong>
          <span>{sub}</span>
        </div>
        <ChevronLeft size={18} className="vg-chev" />
      </button>
      {mapa && (
        <a className="vg-mapa-ico" href={mapa} target="_blank" rel="noopener noreferrer" aria-label="Abrir no Google Maps">
          <MapPin size={18} />
        </a>
      )}
    </div>
  );
}
function BotaoMapa({ url }) {
  if (!url) return null;
  return (
    <a className="vg-mapa-btn" href={url} target="_blank" rel="noopener noreferrer">
      <MapPin size={16} /> Abrir no Google Maps
    </a>
  );
}
function Vazio({ texto }) { return <div className="vg-vazio">{texto}</div>; }
function Campo({ label, icon, children }) {
  return (
    <label className="vg-campo">
      <span className="vg-campo-l">{icon}{label}</span>
      {children}
    </label>
  );
}
function Sheet({ titulo, children, onFechar }) {
  return (
    <div className="vg-overlay" onClick={onFechar}>
      <div className="vg-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="vg-sheet-head">
          <button className="vg-x" onClick={onFechar}><ChevronLeft size={20} /></button>
          <strong>{titulo}</strong>
          <span style={{ width: 32 }} />
        </div>
        <div className="vg-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ============ estilos ============ */
function Estilos() {
  return (
    <style>{`
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.vg-root{
  --ink:#0c1c2e;--bg:#eef2f7;--surface:#fff;--line:#e2e8f0;--muted:#64748b;
  --brand:#0e63d6;--brand-d:#0b4fab;--alert:#dc2626;--alert-bg:#fef2f2;
  --warn:#c2710a;--warn-bg:#fff7ed;--ok:#16924f;--violet:#6d4bd1;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--ink);min-height:100vh;
  max-width:560px;margin:0 auto;position:relative;
}
.vg-load{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:60vh;color:var(--brand)}
.vg-load span{color:var(--muted);font-size:14px}

/* topo */
.vg-top{position:sticky;top:0;z-index:20;background:var(--ink);color:#fff;
  display:flex;align-items:center;justify-content:space-between;padding:14px 18px;
  background-image:radial-gradient(120% 140% at 100% 0%,rgba(14,99,214,.45),transparent 60%);}
.vg-brand{display:flex;align-items:center;gap:11px}
.vg-logo{width:38px;height:38px;border-radius:11px;background:var(--brand);
  display:grid;place-items:center;color:#fff;box-shadow:0 4px 14px rgba(14,99,214,.45)}
.vg-name{font-weight:800;letter-spacing:3px;font-size:16px}
.vg-tag{font-size:11px;color:#9fb6d4;letter-spacing:.5px;margin-top:1px}
.vg-bell{position:relative;background:rgba(255,255,255,.12);border:none;color:#fff;
  width:38px;height:38px;border-radius:11px;display:grid;place-items:center}
.vg-bell-dot{position:absolute;top:-4px;right:-4px;background:var(--alert);color:#fff;
  font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;
  display:grid;place-items:center;padding:0 4px;border:2px solid var(--ink)}

.vg-main{padding-bottom:96px}
.vg-page{padding:18px 16px 8px}
.vg-eyebrow{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--brand)}
.vg-h1{font-size:22px;font-weight:800;margin:4px 0 14px;letter-spacing:-.3px}

/* painel */
.vg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.vg-stat{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 10px;text-align:center}
.vg-stat b{display:block;font-size:22px;font-weight:800;color:var(--ink)}
.vg-stat span{font-size:11px;color:var(--muted);line-height:1.2;display:block;margin-top:2px}

.vg-secao{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:6px 14px 12px;margin-bottom:14px}
.vg-secao.perigo{border-color:#f3c7c7;background:var(--alert-bg)}
.vg-secao.aviso{border-color:#f0d8b5;background:var(--warn-bg)}
.vg-secao-head{display:flex;align-items:center;justify-content:space-between;padding:10px 0 6px}
.vg-secao-tit{display:flex;align-items:center;gap:7px;font-weight:700;font-size:14px}
.vg-secao.perigo .vg-secao-tit{color:var(--alert)}
.vg-secao.aviso .vg-secao-tit{color:var(--warn)}
.vg-link{background:none;border:none;color:var(--brand);font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:4px}

.vg-alerta{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;
  background:#fbfdff;border:1px solid var(--line);border-radius:12px;padding:11px 12px;margin-top:7px;text-align:left}
.vg-alerta.a-perigo{border-color:#f0caca;background:#fff}
.vg-alerta.a-aviso{border-color:#eed9ba;background:#fff}
.vg-alerta-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.vg-alerta-txt strong{font-size:14px}
.vg-alerta-txt span{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vg-chev{transform:rotate(180deg);color:#c2ccda;flex-shrink:0}
.vg-aviso{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fef2f2;color:#b91c1c;border-bottom:1px solid #f3c7c7;padding:10px 16px;font-size:13px;font-weight:600;line-height:1.4}
.vg-aviso span{flex:1;min-width:180px}
.vg-aviso button{display:inline-flex;align-items:center;gap:5px;border:none;background:#b91c1c;color:#fff;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:700;font-family:inherit}
.vg-backup{margin-top:22px;padding-top:6px;border-top:1px solid var(--line)}
.vg-file{cursor:pointer}
.vg-backup-nota{font-size:12px;color:var(--muted);line-height:1.5;margin:10px 2px 4px}
.vg-sair{margin-top:14px;color:var(--alert)}
.vg-alerta-wrap{display:flex;align-items:stretch;gap:7px;margin-top:7px}
.vg-alerta-wrap .vg-alerta{margin-top:0;flex:1;min-width:0}
.vg-mapa-ico{flex:0 0 46px;display:grid;place-items:center;border-radius:12px;background:#e4eefb;color:var(--brand);border:1px solid #cfe0f7;text-decoration:none}
.vg-mapa-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin:-2px 0 14px;padding:11px 14px;border-radius:11px;background:#e4eefb;color:var(--brand);font-weight:700;font-size:14px;text-decoration:none;border:1px solid #cfe0f7}
.vg-vazio{font-size:13px;color:var(--muted);padding:10px 2px;line-height:1.5}

/* chips */
.vg-chips{display:flex;gap:7px;overflow-x:auto;padding-bottom:12px;margin:0 -16px;padding-left:16px;padding-right:16px}
.vg-chip{flex-shrink:0;border:1px solid var(--line);background:var(--surface);color:var(--muted);
  padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600}
.vg-chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}

/* cards */
.vg-list{display:flex;flex-direction:column;gap:10px}
.vg-card{width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);
  border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:7px}
.vg-card-top{display:flex;align-items:center;justify-content:space-between}
.vg-num{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.5px}
.vg-card-cli{font-size:16px;font-weight:700}
.vg-card-meta{display:flex;align-items:center;justify-content:space-between;font-size:13px;color:var(--muted)}
.vg-card-meta span{display:inline-flex;align-items:center;gap:4px}
.vg-card-val{font-weight:700;color:var(--ink)}
.vg-card-warn{display:inline-flex;align-items:center;gap:5px;color:var(--alert);font-size:12px;font-weight:700;margin-top:2px}

/* badge */
.vg-badge{font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;white-space:nowrap}
.vg-badge.big{font-size:13px;padding:6px 13px}
.vg-badge.blue{background:#e4eefb;color:#0e63d6}
.vg-badge.amber{background:#fdeccc;color:#a85a04}
.vg-badge.violet{background:#ece6fa;color:#5b3bc4}
.vg-badge.green{background:#d8f0e1;color:#147a42}
.vg-badge.gray{background:#e9edf2;color:#5b6877}

/* fab + nav */
.vg-fab{position:fixed;bottom:80px;right:max(16px,calc(50% - 280px + 16px));z-index:30;
  width:56px;height:56px;border-radius:18px;background:var(--brand);color:#fff;border:none;
  display:grid;place-items:center;box-shadow:0 8px 22px rgba(14,99,214,.5)}
.vg-nav{position:fixed;bottom:0;left:0;right:0;z-index:25;background:var(--surface);
  border-top:1px solid var(--line);display:flex;max-width:560px;margin:0 auto;
  padding:8px 0 max(8px,env(safe-area-inset-bottom))}
.vg-navbtn{flex:1;border:none;background:none;color:var(--muted);display:flex;flex-direction:column;
  align-items:center;gap:3px;font-size:11px;font-weight:600;padding:4px}
.vg-navbtn.on{color:var(--brand)}

/* overlay / sheet */
.vg-overlay{position:fixed;inset:0;z-index:40;background:rgba(8,18,30,.5);backdrop-filter:blur(2px);
  display:flex;align-items:flex-end;justify-content:center}
.vg-sheet{background:var(--bg);width:100%;max-width:560px;max-height:94vh;border-radius:22px 22px 0 0;
  display:flex;flex-direction:column;animation:up .25s ease}
@keyframes up{from{transform:translateY(40px);opacity:.6}to{transform:translateY(0);opacity:1}}
.vg-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;
  border-bottom:1px solid var(--line);background:var(--surface);border-radius:22px 22px 0 0;position:sticky;top:0}
.vg-sheet-head strong{font-size:16px}
.vg-x{background:#eef2f7;border:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:var(--ink)}
.vg-sheet-body{overflow-y:auto;padding:16px 16px 28px}
.vg-sheet-status{margin-bottom:14px}
.vg-from{font-size:12px;color:var(--muted);background:#e4eefb;color:#0e63d6;display:inline-block;
  padding:5px 10px;border-radius:8px;margin-bottom:12px;font-weight:600}

/* campos */
.vg-campo{display:block;margin-bottom:12px}
.vg-campo-l{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px}
.vg-in{width:100%;border:1px solid var(--line);background:var(--surface);border-radius:11px;
  padding:11px 12px;font-size:15px;color:var(--ink);font-family:inherit;outline:none}
.vg-in:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(14,99,214,.12)}
.vg-ta{resize:vertical}
.vg-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* itens */
.vg-itens-head{display:flex;align-items:center;justify-content:space-between;margin:6px 0 8px;font-weight:700;font-size:14px}
.vg-itens-vazio{font-size:13px;color:var(--muted);margin-bottom:10px}
.vg-item{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:10px;margin-bottom:9px}
.vg-item-desc{margin-bottom:8px}
.vg-item-row{display:flex;gap:8px;align-items:flex-end}
.vg-item-qtd{width:64px;flex-shrink:0}
.vg-item-val{flex:1}
.vg-item-row span{display:block;font-size:11px;color:var(--muted);font-weight:600;margin-bottom:4px}
.vg-del{flex-shrink:0;width:42px;height:42px;border:1px solid var(--line);background:var(--surface);
  border-radius:11px;display:grid;place-items:center;color:var(--alert)}
.vg-total{display:flex;align-items:center;justify-content:space-between;background:var(--ink);color:#fff;
  border-radius:13px;padding:13px 15px;margin:4px 0 14px}
.vg-total b{font-size:18px}

/* ações */
.vg-acoes{margin:8px 0 4px;display:flex;flex-direction:column;gap:10px}
.vg-acao-box{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px}
.vg-acao-label{font-size:13px;color:var(--muted);display:block;margin-bottom:9px;line-height:1.4}
.vg-acao-row{display:flex;gap:9px;align-items:center}
.vg-acao-row .vg-in{flex:1}

/* botões */
.vg-btn{border:none;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:700;font-family:inherit;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:1;white-space:nowrap}
.vg-full{width:100%;margin-top:6px}
.vg-btn-primary{background:var(--brand);color:#fff}
.vg-btn-green{background:var(--ok);color:#fff}
.vg-btn-amber{background:var(--warn);color:#fff}
.vg-btn-violet{background:var(--violet);color:#fff}
.vg-btn-ghost{background:var(--surface);color:var(--ink);border:1px solid var(--line)}
.vg-iconbtn{flex:0 0 46px;background:var(--surface);border:1px solid var(--line);border-radius:12px;
  color:var(--alert);display:grid;place-items:center}
.vg-sheet-foot{display:flex;gap:9px;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}

/* modal share */
.vg-modal{background:var(--surface);width:100%;max-width:480px;margin:0 12px 12px;border-radius:18px;
  padding:14px;animation:up .2s ease}
.vg-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.vg-share-ta{width:100%;height:200px;border:1px solid var(--line);border-radius:11px;padding:12px;
  font-size:13px;font-family:inherit;color:var(--ink);resize:none;background:#fbfdff;line-height:1.5}
.vg-modal-foot{display:flex;gap:9px;margin-top:12px}

.vg-in-erro{border-color:var(--alert)!important;box-shadow:0 0 0 3px rgba(220,38,38,.12)}
.vg-erro{display:block;color:var(--alert);font-size:12px;font-weight:600;margin-top:5px}
.vg-iconbtn-wa{flex:0 0 46px;color:#fff;background:var(--ok);border-color:var(--ok)}
.vg-foot2{border-top:none;margin-top:9px;padding-top:0}
.vg-prev-dica{font-size:13px;color:var(--muted);line-height:1.5;background:#e4eefb;border-radius:11px;padding:11px 13px;margin:0 0 12px}
.vg-prev-dica b{color:var(--ink)}
.vg-prev-img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:10px;box-shadow:0 4px 14px rgba(8,18,30,.12)}
.vg-prev-load{padding:40px 0;text-align:center;color:var(--muted);font-size:14px}
.vg-prev-msg{font-size:13px;color:var(--warn);background:var(--warn-bg);border:1px solid #f0d8b5;border-radius:10px;padding:10px 12px;margin:12px 0 0;line-height:1.5}
.vg-top-actions{display:flex;align-items:center;gap:8px}
.vg-perfil{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.13);border:none;color:#fff;
  height:38px;padding:0 12px;border-radius:11px;font-size:13px;font-weight:700;max-width:130px}
.vg-perfil span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vg-vend-add{display:flex;gap:9px;margin-bottom:14px}
.vg-vend-add .vg-in{flex:1}
.vg-vend-addbtn{flex:0 0 auto;padding:12px 16px}
.vg-vend-list{display:flex;flex-direction:column;gap:9px}
.vg-vend-row{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:8px 10px}
.vg-vend-row.on{border-color:var(--brand);box-shadow:0 0 0 3px rgba(14,99,214,.10)}
.vg-vend-row .vg-in{flex:1}
.vg-vend-nome{flex:1;display:flex;align-items:center;gap:10px;background:none;border:none;text-align:left;padding:4px 2px;min-width:0}
.vg-vend-av{flex:0 0 34px;width:34px;height:34px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px}
.vg-vend-row.on .vg-vend-av{background:var(--brand)}
.vg-vend-txt{font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vg-vend-tag{flex:0 0 auto;display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;color:var(--brand);background:#e4eefb;padding:3px 8px;border-radius:999px;margin-left:auto}
.vg-iconbtn-ok{flex:0 0 46px;color:#fff;background:var(--ok);border-color:var(--ok)}
.vg-card-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px}
.vg-card-vend{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--brand);background:#e4eefb;padding:3px 9px;border-radius:999px}
.vg-desemp{background:var(--surface);border:1px solid var(--line);border-radius:14px;margin-bottom:14px;overflow:hidden}
.vg-desemp-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;background:none;border:none;padding:13px 14px;font-weight:700;font-size:14px;color:var(--ink)}
.vg-desemp-toggle span{display:inline-flex;align-items:center;gap:7px}
.vg-desemp-chev{transform:rotate(-90deg);transition:transform .18s;color:var(--muted)}
.vg-desemp-chev.open{transform:rotate(90deg)}
.vg-desemp-list{border-top:1px solid var(--line);padding:6px 12px 12px}
.vg-desemp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line)}
.vg-desemp-row:last-child{border-bottom:none}
.vg-desemp-nome{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vg-vend-av.sm{flex:0 0 26px;width:26px;height:26px;font-size:12px}
.vg-desemp-nums{display:flex;align-items:center;gap:11px;font-size:12px;color:var(--muted);flex-shrink:0}
.vg-desemp-nums b{color:var(--ink);font-size:13px}
.vg-desemp-val{color:var(--ok)!important;font-weight:800}
.vg-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:60;
  background:var(--ink);color:#fff;padding:11px 16px;border-radius:12px;font-size:13px;font-weight:600;
  max-width:88%;text-align:center;box-shadow:0 8px 24px rgba(8,18,30,.4);animation:up .2s ease}

/* ============ computador (tela larga) ============ */
@media (min-width: 900px){
  .vg-root{max-width:none;padding-left:220px}
  .vg-top{padding:14px 32px}
  .vg-aviso{padding:10px 32px}
  .vg-nav{top:0;bottom:0;right:auto;width:220px;max-width:none;margin:0;flex-direction:column;gap:4px;
    padding:88px 12px 16px;background:var(--ink);border-top:none;
    background-image:radial-gradient(140% 60% at 0% 0%,rgba(14,99,214,.35),transparent 60%)}
  .vg-navbtn{flex:0 0 auto;flex-direction:row;justify-content:flex-start;gap:12px;padding:12px 14px;
    border-radius:11px;font-size:14px;color:#9fb6d4;cursor:pointer}
  .vg-navbtn:hover{background:rgba(255,255,255,.06);color:#fff}
  .vg-navbtn.on{background:rgba(14,99,214,.35);color:#fff}
  .vg-main{padding-bottom:40px}
  .vg-page{max-width:1240px;margin:0 auto;padding:28px 32px 16px}
  .vg-h1{font-size:26px;margin-bottom:18px}
  .vg-chips{margin:0;padding-left:0;padding-right:0;flex-wrap:wrap}
  .vg-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
  .vg-card{cursor:pointer;transition:box-shadow .15s,border-color .15s}
  .vg-card:hover{border-color:#bcd0ea;box-shadow:0 6px 18px rgba(8,18,30,.08)}
  .vg-hoje{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
  .vg-hoje > .vg-hoje-head,.vg-hoje > .vg-stats{grid-column:1/-1}
  .vg-hoje > .vg-stats{margin-bottom:0;gap:14px}
  .vg-hoje > .vg-secao{margin-bottom:0}
  .vg-hoje > .vg-secao.perigo,.vg-hoje > .vg-secao.aviso{grid-column:1/-1}
  .vg-stat{padding:18px 12px}
  .vg-stat b{font-size:28px}
  .vg-stat span{font-size:12px}
  .vg-alerta,.vg-link,.vg-chip,.vg-btn,.vg-iconbtn,.vg-x,.vg-perfil,.vg-fab{cursor:pointer}
  .vg-fab{right:32px;bottom:32px}
  .vg-overlay{align-items:center;padding:24px}
  .vg-sheet{max-width:720px;max-height:90vh;border-radius:22px}
  .vg-modal{margin:0}
  .vg-toast{bottom:32px}
}
`}</style>
  );
}


export default App;

