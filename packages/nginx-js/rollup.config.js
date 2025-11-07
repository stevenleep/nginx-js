import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
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
      exports: 'named',
    },
    {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
      banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
      exports: 'named',
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
    ...(isProduction
      ? [
          terser({
            compress: {
              drop_console: false,
              drop_debugger: true,
            },
            format: {
              comments: /^!|@preserve|@license/i,
            },
          }),
        ]
      : []),
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

// UMD build for browser (bundles all dependencies)
const umdBasePlugins = [
  resolve({
    preferBuiltins: false,
    browser: true,
  }),
  commonjs(),
  typescript({
    tsconfig: pathResolve(__dirname, 'tsconfig.json'),
    declaration: false,
    declarationMap: false,
    sourceMap: true,
  }),
];

const umdConfig = {
  input: 'src/index.ts',
  output: {
    file: pathResolve(__dirname, '../../dist/index.umd.js'),
    format: 'umd',
    name: 'NginxJS',
    sourcemap: true,
    banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
  },
  plugins: umdBasePlugins,
  external: (id) => {
    // For UMD build, bundle everything except node built-ins
    // Don't externalize workspace packages - bundle them
    if (id.startsWith('node:')) return true;
    return false;
  },
};

// Minified UMD build (only in production)
const umdMinConfig = isProduction
  ? {
      input: 'src/index.ts',
      output: {
        file: pathResolve(__dirname, '../../dist/index.umd.min.js'),
        format: 'umd',
        name: 'NginxJS',
        sourcemap: true,
        banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
      },
      plugins: [
        ...umdBasePlugins,
        terser({
          compress: {
            drop_console: false,
            drop_debugger: true,
          },
          format: {
            comments: /^!|@preserve|@license/i,
          },
        }),
      ],
      external: (id) => {
        if (id.startsWith('node:')) return true;
        return false;
      },
    }
  : null;

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

export default [baseConfig, dtsConfig, umdConfig, umdMinConfig].filter(Boolean);

