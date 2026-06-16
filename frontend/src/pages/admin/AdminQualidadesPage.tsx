import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, CircularProgress, Alert,
  FormControlLabel, Switch, Divider,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon    from '@mui/icons-material/Add';
import EditIcon   from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../services/api';
import type { QualidadeImpressao } from '../../types/QualidadeImpressao';
import { normalizeQualidade } from '../../utils/normalize';

type FormData = Omit<QualidadeImpressao, 'id' | 'createdAt' | 'updatedAt'> & { id?: number };

const empty: FormData = {
  nome: '', altura: 0.2, espessura: 1.2, preenchimento: 15,
  velocidade: 50, temperaturaBico: 210, temperaturaMesa: 60,
  suporte: 0, adesao: 0,
  perimetros: 2, camadasTopo: 3, camadasBase: 3, anguloSuporte: 45,
};

export function AdminQualidadesPage() {
  const [qualidades, setQualidades] = useState<QualidadeImpressao[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState<FormData>(empty);

  const fetchQualidades = () => {
    setLoading(true);
    api.get<any[]>('/qualidades')
      .then(r => setQualidades(r.data.map(normalizeQualidade)))
      .catch(() => setError('Erro ao buscar qualidades.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQualidades(); }, []);

  const openAdd  = () => { setForm(empty); setError(null); setDialogOpen(true); };
  const openEdit = (q: QualidadeImpressao) => {
    const { createdAt: _c, updatedAt: _u, ...rest } = q;
    setForm(rest);
    setError(null);
    setDialogOpen(true);
  };
  const close = () => setDialogOpen(false);

  const handleField = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: isNaN(Number(value)) ? value : Number(value) }));
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      form.id
        ? await api.put(`/qualidades/${form.id}`, form)
        : await api.post('/qualidades', form);
      close(); fetchQualidades();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remover esta qualidade?')) return;
    try {
      await api.delete(`/qualidades/${id}`);
      fetchQualidades();
    } catch (e: any) { setError(e.response?.data?.message ?? 'Erro ao remover.'); }
  };

  const columns: GridColDef<QualidadeImpressao>[] = [
    { field: 'nome', headerName: 'Nome', width: 150,
      renderCell: ({ value, row }) => value || `Qualidade ${row.id}` },
    { field: 'altura', headerName: 'Camada (mm)', width: 115, type: 'number' },
    { field: 'preenchimento', headerName: 'Preench. (%)', width: 115, type: 'number' },
    { field: 'velocidade', headerName: 'Veloc. (mm/s)', width: 115, type: 'number' },
    { field: 'perimetros', headerName: 'Perímetros', width: 100, type: 'number' },
    { field: 'camadasTopo', headerName: 'Topo', width: 80, type: 'number' },
    { field: 'camadasBase', headerName: 'Base', width: 80, type: 'number' },
    { field: 'anguloSuporte', headerName: 'Suporte (°)', width: 100, type: 'number' },
    { field: 'temperaturaBico', headerName: 'T.Bico (°C)', width: 105, type: 'number' },
    { field: 'temperaturaMesa', headerName: 'T.Mesa (°C)', width: 105, type: 'number' },
    { field: 'actions', headerName: 'Ações', width: 90, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => openEdit(row)}><EditIcon /></IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon /></IconButton>
        </Box>
      ) },
  ];

  return (
    <Paper sx={{ p: 2, height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Qualidades de Impressão</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Adicionar</Button>
      </Box>

      {error && !dialogOpen && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ flexGrow: 1 }}>
        <DataGrid rows={qualidades} columns={columns}
          getRowId={r => r.id} loading={loading} disableRowSelectionOnClick />
      </Box>

      <Dialog open={dialogOpen} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Editar Qualidade' : 'Nova Qualidade'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && dialogOpen && <Alert severity="error">{error}</Alert>}

          <TextField name="nome" label="Nome (ex: Normal, Alta)" fullWidth value={form.nome} onChange={handleField} />

          {/* Geometria */}
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">Geometria de impressão</Typography>
          <Box display="flex" gap={2}>
            <TextField name="altura" label="Altura camada (mm)" type="number" fullWidth
              value={form.altura} onChange={handleField} inputProps={{ step: '0.01', min: '0.05' }} />
            <TextField name="espessura" label="Espessura parede (mm)" type="number" fullWidth
              value={form.espessura} onChange={handleField} inputProps={{ step: '0.1' }} />
          </Box>
          <Box display="flex" gap={2}>
            <TextField name="preenchimento" label="Preenchimento (%)" type="number" fullWidth
              value={form.preenchimento} onChange={handleField} inputProps={{ min: '0', max: '100' }} />
            <TextField name="velocidade" label="Velocidade (mm/s)" type="number" fullWidth
              value={form.velocidade} onChange={handleField} />
          </Box>

          {/* Paredes e camadas */}
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">Paredes e camadas sólidas</Typography>
          <Box display="flex" gap={2}>
            <TextField name="perimetros" label="Perímetros" type="number" fullWidth
              value={form.perimetros} onChange={handleField} inputProps={{ min: '1', max: '10' }}
              helperText="Número de paredes" />
            <TextField name="camadasTopo" label="Camadas topo" type="number" fullWidth
              value={form.camadasTopo} onChange={handleField} inputProps={{ min: '0', max: '15' }} />
            <TextField name="camadasBase" label="Camadas base" type="number" fullWidth
              value={form.camadasBase} onChange={handleField} inputProps={{ min: '0', max: '15' }} />
          </Box>

          {/* Suporte e adesão */}
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">Suporte e adesão</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <TextField name="anguloSuporte" label="Ângulo suporte (°)" type="number" sx={{ flex: 1 }}
              value={form.anguloSuporte} onChange={handleField} inputProps={{ min: '20', max: '75' }}
              helperText="Suporte gerado acima deste ângulo" />
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <FormControlLabel
                control={<Switch checked={form.suporte === 1} onChange={e => setForm(p => ({ ...p, suporte: e.target.checked ? 1 : 0 }))} />}
                label="Suporte padrão ligado" />
              <FormControlLabel
                control={<Switch checked={form.adesao === 1} onChange={e => setForm(p => ({ ...p, adesao: e.target.checked ? 1 : 0 }))} />}
                label="Adesão padrão ligada" />
            </Box>
          </Box>

          {/* Temperatura (genérica, pode ser sobrescrita pelo material) */}
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            Temperatura padrão (sobrescrita pelas faixas do material)
          </Typography>
          <Box display="flex" gap={2}>
            <TextField name="temperaturaBico" label="Temp. bico (°C)" type="number" fullWidth
              value={form.temperaturaBico} onChange={handleField} />
            <TextField name="temperaturaMesa" label="Temp. mesa (°C)" type="number" fullWidth
              value={form.temperaturaMesa} onChange={handleField} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={22} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
