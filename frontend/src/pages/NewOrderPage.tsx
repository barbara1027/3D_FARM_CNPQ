import React, { useState, useEffect } from 'react';
import {
  Box, Button, Container, Paper, Step, StepLabel, Stepper, Typography,
  CircularProgress, Alert, TextField, FormControl, InputLabel, Select,
  MenuItem, Skeleton, IconButton, type SelectChangeEvent,
  List, ListItem, ListItemText, Divider, Chip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse, Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
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

const INFILL_OPTIONS = [
  {
    value: '0',
    label: '0%',
    title: 'Vazio',
    short: 'Oco por dentro. Mínimo peso e custo, mas muito frágil.',
    detail: 'A peça é impressa apenas com as paredes externas, sem nenhum preenchimento interno. É extremamente leve e rápida de imprimir, mas fraquíssima — qualquer pressão ou impacto pode quebrá-la. Use apenas para peças decorativas que nunca serão manuseadas com força.',
  },
  {
    value: '20',
    label: '20%',
    title: 'Leve',
    short: 'Leve e econômico. Bom para decoração e protótipos simples.',
    detail: 'Preenchimento esparso, parecido com uma colmeia interna. Economiza muito material e tempo. Funciona bem para decoração, maquetes e protótipos que não vão sofrer esforço mecânico. É a opção mais popular para peças simples.',
  },
  {
    value: '40',
    label: '40%',
    title: 'Equilibrado',
    short: 'Boa resistência para uso no dia a dia. Recomendado para a maioria dos projetos.',
    detail: 'O equilíbrio ideal entre resistência, peso e custo. A peça suporta manuseio normal, pressão leve e pequenos impactos. Funciona para suportes, organizadores, tampas e peças funcionais de uso doméstico. Recomendamos este para quem não sabe qual escolher.',
  },
  {
    value: '60',
    label: '60%',
    title: 'Resistente',
    short: 'Boa resistência para peças que sofrem impacto ou pressão frequente.',
    detail: 'Peça robusta e mais pesada. Indicada para objetos que precisam suportar carga, impacto repetido ou uso intenso. Exemplos: suportes de parede, encaixes mecânicos, peças de reposição. Leva mais tempo e usa mais material que o Equilibrado.',
  },
  {
    value: '80',
    label: '80%',
    title: 'Muito resistente',
    short: 'Quase sólido. Para carga contínua ou impacto intenso.',
    detail: 'A peça fica quase completamente preenchida internamente. Oferece alta resistência a cargas contínuas e impactos fortes. Use quando a durabilidade é crítica: ferramentas, peças industriais, suportes de carga. Custo e tempo de impressão significativamente maiores.',
  },
  {
    value: '100',
    label: '100%',
    title: 'Sólido',
    short: 'Completamente sólido. Máxima resistência, mas muito lento e caro.',
    detail: 'O interior da peça é 100% preenchido — completamente sólido como um bloco. Oferece a máxima resistência possível, mas custa muito mais e demora bem mais para imprimir (às vezes 3× a mais que o 40%). Use apenas quando a peça vai sofrer carga extrema e resistência é mais importante que custo.',
  },
];

const MATERIAL_TYPES_INFO = [
  {
    tipo: 'PLA',
    desc: 'O mais comum. Fácil de imprimir, boa precisão e acabamento. Não tolera calor acima de ~60°C e pode deformar ao sol. Ideal para decoração, protótipos, brinquedos e peças de uso leve em ambientes internos.',
  },
  {
    tipo: 'PETG',
    desc: 'Resistente, durável e impermeável. Tolera calor até ~80°C e não absorve umidade. Boa escolha para peças funcionais, recipientes, peças que terão contato com água ou que ficam ao sol moderado.',
  },
  {
    tipo: 'ABS',
    desc: 'Alta resistência mecânica e ao calor (~100°C). Mais difícil de imprimir — pode empenar se não houver condições controladas. Para peças industriais, de uso intenso ou expostas a temperaturas altas.',
  },
  {
    tipo: 'TPU',
    desc: 'Flexível como borracha. Absorve impactos sem quebrar. Ideal para capas de celular, vedações, solados, apertos de ferramenta e qualquer peça que precise dobrar ou comprimir.',
  },
  {
    tipo: 'ASA',
    desc: 'Muito similar ao ABS, mas com resistência UV — não descolore nem fragiliza ao sol. Indicado para peças ao ar livre: suportes externos, peças de jardinagem, componentes de automóveis.',
  },
  {
    tipo: 'Nylon',
    desc: 'Extremamente resistente ao desgaste e levemente flexível. Absorve umidade do ambiente (o que pode afetar a impressão se o filamento não for guardado corretamente). Para engrenagens, peças com atrito e componentes mecânicos de alta carga.',
  },
  {
    tipo: 'Resina',
    desc: 'Alta resolução de detalhes com fotopolimerização UV. Acabamento extremamente suave e preciso. Mais frágil que filamentos plásticos. Ideal para miniaturas, joias e protótipos com detalhes muito finos.',
  },
];

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

// Step 2 — Configuração
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
  infill: '20',
  printSpeed: '60',
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

function LabelComInfo({ label, onInfo }: { label: string; onInfo: () => void }) {
  return (
    <Box display="flex" alignItems="center" gap={0.5} mb={1}>
      <Typography variant="subtitle2" fontWeight={600}>{label}</Typography>
      <Tooltip title="Clique para saber mais" arrow>
        <IconButton size="small" onClick={onInfo} sx={{ p: 0.25 }}>
          <InfoOutlinedIcon fontSize="small" color="action" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function ConfigStep({
  data, onChange, materiais, qualidades, loadingMateriais, loadingQualidades, nivelUsuario,
}: {
  data: OrderData;
  onChange: (field: keyof OrderData, value: any) => void;
  materiais: Material[];
  qualidades: QualidadeImpressao[];
  loadingMateriais: boolean;
  loadingQualidades: boolean;
  nivelUsuario: 'iniciante' | 'avancado' | null;
}) {
  const [infoQuality, setInfoQuality]   = useState<string | null>(null);
  const [infoMaterial, setInfoMaterial] = useState(false);
  const [infoInfill, setInfoInfill]     = useState(false);
  const [expandParams, setExpandParams] = useState(false);
  const [qtdStr, setQtdStr]             = useState(String(data.quantidade));
  useEffect(() => { setQtdStr(String(data.quantidade)); }, [data.quantidade]);

  const mat = materiais.find(m => m.id === data.idMaterial) ?? null;

  const handleMaterialChange = (e: SelectChangeEvent) => {
    const id = Number(e.target.value);
    const m  = materiais.find(x => x.id === id);
    onChange('idMaterial', id);
    onChange('materialSpec', m?.nome ?? '');
    if (m) {
      onChange('tempBico', m.tempBicoRecomendada ?? midpoint(m.tempBicoMin, m.tempBicoMax, 0));
      onChange('tempMesa', m.tempMesaRecomendada ?? midpoint(m.tempMesaMin, m.tempMesaMax, 0));
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
      onChange('printSpeed',   String(qual.velocidade));
      onChange('perimeters',   qual.perimetros);
      onChange('topLayers',    qual.camadasTopo);
      onChange('bottomLayers', qual.camadasBase);
      onChange('supportAngle', qual.anguloSuporte);
      onChange('supports',     qual.suporte ? 'touching_buildplate' : 'none');
      onChange('adhesion',     qual.adesao  ? 'brim'                : 'none');
    }
  };

  const selectedInfill = INFILL_OPTIONS.find(o => o.value === data.infill);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Nome do projeto */}
      <TextField
        label="Nome do projeto"
        fullWidth
        value={data.projectName}
        onChange={(e) => onChange('projectName', e.target.value)}
      />

      {/* Material */}
      <Box>
        <LabelComInfo label="Material (filamento)" onInfo={() => setInfoMaterial(true)} />
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
        {/* Chips técnicos apenas para avançado, com tooltip explicativo */}
        {mat && nivelUsuario === 'avancado' && (
          <Tooltip
            title="Parâmetros recomendados pelo fabricante para este filamento — usados automaticamente no fatiamento"
            arrow placement="bottom-start"
          >
            <Box sx={{ mt: 1, display: 'inline-flex', gap: 0.5, flexWrap: 'wrap', cursor: 'help' }}>
              <Chip size="small" label={`Ø ${mat.diametro}mm`} variant="outlined" />
              {mat.tempBicoMin != null && (
                <Chip size="small" label={`Bico: ${mat.tempBicoMin}–${mat.tempBicoMax}°C`} variant="outlined" />
              )}
              {mat.tempMesaMin != null && (
                <Chip size="small" label={`Mesa: ${mat.tempMesaMin}–${mat.tempMesaMax}°C`} variant="outlined" />
              )}
            </Box>
          </Tooltip>
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
            value={qtdStr}
            onChange={e => {
              const v = e.target.value;
              setQtdStr(v);
              const num = parseInt(v);
              if (!isNaN(num) && num >= 1) onChange('quantidade', num);
            }}
            onBlur={() => {
              const num = parseInt(qtdStr);
              if (isNaN(num) || num < 1) { setQtdStr('1'); onChange('quantidade', 1); }
            }}
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
        <LabelComInfo label="Qualidade de impressão" onInfo={() => setInfoQuality(data.qualityPreset)} />
        {loadingQualidades ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} /> : (
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(['normal', 'qualidade', 'alta'] as const).map(preset => {
              const info = QUALITY_INFO[preset];
              const selected = data.qualityPreset === preset;
              return (
                <Box key={preset} sx={{ flex: 1, minWidth: 0 }}>
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
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Parâmetros avançados — visível apenas para usuários avançados */}
      {nivelUsuario === 'avancado' && data.idQualidade !== '' && (
        <Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setExpandParams(v => !v)}
            sx={{ borderRadius: 2, textTransform: 'none', borderColor: 'grey.400', color: 'text.secondary' }}
          >
            {expandParams ? '▲ Ocultar parâmetros avançados' : '▼ Personalizar parâmetros de impressão'}
          </Button>
          <Collapse in={expandParams}>
            <Box sx={{ mt: 2, p: 2.5, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.300' }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Alterar esses parâmetros muda o tempo de impressão e o uso de material — o orçamento calculado poderá ser diferente.
              </Alert>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <TextField
                  label="Altura da camada (mm)"
                  type="number"
                  size="small"
                  value={data.layerHeight}
                  onChange={e => onChange('layerHeight', e.target.value)}
                  inputProps={{ step: '0.01', min: mat?.camadaMin ?? 0.05, max: mat?.camadaMax ?? 0.35 }}
                  sx={{ width: 170 }}
                  helperText={mat?.camadaMin != null ? `${mat.camadaMin}–${mat.camadaMax}mm` : '0.05–0.35mm'}
                />
                <TextField
                  label="Velocidade (mm/s)"
                  type="number"
                  size="small"
                  value={data.printSpeed}
                  onChange={e => onChange('printSpeed', e.target.value)}
                  inputProps={{ step: '5', min: 10, max: 200 }}
                  sx={{ width: 150 }}
                  helperText="10–200 mm/s"
                />
                <TextField
                  label="Paredes"
                  type="number"
                  size="small"
                  value={data.perimeters}
                  onChange={e => onChange('perimeters', Math.max(1, parseInt(e.target.value) || 2))}
                  inputProps={{ step: '1', min: 1, max: 8 }}
                  sx={{ width: 100 }}
                  helperText="1–8"
                />
                <TextField
                  label="Camadas topo"
                  type="number"
                  size="small"
                  value={data.topLayers}
                  onChange={e => onChange('topLayers', Math.max(1, parseInt(e.target.value) || 3))}
                  inputProps={{ step: '1', min: 1, max: 10 }}
                  sx={{ width: 120 }}
                  helperText="1–10"
                />
                <TextField
                  label="Camadas base"
                  type="number"
                  size="small"
                  value={data.bottomLayers}
                  onChange={e => onChange('bottomLayers', Math.max(1, parseInt(e.target.value) || 3))}
                  inputProps={{ step: '1', min: 1, max: 10 }}
                  sx={{ width: 120 }}
                  helperText="1–10"
                />
              </Box>
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Preenchimento interno */}
      <Box>
        <LabelComInfo label="Preenchimento interno" onInfo={() => setInfoInfill(true)} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {INFILL_OPTIONS.map(opt => (
            <Tooltip key={opt.value} title={`${opt.title} — ${opt.short}`} arrow placement="top">
              <Button
                variant={data.infill === opt.value ? 'contained' : 'outlined'}
                size="small"
                onClick={() => onChange('infill', opt.value)}
                sx={{
                  minWidth: 58,
                  fontWeight: data.infill === opt.value ? 700 : 400,
                  borderRadius: 2,
                }}
              >
                {opt.label}
              </Button>
            </Tooltip>
          ))}
        </Box>
        {selectedInfill && (
          <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>{selectedInfill.title}:</strong> {selectedInfill.short}
            </Typography>
          </Box>
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

      {/* ── Dialogs de informação ─────────────────────────────── */}

      {/* Dialog: Qualidade */}
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

      {/* Dialog: Material */}
      <Dialog open={infoMaterial} onClose={() => setInfoMaterial(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Guia de materiais</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O material determina as propriedades físicas da peça: resistência ao calor, flexibilidade, durabilidade e acabamento.
          </Typography>
          {(() => {
            const tiposDB = new Set(materiais.map(m => m.tipo.split(/\s+/)[0].toUpperCase()));
            return MATERIAL_TYPES_INFO
              .filter(info => tiposDB.has(info.tipo.toUpperCase()))
              .map((m, i) => (
                <Box key={m.tipo} sx={{ py: 1.5, borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight={700}>{m.tipo}</Typography>
                  <Typography variant="body2" color="text.secondary">{m.desc}</Typography>
                </Box>
              ));
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoMaterial(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Preenchimento */}
      <Dialog open={infoInfill} onClose={() => setInfoInfill(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>O que é preenchimento interno?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O preenchimento define quanto do interior da peça é sólido. Ele afeta diretamente a resistência, o peso, o tempo de impressão e o custo.
          </Typography>
          {INFILL_OPTIONS.map((opt, i) => (
            <Box
              key={opt.value}
              sx={{
                py: 1.5,
                borderTop: i === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                borderRadius: 1,
                px: 1,
                '&:hover': { bgcolor: 'grey.50' },
              }}
              onClick={() => { onChange('infill', opt.value); setInfoInfill(false); }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                <Typography variant="subtitle2" fontWeight={700}>{opt.label}</Typography>
                <Typography variant="subtitle2" color="text.secondary">— {opt.title}</Typography>
                {data.infill === opt.value && (
                  <Chip label="selecionado" size="small" color="primary" sx={{ ml: 'auto' }} />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">{opt.detail}</Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoInfill(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Step 3 — Confirmação
function ConfirmationStep({ files, data, mat }: { files: File[]; data: OrderData; mat: Material | null }) {
  const info = QUALITY_INFO[data.qualityPreset];
  const infillInfo = INFILL_OPTIONS.find(o => o.value === data.infill);
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
        <ListItem>
          <ListItemText
            primary="Preenchimento interno"
            secondary={infillInfo ? `${infillInfo.label} — ${infillInfo.title}: ${infillInfo.short}` : `${data.infill}%`}
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

// Estado passado via navigate() para re-pedido
interface ReorderState {
  idArquivo: number;
  idMaterial: number;
  idQualidade: number;
  parametros?: Record<string, any> | null;
  nome: string;
  nomeArquivo?: string;
}

// Página principal
export function NewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { nivel } = useAuth();

  // Detecta re-pedido e modo admin
  const reorder = (location.state as any)?.reorder as ReorderState | undefined;
  const isAdmin = localStorage.getItem('user_type') === 'admin';

  const [step, setStep]     = useState(reorder ? 1 : 0);
  const [files, setFiles]   = useState<File[]>([]);
  const [reorderArquivoId, setReorderArquivoId] = useState<number | null>(reorder?.idArquivo ?? null);
  const [data, setData]     = useState<OrderData>({
    ...EMPTY,
    ...(reorder ? {
      projectName: reorder.nome,
      idMaterial:  reorder.idMaterial || '',
      idQualidade: reorder.idQualidade || '',
      ...(reorder.parametros ?? {}),
    } : {}),
  });
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
            tempBico: m.tempBicoRecomendada ?? midpoint(m.tempBicoMin, m.tempBicoMax, 0),
            tempMesa: m.tempMesaRecomendada ?? midpoint(m.tempMesaMin, m.tempMesaMax, 0),
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
            idQualidade:  normal.id,
            perimeters:   normal.perimetros,
            topLayers:    normal.camadasTopo,
            bottomLayers: normal.camadasBase,
            supportAngle: normal.anguloSuporte,
            printSpeed:   String(normal.velocidade),
            supports:     normal.suporte ? 'touching_buildplate' : 'none',
            adhesion:     normal.adesao  ? 'brim'                : 'none',
          }));
        }
      })
      .finally(() => setLoadingQual(false));
  }, []);

  const handleChange = (field: keyof OrderData, value: any) =>
    setData(p => ({ ...p, [field]: value }));

  const canNext = () => {
    if (step === 0) return files.length > 0 || reorderArquivoId != null;
    if (step === 1) return data.projectName.trim() !== '' && data.idMaterial !== '' && data.idQualidade !== '';
    return true;
  };

  const mat = materiais.find(m => m.id === data.idMaterial) ?? null;

  const handleFinish = async () => {
    if (!reorderArquivoId && files.length === 0) { setApiError('Selecione um arquivo STL.'); return; }
    if (!data.idMaterial || !data.idQualidade) { setApiError('Selecione material e qualidade.'); return; }
    setSubmitting(true);
    setApiError(null);
    try {
      let idArquivo = reorderArquivoId;

      if (!idArquivo) {
        const fd = new FormData();
        files.forEach(f => fd.append('arquivo', f));
        const { data: arq } = await api.post<{ id: number }>('/arquivos/upload', fd);
        idArquivo = arq.id;
      }

      await api.post('/pedidos', {
        nome:        data.projectName,
        preco:       0,
        descricao:   data.description || null,
        idMaterial:  data.idMaterial,
        idQualidade: data.idQualidade,
        idArquivo,
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

      navigate(isAdmin ? '/admin/orders' : '/quotes');
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
          {isAdmin ? 'Novo Pedido (Admin)' : 'Nova Cotação'}
        </Typography>
        {isAdmin && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Pedido criado pelo admin vai direto para a fila — sem pagamento e sem revisão.
          </Alert>
        )}

        <Stepper activeStep={step} sx={{ pt: 3, pb: 5 }}>
          {STEPS.map(l => <Step key={l}><StepLabel>{l}</StepLabel></Step>)}
        </Stepper>

        {step === 0 && !reorderArquivoId && <UploadStep files={files} onFiles={setFiles} />}
        {step === 0 && reorderArquivoId && (
          <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'success.50', borderRadius: 3, border: '1px solid', borderColor: 'success.200' }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" fontWeight={600}>Arquivo STL mantido do pedido original</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {reorder?.nomeArquivo ?? `Arquivo #${reorderArquivoId}`}
            </Typography>
          </Box>
        )}
        {step === 1 && (
          <ConfigStep
            data={data}
            onChange={handleChange}
            materiais={materiais}
            qualidades={qualidades}
            loadingMateriais={loadingMat}
            loadingQualidades={loadingQual}
            nivelUsuario={nivel}
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
