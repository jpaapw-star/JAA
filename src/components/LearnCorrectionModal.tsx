/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Lightbulb,
  Send
} from 'lucide-react';
import { AppsScriptService } from '../services/appsScript';

interface LearnCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalProduct: {
    modelo?: string;
    serial_imei?: string;
    ean?: string;
    caixa?: string;
    fotos?: string[];
  };
  onSuccess?: (newRule: any) => void;
}

export default function LearnCorrectionModal({
  isOpen,
  onClose,
  originalProduct,
  onSuccess,
}: LearnCorrectionModalProps) {
  const [corrigidoModelo, setCorrigidoModelo] = useState(originalProduct.modelo || '');
  const [corrigidoSerial, setCorrigidoSerial] = useState(originalProduct.serial_imei || '');
  const [corrigidoEan, setCorrigidoEan] = useState(originalProduct.ean || '');
  const [marca, setMarca] = useState('');
  const [codigoPn, setCodigoPn] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucessoEnviado, setSucessoEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSalvarCorrecao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const payload = {
        produtoOriginal: {
          modelo: originalProduct.modelo,
          serial_imei: originalProduct.serial_imei,
          ean: originalProduct.ean,
          caixa: originalProduct.caixa,
        },
        correcao: {
          modelo: corrigidoModelo.trim(),
          serial_imei: corrigidoSerial.trim(),
          ean: corrigidoEan.trim(),
          marca: marca.trim(),
          codigoPn: codigoPn.trim(),
          observacoes: observacoes.trim(),
        },
      };

      const resp = await AppsScriptService.submitCorrection(payload);

      if (resp && (resp.sucesso || resp.regra || resp.id)) {
        setSucessoEnviado(true);
        if (onSuccess) {
          onSuccess(resp);
        }
        setTimeout(() => {
          onClose();
          setSucessoEnviado(false);
        }, 2200);
      } else {
        throw new Error(resp?.erro || 'Não foi possível registrar a correção.');
      }
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao registrar correção.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#141417] border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-neutral-900 border-b border-indigo-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Brain className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Sugerir Correção de Leitura
                <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded-full">
                  Feedback IA
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Sua correção será avaliada para aprimorar a Memória Global Oficial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sucessoEnviado ? (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white">Correção Registrada com Sucesso!</h4>
            <p className="text-xs text-neutral-400 max-w-sm">
              Obrigado pelo feedback. A sugestão foi registrada na fila de validação da Memória Global Oficial.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSalvarCorrecao} className="p-4 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
            {erro && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {/* Comparativo: O que a IA leu vs Correção */}
            <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Leitura Identificada pela IA
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 bg-neutral-900/60 p-2.5 rounded-lg">
                <div>Modelo: <span className="font-semibold text-neutral-200 block truncate">{originalProduct.modelo || '—'}</span></div>
                <div>Serial: <span className="font-mono text-neutral-200 block truncate">{originalProduct.serial_imei || '—'}</span></div>
                <div>EAN: <span className="font-mono text-neutral-200 block truncate">{originalProduct.ean || '—'}</span></div>
                <div>Caixa: <span className="text-neutral-200 block">{originalProduct.caixa || '—'}</span></div>
              </div>
            </div>

            {/* Campos Corrigidos */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Nome / Modelo Correto Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={corrigidoModelo}
                  onChange={(e) => setCorrigidoModelo(e.target.value)}
                  placeholder="Ex: Apple iPhone 15 Pro Max 256GB Titânio Natural"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ex: Apple, Samsung, Dell"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Código Técnico / Part Number
                  </label>
                  <input
                    type="text"
                    value={codigoPn}
                    onChange={(e) => setCodigoPn(e.target.value)}
                    placeholder="Ex: A3106, SM-S928B"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Serial / IMEI Correto
                  </label>
                  <input
                    type="text"
                    value={corrigidoSerial}
                    onChange={(e) => setCorrigidoSerial(e.target.value)}
                    placeholder="Ex: 359123456789012"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    EAN Correto
                  </label>
                  <input
                    type="text"
                    value={corrigidoEan}
                    onChange={(e) => setCorrigidoEan(e.target.value)}
                    placeholder="Ex: 7891234567890"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Observações ou Regra de Reconhecimento (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: O modelo impresso na etiqueta frontal é X, mas o código oficial da caixa é Y."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Rodapé Informativo */}
            <div className="p-2.5 bg-indigo-950/30 border border-indigo-900/40 rounded-xl flex items-start gap-2 text-[11px] text-indigo-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <span>
                As correções passam por validação do administrador antes de se tornarem regras globais oficiais, garantindo alta precisão para todos os operadores.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="px-3 py-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando || !corrigidoModelo.trim()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
              >
                {salvando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Enviar Sugestão à Memória
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
