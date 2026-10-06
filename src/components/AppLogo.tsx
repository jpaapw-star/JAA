import React from 'react';
import logoAsset from '../assets/images/regenerated_image_1791228279766.png';

export default function AppLogo({ className = "h-20 w-auto" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <img
        src={logoAsset}
        alt="ScanLote Logo"
        className="h-full w-auto object-contain drop-shadow-lg rounded-2xl transition-transform hover:scale-105"
      />
    </div>
  );
}
