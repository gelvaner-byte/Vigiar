// Desenha as artes do Instagram no próprio navegador, em 1080 x 1350 (feed).
// Sem serviço externo e sem custo: o agente escreve o texto, isto vira imagem de verdade,
// pronta para baixar e publicar.

export const L = 1080;
export const A = 1350;

const FONTE = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

/* ===== texto que cabe ===== */

function quebrar(ctx, texto, largura) {
  const linhas = [];
  String(texto || "").split("\n").forEach((paragrafo) => {
    let linha = "";
    paragrafo.split(/\s+/).filter(Boolean).forEach((palavra) => {
      const teste = linha ? `${linha} ${palavra}` : palavra;
      if (ctx.measureText(teste).width > largura && linha) {
        linhas.push(linha);
        linha = palavra;
      } else {
        linha = teste;
      }
    });
    linhas.push(linha);
  });
  return linhas;
}

// Diminui a fonte até o texto caber na caixa. Texto cortado no feed é pior que fonte menor.
function escreverCaixa(ctx, texto, { x, y, largura, altura, tamanho, minimo = 28, peso = "800", cor, entrelinha = 1.22, centro = false }) {
  let t = tamanho;
  let linhas = [];
  for (; t >= minimo; t -= 2) {
    ctx.font = `${peso} ${t}px ${FONTE}`;
    linhas = quebrar(ctx, texto, largura);
    if (linhas.length * t * entrelinha <= altura) break;
  }
  ctx.fillStyle = cor;
  ctx.textAlign = centro ? "center" : "left";
  ctx.textBaseline = "top";
  const px = centro ? x + largura / 2 : x;
  linhas.forEach((linha, i) => ctx.fillText(linha, px, y + i * t * entrelinha));
  return y + linhas.length * t * entrelinha;
}

/* ===== peças ===== */

function fundo(ctx, marca, foto) {
  ctx.fillStyle = marca.corFundo;
  ctx.fillRect(0, 0, L, A);

  if (foto) {
    // Cobre a arte inteira sem distorcer, e escurece para o texto ficar legível.
    const escala = Math.max(L / foto.width, A / foto.height);
    const l = foto.width * escala;
    const a = foto.height * escala;
    ctx.drawImage(foto, (L - l) / 2, (A - a) / 2, l, a);
    const g = ctx.createLinearGradient(0, 0, 0, A);
    g.addColorStop(0, "rgba(10,16,26,.92)");
    g.addColorStop(0.45, "rgba(10,16,26,.55)");
    g.addColorStop(1, "rgba(10,16,26,.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
  } else {
    // Sem foto: um brilho da cor da marca, para não ficar um retângulo chapado.
    const g = ctx.createRadialGradient(L * 0.78, A * 0.12, 40, L * 0.78, A * 0.12, A * 0.9);
    g.addColorStop(0, `${marca.corDestaque}44`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
  }
}

function faixaMarca(ctx, marca, logo) {
  const y = A - 132;
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.fillRect(0, y, L, 132);
  ctx.fillStyle = marca.corDestaque;
  ctx.fillRect(0, y, L, 6);

  let x = 72;
  if (logo) {
    const lado = 64;
    ctx.drawImage(logo, x, y + 34, lado, lado);
    x += lado + 20;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = marca.corTexto;
  ctx.font = `800 34px ${FONTE}`;
  ctx.fillText(marca.nome, x, y + 62);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = `600 22px ${FONTE}`;
  const rodape = [marca.cidade, marca.telefone].filter(Boolean).join("  ·  ");
  ctx.fillText(rodape, x, y + 96);
}

function selo(ctx, texto, marca) {
  ctx.font = `800 24px ${FONTE}`;
  const w = ctx.measureText(texto).width + 44;
  ctx.fillStyle = marca.corDestaque;
  const x = 72;
  const y = 88;
  const r = 24;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + 48, r);
  ctx.arcTo(x + w, y + 48, x, y + 48, r);
  ctx.arcTo(x, y + 48, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x + 22, y + 25);
}

function numeroDoCard(ctx, i, total, marca) {
  if (total < 2) return;
  const texto = `${i + 1}/${total}`;
  ctx.font = `800 26px ${FONTE}`;
  const w = ctx.measureText(texto).width + 36;
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.beginPath();
  ctx.roundRect(L - 72 - w, 88, w, 48, 24);
  ctx.fill();
  ctx.fillStyle = marca.corTexto;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, L - 72 - w / 2, 113);
}

function avisoIlustrativa(ctx) {
  ctx.font = `600 19px ${FONTE}`;
  ctx.fillStyle = "rgba(255,255,255,.66)";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Imagem ilustrativa", L - 72, A - 152);
}

function setaDeslizar(ctx, marca) {
  ctx.font = `700 22px ${FONTE}`;
  ctx.fillStyle = marca.corDestaque;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("arrasta  →", L - 72, A - 152);
}

/* ===== um card ===== */

export function desenharCard(card, { marca, foto, logo, indice = 0, total = 1 }) {
  const c = document.createElement("canvas");
  c.width = L;
  c.height = A;
  const ctx = c.getContext("2d");
  if (!ctx.roundRect) {
    ctx.roundRect = function (x, y, w, h, r) { this.rect(x, y, w, h); };
  }

  fundo(ctx, marca, foto);
  if (card.selo) selo(ctx, String(card.selo).toUpperCase(), marca);
  numeroDoCard(ctx, indice, total, marca);

  const margem = 72;
  const larg = L - margem * 2;
  let y = 196;

  if (card.titulo) {
    y = escreverCaixa(ctx, card.titulo, {
      x: margem, y, largura: larg, altura: 430,
      tamanho: 86, minimo: 46, peso: "800", cor: marca.corTexto, entrelinha: 1.14,
    }) + 30;
  }
  if (card.texto) {
    escreverCaixa(ctx, card.texto, {
      x: margem, y, largura: larg, altura: A - y - 210,
      tamanho: 44, minimo: 28, peso: "500", cor: "rgba(255,255,255,.9)", entrelinha: 1.4,
    });
  }

  if (card.ilustrativa) avisoIlustrativa(ctx);
  else if (indice === 0 && total > 1) setaDeslizar(ctx, marca);

  faixaMarca(ctx, marca, logo);
  return c.toDataURL("image/jpeg", 0.9);
}

/* ===== carrega foto/logo para dentro do canvas ===== */

export function carregarImagem(src) {
  return new Promise((ok, erro) => {
    if (!src) return ok(null);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);   // foto quebrada não derruba a arte
    img.src = src;
    if (erro) { /* mantém a assinatura simples */ }
  });
}

// Monta todas as artes do post. Cada card pode ter a sua foto.
export async function montarArtes(post, marca, midias = []) {
  const logo = await carregarImagem(marca.logo);
  const cards = post.cards || [];
  const saida = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const midia = card.midiaId ? midias.find((m) => m.id === card.midiaId) : null;
    const foto = await carregarImagem(midia?.src || null);
    saida.push({
      indice: i,
      nome: `vigiar-${post.data}-${String(i + 1).padStart(2, "0")}.jpg`,
      src: desenharCard({ ...card, ilustrativa: card.ilustrativa || midia?.ilustrativa }, {
        marca, foto, logo, indice: i, total: cards.length,
      }),
    });
  }
  return saida;
}

export function baixar(nome, dataURL) {
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Baixar todas: uma de cada vez, com respiro, porque o navegador bloqueia rajada.
export async function baixarTodas(artes) {
  for (const art of artes) {
    baixar(art.nome, art.src);
    await new Promise((r) => setTimeout(r, 350));
  }
}
