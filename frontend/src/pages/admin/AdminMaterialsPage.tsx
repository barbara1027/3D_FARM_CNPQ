import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, CircularProgress, Alert,
  FormControl, InputLabel, Select, MenuItem, type SelectChangeEvent,
  Divider,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon    from '@mui/icons-material/Add';
import EditIcon   from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../services/api';
import type { Material, MaterialStatus } from '../../types/Material';
import { normalizeMaterial } from '../../utils/normalize';

type FormData = Omit<Material, 'id'> & { id?: number };

const empty: FormData = {
  nome: '', tipo: 'PLA', preco: 0.12, status: 'disponivel', cor: '',
  diametro: 1.75,
  tempBicoMin: null, tempBicoMax: null, tempMesaMin: null, tempMesaMax: null,
  fanMin: null, fanMax: null,
  camadaMin: null, camadaMax: null,
};

export function AdminMaterialsPage() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState<FormData>(empty);

  const fetchMateriais = () => {
    setLoading(true);
    api.get<any[]>('/materiais')
      .then(r => setMateriais(r.data.map(normalizeMaterial)))
      .catch(() => setError('Erro ao buscar materiais.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMateriais(); }, []);

  const openAdd  = () => { setForm(empty); setError(null); setDialogOpen(true); };
  const openEdit = (m: Material) => { setForm({ ...m }); setError(null); setDialogOpen(true); };
  const close    = () => setDialogOpen(false);

  const handleField = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericNullable = ['tempBicoMin', 'tempBicoMax', 'tempMesaMin', 'tempMesaMax', 'fanMin', 'fanMax', 'camadaMin', 'camadaMax'];
    const numericRequired = ['preco', 'diametro'];
    if (numericNullable.includes(name)) {
      setForm(p => ({ ...p, [name]: value === '' ? null : parseFloat(value) || null }));
    } else if (numericRequired.includes(name)) {
      setForm(p => ({ ...p, [name]: parseFloat(value) || 0 }));
    } else {
      setForm(p => ({ ...p, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      form.id
        ? await api.put(`/materiais/${form.id}`, form)
        : await api.post('/materiais', form);
      close(); fetchMateriais();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remover este material?')) return;
    try {
      await api.delete(`/materiais/${id}`);
      fetchMateriais();
    } catch (e: any) { setError(e.response?.data?.message ?? 'Erro ao remover.'); }
  };

  const cols: GridColDef<Material>[] = [
    { field: 'nome',  headerName: 'Nome',  flex: 1, minWidth: 140 },
    { field: 'tipo',  headerName: 'Tipo',  width: 90 },
    { field: 'diametro', headerName: 'Ø (mm)', width: 80, type: 'number',
      renderCell: ({ value }) => `${Number(value).toFixed(2)}` },
    { field: 'preco', headerName: 'R$/g', width: 100, type: 'number',
      renderCell: ({ value }) => Number(value).toFixed(4) },
    { field: 'tempBicoMin', headerName: 'Bico (°C)', width: 110,
      renderCell: ({ row }) => row.tempBicoMin != null && row.tempBicoMax != null ? `${row.tempBicoMin}–${row.tempBicoMax}` : '—' },
    { field: 'tempMesaMin', headerName: 'Mesa (°C)', width: 110,
      renderCell: ({ row }) => row.tempMesaMin != null && row.tempMesaMax != null ? `${row.tempMesaMin}–${row.tempMesaMax}` : '—' },
    { field: 'fanMin', headerName: 'Fan (%)', width: 100,
      renderCell: ({ row }) => row.fanMin != null && row.fanMax != null ? `${row.fanMin}–${row.fanMax}` : '—' },
    { field: 'camadaMin', headerName: 'Camada (mm)', width: 120,
      renderCell: ({ row }) => row.camadaMin != null && row.camadaMax != null ? `${row.camadaMin}–${row.camadaMax}` : '—' },
    { field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => value === 'disponivel' ? 'Disponível' : 'Indisponível' },
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
        <Typography variant="h4">Materiais</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Adicionar</Button>
      </Box>

      {error && !dialogOpen && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ flexGrow: 1 }}>
        <DataGrid rows={materiais} columns={cols}
          getRowId={r => r.id} loading={loading} disableRowSelectionOnClick />
      </Box>

      <Dialog open={dialogOpen} onClose={close} maxWidth="md" fullWidth>
        <DialogTitle>{form.id ? 'Editar Material' : 'Novo Material'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && dialogOpen && <Alert severity="error">{error}</Alert>}

          {/* Informações básicas */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField name="nome" label="Nome *" required sx={{ flex: 2 }} value={form.nome} onChange={handleField} />
            <TextField name="tipo" label="Tipo (PLA, PETG…)" required sx={{ flex: 1 }} value={form.tipo} onChange={handleField} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField name="preco" label="Preço/g (R$)" required type="number" sx={{ flex: 1 }}
              value={form.preco} onChange={handleField} inputProps={{ step: '0.0001', min: '0' }} />
            <TextField name="cor" label="Cor" sx={{ flex: 1 }} value={form.cor} onChange={handleField} />
            <TextField name="diametro" label="Diâmetro (mm)" type="number" sx={{ flex: 1 }}
              value={form.diametro} onChange={handleField} inputProps={{ step: '0.01', min: '0' }} />
          </Box>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={form.status}
              onChange={(e: SelectChangeEvent) => setForm(p => ({ ...p, status: e.target.value as MaterialStatus }))}>
              <MenuItem value="disponivel">Disponível</MenuItem>
              <MenuItem value="indisponivel">Indisponível</MenuItem>
            </Select>
          </FormControl>

          {/* Temperatura */}
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">
            Faixas de Temperatura — usadas nos sliders do cliente e como padrão no slicer
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField name="tempBicoMin" label="Bico mín. (°C)" type="number" fullWidth
              value={form.tempBicoMin ?? ''} onChange={handleField} inputProps={{ min: 0, max: 500, step: 5 }} />
            <TextField name="tempBicoMax" label="Bico máx. (°C)" type="number" fullWidth
              value={form.tempBicoMax ?? ''} onChange={handleField} inputProps={{ min: 0, max: 500, step: 5 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField name="tempMesaMin" label="Mesa mín. (°C)" type="number" fullWidth
              value={form.tempMesaMin ?? ''} onChange={handleField} inputProps={{ min: 0, max: 200, step: 5 }} />
            <TextField name="tempMesaMax" label="Mesa máx. (°C)" type="number" fullWidth
              value={form.tempMesaMax ?? ''} onChange={handleField} inputProps={{ min: 0, max: 200, step: 5 }} />
          </Box>

          {/* Fan */}
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">
            Velocidade do Fan — PLA: 50–100% · PETG: 30–50% · ABS/ASA: 0–25%
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField name="fanMin" label="Fan mín. (%)" type="number" fullWidth
              value={form.fanMin ?? ''} onChange={handleField} inputProps={{ min: 0, max: 100 }} />
            <TextField name="fanMax" label="Fan máx. (%)" type="number" fullWidth
              value={form.fanMax ?? ''} onChange={handleField} inputProps={{ min: 0, max: 100 }} />
          </Box>

          {/* Altura de camada */}
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">
            Faixa de Altura de Camada — mostrada como dica no slider do cliente
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField name="camadaMin" label="Camada mín. (mm)" type="number" fullWidth
              value={form.camadaMin ?? ''} onChange={handleField} inputProps={{ min: 0.01, max: 1, step: 0.01 }} />
            <TextField name="camadaMax" label="Camada máx. (mm)" type="number" fullWidth
              value={form.camadaMax ?? ''} onChange={handleField} inputProps={{ min: 0.01, max: 1, step: 0.01 }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.nome || !form.tipo}>
            {saving ? <CircularProgress size={22} /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
