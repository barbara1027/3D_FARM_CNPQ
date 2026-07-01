import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, IconButton, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Tabs, Tab, Chip, List, ListItem, ListItemText, Divider,
  Select, MenuItem, FormControl, InputLabel, type SelectChangeEvent,
  Tooltip, Badge,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';
import ChatIcon from '@mui/icons-material/Chat';
import api from '../../services/api';
import { type Pedido, type StatusPedido } from '../../types/Pedido';
import { getStatusTranslation, getStatusColor } from '../../utils/translations';
import { normalizePedido } from '../../utils/normalize';
import { ChatDialog } from '../../components/ChatDialog';

const STATUS_TABS: { label: string; statuses: StatusPedido[] }[] = [
  { label: 'Na fila',            statuses: ['na_fila'] },
  { label: 'Em impressão',       statuses: ['em_impressao'] },
  { label: 'Concluídos',         statuses: ['concluido'] },
  { label: 'Falhas/Cancelados',  statuses: ['falhou', 'cancelado'] },
];
const ALL_STATUSES: StatusPedido[] = ['na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado'];

function TabPanel({ children, value, index }: { children?: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 2, height: 'calc(100% - 48px)' }}>{children}</Box> : null;
}

export function AdminOrdersPage() {
  const [pedidos, setPedidos]         = useState<Pedido[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [tab, setTab]                 = useState(0);
  const [selected, setSelected]       = useState<Pedido | null>(null);
  const [editOpen, setEditOpen]       = useState(false);
  const [newStatus, setNewStatus]     = useState<StatusPedido>('na_fila');
  const [chatPedido, setChatPedido]   = useState<{ id: number; nome: string } | null>(null);
  const [unreadMap, setUnreadMap]     = useState<Record<number, number>>({});

  const fetchUnreadResumo = useCallback(async () => {
    try {
      const { data } = await api.get<{ idPedido: number; count: number }[]>('/pedidos/mensagens/resumo');
      setUnreadMap(prev => {
        const next = { ...prev };
        data.forEach(({ idPedido, count }) => { next[idPedido] = count; });
        return next;
      });
    } catch { /* silencioso */ }
  }, []);

  const fetchPedidos = () => {
    setLoading(true);
    api.get<any[]>('/pedidos')
      .then(r => setPedidos(
        r.data.map(normalizePedido)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      ))
      .catch(() => setError('Erro ao buscar pedidos.'))
      .finally(() => setLoading(false));
  };

  const handleDownloadStl = async (pedido: Pedido) => {
    try {
      const response = await api.get(`/arquivos/${pedido.idArquivo}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = pedido.nomeArquivo ?? `pedido_${pedido.id}.stl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Erro ao baixar arquivo STL.');
    }
  };

  const handleReimprimir = async (pedido: Pedido) => {
    if (!confirm(`Reenviar pedido "${pedido.nome}" para a fila de impressão?`)) return;
    try {
      await api.post(`/pedidos/${pedido.id}/reimprimir`);
      setSelected(null);
      fetchPedidos();
    } catch {
      setError('Erro ao reimprimir.');
    }
  };

  useEffect(() => {
    fetchPedidos();
    fetchUnreadResumo();
    const id = setInterval(fetchUnreadResumo, 15_000);
    return () => clearInterval(id);
  }, [fetchUnreadResumo]);

  const handleUpdateStatus = async () => {
    if (!selected) return;
    try {
      await api.put(`/pedidos/${selected.id}`, { status: newStatus });
      setEditOpen(false);
      setSelected(null);
      fetchPedidos();
    } catch { setError('Erro ao atualizar status.'); }
  };

  const cols: GridColDef<Pedido>[] = [
    {
      field: 'createdAt', headerName: 'Data', width: 150,
      renderCell: ({ value }) => new Date(value as string).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    },
    { field: 'nome',          headerName: 'Nome',     flex: 1, minWidth: 150 },
    { field: 'nomeMaterial',  headerName: 'Material', width: 140, renderCell: ({ value }) => value ?? '—' },
    { field: 'emailUsuario',  headerName: 'Cliente',  width: 200, renderCell: ({ value }) => value ?? '—' },
    {
      field: 'preco', headerName: 'Valor (R$)', width: 110, type: 'number',
      renderCell: ({ value }) => (Number(value) > 0) ? `R$ ${Number(value).toFixed(2)}` : '—',
    },
    {
      field: 'status', headerName: 'Status', width: 160,
      renderCell: ({ value }) => (
        <Chip label={getStatusTranslation(value as string)} color={getStatusColor(value as string)} size="small" />
      ),
    },
    {
      field: 'actions', headerName: 'Ações', width: 130, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => setSelected(row)}><VisibilityIcon /></IconButton>
          <IconButton size="small" onClick={() => { setSelected(row); setNewStatus(row.status); setEditOpen(true); }}>
            <EditIcon />
          </IconButton>
          <Tooltip title="Chat com cliente">
            <IconButton size="small" onClick={() => setChatPedido({ id: row.id, nome: row.nome })}>
              <Badge badgeContent={unreadMap[row.id] || 0} color="error" variant="dot">
                <ChatIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 2, height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>Gerenciamento de Pedidos</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading
        ? <Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress /></Box>
        : (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              {STATUS_TABS.map(({ label, statuses }) => (
                <Tab key={label}
                  label={`${label} (${pedidos.filter(p => statuses.includes(p.status)).length})`} />
              ))}
            </Tabs>
            {STATUS_TABS.map(({ statuses }, idx) => (
              <TabPanel key={idx} value={tab} index={idx}>
                <DataGrid
                  rows={pedidos.filter(p => statuses.includes(p.status))}
                  columns={cols} getRowId={r => r.id} disableRowSelectionOnClick
                />
              </TabPanel>
            ))}
          </Box>
        )
      }

      {/* Detalhes */}
      {selected && !editOpen && (
        <Dialog open onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Pedido: {selected.nome}</DialogTitle>
          <DialogContent dividers>
            <List dense>
              <ListItem><ListItemText primary="Cliente" secondary={`${selected.nomeUsuario ?? '—'} (${selected.emailUsuario ?? '—'})`} /></ListItem>
              <ListItem><ListItemText primary="Material" secondary={selected.nomeMaterial ?? '—'} /></ListItem>
              <ListItem><ListItemText primary="Arquivo"  secondary={selected.nomeArquivo  ?? '—'} /></ListItem>
              <Divider component="li" />
              <ListItem><ListItemText primary="Valor"    secondary={`R$ ${selected.preco.toFixed(2)}`} /></ListItem>
              <ListItem><ListItemText primary="Status"   secondary={getStatusTranslation(selected.status)} /></ListItem>
              {selected.descricao && <ListItem><ListItemText primary="Descrição" secondary={selected.descricao} /></ListItem>}
              <ListItem><ListItemText primary="Criado em" secondary={new Date(selected.createdAt).toLocaleString('pt-BR')} /></ListItem>
            </List>
          </DialogContent>
          <DialogActions>
            <Tooltip title="Baixar arquivo STL original">
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadStl(selected)}
              >
                Baixar STL
              </Button>
            </Tooltip>
            {(selected.status === 'falhou' || selected.status === 'concluido' || selected.status === 'em_impressao') && (
              <Tooltip title="Reenviar para a fila de impressão">
                <Button
                  startIcon={<ReplayIcon />}
                  color="warning"
                  onClick={() => handleReimprimir(selected)}
                >
                  Reimprimir
                </Button>
              </Tooltip>
            )}
            <Badge badgeContent={unreadMap[selected.id] || 0} color="error">
              <Button
                startIcon={<ChatIcon />}
                onClick={() => { setSelected(null); setChatPedido({ id: selected.id, nome: selected.nome }); }}
              >
                Chat
              </Button>
            </Badge>
            <Button onClick={() => { setNewStatus(selected.status); setEditOpen(true); }}>Editar Status</Button>
            <Button onClick={() => setSelected(null)}>Fechar</Button>
          </DialogActions>
        </Dialog>
      )}

      <ChatDialog
        pedidoId={chatPedido?.id ?? 0}
        pedidoNome={chatPedido?.nome ?? ''}
        meuTipo="admin"
        open={chatPedido !== null}
        onClose={() => { setChatPedido(null); fetchUnreadResumo(); }}
      />

      {/* Editar status */}
      {editOpen && selected && (
        <Dialog open onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Atualizar status — {selected.nome}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Novo status</InputLabel>
              <Select label="Novo status" value={newStatus}
                onChange={(e: SelectChangeEvent) => setNewStatus(e.target.value as StatusPedido)}>
                {ALL_STATUSES.map(s => (
                  <MenuItem key={s} value={s}>{getStatusTranslation(s)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleUpdateStatus}>Salvar</Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
}
