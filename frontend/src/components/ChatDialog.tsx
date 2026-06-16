import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, CircularProgress,
  IconButton, Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import api from '../services/api';

interface ChatMensagem {
  id: number;
  idPedido: number;
  idRemetente: number;
  nomeRemetente: string;
  tipoRemetente: 'admin' | 'cliente';
  mensagem: string;
  lido: boolean;
  criadoEm: string;
}

interface Props {
  pedidoId: number;
  pedidoNome: string;
  meuTipo: 'admin' | 'client'; // frontend usa 'client', backend usa 'cliente'
  open: boolean;
  onClose: () => void;
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ChatDialog({ pedidoId, pedidoNome, meuTipo, open, onClose }: Props) {
  const [mensagens, setMensagens]     = useState<ChatMensagem[]>([]);
  const [texto, setTexto]             = useState('');
  const [sending, setSending]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const meuTipoBackend                = meuTipo === 'admin' ? 'admin' : 'cliente';

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const fetchMensagens = useCallback(async () => {
    try {
      const { data } = await api.get<ChatMensagem[]>(`/pedidos/${pedidoId}/mensagens`);
      setMensagens(data);
      scrollBottom();
    } finally {
      setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 5_000);
    return () => clearInterval(interval);
  }, [open, fetchMensagens]);

  const handleSend = async () => {
    const msg = texto.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await api.post(`/pedidos/${pedidoId}/mensagens`, { mensagem: msg });
      setTexto('');
      await fetchMensagens();
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span">Chat</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }} component="span">
            {pedidoNome}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          height: 380,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          p: 2,
          bgcolor: '#f9f9f9',
        }}
      >
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress size={28} />
          </Box>
        )}

        {!loading && mensagens.length === 0 && (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <Typography color="text.secondary" variant="body2">
              Nenhuma mensagem ainda. Inicie a conversa!
            </Typography>
          </Box>
        )}

        {mensagens.map(m => {
          const isMe = m.tipoRemetente === meuTipoBackend;
          return (
            <Box
              key={m.id}
              sx={{
                display: 'flex',
                justifyContent: isMe ? 'flex-end' : 'flex-start',
                mb: 0.5,
              }}
            >
              <Box
                sx={{
                  maxWidth: '78%',
                  px: 1.5,
                  py: 1,
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  bgcolor: isMe ? 'primary.main' : '#fff',
                  color: isMe ? '#fff' : 'text.primary',
                  boxShadow: 1,
                }}
              >
                {!isMe && (
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 'bold', opacity: 0.85, display: 'block', mb: 0.3 }}
                  >
                    {m.nomeRemetente}
                    <Chip
                      label={m.tipoRemetente}
                      size="small"
                      sx={{ ml: 0.5, height: 16, fontSize: 10, bgcolor: 'rgba(0,0,0,0.08)' }}
                    />
                  </Typography>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.mensagem}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: 'right',
                    mt: 0.3,
                    opacity: 0.65,
                    fontSize: 10,
                  }}
                >
                  {formatHora(m.criadoEm)}
                  {isMe && !m.lido && ' · não lida'}
                </Typography>
              </Box>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </DialogContent>

      <DialogActions sx={{ p: 1.5, gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="Digite sua mensagem... (Enter para enviar)"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={sending || !texto.trim()}
          sx={{ flexShrink: 0 }}
        >
          {sending ? <CircularProgress size={20} /> : <SendIcon />}
        </IconButton>
      </DialogActions>
    </Dialog>
  );
}
