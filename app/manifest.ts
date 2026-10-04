import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life OS',
    short_name: 'Life OS',
    description: 'A family system for progressive independence.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#F7F6F1',
    theme_color: '#F7F6F1',
    lang: 'en',
  };
}
