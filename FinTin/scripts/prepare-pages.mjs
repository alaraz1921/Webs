import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import console from 'node:console';
import { URL, fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('dist/index.html', root), 'utf8');
if (!html.includes('/FinTin/assets/') || html.includes('.tsx')) throw new Error('La compilación no corresponde a /FinTin/.');
const assets = await readdir(new URL('dist/assets/', root));
if (!assets.length || assets.some(name => !/^[a-zA-Z0-9_.-]+$/.test(name))) throw new Error('Assets inesperados');
// Solo se reemplaza el directorio generado propio; nunca las demás aplicaciones.
await rm(new URL('assets/', root), { recursive: true, force: true });
await mkdir(new URL('assets/', root), { recursive: true });
await cp(new URL('dist/assets/', root), new URL('assets/', root), { recursive: true });
await cp(new URL('dist/index.html', root), new URL('index.html', root));
console.log('Publicación estática preparada en ' + fileURLToPath(root));
