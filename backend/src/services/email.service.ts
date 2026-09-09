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
  if (!ADMIN_EMAIL || !process.env.EMAIL_USER) {
    console.log(`[EMAIL] SMTP não configurado — enviaria ao admin (${ADMIN_EMAIL || "sem ADMIN_EMAIL"}): "${subject}"`);
    return;
  }
  try {
    await createTransporter().sendMail({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject, html });
  } catch (err: any) {
    console.error("[EMAIL] Falha ao enviar e-mail:", err.message);
  }
}

async function sendTo(to: string, subject: string, html: string): Promise<void> {
  if (!to || !process.env.EMAIL_USER) {
    console.log(`[EMAIL] SMTP não configurado — enviaria para ${to || "(sem destinatário)"}: "${subject}"`);
    return;
  }
  try {
    await createTransporter().sendMail({ from: FROM_EMAIL, to, subject, html });
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

export async function emailClientePedidoCancelado(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string; motivo?: string;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Seu pedido <strong>${pedido.nome}</strong> foi cancelado.</p>
    ${pedido.motivo ? table(row("Motivo", pedido.motivo)) : ''}
    <p style="margin-top:16px">Se isso foi um engano ou você tem dúvidas, entre em contato com a gente.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard"
         style="background:#757575;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver Meus Pedidos
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Pedido cancelado: ${pedido.nome}`,
    baseTemplate("🚫 Pedido cancelado", "#757575", body),
  );
}

export async function emailClientePedidoEmRevisao(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Sua peça <strong>${pedido.nome}</strong> tem uma geometria mais complexa e precisa passar por uma revisão rápida da nossa equipe antes de seguir para o pagamento.</p>
    <p>Assim que a revisão terminar, o orçamento fica disponível no seu painel e você recebe um novo aviso por e-mail.</p>
    <p style="margin-top:16px">Você pode acompanhar o status do pedido a qualquer momento pelo link abaixo.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/quotes"
         style="background:#ff9800;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver Meus Orçamentos
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Seu pedido está em revisão: ${pedido.nome}`,
    baseTemplate("🔍 Pedido em revisão", "#ff9800", body),
  );
}

export async function emailClienteOrcamentoPronto(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string; preco: number;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>O orçamento da sua peça <strong>${pedido.nome}</strong> ficou pronto: <strong>R$ ${Number(pedido.preco).toFixed(2)}</strong>.</p>
    <p style="margin-top:16px">Finalize o pagamento para que sua peça entre na fila de impressão.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/quotes"
         style="background:#2196f3;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver e Pagar Orçamento
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Orçamento pronto: ${pedido.nome}`,
    baseTemplate("💰 Orçamento pronto para pagamento", "#2196f3", body),
  );
}

export async function emailClientePedidoNaFila(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Recebemos a confirmação do seu pagamento. Sua peça <strong>${pedido.nome}</strong> entrou na fila de impressão.</p>
    <p style="margin-top:16px">Você pode acompanhar a posição e o andamento do seu pedido pelo painel.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard"
         style="background:#3f51b5;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver Meus Pedidos
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Pedido na fila de impressão: ${pedido.nome}`,
    baseTemplate("📋 Pedido na fila de impressão", "#3f51b5", body),
  );
}

export async function emailClienteImpressaoIniciada(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Boas notícias: sua peça <strong>${pedido.nome}</strong> começou a ser impressa agora!</p>
    <p style="margin-top:16px">Assim que a impressão terminar, você recebe um novo aviso por aqui.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard"
         style="background:#009688;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Acompanhar Pedido
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Sua peça está sendo impressa: ${pedido.nome}`,
    baseTemplate("🖨️ Impressão iniciada", "#009688", body),
  );
}

export async function emailClienteCopiaConcluida(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string;
  copiaAtual: number; totalCopias: number;
}): Promise<void> {
  const restantes = pedido.totalCopias - pedido.copiaAtual;
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Mais uma unidade da sua peça <strong>${pedido.nome}</strong> acabou de sair da impressora:
    <strong>${pedido.copiaAtual} de ${pedido.totalCopias} prontas</strong>.</p>
    <p style="margin-top:16px">${
      restantes > 0
        ? `Faltam ${restantes} unidade${restantes > 1 ? 's' : ''}. Assim que a impressora ficar livre, a próxima entra pra imprimir automaticamente.`
        : 'Essa era a última unidade — seu pedido está completo!'
    }</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard"
         style="background:#009688;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Acompanhar Pedido
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] ${pedido.copiaAtual} de ${pedido.totalCopias} prontas: ${pedido.nome}`,
    baseTemplate("🖨️ Uma unidade concluída", "#009688", body),
  );
}

export async function emailClientePedidoFalhou(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string; motivo?: string;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Infelizmente não conseguimos processar sua peça <strong>${pedido.nome}</strong>. Nossa equipe já foi notificada e vai analisar o problema.</p>
    ${table(row("Detalhe técnico", pedido.motivo ?? "Erro desconhecido"))}
    <p style="margin-top:16px">Você pode acompanhar o status pelo seu painel, ou entrar em contato com a gente pra resolvermos juntos.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard"
         style="background:#f44336;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver Meus Pedidos
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Houve um problema com sua peça: ${pedido.nome}`,
    baseTemplate("❌ Não foi possível processar sua peça", "#f44336", body),
  );
}

export async function emailAguardandoFilamento(pedido: {
  id: number; nome: string; nomeUsuario?: string; emailUsuario?: string;
  impressora: string; motivo: string;
}): Promise<void> {
  const body = `
    <p>Um pedido está <strong>aguardando troca manual de filamento</strong> e não será atribuído automaticamente até a intervenção do operador.</p>
    ${table(
      row("ID do Pedido", `#${pedido.id}`) +
      row("Nome",         pedido.nome) +
      row("Cliente",      `${pedido.nomeUsuario ?? "—"} (${pedido.emailUsuario ?? "—"})`) +
      row("Impressora",   pedido.impressora) +
      row("Detalhe",      pedido.motivo)
    )}
    <p style="margin-top:20px">
      <a href="http://localhost:5173/admin/printers" style="background:#ff9800;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver impressoras
      </a>
    </p>`;
  await send(`[3D Farm] Troca de filamento necessária: ${pedido.nome}`, baseTemplate("🧵 Aguardando troca de filamento", "#ff9800", body));
}

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
      row("Valor",           `R$ ${Number(pedido.preco).toFixed(2)}`) +
      row("Tempo impresso",  tempo) +
      row("Material usado",  pedido.materialGramas ? `${Number(pedido.materialGramas).toFixed(1)}g` : "—")
    )}`;
  await send(`[3D Farm] Pedido concluído: ${pedido.nome}`, baseTemplate("✅ Pedido concluído", "#4caf50", body));
}

export async function emailClientePecaPronta(pedido: {
  nome: string; emailUsuario: string; nomeUsuario?: string;
}): Promise<void> {
  const body = `
    <p>Olá${pedido.nomeUsuario ? ` <strong>${pedido.nomeUsuario}</strong>` : ''}!</p>
    <p>Sua peça <strong>${pedido.nome}</strong> foi concluída com sucesso e está pronta para retirada.</p>
    <p>Entre em contato conosco para combinar a retirada da sua peça.</p>
    <p style="margin-top:20px">
      <a href="${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard"
         style="background:#4caf50;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold">
        Ver Meus Pedidos
      </a>
    </p>`;
  await sendTo(
    pedido.emailUsuario,
    `[3D Farm] Sua peça está pronta para retirada: ${pedido.nome}`,
    baseTemplate("✅ Peça pronta para retirada!", "#4caf50", body),
  );
}

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
