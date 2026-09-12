import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('public', { recursive: true });

await build({
  entryPoints: ['src/cloudflare/operator.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile: 'public/operator.bundle.js',
  sourcemap: false,
  minify: true,
  legalComments: 'none',
});

await copyFile(
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'public/pdf.worker.min.mjs'
);

console.log('Built Cloudflare browser processor and PDF worker.');
