/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  FolderOpen,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Settings,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  Check,
  FileSpreadsheet,
  Layers,
  Database
} from 'lucide-react';
import AppLogo from './components/AppLogo.tsx';
import ContinuousCameraModal from './components/ContinuousCameraModal.tsx';
import { AppsScriptService } from './services/appsScript';

interface PhotoItem {
  id: string;
  dataUrl: string;
  mimeType: string;
  timestamp: number;
}

interface ProductResult {
  productId?: string;
  modelo: string;
  serial_imei: string;
  ean: string;
  caixa: string;
  qtd_caixa: number;
  tipo_leitura?: string;
  link_foto?: string;
  persisted?: boolean;
  confirmed?: boolean;
  spreadsheetId?: string;
  sheetName?: string;
  rowIndex?: number;
}

interface SpreadsheetSnapshot {
  spreadsheetId?: string;
  spreadsheetName?: string;
  sheetName?: string;
  headers?: string[];
  totalRows?: number;
  items?: any[];
  timestamp?: string;
}

type ProcessStage = 'IDLE' | 'ANALYZING_AI' | 'SAVING_SHEETS' | 'CONFIRMING_READBACK' | 'SUCCESS' | 'SYNC_RETRY';

export default function App() {
  // Estado Operacional da Captura
  const [caixa, setCaixa] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [stage, setStage] = useState<ProcessStage>('IDLE');
  const [productResult, setProductResult] = useState<ProductResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Câmera com Disparo Contínuo
  const [showContinuousCamera, setShowContinuousCamera] = useState(false);

  // Configuração da Planilha Operacional do Usuário (Única configuração do operador)
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [spreadsheetName, setSpreadsheetName] = useState('');
  const [activeSheetName, setActiveSheetName] = useState('');
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<'CONECTADA' | 'NAO_VALIDADA' | 'ERRO'>('NAO_VALIDADA');
  const [spreadsheetStatusDetails, setSpreadsheetStatusDetails] = useState('');
  const [validatingSheet, setValidatingSheet] = useState(false);

  // Snapshot Operacional & Drawers Secundários
  const [snapshot, setSnapshot] = useState<SpreadsheetSnapshot | null>(null);
  const [showPlanilhaDrawer, setShowPlanilhaDrawer] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Inputs nativos de câmera e galeria
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /**
   * Inicialização Silenciosa em Background
   */
  useEffect(() => {
    // 1. Carregar Planilha Operacional Salva
    const savedSheetUrl = localStorage.getItem('scanlote:v3:userSpreadsheetUrl') || '';
    const savedSheetId = localStorage.getItem('scanlote:v3:userSpreadsheetId') || '';

    if (savedSheetUrl && savedSheetId) {
      setSpreadsheetUrl(savedSheetUrl);
      setSpreadsheetId(savedSheetId);
      validarPlanilhaOperacional(savedSheetUrl, false);
    } else {
      carregarSnapshotOperacional();
    }
  }, []);

  const extrairSpreadsheetId = (urlOuId: string): string => {
    const limpo = urlOuId.trim();
    if (!limpo) return '';
    const match = limpo.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    if (limpo.length >= 20 && !limpo.includes('/') && !limpo.includes(' ')) {
      return limpo;
    }
    return '';
  };

  const validarPlanilhaOperacional = async (urlOuId: string, alertar: boolean = false) => {
    const id = extrairSpreadsheetId(urlOuId);
    if (!id) {
      setSpreadsheetStatus('NAO_VALIDADA');
      setSpreadsheetStatusDetails('Cole a URL completa da sua Google Planilha.');
      if (alertar) setErrorMsg('URL da Google Planilha inválida.');
      return;
    }

    setValidatingSheet(true);
    setSpreadsheetId(id);
    localStorage.setItem('scanlote:v3:userSpreadsheetUrl', urlOuId);
    localStorage.setItem('scanlote:v3:userSpreadsheetId', id);

    try {
      const res = await AppsScriptService.validateSpreadsheet(id);
      if (res && (res.sucesso || res.planilha)) {
        const info = res.planilha || res;
        setSpreadsheetStatus('CONECTADA');
        setSpreadsheetName(info.nome || info.spreadsheetName || 'Planilha Conectada');
        setActiveSheetName(info.abaAtiva || info.sheetName || 'Aba Ativa');
        setSpreadsheetStatusDetails(`Conectada: ${info.nome || 'Google Planilha'}`);
        carregarSnapshotOperacional(id);
        if (alertar) {
          setShowSettingsDrawer(false);
        }
      } else {
        setSpreadsheetStatus('ERRO');
        setSpreadsheetStatusDetails(
          res?.erro || 'Não foi possível acessar esta planilha. Verifique se a planilha está compartilhada com permissão de Editor.'
        );
      }
    } catch (err: any) {
      setSpreadsheetStatus('ERRO');
      setSpreadsheetStatusDetails(
        'Erro ao conectar planilha. Certifique-se de que a planilha está compartilhada com permissão de Editor.'
      );
    } finally {
      setValidatingSheet(false);
    }
  };

  const carregarSnapshotOperacional = async (customId?: string) => {
    setLoadingSnapshot(true);
    try {
      const idParaUsar = customId || spreadsheetId;
      const res = await AppsScriptService.getSnapshot(activeSheetName, idParaUsar);
      if (res && (res.snapshot || res.items || res.sucesso)) {
        const snap = res.snapshot || res;
        setSnapshot(snap);
        if (snap.spreadsheetName) setSpreadsheetName(snap.spreadsheetName);
        if (snap.sheetName) setActiveSheetName(snap.sheetName);
      }
    } catch (e) {
      console.warn('Snapshot operacional:', e);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const handleOpenContinuousCamera = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      setShowContinuousCamera(true);
    } else {
      nativeCameraInputRef.current?.click();
    }
  };

  const handleSaveBurstPhotos = (newBurstPhotos: PhotoItem[]) => {
    if (newBurstPhotos.length > 0) {
      setPhotos((prev) => [...prev, ...newBurstPhotos]);
    }
  };

  const processImageFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setPhotos((prev) => [
            ...prev,
            {
              id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              dataUrl,
              mimeType: file.type || 'image/jpeg',
              timestamp: Date.now(),
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const removePhoto = (index: number) => {
    if (stage !== 'IDLE' && stage !== 'SYNC_RETRY') return;
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLimpar = () => {
    if (stage !== 'IDLE' && stage !== 'SYNC_RETRY') return;
    setPhotos([]);
    setErrorMsg(null);
    setProductResult(null);
    setStage('IDLE');
  };

  /**
   * Processamento com Readback Obrigatório & Confirmação Real
   */
  const handleProcessar = async () => {
    if (stage !== 'IDLE' && stage !== 'SYNC_RETRY') return;

    const caixaLimpa = caixa.trim();
    if (!caixaLimpa) {
      setErrorMsg('Por favor, informe a identificação da CAIXA.');
      return;
    }

    if (photos.length === 0) {
      setErrorMsg('Adicione pelo menos 1 foto do produto.');
      return;
    }

    setErrorMsg(null);
    setStage('ANALYZING_AI');

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const productId = `PROD_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const captureSessionId = `session_${Date.now()}`;

    try {
      setStage('ANALYZING_AI');

      const payload = {
        caixa: caixaLimpa,
        productId,
        fotos: photos.map((p) => ({
          mimeType: p.mimeType,
          base64: p.dataUrl,
        })),
        spreadsheetId: spreadsheetId || undefined,
        nomeAba: activeSheetName || undefined,
        jobId,
        captureSessionId,
      };

      setStage('SAVING_SHEETS');
      const data = await AppsScriptService.processProduct(payload);

      if (data && data.sucesso && data.produto) {
        if (!data.confirmed && !data.persisted) {
          throw new Error('A gravação na planilha não pôde ser confirmada por Readback.');
        }

        setStage('CONFIRMING_READBACK');

        setProductResult({
          ...data.produto,
          productId: data.productId || productId,
          persisted: Boolean(data.persisted),
          confirmed: Boolean(data.confirmed),
          spreadsheetId: data.spreadsheetId,
          sheetName: data.sheetName,
          rowIndex: data.rowIndex || data.row,
        });

        if (data.snapshot) {
          setSnapshot(data.snapshot);
        } else {
          carregarSnapshotOperacional();
        }

        setPhotos([]);
        setStage('SUCCESS');
      } else {
        throw new Error(data?.erro || 'Falha ao processar o produto na planilha.');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('503') || msg.includes('high demand') || msg.includes('sobrecarregados')) {
        setErrorMsg('IA temporariamente com alta demanda (503). Suas fotos foram preservadas e você pode tentar reenviar a qualquer momento.');
      } else if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
        setErrorMsg('Muitas solicitações no momento (429). Aguarde alguns instantes antes de reenviar.');
      } else if (msg.includes('permiss') || msg.includes('permission') || msg.includes('403')) {
        setErrorMsg('Não foi possível gravar na sua planilha. Verifique se ela está compartilhada com permissão de Editor com o ScanLote.');
      } else {
        setErrorMsg(msg || 'Ocorreu um erro durante a gravação.');
      }
      setStage('SYNC_RETRY');
    }
  };

  const isProcessing = stage === 'ANALYZING_AI' || stage === 'SAVING_SHEETS' || stage === 'CONFIRMING_READBACK';

  return (
    <div className="min-h-screen bg-[#0d0e11] text-neutral-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* HEADER PRINCIPAL COM LOGO MAIOR E CENTRALIZADA */}
      <header className="sticky top-0 z-30 bg-[#121316]/95 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3 flex items-center justify-center relative min-h-[90px]">
        {/* LOGO CENTRALIZADA E DESTACADA */}
        <div className="flex items-center justify-center">
          <AppLogo className="h-20 sm:h-24 w-auto" />
        </div>

        {/* STATUS DA PLANILHA & BOTÕES DISCRETOS NO CANTO DIREITO */}
        <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2">
          {/* Planilha Status Pill */}
          <button
            onClick={() => setShowPlanilhaDrawer(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[11px] text-neutral-300 transition-colors cursor-pointer"
            title="Ver produtos registrados na Google Planilha"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-medium">
              {spreadsheetName ? spreadsheetName.substring(0, 14) + (spreadsheetName.length > 14 ? '...' : '') : 'Planilha'}
            </span>
            {snapshot?.items && (
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                {snapshot.items.length}
              </span>
            )}
          </button>

          {/* Configurações (Secundário) */}
          <button
            onClick={() => setShowSettingsDrawer(true)}
            className="p-2 rounded-xl border bg-neutral-900/90 text-neutral-400 hover:text-white border-neutral-800 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Configurar Planilha Google Sheets"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL: TELA DE CAPTURA DO OPERADOR */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-4">
        
        {/* CAMPO DA CAIXA */}
        <div className="bg-[#141417] border border-neutral-800/90 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>CAIXA *</span>
            </label>
            <span className="text-[10px] text-neutral-500">Ex: 1, 2, CX-01, LOTE-05</span>
          </div>
          <input
            type="text"
            value={caixa}
            onChange={(e) => setCaixa(e.target.value)}
            placeholder="Informe o número ou código da caixa..."
            className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-4 py-2.5 text-sm text-white font-bold placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* ÁREA DE CAPTURA & FOTOS */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-[#141417] border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/20'
              : 'border-neutral-800 hover:border-neutral-700'
          }`}
        >
          {/* Inputs nativos para Câmera e Arquivos */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processImageFiles(e.target.files)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processImageFiles(e.target.files)}
          />

          {photos.length === 0 ? (
            <div className="space-y-4 py-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">TIRAR FOTOS DO PRODUTO</h3>
                <p className="text-xs text-neutral-400">
                  Câmera em modo de disparo contínuo ou envie arquivos da galeria
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleOpenContinuousCamera}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Câmera (Disparo Contínuo)
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" /> Selecionar Fotos
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenContinuousCamera}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Disparo Contínuo
                  </button>
                  <span className="text-neutral-600">•</span>
                  <button
                    type="button"
                    onClick={handleLimpar}
                    disabled={isProcessing}
                    className="text-[11px] text-neutral-500 hover:text-red-400 cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Grid de Miniaturas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-neutral-800 aspect-video bg-neutral-950">
                    <img src={photo.dataUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={isProcessing}
                      className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/70 text-neutral-400 hover:text-red-400 hover:bg-black transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/70 px-1.5 py-0.5 rounded text-neutral-300">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* BOTÕES ENVIAR / PROCESSAR */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleProcessar}
                  disabled={isProcessing || !caixa.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
                >
                  {stage === 'ANALYZING_AI' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Analisando com IA...</span>
                    </>
                  ) : stage === 'SAVING_SHEETS' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                      <span>Salvando no Google Sheets...</span>
                    </>
                  ) : stage === 'CONFIRMING_READBACK' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                      <span>Confirmando Gravação Real...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>ENVIAR / PROCESSAR</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLimpar}
                  disabled={isProcessing}
                  className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MENSAGEM DE ERRO OU RETRY */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <div>{errorMsg}</div>
              {stage === 'SYNC_RETRY' && (
                <button
                  onClick={handleProcessar}
                  className="mt-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar Sincronizar Novamente
                </button>
              )}
            </div>
          </div>
        )}

        {/* CARD DE RESULTADO CONFIRMADO NA PLANILHA */}
        {productResult && (
          <div className="bg-gradient-to-b from-[#16171c] to-[#121316] border border-emerald-800/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">✓ PRODUTO REGISTRADO</h3>
                  <p className="text-[10px] text-emerald-400 font-medium">
                    Confirmado no Google Sheets (Linha {productResult.rowIndex || '—'})
                  </p>
                </div>
              </div>
            </div>

            {/* Informações do Produto */}
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">MODELO:</span>
                <div className="text-sm font-extrabold text-white mt-0.5">{productResult.modelo || '—'}</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/60 text-[11px]">
                <div>
                  <span className="text-[10px] text-neutral-500 block">SERIAL / IMEI:</span>
                  <span className="font-mono font-bold text-neutral-200">{productResult.serial_imei || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block">EAN:</span>
                  <span className="font-mono font-bold text-neutral-200">{productResult.ean || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block">CAIXA:</span>
                  <span className="font-bold text-neutral-200">{productResult.caixa}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block">QTD / CAIXA:</span>
                  <span className="font-extrabold text-emerald-400">{productResult.qtd_caixa}</span>
                </div>
              </div>
            </div>

            {productResult.link_foto && (
              <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Foto armazenada no Google Drive</span>
                <a
                  href={productResult.link_foto}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Abrir no Drive <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

      </main>

      {/* CÂMERA DE DISPARO CONTÍNUO */}
      <ContinuousCameraModal
        isOpen={showContinuousCamera}
        onClose={() => setShowContinuousCamera(false)}
        onSavePhotos={handleSaveBurstPhotos}
        initialPhotosCount={photos.length}
      />

      {/* DRAWER / MODAL DE CONFIGURAÇÕES (SECUNDÁRIO) */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#141417] border border-neutral-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Configurar Google Sheets</h3>
              </div>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                className="p-1 rounded text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-neutral-400 leading-relaxed">
                Conecte a planilha Google Sheets onde os produtos processados serão registrados com confirmação real.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  URL da Google Planilha
                </label>
                <input
                  type="text"
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {spreadsheetStatus === 'CONECTADA' && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold">{spreadsheetName || 'Planilha Conectada'}</div>
                    <div className="text-[10px] text-neutral-400">Aba: {activeSheetName || 'Aba Ativa'}</div>
                  </div>
                </div>
              )}

              {spreadsheetStatus === 'ERRO' && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl text-rose-300 text-[11px]">
                  {spreadsheetStatusDetails}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsDrawer(false)}
                  className="px-3 py-2 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => validarPlanilhaOperacional(spreadsheetUrl, true)}
                  disabled={validatingSheet || !spreadsheetUrl.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow disabled:opacity-50 cursor-pointer"
                >
                  {validatingSheet ? 'Conectando...' : 'Conectar Planilha'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DA PLANILHA OPERACIONAL (INVENTÁRIO) */}
      {showPlanilhaDrawer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-[#141417] border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Inventário na Google Planilha</h3>
                  <p className="text-[10px] text-neutral-400">
                    {spreadsheetName || 'Planilha Operacional'} • {activeSheetName || 'Aba Ativa'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => carregarSnapshotOperacional()}
                  disabled={loadingSnapshot}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                  title="Atualizar Linhas"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSnapshot ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
                <button
                  onClick={() => setShowPlanilhaDrawer(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
              {loadingSnapshot ? (
                <div className="py-12 text-center text-neutral-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-2" />
                  Lendo registros da sua planilha...
                </div>
              ) : snapshot?.items && snapshot.items.length > 0 ? (
                snapshot.items.map((it: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-1 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{it.modelo || 'Produto sem nome'}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">#{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-neutral-400 pt-1">
                      <div>SN: <span className="font-mono text-neutral-200">{it.serial_imei || '—'}</span></div>
                      <div>EAN: <span className="font-mono text-neutral-200">{it.ean || '—'}</span></div>
                      <div>Caixa: <span className="text-neutral-200 font-bold">{it.caixa || '—'}</span></div>
                      <div>Qtd: <span className="text-emerald-400 font-bold">{it.qtd_caixa || 1}</span></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-neutral-500 text-xs">
                  Nenhum produto registrado nesta planilha ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
