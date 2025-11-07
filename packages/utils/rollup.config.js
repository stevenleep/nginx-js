import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve as pathResolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(pathResolve(__dirname, 'package.json'), 'utf-8'));
const isProduction = process.env.NODE_ENV === 'production';

const baseConfig = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
    },
    {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
      banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
    },
  ],
  plugins: [
    resolve({
      preferBuiltins: false,
      browser: false,
    }),
    commonjs(),
    typescript({
      tsconfig: pathResolve(__dirname, 'tsconfig.json'),
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    }),
  ],
  external: (id) => {
    // Don't externalize the entry module or relative imports
    if (id === 'src/index.ts' || id.startsWith('./') || id.startsWith('../')) {
      return false;
    }
    // Externalize workspace packages and node_modules
    if (id.startsWith('@nginx-js/')) return true;
    return !id.startsWith('.') && !id.startsWith('/');
  },
};

const dtsConfig = {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.d.ts',
    format: 'es',
  },
  plugins: [
    dts({
      tsconfig: pathResolve(__dirname, 'tsconfig.json'),
    }),
  ],
  external: (id) => {
    if (id.startsWith('@nginx-js/')) return true;
    return !id.startsWith('.') && !id.startsWith('/');
  },
};

export default [baseConfig, dtsConfig];

