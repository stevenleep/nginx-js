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

// Read package.json for version and name
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Check if production build
const isProduction = process.env.NODE_ENV === 'production';

// Preserve modules configuration for tree-shaking and plugin support
const preserveModulesConfig = {
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
      exports: 'named',
      generatedCode: {
        constBindings: true,
      },
    },
    {
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].esm.js',
      chunkFileNames: 'chunks/[name]-[hash].esm.js',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
      generatedCode: {
        constBindings: true,
      },
    },
  ],
  plugins: [
    resolve({
      preferBuiltins: false,
      browser: false,
      dedupe: [],
    }),
    commonjs({
      include: /node_modules/,
      transformMixedEsModules: true,
    }),
    typescript({
      tsconfig: pathResolve(__dirname, 'tsconfig.json'),
      declaration: false, // Handled by dts plugin
      declarationMap: false, // Disable declarationMap when declaration is false
      sourceMap: true,
      inlineSources: !isProduction,
      compilerOptions: {
        removeComments: isProduction,
      },
    }),
    ...(isProduction
      ? [
          terser({
            compress: {
              drop_console: false,
              drop_debugger: true,
              pure_funcs: ['console.debug'],
            },
            format: {
              comments: /^!|@preserve|@license|@cc_on/i,
            },
          }),
        ]
      : []),
  ],
  external: (id) => {
    // Don't bundle node_modules or built-in modules
    // Entry point should never be external
    if (id.includes('src/index.ts') || id.endsWith('index.ts')) {
      return false;
    }
    // Externalize node_modules and built-in modules
    return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
  },
  onwarn(warning, warn) {
    // Ignore certain warnings
    if (warning.code === 'UNRESOLVED_IMPORT') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};

// UMD bundle for browser (single file) - Development version
const umdConfig = {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.umd.js',
    format: 'umd',
    name: 'NginxJS',
    sourcemap: true,
    banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
    footer: `/*! ${pkg.name} v${pkg.version} | ${pkg.homepage} */`,
    generatedCode: {
      constBindings: true,
    },
  },
  plugins: [
    resolve({
      preferBuiltins: false,
      browser: true,
      dedupe: [],
    }),
    commonjs({
      include: /node_modules/,
      transformMixedEsModules: true,
    }),
    typescript({
      tsconfig: pathResolve(__dirname, 'tsconfig.json'),
      declaration: false,
      sourceMap: true,
      inlineSources: !isProduction,
      compilerOptions: {
        removeComments: isProduction,
      },
    }),
  ],
  external: [], // Bundle everything for UMD
  onwarn(warning, warn) {
    // Ignore certain warnings for UMD
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};

// UMD bundle for browser (minified) - Production version
const umdMinConfig = isProduction
  ? {
      input: 'src/index.ts',
      output: {
        file: 'dist/index.umd.min.js',
        format: 'umd',
        name: 'NginxJS',
        sourcemap: true,
        banner: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License */`,
        footer: `/*! ${pkg.name} v${pkg.version} | ${pkg.homepage} */`,
        generatedCode: {
          constBindings: true,
        },
      },
      plugins: [
        resolve({
          preferBuiltins: false,
          browser: true,
          dedupe: [],
        }),
        commonjs({
          include: /node_modules/,
          transformMixedEsModules: true,
        }),
        typescript({
          tsconfig: pathResolve(__dirname, 'tsconfig.json'),
          declaration: false,
          sourceMap: true,
          inlineSources: false,
          compilerOptions: {
            removeComments: true,
          },
        }),
        terser({
          compress: {
            drop_console: false,
            drop_debugger: true,
            pure_funcs: ['console.debug'],
          },
          format: {
            comments: /^!|@preserve|@license|@cc_on/i,
          },
        }),
      ],
      external: [], // Bundle everything for UMD
      onwarn(warning, warn) {
        // Ignore certain warnings for UMD
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      },
    }
  : null;

// Type definitions
const dtsConfig = {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  plugins: [
    dts({
      tsconfig: pathResolve(__dirname, 'tsconfig.json'),
      compilerOptions: {
        declarationMap: false, // Disable declarationMap for dts plugin
      },
      respectExternal: true,
    }),
  ],
  external: (id) => {
    // Externalize everything except source files
    if (id.endsWith('.map')) return true; // Ignore sourcemap files
    return !id.startsWith('.') && !id.startsWith('/');
  },
};

// Export configurations
const configs = [
  preserveModulesConfig,
  umdConfig,
  ...(umdMinConfig ? [umdMinConfig] : []),
  dtsConfig,
].filter(Boolean);

export default configs;

