import {
  Box, Tooltip, CssBaseline, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  AppBar, Badge,
} from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PrintIcon from '@mui/icons-material/Print';
import LogoutIcon from '@mui/icons-material/Logout';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CategoryIcon from '@mui/icons-material/Category';
import TuneIcon from '@mui/icons-material/Tune';
import ChatIcon from '@mui/icons-material/Chat';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationsDrawer } from './NotificationsDrawer';
import { ChatInboxDrawer } from './ChatInboxDrawer';
import api from '../services/api';
import type { Pedido } from '../types/Pedido';
import type { Impressora } from '../types/Impressora';

const DRAWER_WIDTH = 240;

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [naFilaCount, setNaFilaCount] = useState(0);
  const [erroCount, setErroCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  const fetchCounts = useCallback(async () => {
    try {
      const [pedidosRes, impressorasRes] = await Promise.all([
        api.get<Pedido[]>('/pedidos'),
        api.get<Impressora[]>('/impressoras'),
      ]);
      setNaFilaCount(pedidosRes.data.filter((p) => p.status === 'na_fila').length);
      setErroCount(impressorasRes.data.filter((i) => i.status === 'Erro').length);
    } catch { /* silencioso */ }
  }, []);

  const fetchChatUnread = useCallback(async () => {
    try {
      const { data } = await api.get<{ idPedido: number; count: number }[]>('/pedidos/mensagens/resumo');
      setChatUnread(data.reduce((acc, x) => acc + x.count, 0));
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    fetchCounts();
    fetchChatUnread();
    const interval = setInterval(() => { fetchCounts(); fetchChatUnread(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchCounts, fetchChatUnread]);

  const totalAlerts = naFilaCount + erroCount;

  const menuItems = [
    { text: 'Dashboard',   icon: <DashboardIcon />,    path: '/admin/dashboard' },
    { text: 'Pedidos',     icon: <ShoppingCartIcon />, path: '/admin/orders',    count: naFilaCount },
    { text: 'Orçamentos',  icon: <RequestQuoteIcon />, path: '/admin/quotes' },
    { text: 'Materiais',   icon: <CategoryIcon />,     path: '/admin/materials' },
    { text: 'Qualidades',  icon: <TuneIcon />,          path: '/admin/qualidades' },
    { text: 'Impressoras', icon: <PrintIcon />,         path: '/admin/printers',  count: erroCount },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Painel 3D Farm
          </Typography>
          <Tooltip title="Novo Pedido">
            <IconButton color="inherit" onClick={() => navigate('/admin/new-order')}>
              <AddCircleOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Mensagens">
            <IconButton color="inherit" onClick={() => { setChatOpen(true); setChatUnread(0); }}>
              <Badge badgeContent={chatUnread > 0 ? chatUnread : undefined} color="error" max={99}>
                <ChatIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Notificações">
            <IconButton color="inherit" onClick={() => setDrawerOpen(true)}>
              <Badge badgeContent={totalAlerts} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <React.Fragment key={item.text}>
                <Tooltip
                  title={item.count ? `${item.count} item(s) pendente(s)` : ''}
                  placement="right"
                >
                  <ListItem disablePadding onClick={() => navigate(item.path)}>
                    <ListItemButton>
                      <Badge
                        badgeContent={item.count || 0}
                        color="error"
                        variant="dot"
                        invisible={!item.count}
                      >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                      </Badge>
                      <ListItemText primary={item.text} sx={{ ml: item.count ? 1 : 0 }} />
                    </ListItemButton>
                  </ListItem>
                </Tooltip>
              </React.Fragment>
            ))}
          </List>

          <List>
            <ListItem disablePadding onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}>
              <ListItemButton>
                <ListItemIcon><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Sair" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>

      <NotificationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        totalAlerts={totalAlerts}
      />

      <ChatInboxDrawer
        meuTipo="admin"
        open={chatOpen}
        onClose={() => { setChatOpen(false); fetchChatUnread(); }}
      />
    </Box>
  );
}
