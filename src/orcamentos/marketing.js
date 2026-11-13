// Marketing da Vigiar no Instagram: pautas, rodízio de assunto e as regras do que sai.
// A arte é desenhada no navegador (ver arte.js); aqui ficam as decisões.

export const ASSUNTOS = [
  { id: "cftv", nome: "Câmeras e CFTV" },
  { id: "alarme", nome: "Alarmes" },
  { id: "portao", nome: "Portões automáticos" },
  { id: "acesso", nome: "Controle de acesso" },
  { id: "interfone", nome: "Interfonia" },
  { id: "cerca", nome: "Cerca elétrica" },
  { id: "manutencao", nome: "Manutenção" },
  { id: "eletrica", nome: "Instalações elétricas" },
  { id: "iluminacao", nome: "Iluminação" },
  { id: "drdps", nome: "DR e DPS" },
];

export const FORMATOS = [
  { id: "dica", nome: "Dica" },
  { id: "duvida", nome: "Dúvida frequente" },
  { id: "antesdepois", nome: "Antes e depois" },
  { id: "bastidor", nome: "Bastidores" },
  { id: "erro", nome: "Erro comum" },
  { id: "servico", nome: "Apresentação de serviço" },
];

export const PUBLICOS = ["síndico", "morador", "comerciante"];

// Horários de teste enquanto não houver Insights. Base: perfil local de serviço, onde o
// público olha o celular antes do trabalho, no almoço e à noite.
export const HORARIOS_TESTE = [
  { hora: "08:30", porque: "antes do expediente, quando síndico e comerciante organizam o dia" },
  { hora: "12:30", porque: "intervalo do almoço, o pico mais constante em perfil local" },
  { hora: "19:00", porque: "fim do dia, quando morador vê o celular com calma" },
];

export const ACOES = [
  "Repostar no Story com enquete de sim ou não sobre o tema.",
  "Repostar no Story com a caixinha de perguntas pedindo a dúvida do seguidor.",
  "Mandar o post no grupo de WhatsApp dos síndicos que você atende.",
  "Responder todo comentário no mesmo dia: comentário respondido puxa mais alcance.",
  "Marcar no Story quem aparece na foto, com autorização, e pedir que compartilhe.",
  "Salvar o post nos destaques do perfil, na pasta do assunto.",
];

export const CTAS = [
  "Salve para consultar depois.",
  "Envie para o síndico do seu prédio.",
  "Chame a Vigiar no direct para pedir um orçamento.",
  "Marque alguém que precisa ver isto.",
  "Comente a sua dúvida que a gente responde.",
];

/* ===== rodízio: não repetir assunto perto ===== */

const DIAS_DESCANSO = 7;   // assunto só volta depois de uma semana
const FORMATOS_DESCANSO = 3;

const diasEntre = (a, b) =>
  Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

// Escolhe o que postar hoje: o assunto mais "descansado", e um formato diferente dos
// últimos. Sem isso o agente repete câmera a semana inteira.
export function escolherPauta(historico = [], hoje, semente = 0) {
  const recentes = [...historico]
    .filter((h) => h.data && diasEntre(h.data, hoje) >= 0)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const ultimoUso = new Map();
  recentes.forEach((h) => {
    if (h.assunto && !ultimoUso.has(h.assunto)) ultimoUso.set(h.assunto, diasEntre(h.data, hoje));
  });

  const livres = ASSUNTOS.filter((a) => {
    const d = ultimoUso.get(a.id);
    return d === undefined || d >= DIAS_DESCANSO;
  });
  const candidatos = livres.length ? livres : [...ASSUNTOS].sort(
    (a, b) => (ultimoUso.get(b.id) ?? 999) - (ultimoUso.get(a.id) ?? 999),
  );
  const assunto = candidatos[semente % candidatos.length];

  const formatosRecentes = recentes.slice(0, FORMATOS_DESCANSO).map((h) => h.formato);
  const formatosLivres = FORMATOS.filter((f) => !formatosRecentes.includes(f.id));
  const formato = (formatosLivres.length ? formatosLivres : FORMATOS)[semente % (formatosLivres.length || FORMATOS.length)];

  const publico = PUBLICOS[recentes.length % PUBLICOS.length];
  return { assunto, formato, publico };
}

// Horário sugerido, separado do horário de entrega. Com Insights, usa o do Gelvan.
export function horarioSugerido(insights, semente = 0) {
  const melhor = insights?.melhoresHorarios?.[0];
  if (melhor?.hora) {
    return { hora: melhor.hora, porque: melhor.porque || "veio dos seus Insights", teste: false };
  }
  const h = HORARIOS_TESTE[semente % HORARIOS_TESTE.length];
  return { ...h, teste: true };
}

/* ===== o que não pode sair numa arte ===== */

// Cada item vira uma pergunta que o Gelvan responde antes de a foto ir para a arte.
export const CHECAGENS = [
  { id: "rosto", texto: "Aparece rosto de alguém?" },
  { id: "placa", texto: "Aparece placa de carro?" },
  { id: "endereco", texto: "Dá para ler endereço, número ou nome do condomínio?" },
  { id: "senha", texto: "Aparece senha, etiqueta de rede ou QR code?" },
  { id: "layout", texto: "Dá para entender onde ficam os equipamentos daquele cliente?" },
];

export const precisaTarjar = (midia) =>
  CHECAGENS.filter((c) => midia?.riscos?.[c.id]).map((c) => c.texto);

export const midiaLiberada = (midia) =>
  !!midia && (midia.conferida === true) && precisaTarjar(midia).length === 0;

/* ===== identidade visual ===== */

export const MARCA_PADRAO = {
  nome: "VIGIAR SISTEMAS",
  linha: "Segurança eletrônica e elétrica",
  cidade: "Belo Horizonte e região",
  telefone: "",
  instagram: "",
  site: "",
  corFundo: "#0d1420",
  corDestaque: "#e2640a",
  corTexto: "#ffffff",
  logo: null,      // dataURL, cadastrado no painel
};

export const lerMarca = (cfg) => ({ ...MARCA_PADRAO, ...(cfg || {}) });

/* ===== entrega do dia ===== */

export const idDoDia = (data) => `post-${data}`;

export function entregaDoDia(entregas = [], data) {
  return entregas.find((e) => e.data === data) || null;
}

// Uma entrega automática por dia. Pedido manual vira entrega extra, com id próprio.
export const proximaEntrega = (agora = new Date()) => {
  const saoPaulo = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const alvo = new Date(saoPaulo);
  alvo.setHours(10, 0, 0, 0);
  if (saoPaulo >= alvo) alvo.setDate(alvo.getDate() + 1);
  return alvo;
};

export function textoDaProxima(agora = new Date()) {
  const p = proximaEntrega(agora);
  const saoPaulo = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const amanha = p.getDate() !== saoPaulo.getDate();
  return `${amanha ? "amanhã" : "hoje"} às 10h`;
}
