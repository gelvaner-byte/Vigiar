// Políticas comerciais da Vigiar — a regra oficial da casa, guardada no banco (config/politicas).
// Tudo que o app emite e tudo que os agentes respondem sai daqui, para não haver duas versões
// da mesma regra. Documento já emitido guarda a política que valia no dia: nada muda para trás.

export const POLITICAS_PADRAO = {
  validadeDias: 15,
  garantia: {
    comProduto: { meses: 12, rotulo: "Produto com instalação da Vigiar" },
    soMaoDeObra: { dias: 90, rotulo: "Somente mão de obra" },
  },
  // O que a garantia cobre e o que não cobre. Editável na área de políticas.
  cobertura: [
    "Defeito de fabricação do equipamento fornecido pela Vigiar.",
    "Falha de instalação ou de configuração feita pela nossa equipe.",
    "Mão de obra e visita técnica para corrigir o que está coberto.",
  ],
  exclusoes: [
    "Dano por raio, oscilação de energia, enchente ou outro evento da natureza.",
    "Mau uso, violação, ou conserto feito por terceiros.",
    "Equipamento fornecido pelo cliente, salvo acordo por escrito.",
    "Desgaste de peça de consumo, como bateria e lâmpada.",
    "Reposição de equipamento furtado, perdido ou danificado por terceiros.",
  ],
  observacao:
    "A garantia contratual acima é somada à garantia legal do Código de Defesa do Consumidor, nunca a substitui nem a reduz.",
  atualizadoEm: null,
  atualizadoPor: "",
};

// Mescla o que está no banco com o padrão, para o app nunca ficar sem regra.
export function lerPoliticas(cfgPoliticas) {
  const g = cfgPoliticas?.garantia || {};
  return {
    ...POLITICAS_PADRAO,
    ...(cfgPoliticas || {}),
    garantia: {
      comProduto: { ...POLITICAS_PADRAO.garantia.comProduto, ...(g.comProduto || {}) },
      soMaoDeObra: { ...POLITICAS_PADRAO.garantia.soMaoDeObra, ...(g.soMaoDeObra || {}) },
    },
    cobertura: cfgPoliticas?.cobertura?.length ? cfgPoliticas.cobertura : POLITICAS_PADRAO.cobertura,
    exclusoes: cfgPoliticas?.exclusoes?.length ? cfgPoliticas.exclusoes : POLITICAS_PADRAO.exclusoes,
  };
}

/* ===== validade ===== */

export function somarDias(iso, dias) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d.toISOString().slice(0, 10);
}

// Vale a partir do envio. Enquanto não foi enviado, conta da criação.
export const baseDaValidade = (orc) => orc?.dataEnvio || orc?.criadoEm || "";
export const venceEm = (orc, pol) => somarDias(baseDaValidade(orc), orc?.validadeDias ?? pol.validadeDias);

export function situacaoDaValidade(orc, pol, hoje = new Date().toISOString().slice(0, 10)) {
  const fim = venceEm(orc, pol);
  if (!fim) return { estado: "sem_data", dias: null, vence: "" };
  const dias = Math.round((new Date(`${fim}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000);
  const estado = dias < 0 ? "vencido" : dias <= 3 ? "vencendo" : "em_dia";
  return { estado, dias, vence: fim };
}

/* ===== garantia ===== */

const PALAVRAS_SERVICO = /(m[ãa]o de obra|servi[çc]o|visita|manuten[çc][ãa]o|instala[çc][ãa]o|configura[çc][ãa]o|reparo|conserto|deslocamento|diagn[óo]stico)/i;

// Tem produto se existir ao menos um item que não seja claramente serviço.
export function temProduto(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  return lista.some((i) => {
    const d = String(i?.descricao || "").trim();
    return d && !PALAVRAS_SERVICO.test(d);
  });
}

// Sugere o tipo de garantia. Quem assina pode trocar à mão no documento.
export const tipoGarantiaSugerido = (doc) =>
  doc?.tipoGarantia || (temProduto(doc?.itens) ? "comProduto" : "soMaoDeObra");

export function prazoGarantia(tipo, pol) {
  if (tipo === "soMaoDeObra") {
    const dias = pol.garantia.soMaoDeObra.dias;
    return { tipo, dias, meses: null, texto: `${dias} dias` };
  }
  const meses = pol.garantia.comProduto.meses;
  return { tipo: "comProduto", meses, dias: null, texto: `${meses} meses` };
}

export function textoGarantia(doc, pol) {
  const p = prazoGarantia(tipoGarantiaSugerido(doc), pol);
  const base = p.tipo === "comProduto"
    ? `Garantia de ${p.texto} para o produto fornecido e para a instalação feita pela Vigiar.`
    : `Garantia de ${p.texto} para o serviço executado (somente mão de obra).`;
  return `${base} ${pol.observacao}`;
}

export function fimDaGarantia(doc, pol) {
  const inicio = doc?.dataConclusao || doc?.dataServico || doc?.criadoEm || "";
  const p = prazoGarantia(tipoGarantiaSugerido(doc), pol);
  if (!inicio) return "";
  return p.dias ? somarDias(inicio, p.dias) : somarDias(inicio, p.meses * 30.44);
}

/* ===== as políticas dentro do Cérebro ===== */

// O Cérebro é onde o Gelvan procura o que a empresa sabe, então as políticas aparecem lá
// junto com as memórias. São só de leitura: quem manda é a aba POLÍTICAS, para não existirem
// duas versões da mesma regra.
export function memoriasDasPoliticas(pol) {
  if (!pol) return [];
  const g = prazoGarantia("comProduto", pol);
  const s = prazoGarantia("soMaoDeObra", pol);
  const em = pol.atualizadoEm ? pol.atualizadoEm.slice(0, 10) : "";
  const base = { categoria: "Regras da casa", oficial: true, criadoEm: em, atualizadoEm: em };
  return [
    {
      ...base, id: "pol-validade", titulo: "Validade do orçamento",
      conteudo: `Todo orçamento vale ${pol.validadeDias} dias corridos, contados do dia em que foi enviado ao cliente. Enquanto não foi enviado, conta da data em que foi criado. Orçamento já emitido mantém a validade que valia no dia dele.`,
    },
    {
      ...base, id: "pol-garantia-produto", titulo: "Garantia com produto nosso",
      conteudo: `Quando a Vigiar fornece o equipamento e faz a instalação, a garantia é de ${g.texto}. ${pol.observacao}`,
    },
    {
      ...base, id: "pol-garantia-servico", titulo: "Garantia de serviço",
      conteudo: `Quando é só mão de obra, sem produto nosso, a garantia é de ${s.texto}. ${pol.observacao}`,
    },
    {
      ...base, id: "pol-cobertura", titulo: "O que a garantia cobre",
      conteudo: pol.cobertura.join("\n"),
    },
    {
      ...base, id: "pol-exclusoes", titulo: "O que a garantia não cobre",
      conteudo: pol.exclusoes.join("\n"),
    },
  ];
}

export const ehMemoriaOficial = (m) => String(m?.id || "").startsWith("pol-");

/* ===== o que os agentes leem ===== */

// Vai inteiro para o TRON e para todos os especialistas, para ninguém responder diferente.
export function politicasParaAgentes(pol) {
  const g = prazoGarantia("comProduto", pol);
  const s = prazoGarantia("soMaoDeObra", pol);
  return {
    validadeDoOrcamento: `${pol.validadeDias} dias corridos, contados do envio`,
    garantiaComProduto: `${g.texto} — quando a Vigiar fornece o equipamento e instala`,
    garantiaSoMaoDeObra: `${s.texto} — quando é só serviço, sem produto nosso`,
    oQueACoberturaInclui: pol.cobertura,
    oQueNaoEstaCoberto: pol.exclusoes,
    observacaoLegal: pol.observacao,
    regraDeOuro:
      "Documento já emitido mantém a política do dia em que foi feito. Política nova vale para documento novo.",
  };
}
