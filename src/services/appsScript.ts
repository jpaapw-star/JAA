/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SCANLOTE_WEB_APP_URL } from '../config';
import { GlobalMemoryItem, PendingCorrection } from '../types/memory';

declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: (handler: (response: any) => void) => {
            withFailureHandler: (handler: (error: any) => void) => any;
          };
          [key: string]: any;
        };
      };
    };
  }
}

/**
 * Verifica se o aplicativo está rodando dentro do iframe do Google Apps Script
 */
export function isGoogleAppsScriptEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.script?.run !== 'undefined';
}

/**
 * Executa uma função do Google Apps Script via google.script.run retornando Promise
 */
function callGas<T = any>(functionName: string, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isGoogleAppsScriptEnvironment()) {
      reject(new Error('Ambiente Google Apps Script não detectado.'));
      return;
    }

    const runner = window.google!.script.run
      .withSuccessHandler((res: any) => resolve(res))
      .withFailureHandler((err: any) => {
        const msg = typeof err === 'object' && err?.message ? err.message : String(err || 'Erro no Apps Script');
        reject(new Error(msg));
      });

    if (typeof runner[functionName] === 'function') {
      runner[functionName](...args);
    } else {
      reject(new Error(`Função ${functionName} não encontrada no Google Apps Script.`));
    }
  });
}

/**
 * Camada de Comunicação Unificada: Apps Script (google.script.run) / Backend API
 */
export const AppsScriptService = {
  /**
   * Health check / Status do Backend
   */
  async getHealthCheck(): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('executarHealthCheck');
    }
    const res = await fetch('/api/webhook-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webAppUrl: SCANLOTE_WEB_APP_URL }),
    });
    return res.json();
  },

  /**
   * Validação de Planilha Operacional do Usuário
   */
  async validateSpreadsheet(spreadsheetId: string, sheetName?: string): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('testarAcessoPlanilha', spreadsheetId, sheetName);
    }
    const res = await fetch('/api/validate-spreadsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, sheetName }),
    });
    return res.json();
  },

  /**
   * Obter snapshot da planilha operacional do usuário (Fonte de Verdade Operacional)
   */
  async getSnapshot(nomeAba?: string, spreadsheetId?: string): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('obterSnapshotPlanilha', nomeAba, spreadsheetId);
    }
    const res = await fetch(`/api/planilha${spreadsheetId ? `?spreadsheetId=${encodeURIComponent(spreadsheetId)}` : ''}`);
    return res.json();
  },

  /**
   * Processar produto com a IA Gemini + Memória Global Fixa (Background) + Gravação e Readback na Planilha do Usuário
   */
  async processProduct(payload: {
    caixa: string;
    productId?: string;
    fotos: { mimeType: string; base64: string }[];
    spreadsheetId?: string;
    nomeAba?: string;
    jobId?: string;
    captureSessionId?: string;
    memoriaGlobalPrompt?: string;
  }): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('processarProdutoComIdempotencia', payload);
    }
    const res = await fetch('/api/analyze-and-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  /**
   * Gravação isolada na Planilha Operacional com Readback (para retries rápidos de rede)
   */
  async saveToSheetsOnly(payload: {
    productId: string;
    spreadsheetId?: string;
    nomeAba?: string;
    caixa: string;
    modelo: string;
    serial_imei?: string;
    ean?: string;
    link_foto?: string;
    jobId?: string;
  }): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('gravarLinhaPlanilhaComReadback', payload);
    }
    const res = await fetch('/api/sheets/save-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  /**
   * Obter itens da Memória Global Oficial (Consultada internamente em background)
   */
  async getGlobalMemory(): Promise<{ sucesso: boolean; itens: GlobalMemoryItem[]; stats: any }> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('obterMemoriaGlobal');
    }
    const res = await fetch('/api/memory');
    return res.json();
  },

  /**
   * Submeter uma Correção Humana para a Fila de Revisão/Aprendizado
   */
  async submitCorrection(payload: {
    produtoOriginal: any;
    correcao: any;
  }): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('submeterCorrecaoPendente', payload);
    }
    const res = await fetch('/api/corrections/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  /**
   * Métodos Administrativos Internos
   */
  async getPendingCorrections(): Promise<{ sucesso: boolean; correcoes: PendingCorrection[] }> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('obterCorrecoesPendentes');
    }
    const res = await fetch('/api/admin/corrections');
    return res.json();
  },

  async approvePendingCorrection(id: string, regraFinal?: Partial<GlobalMemoryItem>): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('aprovarCorrecaoPendente', id, regraFinal);
    }
    const res = await fetch(`/api/admin/corrections/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regraFinal }),
    });
    return res.json();
  },

  async rejectPendingCorrection(id: string): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('rejeitarCorrecaoPendente', id);
    }
    const res = await fetch(`/api/admin/corrections/${id}/reject`, {
      method: 'POST',
    });
    return res.json();
  },

  async saveGlobalMemoryAdmin(item: Partial<GlobalMemoryItem>): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('salvarItemMemoriaGlobal', item);
    }
    const isNew = !item.id;
    const url = isNew ? '/api/memory' : `/api/memory/${item.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },

  async deleteGlobalMemoryAdmin(id: string): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('excluirItemMemoriaGlobal', id);
    }
    const res = await fetch(`/api/memory/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async restoreDefaultsAdmin(): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('restaurarPadroesMemoriaGlobal');
    }
    const res = await fetch('/api/memory/restore-defaults', { method: 'POST' });
    return res.json();
  },

  async getAdminConfig(): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('obterConfiguracoesAdmin');
    }
    const res = await fetch('/api/admin/config');
    return res.json();
  },

  async saveAdminConfig(config: { globalMemorySpreadsheetId?: string; geminiApiKey?: string }): Promise<any> {
    if (isGoogleAppsScriptEnvironment()) {
      return callGas('salvarConfiguracoesAdmin', config);
    }
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  }
};
