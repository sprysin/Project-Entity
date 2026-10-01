import React from 'react';

export default function ProfileAvatar({ image }: { image: string | null }) {
  return image
    ? <img src={image} alt="" />
    : <i className="fa-solid fa-user" aria-hidden="true" />;
}
