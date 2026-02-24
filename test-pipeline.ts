import { parseLatex, documentToIR } from './src/parser/latex.js';
import { typeCheck } from './src/core/typechecker.js';
import { emitLean4 } from './src/emitters/lean4.js';

const latex = `\\begin{theorem}[Identity]
\\forall n \\in \\mathbb{N}, n + 0 = n
\\end{theorem}`;

console.log("Parsing LaTeX...");
const doc = parseLatex(latex);

console.log("Converting to IR...");
const ir = documentToIR(doc, { name: 'Custom', axioms: new Set(), description: '' });
console.log(JSON.stringify(ir.declarations[0], null, 2));

console.log("Typechecking...");
const tc = typeCheck(ir);
console.log("Diagnostics:", tc.diagnostics);

console.log("Emitting Lean 4...");
const lean = emitLean4(ir);
console.log(lean.code);
