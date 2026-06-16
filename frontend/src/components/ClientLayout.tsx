import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, AppBar, Toolbar, Typography, Button, Container,
  IconButton, Badge, Menu, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Avatar, CircularProgress, Alert,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChatInboxDrawer } from './ChatInboxDrawer';
import api from '../services/api';

interface Usuario {
  id: number;
  nome: string;
  email: string;
}

export function ClientLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [chatOpen, setChatOpen]           = useState(false);
  const [unread, setUnread]               = useState(0);
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const [usuario, setUsuario]             = useState<Usuario | null>(null);
  const [editOpen, setEditOpen]           = useState(false);
  const [editNome, setEditNome]           = useState('');
  const [editSenha, setEditSenha]         = useState('');
  const [editLoading, setEditLoading]     = useState(false);
  const [editError, setEditError]         = useState<string | null>(null);
  const [editSuccess, setEditSuccess]     = useState(false);

  const fetchUnread = useCallback(() => {
    api.get<{ idPedido: number; count: number }[]>('/pedidos/mensagens/resumo')
      .then(r => setUnread(r.data.reduce((acc, x) => acc + x.count, 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 15_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  const openAccount = (e: React.MouseEvent<HTMLElement>) => {
    setAccountAnchor(e.currentTarget);
    if (!usuario) {
      api.get<Usuario>('/auth/me').then(r => setUsuario(r.data)).catch(() => {});
    }
  };

  const openEdit = () => {
    setAccountAnchor(null);
    setEditNome(usuario?.nome ?? '');
    setEditSenha('');
    setEditError(null);
    setEditSuccess(false);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!usuario) return;
    setEditLoading(true);
    setEditError(null);
    setEditSuccess(false);
    try {
      const body: any = { nome: editNome };
      if (editSenha.trim()) body.senha = editSenha;
      await api.put(`/usuarios/${usuario.id}`, body);
      setUsuario(u => u ? { ...u, nome: editNome } : u);
      setEditSuccess(true);
      setEditSenha('');
    } catch (e: any) {
      setEditError(e.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 700 }}
            onClick={() => navigate('/dashboard')}
          >
            3D Farm
          </Typography>

          <Button color="inherit" onClick={() => navigate('/dashboard')}>Meus Pedidos</Button>
          <Button color="inherit" onClick={() => navigate('/quotes')}>Orçamentos</Button>
          <Button color="inherit" onClick={() => navigate('/new-order')}>Novo Pedido</Button>

          {/* Ícone de mensagens */}
          <IconButton color="inherit" onClick={() => { setChatOpen(true); setUnread(0); }} sx={{ ml: 1 }}>
            <Badge badgeContent={unread > 0 ? unread : undefined} color="error" max={99}>
              <ChatIcon />
            </Badge>
          </IconButton>

          {/* Ícone de conta */}
          <IconButton color="inherit" onClick={openAccount} sx={{ ml: 0.5 }}>
            <AccountCircleIcon />
          </IconButton>

          <Menu
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={() => setAccountAnchor(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {usuario?.nome ?? '...'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {usuario?.email ?? ''}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={openEdit}>Editar perfil</MenuItem>
            <MenuItem onClick={() => { setAccountAnchor(null); logout(); }} sx={{ color: 'error.main' }}>
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>

      {/* Drawer de mensagens */}
      <ChatInboxDrawer
        meuTipo="client"
        open={chatOpen}
        onClose={() => { setChatOpen(false); fetchUnread(); }}
      />

      {/* Dialog de edição de perfil */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar perfil</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box display="flex" justifyContent="center" mb={2}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 28 }}>
              {(editNome || usuario?.nome || '?')[0].toUpperCase()}
            </Avatar>
          </Box>
          {editError   && <Alert severity="error"   sx={{ mb: 2 }}>{editError}</Alert>}
          {editSuccess && <Alert severity="success" sx={{ mb: 2 }}>Perfil atualizado!</Alert>}
          <TextField
            label="Nome"
            fullWidth
            value={editNome}
            onChange={e => setEditNome(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Nova senha"
            type="password"
            fullWidth
            value={editSenha}
            onChange={e => setEditSenha(e.target.value)}
            helperText="Deixe em branco para não alterar a senha"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editLoading || !editNome.trim()}
            startIcon={editLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {editLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
