/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Check,
  RotateCcw,
  Zap,
  ZapOff,
  Trash2
} from 'lucide-react';

interface ContinuousCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePhotos: (photos: { id: string; dataUrl: string; mimeType: string; timestamp: number }[]) => void;
  initialPhotosCount?: number;
}

export default function ContinuousCameraModal({
  isOpen,
  onClose,
  onSavePhotos,
  initialPhotosCount = 0,
}: ContinuousCameraModalProps) {
  const [capturedPhotos, setCapturedPhotos] = useState<
    { id: string; dataUrl: string; mimeType: string; timestamp: number }[]
  >([]);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [flashEffect, setFlashEffect] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCapturedPhotos([]);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const playShutterSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
  };

  const startCamera = async () => {
    stopCamera();
    setStreamError(null);

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Checa suporte a flash/torch
      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (capabilities && capabilities.torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Erro ao acessar a câmera:', err);
      setStreamError(
        'Não foi possível acessar a câmera do dispositivo. Verifique as permissões de acesso.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Erro ao alternar flash/torch:', e);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const captureSingleFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    setFlashEffect(true);
    playShutterSound();
    setTimeout(() => setFlashEffect(false), 120);

    const newPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      dataUrl,
      mimeType: 'image/jpeg',
      timestamp: Date.now(),
    };

    setCapturedPhotos((prev) => [...prev, newPhoto]);
  };

  const removeCapturedPhoto = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFinish = () => {
    onSavePhotos(capturedPhotos);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none touch-none">
      {/* Elementos ocultos */}
      <canvas ref={canvasRef} className="hidden" />

      {/* FLASH VISUAL EFFECT */}
      {flashEffect && (
        <div className="absolute inset-0 bg-white/80 z-40 pointer-events-none transition-opacity duration-100" />
      )}

      {/* TOP BAR */}
      <div className="relative z-30 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {/* Badge de Disparo Contínuo */}
          <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-neutral-700/80 text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Disparo Contínuo</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full text-[10px]">
              {capturedPhotos.length} fotos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full border transition-colors cursor-pointer ${
                torchOn
                  ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                  : 'bg-neutral-900/80 text-neutral-400 border-neutral-700'
              }`}
              title="Lanterna"
            >
              {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={switchCamera}
            className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-white cursor-pointer"
            title="Alternar Câmera"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* VIEWPORT DA CÂMERA */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {streamError ? (
          <div className="p-6 text-center text-rose-300 text-xs max-w-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
              <Camera className="w-6 h-6" />
            </div>
            <p>{streamError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-white font-bold text-xs"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />

            {/* Grid de enquadramento suave */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/10">
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div />
            </div>
          </>
        )}
      </div>

      {/* FAIXA INFERIOR: MINIATURAS + CONTROLES DE DISPARO */}
      <div className="relative z-30 bg-gradient-to-t from-black via-black/90 to-transparent p-4 pb-6 space-y-3">
        {/* Strip de fotos capturadas nesta sessão */}
        {capturedPhotos.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {capturedPhotos.map((p, idx) => (
              <div
                key={p.id}
                className="relative group shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 shadow-md"
              >
                <img src={p.dataUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeCapturedPhoto(idx)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/80 text-rose-400 hover:bg-rose-600 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/80 text-[9px] font-bold px-1 rounded text-white">
                  #{idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Controles de Disparo Centralizados e Limpos */}
        <div className="flex items-center justify-between px-4 pt-1">
          {/* Contador / Espaçador à esquerda */}
          <div className="w-24 text-left">
            <span className="text-xs text-neutral-400 font-semibold">
              {capturedPhotos.length > 0 ? `${capturedPhotos.length} capturada${capturedPhotos.length > 1 ? 's' : ''}` : ''}
            </span>
          </div>

          {/* BOTÃO PRINCIPAL DE DISPARO (SHUTTER) */}
          <button
            type="button"
            onClick={captureSingleFrame}
            className="relative w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 cursor-pointer active:scale-90 transition-transform shadow-2xl hover:border-indigo-400"
            title="Disparar foto"
          >
            <div className="w-full h-full rounded-full bg-white hover:bg-neutral-200 transition-colors shadow-inner" />
          </button>

          {/* Botão Concluir à direita */}
          <div className="w-24 flex justify-end">
            <button
              type="button"
              onClick={handleFinish}
              disabled={capturedPhotos.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Concluir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
