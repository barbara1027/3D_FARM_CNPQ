import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage() {
  const { login } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const token = p.get('token');
    const tipo = p.get('tipo');
    if (token && tipo) {
      login(token, tipo === 'admin' ? 'admin' : 'client');
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
