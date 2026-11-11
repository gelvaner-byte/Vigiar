// Fotos da proposta.
// Tudo que entra vira uma cópia própria, encolhida e embutida na proposta. Assim, trocar a
// foto do anúncio no Mercado Livre depois não mexe na proposta que o cliente já recebeu.

export const MAX_FOTOS = 12;
const MAX_LADO = 1400;      // o suficiente para imprimir bem em A4
const QUALIDADE = 0.72;
const PESO_ALVO = 320 * 1024; // acima disso, encolhe de novo

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const pesoDoDataURL = (s) => Math.round((String(s).length - (String(s).indexOf(",") + 1)) * 0.75);
export const pesoLegivel = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export const pesoDasFotos = (imagens = []) =>
  imagens.reduce((s, i) => s + (i.src ? pesoDoDataURL(i.src) : 0), 0);

function desenhar(img, maxLado, qualidade) {
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const l = Math.max(1, Math.round(img.naturalWidth * escala));
  const a = Math.max(1, Math.round(img.naturalHeight * escala));
  const c = document.createElement("canvas");
  c.width = l;
  c.height = a;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // Fundo branco: foto com transparência não sai preta no PDF.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, l, a);
  ctx.drawImage(img, 0, 0, l, a);
  return { src: c.toDataURL("image/jpeg", qualidade), largura: l, altura: a };
}

function carregar(url, comCors) {
  return new Promise((ok, erro) => {
    const img = new Image();
    if (comCors) img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error("não consegui abrir a imagem"));
    img.src = url;
  });
}

// Encolhe até caber no peso alvo: foto de celular moderno vem com 4 a 8 MB.
async function encolher(img) {
  let r = desenhar(img, MAX_LADO, QUALIDADE);
  if (pesoDoDataURL(r.src) > PESO_ALVO) r = desenhar(img, 1100, 0.66);
  if (pesoDoDataURL(r.src) > PESO_ALVO) r = desenhar(img, 900, 0.6);
  return r;
}

export async function deArquivo(file) {
  if (!/^image\//.test(file.type)) throw new Error(`"${file.name}" não é uma imagem.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await carregar(url, false);
    const r = await encolher(img);
    return { ...r, nome: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Foto de anúncio: baixa e guarda cópia. Se o servidor da foto não deixar copiar,
// avisa em vez de guardar um link que pode mudar ou sumir depois.
export async function deEndereco(url) {
  const img = await carregar(url, true);
  try {
    return await encolher(img);
  } catch {
    throw new Error("essa foto não permite cópia; baixe e envie pelo botão de enviar fotos");
  }
}

/* ===== casar item do orçamento com anúncio do Mercado Livre ===== */

const limpar = (t) =>
  String(t || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 && !["com", "para", "the", "una", "uni", "und"].includes(p));

// Quantas palavras do item aparecem no anúncio. Exige acerto alto: foto errada numa
// proposta é pior do que foto nenhuma.
function parecenca(itemTexto, anuncioTexto) {
  const a = limpar(itemTexto);
  const b = new Set(limpar(anuncioTexto));
  if (!a.length) return 0;
  const bate = a.filter((p) => b.has(p)).length;
  return bate / a.length;
}

export function sugerirDosAnuncios(orc, anuncios = [], corte = 0.6) {
  const itens = orc?.itens || [];
  const saida = [];
  itens.forEach((item, idx) => {
    if (!item?.descricao) return;
    let melhor = null;
    anuncios.forEach((an) => {
      if (!an?.foto) return;
      const nota = parecenca(item.descricao, an.titulo);
      if (nota >= corte && (!melhor || nota > melhor.nota)) melhor = { nota, anuncio: an };
    });
    if (melhor) {
      saida.push({
        itemIndex: idx,
        itemDescricao: item.descricao,
        titulo: melhor.anuncio.titulo,
        // O thumbnail do anúncio é pequeno demais para o PDF; a versão grande é a mesma
        // imagem sem o sufixo de miniatura.
        url: String(melhor.anuncio.foto).replace(/-[IVO]\.jpg$/i, "-F.jpg"),
        nota: melhor.nota,
      });
    }
  });
  return saida;
}

/* ===== organização das fotos dentro da proposta ===== */

export const fotosDoItem = (imagens = [], idx) =>
  imagens.filter((i) => i.tipo === "produto" && i.itemIndex === idx);

export const fotosDoLocal = (imagens = []) => imagens.filter((i) => i.tipo === "local");

export const temFotos = (imagens = []) => (imagens || []).length > 0;

export function mover(imagens, id, passo) {
  const i = imagens.findIndex((x) => x.id === id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= imagens.length) return imagens;
  const copia = [...imagens];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export const legendaCompleta = (img) =>
  [img.legenda, img.ilustrativa ? "Imagem ilustrativa" : ""].filter(Boolean).join(" — ");
