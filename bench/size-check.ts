#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

interface SizeBudgets {
    mainJsKb: number;
    mainCssKb: number;
    distKb: number;
}

function bytesToKb(bytes: number): number {
    return bytes / 1024;
}

const NON_RUNTIME_FILES = new Set(['og-image.png', 'apple-touch-icon.png']);

function walkSize(path: string, root: string): number {
    const st = statSync(path);
    if (st.isFile()) {
        const rel = path.slice(root.length + 1);
        if (NON_RUNTIME_FILES.has(rel)) return 0;
        return st.size;
    }

    const entries = readdirSync(path);
    let total = 0;
    for (const entry of entries) total += walkSize(join(path, entry), root);
    return total;
}

function readBudgets(): SizeBudgets {
    const budgetPath = resolve(import.meta.dirname ?? '.', 'perf-budget.json');
    const parsed = JSON.parse(readFileSync(budgetPath, 'utf8')) as { size: SizeBudgets };
    return parsed.size;
}

function extractEntryAssets(indexHtml: string): { js: string; css: string } {
    const jsMatch = indexHtml.match(/<script[^>]*src="([^\"]*\/assets\/index-[^\"]+\.js)"/);
    const cssMatch = indexHtml.match(/<link[^>]*href="([^\"]*\/assets\/index-[^\"]+\.css)"/);

    if (!jsMatch || !cssMatch) {
        throw new Error('Could not locate entry JS/CSS in dist/index.html');
    }

    const js = jsMatch[1].replace(/^\//, '');
    const css = cssMatch[1].replace(/^\//, '');
    return { js, css };
}

function main() {
    const distDir = resolve(process.cwd(), 'dist');
    const indexPath = resolve(distDir, 'index.html');

    const indexHtml = readFileSync(indexPath, 'utf8');
    const { js, css } = extractEntryAssets(indexHtml);

    const jsBytes = statSync(resolve(distDir, js)).size;
    const cssBytes = statSync(resolve(distDir, css)).size;
    const totalBytes = walkSize(distDir, distDir);

    const jsKb = Number(bytesToKb(jsBytes).toFixed(2));
    const cssKb = Number(bytesToKb(cssBytes).toFixed(2));
    const distKb = Number(bytesToKb(totalBytes).toFixed(2));

    const budgets = readBudgets();

    console.log('\n  Theoremis Size Check');
    console.log('  ═══════════════════');
    console.log(`  main JS:   ${jsKb} KB (budget ${budgets.mainJsKb} KB)`);
    console.log(`  main CSS:  ${cssKb} KB (budget ${budgets.mainCssKb} KB)`);
    console.log(`  dist runtime:${distKb} KB (budget ${budgets.distKb} KB, excludes og-image/apple-touch-icon)`);

    const failures: string[] = [];
    if (jsKb > budgets.mainJsKb) failures.push(`main JS ${jsKb} > ${budgets.mainJsKb} KB`);
    if (cssKb > budgets.mainCssKb) failures.push(`main CSS ${cssKb} > ${budgets.mainCssKb} KB`);
    if (distKb > budgets.distKb) failures.push(`dist runtime ${distKb} > ${budgets.distKb} KB`);

    if (failures.length > 0) {
        console.error('\n  SIZE BUDGET FAILURES:');
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
    }

    console.log('\n  Size budgets: PASS');
}

try {
    main();
} catch (err) {
    console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
