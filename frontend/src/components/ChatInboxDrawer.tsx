import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, List, ListItem, ListItemButton,
  ListItemText, ListItemAvatar, Avatar, Badge, Divider,
  IconButton, CircularProgress,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import api from '../services/api';
import { ChatDialog } from './ChatDialog';

interface Conversa {
  idPedido: number;
  nomePedido: string;
  nomeCliente?: string;
  ultimaMensagem: string;
  ultimaMensagemEm: string;
  naoLidas: number;
}

interface Props {
  meuTipo: 'admin' | 'client';
  open: boolean;
  onClose: () => void;
}

function formatData(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ChatInboxDrawer({ meuTipo, open, onClose }: Props) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading]     = useState(false);
  const [chatSel, setChatSel]     = useState<{ id: number; nome: string } | null>(null);

  const fetchConversas = useCallback(async () => {
    try {
      const { data } = await api.get<Conversa[]>('/pedidos/mensagens/conversas');
      setConversas(data);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchConversas().finally(() => setLoading(false));
    const id = setInterval(fetchConversas, 10_000);
    return () => clearInterval(id);
  }, [open, fetchConversas]);

  const handleSelect = (c: Conversa) => {
    onClose();
    setChatSel({ id: c.idPedido, nome: c.nomePedido });
  };

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box sx={{ width: 340, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Mensagens</Typography>
            <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
          </Box>

          {loading && (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && conversas.length === 0 && (
            <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
              <Typography color="text.secondary" variant="body2">Nenhuma conversa ainda.</Typography>
            </Box>
          )}

          <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
            {conversas.map((c, idx) => (
              <React.Fragment key={c.idPedido}>
                {idx > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleSelect(c)} sx={{ py: 1.5, px: 2 }}>
                    <ListItemAvatar>
                      <Badge badgeContent={c.naoLidas || 0} color="error">
                        <Avatar sx={{ bgcolor: c.naoLidas > 0 ? 'primary.main' : 'grey.400', width: 40, height: 40 }}>
                          <ChatIcon fontSize="small" />
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2" noWrap sx={{ maxWidth: 180, fontWeight: c.naoLidas > 0 ? 700 : 400 }}>
                            {c.nomePedido}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatData(c.ultimaMensagemEm)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          {meuTipo === 'admin' && c.nomeCliente && (
                            <Typography variant="caption" color="text.secondary" display="block" noWrap>
                              {c.nomeCliente}
                            </Typography>
                          )}
                          <Typography
                            variant="body2" noWrap
                            color={c.naoLidas > 0 ? 'text.primary' : 'text.secondary'}
                            fontWeight={c.naoLidas > 0 ? 600 : 400}
                            sx={{ maxWidth: 220 }}
                          >
                            {c.ultimaMensagem}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Box>
      </Drawer>

      <ChatDialog
        pedidoId={chatSel?.id ?? 0}
        pedidoNome={chatSel?.nome ?? ''}
        meuTipo={meuTipo}
        open={chatSel !== null}
        onClose={() => { setChatSel(null); fetchConversas(); }}
      />
    </>
  );
}
