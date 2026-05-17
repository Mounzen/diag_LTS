import React from 'react';

const sources = {
  icon: '/logo-icon.svg',
  light: '/logo-horizontal-light.svg',
  dark: '/logo-horizontal-dark.svg',
  markLight: '/logo-mark-light.svg',
  markDark: '/logo-mark-dark.svg'
};

export default function BrandLogo({ variant = 'light', className = '' }) {
  const src = sources[variant] || sources.light;
  return <img className={`brandLogo ${className}`.trim()} src={src} alt="DIAG-LTS Saint-Denis" />;
}
