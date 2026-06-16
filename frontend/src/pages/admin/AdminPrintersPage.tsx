import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, type SelectChangeEvent, Chip,
  List, ListItemButton, ListItemText, Divider, Paper, Tooltip, LinearProgress,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import WifiIcon from '@mui/icons-material/Wifi';
import SyncIcon from '@mui/icons-material/Sync';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import api from '../../services/api';
import { type Impressora, type ApiProtocol, type PrinterStatus } from '../../types/Impressora';
import { type Pedido } from '../../types/Pedido';
import { normalizePedido } from '../../utils/normalize';

interface ProgressoData {
  progressoPct: number | null;
  tempoRestanteS: number | null;
  statusFisico: string;
}

function formatRestante(s: number): string {
  if (s < 60) return `~${s}s`;
  const m = Math.ceil(s / 60);
  return m < 60 ? `~${m}min` : `~${Math.floor(m / 60)}h ${m % 60}min`;
}

type FormData = Omit<Impressora, 'id' | 'statusFisico' | 'jobRemotoId' | 'ultimoErro' | 'ultimaSincronizacao' | 'idPedidoAtual'> & { id?: number };

const emptyForm: FormData = {
  nome: '', modelo: '', status: 'Ociosa',
  ip: null, baseUrl: null, api: 'DUMMY', api_key: null,
  timeoutMs: 15000, idMaterial: null,
};

function borderColor(s: PrinterStatus): string {
  if (s === 'Ociosa')     return '#4caf50';
  if (s === 'Imprimindo') return '#ff9800';
  if (s === 'Erro')       return '#f44336';
  return '#9e9e9e';
}

function chipColor(s: PrinterStatus): 'success' | 'warning' | 'error' | 'default' {
  if (s === 'Ociosa')     return 'success';
  if (s === 'Imprimindo') return 'warning';
  if (s === 'Erro')       return 'error';
  return 'default';
}

export function AdminPrintersPage() {
  const [impressoras, setImpressoras]   = useState<Impressora[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [manageOpen, setManageOpen]     = useState(false);
  const [progressoMap, setProgressoMap] = useState<Record<number, ProgressoData>>({});

  // CRUD state
  const [formOpen, setFormOpen]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState<FormData>(emptyForm);

  // Atribuição
  const [atribuirImp, setAtribuirImp]         = useState<Impressora | null>(null);
  const [pedidosNaFila, setPedidosNaFila]     = useState<Pedido[]>([]);
  const [pedidoSel, setPedidoSel]             = useState<number | null>(null);
  const [atribuindo, setAtribuindo]           = useState(false);

  const fetchImpressoras = () => {
    setLoading(true);
    api.get<Impressora[]>('/impressoras')
      .then(r => setImpressoras(r.data))
      .catch(() => setError('Erro ao buscar impressoras.'))
      .finally(() => setLoading(false));
  };

  const pollProgress = useCallback(async (lista: Impressora[]) => {
    const ativas = lista.filter(i => i.status === 'Imprimindo');
    if (ativas.length === 0) return;
    const results = await Promise.allSettled(
      ativas.map(imp =>
        api.get<ProgressoData>(`/impressoras/${imp.id}/progresso`).then(r => ({ id: imp.id, data: r.data }))
      )
    );
    setProgressoMap(prev => {
      const next = { ...prev };
      results.forEach(r => { if (r.status === 'fulfilled') next[r.value.id] = r.value.data; });
      return next;
    });
  }, []);

  useEffect(() => { fetchImpressoras(); }, []);

  useEffect(() => {
    if (impressoras.some(i => i.status === 'Imprimindo')) {
      pollProgress(impressoras);
      const interval = setInterval(() => pollProgress(impressoras), 10_000);
      return () => clearInterval(interval);
    }
  }, [impressoras, pollProgress]);

  const openAdd  = () => { setForm(emptyForm); setError(null); setFormOpen(true); };
  const openEdit = (imp: Impressora) => {
    const { statusFisico: _sf, jobRemotoId: _jr, ultimoErro: _ue, ultimaSincronizacao: _us, idPedidoAtual: _ip, ...rest } = imp;
    setForm(rest); setError(null); setFormOpen(true);
  };

  const handleField = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value === '' ? null : name === 'timeoutMs' ? Number(value) : value }));
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      form.id ? await api.put(`/impressoras/${form.id}`, form) : await api.post('/impressoras', form);
      setFormOpen(false); fetchImpressoras();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remover esta impressora?')) return;
    try {
      await api.delete(`/impressoras/${id}`); fetchImpressoras();
    } catch (err: any) { setError(err.response?.data?.message ?? 'Erro ao remover.'); }
  };

  const handleTestar = async (id: number) => {
    try {
      const { data } = await api.post(`/impressoras/${id}/testar-conexao`);
      alert(data.mensagem ?? 'Conexão testada.');
    } catch (err: any) { alert(err.response?.data?.message ?? 'Falha na conexão.'); }
  };

  const handleSincronizar = async (id: number) => {
    try {
      await api.post(`/impressoras/${id}/sincronizar`); fetchImpressoras();
    } catch (err: any) { setError(err.response?.data?.message ?? 'Erro ao sincronizar.'); }
  };

  const handleLiberar = async (id: number) => {
    try {
      await api.post(`/impressoras/${id}/liberar`); fetchImpressoras();
    } catch (err: any) { setError(err.response?.data?.message ?? 'Erro ao liberar.'); }
  };

  const handleConfirmarRemocao = async (id: number) => {
    try {
      await api.post(`/impressoras/${id}/confirmar-remocao`); fetchImpressoras();
    } catch (err: any) { setError(err.response?.data?.message ?? 'Erro ao confirmar remoção.'); }
  };

  const abrirAtribuicao = async (imp: Impressora) => {
    setAtribuirImp(imp); setPedidoSel(null);
    try {
      const { data } = await api.get<any[]>('/pedidos');
      setPedidosNaFila(data.map(normalizePedido).filter((p): p is Pedido => p !== null && p.status === 'na_fila'));
    } catch { setPedidosNaFila([]); }
  };

  const handleAtribuir = async () => {
    if (!atribuirImp || !pedidoSel) return;
    setAtribuindo(true);
    try {
      await api.post(`/impressoras/${atribuirImp.id}/atribuir-pedido`, { idPedido: pedidoSel });
      setAtribuirImp(null); fetchImpressoras();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao atribuir pedido.');
      setAtribuirImp(null);
    } finally { setAtribuindo(false); }
  };

  // ── DataGrid columns (para o dialog Gerenciar) ───────────────────────────
  const cols: GridColDef<Impressora>[] = [
    { field: 'nome',   headerName: 'Nome',      flex: 1, minWidth: 130 },
    { field: 'modelo', headerName: 'Modelo',    width: 150 },
    { field: 'api',    headerName: 'Protocolo', width: 110 },
    { field: 'ip',     headerName: 'IP',        width: 130, renderCell: ({ value }) => value ?? '—' },
    {
      field: 'status', headerName: 'Status', width: 150,
      renderCell: ({ value }) => <Chip label={value as string} color={chipColor(value as PrinterStatus)} size="small" />,
    },
    {
      field: 'actions', headerName: 'Ações', width: 160, sortable: false,
      renderCell: ({ row }) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon /></IconButton></Tooltip>
          <Tooltip title="Testar conexão"><IconButton size="small" color="info" onClick={() => handleTestar(row.id)}><WifiIcon /></IconButton></Tooltip>
          <Tooltip title="Sincronizar"><IconButton size="small" onClick={() => handleSincronizar(row.id)}><SyncIcon /></IconButton></Tooltip>
          {row.status !== 'Imprimindo' && row.status !== 'Reservada' && (
            <Tooltip title="Remover"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon /></IconButton></Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Status das Impressoras</Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<SettingsIcon />} onClick={() => setManageOpen(true)}>
            Gerenciar
          </Button>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={fetchImpressoras} disabled={loading}>
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Atualizar'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Cards grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
        {impressoras.map(imp => (
          <Paper
            key={imp.id}
            sx={{
              p: 2.5,
              borderLeft: `5px solid ${borderColor(imp.status)}`,
              display: 'flex', flexDirection: 'column', gap: 1.5,
            }}
          >
            {/* Nome e modelo */}
            <Box>
              <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
                {imp.nome}
              </Typography>
              <Typography variant="body2" color="text.secondary">{imp.modelo}</Typography>
            </Box>

            {/* Status */}
            <Box display="flex" alignItems="center" gap={1}>
              <Chip label={imp.status} color={chipColor(imp.status)} size="small" />
              <Typography variant="caption" color="text.secondary">{imp.api}</Typography>
            </Box>

            {/* Progresso de impressão */}
            {imp.status === 'Imprimindo' && (() => {
              const prog = progressoMap[imp.id];
              const pct = prog?.progressoPct;
              const restante = prog?.tempoRestanteS;
              const statusFisico = prog?.statusFisico;
              const nivelando = pct === 0 && statusFisico === 'printing';
              return (
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {nivelando ? 'Nivelando mesa...' : imp.idPedidoAtual ? `Pedido #${imp.idPedidoAtual}` : 'Imprimindo'}
                    </Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      {restante != null && restante > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {formatRestante(restante)}
                        </Typography>
                      )}
                      <Typography variant="caption" fontWeight="bold" color="warning.main">
                        {nivelando ? 'preparando' : pct != null ? `${pct.toFixed(0)}%` : '—'}
                      </Typography>
                    </Box>
                  </Box>
                  {nivelando ? (
                    <LinearProgress
                      variant="indeterminate"
                      color="warning"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  ) : pct != null ? (
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      color="warning"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  ) : (
                    <LinearProgress
                      variant="indeterminate"
                      color="warning"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  )}
                  {statusFisico && !nivelando && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Klipper: {statusFisico}
                    </Typography>
                  )}
                  {imp.jobRemotoId && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Job: ...{imp.jobRemotoId.slice(-7)}
                    </Typography>
                  )}
                </Box>
              );
            })()}

            {/* Pedido atual (quando não está imprimindo) */}
            {imp.status !== 'Imprimindo' && imp.idPedidoAtual && (
              <Typography variant="caption" color="text.secondary">
                Pedido #{imp.idPedidoAtual}
              </Typography>
            )}

            {/* Erro */}
            {imp.ultimoErro && (
              <Typography variant="caption" color="error.main" noWrap title={imp.ultimoErro}>
                ⚠ {imp.ultimoErro}
              </Typography>
            )}

            {/* Ações */}
            <Box display="flex" gap={1} mt="auto">
              {imp.status === 'Ociosa' && (
                <Button
                  variant="contained" fullWidth size="small"
                  startIcon={<PrintIcon />}
                  onClick={() => abrirAtribuicao(imp)}
                >
                  Atribuir
                </Button>
              )}
              {imp.status === 'Imprimindo' && (
                <>
                  <Tooltip title="Sincronizar status">
                    <IconButton size="small" onClick={() => handleSincronizar(imp.id)}><SyncIcon /></IconButton>
                  </Tooltip>
                  <Button
                    variant="outlined" color="warning" fullWidth size="small"
                    startIcon={<StopCircleIcon />}
                    onClick={() => handleLiberar(imp.id)}
                  >
                    Concluir
                  </Button>
                </>
              )}
              {imp.status === 'Aguardando Remoção' && (
                <Button
                  variant="contained" color="success" fullWidth size="small"
                  startIcon={<CheckBoxIcon />}
                  onClick={() => handleConfirmarRemocao(imp.id)}
                >
                  Peça Removida
                </Button>
              )}
              {(imp.status === 'Erro' || imp.status === 'Manutenção' || imp.status === 'Reservada' || imp.status === 'Indisponivel') && (
                <>
                  <Tooltip title="Sincronizar status">
                    <IconButton size="small" onClick={() => handleSincronizar(imp.id)}><SyncIcon /></IconButton>
                  </Tooltip>
                  <Button
                    variant="outlined" color="error" fullWidth size="small"
                    startIcon={<StopCircleIcon />}
                    onClick={() => handleLiberar(imp.id)}
                  >
                    Liberar
                  </Button>
                </>
              )}
            </Box>
          </Paper>
        ))}

        {!loading && impressoras.length === 0 && (
          <Typography color="text.secondary" sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>
            Nenhuma impressora cadastrada. Clique em "Gerenciar" para adicionar.
          </Typography>
        )}
      </Box>

      {/* Dialog Gerenciar (CRUD completo) */}
      <Dialog open={manageOpen} onClose={() => setManageOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Gerenciar Impressoras
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
              Adicionar
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ height: 400, p: 0 }}>
          <DataGrid
            rows={impressoras} columns={cols}
            getRowId={r => r.id} loading={loading} disableRowSelectionOnClick
            sx={{ border: 0 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog criar/editar impressora */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Editar Impressora' : 'Nova Impressora'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && formOpen && <Alert severity="error">{error}</Alert>}
          <TextField name="nome"   label="Nome *"   required fullWidth value={form.nome}   onChange={handleField} />
          <TextField name="modelo" label="Modelo *" required fullWidth value={form.modelo} onChange={handleField} />
          <FormControl fullWidth required>
            <InputLabel>Protocolo *</InputLabel>
            <Select label="Protocolo *" value={form.api}
              onChange={(e: SelectChangeEvent) => setForm(p => ({ ...p, api: e.target.value as ApiProtocol }))}>
              <MenuItem value="DUMMY">DUMMY (simulação local)</MenuItem>
              <MenuItem value="OCTOPRINT">OctoPrint</MenuItem>
              <MenuItem value="MOONRAKER">Moonraker (Klipper)</MenuItem>
            </Select>
          </FormControl>
          <TextField name="ip"       label="Endereço IP"  fullWidth value={form.ip       ?? ''} onChange={handleField} placeholder="192.168.1.100 (não use para Moonraker)" />
          <TextField name="baseUrl"  label="Base URL"     fullWidth value={form.baseUrl  ?? ''} onChange={handleField}
            placeholder={form.api === 'MOONRAKER' ? 'http://192.168.1.100:7125' : 'http://192.168.1.100'}
            helperText={form.api === 'MOONRAKER' ? 'Moonraker: use a porta 7125 diretamente (ex: http://IP:7125)' : undefined}
          />
          <TextField name="api_key"  label="API Key"      fullWidth value={form.api_key  ?? ''} onChange={handleField} />
          <TextField name="timeoutMs" label="Timeout (ms)" type="number" fullWidth value={form.timeoutMs} onChange={handleField} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.nome || !form.modelo}>
            {saving ? <CircularProgress size={22} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog atribuir pedido */}
      <Dialog open={!!atribuirImp} onClose={() => setAtribuirImp(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Atribuir pedido — {atribuirImp?.nome}</DialogTitle>
        <DialogContent dividers>
          {pedidosNaFila.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              Nenhum pedido na fila no momento.
            </Typography>
          ) : (
            <List disablePadding>
              {pedidosNaFila.map((p, i) => (
                <Box key={p.id}>
                  {i > 0 && <Divider />}
                  <ListItemButton selected={pedidoSel === p.id} onClick={() => setPedidoSel(p.id)}>
                    <ListItemText
                      primary={`#${p.id} — ${p.nome}`}
                      secondary={`${p.emailUsuario ?? p.nomeUsuario ?? '—'} · R$ ${p.preco.toFixed(2)} · ${p.nomeMaterial ?? '—'}`}
                    />
                  </ListItemButton>
                </Box>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAtribuirImp(null)} disabled={atribuindo}>Cancelar</Button>
          <Button
            variant="contained" disabled={!pedidoSel || atribuindo}
            onClick={handleAtribuir}
            startIcon={atribuindo ? <CircularProgress size={16} /> : <PrintIcon />}
          >
            Iniciar Impressão
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
