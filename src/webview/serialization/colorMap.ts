// BlockNote color name → CSS color value
export const textColorToCSS: Record<string, string> = {
  default: '',
  gray: '#9b9a97',
  brown: '#64473a',
  red: '#dc3545',
  orange: '#d9730d',
  yellow: '#dfab01',
  green: '#0f7b6c',
  blue: '#0b6e99',
  purple: '#6940a5',
  pink: '#ad1a72',
};

// Background colors (lighter variants)
export const bgColorToCSS: Record<string, string> = {
  default: '',
  gray: '#ebeced',
  brown: '#e9e5e3',
  red: '#fbe4e4',
  orange: '#fbead5',
  yellow: '#fff3cd',
  green: '#d4edda',
  blue: '#e8f4fd',
  purple: '#ede3fa',
  pink: '#f4dfeb',
};

// Reverse mappings: CSS color → BlockNote name
export const cssToTextColor: Record<string, string> = Object.fromEntries(
  Object.entries(textColorToCSS)
    .filter(([k]) => k !== 'default')
    .map(([k, v]) => [v.toLowerCase(), k])
);

export const cssToBgColor: Record<string, string> = Object.fromEntries(
  Object.entries(bgColorToCSS)
    .filter(([k]) => k !== 'default')
    .map(([k, v]) => [v.toLowerCase(), k])
);

// Get CSS for text color
export function getTextColorCSS(colorName: string): string {
  return textColorToCSS[colorName] || colorName;
}

// Get CSS for background color
export function getBgColorCSS(colorName: string): string {
  return bgColorToCSS[colorName] || colorName;
}

// Parse CSS color back to BlockNote name
export function parseTextColor(css: string): string {
  const normalized = css.toLowerCase().trim();
  return cssToTextColor[normalized] || css;
}

// Parse CSS background color back to BlockNote name
export function parseBgColor(css: string): string {
  const normalized = css.toLowerCase().trim();
  return cssToBgColor[normalized] || css;
}
