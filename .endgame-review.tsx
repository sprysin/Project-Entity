import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StyleGuide from './src/components/settings/StyleGuide';
import './src/styles/global.css';

function Review() {
  const [scale, setScale] = useState(Math.min(innerWidth / 2048, innerHeight / 1152));
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 2048, innerHeight / 1152));
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, []);
  return <div className="game-viewport"><div className="game-surface flex flex-col bg-slate-950 text-slate-100" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}><StyleGuide onBack={() => {}} /></div></div>;
}
createRoot(document.getElementById('root')!).render(<Review />);
