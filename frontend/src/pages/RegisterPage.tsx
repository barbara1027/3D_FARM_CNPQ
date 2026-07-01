import { useState } from 'react';
import {
  Box, Button, Container, Paper, TextField, Typography, Alert,
  ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, Divider,
} from '@mui/material';
import { Link } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SchoolIcon from '@mui/icons-material/School';
import BuildIcon from '@mui/icons-material/Build';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

type Nivel = 'iniciante' | 'avancado';

export function RegisterPage() {
  const { login } = useAuth();
  const [nome, setNome]   = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nivel, setNivel] = useState<Nivel>('iniciante');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setError('Preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/usuarios', { nome, email, senha, nivel });
      const { data } = await api.post('/auth/login', { email, senha });
      login(data.token, 'client', nivel);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper sx={{ p: 4, width: '100%' }}>
        <Typography variant="h5" align="center" gutterBottom fontWeight={700}>
          Criar conta na 3D Farm
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            margin="normal" fullWidth required autoFocus
            label="Nome completo"
            value={nome} onChange={e => setNome(e.target.value)}
          />
          <TextField
            margin="normal" fullWidth required
            label="Email" type="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <TextField
            margin="normal" fullWidth required
            label="Senha" type="password"
            value={senha} onChange={e => setSenha(e.target.value)}
            helperText="Mínimo 6 caracteres"
          />

          {/* Seletor de nível */}
          <Box sx={{ mt: 2.5 }}>
            <Box display="flex" alignItems="center" gap={0.5} mb={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                Qual é o seu nível com impressão 3D?
              </Typography>
              <Tooltip title="Clique para entender a diferença" arrow>
                <IconButton size="small" onClick={() => setInfoOpen(true)} sx={{ p: 0.25 }}>
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </IconButton>
              </Tooltip>
            </Box>
            <ToggleButtonGroup
              value={nivel}
              exclusive
              onChange={(_, v) => { if (v) setNivel(v); }}
              fullWidth
              sx={{ gap: 1 }}
            >
              <ToggleButton
                value="iniciante"
                sx={{
                  flex: 1,
                  flexDirection: 'column',
                  py: 1.5,
                  borderRadius: '8px !important',
                  border: '1px solid !important',
                  borderColor: nivel === 'iniciante' ? 'primary.main !important' : 'divider !important',
                  gap: 0.5,
                }}
              >
                <SchoolIcon fontSize="small" />
                <Typography variant="caption" fontWeight={600} lineHeight={1.2}>
                  Iniciante
                </Typography>
                <Typography variant="caption" color="text.secondary" lineHeight={1.2} sx={{ textTransform: 'none' }}>
                  Quero orientação simples
                </Typography>
              </ToggleButton>
              <ToggleButton
                value="avancado"
                sx={{
                  flex: 1,
                  flexDirection: 'column',
                  py: 1.5,
                  borderRadius: '8px !important',
                  border: '1px solid !important',
                  borderColor: nivel === 'avancado' ? 'primary.main !important' : 'divider !important',
                  gap: 0.5,
                }}
              >
                <BuildIcon fontSize="small" />
                <Typography variant="caption" fontWeight={600} lineHeight={1.2}>
                  Avançado
                </Typography>
                <Typography variant="caption" color="text.secondary" lineHeight={1.2} sx={{ textTransform: 'none' }}>
                  Quero controle total
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
              {nivel === 'iniciante'
                ? 'Você verá opções simplificadas com explicações em tudo. Pode mudar depois no perfil.'
                : 'Você terá acesso a todos os parâmetros técnicos de impressão. Pode mudar depois no perfil.'}
            </Typography>
          </Box>

          <Button
            type="submit" fullWidth variant="contained"
            sx={{ mt: 3, py: 1.2 }}
            disabled={loading}
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }}>ou cadastre-se com</Divider>

        <Button
          fullWidth variant="outlined" startIcon={<GoogleIcon />}
          href={`${api.defaults.baseURL}/auth/google`}
        >
          Continuar com Google
        </Button>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: 14 }}>Já tem conta? Entrar</Link>
        </Box>
      </Paper>

      {/* Dialog explicando a diferença entre iniciante e avançado */}
      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Qual nível escolher?</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <SchoolIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Iniciante</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Não sei muito sobre impressão 3D e prefiro que o sistema escolha os melhores parâmetros para mim.
              Verei explicações simples em cada opção, sem jargão técnico. Ideal para quem está fazendo o primeiro pedido.
            </Typography>
          </Box>
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <BuildIcon color="secondary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Avançado</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Conheço os parâmetros de impressão 3D (altura de camada, velocidade, perímetros, preenchimento) e quero
              ajustá-los por pedido. O sistema me dará acesso a todos os controles técnicos disponíveis.
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Você pode mudar o nível a qualquer momento no seu perfil.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
