import { useState, useEffect } from 'react';
import {
  Drawer, Box, Typography, List, ListItem, ListItemText,
  CircularProgress, Divider, Chip, Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Pedido } from '../types/Pedido';
import type { Impressora } from '../types/Impressora';
import { getStatusTranslation } from '../utils/translations';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  totalAlerts: number;
}

export function NotificationsDrawer({ open, onClose, totalAlerts }: NotificationsDrawerProps) {
  const navigate = useNavigate();
  const [pedidosNaFila, setPedidosNaFila] = useState<Pedido[]>([]);
  const [impressorasComErro, setImpressorasComErro] = useState<Impressora[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    Promise.all([
      api.get<Pedido[]>('/pedidos'),
      api.get<Impressora[]>('/impressoras'),
    ])
      .then(([pedidosRes, impressorasRes]) => {
        setPedidosNaFila(pedidosRes.data.filter((p) => p.status === 'na_fila'));
        setImpressorasComErro(impressorasRes.data.filter((i) => i.status === 'Erro'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 380 } }}>
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6">Alertas ({totalAlerts})</Typography>
        <Typography variant="body2">{new Date().toLocaleString('pt-BR')}</Typography>
      </Box>
      <Divider />

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : (
        <List dense>

          <Box sx={{ px: 2, py: 1, bgcolor: '#ffebee' }}>
            <Typography variant="subtitle2">Erros de hardware ({impressorasComErro.length})</Typography>
          </Box>
          {impressorasComErro.length === 0 ? (
            <ListItem><ListItemText secondary="Nenhum erro de hardware." /></ListItem>
          ) : (
            impressorasComErro.map((imp) => (
              <ListItem
                key={imp.id}
                secondaryAction={
                  <Button size="small" onClick={() => { navigate('/admin/printers'); onClose(); }}>
                    Gerenciar
                  </Button>
                }
              >
                <ListItemText
                  primary={imp.nome}
                  secondary={`Erro: ${imp.ultimoErro ?? 'desconhecido'}`}
                />
              </ListItem>
            ))
          )}

          <Divider />

          <Box sx={{ px: 2, py: 1, bgcolor: '#e3f2fd' }}>
            <Typography variant="subtitle2">Pedidos na fila ({pedidosNaFila.length})</Typography>
          </Box>
          {pedidosNaFila.length === 0 ? (
            <ListItem><ListItemText secondary="Nenhum pedido aguardando." /></ListItem>
          ) : (
            pedidosNaFila.map((p) => (
              <ListItem
                key={p.id}
                secondaryAction={
                  <Button size="small" onClick={() => { navigate('/admin/orders'); onClose(); }}>
                    Ver
                  </Button>
                }
              >
                <ListItemText
                  primary={p.nome}
                  secondary={
                    <>
                      {p.emailUsuario && `Cliente: ${p.emailUsuario} · `}
                      <Chip
                        label={getStatusTranslation(p.status)}
                        size="small"
                        sx={{ height: 16, fontSize: 10 }}
                      />
                    </>
                  }
                />
              </ListItem>
            ))
          )}

        </List>
      )}
    </Drawer>
  );
}
