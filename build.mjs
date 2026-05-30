// Build script para la extensión MV3 con esbuild.
// Genera bundles en dist/ y copia los archivos estáticos (manifest, html, assets).
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

const entries = {
  content: 'src/content/index.ts',
  background: 'src/background/serviceWorker.ts',
  popup: 'src/ui/popup.ts',
  options: 'src/ui/options.ts',
  demo: 'src/ui/demo.ts',
};

async function copyStatic() {
  await cp('manifest.json', `${outdir}/manifest.json`);
  await cp('src/ui/popup.html', `${outdir}/popup.html`);
  await cp('src/ui/options.html', `${outdir}/options.html`);
  await cp('src/ui/demo.html', `${outdir}/demo.html`);
  if (existsSync('src/assets')) {
    await cp('src/assets', `${outdir}/assets`, { recursive: true });
  }
}

async function run() {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const common = {
    bundle: true,
    format: 'iife',
    target: 'chrome114',
    sourcemap: true,
    logLevel: 'info',
    outdir,
    entryNames: '[name]',
  };

  const ctx = await esbuild.context({
    ...common,
    entryPoints: entries,
  });

  await ctx.rebuild();
  await copyStatic();

  if (watch) {
    await ctx.watch();
    console.log('[build] watching for changes…');
  } else {
    await ctx.dispose();
    console.log('[build] done → dist/');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
