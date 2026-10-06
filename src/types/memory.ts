/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemoryCategory =
  | 'REGRA'
  | 'MARCA'
  | 'MODELO'
  | 'SERIAL'
  | 'IMEI'
  | 'EAN'
  | 'OCR'
  | 'PRODUTO'
  | 'CORRECAO'
  | 'VALIDACAO'
  | 'CONHECIMENTO'
  | 'OUTRO';

export type MemoryOrigin =
  | 'USUARIO'
  | 'IA'
  | 'CORRECAO_USUARIO'
  | 'IMPORTACAO'
  | 'SISTEMA'
  | 'INTERNET';

export type MemoryPriority = 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';

export type MemoryStatus = 'ATIVA' | 'INATIVA' | 'PENDENTE' | 'REVISAR' | 'ARQUIVADA';

export interface GlobalMemoryItem {
  id: string;
  titulo: string;
  categoria: MemoryCategory;
  subcategoria?: string;
  marca?: string;
  modelo?: string;
  codigo?: string;
  ean?: string;
  serial_imei?: string;
  conteudo: string;
  regraParaIa?: string;
  exemplos?: string[];
  prioridade: MemoryPriority;
  confianca: number; // 0 - 100
  status: MemoryStatus;
  origem: MemoryOrigin;
  criadoEm: string;
  atualizadoEm: string;
  vezesUtilizado?: number;
}

export interface PendingCorrection {
  id: string;
  timestamp: string;
  produtoOriginal: {
    modelo?: string;
    serial_imei?: string;
    ean?: string;
    caixa?: string;
  };
  correcao: {
    modelo: string;
    serial_imei?: string;
    ean?: string;
    marca?: string;
    codigoPn?: string;
    observacoes?: string;
  };
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  revisadoPor?: string;
  revisadoEm?: string;
  regraGeradaId?: string;
}
