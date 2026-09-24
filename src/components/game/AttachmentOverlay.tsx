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
    const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const arrowBase = { x: end.x - direction.x * 12, y: end.y - direction.y * 12 };
    const arrow = `M ${arrowBase.x - direction.y * 5} ${arrowBase.y + direction.x * 5} L ${end.x} ${end.y} L ${arrowBase.x + direction.y * 5} ${arrowBase.y - direction.x * 5} Z`;
    const corners = (rect: Bounds) => {
        const x = rect.x - 4, y = rect.y - 4, w = rect.width + 8, h = rect.height + 8;
        const arm = Math.min(13, w / 4, h / 4);
        return `M ${x} ${y + arm} V ${y} H ${x + arm} M ${x + w - arm} ${y} H ${x + w} V ${y + arm} M ${x + w} ${y + h - arm} V ${y + h} H ${x + w - arm} M ${x + arm} ${y + h} H ${x} V ${y + h - arm}`;
    };
    return createPortal(
        <svg aria-hidden="true" className={`field-link field-link--${kind}`} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: attack ? 60 : 15 }} fill="none">
            {[source, ...(outlineTarget ? [target] : [])].map((rect, index) => <path key={index} className="field-link__corners" d={corners(rect)} />)}
            <path className="field-link__halo" d={path} />
            <path className="field-link__line" d={path} />
            <path className="field-link__flow" d={path} />
            <circle className="field-link__badge" cx={start.x} cy={start.y} r="7" />
            <circle className="field-link__symbol" cx={start.x} cy={start.y} r="2.5" />
            {attack
                ? <path className="field-link__arrow" d={arrow} />
                : <><circle className="field-link__badge" cx={end.x} cy={end.y} r="7" /><circle className="field-link__symbol" cx={end.x} cy={end.y} r="2.5" /></>}
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
