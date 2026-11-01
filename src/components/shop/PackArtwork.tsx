import React, { useEffect, useRef, useState } from 'react';
import type { Pack } from '../../shop/packs';
import { PACK_SIZE } from '../../shop/PackLogic';
import { playSound } from '../../audio';

export default function PackArtwork({ pack, size = PACK_SIZE, onOpen }: { pack: Pack; size?: number; onOpen?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pose = useRef({ x: 0, y: 0, progress: 0, side: 1, lift: 0, exit: 0 });
  const drag = useRef<{ id: number; x: number; width: number; progress: number } | null>(null);
  const opened = useRef(onOpen);
  opened.current = onOpen;
  const complete = useRef(false);
  const [rendered, setRendered] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const reduced = useRef(false);

  const finish = () => {
    if (complete.current || !onOpen) return;
    complete.current = true;
    pose.current.progress = 1;
    drag.current = null;
    setFinishing(true);
    playSound('hide-card');
  };
  useEffect(() => {
    if (!finishing) return;
    const timer = window.setTimeout(() => opened.current?.(), reduced.current ? 0 : 850);
    return () => window.clearTimeout(timer);
  }, [finishing]);
  // Scope Space to the sealed pack; it must never also flip a revealed card.
  useEffect(() => {
    if (!onOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if ((event.target as HTMLElement)?.closest('button, input, textarea, select, [role="dialog"]')) return;
      event.preventDefault();
      finish();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { reduced.current = media.matches; };
    motion();
    media.addEventListener('change', motion);
    void Promise.all([import('./packRenderer'), document.fonts.ready]).then(([{ renderPack }]) => {
      if (disposed || !canvas.current || !host.current) return;
      try {
        cleanup = renderPack(canvas.current, host.current, pack, size, pose.current, () => reduced.current);
        setRendered(true);
      } catch {
        // Keep the original artwork and keyboard/button opening when WebGL is unavailable.
        setRendered(false);
      }
    }).catch(() => { /* The CSS wrapper remains usable if the renderer cannot load. */ });
    return () => { disposed = true; cleanup?.(); media.removeEventListener('change', motion); };
  }, [pack, size]);

  return <div ref={host} className={`pack-art pack-art--${pack.id}${rendered ? ' pack-art--3d' : ''}${onOpen ? ' pack-art--interactive' : ''}${finishing ? ' pack-art--opened' : ''}`}
    onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      pose.current.x = (event.clientX - rect.left) / rect.width * 2 - 1;
      pose.current.y = (event.clientY - rect.top) / rect.height * 2 - 1;
      if (onOpen && !drag.current && !complete.current && pose.current.progress === 0) {
        pose.current.lift = pose.current.y < -.3 && Math.abs(pose.current.x) > .2 ? .4 : 0;
        pose.current.side = pose.current.x < 0 ? -1 : 1;
      }
      if (drag.current && event.pointerId === drag.current.id) {
        pose.current.progress = Math.max(pose.current.progress, Math.min(1, drag.current.progress + Math.abs(event.clientX - drag.current.x) / (drag.current.width * .65)));
        if (pose.current.progress >= 1) finish();
      }
    }}
    onPointerLeave={() => { if (!drag.current) { pose.current.x = 0; pose.current.y = 0; pose.current.lift = 0; } }}
    onPointerDown={event => {
      if (!onOpen || complete.current || event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      // The upper portion is deliberately generous for touch and a tilted seam.
      if (y > .4 || x < .15 || x > .85) return;
      event.preventDefault();
      if (pose.current.progress === 0) pose.current.side = x < .5 ? -1 : 1;
      drag.current = { id: event.pointerId, x: event.clientX, width: rect.width, progress: pose.current.progress };
      pose.current.lift = 1;
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={event => {
      if (drag.current?.id !== event.pointerId) return;
      drag.current = null;
      pose.current.lift = 0;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { drag.current = null; pose.current.lift = 0; }}
    onLostPointerCapture={() => { drag.current = null; pose.current.lift = 0; }}>
    <div className="pack-art__halo" aria-hidden="true" />
    <div className="pack-art__wrapper" aria-hidden="true">
      <span className="pack-art__brand">PROJECT ENTITY</span>
      <div className="pack-art__sigil"><i className={`fa-solid ${pack.icon}`} /></div>
      <strong>{pack.name}</strong><span className="pack-art__edition">{size} CARDS / BASE EDITION</span>
    </div>
    <canvas ref={canvas} className="pack-art__canvas" aria-hidden="true" />
    <span className="pack-art__floor" aria-hidden="true" />
    {onOpen && <button type="button" className="pack-art__skip" onClick={finish} disabled={finishing} aria-label="Open pack without dragging">Space to open</button>}
  </div>;
}
