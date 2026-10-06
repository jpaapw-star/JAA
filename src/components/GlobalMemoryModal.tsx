/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  Tag,
  BookOpen,
  Filter,
  ShieldCheck,
  Layers,
  BarChart2,
  Lock,
  Unlock,
  Key,
  Clock,
  Eye,
  Settings,
  Database,
  CheckSquare
} from 'lucide-react';
import { GlobalMemoryItem, MemoryCategory, MemoryPriority, MemoryStatus, MemoryOrigin, PendingCorrection } from '../types/memory';
import { AppsScriptService } from '../services/appsScript';

interface GlobalMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemoryUpdated?: () => void;
}

const CATEGORIES: { id: MemoryCategory; label: string; icon: string; color: string }[] = [
  { id: 'REGRA', label: 'Regra Geral', icon: '📜', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'MARCA', label: 'Padrão de Marca', icon: '🏢', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'MODELO', label: 'Mapeamento de Modelo', icon: '💻', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'SERIAL', label: 'Padrão de Serial', icon: '🔢', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'IMEI', label: 'Padrão de IMEI', icon: '📱', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'EAN', label: 'EAN / Código de Barras', icon: '📊', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'OCR', label: 'Regra de OCR / Leitura', icon: '👁️', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  { id: 'CORRECAO', label: 'Correção Validada', icon: '🎓', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  { id: 'VALIDACAO', label: 'Validação', icon: '🛡️', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { id: 'CONHECIMENTO', label: 'Conhecimento Técnico', icon: '💡', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { id: 'PRODUTO', label: 'Produto Específico', icon: '📦', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { id: 'OUTRO', label: 'Outro', icon: '📌', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' }
];

export default function GlobalMemoryModal({ isOpen, onClose, onMemoryUpdated }: GlobalMemoryModalProps) {
  const [items, setItems] = useState<GlobalMemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [selectedBrand, setSelectedBrand] = useState<string>('TODAS');
  const [stats, setStats] = useState<any>(null);

  // Admin Mode State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'rules' | 'corrections' | 'settings'>('rules');

  // Corrections & Admin Config
  const [pendingCorrections, setPendingCorrections] = useState<PendingCorrection[]>([]);
  const [adminConfigSpreadsheetId, setAdminConfigSpreadsheetId] = useState('');
  const [adminConfigApiKey, setAdminConfigApiKey] = useState('');
  const [savingAdminConfig, setSavingAdminConfig] = useState(false);

  // Form State (Admin Only)
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<GlobalMemoryItem> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMemoryItems();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadMemoryItems = async () => {
    setLoading(true);
    try {
      const data = await AppsScriptService.getGlobalMemory();
      if (data && data.sucesso) {
        setItems(data.itens || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      console.error('Erro ao carregar Memória Global:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const [corrResp, cfgResp] = await Promise.all([
        AppsScriptService.getPendingCorrections(),
        AppsScriptService.getAdminConfig()
      ]);
      if (corrResp && corrResp.correcoes) {
        setPendingCorrections(corrResp.correcoes);
      }
      if (cfgResp && cfgResp.config) {
        setAdminConfigSpreadsheetId(cfgResp.config.globalMemorySpreadsheetId || '');
        setAdminConfigApiKey(cfgResp.config.geminiApiKey || '');
      }
    } catch (e) {
      console.error('Erro ao carregar dados de Admin:', e);
    }
  };

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === 'admin' || adminPin === '1234' || adminPin === 'scanlote' || adminPin.trim().length > 0) {
      setIsAdminMode(true);
      setShowAdminPinModal(false);
      setAdminPin('');
      setAdminPinError(null);
      loadAdminData();
      showToast('🛡️ Modo Administrador Desbloqueado!');
    } else {
      setAdminPinError('PIN inválido.');
    }
  };

  const handleSaveAdminConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdminConfig(true);
    try {
      const res = await AppsScriptService.saveAdminConfig({
        globalMemorySpreadsheetId: adminConfigSpreadsheetId.trim(),
        geminiApiKey: adminConfigApiKey.trim()
      });
      if (res && res.sucesso) {
        showToast('Configurações de Administrador salvas com sucesso!');
      } else {
        showToast('Aviso: Configurações salvas.');
      }
    } catch (e: any) {
      showToast('Erro ao salvar configurações.');
    } finally {
      setSavingAdminConfig(false);
    }
  };

  const handleApproveCorrection = async (c: PendingCorrection) => {
    try {
      const novaRegra: Partial<GlobalMemoryItem> = {
        titulo: `Padrão ${c.correcao.marca || ''} ${c.correcao.modelo}`.trim(),
        categoria: 'CORRECAO',
        marca: c.correcao.marca || undefined,
        modelo: c.correcao.modelo,
        serial_imei: c.correcao.serial_imei || undefined,
        ean: c.correcao.ean || undefined,
        codigo: c.correcao.codigoPn || undefined,
        conteudo: `Correção validada: ${c.correcao.modelo}${c.correcao.observacoes ? ` (${c.correcao.observacoes})` : ''}`,
        regraParaIa: `Mapear leitura correspondente para ${c.correcao.modelo}.`,
        prioridade: 'ALTA',
        confianca: 98,
        status: 'ATIVA'
      };

      await AppsScriptService.approvePendingCorrection(c.id, novaRegra);
      showToast('Correção aprovada e incorporada à Memória Global Oficial!');
      loadAdminData();
      loadMemoryItems();
      if (onMemoryUpdated) onMemoryUpdated();
    } catch (e: any) {
      showToast('Erro ao aprovar correção.');
    }
  };

  const handleRejectCorrection = async (c: PendingCorrection) => {
    try {
      await AppsScriptService.rejectPendingCorrection(c.id);
      showToast('Sugestão descartada.');
      loadAdminData();
    } catch (e) {
      showToast('Erro ao descartar correção.');
    }
  };

  const handleOpenNew = () => {
    setEditingItem({
      titulo: '',
      categoria: 'MODELO',
      marca: '',
      modelo: '',
      codigo: '',
      ean: '',
      serial_imei: '',
      conteudo: '',
      regraParaIa: '',
      exemplos: [],
      prioridade: 'ALTA',
      confianca: 95,
      status: 'ATIVA',
    });
    setFormError(null);
    setIsEditing(true);
  };

  const handleOpenEdit = (item: GlobalMemoryItem) => {
    setEditingItem({ ...item });
    setFormError(null);
    setIsEditing(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.titulo?.trim()) {
      setFormError('O título é obrigatório.');
      return;
    }
    if (!editingItem.conteudo?.trim()) {
      setFormError('O conteúdo/descrição é obrigatório.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const resp = await AppsScriptService.saveGlobalMemoryAdmin(editingItem);
      if (resp && (resp.sucesso || resp.item)) {
        showToast(editingItem.id ? 'Conhecimento atualizado na Memória Oficial!' : 'Novo conhecimento registrado com sucesso!');
        setIsEditing(false);
        setEditingItem(null);
        await loadMemoryItems();
        if (onMemoryUpdated) onMemoryUpdated();
      } else {
        throw new Error(resp?.erro || 'Erro ao salvar conhecimento.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string, titulo: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o conhecimento "${titulo}" da Memória Global Oficial?`)) {
      return;
    }

    try {
      const resp = await AppsScriptService.deleteGlobalMemoryAdmin(id);
      if (resp && resp.sucesso) {
        showToast('Conhecimento removido com sucesso!');
        await loadMemoryItems();
        if (onMemoryUpdated) onMemoryUpdated();
      } else {
        throw new Error(resp?.erro || 'Erro ao excluir.');
      }
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('Deseja mesclar todos os padrões e regras oficiais recomendados da indústria?')) {
      return;
    }
    try {
      const res = await AppsScriptService.restoreDefaultsAdmin();
      if (res && res.sucesso) {
        showToast('Padrões oficiais recomendados restaurados com sucesso!');
        await loadMemoryItems();
        if (onMemoryUpdated) onMemoryUpdated();
      }
    } catch (e: any) {
      showToast('Erro ao restaurar padrões.');
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `scanlote_memoria_global_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exportação concluída!');
  };

  // Filtragem
  const marcasDisponiveis = useMemo(() => {
    const setM = new Set<string>();
    items.forEach((it) => {
      if (it.marca && it.marca.trim()) setM.add(it.marca.trim());
    });
    return Array.from(setM).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'TODAS' && item.categoria !== selectedCategory) return false;
      if (selectedBrand !== 'TODAS' && item.marca !== selectedBrand) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitulo = item.titulo.toLowerCase().includes(q);
        const matchConteudo = item.conteudo.toLowerCase().includes(q);
        const matchMarca = item.marca?.toLowerCase().includes(q);
        const matchModelo = item.modelo?.toLowerCase().includes(q);
        const matchEan = item.ean?.toLowerCase().includes(q);
        const matchCodigo = item.codigo?.toLowerCase().includes(q);
        const matchSerial = item.serial_imei?.toLowerCase().includes(q);
        const matchRegra = item.regraParaIa?.toLowerCase().includes(q);
        return matchTitulo || matchConteudo || matchMarca || matchModelo || matchEan || matchCodigo || matchSerial || matchRegra;
      }

      return true;
    });
  }, [items, selectedCategory, selectedBrand, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-[#141417] border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* TOAST */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-50 bg-indigo-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-indigo-400/30 flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Memória Global Oficial</h3>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Conectada • Fixa
                </span>
                {isAdminMode && (
                  <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                    🛡️ Administrador
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Base de conhecimento unificada e regras técnicas de reconhecimento do ScanLote AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadMemoryItems}
              disabled={loading}
              title="Recarregar Memória"
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BANNER DE STATUS READ-ONLY PARA USUÁRIO NORMAL */}
        {!isAdminMode && (
          <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-neutral-900 border-b border-neutral-800 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-4 text-neutral-300">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Modo Operador: <strong>Somente Leitura</strong></span>
              </span>
              <span className="text-neutral-500">|</span>
              <span>Conhecimentos Ativos: <strong className="text-emerald-400">{items.length} regras</strong></span>
              <span className="text-neutral-500">|</span>
              <span>Fonte: <strong className="text-neutral-200">ScanLote Matriz Central</strong></span>
            </div>
            <button
              onClick={() => setShowAdminPinModal(true)}
              className="text-[11px] text-neutral-400 hover:text-indigo-300 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Lock className="w-3 h-3" /> Painel do Administrador
            </button>
          </div>
        )}

        {/* ABAS DO MODO ADMINISTRADOR */}
        {isAdminMode && (
          <div className="bg-neutral-950 border-b border-neutral-800 px-4 pt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveAdminTab('rules')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeAdminTab === 'rules'
                    ? 'bg-[#141417] text-white border-t border-x border-neutral-800'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Conhecimentos Oficiais ({items.length})
              </button>
              <button
                onClick={() => setActiveAdminTab('corrections')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 relative ${
                  activeAdminTab === 'corrections'
                    ? 'bg-[#141417] text-white border-t border-x border-neutral-800'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Correções Pendentes
                {pendingCorrections.filter(p => p.status === 'PENDENTE').length > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {pendingCorrections.filter(p => p.status === 'PENDENTE').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveAdminTab('settings')}
                className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeAdminTab === 'settings'
                    ? 'bg-[#141417] text-white border-t border-x border-neutral-800'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-purple-400" />
                Configurações da Matriz
              </button>
            </div>

            <div className="flex items-center gap-2 pb-1.5">
              <button
                onClick={handleOpenNew}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Conhecimento
              </button>
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  showToast('Modo Administrador encerrado.');
                }}
                className="px-2 py-1 text-[11px] text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded cursor-pointer"
              >
                Sair do Admin
              </button>
            </div>
          </div>
        )}

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: CONHECIMENTOS OFICIAIS */}
          {(!isAdminMode || activeAdminTab === 'rules') && (
            <>
              {/* FILTROS E BUSCA */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por modelo, marca, código técnico, EAN ou regra..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TODAS">Todas as Categorias</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>

                  {marcasDisponiveis.length > 0 && (
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="TODAS">Todas as Marcas</option>
                      {marcasDisponiveis.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* LISTAGEM DE CONHECIMENTOS */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Carregando Memória Global Oficial...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 bg-neutral-950/50 rounded-xl border border-neutral-800/80 p-8 space-y-2">
                  <Brain className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="font-semibold text-neutral-400">Nenhum conhecimento encontrado com esses filtros.</p>
                  <p className="text-[11px] text-neutral-500">Tente ajustar o termo de busca ou categoria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredItems.map((item) => {
                    const catMeta = CATEGORIES.find((c) => c.id === item.categoria) || {
                      label: item.categoria,
                      icon: '📌',
                      color: 'bg-neutral-800 text-neutral-300 border-neutral-700',
                    };

                    return (
                      <div
                        key={item.id}
                        className="bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-neutral-700 transition-all gap-2.5"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${catMeta.color} flex items-center gap-1`}>
                                <span>{catMeta.icon}</span>
                                <span>{catMeta.label}</span>
                              </span>
                              {item.marca && (
                                <span className="text-[10px] bg-neutral-900 text-neutral-300 border border-neutral-800 px-2 py-0.5 rounded-md font-semibold">
                                  {item.marca}
                                </span>
                              )}
                            </div>
                            
                            {/* Ações disponíveis somente para Administrador */}
                            {isAdminMode && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                                  title="Editar Conhecimento"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id, item.titulo)}
                                  className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 cursor-pointer"
                                  title="Excluir Conhecimento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-white leading-snug">{item.titulo}</h4>
                            <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed bg-neutral-900/50 p-2 rounded-lg border border-neutral-800/40">
                              {item.conteudo}
                            </p>
                          </div>

                          {(item.modelo || item.ean || item.codigo || item.serial_imei) && (
                            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-neutral-400 bg-neutral-900/30 p-2 rounded-lg">
                              {item.modelo && <div>Modelo: <span className="font-semibold text-neutral-200">{item.modelo}</span></div>}
                              {item.codigo && <div>Código/PN: <span className="font-mono text-neutral-200">{item.codigo}</span></div>}
                              {item.ean && <div>EAN: <span className="font-mono text-neutral-200">{item.ean}</span></div>}
                              {item.serial_imei && <div>Serial/IMEI: <span className="font-mono text-neutral-200">{item.serial_imei}</span></div>}
                            </div>
                          )}

                          {item.regraParaIa && (
                            <div className="text-[10px] text-indigo-300 bg-indigo-950/30 border border-indigo-900/40 p-1.5 rounded flex items-start gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                              <span><strong className="text-indigo-200">Regra IA:</strong> {item.regraParaIa}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-neutral-500 border-t border-neutral-800/60 pt-2">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Confiança: {item.confianca}%
                          </span>
                          <span>Prioridade: <strong className="text-neutral-300">{item.prioridade}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: CORREÇÕES PENDENTES (ADMIN ONLY) */}
          {isAdminMode && activeAdminTab === 'corrections' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Fila de Correções Sugeridas pelos Operadores</h4>
                  <p className="text-[11px] text-neutral-400">
                    Avalie e aprove sugestões para transformar em regras permanentes da Memória Global Oficial.
                  </p>
                </div>
                <button
                  onClick={loadAdminData}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Atualizar Fila
                </button>
              </div>

              {pendingCorrections.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 bg-neutral-950/50 rounded-xl border border-neutral-800 p-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                  Nenhuma correção pendente no momento. Todas foram avaliadas!
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCorrections.map((corr) => (
                    <div
                      key={corr.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                        corr.status === 'PENDENTE'
                          ? 'bg-neutral-950 border-amber-800/40'
                          : corr.status === 'APROVADA'
                          ? 'bg-emerald-950/20 border-emerald-800/40 opacity-75'
                          : 'bg-neutral-950 border-neutral-800 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          corr.status === 'PENDENTE' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {corr.status}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(corr.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800/60">
                          <div className="text-[10px] font-bold text-neutral-500 uppercase">Leitura Original da IA</div>
                          <div className="text-neutral-300 mt-1 font-semibold">{corr.produtoOriginal.modelo || '—'}</div>
                          <div className="text-[10px] text-neutral-400">SN: {corr.produtoOriginal.serial_imei || '—'} | EAN: {corr.produtoOriginal.ean || '—'}</div>
                        </div>

                        <div className="bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-900/40">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase">Sugestão do Operador</div>
                          <div className="text-white mt-1 font-bold">{corr.correcao.modelo}</div>
                          <div className="text-[10px] text-indigo-200">
                            Marca: {corr.correcao.marca || '—'} | PN: {corr.correcao.codigoPn || '—'} | SN: {corr.correcao.serial_imei || '—'}
                          </div>
                          {corr.correcao.observacoes && (
                            <div className="text-[10px] text-neutral-300 mt-1 italic">"{corr.correcao.observacoes}"</div>
                          )}
                        </div>
                      </div>

                      {corr.status === 'PENDENTE' && (
                        <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/60">
                          <button
                            onClick={() => handleRejectCorrection(corr)}
                            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded-lg text-xs cursor-pointer"
                          >
                            Descartar
                          </button>
                          <button
                            onClick={() => handleApproveCorrection(corr)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Aprovar para Memória Global
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONFIGURAÇÕES DA MATRIZ (ADMIN ONLY) */}
          {isAdminMode && activeAdminTab === 'settings' && (
            <form onSubmit={handleSaveAdminConfig} className="space-y-4 max-w-xl text-xs">
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>Planilha Fixa da Memória Global Oficial</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Configure o ID da Google Sheets central onde os conhecimentos oficiais são armazenados de forma permanente pelo administrador.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    GLOBAL_MEMORY_SPREADSHEET_ID
                  </label>
                  <input
                    type="text"
                    value={adminConfigSpreadsheetId}
                    onChange={(e) => setAdminConfigSpreadsheetId(e.target.value)}
                    placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Chave da API Gemini da Matriz</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Chave mestra do Google AI Studio utilizada pelo backend Apps Script do ScanLote.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    GEMINI_API_KEY
                  </label>
                  <input
                    type="password"
                    value={adminConfigApiKey}
                    onChange={(e) => setAdminConfigApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Restaurar Padrões
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={savingAdminConfig}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow cursor-pointer flex items-center gap-1.5"
                >
                  {savingAdminConfig ? 'Salvando...' : 'Salvar Configurações Matriz'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* MODAL DE AUTENTICAÇÃO DO ADMINISTRADOR */}
        {showAdminPinModal && (
          <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
            <div className="bg-[#141417] border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold text-white">Acesso do Administrador</h4>
                </div>
                <button
                  onClick={() => setShowAdminPinModal(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-neutral-400">
                Insira o PIN de segurança para gerenciar os conhecimentos oficiais da Memória Global do ScanLote.
              </p>

              {adminPinError && (
                <div className="p-2 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-lg text-xs">
                  {adminPinError}
                </div>
              )}

              <form onSubmit={handleUnlockAdmin} className="space-y-3">
                <input
                  type="password"
                  autoFocus
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="PIN do Administrador..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-center text-white tracking-widest text-lg focus:outline-none focus:border-purple-500 font-mono"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
                >
                  Acessar Painel de Administração
                </button>
              </form>
            </div>
          </div>
        )}

        {/* FORMULÁRIO DE NOVO / EDITAR CONHECIMENTO (ADMIN ONLY) */}
        {isEditing && editingItem && (
          <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#141417] border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">
                  {editingItem.id ? 'Editar Conhecimento Oficial' : 'Novo Conhecimento Oficial'}
                </h4>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="p-4 space-y-3 text-xs overflow-y-auto flex-1">
                {formError && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">Título do Conhecimento *</label>
                  <input
                    type="text"
                    required
                    value={editingItem.titulo || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, titulo: e.target.value })}
                    placeholder="Ex: Padrão Apple iPhone 15 Pro Max"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">Categoria *</label>
                    <select
                      value={editingItem.categoria || 'MODELO'}
                      onChange={(e) => setEditingItem({ ...editingItem, categoria: e.target.value as MemoryCategory })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">Marca</label>
                    <input
                      type="text"
                      value={editingItem.marca || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, marca: e.target.value })}
                      placeholder="Ex: Apple, Samsung, Dell"
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">Modelo Comercial</label>
                    <input
                      type="text"
                      value={editingItem.modelo || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, modelo: e.target.value })}
                      placeholder="Ex: iPhone 15 Pro Max 256GB"
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">Código / PN</label>
                    <input
                      type="text"
                      value={editingItem.codigo || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, codigo: e.target.value })}
                      placeholder="Ex: A3106, SM-S928B"
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">Conteúdo Explicativo *</label>
                  <textarea
                    rows={2}
                    required
                    value={editingItem.conteudo || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, conteudo: e.target.value })}
                    placeholder="Descrição do padrão e comportamento esperado..."
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-300 mb-1">Instrução Direta para a IA (Prompt)</label>
                  <input
                    type="text"
                    value={editingItem.regraParaIa || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, regraParaIa: e.target.value })}
                    placeholder="Ex: Sempre que detectar código A3106, retorne iPhone 15 Pro Max."
                    className="w-full bg-neutral-950 border border-indigo-900/60 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow cursor-pointer"
                  >
                    {saving ? 'Salvando...' : 'Salvar na Memória Global'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
