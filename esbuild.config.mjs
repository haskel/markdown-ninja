import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';

const isWatch = process.argv.includes('--watch');

// Common options
const commonOptions = {
  bundle: true,
  sourcemap: true,
  minify: !isWatch,
  logLevel: 'info',
};

// Extension build (Node.js)
const extensionConfig = {
  ...commonOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  target: 'node18',
};

// WebView build (Browser)
const webviewConfig = {
  ...commonOptions,
  entryPoints: ['src/webview/index.tsx'],
  outfile: 'dist/webview/bundle.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  loader: {
    '.ttf': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
  },
  conditions: ['style'],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

// CSS build for webview
const cssConfig = {
  ...commonOptions,
  entryPoints: ['src/webview/styles.css'],
  outfile: 'dist/webview/styles.css',
  loader: {
    '.css': 'css',
  },
};

async function build() {
  try {
    // Ensure dist directories exist
    if (!existsSync('dist/webview')) {
      mkdirSync('dist/webview', { recursive: true });
    }

    if (isWatch) {
      // Watch mode
      const extContext = await esbuild.context(extensionConfig);
      const webviewContext = await esbuild.context(webviewConfig);
      const cssContext = await esbuild.context(cssConfig);

      await Promise.all([
        extContext.watch(),
        webviewContext.watch(),
        cssContext.watch(),
      ]);

      console.log('Watching for changes...');
    } else {
      // Single build
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig),
        esbuild.build(cssConfig),
      ]);

      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
