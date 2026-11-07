/**
 * The one icon set (UI-FND-06, ADR-F006): inline SVG, 24 x 24 grid, 2 px round strokes, no icon
 * fonts. Add an icon here (and nowhere else) before using it. Icons are decorative unless given a
 * label; see UiIcon.
 */
export type IconDef = { d: string[]; fill?: boolean };

const stroke = (...d: string[]): IconDef => ({ d });

export const icons = {
  check: stroke('M20 6 9 17l-5-5'),
  x: stroke('M18 6 6 18M6 6l12 12'),
  plus: stroke('M12 5v14M5 12h14'),
  minus: stroke('M5 12h14'),
  pencil: stroke('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'),
  eye: stroke(
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  ),
  clock: stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'),
  pause: stroke('M8 5v14M16 5v14'),
  'pause-shield': stroke('M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z', 'M10 9v6M14 9v6'),
  shield: stroke('M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z'),
  box: stroke('M21 8v13H3V8', 'M1 3h22v5H1Z', 'M10 12h4'),
  dot: { d: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'], fill: true },
  'alert-triangle': stroke(
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    'M12 9v4M12 17h.01',
  ),
  info: stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16v-4M12 8h.01'),
  'alert-circle': stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 8v4M12 16h.01'),
  'check-circle': stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8 12l3 3 5-6'),
  'x-circle': stroke('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M15 9l-6 6M9 9l6 6'),
  'chevron-down': stroke('m6 9 6 6 6-6'),
  'chevron-up': stroke('m18 15-6-6-6 6'),
  'chevron-left': stroke('m15 18-6-6 6-6'),
  'chevron-right': stroke('m9 18 6-6-6-6'),
  'arrow-up': stroke('M12 19V5M5 12l7-7 7 7'),
  'arrow-down': stroke('M12 5v14M19 12l-7 7-7-7'),
  upload: stroke('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5M12 3v12'),
  download: stroke('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5M12 15V3'),
  copy: stroke('M9 9h11v11H9Z', 'M5 15H4V4h11v1'),
  lock: stroke('M5 11h14v10H5Z', 'M8 11V7a4 4 0 0 1 8 0v4'),
  search: stroke('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3'),
  bell: stroke('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'),
  help: stroke(
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  ),
  menu: stroke('M4 6h16M4 12h16M4 18h16'),
  trash: stroke('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', 'M10 11v6M14 11v6'),
  globe: stroke(
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18',
  ),
  external: stroke('M18 13v6H5V6h6M15 3h6v6M10 14 21 3'),
  user: stroke('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'),
  share: stroke('M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14'),
  refresh: stroke(
    'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5',
    'M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  ),
  'wifi-off': stroke(
    'M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5a15 15 0 0 1 11.3 3.8M5 12.9a10 10 0 0 1 5.2-2.7M12 20h.01',
  ),
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof icons;
