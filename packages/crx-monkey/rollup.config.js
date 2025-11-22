// @ts-check
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import { dts } from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';

/** @typedef {import('rollup').RollupOptions} ConfigData */

/** @type {import('rollup').RollupOptions} */
const nodeConfig = {
  input: 'src/node/main.ts',
  output: [
    {
      file: 'dist/node/main.js',
      format: 'esm',
      sourcemap: 'inline',
    },
  ],
  plugins: [
    commonjs({
      include: ['node_modules/**'],
    }),
    json(),
    typescript({
      declaration: false,
      tsconfig: './tsconfig.json',
      exclude: ['**/__tests__/**'],
      sourceMap: true,
    }),
    copy({
      targets: [{ src: 'src/node/static/files/*', dest: 'dist/node/static' }],
    }),
  ],
};

const nodeTypes = {
  input: 'src/node/types.ts',
  output: [
    {
      file: 'dist/node/main.d.ts',
      format: 'esm',
    },
  ],
  plugins: [
    commonjs({
      include: ['node_modules/**'],
    }),
    typescript({
      declaration: false,
      tsconfig: './tsconfig.json',
      exclude: ['**/__tests__/**'],
    }),
    dts(),
  ],
};

/** @type {import('rollup').RollupOptions} */
const clientConfig = {
  input: 'src/client/main.ts',
  output: [
    {
      file: 'dist/client/main.js',
      format: 'esm',
      sourcemap: 'inline',
    },
  ],
  plugins: [
    commonjs({
      include: ['node_modules/**'],
    }),
    json(),
    typescript({
      declaration: false,
      tsconfig: './tsconfig.client.json',
      exclude: ['**/__tests__/**'],
      outDir: 'dist/client',
    }),
  ],
};

const clientTypes = {
  input: 'src/client/main.ts',
  output: [
    {
      file: 'dist/client/main.d.ts',
      format: 'esm',
    },
  ],
  plugins: [
    commonjs({
      include: ['node_modules/**'],
    }),
    typescript({
      declaration: false,
      tsconfig: './tsconfig.client.json',
      exclude: ['**/__tests__/**'],
      outDir: 'dist/client',
    }),
    dts(),
  ],
};

/** @type {import('rollup').RollupOptions} */
const apiConfig = {
  input: 'src/client/api.ts',
  output: [
    {
      file: 'dist/client/api.js',
      format: 'esm',
      sourcemap: 'inline',
    },
  ],
  plugins: [
    commonjs({
      include: ['node_modules/**'],
    }),
    json(),
    typescript({
      declaration: false,
      tsconfig: './tsconfig.client.json',
      exclude: ['**/__tests__/**'],
      outDir: 'dist/client',
    }),
  ],
};

const apiTypes = {
  input: 'src/client/api.ts',
  output: [
    {
      file: 'dist/client/api.d.ts',
      format: 'esm',
    },
  ],
  plugins: [
    commonjs({
      include: ['node_modules/**'],
    }),
    typescript({
      declaration: false,
      tsconfig: './tsconfig.client.json',
      exclude: ['**/__tests__/**'],
      outDir: 'dist/client',
    }),
    dts(),
  ],
};

export default [nodeConfig, nodeTypes, clientConfig, clientTypes, apiConfig, apiTypes];
