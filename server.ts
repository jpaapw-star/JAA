import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GlobalMemoryItem, MemoryCategory, MemoryPriority, MemoryStatus, PendingCorrection } from './src/types/memory';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'global_memory.json');
const CORRECTIONS_FILE = path.join(DATA_DIR, 'pending_corrections.json');
const ADMIN_CONFIG_FILE = path.join(DATA_DIR, 'admin_config.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Modelos Gemini suportados para rotação e fallback
const MODELOS_GEMINI = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

const DEFAULT_HEADERS = [
  'timestamp',
  'caixa',
  'modelo',
  'serial_imei',
  'ean',
  'tipo_leitura',
  'status',
  'confianca',
  'qtd_caixa',
  'link_foto',
  'job_id',
  'modelo_ia'
];

// Base padrão inicial da Memória Global Oficial (Fixa e Permanente)
const DEFAULT_GLOBAL_MEMORY: GlobalMemoryItem[] = [
  {
    id: 'MEM_APPLE_IMEI_SERIAL',
    titulo: 'Padrão Apple iPhone — IMEI vs Serial',
    categoria: 'MARCA',
    marca: 'Apple',
    conteudo: 'iPhones possuem IMEI de 15 dígitos iniciado com 35... e Serial alfanumérico de 10 a 12 caracteres (ex: F17Z..., DN6..., H0...). Priorize sempre o IMEI1 de 15 dígitos no campo serial_imei.',
    regraParaIa: 'Para iPhones, o IMEI1 numérico de 15 dígitos deve ser priorizado no serial_imei. O modelo deve ser comercial (ex: Apple iPhone 15 Pro Max 256GB).',
    prioridade: 'CRITICA',
    confianca: 99,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_SAMSUNG_GALAXY_CODES',
    titulo: 'Samsung Galaxy — Códigos de Modelo SM-',
    categoria: 'MODELO',
    marca: 'Samsung',
    conteudo: 'SM-S928B = Samsung Galaxy S24 Ultra; SM-S918B = Samsung Galaxy S23 Ultra; SM-S911B = Samsung Galaxy S23; SM-A546E = Samsung Galaxy A54 5G; SM-A346M = Samsung Galaxy A34 5G; SM-A155M = Samsung Galaxy A15. Converta o código SM- para o nome comercial oficial.',
    regraParaIa: 'Sempre que detectar código iniciando com SM-, mapeie para o nome comercial correspondente (ex: SM-S928B -> Samsung Galaxy S24 Ultra).',
    prioridade: 'CRITICA',
    confianca: 99,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_DELL_SERVICE_TAG',
    titulo: 'Dell Notebooks & Desktops — Service Tag como Serial',
    categoria: 'SERIAL',
    marca: 'Dell',
    conteudo: 'Dispositivos Dell usam Service Tag de 7 caracteres alfanuméricos (ex: 7X3K2M1) como Número de Série primário. Modelos comuns: Latitude, Inspiron, Vostro, XPS, OptiPlex.',
    regraParaIa: 'Para produtos Dell, identifique o Service Tag de 7 caracteres e use-o no campo serial_imei. No modelo, informe a linha e numeração (ex: Dell Latitude 5440).',
    prioridade: 'ALTA',
    confianca: 98,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_ASUS_VIVOBOOK_PN',
    titulo: 'ASUS Notebooks — Mapeamento de PN e Modelo',
    categoria: 'MODELO',
    marca: 'ASUS',
    conteudo: 'ASUS Vivobook / Zenbook / ROG. Códigos como X1504FA, M1502YA, G614JI indicam a série exata (ex: ASUS Vivobook 15 X1504FA). Serial normalmente tem 15 dígitos alfanuméricos começando com M, N, P, R ou S.',
    regraParaIa: 'Combine ASUS + Linha (Vivobook 15) + Código da carcaça (ex: X1504FA).',
    prioridade: 'ALTA',
    confianca: 95,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_LENOVO_MTM_SERIAL',
    titulo: 'Lenovo ThinkPad / IdeaPad — MTM e Serial',
    categoria: 'MARCA',
    marca: 'Lenovo',
    conteudo: 'Notebooks Lenovo possuem Type/MTM de 4 a 10 dígitos (ex: 82X7, 21AH) e Número de Série de 8 caracteres alfanuméricos na etiqueta traseira. Nomeie como Lenovo IdeaPad 1 / 3 / 5 ou ThinkPad T14 / E14.',
    regraParaIa: 'Use o nome comercial (ex: Lenovo IdeaPad 3 15ALC6) em vez de apenas o número MTM.',
    prioridade: 'ALTA',
    confianca: 95,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_MOTOROLA_XT_IMEI',
    titulo: 'Motorola Moto G e Edge — Códigos XT e IMEI',
    categoria: 'MODELO',
    marca: 'Motorola',
    conteudo: 'Smartphones Motorola utilizam códigos XT (ex: XT2343 = Moto G54 5G, XT2401 = Edge 50 Pro). Extraia o IMEI de 15 dígitos do chip 1 (IMEI1).',
    regraParaIa: 'Converta códigos XT para o modelo comercial da Motorola e capture o IMEI1 de 15 dígitos.',
    prioridade: 'ALTA',
    confianca: 95,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_EAN13_BARCODE_VALIDATION',
    titulo: 'EAN-13 — Regra Geral de Código de Barras',
    categoria: 'EAN',
    conteudo: 'Códigos de barras padrão comercial EAN-13 possuem exatamente 13 dígitos numéricos (iniciados com 789 ou 790 no Brasil). Não confunda códigos internos ou SKUs com EAN.',
    regraParaIa: 'Identifique a sequência de 13 dígitos do código de barras EAN-13 principal e insira no campo ean.',
    prioridade: 'NORMAL',
    confianca: 92,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
  {
    id: 'MEM_OCR_CHAR_AMBIGUITY',
    titulo: 'OCR — Tratamento de Ambiguidade de Caracteres',
    categoria: 'OCR',
    conteudo: 'Em números de série alfanuméricos: confira se "O" (letra) não é "0" (zero) ou "I" (i maiúsculo) não é "1" (um). Modelos de tecnologia raramente usam a letra O em serial para evitar confusão com 0.',
    regraParaIa: 'Em campos seriais puramente numéricos (como IMEI de 15 dígitos), nunca inclua letras.',
    prioridade: 'NORMAL',
    confianca: 90,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0,
  },
];

// Funções de Persistência da Memória Global Oficial
function carregarMemoriaGlobal(): GlobalMemoryItem[] {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler global_memory.json:', e);
  }
  salvarMemoriaGlobal(DEFAULT_GLOBAL_MEMORY);
  return DEFAULT_GLOBAL_MEMORY;
}

function salvarMemoriaGlobal(items: GlobalMemoryItem[]) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar global_memory.json:', e);
  }
}

// Funções de Correções Pendentes
function carregarCorrecoesPendentes(): PendingCorrection[] {
  try {
    if (fs.existsSync(CORRECTIONS_FILE)) {
      const data = fs.readFileSync(CORRECTIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Erro ao ler pending_corrections.json:', e);
  }
  return [];
}

function salvarCorrecoesPendentes(correcoes: PendingCorrection[]) {
  try {
    fs.writeFileSync(CORRECTIONS_FILE, JSON.stringify(correcoes, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar pending_corrections.json:', e);
  }
}

// Funções de Configurações de Administrador
function carregarAdminConfig(): { globalMemorySpreadsheetId?: string; geminiApiKey?: string } {
  try {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    globalMemorySpreadsheetId: process.env.GLOBAL_MEMORY_SPREADSHEET_ID || '',
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  };
}

function salvarAdminConfig(config: { globalMemorySpreadsheetId?: string; geminiApiKey?: string }) {
  try {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}

function formatarMemoriaGlobalParaPrompt(items: GlobalMemoryItem[]): string {
  const ativas = items.filter((it) => it.status === 'ATIVA');
  if (ativas.length === 0) return '';

  const linhas = ativas.map((item, idx) => {
    const meta: string[] = [];
    if (item.marca) meta.push(`Marca: ${item.marca}`);
    if (item.modelo) meta.push(`Modelo: ${item.modelo}`);
    if (item.codigo) meta.push(`Código: ${item.codigo}`);
    if (item.ean) meta.push(`EAN: ${item.ean}`);
    if (item.serial_imei) meta.push(`Serial/IMEI: ${item.serial_imei}`);

    const metaStr = meta.length > 0 ? ` [${meta.join(' | ')}]` : '';
    const regraStr = item.regraParaIa ? ` -> Regra: ${item.regraParaIa}` : '';
    return `${idx + 1}. [${item.categoria}] ${item.titulo}${metaStr}: ${item.conteudo}${regraStr}`;
  });

  return `\n\n--- BASE DE CONHECIMENTO DA MEMÓRIA GLOBAL OFICIAL (PRIORITÁRIA) ---\nUse estas regras e padrões para desambiguar a leitura das imagens:\n${linhas.join('\n')}\n--------------------------------------------------------------\n`;
}

// Banco em memória simulando a planilha operacional do usuário
const localDevDb: any[] = [
  {
    timestamp: '06/10/2026 07:15:00',
    caixa: 'CX-01',
    modelo: 'Apple iPhone 15 Pro Max 256GB Titânio Natural',
    serial_imei: '359123456789012',
    ean: '195949012345',
    tipo_leitura: 'MULTI_FOTO_VISION',
    status: 'SUCESSO',
    confianca: '99%',
    qtd_caixa: 1,
    link_foto: 'https://lh3.googleusercontent.com/d/mock_photo_1',
    job_id: 'job_sample_01',
    modelo_ia: 'gemini-2.5-flash'
  }
];

// Inicialização de arquivos
carregarMemoriaGlobal();

// ==========================================================
// ROTAS DE API DA MEMÓRIA GLOBAL & ADMINISTRAÇÃO
// ==========================================================

app.get('/api/memory', (_req, res) => {
  const itens = carregarMemoriaGlobal();
  const ativas = itens.filter((i) => i.status === 'ATIVA').length;
  res.json({
    sucesso: true,
    itens,
    stats: {
      total: itens.length,
      ativas,
      inativas: itens.length - ativas,
    },
  });
});

app.post('/api/corrections/submit', (req, res) => {
  try {
    const { produtoOriginal, correcao } = req.body;
    if (!correcao || !correcao.modelo) {
      return res.status(400).json({ sucesso: false, erro: 'Modelo corrigido é obrigatório.' });
    }

    const correcoes = carregarCorrecoesPendentes();
    const novaCorrecao: PendingCorrection = {
      id: `CORR_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      produtoOriginal: produtoOriginal || {},
      correcao,
      status: 'PENDENTE',
    };

    correcoes.unshift(novaCorrecao);
    salvarCorrecoesPendentes(correcoes);

    res.json({
      sucesso: true,
      mensagem: 'Sugestão registrada na fila de validação da Memória Global!',
      id: novaCorrecao.id,
    });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message || 'Erro ao registrar correção.' });
  }
});

// ADMIN: Obter Correções
app.get('/api/admin/corrections', (_req, res) => {
  const correcoes = carregarCorrecoesPendentes();
  res.json({ sucesso: true, correcoes });
});

// ADMIN: Aprovar Correção
app.post('/api/admin/corrections/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { regraFinal } = req.body;
    const correcoes = carregarCorrecoesPendentes();
    const idx = correcoes.findIndex((c) => c.id === id);

    if (idx === -1) {
      return res.status(404).json({ sucesso: false, erro: 'Correção não encontrada.' });
    }

    const c = correcoes[idx];
    c.status = 'APROVADA';
    c.revisadoEm = new Date().toISOString();
    c.revisadoPor = 'ADMIN';

    // Adicionar à Memória Global Oficial
    const itens = carregarMemoriaGlobal();
    const novoItem: GlobalMemoryItem = {
      id: `MEM_RULE_${Date.now()}`,
      titulo: regraFinal?.titulo || `Padrão ${c.correcao.marca || ''} ${c.correcao.modelo}`.trim(),
      categoria: (regraFinal?.categoria as MemoryCategory) || 'CORRECAO',
      marca: regraFinal?.marca || c.correcao.marca || undefined,
      modelo: regraFinal?.modelo || c.correcao.modelo,
      serial_imei: regraFinal?.serial_imei || c.correcao.serial_imei || undefined,
      ean: regraFinal?.ean || c.correcao.ean || undefined,
      codigo: regraFinal?.codigo || c.correcao.codigoPn || undefined,
      conteudo: regraFinal?.conteudo || `Correção validada: ${c.correcao.modelo}`,
      regraParaIa: regraFinal?.regraParaIa || `Mapear leitura correspondente para ${c.correcao.modelo}.`,
      prioridade: 'ALTA',
      confianca: 98,
      status: 'ATIVA',
      origem: 'CORRECAO_USUARIO',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      vezesUtilizado: 0,
    };

    itens.unshift(novoItem);
    salvarMemoriaGlobal(itens);
    salvarCorrecoesPendentes(correcoes);

    res.json({ sucesso: true, item: novoItem });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ADMIN: Rejeitar Correção
app.post('/api/admin/corrections/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    const correcoes = carregarCorrecoesPendentes();
    const idx = correcoes.findIndex((c) => c.id === id);
    if (idx !== -1) {
      correcoes[idx].status = 'REJEITADA';
      correcoes[idx].revisadoEm = new Date().toISOString();
      salvarCorrecoesPendentes(correcoes);
    }
    res.json({ sucesso: true });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ADMIN: CRUD de Memória
app.post('/api/memory', (req, res) => {
  try {
    const { titulo, categoria, marca, modelo, codigo, ean, serial_imei, conteudo, regraParaIa, prioridade, confianca } = req.body;
    if (!titulo || !conteudo) {
      return res.status(400).json({ sucesso: false, erro: 'Título e conteúdo são obrigatórios.' });
    }

    const itens = carregarMemoriaGlobal();
    const novoItem: GlobalMemoryItem = {
      id: `MEM_${Date.now()}`,
      titulo: titulo.trim(),
      categoria: categoria || 'OUTRO',
      marca: marca?.trim() || undefined,
      modelo: modelo?.trim() || undefined,
      codigo: codigo?.trim() || undefined,
      ean: ean?.trim() || undefined,
      serial_imei: serial_imei?.trim() || undefined,
      conteudo: conteudo.trim(),
      regraParaIa: regraParaIa?.trim() || undefined,
      prioridade: prioridade || 'NORMAL',
      confianca: Number(confianca) || 95,
      status: 'ATIVA',
      origem: 'SISTEMA',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      vezesUtilizado: 0,
    };

    itens.unshift(novoItem);
    salvarMemoriaGlobal(itens);
    res.json({ sucesso: true, item: novoItem });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

app.put('/api/memory/:id', (req, res) => {
  try {
    const { id } = req.params;
    const itens = carregarMemoriaGlobal();
    const idx = itens.findIndex((i) => i.id === id);

    if (idx === -1) {
      return res.status(404).json({ sucesso: false, erro: 'Conhecimento não encontrado.' });
    }

    itens[idx] = {
      ...itens[idx],
      ...req.body,
      id,
      atualizadoEm: new Date().toISOString(),
    };

    salvarMemoriaGlobal(itens);
    res.json({ sucesso: true, item: itens[idx] });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

app.delete('/api/memory/:id', (req, res) => {
  try {
    const { id } = req.params;
    const itens = carregarMemoriaGlobal();
    const filtrados = itens.filter((i) => i.id !== id);
    salvarMemoriaGlobal(filtrados);
    res.json({ sucesso: true });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

app.post('/api/memory/restore-defaults', (_req, res) => {
  try {
    salvarMemoriaGlobal(DEFAULT_GLOBAL_MEMORY);
    res.json({ sucesso: true, total: DEFAULT_GLOBAL_MEMORY.length });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ADMIN: Configurações Matriz
app.get('/api/admin/config', (_req, res) => {
  res.json({ sucesso: true, config: carregarAdminConfig() });
});

app.post('/api/admin/config', (req, res) => {
  salvarAdminConfig(req.body);
  res.json({ sucesso: true });
});

// Validação de Planilha Operacional do Usuário
app.post('/api/validate-spreadsheet', (req, res) => {
  const { spreadsheetId, sheetName } = req.body;
  if (!spreadsheetId) {
    return res.status(400).json({ sucesso: false, erro: 'ID da planilha é obrigatório.' });
  }
  res.json({
    sucesso: true,
    planilha: {
      id: spreadsheetId,
      nome: 'Planilha Operacional Conectada',
      abaAtiva: sheetName || 'Aba Ativa',
      headers: DEFAULT_HEADERS,
      totalRows: localDevDb.length,
    },
  });
});

app.get('/api/planilha', (_req, res) => {
  res.json({
    sucesso: true,
    snapshot: {
      spreadsheetId: 'DEV_OPERATIONAL_SHEET',
      spreadsheetName: 'Planilha Operacional (Inventário)',
      sheetName: 'Aba Ativa',
      headers: DEFAULT_HEADERS,
      totalRows: localDevDb.length,
      items: localDevDb,
      timestamp: new Date().toISOString(),
    },
  });
});

// Webhook proxy & test
app.post('/api/webhook-test', (_req, res) => {
  res.json({
    sucesso: true,
    online: true,
    modo: 'Google Apps Script Backend Oficial',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
// ROTA PRINCIPAL DE ANÁLISE VISION GEMINI + MEMÓRIA GLOBAL
// ==========================================================

app.post('/api/analyze-and-save', async (req, res) => {
  try {
    const { caixa, fotos, jobId } = req.body;

    if (!caixa) {
      return res.status(400).json({ sucesso: false, erro: 'Identificação da caixa é obrigatória.' });
    }
    if (!fotos || !Array.isArray(fotos) || fotos.length === 0) {
      return res.status(400).json({ sucesso: false, erro: 'Pelo menos uma foto deve ser fornecida.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || carregarAdminConfig().geminiApiKey;
    if (!apiKey) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Chave GEMINI_API_KEY não configurada no servidor backend.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const memoryItems = carregarMemoriaGlobal();
    const memoryPromptContext = formatarMemoriaGlobalParaPrompt(memoryItems);

    const systemInstruction = `Você é o motor oficial de OCR e Reconhecimento Visual do SCANLOTE AI.
Sua missão é ler com máxima precisão os dados dos produtos a partir das fotos fornecidas (etiquetas, carcaças, telas, números de série e códigos de barras).

INSTRUÇÕES DE EXTRAÇÃO:
1. "modelo": Nome comercial completo do produto (Ex: "Apple iPhone 15 Pro Max 256GB Titânio Natural", "Dell Latitude 5440 Core i7", "Samsung Galaxy S24 Ultra").
2. "serial_imei": O número de série alfanumérico principal ou o IMEI (15 dígitos). Para iPhones e celulares, priorize o IMEI1 numérico. Para Dell, use o Service Tag.
3. "ean": O código de barras EAN-13 (13 dígitos numéricos) ou código EAN principal.
4. "confianca": Nível de confiança na extração (0 a 100).
${memoryPromptContext}

RESPONDA EXCLUSIVAMENTE UM JSON VÁLIDO NO SEGUINTE FORMATO:
{
  "modelo": "Nome Comercial do Produto",
  "serial_imei": "Serial ou IMEI extraído",
  "ean": "EAN de 13 dígitos ou código de barras",
  "confianca": 98,
  "observacoes": "detalhes técnicos da identificação"
}`;

    const contentsParts: any[] = [];
    fotos.forEach((f: any) => {
      const base64Data = f.base64.includes(',') ? f.base64.split(',')[1] : f.base64;
      contentsParts.push({
        inlineData: {
          mimeType: f.mimeType || 'image/jpeg',
          data: base64Data,
        },
      });
    });

    contentsParts.push({
      text: `Analise as ${fotos.length} foto(s) deste produto na caixa "${caixa}". Extraia o modelo comercial exato, o serial/IMEI e o código EAN.`,
    });

    let rawText = '';
    let modeloUtilizado = '';
    let lastError: any = null;

    // Tentativas com fallback sequencial de modelos
    for (const modelName of MODELOS_GEMINI) {
      try {
        console.log(`[ScanLote] Chamando Gemini com modelo: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contentsParts,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        rawText = response.text || '';
        if (rawText) {
          modeloUtilizado = modelName;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[ScanLote] Modelo ${modelName} falhou (${err.message}). Tentando próximo modelo...`);
      }
    }

    if (!rawText) {
      throw new Error(lastError?.message || 'Todos os modelos da IA estão temporariamente indisponíveis.');
    }

    let parsedResult: any = {};
    try {
      parsedResult = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      parsedResult = {
        modelo: 'Produto Identificado',
        serial_imei: '',
        ean: '',
        confianca: 80,
      };
    }

    // Salva foto em uploads
    let linkFoto = '';
    try {
      const firstPhoto = fotos[0];
      const base64Data = firstPhoto.base64.includes(',') ? firstPhoto.base64.split(',')[1] : firstPhoto.base64;
      const fileName = `foto_${Date.now()}.jpg`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), Buffer.from(base64Data, 'base64'));
      linkFoto = `/api/photos/${fileName}`;
    } catch (e) {}

    // Grava na planilha operacional simulada
    const qtdExistente = localDevDb.filter((r) => r.caixa === caixa).length;
    const novaQtdCaixa = qtdExistente + 1;

    const novoRegistro = {
      timestamp: new Date().toLocaleString('pt-BR'),
      caixa,
      modelo: parsedResult.modelo || 'Produto Não Identificado',
      serial_imei: parsedResult.serial_imei || '',
      ean: parsedResult.ean || '',
      tipo_leitura: 'MULTI_FOTO_VISION',
      status: 'SUCESSO',
      confianca: `${parsedResult.confianca || 95}%`,
      qtd_caixa: novaQtdCaixa,
      link_foto: linkFoto,
      job_id: jobId || `job_${Date.now()}`,
      modelo_ia: modeloUtilizado,
    };

    localDevDb.unshift(novoRegistro);

    res.json({
      sucesso: true,
      produto: novoRegistro,
      persisted: true,
      confirmed: true,
      modeloUtilizado,
      snapshot: {
        spreadsheetId: 'DEV_OPERATIONAL_SHEET',
        spreadsheetName: 'Planilha Operacional (Inventário)',
        sheetName: 'Aba Ativa',
        headers: DEFAULT_HEADERS,
        totalRows: localDevDb.length,
        items: localDevDb,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[ScanLote] Erro no processamento:', err);
    res.status(500).json({
      sucesso: false,
      erro: err.message || 'Erro ao processar imagens do produto.',
    });
  }
});

app.get('/api/photos/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Foto não encontrada');
  }
});

// Vite middleware para desenvolvimento
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ScanLote AI rodando na porta ${PORT}`);
  });
}

startServer();
