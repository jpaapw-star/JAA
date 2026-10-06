import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Iniciando build do ScanLote AI para Google Apps Script...');

try {
  // 1. Executa o build com vite-plugin-singlefile
  execSync('npx vite build --config vite.apps-script.config.ts', { stdio: 'inherit' });

  const distHtmlPath = path.resolve(process.cwd(), 'dist-apps-script', 'index.html');
  const targetHtmlPath = path.resolve(process.cwd(), 'google-apps-script', 'Index.html');

  if (!fs.existsSync(distHtmlPath)) {
    throw new Error(`Arquivo ${distHtmlPath} não foi gerado pelo build.`);
  }

  let htmlContent = fs.readFileSync(distHtmlPath, 'utf8');

  // Adiciona a tag <base target="_top"> recomendada para Google Apps Script se não estiver presente
  if (!htmlContent.includes('<base target="_top">')) {
    htmlContent = htmlContent.replace('<head>', '<head>\n  <base target="_top">');
  }

  fs.writeFileSync(targetHtmlPath, htmlContent, 'utf8');
  console.log(`✅ Sucesso! O aplicativo React completo foi empacotado em: ${targetHtmlPath}`);
  console.log(`📦 Tamanho do Index.html gerado: ${(fs.statSync(targetHtmlPath).size / 1024).toFixed(1)} KB`);
} catch (error) {
  console.error('❌ Erro durante o build para Apps Script:', error);
  process.exit(1);
}
