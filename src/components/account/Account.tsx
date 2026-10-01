import React, { useState } from 'react';
import { getSettings, saveProfile } from '../../desktop/storage';
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
    <div className="entity-topbar"><PageBrand section="ACCOUNT / PROFILE" /><BackToHubButton onClick={onBack} disabled={saving || processing} /></div>
    <form className="account-shell" onSubmit={save}>
      <header className="account-heading"><span>PLAYER PROFILE SETTINGS</span><h1>DUELEST <em>ACCOUNT</em></h1></header>
      <div className="account-content">
        <div className="account-preview">
          <span className="account-preview__icon"><ProfileAvatar image={profile.profileImage} /></span>
          <span className="account-preview__label">PLAYER</span>
          <strong>{profile.username.trim() || 'Player'}</strong>
        </div>
        <div className="account-fields">
          <label htmlFor="account-username">USERNAME</label>
          <p id="account-username-help">Up to 24 characters. This name appears in matches.</p>
          <input id="account-username" aria-describedby="account-username-help" type="text" maxLength={24} required value={profile.username} onChange={event => { setProfile(current => ({ ...current, username: event.target.value })); setFeedback(''); }} disabled={saving || processing} />
          <div className="account-upload">
            <label htmlFor="account-image">PROFILE IMAGE</label>
            <p>Upload your own image. It will be cropped to a square.</p>
            <input id="account-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} disabled={saving || processing} />
            {profile.profileImage && <button type="button" className="account-remove-image" onClick={() => { setProfile(current => ({ ...current, profileImage: null })); setFeedback(''); }} disabled={saving || processing}>REMOVE IMAGE</button>}
          </div>
        </div>
      </div>
      <footer className="account-actions"><span role="status" aria-live="polite">{feedback}</span><button type="submit" data-sound="select" disabled={saving || processing || !profile.username.trim()}>{saving ? 'SAVING…' : processing ? 'PROCESSING…' : 'SAVE PROFILE'}</button></footer>
    </form>
  </main>;
}
