import React from 'react';
import {
  Box, Button, Container, Typography, Grid, Card, CardContent,
  CardActionArea, Stack, Chip, Paper, Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PrintIcon from '@mui/icons-material/Print';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

const HOW_IT_WORKS = [
  {
    icon: <CloudUploadIcon sx={{ fontSize: 40 }} />,
    step: '01',
    title: 'Envie seu modelo',
    desc: 'Faça upload do arquivo STL. Nosso sistema analisa a geometria e gera um orçamento automático.',
  },
  {
    icon: <AttachMoneyIcon sx={{ fontSize: 40 }} />,
    step: '02',
    title: 'Aprove o orçamento',
    desc: 'Receba o preço calculado com base no tempo, material. Pague com segurança.',
  },
  {
    icon: <PrintIcon sx={{ fontSize: 40 }} />,
    step: '03',
    title: 'Acompanhe',
    desc: 'Monitore o progresso da impressão em tempo real no painel e saiba quando sua peça ficará pronta.',
  },
];

const GALLERY_PHOTOS = [
  '/impressoes/IMG_9876.jpg',
  '/impressoes/IMG_9877.jpg',
  '/impressoes/IMG_9878.jpg',
  '/impressoes/IMG_9879.jpg',
  '/impressoes/IMG_9880.jpg',
  '/impressoes/IMG_9881.jpg',
  '/impressoes/IMG_9882.jpg',
];

const STL_SITES = [
  {
    name: 'Printables',
    url: 'https://www.printables.com',
    desc: 'Biblioteca da Prusa Research com modelos otimizados e garantidos para impressão.',
    color: '#ff6900',
  },
  {
    name: 'Thingiverse',
    url: 'https://www.thingiverse.com',
    desc: 'A maior comunidade de modelos 3D gratuitos do mundo, com milhões de projetos.',
    color: '#248bfb',
  },
  {
    name: 'MyMiniFactory',
    url: 'https://www.myminifactory.com',
    desc: 'Modelos curados por especialistas, todos testados e aprovados para impressão.',
    color: '#e91e63',
  },
  {
    name: 'Makerworld',
    url: 'https://makerworld.com',
    desc: 'Plataforma da Bambu Lab com perfis de impressão prontos para cada modelo.',
    color: '#00bcd4',
  },
];

const POPULAR_MODELS = [
  { name: 'Suporte para Celular', tags: ['Escritório', 'Utilidade'], url: 'https://www.printables.com/search/results?q=phone+stand&ctx=models' },
  { name: 'Vaso Decorativo', tags: ['Decoração'], url: 'https://www.printables.com/search/results?q=vase&ctx=models' },
  { name: 'Suporte para Fones', tags: ['Escritório'], url: 'https://www.printables.com/search/results?q=headphone+stand&ctx=models' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <Box>
      {/* ── Hero ── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 40%, #01579b 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Chip
            label="Impressão 3D Profissional"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mb: 2, fontWeight: 600 }}
          />
          <Typography
            component="h1"
            variant="h2"
            fontWeight={800}
            gutterBottom
            sx={{ fontSize: { xs: '2rem', md: '3.5rem' } }}
          >
            Sua Ideia,<br />Nossa Impressão
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 4, maxWidth: 520, mx: 'auto', fontWeight: 400, display: 'block' }}>
            Transformamos seus modelos digitais em objetos físicos de alta qualidade.
            Upload, orçamento automático e acompanhamento em tempo real.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{ bgcolor: 'white', color: 'primary.dark', fontWeight: 700, px: 4, py: 1.5, '&:hover': { bgcolor: 'grey.100' } }}
            >
              Fazer Pedido
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/login')}
              sx={{ borderColor: 'white', color: 'white', px: 4, py: 1.5, '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              Acessar Conta
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── Como funciona ── */}
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
          Como funciona
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 6 }}>
          Do arquivo STL à peça impressa em três passos simples
        </Typography>

        {/* Fluxo horizontal com setas */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'center', sm: 'stretch' },
            gap: { xs: 1, sm: 0 },
          }}
        >
          {HOW_IT_WORKS.map((item, idx) => (
            <React.Fragment key={item.step}>
              {/* Card do passo */}
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  p: 3,
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1.5,
                  width: { xs: '100%', sm: 'auto' },
                  maxWidth: { xs: 340, sm: 'none' },
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <Box
                  sx={{
                    width: 48, height: 48, borderRadius: '50%',
                    bgcolor: 'primary.main',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 900, fontSize: '0.95rem',
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </Box>
                <Box sx={{ color: 'primary.main' }}>{item.icon}</Box>
                <Typography variant="subtitle1" fontWeight={700}>{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
              </Paper>

              {/* Seta entre passos */}
              {idx < HOW_IT_WORKS.length - 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: { xs: 0, sm: 1.5 },
                    py: { xs: 0.5, sm: 0 },
                    color: 'primary.main',
                    transform: { xs: 'rotate(90deg)', sm: 'none' },
                  }}
                >
                  <ArrowForwardIcon sx={{ fontSize: 28 }} />
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Container>

      <Divider />

      {/* ── Galeria de impressões ── */}
      <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
            <CameraAltIcon color="primary" />
            <Typography variant="h4" fontWeight={700} textAlign="center">
              Nossas Impressões
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 5 }}>
            Exemplos de peças produzidas na nossa farm
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
            }}
          >
            {GALLERY_PHOTOS.map((src, i) => (
              <Box key={i} sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2, lineHeight: 0 }}>
                <img
                  src={src}
                  alt={`Impressão ${i + 1}`}
                  style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Divider />

      {/* ── Sites de STLs gratuitos ── */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
          Onde encontrar modelos gratuitos
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 5 }}>
          Plataformas com milhares de arquivos STL prontos para imprimir
        </Typography>
        <Grid container spacing={3}>
          {STL_SITES.map((site) => (
            <Grid item xs={12} sm={6} md={3} key={site.name}>
              <Card
                sx={{
                  height: '100%', borderRadius: 3,
                  border: '1px solid', borderColor: 'divider',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                }}
                elevation={0}
              >
                <CardActionArea
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Box sx={{ width: '100%', height: 8, background: site.color }} />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6" fontWeight={700} sx={{ color: site.color }}>
                        {site.name}
                      </Typography>
                      <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {site.desc}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Divider />

      {/* ── Modelos populares ── */}
      <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
            Modelos populares para imprimir
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 5 }}>
            Clique para encontrar estes modelos no Printables
          </Typography>
          <Grid container spacing={2}>
            {POPULAR_MODELS.map((model) => (
              <Grid item xs={12} sm={4} key={model.name}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3, border: '1px solid', borderColor: 'divider',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                  }}
                  elevation={0}
                >
                  <CardActionArea href={model.url} target="_blank" rel="noopener noreferrer" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            {model.name}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                            {model.tags.map(tag => (
                              <Chip key={tag} label={tag} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        </Box>
                        <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, flexShrink: 0 }} />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── CTA final ── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
          color: 'white',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Pronto para imprimir?
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, mb: 4 }}>
            Crie sua conta gratuitamente e envie seu primeiro arquivo STL hoje.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{ bgcolor: 'white', color: 'primary.dark', fontWeight: 700, px: 4, '&:hover': { bgcolor: 'grey.100' } }}
            >
              Começar Agora
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
