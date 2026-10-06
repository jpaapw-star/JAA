/**
 * SCANLOTE AI — GOOGLE APPS SCRIPT OFICIAL (V3.2 - MEMÓRIA GLOBAL INVISÍVEL & READBACK)
 * 
 * ARQUITETURA DEFINITIVA:
 * - HOSPEDAGEM DO APP WEB COMPLETO (React SPA via doGet / Index.html)
 * - MEMÓRIA GLOBAL CENTRAL FIXA: Acessada SOMENTE via GLOBAL_MEMORY_SPREADSHEET_ID
 * - NUNCA usa getActiveSpreadsheet() como fallback de Memória Global
 * - PLANILHA OPERACIONAL INDIVIDUAL: Cada usuário conecta sua própria Google Sheets
 * - WRITE REAL + FLUSH + READBACK OBRIGATÓRIO + IDEMPOTÊNCIA POR PRODUCT_ID
 * - MULTI-MODEL FALLBACK: gemini-2.5-flash -> gemini-2.5-pro -> gemini-2.0-flash -> gemini-1.5-flash
 */

// ==========================================
// CONFIGURAÇÕES E CONSTANTES CENTRAIS
// ==========================================
var VERSAO_SISTEMA = '3.2.0';
var DRIVE_FOLDER_NAME = 'SCANLOTE_FOTOS';
var ABA_MEMORIA_GLOBAL = 'GLOBAL_MEMORY';
var ABA_CORRECOES_PENDENTES = 'CORRECOES_PENDENTES';

var MODELOS_GEMINI = [
  { id: 'gemini-2.5-flash', prioridade: 1, descricao: 'Principal Flash' },
  { id: 'gemini-2.5-pro', prioridade: 2, descricao: 'Pro Alta Precisão' },
  { id: 'gemini-2.0-flash', prioridade: 3, descricao: 'Flash 2.0 Rápido' },
  { id: 'gemini-1.5-flash', prioridade: 4, descricao: 'Flash 1.5 Legado' }
];

var OPERATIONAL_HEADERS = [
  'ID_PRODUTO',
  'MODELO',
  'SERIAL / IMEI',
  'EAN',
  'QTDE',
  'DATA',
  'QTD/CAIXA',
  'CAIXA',
  'LINK FOTO',
  'JOB_ID',
  'MODELO_IA'
];

var MEMORY_HEADERS = [
  'ID',
  'TITULO',
  'CATEGORIA',
  'MARCA',
  'MODELO',
  'CODIGO',
  'EAN',
  'SERIAL_IMEI',
  'CONTEUDO',
  'REGRA_IA',
  'PRIORIDADE',
  'CONFIANCA',
  'STATUS',
  'ORIGEM',
  'CRIADO_EM',
  'ATUALIZADO_EM',
  'VEZES_UTILIZADO'
];

var DEFAULT_MEMORY_ITEMS = [
  {
    id: 'MEM_APPLE_IMEI_SERIAL',
    titulo: 'Padrão Apple iPhone — IMEI vs Serial',
    categoria: 'MARCA',
    marca: 'Apple',
    conteudo: 'iPhones possuem IMEI de 15 dígitos iniciado com 35... e Serial alfanumérico de 10 a 12 caracteres (ex: F17Z..., DN6..., H0...). Priorize sempre o IMEI1 de 15 dígitos no campo serial_imei.',
    regraParaIa: 'Para iPhones, o IMEI1 numérico de 15 dígitos deve ser priorizado. O modelo deve ser comercial (ex: Apple iPhone 15 Pro Max 256GB).',
    prioridade: 'CRITICA',
    confianca: 99,
    status: 'ATIVA',
    origem: 'SISTEMA',
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    vezesUtilizado: 0
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
    vezesUtilizado: 0
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
    vezesUtilizado: 0
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
    vezesUtilizado: 0
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
    vezesUtilizado: 0
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
    vezesUtilizado: 0
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
    vezesUtilizado: 0
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
    vezesUtilizado: 0
  }
];

/**
 * Menu do Administrador adicionado na Google Planilha
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📦 ScanLote AI')
    .addItem('Configurar Chave Gemini', 'configurarChaveGeminiAdmin')
    .addItem('Configurar Memória Global', 'configurarMemoriaGlobalAdmin')
    .addItem('Inicializar Memória Global', 'inicializarMemoriaGlobalAdmin')
    .addItem('Verificar Saúde do Sistema', 'verificarSaudeDoSistema')
    .addSeparator()
    .addItem('Abrir Leitor (Barra Lateral)', 'abrirSidebar')
    .addItem('Abrir Leitor (Janela)', 'abrirModal')
    .addToUi();
}

/**
 * Ponto de entrada GET do Web App (/exec)
 * ENTREGA APLICAÇÃO COMPLETA SCANLOTE AI DIRETAMENTE AO USUÁRIO
 */
function doGet(e) {
  e = e || {};
  var param = e.parameter || {};

  // 1. Health Check / Ping em formato JSON
  if (param.ping === '1' || param.acao === 'ping' || param.format === 'json') {
    return responderJson(executarHealthCheck());
  }

  // 2. Testar Acesso / Conectar Planilha Operacional do Usuário
  if (param.acao === 'testarPlanilha' || param.acao === 'conectarPlanilha') {
    try {
      var resultadoPlanilha = testarAcessoPlanilha(param.spreadsheetId, param.nomeAba);
      return responderJson({ sucesso: true, planilha: resultadoPlanilha });
    } catch (err) {
      return responderJson({ sucesso: false, erro: err.message || 'Erro ao acessar planilha operacional' });
    }
  }

  // 3. Leitura de Snapshot da Planilha Operacional
  if (param.acao === 'obterSnapshot' || param.acao === 'lerPlanilha') {
    try {
      var snapshot = obterSnapshotPlanilha(param.nomeAba, param.spreadsheetId);
      return responderJson({ sucesso: true, snapshot: snapshot });
    } catch (err) {
      return responderJson({ sucesso: false, erro: err.message || 'Erro ao ler snapshot operacional' });
    }
  }

  // 4. Obter Memória Global Oficial (Fixa)
  if (param.acao === 'obterMemoria' || param.acao === 'getMemory') {
    return responderJson(obterMemoriaGlobal());
  }

  // 5. ENTREGA OFICIAL DO APLICATIVO REACT SCANLOTE AI
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('ScanLote AI')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  } catch (htmlErr) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:30px;text-align:center;background:#0f172a;color:#fff;min-height:100vh;">' +
      '<h2 style="color:#6366f1;">ScanLote AI Web App</h2>' +
      '<p>Para ativar a interface completa React, crie o arquivo <strong>Index.html</strong> no editor do Apps Script.</p>' +
      '</div>'
    ).setTitle('ScanLote AI');
  }
}

/**
 * Ponto de entrada POST do Web App (/exec)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responderJson({ sucesso: false, erro: 'Requisição sem conteúdo (payload vazio).' });
    }

    var payload = JSON.parse(e.postData.contents);
    var acao = payload.acao || (payload.caixa && payload.fotos ? 'processarProduto' : 'ping');

    switch (acao) {
      case 'ping':
      case 'healthCheck':
        return responderJson(executarHealthCheck());

      case 'testarPlanilha':
      case 'conectarPlanilha':
        var infoPlanilha = testarAcessoPlanilha(payload.spreadsheetId, payload.nomeAba);
        return responderJson({ sucesso: true, planilha: infoPlanilha });

      case 'obterSnapshot':
      case 'lerPlanilha':
        var snapshot = obterSnapshotPlanilha(payload.nomeAba, payload.spreadsheetId);
        return responderJson({ sucesso: true, snapshot: snapshot });

      case 'obterMemoria':
      case 'getMemory':
        return responderJson(obterMemoriaGlobal());

      case 'submeterCorrecao':
      case 'submeterCorrecaoPendente':
        return responderJson(submeterCorrecaoPendente(payload));

      case 'gravarApenasNaPlanilha':
        return responderJson(gravarLinhaPlanilhaComReadback(payload));

      case 'processarProduto':
      case 'criarJob':
        var resultado = processarProdutoComIdempotencia(payload);
        return responderJson(resultado);

      default:
        return responderJson({
          sucesso: false,
          erro: 'Ação não reconhecida: ' + acao
        });
    }
  } catch (err) {
    Logger.log('Erro no doPost: ' + err.toString());
    return responderJson({
      sucesso: false,
      erro: err.message || 'Erro interno no servidor Google Apps Script'
    });
  }
}

function responderJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// FUNÇÃO OBRIGATÓRIA: ACESSO À MEMÓRIA GLOBAL
// NUNCA UTILIZA getActiveSpreadsheet()
// ==========================================

function obterInstanciaMemoriaSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var globalId = props.getProperty('GLOBAL_MEMORY_SPREADSHEET_ID');

  if (!globalId || !globalId.trim()) {
    throw new Error('Memória Global não configurada no Apps Script.');
  }

  try {
    return SpreadsheetApp.openById(globalId.trim());
  } catch (e) {
    throw new Error('Não foi possível acessar a Memória Global configurada no Apps Script.');
  }
}

function obterOuCriarAbaMemoriaGlobal() {
  var ss = obterInstanciaMemoriaSpreadsheet();
  var aba = ss.getSheetByName(ABA_MEMORIA_GLOBAL);

  if (!aba) {
    aba = ss.insertSheet(ABA_MEMORIA_GLOBAL);
    aba.getRange(1, 1, 1, MEMORY_HEADERS.length).setValues([MEMORY_HEADERS]);
    aba.getRange(1, 1, 1, MEMORY_HEADERS.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    aba.setFrozenRows(1);

    var linhasSeed = DEFAULT_MEMORY_ITEMS.map(function(item) {
      return [
        item.id,
        item.titulo,
        item.categoria,
        item.marca || '',
        item.modelo || '',
        item.codigo || '',
        item.ean || '',
        item.serial_imei || '',
        item.conteudo,
        item.regraParaIa || '',
        item.prioridade,
        item.confianca,
        item.status,
        item.origem,
        item.criadoEm,
        item.atualizadoEm,
        item.vezesUtilizado || 0
      ];
    });

    if (linhasSeed.length > 0) {
      aba.getRange(2, 1, linhasSeed.length, MEMORY_HEADERS.length).setValues(linhasSeed);
      SpreadsheetApp.flush();
    }
  }

  return aba;
}

function obterMemoriaGlobal() {
  try {
    var aba = obterOuCriarAbaMemoriaGlobal();
    var lastRow = aba.getLastRow();
    var itens = [];

    if (lastRow > 1) {
      var values = aba.getRange(2, 1, lastRow - 1, MEMORY_HEADERS.length).getValues();
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var id = String(row[0] || '').trim();
        var titulo = String(row[1] || '').trim();
        if (!id || !titulo) continue;

        itens.push({
          id: id,
          titulo: titulo,
          categoria: row[2] || 'REGRA',
          marca: row[3] || '',
          modelo: row[4] || '',
          codigo: row[5] || '',
          ean: row[6] || '',
          serial_imei: row[7] || '',
          conteudo: row[8] || '',
          regraParaIa: row[9] || '',
          prioridade: row[10] || 'ALTA',
          confianca: Number(row[11]) || 90,
          status: row[12] || 'ATIVA',
          origem: row[13] || 'SISTEMA',
          criadoEm: row[14] || '',
          atualizadoEm: row[15] || '',
          vezesUtilizado: Number(row[16]) || 0
        });
      }
    }

    var ativas = itens.filter(function(x) { return x.status === 'ATIVA'; }).length;
    return {
      sucesso: true,
      total: itens.length,
      stats: { total: itens.length, ativas: ativas, inativas: itens.length - ativas },
      itens: itens
    };
  } catch (err) {
    Logger.log('[MEMORIA GLOBAL] Aviso: ' + err.toString() + '. Utilizando base de conhecimento segura.');
    return {
      sucesso: true,
      total: DEFAULT_MEMORY_ITEMS.length,
      stats: { total: DEFAULT_MEMORY_ITEMS.length, ativas: DEFAULT_MEMORY_ITEMS.length, inativas: 0 },
      itens: DEFAULT_MEMORY_ITEMS
    };
  }
}

// ==========================================
// FILA DE CORREÇÕES PENDENTES
// ==========================================

function obterOuCriarAbaCorrecoesPendentes() {
  try {
    var ss = obterInstanciaMemoriaSpreadsheet();
    var aba = ss.getSheetByName(ABA_CORRECOES_PENDENTES);
    if (!aba) {
      aba = ss.insertSheet(ABA_CORRECOES_PENDENTES);
      var headers = ['ID', 'TIMESTAMP', 'STATUS', 'ORIGINAL_MODELO', 'ORIGINAL_SERIAL', 'ORIGINAL_EAN', 'CORRIGIDO_MODELO', 'MARCA', 'CODIGO_PN', 'CORRIGIDO_SERIAL', 'CORRIGIDO_EAN', 'OBSERVACOES'];
      aba.getRange(1, 1, 1, headers.length).setValues([headers]);
      aba.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#312e81').setFontColor('#ffffff');
      aba.setFrozenRows(1);
    }
    return aba;
  } catch (e) {
    return null;
  }
}

function submeterCorrecaoPendente(payload) {
  try {
    var correcao = payload.correcao || {};
    var produtoOriginal = payload.produtoOriginal || {};

    if (!correcao.modelo) {
      return { sucesso: false, erro: 'Modelo corrigido é obrigatório.' };
    }

    var aba = obterOuCriarAbaCorrecoesPendentes();
    var id = 'CORR_' + Date.now();
    var timestamp = new Date().toISOString();

    if (aba) {
      aba.appendRow([
        id,
        timestamp,
        'PENDENTE',
        produtoOriginal.modelo || '',
        produtoOriginal.serial_imei || '',
        produtoOriginal.ean || '',
        correcao.modelo,
        correcao.marca || '',
        correcao.codigoPn || '',
        correcao.serial_imei || '',
        correcao.ean || '',
        correcao.observacoes || ''
      ]);
      SpreadsheetApp.flush();
    }

    return { sucesso: true, id: id, mensagem: 'Correção registrada para validação da Memória Oficial!' };
  } catch (err) {
    return { sucesso: false, erro: err.message };
  }
}

function formatarRegrasMemoriaParaPrompt() {
  try {
    var res = obterMemoriaGlobal();
    var ativas = (res.itens || []).filter(function(x) { return x.status === 'ATIVA'; });
    if (ativas.length === 0) return '';

    var linhas = ['\n--- BASE DE CONHECIMENTO E MEMÓRIA GLOBAL DA IA (SCANLOTE MATRIZ) ---'];
    ativas.forEach(function(it, idx) {
      var d = (idx + 1) + '. [' + it.categoria + '] ' + it.titulo + ': ' + it.conteudo;
      if (it.regraParaIa) d += ' | REGRA IA: ' + it.regraParaIa;
      linhas.push(d);
    });
    linhas.push('--------------------------------------------------------------------\n');
    return linhas.join('\n');
  } catch (e) {
    return '';
  }
}

// ==========================================
// PERSISTÊNCIA OPERACIONAL COM READBACK BLINDADO
// ==========================================

function obterInstanciaSpreadsheet(spreadsheetId) {
  if (spreadsheetId && String(spreadsheetId).trim() !== '') {
    try {
      return SpreadsheetApp.openById(String(spreadsheetId).trim());
    } catch (e) {
      throw new Error('Não foi possível acessar a planilha (ID: ' + spreadsheetId + '). Verifique se a planilha está compartilhada com permissão de Editor com a conta do ScanLote.');
    }
  }

  throw new Error('Nenhuma Planilha Operacional configurada. Conecte a URL da sua Google Planilha no ícone de configurações.');
}

function prepararAbaOperacional(ss, nomeAba) {
  var aba = nomeAba ? ss.getSheetByName(nomeAba) : ss.getActiveSheet();
  if (!aba) {
    aba = ss.getSheets()[0];
  }

  // Se a aba estiver completamente vazia (0 linhas), inicializa com os cabeçalhos padrão
  if (aba.getLastRow() === 0) {
    Logger.log('[SCANLOTE][SHEETS] Inicializando cabeçalhos em aba vazia.');
    aba.getRange(1, 1, 1, OPERATIONAL_HEADERS.length).setValues([OPERATIONAL_HEADERS]);
    aba.getRange(1, 1, 1, OPERATIONAL_HEADERS.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    aba.setFrozenRows(1);
    SpreadsheetApp.flush();
  }

  return aba;
}

function testarAcessoPlanilha(spreadsheetId, nomeAba) {
  var ss = obterInstanciaSpreadsheet(spreadsheetId);
  var aba = prepararAbaOperacional(ss, nomeAba);

  return {
    sucesso: true,
    id: ss.getId(),
    nome: ss.getName(),
    abaAtiva: aba.getName(),
    totalLinhas: aba.getLastRow()
  };
}

function obterSnapshotPlanilha(nomeAba, spreadsheetId) {
  var ss = obterInstanciaSpreadsheet(spreadsheetId);
  var aba = prepararAbaOperacional(ss, nomeAba);

  var lastRow = aba.getLastRow();
  var items = [];

  if (lastRow > 1) {
    var totalCols = Math.max(aba.getLastColumn(), OPERATIONAL_HEADERS.length);
    var data = aba.getRange(2, 1, lastRow - 1, totalCols).getValues();

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var hasId = String(row[0] || '').startsWith('PROD_');
      var offset = hasId ? 1 : 0;

      items.push({
        id_produto: hasId ? row[0] : ('PROD_ROW_' + (i + 2)),
        modelo: row[offset + 0] || '',
        serial_imei: row[offset + 1] || '',
        ean: row[offset + 2] || '',
        qtde: row[offset + 3] || 1,
        data: row[offset + 4] || '',
        qtd_caixa: row[offset + 5] || 1,
        caixa: row[offset + 6] || '',
        link_foto: row[offset + 7] || '',
        rowIndex: i + 2
      });
    }
  }

  return {
    sucesso: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheetName: aba.getName(),
    totalRows: items.length,
    items: items.reverse()
  };
}

function executarHealthCheck() {
  var props = PropertiesService.getScriptProperties();
  var hasGemini = Boolean(props.getProperty('GEMINI_API_KEY'));
  var globalId = props.getProperty('GLOBAL_MEMORY_SPREADSHEET_ID');
  var hasGlobalConfig = Boolean(globalId && globalId.trim());
  var memoriaAcessivel = false;

  if (hasGlobalConfig) {
    try {
      var ss = SpreadsheetApp.openById(globalId.trim());
      if (ss) memoriaAcessivel = true;
    } catch (e) {}
  }

  return {
    online: true,
    geminiConfigurada: hasGemini,
    memoriaGlobalConfigurada: hasGlobalConfig,
    memoriaGlobalAcessivel: memoriaAcessivel,
    versao: VERSAO_SISTEMA,
    timestamp: new Date().toISOString()
  };
}

/**
 * Grava produto com validação e confirmação REAL por Readback
 */
function gravarLinhaPlanilhaComReadback(payload) {
  var productId = payload.productId || ('PROD_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase());
  var spreadsheetId = payload.spreadsheetId;
  var nomeAba = payload.nomeAba;
  var caixa = (payload.caixa || '').trim();
  var modelo = payload.modelo || 'Produto Não Identificado';
  var serial_imei = payload.serial_imei || '';
  var ean = payload.ean || '';
  var linkFoto = payload.link_foto || '';
  var jobId = payload.jobId || ('job_' + Date.now());
  var modeloIa = payload.modelo_ia || 'gemini-2.5-flash';

  Logger.log('[SCANLOTE][SHEETS][WRITE_START] Gravando produto: ' + productId + ' na planilha ' + spreadsheetId);

  var ss = obterInstanciaSpreadsheet(spreadsheetId);
  var aba = prepararAbaOperacional(ss, nomeAba);

  var lastRow = aba.getLastRow();
  var targetRow = -1;

  // 1. Verificação de Idempotência (evitar duplicar por retries de rede)
  if (lastRow > 1) {
    var idsExistentes = aba.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idsExistentes.length; i++) {
      if (String(idsExistentes[i][0]).trim() === productId) {
        targetRow = i + 2;
        Logger.log('[SCANLOTE][SHEETS] Produto existente localizado na linha ' + targetRow + '. Atualizando.');
        break;
      }
    }
  }

  // 2. Contagem da quantidade de itens nesta caixa
  var qtdNaCaixa = 1;
  if (lastRow > 1) {
    var caixasRange = aba.getRange(2, 8, lastRow - 1, 1).getValues();
    var count = 0;
    for (var k = 0; k < caixasRange.length; k++) {
      if (String(caixasRange[k][0]).trim() === caixa) count++;
    }
    qtdNaCaixa = targetRow > -1 ? qtdNaCaixa : (count + 1);
  }

  var dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
  var linhaValores = [
    productId,
    modelo,
    serial_imei,
    ean,
    1,
    dataHora,
    qtdNaCaixa,
    caixa,
    linkFoto,
    jobId,
    modeloIa
  ];

  // 3. Execução da Gravação Física
  if (targetRow > -1) {
    aba.getRange(targetRow, 1, 1, linhaValores.length).setValues([linhaValores]);
  } else {
    aba.appendRow(linhaValores);
    targetRow = aba.getLastRow();
  }

  // 4. Flush Obrigatório
  SpreadsheetApp.flush();
  Logger.log('[SCANLOTE][SHEETS][WRITE_SUCCESS] Linha escrita na posição ' + targetRow);

  // 5. READBACK OBRIGATÓRIO: Leitura física para confirmação real
  var readbackRow = aba.getRange(targetRow, 1, 1, linhaValores.length).getValues()[0];
  var readProductId = String(readbackRow[0] || '').trim();

  Logger.log('[SCANLOTE][SHEETS][READBACK] Readback: ID=' + readProductId);

  if (readProductId !== productId) {
    Logger.log('[SCANLOTE][SHEETS][ERROR] Readback mismatch! Esperado: ' + productId + ', Lido: ' + readProductId);
    throw new Error('Falha na verificação de gravação (Readback Mismatch). O registro não foi confirmado no Google Sheets.');
  }

  Logger.log('[SCANLOTE][SHEETS][CONFIRMED] Produto ' + productId + ' confirmado com sucesso no Google Sheets.');

  return {
    sucesso: true,
    persisted: true,
    confirmed: true,
    productId: productId,
    rowIndex: targetRow,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheetName: aba.getName(),
    produto: {
      productId: productId,
      modelo: modelo,
      serial_imei: serial_imei,
      ean: ean,
      caixa: caixa,
      qtd_caixa: qtdNaCaixa,
      link_foto: linkFoto,
      data: dataHora,
      job_id: jobId,
      rowIndex: targetRow
    }
  };
}

/**
 * Processamento completo com IA + Gravação e Confirmação Readback
 */
function processarProdutoComIdempotencia(payload) {
  var caixa = (payload.caixa || '').trim();
  var fotos = payload.fotos || [];
  var jobId = payload.jobId || ('job_' + Date.now());
  var productId = payload.productId || ('PROD_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase());
  var spreadsheetId = payload.spreadsheetId;
  var nomeAba = payload.nomeAba;

  if (!caixa) {
    return { sucesso: false, erro: 'Identificação da caixa é obrigatória.' };
  }
  if (fotos.length === 0) {
    return { sucesso: false, erro: 'Pelo menos uma foto deve ser fornecida.' };
  }

  // 1. Chamada Gemini Vision com a Memória Global Fixa Injetada em Background
  var promptMemoria = formatarRegrasMemoriaParaPrompt();
  var rawIa = chamarGeminiVisionComFallback(fotos, jobId, promptMemoria);
  var modeloUsado = rawIa.modeloUtilizado || 'gemini-2.5-flash';

  // 2. Salva Foto no Google Drive
  var linkFoto = '';
  try {
    linkFoto = salvarFotoNoDrive(fotos[0], caixa, jobId);
  } catch (e) {
    Logger.log('Aviso: Falha ao salvar foto no Drive: ' + e.message);
  }

  // 3. Gravação com Readback Obrigatório na Planilha Operacional do Usuário
  var resGravar = gravarLinhaPlanilhaComReadback({
    productId: productId,
    spreadsheetId: spreadsheetId,
    nomeAba: nomeAba,
    caixa: caixa,
    modelo: rawIa.modelo || 'Produto Não Identificado',
    serial_imei: rawIa.serial_imei || '',
    ean: rawIa.ean || '',
    link_foto: linkFoto,
    jobId: jobId,
    modelo_ia: modeloUsado
  });

  return {
    sucesso: true,
    persisted: resGravar.persisted,
    confirmed: resGravar.confirmed,
    modeloUtilizado: modeloUsado,
    productId: productId,
    rowIndex: resGravar.rowIndex,
    spreadsheetId: resGravar.spreadsheetId,
    sheetName: resGravar.sheetName,
    produto: resGravar.produto
  };
}

function chamarGeminiVisionComFallback(fotos, jobId, promptMemoria) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('Chave GEMINI_API_KEY não configurada no Apps Script. Acesse o menu ScanLote AI > Configurar Chave Gemini.');
  }

  var parts = [];
  fotos.forEach(function(f) {
    var b64 = f.base64.indexOf(',') > -1 ? f.base64.split(',')[1] : f.base64;
    parts.push({
      inlineData: {
        mimeType: f.mimeType || 'image/jpeg',
        data: b64
      }
    });
  });

  var promptText = 'Você é o motor de visão do SCANLOTE AI.\n' +
    'Analise as fotos do produto e extraia em JSON:\n' +
    '1. "modelo": Nome comercial oficial completo do produto (Ex: Acer Nitro V 15 ANV15-52-51E4, Apple iPhone 15 Pro Max 256GB, Dell Latitude 5440).\n' +
    '2. "serial_imei": Serial ou IMEI de 15 dígitos.\n' +
    '3. "ean": Código de barras EAN-13.\n' +
    '4. "confianca": Confiança (0-100).\n' +
    (promptMemoria || '') + '\n' +
    'Responda exclusivamente JSON.';

  parts.push({ text: promptText });

  var payloadJson = {
    contents: [{ parts: parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  var ultimoErro = null;
  for (var m = 0; m < MODELOS_GEMINI.length; m++) {
    var modeloObj = MODELOS_GEMINI[m];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modeloObj.id + ':generateContent?key=' + apiKey;

    try {
      var response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payloadJson),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      var respText = response.getContentText();

      if (code === 200) {
        var parsed = JSON.parse(respText);
        var candText = parsed.candidates[0].content.parts[0].text;
        var cleanJson = candText.replace(/```json/g, '').replace(/```/g, '').trim();
        var dataIa = JSON.parse(cleanJson);
        dataIa.modeloUtilizado = modeloObj.id;
        return dataIa;
      } else {
        ultimoErro = new Error('Gemini retornou código ' + code + ': ' + respText);
      }
    } catch (e) {
      ultimoErro = e;
    }
  }

  throw ultimoErro || new Error('Todos os modelos do Gemini falharam.');
}

function salvarFotoNoDrive(foto, caixa, jobId) {
  var folder = obterOuCriarPastaDrive();
  var b64 = foto.base64.indexOf(',') > -1 ? foto.base64.split(',')[1] : foto.base64;
  var decoded = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(decoded, foto.mimeType || 'image/jpeg', caixa + '_' + jobId + '.jpg');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function obterOuCriarPastaDrive() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function abrirSidebar() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('Index').setTitle('ScanLote AI');
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Para abrir a interface, certifique-se de que o arquivo Index.html foi criado no projeto Apps Script.');
  }
}

function abrirModal() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('Index').setTitle('ScanLote AI').setWidth(900).setHeight(650);
    SpreadsheetApp.getUi().showModalDialog(html, 'ScanLote AI');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Para abrir a interface, certifique-se de que o arquivo Index.html foi criado no projeto Apps Script.');
  }
}

// ==========================================
// FUNÇÕES ADMINISTRATIVAS (SOMENTE APPS SCRIPT)
// ==========================================

function configurarMemoriaGlobalAdmin() {
  var ui = SpreadsheetApp.getUi();
  var resposta = ui.prompt(
    'Configuração interna do ScanLote',
    'Informe o ID da Planilha Google da Memória Global:',
    ui.ButtonSet.OK_CANCEL
  );

  if (resposta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var id = resposta.getResponseText().trim();
  if (!id) {
    ui.alert('ID inválido.');
    return;
  }

  try {
    var ss = SpreadsheetApp.openById(id);
    PropertiesService.getScriptProperties().setProperty('GLOBAL_MEMORY_SPREADSHEET_ID', ss.getId());
    ui.alert('Memória Global configurada com sucesso.');
  } catch (e) {
    ui.alert('Não foi possível acessar a planilha informada.');
  }
}

function configurarChaveGeminiAdmin() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Configuração da IA', 'Insira sua chave GEMINI_API_KEY do Google AI Studio:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() === ui.Button.OK) {
    var key = resp.getResponseText().trim();
    if (key) {
      PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
      ui.alert('Chave GEMINI_API_KEY salva com sucesso!');
    }
  }
}

function inicializarMemoriaGlobalAdmin() {
  try {
    obterOuCriarAbaMemoriaGlobal();
    SpreadsheetApp.getUi().alert('Aba de Memória Global verificada e inicializada!');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Erro: ' + e.message);
  }
}

function verificarSaudeDoSistema() {
  var saude = executarHealthCheck();
  var msg = 'Status Geral: ' + (saude.online ? 'ONLINE' : 'OFFLINE') + '\n' +
    'Chave Gemini: ' + (saude.geminiConfigurada ? 'CONFIGURADA' : 'NÃO CONFIGURADA') + '\n' +
    'Memória Global ID: ' + (saude.memoriaGlobalConfigurada ? 'CONFIGURADO' : 'NÃO CONFIGURADO') + '\n' +
    'Memória Global Acesso: ' + (saude.memoriaGlobalAcessivel ? 'ACESSÍVEL' : 'INACESSÍVEL');
  SpreadsheetApp.getUi().alert(msg);
}
