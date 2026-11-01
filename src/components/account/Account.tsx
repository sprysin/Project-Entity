import React, { useRef, useState } from 'react';
import { getAccount, getSettings, resetAccount, saveProfile } from '../../desktop/storage';
import { accountProgress } from '../../game/duelReport';
import AccountProgress from './AccountProgress';
import AccountStatistics from './AccountStatistics';
import BackToHubButton from '../common/BackToHubButton';
import PageBrand from '../common/PageBrand';
import ProfileAvatar from '../common/ProfileAvatar';
import './Account.css';

async function prepareProfileImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10_000_000) {
    throw new Error('Choose a PNG, JPEG, WebP, or GIF image under 10 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This image could not be processed.');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    const image = canvas.toDataURL('image/webp', .85);
    if (image.length > 1_500_000) throw new Error('This image is too large after processing.');
    return image;
  } finally {
    bitmap.close();
  }
}

export default function Account({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState(() => {
    const { username, profileImage } = getSettings();
    return { username, profileImage };
  });
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const resetDialog = useRef<HTMLDialogElement>(null);
  const [resetting, setResetting] = useState(false);
  const account = getAccount();

  const reset = async () => {
    setResetting(true);
    setSaving(true);
    setFeedback('');
    try {
      await resetAccount();
      setFeedback('Account reset. Level, XP, and duel statistics have been cleared.');
    } catch (error) {
      setFeedback(`Account could not be reset: ${String(error)}`);
    } finally {
      resetDialog.current?.close();
      setResetting(false);
      setSaving(false);
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setProcessing(true);
    setFeedback('');
    try {
      const profileImage = await prepareProfileImage(file);
      setProfile(current => ({ ...current, profileImage }));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'This image could not be loaded.');
    } finally {
      setProcessing(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      await saveProfile(profile);
      setProfile(({ username, profileImage }) => ({ username: username.trim(), profileImage }));
      setFeedback('Profile saved.');
    } catch (error) {
      setFeedback(`Profile could not be saved: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return <main className="account-page entity-page">
    <div className="entity-topbar"><PageBrand section="ACCOUNT" /><BackToHubButton onClick={onBack} disabled={saving || processing} /></div>
    <div className="account-shell">
      <header className="account-heading"><h1>DUELEST <em>ACCOUNT</em></h1></header>
      <div className="account-layout">
        <form className="account-profile" aria-label="Player profile" onSubmit={save}>
          <div className="account-preview">
            <span className="account-preview__icon"><ProfileAvatar image={profile.profileImage} /></span>
            <div className="account-preview__name"><h2>Level {accountProgress(account.totalXp).level.toLocaleString()}</h2><strong>{profile.username.trim() || 'Player'}</strong></div>
          </div>
          <div className="account-fields">
            <label htmlFor="account-username">USERNAME</label>
            <input id="account-username" type="text" maxLength={24} required value={profile.username} onChange={event => { setProfile(current => ({ ...current, username: event.target.value })); setFeedback(''); }} disabled={saving || processing} />
            <div className="account-upload">
              <label htmlFor="account-image">PROFILE IMAGE</label>
              <div className={`account-upload__controls${profile.profileImage ? ' account-upload__controls--has-image' : ''}`}><input id="account-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} disabled={saving || processing} />
              {profile.profileImage && <button type="button" className="account-remove-image" onClick={() => { setProfile(current => ({ ...current, profileImage: null })); setFeedback(''); }} disabled={saving || processing}>REMOVE IMAGE</button>}</div>
            </div>
          </div>
          <div className="account-progression"><AccountProgress totalXp={account.totalXp} /></div>
          <footer className="account-actions"><button type="submit" data-sound="select" disabled={saving || processing || !profile.username.trim()}>{saving ? 'SAVING…' : processing ? 'PROCESSING…' : 'SAVE PROFILE'}</button><button type="button" className="account-reset" disabled={saving || processing} onClick={() => resetDialog.current?.showModal()}>RESET ACCOUNT</button><span role="status" aria-live="polite">{feedback}</span></footer>
        </form>
        <AccountStatistics statistics={account.statistics} />
      </div>
    </div>
    <dialog ref={resetDialog} className="account-reset-dialog" aria-labelledby="account-reset-title" aria-describedby="account-reset-description" onCancel={event => { if (resetting) event.preventDefault(); }}>
      <h2 id="account-reset-title">Reset account?</h2>
      <p id="account-reset-description">This permanently removes all your XP and duel statistics, including your duel record and personal bests. You will return to Level 1. This cannot be undone.</p>
      <p>Your username, profile image, decks, and card collection will be kept.</p>
      <div className="account-reset-dialog__actions">
        <button type="button" autoFocus disabled={resetting} onClick={() => resetDialog.current?.close()}>Cancel</button>
        <button type="button" className="account-reset" disabled={resetting} onClick={reset}>{resetting ? 'Resetting…' : 'Reset account'}</button>
      </div>
    </dialog>
  </main>;
}
