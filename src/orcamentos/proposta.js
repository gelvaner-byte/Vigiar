// Proposta comercial a partir do orçamento.
// Os números são SEMPRE do orçamento — o agente só escreve a explicação do serviço.
// Se o orçamento mudar depois, a proposta fica marcada como desatualizada.

import { prazoGarantia, textoGarantia, tipoGarantiaSugerido, venceEm } from "./politicas.js";

const num = (v) => Number(v) || 0;
export const totalItens = (itens) =>
  (itens || []).reduce((s, i) => s + num(i.qtd) * num(i.valor), 0);

/* ===== marca d'água do orçamento =====
   Impressão digital do que importa comercialmente. Mudou a lista, o valor, o pagamento ou
   o serviço, a proposta precisa ser refeita. Mexer na cor do botão não conta. */
export function assinaturaDoOrcamento(orc) {
  const partes = [
    orc.clienteId || "", orc.cliente || "", orc.endereco || "", orc.bairro || "",
    orc.descricaoServico || "", orc.observacoes || "",
    orc.validadeDias ?? "", orc.tipoGarantia || "", orc.desconto ?? "",
    orc.pagamento || "", orc.parcelas ?? "", orc.entrada ?? "", orc.somenteTotal ? "T" : "I",
    ...(orc.itens || []).map((i) => `${i.descricao}|${i.qtd}|${i.unidade}|${i.valor}|${i.codigo || ""}`),
  ];
  const txt = partes.join("§");
  // Hash simples e estável: não precisa ser criptográfico, só mudar quando o conteúdo muda.
  let h = 5381;
  for (let i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${txt.length}`;
}

export const propostaDesatualizada = (orc, proposta) =>
  !!proposta && proposta.assinatura !== assinaturaDoOrcamento(orc);

/* ===== o que falta preencher antes de mandar ===== */
export function pendenciasDaProposta(orc, politicas) {
  const f = [];
  if (!orc.cliente) f.push("Nome do cliente");
  if (!orc.endereco) f.push("Endereço do serviço");
  if (!(orc.itens || []).length) f.push("Pelo menos um item no orçamento");
  if (totalItens(orc.itens) <= 0) f.push("Valor dos itens");
  if (!orc.descricaoServico) f.push("Descrição do que o cliente quer");
  if (!orc.telefone && !orc.email) f.push("Telefone ou e-mail do cliente");
  if (!(orc.validadeDias ?? politicas?.validadeDias)) f.push("Validade do orçamento");
  return f;
}

/* ===== dados comerciais: saem do orçamento, nunca do modelo ===== */
export function dadosComerciais(orc, politicas) {
  const itens = (orc.itens || []).map((i) => ({
    descricao: i.descricao || "Item",
    qtd: num(i.qtd) || 1,
    unidade: i.unidade || "UN",
    codigo: i.codigo || "",
    unitario: num(i.valor),
    total: num(i.qtd) * num(i.valor),
    doCliente: !!i.materialDoCliente,
  }));
  const bruto = itens.reduce((s, i) => s + i.total, 0);
  const desconto = num(orc.desconto);
  const garantia = prazoGarantia(tipoGarantiaSugerido(orc), politicas);
  return {
    numero: orc.numero,
    emitidoEm: orc.criadoEm || "",
    cliente: {
      nome: orc.cliente || "", telefone: orc.telefone || "", email: orc.email || "",
      documento: orc.documento || "",
    },
    local: [orc.endereco, orc.bairro].filter(Boolean).join(" - "),
    itens,
    somenteTotal: !!orc.somenteTotal,
    bruto,
    desconto,
    total: Math.max(0, bruto - desconto),
    materiaisDoCliente: itens.filter((i) => i.doCliente).map((i) => i.descricao),
    pagamento: orc.pagamento || "",
    prazoExecucao: orc.prazoExecucao || "",
    validadeDias: orc.validadeDias ?? politicas.validadeDias,
    valeAte: venceEm(orc, politicas),
    garantia: { tipo: garantia.tipo, texto: garantia.texto, frase: textoGarantia(orc, politicas) },
    observacoes: orc.observacoes || "",
  };
}

/* ===== texto da proposta sem IA =====
   É o que vale quando o agente não responde. Explica o serviço pelo que está no orçamento,
   sem inventar escopo que ninguém contratou. */
const FAMILIAS = [
  { re: /(c[âa]mera|cftv|dvr|nvr|bullet|dome|vigil[âa]ncia)/i, nome: "monitoramento por câmeras",
    etapas: ["Levantamento dos pontos no local e definição do melhor posicionamento das câmeras.",
      "Passagem da infraestrutura e instalação dos equipamentos.",
      "Configuração do gravador, ajuste de imagem e teste de cada câmera.",
      "Entrega do sistema funcionando, com orientação de uso."] },
  { re: /(alarme|sensor|central de alarme|infravermelho)/i, nome: "alarme",
    etapas: ["Definição dos pontos de proteção conforme o local.",
      "Instalação da central e dos sensores.",
      "Programação das zonas e teste de disparo.",
      "Orientação de uso para quem vai operar."] },
  { re: /(cerca el[ée]trica|choque|haste)/i, nome: "cerca elétrica",
    etapas: ["Medição do perímetro e definição do traçado.",
      "Instalação das hastes, fios e central de choque.",
      "Aterramento, regulagem e teste de tensão.",
      "Instalação da placa de advertência exigida por norma."] },
  { re: /(interfone|porteiro|videoporteiro)/i, nome: "interfonia",
    etapas: ["Conferência da fiação existente e do ponto de instalação.",
      "Instalação do módulo externo e dos ramais.",
      "Programação e teste de chamada de cada ponto.",
      "Entrega com orientação de uso."] },
  { re: /(port[ãa]o|motor|automatiza|deslizante|basculante)/i, nome: "automação de portão",
    etapas: ["Avaliação do portão, do trilho e do ponto de energia.",
      "Instalação do motor e da central de comando.",
      "Programação de curso, força e dispositivos de segurança.",
      "Teste de abertura e fechamento e entrega dos controles."] },
  { re: /(controle de acesso|fechadura|biometri|catraca|tag)/i, nome: "controle de acesso",
    etapas: ["Definição dos pontos de acesso e do tipo de liberação.",
      "Instalação dos equipamentos e da fiação.",
      "Cadastro inicial dos usuários e teste de liberação.",
      "Orientação de uso para a administração."] },
  { re: /(el[ée]tric|tomada|disjuntor|quadro|fia[çc][ãa]o|ilumina)/i, nome: "serviço elétrico",
    etapas: ["Avaliação do ponto e da carga existente.",
      "Execução do serviço conforme o escopo contratado.",
      "Teste de funcionamento e conferência de segurança.",
      "Limpeza do local e entrega."] },
];

export function familiasDoOrcamento(orc) {
  const texto = [(orc.descricaoServico || ""), ...(orc.itens || []).map((i) => i.descricao || "")].join(" ");
  const achadas = FAMILIAS.filter((f) => f.re.test(texto));
  return achadas.length ? achadas : [];
}

export function textoPadrao(orc, politicas) {
  const d = dadosComerciais(orc, politicas);
  const fams = familiasDoOrcamento(orc);
  const nomes = fams.map((f) => f.nome);
  const lista = nomes.length === 0 ? "" : nomes.length === 1 ? nomes[0]
    : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

  const necessidade = orc.descricaoServico
    ? `O cliente procurou a Vigiar Sistemas para ${String(orc.descricaoServico).trim().replace(/\.$/, "")}.`
    : "O cliente procurou a Vigiar Sistemas para atender a necessidade levantada na visita técnica.";

  const solucao = lista
    ? `Nossa proposta cobre ${lista}, com os equipamentos e a mão de obra descritos abaixo. ` +
      `O serviço é executado pela nossa equipe própria e entregue funcionando e testado.`
    : "Nossa proposta cobre os serviços e materiais descritos abaixo, executados pela nossa " +
      "equipe própria e entregues funcionando e testados.";

  const etapas = fams.length
    ? [...new Set(fams.flatMap((f) => f.etapas))]
    : ["Execução do serviço conforme o escopo descrito nesta proposta.",
      "Teste de funcionamento e conferência antes da entrega.",
      "Entrega do serviço com orientação de uso."];

  return {
    necessidade,
    solucao,
    etapas,
    fechamento:
      `A Vigiar Sistemas atua há mais de vinte e cinco anos em segurança eletrônica em Belo ` +
      `Horizonte. ${d.garantia.frase}`,
    porIA: false,
  };
}

/* ===== monta a proposta inteira ===== */
export function montarProposta({ orc, politicas, texto, autor }) {
  const d = dadosComerciais(orc, politicas);
  const t = texto || textoPadrao(orc, politicas);
  return {
    id: `prop-${orc.id}`,
    orcamentoId: orc.id,
    numero: orc.numero,
    assinatura: assinaturaDoOrcamento(orc),
    geradaEm: new Date().toISOString(),
    geradaPor: autor || "",
    porIA: !!t.porIA,
    comercial: d,
    texto: {
      necessidade: t.necessidade || "",
      solucao: t.solucao || "",
      etapas: Array.isArray(t.etapas) ? t.etapas : [],
      fechamento: t.fechamento || "",
    },
    enviadaEm: null,
    enviadaPor: "",
  };
}

// Texto pronto para mandar no WhatsApp, respeitando "mostrar só o total".
export function propostaEmTexto(p) {
  const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const c = p.comercial;
  let t = `*VIGIAR SISTEMAS — Segurança eletrônica*\n*Proposta comercial — Orçamento Nº ${c.numero}*\n\n`;
  if (c.cliente.nome) t += `Cliente: ${c.cliente.nome}\n`;
  if (c.local) t += `Local: ${c.local}\n`;
  t += `\n${p.texto.necessidade}\n\n${p.texto.solucao}\n`;
  if (p.texto.etapas.length) {
    t += `\n*Como fazemos:*\n`;
    p.texto.etapas.forEach((e) => { t += `• ${e}\n`; });
  }
  if (c.materiaisDoCliente.length) {
    t += `\n_Material por conta do cliente: ${c.materiaisDoCliente.join(", ")}._\n`;
  }
  t += `\n*Investimento*\n`;
  if (!c.somenteTotal) {
    c.itens.forEach((i) => { t += `• ${i.qtd}x ${i.descricao} — ${brl(i.total)}\n`; });
    if (c.desconto > 0) t += `Desconto: -${brl(c.desconto)}\n`;
  }
  t += `*Total: ${brl(c.total)}*\n`;
  if (c.pagamento) t += `\nPagamento: ${c.pagamento}`;
  if (c.prazoExecucao) t += `\nPrazo de execução: ${c.prazoExecucao}`;
  t += `\nValidade: ${c.validadeDias} dias`;
  t += `\nGarantia: ${c.garantia.texto}`;
  if (c.observacoes) t += `\n\nObs.: ${c.observacoes}`;
  t += `\n\nPara aprovar, é só responder esta mensagem.`;
  return t;
}
