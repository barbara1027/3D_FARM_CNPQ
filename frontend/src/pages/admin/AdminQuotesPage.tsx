import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, CircularProgress, Alert, Chip,
  ToggleButtonGroup, ToggleButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Divider, TextField, Badge, Tooltip,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChatIcon from '@mui/icons-material/Chat';
import DownloadIcon from '@mui/icons-material/Download';
import { IconButton } from '@mui/material';
import api from '../../services/api';
import type { Pedido, StatusPedido } from '../../types/Pedido';
import { getStatusTranslation, getStatusColor } from '../../utils/translations';
import { ChatDialog } from '../../components/ChatDialog';

type Filter = 'revisao' | 'todos';

const PRE_PAYMENT: StatusPedido[] = ['analisando', 'aguardando_pagamento', 'aguardando_revisao'];

function n(v: any) { return Number(v ?? 0); }
function fmtTime(s: number | null) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function sortForDisplay(list: Pedido[]): Pedido[] {
  return [...list].sort((a, b) => {
    // aguardando_revisao sempre primeiro
    if (a.status === 'aguardando_revisao' && b.status !== 'aguardando_revisao') return -1;
    if (b.status === 'aguardando_revisao' && a.status !== 'aguardando_revisao') return  1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function AdminQuotesPage() {
  const [all, setAll]               = useState<Pedido[]>([]);
  const [displayed, setDisplayed]   = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<Filter>('revisao');
  const [sel, setSel]               = useState<Pedido | null>(null);
  const [novoPreco, setNovoPreco]   = useState('');
  const [aprovando, setAprovando]   = useState(false);

  // Chat — independente do dialog de detalhes
  const [chatPedido, setChatPedido] = useState<{ id: number; nome: string } | null>(null);
  const [unreadMap, setUnreadMap]   = useState<Record<number, number>>({});

  const fetchPedidos = () => {
    setLoading(true);
    api.get<any[]>('/pedidos')
      .then(r => setAll(
        r.data.map((p: any) => ({
          ...p,
          preco:             n(p.preco),
          tempoEstimadoS:    p.tempoEstimadoS    != null ? n(p.tempoEstimadoS)    : null,
          materialGramas:    p.materialGramas    != null ? n(p.materialGramas)    : null,
          scoreComplexidade: p.scoreComplexidade != null ? n(p.scoreComplexidade) : null,
          precoBase:         p.precoBase         != null ? n(p.precoBase)         : null,
          taxaComplexidade:  p.taxaComplexidade  != null ? n(p.taxaComplexidade)  : null,
          taxaStripe:        p.taxaStripe        != null ? n(p.taxaStripe)        : null,
        }))
      ))
      .catch(() => setError('Erro ao buscar pedidos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPedidos(); }, []);

  useEffect(() => {
    const base = filter === 'revisao'
      ? all.filter(p => p.status === 'aguardando_revisao')
      : all.filter(p => PRE_PAYMENT.includes(p.status));
    setDisplayed(sortForDisplay(base));
  }, [filter, all]);

  const openDetail = (p: Pedido) => {
    setSel(p);
    setNovoPreco(p.preco > 0 ? p.preco.toFixed(2) : '');
    api.get<{ count: number }>(`/pedidos/${p.id}/mensagens/nao-lidas`)
      .then(r => setUnreadMap(prev => ({ ...prev, [p.id]: r.data.count })))
      .catch(() => {});
  };

  const openChat = () => {
    if (!sel) return;
    setChatPedido({ id: sel.id, nome: sel.nome });
  };

  const closeChat = () => {
    if (chatPedido) {
      setUnreadMap(prev => ({ ...prev, [chatPedido.id]: 0 }));
    }
    setChatPedido(null);
  };

  const downloadArquivo = async (arquivoId: number, nome: string) => {
    try {
      const resp = await api.get(`/arquivos/${arquivoId}/download`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([resp.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Erro ao baixar o arquivo.');
    }
  };

  const handleAprovar = async () => {
    if (!sel) return;
    setAprovando(true);
    try {
      const body: any = {};
      if (novoPreco) body.preco = parseFloat(novoPreco);
      await api.post(`/pedidos/${sel.id}/aprovar`, body);
      setSel(null);
      setNovoPreco('');
      fetchPedidos();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao aprovar.');
    } finally { setAprovando(false); }
  };

  const revisaoCount = all.filter(p => p.status === 'aguardando_revisao').length;
  const todosCount   = all.filter(p => PRE_PAYMENT.includes(p.status)).length;

  const cols: GridColDef<Pedido>[] = [
    {
      field: 'createdAt', headerName: 'Data', width: 140,
      renderCell: ({ value }) => new Date(value as string).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
      }),
    },
    { field: 'nome',         headerName: 'Nome',    flex: 1, minWidth: 130 },
    { field: 'emailUsuario', headerName: 'Cliente', width: 180, renderCell: ({ value }) => value ?? '—' },
    { field: 'nomeMaterial', headerName: 'Material',width: 110, renderCell: ({ value }) => value ?? '—' },
    {
      field: 'tempoEstimadoS', headerName: 'Tempo', width: 90,
      renderCell: ({ value }) => fmtTime(value as number | null),
    },
    {
      field: 'scoreComplexidade', headerName: 'Score', width: 90,
      renderCell: ({ value }) => value != null
        ? <Chip size="small"
            label={`${(n(value) * 100).toFixed(0)}%`}
            color={n(value) >= 0.5 ? 'warning' : 'success'} />
        : '—',
    },
    {
      field: 'preco', headerName: 'Preço (R$)', width: 110, type: 'number',
      renderCell: ({ value }) => n(value) > 0 ? `R$ ${n(value).toFixed(2)}` : '—',
    },
    {
      field: 'status', headerName: 'Status', width: 180,
      renderCell: ({ value }) => (
        <Chip label={getStatusTranslation(value as string)}
          color={getStatusColor(value as string)} size="small" />
      ),
    },
    {
      field: 'actions', headerName: '', width: 50, sortable: false,
      renderCell: ({ row }) => (
        <IconButton size="small" onClick={() => openDetail(row)}>
          <VisibilityIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 2, height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>Orçamentos</Typography>

      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)} size="small">
          <ToggleButton value="revisao" color="warning">
            Revisão pendente ({revisaoCount})
          </ToggleButton>
          <ToggleButton value="todos">
            Todos os orçamentos ({todosCount})
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ flexGrow: 1 }}>
        <DataGrid
          rows={displayed} columns={cols}
          getRowId={r => r.id} loading={loading} disableRowSelectionOnClick
          getRowClassName={r => r.row.status === 'aguardando_revisao' ? 'row-revisao' : ''}
          sx={{ '& .row-revisao': { bgcolor: '#fff8e1' } }}
        />
      </Box>

      {/* Dialog de detalhes */}
      {sel && (
        <Dialog open onClose={() => setSel(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box display="flex" alignItems="center" gap={1}>
              <span>{sel.nome}</span>
              {sel.status === 'aguardando_revisao' && (
                <Chip label="Revisão pendente" color="warning" size="small" />
              )}
            </Box>
            {sel.idArquivo && (
              <Tooltip title={`Baixar STL: ${sel.nomeArquivo ?? ''}`}>
                <IconButton
                  size="small"
                  onClick={() => downloadArquivo(sel.idArquivo, sel.nomeArquivo ?? `pedido_${sel.id}.stl`)}
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
          </DialogTitle>
          <DialogContent dividers>
            <List dense>
              <ListItem><ListItemText primary="Cliente"  secondary={`${sel.nomeUsuario ?? '—'} (${sel.emailUsuario ?? '—'})`} /></ListItem>
              <ListItem><ListItemText primary="Material" secondary={sel.nomeMaterial ?? '—'} /></ListItem>
              <ListItem><ListItemText primary="Arquivo"  secondary={sel.nomeArquivo  ?? '—'} /></ListItem>
              <Divider component="li" />
              {sel.tempoEstimadoS != null && (
                <ListItem><ListItemText primary="Tempo estimado"  secondary={fmtTime(sel.tempoEstimadoS)} /></ListItem>
              )}
              {sel.materialGramas != null && (
                <ListItem><ListItemText primary="Material estimado" secondary={`${n(sel.materialGramas).toFixed(2)}g`} /></ListItem>
              )}
              {sel.scoreComplexidade != null && (
                <ListItem>
                  <ListItemText
                    primary="Score de complexidade"
                    secondary={`${(n(sel.scoreComplexidade)*100).toFixed(1)}% — ${n(sel.scoreComplexidade) >= 0.5 ? 'COMPLEXO' : 'Simples'}`}
                  />
                </ListItem>
              )}
              {sel.motivoComplexidade && (
                <ListItem><ListItemText primary="Fatores" secondary={sel.motivoComplexidade} /></ListItem>
              )}
              <Divider component="li" />
              {n(sel.precoBase) > 0 && (
                <ListItem><ListItemText primary="Custo de impressão" secondary={`R$ ${n(sel.precoBase).toFixed(2)}`} /></ListItem>
              )}
              {n(sel.taxaComplexidade) > 0 && (
                <ListItem><ListItemText primary="Taxa complexidade"  secondary={`R$ ${n(sel.taxaComplexidade).toFixed(2)}`} /></ListItem>
              )}
              {n(sel.taxaStripe) > 0 && (
                <ListItem><ListItemText primary="Taxa Stripe"        secondary={`R$ ${n(sel.taxaStripe).toFixed(2)}`} /></ListItem>
              )}
              <ListItem>
                <ListItemText
                  primary={<Typography fontWeight="bold">Total cobrado</Typography>}
                  secondary={<Typography variant="h6" color="primary">R$ {n(sel.preco).toFixed(2)}</Typography>}
                />
              </ListItem>
              {sel.status === 'aguardando_revisao' && (
                <>
                  <Divider component="li" />
                  <ListItem>
                    <TextField
                      label="Ajustar preço (opcional)"
                      type="number"
                      size="small"
                      fullWidth
                      helperText="Deixe em branco para manter o preço calculado"
                      value={novoPreco}
                      onChange={e => setNovoPreco(e.target.value)}
                      inputProps={{ min: 0, step: '0.01' }}
                    />
                  </ListItem>
                </>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSel(null)}>Fechar</Button>
            <Badge badgeContent={unreadMap[sel.id] || 0} color="error">
              <Button variant="outlined" startIcon={<ChatIcon />} onClick={openChat}>
                Chat com cliente
              </Button>
            </Badge>
            {sel.status === 'aguardando_revisao' && (
              <Button
                variant="contained" color="success"
                startIcon={aprovando ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                onClick={handleAprovar}
                disabled={aprovando}
              >
                Aprovar e liberar para pagamento
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}

      {/* Chat — montado independentemente do dialog de detalhes */}
      <ChatDialog
        pedidoId={chatPedido?.id ?? 0}
        pedidoNome={chatPedido?.nome ?? ''}
        meuTipo="admin"
        open={chatPedido !== null}
        onClose={closeChat}
      />
    </Paper>
  );
}
