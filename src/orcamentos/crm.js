// CRM: tipo de cliente, contatos, retornos e o que está pegando em cada atendimento.
// Reusa o que já existe — cliente, orçamento, proposta e OS continuam onde estavam;
// aqui é a leitura disso tudo junto, do ponto de vista do relacionamento.

export const TIPOS = [
  { id: "pf", nome: "Pessoa física", curto: "Pessoa" },
  { id: "empresa", nome: "Empresa", curto: "Empresa" },
  { id: "condominio", nome: "Condomínio", curto: "Condomínio" },
];
export const tipoDoCliente = (c) => c?.tipo || "pf";
export const ehColetivo = (c) => ["empresa", "condominio"].includes(tipoDoCliente(c));
export const nomeDoTipo = (id) => (TIPOS.find((t) => t.id === id) || TIPOS[0]).curto;

export const FUNCOES = [
  "Síndico", "Subsíndico", "Zelador", "Responsável pela manutenção",
  "Administradora", "Gerente", "Proprietário", "Portaria", "Financeiro", "Outro",
];

export const MEIOS = [
  { id: "whatsapp", nome: "WhatsApp" },
  { id: "ligacao", nome: "Ligação" },
  { id: "presencial", nome: "Presencial" },
  { id: "email", nome: "E-mail" },
  { id: "outro", nome: "Outro" },
];

/* ===== contatos ===== */

// Cliente antigo tem só telefone solto. Vira um contato para a tela não precisar
// saber de dois formatos.
export function contatosDoCliente(c) {
  const lista = Array.isArray(c?.contatos) ? c.contatos.filter((x) => x && (x.nome || x.telefone)) : [];
  if (lista.length) {
    return lista.some((x) => x.principal)
      ? lista
      : lista.map((x, i) => (i === 0 ? { ...x, principal: true } : x));
  }
  if (!c?.telefone && !c?.email) return [];
  return [{
    id: "principal", nome: c.nome || "", funcao: "", telefone: c.telefone || "",
    email: c.email || "", principal: true,
  }];
}

export const contatoPrincipal = (c) => {
  const lista = contatosDoCliente(c);
  return lista.find((x) => x.principal) || lista[0] || null;
};

// Só dígitos, com o 55 na frente: é o que o link do WhatsApp aceita.
export function linkWhatsApp(telefone, texto = "") {
  const d = String(telefone || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const comPais = d.startsWith("55") ? d : `55${d}`;
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${comPais}${q}`;
}

/* ===== cliente repetido ===== */

const soDigitos = (t) => String(t || "").replace(/\D/g, "");
const emailLimpo = (t) => String(t || "").trim().toLowerCase();

// Avisa, não bloqueia: pode existir mesmo telefone legítimo (marido e esposa, por exemplo).
export function clientesParecidos(novo, clientes = []) {
  const tels = new Set(
    [novo.telefone, novo.telefone2, ...contatosDoCliente(novo).map((x) => x.telefone)]
      .map(soDigitos).filter((t) => t.length >= 10).map((t) => t.slice(-10)),
  );
  const emails = new Set(
    [novo.email, ...contatosDoCliente(novo).map((x) => x.email)]
      .map(emailLimpo).filter(Boolean),
  );
  const achados = [];
  for (const c of clientes) {
    if (c.id === novo.id) continue;
    const telC = [c.telefone, c.telefone2, ...contatosDoCliente(c).map((x) => x.telefone)]
      .map(soDigitos).filter((t) => t.length >= 10).map((t) => t.slice(-10));
    const emailC = [c.email, ...contatosDoCliente(c).map((x) => x.email)].map(emailLimpo).filter(Boolean);
    const porTelefone = telC.some((t) => tels.has(t));
    const porEmail = emailC.some((e) => emails.has(e));
    if (porTelefone || porEmail) achados.push({ cliente: c, porTelefone, porEmail });
  }
  return achados;
}

/* ===== retornos ===== */

export const MOTIVOS = [
  "Cobrar resposta do orçamento",
  "Ligar depois da visita",
  "Lembrar da manutenção",
  "Retomar contato",
  "Confirmar agendamento",
  "Outro",
];

export const SITUACOES = { aberto: "Em aberto", feito: "Concluído", cancelado: "Cancelado" };

export const diasEntre = (de, ate) => {
  if (!de || !ate) return null;
  const a = new Date(`${de}T12:00:00`);
  const b = new Date(`${ate}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
};

export function situacaoDoRetorno(r, hoje) {
  if (r.situacao && r.situacao !== "aberto") return r.situacao;
  const d = diasEntre(r.data, hoje);
  if (d === null) return "aberto";
  if (d > 0) return "atrasado";
  if (d === 0) return "hoje";
  return "futuro";
}

export function agruparRetornos(retornos = [], hoje) {
  const abertos = retornos.filter((r) => !r.situacao || r.situacao === "aberto");
  const g = { atrasados: [], hoje: [], futuros: [], concluidos: [] };
  abertos.forEach((r) => {
    const s = situacaoDoRetorno(r, hoje);
    if (s === "atrasado") g.atrasados.push(r);
    else if (s === "hoje") g.hoje.push(r);
    else g.futuros.push(r);
  });
  g.concluidos = retornos.filter((r) => r.situacao === "feito");
  const porData = (a, b) => String(a.data).localeCompare(String(b.data));
  g.atrasados.sort(porData);
  g.hoje.sort(porData);
  g.futuros.sort(porData);
  g.concluidos.sort((a, b) => String(b.concluidoEm || "").localeCompare(String(a.concluidoEm || "")));
  return g;
}

export const retornosDoCliente = (retornos = [], clienteId) =>
  retornos.filter((r) => r.clienteId === clienteId);

export const proximoRetorno = (retornos = [], clienteId, hoje) => {
  const abertos = retornosDoCliente(retornos, clienteId)
    .filter((r) => !r.situacao || r.situacao === "aberto")
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (!abertos.length) return null;
  const r = abertos[0];
  return { ...r, estado: situacaoDoRetorno(r, hoje) };
};

/* ===== a vida do cliente num lugar só ===== */

export function fichaDoCliente({ cliente, orcamentos = [], ordens = [], propostas = [], retornos = [], hoje }) {
  const orcs = orcamentos.filter((o) => o.clienteId === cliente.id);
  const oss = ordens.filter((o) => o.clienteId === cliente.id);
  const idsOrc = new Set(orcs.map((o) => o.id));
  const props = propostas.filter((p) => idsOrc.has(p.orcamentoId));

  // Cada orçamento é um atendimento com andamento próprio — e podem correr vários juntos.
  const atendimentos = orcs.map((o) => ({
    orcamento: o,
    proposta: props.find((p) => p.orcamentoId === o.id) || null,
    ordens: oss.filter((s) => s.orcamentoId === o.id),
    retornos: retornos.filter((r) => r.orcamentoId === o.id),
  })).sort((a, b) => String(b.orcamento.dataVisita || b.orcamento.criadoEm || "")
    .localeCompare(String(a.orcamento.dataVisita || a.orcamento.criadoEm || "")));

  const avulsas = oss.filter((s) => !s.orcamentoId);
  const concluidas = oss.filter((s) => s.status === "concluida");
  const anotacoes = Array.isArray(cliente.anotacoes) ? cliente.anotacoes : [];
  const interacoes = Array.isArray(cliente.interacoes) ? cliente.interacoes : [];

  const marcos = [
    ...interacoes.map((i) => ({ em: i.em, o: "interacao", dado: i })),
    ...anotacoes.map((a) => ({ em: a.em, o: "anotacao", dado: a })),
    ...retornos.filter((r) => r.clienteId === cliente.id && r.concluidoEm)
      .map((r) => ({ em: r.concluidoEm, o: "retorno", dado: r })),
  ].sort((a, b) => String(b.em || "").localeCompare(String(a.em || "")));

  const ultima = marcos[0] || null;
  const ultimaData = ultima?.em
    || [...orcs.map((o) => o.criadoEm), ...oss.map((o) => o.criadoEm)].filter(Boolean).sort().pop()
    || cliente.criadoEm || "";

  return {
    atendimentos, avulsas, propostas: props, marcos, interacoes, anotacoes,
    totais: {
      orcamentos: orcs.length,
      servicos: oss.length,
      concluidos: concluidas.length,
      faturado: concluidas.reduce((s, o) => s + (Number(o.valor) || 0), 0),
    },
    ultimaInteracao: ultimaData,
    diasSemContato: diasEntre(String(ultimaData).slice(0, 10), hoje),
    proximoRetorno: proximoRetorno(retornos, cliente.id, hoje),
    equipamentos: equipamentosDoCliente(oss),
  };
}

// Equipamento instalado: sai do que foi usado nas OS concluídas, com a data e a garantia.
export function equipamentosDoCliente(ordens = []) {
  const mapa = new Map();
  ordens.filter((o) => o.status === "concluida").forEach((os) => {
    (os.itens || []).forEach((it) => {
      const nome = String(it.descricao || "").trim();
      if (!nome) return;
      const chave = nome.toLowerCase();
      const atual = mapa.get(chave);
      if (!atual || String(os.dataServico || "") > String(atual.em || "")) {
        mapa.set(chave, { nome, qtd: Number(it.qtd) || 1, em: os.dataServico || "", osNumero: os.numero, osId: os.id });
      }
    });
  });
  return [...mapa.values()].sort((a, b) => String(b.em).localeCompare(String(a.em)));
}

/* ===== busca ===== */

export function procurar(clientes = [], termo) {
  const q = String(termo || "").trim().toLowerCase();
  if (!q) return clientes;
  const digitos = q.replace(/\D/g, "");
  return clientes.filter((c) => {
    const campos = [
      c.nome, c.email, c.endereco, c.bairro, c.documento, c.observacoes,
      ...contatosDoCliente(c).flatMap((x) => [x.nome, x.funcao, x.email]),
    ].join(" ").toLowerCase();
    if (campos.includes(q)) return true;
    if (digitos.length >= 4) {
      const tels = [c.telefone, c.telefone2, ...contatosDoCliente(c).map((x) => x.telefone)]
        .map((t) => String(t || "").replace(/\D/g, "")).join(" ");
      if (tels.includes(digitos)) return true;
    }
    return false;
  });
}
