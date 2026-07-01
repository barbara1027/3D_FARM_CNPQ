import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, Card, CardContent,
  Button, Divider, CircularProgress, Alert, Chip, Avatar,
  List, ListItem, ListItemText, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Checkbox, IconButton, Tooltip,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PrintIcon from '@mui/icons-material/Print';
import CategoryIcon from '@mui/icons-material/Category';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RateReviewIcon from '@mui/icons-material/RateReview';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import api from '../../services/api';
import type { Pedido, StatusPedido } from '../../types/Pedido';
import type { Impressora, PrinterStatus } from '../../types/Impressora';
import { getStatusTranslation, getStatusColor } from '../../utils/translations';
import { normalizePedido } from '../../utils/normalize';

function kpiColor(status: PrinterStatus) {
  if (status === 'Ociosa')     return 'success';
  if (status === 'Imprimindo') return 'primary';
  if (status === 'Erro')       return 'error';
  return 'default';
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function buildRevenueChart(pedidos: Pedido[], days: number) {
  const today = new Date();
  const slots = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const concluidos = pedidos.filter(p => p.status === 'concluido');
  return slots.map(day => ({
    dia: day.slice(5).replace('-', '/'),
    receita: parseFloat(
      concluidos
        .filter(p => p.createdAt?.slice(0, 10) === day)
        .reduce((acc, p) => acc + p.preco, 0)
        .toFixed(2)
    ),
  }));
}

type RevenueWindow = 7 | 30;

type WidgetId =
  | 'kpi_fila' | 'kpi_impressao' | 'kpi_concluidos' | 'kpi_receita'
  | 'kpi_tempo_medio' | 'kpi_taxa_falha' | 'kpi_material_top' | 'kpi_revisao'
  | 'chart_receita' | 'chart_pedidos_dia' | 'chart_materiais' | 'chart_status_dist'
  | 'list_fila' | 'list_impressoras';

const ALL_WIDGETS: { id: WidgetId; label: string; group: string }[] = [
  { id: 'kpi_fila',         label: 'KPI — Na Fila',              group: 'Indicadores' },
  { id: 'kpi_impressao',    label: 'KPI — Em Impressão',         group: 'Indicadores' },
  { id: 'kpi_concluidos',   label: 'KPI — Concluídos',           group: 'Indicadores' },
  { id: 'kpi_receita',      label: 'KPI — Receita Total',        group: 'Indicadores' },
  { id: 'kpi_tempo_medio',  label: 'KPI — Tempo Médio',          group: 'Indicadores' },
  { id: 'kpi_taxa_falha',   label: 'KPI — Taxa de Falha',        group: 'Indicadores' },
  { id: 'kpi_material_top', label: 'KPI — Material Mais Usado',  group: 'Indicadores' },
  { id: 'kpi_revisao',      label: 'KPI — Aguardando Revisão',   group: 'Indicadores' },
  { id: 'chart_receita',    label: 'Gráfico — Receita por Dia',  group: 'Gráficos' },
  { id: 'chart_pedidos_dia',label: 'Gráfico — Pedidos por Dia',  group: 'Gráficos' },
  { id: 'chart_materiais',  label: 'Gráfico — Materiais Usados', group: 'Gráficos' },
  { id: 'chart_status_dist',label: 'Gráfico — Distribuição',     group: 'Gráficos' },
  { id: 'list_fila',        label: 'Lista — Próximos na Fila',   group: 'Listas' },
  { id: 'list_impressoras', label: 'Lista — Impressoras',        group: 'Listas' },
];

const DEFAULT_WIDGETS = new Set<WidgetId>(ALL_WIDGETS.map(w => w.id));

function loadActiveWidgets(): Set<WidgetId> {
  try {
    const raw = localStorage.getItem('dashboard_widgets');
    if (raw) return new Set(JSON.parse(raw) as WidgetId[]);
  } catch { /* ignore */ }
  return new Set(DEFAULT_WIDGETS);
}

function buildOrdersPerDayChart(pedidos: Pedido[], days: number) {
  const today = new Date();
  const slots = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  return slots.map(day => ({
    dia: day.slice(5).replace('-', '/'),
    pedidos: pedidos.filter(p => p.createdAt?.slice(0, 10) === day).length,
  }));
}

const PIE_COLORS = ['#2196f3', '#9c27b0', '#4caf50', '#f44336', '#ff9800', '#607d8b'];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos]               = useState<Pedido[]>([]);
  const [impressoras, setImpressoras]       = useState<Impressora[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [revenueWindow, setRevenueWindow]   = useState<RevenueWindow>(7);
  const [activeWidgets, setActiveWidgets]   = useState<Set<WidgetId>>(loadActiveWidgets);
  const [customizeOpen, setCustomizeOpen]   = useState(false);
  const [draftWidgets, setDraftWidgets]     = useState<Set<WidgetId>>(new Set());

  const w = (id: WidgetId) => activeWidgets.has(id);

  const openCustomize = () => {
    setDraftWidgets(new Set(activeWidgets));
    setCustomizeOpen(true);
  };

  const saveCustomize = () => {
    setActiveWidgets(new Set(draftWidgets));
    localStorage.setItem('dashboard_widgets', JSON.stringify([...draftWidgets]));
    setCustomizeOpen(false);
  };

  const toggleDraft = (id: WidgetId) => {
    setDraftWidgets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/pedidos').then(r => r.data.map(normalizePedido)),
      api.get<Impressora[]>('/impressoras').then(r => r.data),
    ])
      .then(([p, i]) => { setPedidos(p); setImpressoras(i); })
      .catch(() => setError('Erro ao carregar dados do dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  if (error) return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;

  const countStatus = (s: StatusPedido) => pedidos.filter(p => p.status === s).length;
  const naFila           = countStatus('na_fila');
  const imprimindo       = countStatus('em_impressao');
  const concluidos       = countStatus('concluido');
  const falhou           = countStatus('falhou');
  const aguardandoRevisao = countStatus('aguardando_revisao');

  const receita = pedidos
    .filter(p => p.status === 'concluido')
    .reduce((acc, p) => acc + p.preco, 0);

  // Avg print time from completed orders with tempo data
  const pedidosComTempo = pedidos.filter(p => p.status === 'concluido' && p.tempoEstimadoS != null);
  const avgPrintTimeS = pedidosComTempo.length > 0
    ? pedidosComTempo.reduce((acc, p) => acc + (p.tempoEstimadoS ?? 0), 0) / pedidosComTempo.length
    : null;

  // Failure rate
  const finalizados = concluidos + falhou;
  const failureRate = finalizados > 0 ? (falhou / finalizados) * 100 : 0;

  // Most used material
  const materialCount: Record<string, number> = {};
  pedidos.forEach(p => {
    if (p.nomeMaterial) {
      materialCount[p.nomeMaterial] = (materialCount[p.nomeMaterial] ?? 0) + 1;
    }
  });
  const topMaterial = Object.entries(materialCount).sort((a, b) => b[1] - a[1])[0];

  const STATUS_DIST: { label: string; status: StatusPedido; color: string }[] = [
    { label: 'Na fila',      status: 'na_fila',      color: '#2196f3' },
    { label: 'Em impressão', status: 'em_impressao', color: '#9c27b0' },
    { label: 'Concluído',    status: 'concluido',    color: '#4caf50' },
    { label: 'Falhou',       status: 'falhou',       color: '#f44336' },
    { label: 'Cancelado',    status: 'cancelado',    color: '#ff9800' },
  ];

  // Revenue chart data
  const revenueData   = buildRevenueChart(pedidos, revenueWindow);
  const ordersPerDay  = buildOrdersPerDayChart(pedidos, revenueWindow);

  // Materials bar chart
  const materiaisData = Object.entries(materialCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nome, count]) => ({ nome: nome.length > 12 ? nome.slice(0, 11) + '…' : nome, count }));

  // Status pie data
  const statusPieData = STATUS_DIST.map(({ label, status, color }) => ({
    name: label, value: countStatus(status), fill: color,
  })).filter(d => d.value > 0);

  const proxNaFila = pedidos
    .filter(p => p.status === 'na_fila')
    .slice(0, 5);

  const kpiCards = [
    { id: 'kpi_fila'        as WidgetId, label: 'Na Fila',       value: naFila,                         icon: <AssignmentIcon />,   color: '#2196f3' },
    { id: 'kpi_impressao'   as WidgetId, label: 'Em Impressão',  value: imprimindo,                     icon: <PrintIcon />,        color: '#9c27b0' },
    { id: 'kpi_concluidos'  as WidgetId, label: 'Concluídos',    value: concluidos,                     icon: <ShoppingCartIcon />, color: '#4caf50' },
    { id: 'kpi_receita'     as WidgetId, label: 'Receita Total', value: `R$ ${receita.toFixed(2)}`,     icon: <CategoryIcon />,     color: '#ff9800' },
    { id: 'kpi_tempo_medio' as WidgetId, label: 'Tempo Médio',   value: avgPrintTimeS != null ? formatDuration(avgPrintTimeS) : '—', icon: <AccessTimeIcon />, color: '#607d8b',
      caption: `${pedidosComTempo.length} pedidos com dados` },
    { id: 'kpi_taxa_falha'  as WidgetId, label: 'Taxa de Falha', value: `${failureRate.toFixed(1)}%`,   icon: <ErrorOutlineIcon />, color: '#e91e63',
      caption: `${falhou} falhou / ${finalizados} finalizados` },
    { id: 'kpi_material_top'as WidgetId, label: 'Material Top',  value: topMaterial ? topMaterial[0] : '—', icon: <CategoryIcon />, color: '#009688',
      caption: topMaterial ? `${topMaterial[1]} pedidos` : 'sem dados' },
    { id: 'kpi_revisao'     as WidgetId, label: 'Revisão',       value: aguardandoRevisao,              icon: <RateReviewIcon />,   color: '#ff9800',
      alert: aguardandoRevisao > 0 },
  ];

  const visibleKpis = kpiCards.filter(k => w(k.id));

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Dashboard</Typography>
        <Tooltip title="Personalizar widgets">
          <IconButton onClick={openCustomize} color="primary">
            <TuneIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* KPIs */}
      {visibleKpis.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {visibleKpis.map(kpi => (
            <Card key={kpi.id} sx={{ flex: '1 1 180px', borderLeft: kpi.alert ? '4px solid #ff9800' : undefined }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Avatar sx={{ bgcolor: kpi.color, width: 32, height: 32 }}>{kpi.icon}</Avatar>
                  <Typography variant="body2" color="text.secondary">{kpi.label}</Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold"
                  color={kpi.id === 'kpi_taxa_falha' && failureRate > 15 ? 'error' :
                         kpi.id === 'kpi_revisao' && aguardandoRevisao > 0 ? 'warning.main' : 'text.primary'}>
                  {kpi.value}
                </Typography>
                {kpi.caption && <Typography variant="caption" color="text.secondary">{kpi.caption}</Typography>}
                {kpi.id === 'kpi_revisao' && aguardandoRevisao > 0 && (
                  <Button size="small" color="warning" sx={{ display: 'block', mt: 0.5, p: 0 }}
                    onClick={() => navigate('/admin/quotes')}>
                    Revisar agora
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Gráficos linha 1 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {w('chart_receita') && (
          <Paper sx={{ flex: '2 1 400px', p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" color="primary">Receita por dia</Typography>
              <ToggleButtonGroup value={revenueWindow} exclusive size="small"
                onChange={(_, v) => v && setRevenueWindow(v)}>
                <ToggleButton value={7}>7 dias</ToggleButton>
                <ToggleButton value={30}>30 dias</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 11 }} width={60} />
                <RTooltip formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']} />
                <Bar dataKey="receita" fill="#4caf50" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {w('chart_pedidos_dia') && (
          <Paper sx={{ flex: '2 1 400px', p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" color="primary">Pedidos por dia</Typography>
              <ToggleButtonGroup value={revenueWindow} exclusive size="small"
                onChange={(_, v) => v && setRevenueWindow(v)}>
                <ToggleButton value={7}>7 dias</ToggleButton>
                <ToggleButton value={30}>30 dias</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ordersPerDay} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <RTooltip formatter={(v) => [v, 'Pedidos']} />
                <Line type="monotone" dataKey="pedidos" stroke="#2196f3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        )}
      </Box>

      {/* Gráficos linha 2 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {w('chart_materiais') && (
          <Paper sx={{ flex: '2 1 400px', p: 3 }}>
            <Typography variant="h6" color="primary" gutterBottom>Materiais mais usados</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={materiaisData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={80} />
                <RTooltip formatter={(v) => [v, 'Pedidos']} />
                <Bar dataKey="count" fill="#9c27b0" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {w('chart_status_dist') && (
          <Paper sx={{ flex: '1 1 300px', p: 3 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Distribuição ({pedidos.length} total)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false} fontSize={10}>
                    {statusPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v, name) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary" variant="body2">Sem dados.</Typography>
            )}
          </Paper>
        )}
      </Box>

      {/* Listas */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {w('list_fila') && (
          <Paper sx={{ flex: '1 1 300px', p: 3 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Próximos na Fila ({naFila})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {proxNaFila.length === 0
              ? <Typography color="text.secondary" variant="body2">Nenhum pedido na fila.</Typography>
              : (
                <List dense>
                  {proxNaFila.map((p, idx) => (
                    <ListItem key={p.id} divider sx={{ bgcolor: idx === 0 ? '#e3f2fd' : 'transparent' }}>
                      <ListItemText
                        primary={`${idx + 1}. ${p.nome}`}
                        secondary={`${p.nomeMaterial ?? '—'} · ${new Date(p.createdAt).toLocaleDateString('pt-BR')}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )
            }
            <Box display="flex" justifyContent="flex-end" mt={1}>
              <Button size="small" onClick={() => navigate('/admin/orders')}>Gerenciar Pedidos</Button>
            </Box>
          </Paper>
        )}

        {w('list_impressoras') && (
          <Paper sx={{ flex: '1 1 300px', p: 3 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Impressoras ({impressoras.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {impressoras.length === 0
              ? <Typography color="text.secondary" variant="body2">Nenhuma impressora cadastrada.</Typography>
              : (
                <List dense>
                  {impressoras.map(imp => (
                    <ListItem key={imp.id} divider>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2">{imp.nome}</Typography>
                            <Chip label={imp.status} size="small" color={kpiColor(imp.status) as any} />
                          </Box>
                        }
                        secondary={`${imp.modelo} · ${imp.api}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )
            }
            <Box display="flex" justifyContent="flex-end" mt={1}>
              <Button size="small" onClick={() => navigate('/admin/printers')}>Ver Impressoras</Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Dialog: personalizar widgets */}
      <Dialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Personalizar Dashboard</DialogTitle>
        <DialogContent dividers>
          {(['Indicadores', 'Gráficos', 'Listas'] as string[]).map(group => (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>{group}</Typography>
              {ALL_WIDGETS.filter(w => w.group === group).map(widget => (
                <FormControlLabel
                  key={widget.id}
                  control={
                    <Checkbox
                      checked={draftWidgets.has(widget.id)}
                      onChange={() => toggleDraft(widget.id)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{widget.label.split('—')[1]?.trim() ?? widget.label}</Typography>}
                  sx={{ display: 'flex', ml: 0 }}
                />
              ))}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDraftWidgets(new Set(DEFAULT_WIDGETS)); }}>Restaurar padrão</Button>
          <Button onClick={() => setCustomizeOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveCustomize}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
