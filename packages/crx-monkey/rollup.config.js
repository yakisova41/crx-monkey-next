// @ts-check
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import { dts } from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';

/** @typedef {import('rollup').RollupOptions} ConfigData */
const plugins = (tsconfig, ts) => {
  return [
    commonjs({
      include: ['node_modules/**'],
    }),
    json(),
    ...(ts
      ? [
          typescript({
            declaration: false,
            tsconfig: tsconfig,
            exclude: ['**/__tests__/**'],
            sourceMap: true,
          }),
        ]
      : []),
  ];
};

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
    plugins('./tsconfig.json', true),
    copy({
      targets: [{ src: 'src/node/static/files/*', dest: 'dist/node/static' }],
    }),
  ],
};

/** @type {import('rollup').RollupOptions} */
const nodeExportsConfig = {
  input: 'src/node/exports.ts',
  output: [
    {
      file: 'dist/node/exports.js',
      format: 'esm',
      sourcemap: 'inline',
    },
  ],
  plugins: [
    plugins('./tsconfig.json', true),
    copy({
      targets: [{ src: 'src/node/static/files/*', dest: 'dist/node/static' }],
    }),
  ],
};

/** @type {import('rollup').RollupOptions} */
const nodeExportsTypes = {
  input: 'src/node/exports.ts',
  output: [
    {
      file: 'dist/node/exports.d.ts',
      format: 'esm',
    },
  ],
  plugins: [plugins('./tsconfig.json', false), dts()],
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
  plugins: [plugins('./tsconfig.client.json', true)],
};

/** @type {import('rollup').RollupOptions} */
const clientTypes = {
  input: 'src/client/main.ts',
  output: [
    {
      file: 'dist/client/main.d.ts',
      format: 'esm',
    },
  ],
  plugins: [plugins('./tsconfig.client.json', false), dts()],
};

export default [nodeConfig, nodeExportsConfig, nodeExportsTypes, clientConfig, clientTypes];
