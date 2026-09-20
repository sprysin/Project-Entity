import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Bounds = { x: number; y: number; width: number; height: number };
export type FieldLink = { source: Bounds; target: Bounds };

export function LinkGraphic({ link, kind, outlineTarget = true }: { link: FieldLink; kind: 'attachment' | 'attack'; outlineTarget?: boolean }) {
    const { source, target } = link;
    const center = (r: Bounds) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const a = center(source), b = center(target);
    const edge = (rect: Bounds, from: typeof a, toward: typeof a) => {
        const dx = toward.x - from.x, dy = toward.y - from.y;
        const scale = 1 / Math.max(Math.abs(dx) / (rect.width / 2 + 3), Math.abs(dy) / (rect.height / 2 + 3), 1);
        return { x: from.x + dx * scale, y: from.y + dy * scale };
    };
    const start = edge(source, a, b), end = edge(target, b, a);
    const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const attack = kind === 'attack';
    return createPortal(
        <svg aria-hidden="true" className={`${kind}-overlay`} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }} fill="none" stroke={attack ? '#ef4444' : '#facc15'} strokeWidth={attack ? 2.5 : 1.5}>
            {[source, ...(outlineTarget ? [target] : [])].map((rect, index) => <rect key={index} x={rect.x - 3} y={rect.y - 3} width={rect.width + 6} height={rect.height + 6} rx="5" />)}
            <path d={path} />
            {[0, 1, 2, 3].map(index => attack
                ? <path className="attack-arrow" key={index} d="M -7 -6 L 0 0 L -7 6">
                    <animateMotion path={path} dur="1.5s" begin={`-${(index + 1) * 0.375}s`} rotate="auto" repeatCount="indefinite" />
                </path>
                : <circle className="attachment-bead" key={index} r="3" cx="0" cy="0">
                    <animateMotion path={path} dur="1.6s" begin={`-${(index + 1) * 0.4}s`} repeatCount="indefinite" />
                </circle>
            )}
        </svg>, document.body
    );
}

/** Follow actual card faces, including defense rotation, scrolling and layout changes. */
export function AttachmentOverlay() {
    const [link, setLink] = useState<FieldLink | null>(null);
    useEffect(() => {
        let source: HTMLElement | null = null;
        let frame = 0;
        const clear = () => { source = null; cancelAnimationFrame(frame); setLink(null); };
        const update = () => {
            const targetId = source?.dataset.attachedTo;
            const target = targetId && Array.from(document.querySelectorAll<HTMLElement>('[data-field-card-id]'))
                .find(element => element.dataset.fieldCardId === targetId);
            if (!source?.isConnected || !target) { clear(); return; }
            const bounds = (element: HTMLElement): Bounds => {
                const rect = element.getBoundingClientRect();
                return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
            };
            const next = { source: bounds(source), target: bounds(target) };
            setLink(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
            frame = requestAnimationFrame(update);
        };
        const hover = (event: PointerEvent) => {
            const next = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-attached-to]') : null;
            if (next === source) return;
            clear();
            if (next) { source = next; update(); }
        };
        document.addEventListener('pointerover', hover);
        document.addEventListener('pointerleave', clear);
        window.addEventListener('blur', clear);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('pointerover', hover);
            document.removeEventListener('pointerleave', clear);
            window.removeEventListener('blur', clear);
        };
    }, []);
    if (!link) return null;
    return <LinkGraphic link={link} kind="attachment" />;
}
