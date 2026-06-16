import nodemailer from "nodemailer";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const FROM_EMAIL  = process.env.EMAIL_FROM  ?? "3D Farm <noreply@3dfarm.com>";

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   ?? "smtp.gmail.com",
    port:   Number(process.env.EMAIL_PORT ?? 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER ?? "",
      pass: process.env.EMAIL_PASS ?? "",
    },
  });
}

async function send(subject: string, html: string): Promise<void> {
  if (!ADMIN_EMAIL || !process.env.EMAIL_USER) return; // silently skip if not configured
  try {
    await createTransporter().sendMail({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject, html });
  } catch (err: any) {
    console.error("[EMAIL] Falha ao enviar e-mail:", err.message);
  }
}

function baseTemplate(title: string, color: string, body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
      <div style="background:${color};padding:20px 24px">
        <h2 style="margin:0;color:#fff;font-size:18px">${title}</h2>
      </div>
      <div style="padding:24px;color:#333;line-height:1.6">${body}</div>
      <div style="background:#f5f5f5;padding:12px 24px;font-size:12px;color:#999;text-align:center">
        3D Farm — Sistema de Gestão de Impressão 3D
      </div>
    </div>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 8px 4px 0;color:#666;width:160px">${label}</td><td style="padding:4px 0;font-weight:bold">${value}</td></tr>`;
}

function table(rows: string): string {
  return `<table style="border-collapse:collapse;width:100%;margin-top:12px">${rows}</table>`;
}

// ── Pedido aguardando revisão ─────────────────────────────────────────────────
export async function emailRevisaoPendente(pedido: {
  id: number; nome: string; nomeUsuario?: string; emailUsuario?: string;
  preco: number; scoreComplexidade: number; motivoComplexidade?: string;
}): Promise<void> {
  const score = (pedido.scoreComplexidade * 100).toFixed(1);
  const body  = `
    <p>Um pedido com <strong>alta complexidade</strong> precisa da sua aprovação antes de prosseguir para pagamento.</p>
    ${table(
      row("ID do Pedido",     `#${pedido.id}`) +
      row("Nome",             pedido.nome) +
      row("Cliente",          `${pedido.nomeUsuario ?? "—"} (${pedido.emailUsuario ?? "—"})`) +
      row("Preço calculado",  `R$ ${pedido.preco.toFixed(2)}`) +
      row("Score complexidade", `${score}%`) +
      row("Fatores",          pedido.motivoComplexidade ?? "—")
    )}
    <p style="margin-top:20px">
      <a href="http://localhost:5173/admin/quotes" style="background:#ff9800;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Revisar pedido
      </a>
    </p>`;
  await send(`[3D Farm] Revisão pendente: ${pedido.nome}`, baseTemplate("⚠️ Pedido aguardando revisão", "#ff9800", body));
}

// ── Pedido falhou ─────────────────────────────────────────────────────────────
export async function emailPedidoFalhou(pedido: {
  id: number; nome: string; nomeUsuario?: string; emailUsuario?: string;
  motivo?: string;
}): Promise<void> {
  const body = `
    <p>O pipeline de análise de um pedido <strong>falhou</strong>. O cliente foi impactado.</p>
    ${table(
      row("ID do Pedido", `#${pedido.id}`) +
      row("Nome",         pedido.nome) +
      row("Cliente",      `${pedido.nomeUsuario ?? "—"} (${pedido.emailUsuario ?? "—"})`) +
      row("Motivo",       pedido.motivo ?? "Erro desconhecido")
    )}
    <p style="margin-top:20px">
      <a href="http://localhost:5173/admin/orders" style="background:#f44336;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver pedidos
      </a>
    </p>`;
  await send(`[3D Farm] Falha no pedido #${pedido.id}: ${pedido.nome}`, baseTemplate("❌ Falha no pipeline", "#f44336", body));
}

// ── Pedido concluído ──────────────────────────────────────────────────────────
export async function emailPedidoConcluido(pedido: {
  id: number; nome: string; nomeUsuario?: string; emailUsuario?: string;
  preco: number; tempoEstimadoS?: number | null; materialGramas?: number | null;
}): Promise<void> {
  const tempo = pedido.tempoEstimadoS
    ? (() => { const h = Math.floor(pedido.tempoEstimadoS! / 3600); const m = Math.floor((pedido.tempoEstimadoS! % 3600) / 60); return h > 0 ? `${h}h ${m}min` : `${m}min`; })()
    : "—";
  const body = `
    <p>Um pedido foi <strong>concluído com sucesso</strong>.</p>
    ${table(
      row("ID do Pedido",    `#${pedido.id}`) +
      row("Nome",            pedido.nome) +
      row("Cliente",         `${pedido.nomeUsuario ?? "—"} (${pedido.emailUsuario ?? "—"})`) +
      row("Valor",           `R$ ${pedido.preco.toFixed(2)}`) +
      row("Tempo impresso",  tempo) +
      row("Material usado",  pedido.materialGramas ? `${Number(pedido.materialGramas).toFixed(1)}g` : "—")
    )}`;
  await send(`[3D Farm] Pedido concluído: ${pedido.nome}`, baseTemplate("✅ Pedido concluído", "#4caf50", body));
}

// ── Impressora com erro ───────────────────────────────────────────────────────
export async function emailImpressoraErro(impressora: {
  id: number; nome: string; modelo: string; ultimoErro?: string | null;
}): Promise<void> {
  const body = `
    <p>Uma impressora entrou em <strong>estado de erro</strong> e pode precisar de atenção.</p>
    ${table(
      row("Impressora", impressora.nome) +
      row("Modelo",     impressora.modelo) +
      row("Erro",       impressora.ultimoErro ?? "Desconhecido")
    )}
    <p style="margin-top:20px">
      <a href="http://localhost:5173/admin/printers" style="background:#f44336;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver impressoras
      </a>
    </p>`;
  await send(`[3D Farm] Impressora com erro: ${impressora.nome}`, baseTemplate("🖨️ Erro na impressora", "#f44336", body));
}
