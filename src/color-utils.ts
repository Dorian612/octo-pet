/** Convert hex (#RRGGBB) to HSL [h: 0-360, s: 0-100, l: 0-100] */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** Convert HSL to hex */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Lighten a hex color by a percentage */
export function lighten(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s, Math.min(100, l + amount))
}

/** Hex to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Derive full color set from a single body hex */
export function deriveColors(bodyHex: string): { body: string; eye: string; glow: string } {
  // Use exact original values for the default color
  if (bodyHex === DEFAULT_COLOR) {
    return {
      body: '#D4804A',
      eye: '#E8A050',
      glow: 'rgba(212,128,74,0.25)',
    }
  }
  return {
    body: bodyHex,
    eye: lighten(bodyHex, 15),
    glow: hexToRgba(bodyHex, 0.25),
  }
}

const STORAGE_KEY = 'octo-pet-color'
const DEFAULT_COLOR = '#D4804A'

export function loadColor(): string {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_COLOR
}

export function saveColor(hex: string): void {
  localStorage.setItem(STORAGE_KEY, hex)
}
