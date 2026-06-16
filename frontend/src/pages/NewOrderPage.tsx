import React, { useState, useEffect } from 'react';
import {
  Box, Button, Container, Paper, Step, StepLabel, Stepper, Typography,
  CircularProgress, Alert, TextField, FormControl, InputLabel, Select,
  MenuItem, Skeleton, IconButton, type SelectChangeEvent,
  List, ListItem, ListItemText, Divider, Chip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import type { Material } from '../types/Material';
import type { QualidadeImpressao } from '../types/QualidadeImpressao';
import { normalizeMaterial, normalizeQualidade } from '../utils/normalize';

const STEPS = ['Upload do Arquivo', 'Configuração de Impressão', 'Confirmação e Envio'];

const QUALITY_INFO: Record<string, { title: string; description: string; detail: string; tempo: string; color: string }> = {
  normal: {
    title: 'Normal',
    description: 'Ideal para peças utilitárias e protótipos',
    detail: 'Camada de 0.2mm. Boa resistência mecânica com acabamento adequado para a maioria das aplicações. Camadas levemente visíveis. Melhor custo-benefício.',
    tempo: 'Tempo padrão',
    color: '#4caf50',
  },
  qualidade: {
    title: 'Qualidade',
    description: 'Bom acabamento para peças decorativas',
    detail: 'Camada de 0.15mm. Camadas menos visíveis, ótimo para peças decorativas e apresentações. Tempo de impressão ~30% maior que o Normal.',
    tempo: '~30% mais lento',
    color: '#2196f3',
  },
  alta: {
    title: 'Alta Qualidade',
    description: 'Máximo detalhe para peças finas',
    detail: 'Camada de 0.1mm. Camadas quase invisíveis, ideal para miniaturas, joias e peças com detalhes finos. Tempo de impressão 2–3× maior. Custo mais elevado.',
    tempo: '2–3× mais lento',
    color: '#9c27b0',
  },
};

// Step 1 — Upload
function UploadStep({ files, onFiles }: { files: File[]; onFiles: (f: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'model/stl': ['.stl'], 'application/octet-stream': ['.stl'] },
    onDrop: (accepted) => accepted.length > 0 && onFiles(accepted),
  });

  return (
    <Box>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.400',
          borderRadius: 3, p: 6, textAlign: 'center', cursor: 'pointer',
          bgcolor: isDragActive ? 'primary.50' : 'grey.50',
          transition: 'all 0.2s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 64, color: isDragActive ? 'primary.main' : 'grey.400', mb: 2 }} />
        <Typography variant="h6" fontWeight={600}>
          {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste e solte o arquivo .STL aqui'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          ou clique para selecionar
        </Typography>
      </Box>

      {files.length > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'success.200' }}>
          <List dense disablePadding>
            {files.map((f) => (
              <ListItem key={f.name} disablePadding>
                <InsertDriveFileIcon sx={{ mr: 1, color: 'success.main' }} />
                <ListItemText
                  primary={f.name}
                  secondary={`${(f.size / 1024 / 1024).toFixed(2)} MB`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

// Step 2 — Configuração (simplificada)
interface OrderData {
  projectName: string;
  idMaterial: number | '';
  materialSpec: string;
  qualityPreset: 'normal' | 'qualidade' | 'alta';
  layerHeight: string;
  infill: string;
  printSpeed: string;
  supports: string;
  adhesion: string;
  description: string;
  idQualidade: number | '';
  quantidade: number;
  perimeters: number;
  topLayers: number;
  bottomLayers: number;
  supportAngle: number;
  tempBico: number;
  tempMesa: number;
  fanMin: number;
  fanMax: number;
}

const EMPTY: OrderData = {
  projectName: '',
  idMaterial: '',
  materialSpec: '',
  qualityPreset: 'normal',
  layerHeight: '0.2',
  infill: '15',
  printSpeed: '50',
  supports: 'none',
  adhesion: 'none',
  description: '',
  idQualidade: '',
  quantidade: 1,
  perimeters: 2,
  topLayers: 3,
  bottomLayers: 3,
  supportAngle: 45,
  tempBico: 0,
  tempMesa: 0,
  fanMin: 50,
  fanMax: 100,
};

function midpoint(min: number | null, max: number | null, fallback: number): number {
  if (min == null || max == null) return fallback;
  return Math.round((min + max) / 2);
}

function ConfigStep({
  data, onChange, materiais, qualidades, loadingMateriais, loadingQualidades,
}: {
  data: OrderData;
  onChange: (field: keyof OrderData, value: any) => void;
  materiais: Material[];
  qualidades: QualidadeImpressao[];
  loadingMateriais: boolean;
  loadingQualidades: boolean;
}) {
  const [infoQuality, setInfoQuality] = useState<string | null>(null);

  const mat = materiais.find(m => m.id === data.idMaterial) ?? null;

  const handleMaterialChange = (e: SelectChangeEvent) => {
    const id = Number(e.target.value);
    const m  = materiais.find(x => x.id === id);
    onChange('idMaterial', id);
    onChange('materialSpec', m?.nome ?? '');
    if (m) {
      onChange('tempBico', midpoint(m.tempBicoMin, m.tempBicoMax, 0));
      onChange('tempMesa', midpoint(m.tempMesaMin, m.tempMesaMax, 0));
      onChange('fanMin', m.fanMin ?? 50);
      onChange('fanMax', m.fanMax ?? 100);
    }
  };

  const handleSelectQuality = (preset: 'normal' | 'qualidade' | 'alta') => {
    onChange('qualityPreset', preset);
    const heightMap: Record<string, string> = { normal: '0.2', qualidade: '0.15', alta: '0.1' };
    const h = heightMap[preset];
    onChange('layerHeight', h);
    const qual = qualidades.find(q => Math.abs(q.altura - parseFloat(h)) < 0.005);
    if (qual) {
      onChange('idQualidade', qual.id);
      onChange('infill',        String(qual.preenchimento));
      onChange('printSpeed',    String(qual.velocidade));
      onChange('perimeters',    qual.perimetros);
      onChange('topLayers',     qual.camadasTopo);
      onChange('bottomLayers',  qual.camadasBase);
      onChange('supportAngle',  qual.anguloSuporte);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Nome do projeto */}
      <TextField
        label="Nome do projeto *"
        fullWidth required
        value={data.projectName}
        onChange={(e) => onChange('projectName', e.target.value)}
      />

      {/* Material */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Material</Typography>
        {loadingMateriais ? <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} /> : (
          <FormControl fullWidth required>
            <InputLabel>Filamento</InputLabel>
            <Select
              label="Filamento"
              value={data.idMaterial === '' ? '' : String(data.idMaterial)}
              onChange={handleMaterialChange}
            >
              {materiais.length === 0
                ? <MenuItem disabled value="">Nenhum material disponível</MenuItem>
                : materiais.map(m => (
                  <MenuItem key={m.id} value={String(m.id)}>
                    {m.nome} ({m.tipo})
                  </MenuItem>
                ))
              }
            </Select>
          </FormControl>
        )}
        {mat && (
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small" label={`Ø ${mat.diametro}mm`} variant="outlined" />
            {mat.tempBicoMin != null && <Chip size="small" label={`Bico: ${mat.tempBicoMin}–${mat.tempBicoMax}°C`} variant="outlined" />}
            {mat.tempMesaMin != null && <Chip size="small" label={`Mesa: ${mat.tempMesaMin}–${mat.tempMesaMax}°C`} variant="outlined" />}
          </Box>
        )}
      </Box>

      {/* Quantidade */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Quantidade de peças</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton
            size="small"
            onClick={() => onChange('quantidade', Math.max(1, data.quantidade - 1))}
            disabled={data.quantidade <= 1}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <TextField
            type="number"
            value={data.quantidade}
            onChange={e => onChange('quantidade', Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1, style: { textAlign: 'center' } }}
            sx={{ width: 72 }}
            size="small"
          />
          <IconButton
            size="small"
            onClick={() => onChange('quantidade', data.quantidade + 1)}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Qualidade */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Qualidade de impressão</Typography>
        {loadingQualidades ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} /> : (
          <Grid container spacing={2}>
            {(['normal', 'qualidade', 'alta'] as const).map(preset => {
              const info = QUALITY_INFO[preset];
              const selected = data.qualityPreset === preset;
              return (
                <Grid item xs={12} sm={4} key={preset}>
                  <Card
                    onClick={() => handleSelectQuality(preset)}
                    sx={{
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: selected ? info.color : 'divider',
                      borderRadius: 3,
                      transition: 'all 0.15s',
                      bgcolor: selected ? `${info.color}10` : 'background.paper',
                      '&:hover': { borderColor: info.color, boxShadow: 3 },
                    }}
                    elevation={0}
                  >
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ color: selected ? info.color : 'text.primary' }}>
                            {info.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {info.description}
                          </Typography>
                          <Chip
                            size="small"
                            label={info.tempo}
                            sx={{ mt: 0.5, bgcolor: `${info.color}20`, color: info.color, fontWeight: 600 }}
                          />
                        </Box>
                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                          {selected && <CheckCircleIcon sx={{ color: info.color, fontSize: 20 }} />}
                          <IconButton
                            size="small"
                            onClick={e => { e.stopPropagation(); setInfoQuality(preset); }}
                            title={`Saiba mais sobre ${info.title}`}
                          >
                            <InfoOutlinedIcon fontSize="small" color="action" />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Descrição */}
      <TextField
        label="Observações (opcional)"
        multiline rows={3} fullWidth
        placeholder="Ex: precisa de alta resistência ao calor, acabamento especial..."
        value={data.description}
        onChange={e => onChange('description', e.target.value)}
      />

      {/* Modal de informação de qualidade */}
      <Dialog open={infoQuality !== null} onClose={() => setInfoQuality(null)} maxWidth="xs" fullWidth>
        {infoQuality && (
          <>
            <DialogTitle sx={{ color: QUALITY_INFO[infoQuality].color, fontWeight: 700 }}>
              Qualidade {QUALITY_INFO[infoQuality].title}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                {QUALITY_INFO[infoQuality].detail}
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Impacto no tempo:</strong> {QUALITY_INFO[infoQuality].tempo}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInfoQuality(null)}>Fechar</Button>
              <Button
                variant="contained"
                onClick={() => { handleSelectQuality(infoQuality as any); setInfoQuality(null); }}
                sx={{ bgcolor: QUALITY_INFO[infoQuality].color }}
              >
                Selecionar esta qualidade
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

// Step 3 — Confirmação
function ConfirmationStep({ files, data, mat }: { files: File[]; data: OrderData; mat: Material | null }) {
  const info = QUALITY_INFO[data.qualityPreset];
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Confirme os detalhes do pedido</Typography>
      <List disablePadding dense>
        <ListItem>
          <ListItemText primary="Arquivo" secondary={files.length > 0 ? files.map(f => f.name).join(', ') : 'Nenhum'} />
        </ListItem>
        <ListItem><ListItemText primary="Nome do projeto" secondary={data.projectName || '—'} /></ListItem>
        <Divider component="li" />
        <ListItem><ListItemText primary="Material" secondary={`${data.materialSpec || '—'}${mat ? ` — Ø ${mat.diametro}mm` : ''}`} /></ListItem>
        <ListItem><ListItemText primary="Quantidade" secondary={`${data.quantidade} unidade${data.quantidade > 1 ? 's' : ''}`} /></ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText
            primary="Qualidade de impressão"
            secondary={info ? `${info.title} — ${info.description}` : data.qualityPreset}
          />
        </ListItem>
        {data.description && (
          <>
            <Divider component="li" />
            <ListItem><ListItemText primary="Observações" secondary={data.description} /></ListItem>
          </>
        )}
      </List>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Ao clicar em "Finalizar", o pedido será enviado para análise e orçamento automático.
      </Typography>
    </Paper>
  );
}

// Página principal
export function NewOrderPage() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(0);
  const [files, setFiles]   = useState<File[]>([]);
  const [data, setData]     = useState<OrderData>(EMPTY);
  const [materiais, setMateriais]   = useState<Material[]>([]);
  const [qualidades, setQualidades] = useState<QualidadeImpressao[]>([]);
  const [loadingMat, setLoadingMat]   = useState(true);
  const [loadingQual, setLoadingQual] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [apiError, setApiError]       = useState<string | null>(null);

  useEffect(() => {
    api.get<any[]>('/materiais')
      .then(r => {
        const disp = r.data.map(normalizeMaterial).filter((m: Material) => m.status === 'disponivel');
        setMateriais(disp);
        if (disp.length > 0) {
          const m = disp[0];
          setData(p => ({
            ...p,
            idMaterial: m.id, materialSpec: m.nome,
            tempBico: midpoint(m.tempBicoMin, m.tempBicoMax, 0),
            tempMesa: midpoint(m.tempMesaMin, m.tempMesaMax, 0),
            fanMin: m.fanMin ?? 50, fanMax: m.fanMax ?? 100,
          }));
        }
      })
      .finally(() => setLoadingMat(false));

    api.get<any[]>('/qualidades')
      .then(r => {
        const qs = r.data.map(normalizeQualidade);
        setQualidades(qs);
        const normal = qs.find((q: QualidadeImpressao) => Math.abs(q.altura - 0.2) < 0.01) ?? qs[0];
        if (normal) {
          setData(p => ({
            ...p,
            idQualidade: normal.id,
            perimeters: normal.perimetros,
            topLayers: normal.camadasTopo,
            bottomLayers: normal.camadasBase,
            supportAngle: normal.anguloSuporte,
            infill: String(normal.preenchimento),
            printSpeed: String(normal.velocidade),
          }));
        }
      })
      .finally(() => setLoadingQual(false));
  }, []);

  const handleChange = (field: keyof OrderData, value: any) =>
    setData(p => ({ ...p, [field]: value }));

  const canNext = () => {
    if (step === 0) return files.length > 0;
    if (step === 1) return data.projectName.trim() !== '' && data.idMaterial !== '' && data.idQualidade !== '';
    return true;
  };

  const mat = materiais.find(m => m.id === data.idMaterial) ?? null;

  const handleFinish = async () => {
    if (files.length === 0 || !data.idMaterial || !data.idQualidade) {
      setApiError('Selecione arquivo, material e qualidade.');
      return;
    }
    setSubmitting(true);
    setApiError(null);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('arquivo', f));
      const { data: arq } = await api.post<{ id: number }>('/arquivos/upload', fd);

      await api.post('/pedidos', {
        nome:        data.projectName,
        preco:       0,
        descricao:   data.description || null,
        idMaterial:  data.idMaterial,
        idQualidade: data.idQualidade,
        idArquivo:   arq.id,
        quantidade:  data.quantidade,
        parametros: {
          layerHeight:   data.layerHeight,
          infill:        data.infill,
          printSpeed:    data.printSpeed,
          supports:      data.supports,
          adhesion:      data.adhesion,
          qualityPreset: data.qualityPreset,
          materialSpec:  data.materialSpec,
          perimeters:    String(data.perimeters),
          topLayers:     String(data.topLayers),
          bottomLayers:  String(data.bottomLayers),
          supportAngle:  String(data.supportAngle),
          fanMin:        String(data.fanMin),
          fanMax:        String(data.fanMax),
          ...(data.tempBico > 0 && { tempBico: String(data.tempBico) }),
          ...(data.tempMesa > 0 && { tempMesa: String(data.tempMesa) }),
        },
      });

      navigate('/quotes');
    } catch (e: any) {
      setApiError(e.response?.data?.message ?? 'Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container component="main" maxWidth="md" sx={{ mb: 4 }}>
      <Paper variant="outlined" sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 4 }, borderRadius: 3 }}>
        <Typography component="h1" variant="h4" fontWeight={700} align="center" gutterBottom>
          Nova Cotação
        </Typography>

        <Stepper activeStep={step} sx={{ pt: 3, pb: 5 }}>
          {STEPS.map(l => <Step key={l}><StepLabel>{l}</StepLabel></Step>)}
        </Stepper>

        {step === 0 && <UploadStep files={files} onFiles={setFiles} />}
        {step === 1 && (
          <ConfigStep
            data={data}
            onChange={handleChange}
            materiais={materiais}
            qualidades={qualidades}
            loadingMateriais={loadingMat}
            loadingQualidades={loadingQual}
          />
        )}
        {step === 2 && (
          <>
            <ConfirmationStep files={files} data={data} mat={mat} />
            {apiError && <Alert severity="error" sx={{ mt: 2 }}>{apiError}</Alert>}
          </>
        )}

        <Box display="flex" justifyContent="flex-end" gap={1} mt={4}>
          {step > 0 && (
            <Button onClick={() => setStep(s => s - 1)} disabled={submitting}>Voltar</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="contained" size="large" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Próximo
            </Button>
          ) : (
            <Button variant="contained" size="large" onClick={handleFinish} disabled={submitting || !canNext()}>
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Finalizar'}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
