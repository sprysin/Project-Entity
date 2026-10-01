import React from 'react';
import './PageChrome.css';

export default function BackToHubButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button
    data-sound="cancellation"
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="page-back-button"
  >
    <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to menu
  </button>;
}
