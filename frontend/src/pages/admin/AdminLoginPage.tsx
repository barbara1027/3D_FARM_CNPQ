import { useState } from 'react';
import { Box, Button, Container, Divider, Paper, TextField, Typography, Alert } from '@mui/material';
import { Link } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function AdminLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      if (data.tipo !== 'admin') {
        setError('Conta sem permissão de administrador.');
        return;
      }
      login(data.token, 'admin');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Email ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper sx={{ p: 4, width: '100%' }}>
        <Typography variant="h5" align="center" gutterBottom>Acesso Administrativo</Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField margin="normal" fullWidth required autoFocus
            label="Email" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField margin="normal" fullWidth required
            label="Senha" type="password"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }}>ou</Divider>

        <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
          href="http://localhost:3333/auth/google">
          Entrar com Google
        </Button>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: 14 }}>Acessar como cliente</Link>
        </Box>
      </Paper>
    </Container>
  );
}
