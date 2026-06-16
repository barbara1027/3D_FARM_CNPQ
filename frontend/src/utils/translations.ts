import type { StatusPedido } from '../types/Pedido';

const LABELS: Record<StatusPedido, string> = {
  analisando:            'Analisando...',
  aguardando_pagamento:  'Aguardando pagamento',
  aguardando_revisao:    'Em revisão pelo admin',
  na_fila:               'Na fila de impressão',
  em_impressao:          'Em impressão',
  concluido:             'Concluído',
  falhou:                'Falhou',
  cancelado:             'Cancelado',
};

export const getStatusTranslation = (s: string): string =>
  LABELS[s as StatusPedido] ?? s;

export const getStatusColor = (s: string):
  'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' => {
  switch (s as StatusPedido) {
    case 'analisando':           return 'default';
    case 'aguardando_pagamento': return 'info';
    case 'aguardando_revisao':   return 'warning';
    case 'na_fila':              return 'info';
    case 'em_impressao':         return 'primary';
    case 'concluido':            return 'success';
    case 'falhou':               return 'error';
    case 'cancelado':            return 'warning';
    default:                     return 'default';
  }
};
