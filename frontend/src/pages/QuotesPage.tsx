import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Card, CardContent, CardActions,
  CircularProgress, Alert, Chip, Divider, Button, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Tabs, Tab,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaymentIcon from '@mui/icons-material/Payment';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import api from '../services/api';
import type { Pedido } from '../types/Pedido';
import { getStatusTranslation, getStatusColor } from '../utils/translations';
import { normalizePedido } from '../utils/normalize';
import { useAuth } from '../context/AuthContext';

function formatTime(s: number | null): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function n(v: number | null | undefined): number {
  return Number(v ?? 0);
}

export function QuotesPage() {
  const { nivel } = useAuth();
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [sel, setSel]               = useState<Pedido | null>(null);
  const [paying, setPaying]         = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [tab, setTab]               = useState(0);

  const fetchPedidos = useCallback(() => {
    api.get<any[]>('/pedidos')
      .then(r => {
        const all = r.data.map((p: any) => normalizePedido(p) as Pedido);

        const VISIBLE: Pedido['status'][] = ['analisando', 'aguardando_pagamento', 'aguardando_revisao'];
        setPedidos(
          all
            .filter((p: Pedido) => VISIBLE.includes(p.status))
            .sort((a: Pedido, b: Pedido) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )
        );
      })
      .catch(() => setError('Erro ao buscar orçamentos.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 5000);
    return () => clearInterval(interval);
  }, [fetchPedidos]);

  const handlePagar = async (id: number) => {
    setPaying(id);
    try {
      const { data } = await api.post(`/pedidos/${id}/checkout`);
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao iniciar pagamento.');
      setPaying(null);
    }
  };

  const handleCancelar = async (id: number) => {
    if (!confirm('Cancelar este orçamento?')) return;
    setCancelling(id);
    try {
      await api.put(`/pedidos/${id}`, { status: 'cancelado' });
      fetchPedidos();
    } catch { setError('Erro ao cancelar.'); }
    finally { setCancelling(null); }
  };

  const aguardandoPagamento = pedidos.filter(p => p.status === 'aguardando_pagamento');
  const emRevisao = pedidos.filter(p => p.status === 'aguardando_revisao' || p.status === 'analisando');

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  const renderCard = (p: Pedido) => (
    <Card key={p.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="h6" fontWeight={600}>{p.nome}</Typography>
          <Chip label={getStatusTranslation(p.status)} color={getStatusColor(p.status)} size="small" />
        </Box>

        {/* Analisando */}
        {p.status === 'analisando' && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Fatiando modelo e calculando orçamento...
            </Typography>
            <LinearProgress variant="indeterminate" sx={{ borderRadius: 2 }} />
          </Box>
        )}

        {/* Em revisão — não mostra preço */}
        {p.status === 'aguardando_revisao' && (
          <Alert
            severity="warning"
            icon={<HourglassEmptyIcon fontSize="inherit" />}
            sx={{ mt: 1.5, borderRadius: 2 }}
          >
            Sua peça é complexa e está sendo revisada pelo administrador. O valor será confirmado em breve.
          </Alert>
        )}

        {/* Aguardando pagamento — mostra preço e detalhes */}
        {p.status === 'aguardando_pagamento' && p.preco > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="h4" color="primary" fontWeight={800}>
              R$ {p.preco.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Prazo de entrega calculado ao entrar na fila, após o pagamento.
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          Enviado em: {new Date(p.createdAt).toLocaleString('pt-BR')}
          {p.nomeMaterial ? ` · ${p.nomeMaterial}` : ''}
        </Typography>
      </CardContent>

      {/* Botão de pagamento proeminente */}
      {p.status === 'aguardando_pagamento' && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            startIcon={paying === p.id ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
            onClick={() => handlePagar(p.id)}
            disabled={paying === p.id}
            sx={{ py: 1.5, fontWeight: 700, fontSize: '1rem', borderRadius: 2 }}
          >
            {paying === p.id ? 'Processando...' : `Pagar R$ ${p.preco.toFixed(2)}`}
          </Button>
        </Box>
      )}

      <Divider />

      <CardActions sx={{ gap: 1, px: 2 }}>
        <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => setSel(p)}>
          Detalhes
        </Button>
        {(p.status === 'analisando' || p.status === 'aguardando_pagamento') && (
          <Button
            size="small" color="error"
            startIcon={cancelling === p.id ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
            onClick={() => handleCancelar(p.id)}
            disabled={cancelling === p.id}
          >
            Cancelar
          </Button>
        )}
      </CardActions>
    </Card>
  );

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Meus Orçamentos</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          label={`Aguardando Pagamento${aguardandoPagamento.length > 0 ? ` (${aguardandoPagamento.length})` : ''}`}
        />
        <Tab
          label={`Em Revisão${emRevisao.length > 0 ? ` (${emRevisao.length})` : ''}`}
        />
      </Tabs>

      {tab === 0 && (
        <>
          {aguardandoPagamento.length === 0 ? (
            <Box textAlign="center" py={6}>
              <PaymentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">
                Nenhum orçamento aguardando pagamento.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pedidos pagos aparecem em "Meus Pedidos".
              </Typography>
            </Box>
          ) : (
            aguardandoPagamento.map(renderCard)
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {emRevisao.length === 0 ? (
            <Box textAlign="center" py={6}>
              <HourglassEmptyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">
                Nenhum orçamento em análise ou revisão.
              </Typography>
            </Box>
          ) : (
            emRevisao.map(renderCard)
          )}
        </>
      )}

      {/* Modal de detalhes com breakdown de preço */}
      {sel && (
        <Dialog open onClose={() => setSel(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{sel.nome}</DialogTitle>
          <DialogContent dividers>
            <List dense>
              <ListItem>
                <ListItemText primary="Status" secondary={getStatusTranslation(sel.status)} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Material" secondary={sel.nomeMaterial ?? '—'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Arquivo" secondary={sel.nomeArquivo ?? '—'} />
              </ListItem>
              {sel.tempoEstimadoS && (
                <ListItem>
                  <ListItemText primary="Tempo estimado de impressão" secondary={formatTime(sel.tempoEstimadoS)} />
                </ListItem>
              )}
              {(sel.materialGramas ?? 0) > 0 && (
                <ListItem>
                  <ListItemText primary="Filamento estimado" secondary={`${n(sel.materialGramas).toFixed(1)}g`} />
                </ListItem>
              )}

              {sel.preco > 0 && sel.status === 'aguardando_pagamento' && (
                <>
                  <Divider component="li" />
                  {nivel === 'avancado' && sel.scoreComplexidade != null && (
                    <ListItem>
                      <ListItemText
                        primary="Complexidade da peça"
                        secondary={`Score ${(Number(sel.scoreComplexidade) * 100).toFixed(0)}/100 · ${Number(sel.scoreComplexidade) >= 0.5 ? 'complexa (revisada pelo admin)' : 'dentro do padrão'}`}
                      />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemText
                      primary={nivel === 'iniciante' ? 'Impressão, material e serviço' : 'Impressão + material + serviço'}
                      secondary={`R$ ${(n(sel.precoBase) - n(sel.taxaComplexidade)).toFixed(2)}`}
                    />
                  </ListItem>
                  {n(sel.taxaComplexidade) > 0 && (
                    <ListItem>
                      <ListItemText
                        primary={nivel === 'iniciante' ? 'Ajuste por peça complexa' : 'Sobretaxa por peça complexa'}
                        secondary={`R$ ${n(sel.taxaComplexidade).toFixed(2)}`}
                      />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemText
                      primary={nivel === 'iniciante' ? 'Taxa do pagamento' : 'Taxa de pagamento online'}
                      secondary={`R$ ${n(sel.taxaStripe).toFixed(2)}`}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem>
                    <ListItemText
                      primary={<Typography fontWeight={700}>Total</Typography>}
                      secondary={<Typography variant="h6" color="primary" fontWeight={800}>R$ {n(sel.preco).toFixed(2)}</Typography>}
                    />
                  </ListItem>
                </>
              )}

              {sel.descricao && (
                <ListItem>
                  <ListItemText primary="Observações" secondary={sel.descricao} />
                </ListItem>
              )}
              <ListItem>
                <ListItemText primary="Criado em" secondary={new Date(sel.createdAt).toLocaleString('pt-BR')} />
              </ListItem>
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSel(null)}>Fechar</Button>
            {sel.status === 'aguardando_pagamento' && (
              <Button
                variant="contained" color="success" size="large"
                startIcon={<PaymentIcon />}
                onClick={() => { setSel(null); handlePagar(sel.id); }}
                sx={{ fontWeight: 700 }}
              >
                Pagar R$ {n(sel.preco).toFixed(2)}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}
