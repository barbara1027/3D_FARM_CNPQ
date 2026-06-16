import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, Card, CardContent,
  Button, Divider, CircularProgress, Alert, Chip, Avatar,
  List, ListItem, ListItemText, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend,
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

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos]               = useState<Pedido[]>([]);
  const [impressoras, setImpressoras]       = useState<Impressora[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [revenueWindow, setRevenueWindow]   = useState<RevenueWindow>(7);

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

  // Revenue chart data
  const revenueData = buildRevenueChart(pedidos, revenueWindow);

  const proxNaFila = pedidos
    .filter(p => p.status === 'na_fila')
    .slice(0, 5);

  const STATUS_DIST: { label: string; status: StatusPedido; color: string }[] = [
    { label: 'Na fila',      status: 'na_fila',      color: '#2196f3' },
    { label: 'Em impressão', status: 'em_impressao', color: '#9c27b0' },
    { label: 'Concluído',    status: 'concluido',    color: '#4caf50' },
    { label: 'Falhou',       status: 'falhou',       color: '#f44336' },
    { label: 'Cancelado',    status: 'cancelado',    color: '#ff9800' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>

      {/* KPIs — linha 1 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        {[
          { label: 'Na Fila',        value: naFila,               icon: <AssignmentIcon />,   color: '#2196f3' },
          { label: 'Em Impressão',   value: imprimindo,           icon: <PrintIcon />,        color: '#9c27b0' },
          { label: 'Concluídos',     value: concluidos,           icon: <ShoppingCartIcon />, color: '#4caf50' },
          { label: 'Receita Total',  value: `R$ ${receita.toFixed(2)}`, icon: <CategoryIcon />, color: '#ff9800' },
        ].map(kpi => (
          <Card key={kpi.label} sx={{ flex: '1 1 180px' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Avatar sx={{ bgcolor: kpi.color, width: 32, height: 32 }}>{kpi.icon}</Avatar>
                <Typography variant="body2" color="text.secondary">{kpi.label}</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">{kpi.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* KPIs — linha 2 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Avatar sx={{ bgcolor: '#607d8b', width: 32, height: 32 }}><AccessTimeIcon /></Avatar>
              <Typography variant="body2" color="text.secondary">Tempo Médio de Impressão</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold">
              {avgPrintTimeS != null ? formatDuration(avgPrintTimeS) : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pedidosComTempo.length} pedidos concluídos com dados
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Avatar sx={{ bgcolor: '#e91e63', width: 32, height: 32 }}><ErrorOutlineIcon /></Avatar>
              <Typography variant="body2" color="text.secondary">Taxa de Falha</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold" color={failureRate > 15 ? 'error' : 'text.primary'}>
              {failureRate.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {falhou} falhou / {finalizados} finalizados
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Avatar sx={{ bgcolor: '#009688', width: 32, height: 32 }}><CategoryIcon /></Avatar>
              <Typography variant="body2" color="text.secondary">Material Mais Usado</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold">
              {topMaterial ? topMaterial[0] : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {topMaterial ? `${topMaterial[1]} pedidos` : 'sem dados'}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: '1 1 180px', borderLeft: aguardandoRevisao > 0 ? '4px solid #ff9800' : undefined }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Avatar sx={{ bgcolor: '#ff9800', width: 32, height: 32 }}><RateReviewIcon /></Avatar>
              <Typography variant="body2" color="text.secondary">Aguardando Revisão</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold" color={aguardandoRevisao > 0 ? 'warning.main' : 'text.primary'}>
              {aguardandoRevisao}
            </Typography>
            {aguardandoRevisao > 0 && (
              <Button size="small" color="warning" sx={{ mt: 0.5, p: 0 }} onClick={() => navigate('/admin/quotes')}>
                Revisar agora
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Gráfico de receita */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" color="primary">
            Receita por dia (pedidos concluídos)
          </Typography>
          <ToggleButtonGroup
            value={revenueWindow}
            exclusive
            size="small"
            onChange={(_, v) => v && setRevenueWindow(v)}
          >
            <ToggleButton value={7}>7 dias</ToggleButton>
            <ToggleButton value={30}>30 dias</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']} />
            <Bar dataKey="receita" fill="#4caf50" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>

        {/* Distribuição de pedidos */}
        <Paper sx={{ flex: '1 1 300px', p: 3 }}>
          <Typography variant="h6" color="primary" gutterBottom>
            Distribuição ({pedidos.length} total)
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {STATUS_DIST.map(({ label, status, color }) => {
            const count = countStatus(status);
            const pct   = pedidos.length > 0 ? (count / pedidos.length) * 100 : 0;
            return (
              <Box key={status} sx={{ mb: 1.5 }}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '50%' }} />
                    <Typography variant="body2">{label}</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {count} ({pct.toFixed(0)}%)
                  </Typography>
                </Box>
                <Box sx={{ height: 6, borderRadius: 5, bgcolor: 'grey.200' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 5 }} />
                </Box>
              </Box>
            );
          })}
        </Paper>

        {/* Próximos na fila */}
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

        {/* Estado das impressoras */}
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
      </Box>
    </Container>
  );
}
