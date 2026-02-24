// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Dependency Graph Visualization (Canvas)
// ─────────────────────────────────────────────────────────────

import type { DependencyGraph, GraphNode } from '../parser/discourse';
import type { DependencyEdge } from '../parser/ast';

interface NodePosition {
    x: number;
    y: number;
    width: number;
    height: number;
    node: GraphNode;
}

export class GraphRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private positions: NodePosition[] = [];
    private resizeHandler: () => void;

    constructor(container: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'graph-canvas';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d')!;
        this.resizeHandler = () => this.resize();
        this.resize();
        window.addEventListener('resize', this.resizeHandler);
    }

    private resize() {
        const rect = this.canvas.parentElement!.getBoundingClientRect();
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    render(graph: DependencyGraph) {
        this.layout(graph);
        this.draw(graph.edges);
    }

    private layout(graph: DependencyGraph) {
        this.positions = [];
        const nodes = Array.from(graph.nodes.values());
        const w = this.canvas.width / devicePixelRatio;
        const h = this.canvas.height / devicePixelRatio;
        const spacing = Math.min(160, (w - 80) / Math.max(nodes.length, 1));
        const startX = (w - spacing * (nodes.length - 1)) / 2;

        nodes.forEach((node, i) => {
            const labelW = this.ctx.measureText(node.label).width + 40;
            this.positions.push({
                x: startX + i * spacing,
                y: h / 2,
                width: Math.max(labelW, 80),
                height: 32,
                node,
            });
        });
    }

    private draw(edges: DependencyEdge[]) {
        const w = this.canvas.width / devicePixelRatio;
        const h = this.canvas.height / devicePixelRatio;
        this.ctx.clearRect(0, 0, w, h);

        // Draw edges
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
        this.ctx.lineWidth = 1.5;
        for (const edge of edges) {
            const from = this.positions.find(p => p.node.id === edge.from);
            const to = this.positions.find(p => p.node.id === edge.to);
            if (from && to) {
                this.ctx.beginPath();
                const cx = (from.x + to.x) / 2;
                const cy = Math.min(from.y, to.y) - 30;
                this.ctx.moveTo(from.x, from.y);
                this.ctx.quadraticCurveTo(cx, cy, to.x, to.y);
                this.ctx.stroke();

                // Arrow
                const angle = Math.atan2(to.y - cy, to.x - cx);
                this.ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
                this.ctx.beginPath();
                this.ctx.moveTo(to.x, to.y);
                this.ctx.lineTo(to.x - 8 * Math.cos(angle - 0.3), to.y - 8 * Math.sin(angle - 0.3));
                this.ctx.lineTo(to.x - 8 * Math.cos(angle + 0.3), to.y - 8 * Math.sin(angle + 0.3));
                this.ctx.fill();
            }
        }

        // Draw nodes
        for (const pos of this.positions) {
            const { x, y, width: nw, height: nh, node } = pos;
            const colors: Record<string, string> = {
                verified: '#00e676',
                partial: '#ffab40',
                unverified: '#ff5252',
            };
            const borderColor = colors[node.status] || '#546e7a';

            // Node bg
            this.ctx.fillStyle = 'rgba(15, 21, 32, 0.9)';
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = 1.5;
            const rx = x - nw / 2, ry = y - nh / 2;
            this.roundRect(rx, ry, nw, nh, 6);
            this.ctx.fill();
            this.ctx.stroke();

            // Glow
            this.ctx.shadowColor = borderColor;
            this.ctx.shadowBlur = 8;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // Status icon — canvas-drawn shapes for consistent cross-platform rendering
            this.drawStatusIcon(node.status, rx + 12, y, borderColor);

            // Label
            this.ctx.fillStyle = '#e8eaf6';
            this.ctx.font = '11px JetBrains Mono, monospace';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.label, rx + 24, y);
        }
    }

    /** Draw a small professional status icon at (cx, cy) on the canvas. */
    private drawStatusIcon(status: string, cx: number, cy: number, color: string) {
        const s = 4.5; // half-size
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = 1.6;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (status === 'verified') {
            // Checkmark
            this.ctx.beginPath();
            this.ctx.moveTo(cx - s, cy);
            this.ctx.lineTo(cx - s * 0.3, cy + s * 0.7);
            this.ctx.lineTo(cx + s, cy - s * 0.6);
            this.ctx.stroke();
        } else if (status === 'partial') {
            // Warning triangle outline
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy - s);
            this.ctx.lineTo(cx + s, cy + s * 0.7);
            this.ctx.lineTo(cx - s, cy + s * 0.7);
            this.ctx.closePath();
            this.ctx.stroke();
            // Exclamation dot
            this.ctx.beginPath();
            this.ctx.arc(cx, cy + s * 0.3, 0.8, 0, Math.PI * 2);
            this.ctx.fill();
            // Exclamation line
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy - s * 0.3);
            this.ctx.lineTo(cx, cy + 0);
            this.ctx.stroke();
        } else if (status === 'unverified') {
            // X mark
            this.ctx.beginPath();
            this.ctx.moveTo(cx - s * 0.7, cy - s * 0.7);
            this.ctx.lineTo(cx + s * 0.7, cy + s * 0.7);
            this.ctx.moveTo(cx + s * 0.7, cy - s * 0.7);
            this.ctx.lineTo(cx - s * 0.7, cy + s * 0.7);
            this.ctx.stroke();
        } else {
            // Unknown — small circle
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    private roundRect(x: number, y: number, w: number, h: number, r: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.arcTo(x + w, y, x + w, y + r, r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.arcTo(x, y + h, x, y + h - r, r);
        this.ctx.lineTo(x, y + r);
        this.ctx.arcTo(x, y, x + r, y, r);
        this.ctx.closePath();
    }

    destroy() {
        window.removeEventListener('resize', this.resizeHandler);
        this.canvas.remove();
    }
}
