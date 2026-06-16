import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Card, CardContent, CircularProgress, Alert,
  Tabs, Tab, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, Divider, LinearProgress, Badge,
  IconButton, TextField,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import ReplayIcon from '@mui/icons-material/Replay';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import api from '../services/api';
import type { Pedido } from '../types/Pedido';
import type { Impressora } from '../types/Impressora';
import { getStatusTranslation, getStatusColor } from '../utils/translations';
import { normalizePedido } from '../utils/normalize';
import { ChatDialog } from '../components/ChatDialog';
import { useNavigate } from 'react-router-dom';

// Somente pedidos que já foram pagos
const PAID_STATUSES: Pedido['status'][] = ['na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado'];

interface ProgressoData {
  progressoPct: number | null;
  tempoRestanteS: number | null;
  statusFisico: string;
}

function formatRestante(s: number): string {
  if (s < 60) return `~${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `~${m}min`;
  const h = Math.floor(m / 60);
  return `~${h}h ${m % 60}min`;
}

function formatEta(date: Date): string {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getDeadline(
  p: Pedido,
  naFilaList: Pedido[],
  printerByPedido: Map<number, Impressora>,
  progressoMap: Record<number, ProgressoData>,
): string | null {
  if (p.status === 'em_impressao') {
    const imp = printerByPedido.get(p.id);
    const prog = imp ? progressoMap[imp.id] : null;
    if (prog?.tempoRestanteS && prog.tempoRestanteS > 0) {
      return `Previsão: ${formatEta(new Date(Date.now() + prog.tempoRestanteS * 1000))}`;
    }
    if (p.tempoEstimadoS) {
      const started = new Date(p.updatedAt);
      const eta = new Date(started.getTime() + p.tempoEstimadoS * 1000);
      if (eta > new Date()) return `Previsão: ${formatEta(eta)}`;
    }
  }
  if (p.status === 'na_fila') {
    const pos = naFilaList.findIndex(x => x.id === p.id);
    if (pos >= 0) {
      const horasEstimadas = (pos + 1) * 4;
      const eta = new Date(Date.now() + horasEstimadas * 3600 * 1000);
      return `Estimativa: ${formatEta(eta)} (posição ${pos + 1} na fila)`;
    }
  }
  return null;
}

function PedidoCard({
  p, progresso, unreadCount, hasChat,
  naFilaList, printerByPedido, progressoMap,
  onView, onChat, onPedirNovamente,
}: {
  p: Pedido;
  progresso: ProgressoData | null;
  unreadCount: number;
  hasChat: boolean;
  naFilaList: Pedido[];
  printerByPedido: Map<number, Impressora>;
  progressoMap: Record<number, ProgressoData>;
  onView: (x: Pedido) => void;
  onChat: (x: Pedido) => void;
  onPedirNovamente: (x: Pedido) => void;
}) {
  const pct      = progresso?.progressoPct;
  const restante = progresso?.tempoRestanteS;
  const nivelando = pct === 0 && progresso?.statusFisico === 'printing';
  const deadline = getDeadline(p, naFilaList, printerByPedido, progressoMap);

  return (
    <Card
      sx={{ mb: 2, cursor: 'pointer', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
      elevation={0}
      onClick={() => onView(p)}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={600}>{p.nome}</Typography>
          <Box display="flex" gap={1} alignItems="center">
            {hasChat && (
              <Badge badgeContent={unreadCount || 0} color="error">
                <IconButton
                  size="small"
                  color={unreadCount > 0 ? 'primary' : 'default'}
                  title="Abrir mensagens"
                  onClick={e => { e.stopPropagation(); onChat(p); }}
                >
                  <ChatIcon fontSize="small" />
                </IconButton>
              </Badge>
            )}
            <Chip size="small" label={getStatusTranslation(p.status)} color={getStatusColor(p.status)} />
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {new Date(p.createdAt).toLocaleDateString('pt-BR')}
          {p.nomeMaterial ? ` · ${p.nomeMaterial}` : ''}
          {p.preco > 0 ? ` · R$ ${p.preco.toFixed(2)}` : ''}
          {p.quantidade > 1 ? ` · ${p.quantidade}x` : ''}
        </Typography>

        {/* Progresso — barra determinística, sem indeterminate */}
        {p.status === 'em_impressao' && (
          <Box sx={{ mt: 1.5 }}>
            {nivelando ? (
              <>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="primary.main" fontWeight={600}>Nivelando mesa...</Typography>
                  <Typography variant="caption" color="text.secondary">preparando</Typography>
                </Box>
                <LinearProgress variant="indeterminate" sx={{ height: 6, borderRadius: 3 }} />
              </>
            ) : pct != null && pct > 0 ? (
              <>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="caption" color="primary.main" fontWeight={600}>Imprimindo</Typography>
                  <Box display="flex" gap={1} alignItems="center">
                    {restante != null && restante > 0 && (
                      <Typography variant="caption" color="text.secondary">{formatRestante(restante)}</Typography>
                    )}
                    <Typography variant="caption" fontWeight={700} color="primary.main">{pct.toFixed(0)}%</Typography>
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">Imprimindo — aguardando dados da impressora</Typography>
            )}
          </Box>
        )}

        {/* Prazo estimado */}
        {deadline && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            🕐 {deadline}
          </Typography>
        )}

        {p.status === 'na_fila' && !deadline && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Na fila · aguardando impressora disponível
          </Typography>
        )}

        {/* Botão pedir novamente em concluídos */}
        {p.status === 'concluido' && (
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplayIcon />}
              onClick={e => { e.stopPropagation(); onPedirNovamente(p); }}
            >
              Pedir novamente
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos]           = useState<Pedido[]>([]);
  const [impressoras, setImpressoras]   = useState<Impressora[]>([]);
  const [progressoMap, setProgressoMap] = useState<Record<number, ProgressoData>>({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [tab, setTab]                   = useState(0);
  const [sel, setSel]                   = useState<Pedido | null>(null);

  const [unreadMap, setUnreadMap]     = useState<Record<number, number>>({});
  const [hasChatMap, setHasChatMap]   = useState<Record<number, boolean>>({});
  const [chatPedido, setChatPedido]   = useState<{ id: number; nome: string } | null>(null);

  // Dialog "pedir novamente"
  const [reorderPedido, setReorderPedido] = useState<Pedido | null>(null);
  const [reorderQtd, setReorderQtd]       = useState(1);
  const [reordering, setReordering]       = useState(false);

  const fetchUnreadResumo = useCallback(async () => {
    try {
      const { data } = await api.get<{ idPedido: number; count: number }[]>('/pedidos/mensagens/resumo');
      setUnreadMap(prev => {
        const next = { ...prev };
        data.forEach(({ idPedido, count }) => { next[idPedido] = count; });
        return next;
      });
      setHasChatMap(prev => {
        const next = { ...prev };
        data.forEach(({ idPedido, count }) => { if (count > 0) next[idPedido] = true; });
        return next;
      });
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/pedidos').then(r => r.data.map(normalizePedido)),
      api.get<Impressora[]>('/impressoras').then(r => r.data).catch(() => [] as Impressora[]),
    ])
      .then(([p, i]) => {
        setPedidos(p.filter((x: Pedido) => PAID_STATUSES.includes(x.status)));
        setImpressoras(i);
        fetchUnreadResumo();
      })
      .catch(() => setError('Erro ao buscar pedidos.'))
      .finally(() => setLoading(false));
  }, [fetchUnreadResumo]);

  useEffect(() => {
    const id = setInterval(fetchUnreadResumo, 10_000);
    return () => clearInterval(id);
  }, [fetchUnreadResumo]);

  const printerByPedido = React.useMemo(() => {
    const m = new Map<number, Impressora>();
    impressoras.forEach(imp => { if (imp.idPedidoAtual) m.set(imp.idPedidoAtual, imp); });
    return m;
  }, [impressoras]);

  const pollProgress = useCallback(async () => {
    const ativos = pedidos
      .filter(p => p.status === 'em_impressao')
      .map(p => printerByPedido.get(p.id))
      .filter((imp): imp is Impressora => imp != null);
    if (ativos.length === 0) return;
    const results = await Promise.allSettled(
      ativos.map(imp =>
        api.get<ProgressoData>(`/impressoras/${imp.id}/progresso`)
           .then(r => ({ impressoraId: imp.id, data: r.data }))
      )
    );
    setProgressoMap(prev => {
      const next = { ...prev };
      results.forEach(r => { if (r.status === 'fulfilled') next[r.value.impressoraId] = r.value.data; });
      return next;
    });
  }, [pedidos, printerByPedido]);

  useEffect(() => {
    if (!pedidos.some(p => p.status === 'em_impressao')) return;
    pollProgress();
    const id = setInterval(pollProgress, 10_000);
    return () => clearInterval(id);
  }, [pedidos, pollProgress]);

  const getProgresso = (pedidoId: number): ProgressoData | null => {
    const imp = printerByPedido.get(pedidoId);
    return imp ? (progressoMap[imp.id] ?? null) : null;
  };

  const openChat = (p: Pedido) => setChatPedido({ id: p.id, nome: p.nome });

  const closeChat = () => {
    if (chatPedido) {
      setHasChatMap(prev => ({ ...prev, [chatPedido.id]: true }));
      setUnreadMap(prev => ({ ...prev, [chatPedido.id]: 0 }));
    }
    setChatPedido(null);
    fetchUnreadResumo();
  };

  const handlePedirNovamente = async () => {
    if (!reorderPedido) return;
    setReordering(true);
    try {
      await api.post('/pedidos', {
        nome:        reorderPedido.nome,
        preco:       0,
        descricao:   reorderPedido.descricao,
        idMaterial:  reorderPedido.idMaterial,
        idQualidade: reorderPedido.idQualidade,
        idArquivo:   reorderPedido.idArquivo,
        quantidade:  reorderQtd,
      });
      setReorderPedido(null);
      navigate('/quotes');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao criar pedido.');
    } finally {
      setReordering(false);
    }
  };

  const naFila = pedidos
    .filter(p => p.status === 'na_fila')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const emImpressao = pedidos
    .filter(p => p.status === 'em_impressao')
    .sort((a, b) => {
      const pa = getProgresso(a.id)?.progressoPct ?? -1;
      const pb = getProgresso(b.id)?.progressoPct ?? -1;
      return pb !== pa ? pb - pa : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

  const groups = {
    andamento: [...emImpressao, ...naFila],
    concluido: pedidos.filter(p => p.status === 'concluido'),
    falha:     pedidos.filter(p => p.status === 'falhou' || p.status === 'cancelado'),
  };

  const lists  = [groups.andamento, groups.concluido, groups.falha];
  const labels = [
    `Em andamento (${groups.andamento.length})`,
    `Concluídos (${groups.concluido.length})`,
    `Falhas/Cancelados (${groups.falha.length})`,
  ];

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Meus Pedidos</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {labels.map(l => <Tab key={l} label={l} />)}
      </Tabs>

      {lists[tab].length === 0 ? (
        <Typography color="text.secondary">Nenhum pedido aqui ainda.</Typography>
      ) : (
        lists[tab].map(p => (
          <PedidoCard
            key={p.id}
            p={p}
            progresso={p.status === 'em_impressao' ? getProgresso(p.id) : null}
            unreadCount={unreadMap[p.id] ?? 0}
            hasChat={hasChatMap[p.id] ?? false}
            naFilaList={naFila}
            printerByPedido={printerByPedido}
            progressoMap={progressoMap}
            onView={p => setSel(p)}
            onChat={openChat}
            onPedirNovamente={p => { setReorderPedido(p); setReorderQtd(p.quantidade || 1); }}
          />
        ))
      )}

      {/* Dialog detalhes */}
      {sel && (
        <Dialog open onClose={() => setSel(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{sel.nome}</DialogTitle>
          <DialogContent dividers>
            <List dense>
              <ListItem>
                <ListItemText primary="Status" secondary={getStatusTranslation(sel.status)} />
              </ListItem>
              {sel.status === 'em_impressao' && getProgresso(sel.id)?.progressoPct != null && getProgresso(sel.id)!.progressoPct! > 0 && (
                <ListItem>
                  <ListItemText
                    primary="Progresso de impressão"
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Box display="flex" justifyContent="space-between" mb={0.3}>
                          <span>{getProgresso(sel.id)!.progressoPct!.toFixed(0)}%</span>
                          {getProgresso(sel.id)?.tempoRestanteS != null && (
                            <span>{formatRestante(getProgresso(sel.id)!.tempoRestanteS!)} restante</span>
                          )}
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={getProgresso(sel.id)!.progressoPct!}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              )}
              {/* Prazo no dialog */}
              {(() => {
                const dl = getDeadline(sel, naFila, printerByPedido, progressoMap);
                return dl ? (
                  <ListItem>
                    <ListItemText primary="Prazo estimado" secondary={dl} />
                  </ListItem>
                ) : null;
              })()}
              <ListItem>
                <ListItemText primary="Material" secondary={sel.nomeMaterial ?? '—'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Arquivo" secondary={sel.nomeArquivo ?? '—'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Quantidade" secondary={`${sel.quantidade} unidade${sel.quantidade > 1 ? 's' : ''}`} />
              </ListItem>
              <Divider component="li" />
              {sel.preco > 0 && (
                <ListItem>
                  <ListItemText primary="Valor pago" secondary={`R$ ${sel.preco.toFixed(2)}`} />
                </ListItem>
              )}
              {/* Justificativa para falha/cancelamento */}
              {(sel.status === 'falhou' || sel.status === 'cancelado') && sel.descricao && (
                <ListItem sx={{ bgcolor: 'warning.50', borderRadius: 1 }}>
                  <ListItemText
                    primary={sel.status === 'falhou' ? 'Motivo da falha' : 'Motivo do cancelamento'}
                    secondary={sel.descricao}
                    primaryTypographyProps={{ color: 'warning.dark', fontWeight: 600 }}
                  />
                </ListItem>
              )}
              {sel.descricao && sel.status !== 'falhou' && sel.status !== 'cancelado' && (
                <ListItem>
                  <ListItemText primary="Obs" secondary={sel.descricao} />
                </ListItem>
              )}
              <ListItem>
                <ListItemText primary="Criado em" secondary={new Date(sel.createdAt).toLocaleString('pt-BR')} />
              </ListItem>
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSel(null)}>Fechar</Button>
            {sel.status === 'concluido' && (
              <Button
                variant="outlined"
                startIcon={<ReplayIcon />}
                onClick={() => { setSel(null); setReorderPedido(sel); setReorderQtd(sel.quantidade || 1); }}
              >
                Pedir novamente
              </Button>
            )}
            {hasChatMap[sel.id] && (
              <Badge badgeContent={unreadMap[sel.id] || 0} color="error">
                <Button
                  variant="outlined"
                  startIcon={<ChatIcon />}
                  onClick={() => { setSel(null); openChat(sel); }}
                >
                  Mensagens
                </Button>
              </Badge>
            )}
          </DialogActions>
        </Dialog>
      )}

      {/* Dialog pedir novamente */}
      {reorderPedido && (
        <Dialog open onClose={() => setReorderPedido(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Pedir novamente</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {reorderPedido.nome}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Mesmo material e qualidade do pedido original. Altere a quantidade se necessário.
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton
                size="small"
                onClick={() => setReorderQtd(q => Math.max(1, q - 1))}
                disabled={reorderQtd <= 1}
              >
                <RemoveIcon />
              </IconButton>
              <TextField
                type="number"
                value={reorderQtd}
                onChange={e => setReorderQtd(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1 }}
                sx={{ width: 80 }}
                size="small"
                label="Quantidade"
              />
              <IconButton size="small" onClick={() => setReorderQtd(q => q + 1)}>
                <AddIcon />
              </IconButton>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReorderPedido(null)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={handlePedirNovamente}
              disabled={reordering}
              startIcon={reordering ? <CircularProgress size={16} color="inherit" /> : <ReplayIcon />}
            >
              Confirmar pedido
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <ChatDialog
        pedidoId={chatPedido?.id ?? 0}
        pedidoNome={chatPedido?.nome ?? ''}
        meuTipo="client"
        open={chatPedido !== null}
        onClose={closeChat}
      />
    </Container>
  );
}
