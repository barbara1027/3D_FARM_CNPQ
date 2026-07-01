import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage() {
  const { login } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Token vem no fragment (#token=...&tipo=...) para não aparecer em logs do servidor
    const hash = location.hash.replace(/^#/, '');
    const p = new URLSearchParams(hash);
    const token = p.get('token');
    const tipo  = p.get('tipo');
    const nivel = p.get('nivel') ?? undefined;
    if (token && tipo) {
      login(token, tipo === 'admin' ? 'admin' : 'client', nivel);
    } else {
      window.location.href = '/login';
    }
  }, []); // eslint-disable-line

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6">Autenticando com Google...</Typography>
      </Paper>
    </Box>
  );
}
