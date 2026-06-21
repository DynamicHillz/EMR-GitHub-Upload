/**
 * Theme Utility
 *
 * Loads and applies clinic branding colors
 */

interface BrandingColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily?: string;
}

/**
 * Convert hex color to RGB string (without rgb() wrapper)
 * Example: #3b82f6 -> "59 130 246"
 */
const hexToRgb = (hex: string): string => {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `${r} ${g} ${b}`;
};

/**
 * Generate color shades from a base color
 * Creates lighter and darker variations (50, 100, 200... 900)
 */
const generateColorShades = (hexColor: string): Record<string, string> => {
  const rgb = hexToRgb(hexColor);
  const [r, g, b] = rgb.split(' ').map(Number);

  // Generate shades by adjusting brightness
  const shades: Record<string, string> = {};
  const factors = {
    50: 0.95,
    100: 0.85,
    200: 0.7,
    300: 0.5,
    400: 0.3,
    500: 0, // base color
    600: -0.2,
    700: -0.35,
    800: -0.5,
    900: -0.65
  };

  Object.entries(factors).forEach(([shade, factor]) => {
    let newR, newG, newB;

    if (factor >= 0) {
      // Lighter shades - move towards white
      newR = Math.round(r + (255 - r) * factor);
      newG = Math.round(g + (255 - g) * factor);
      newB = Math.round(b + (255 - b) * factor);
    } else {
      // Darker shades - move towards black
      newR = Math.round(r * (1 + factor));
      newG = Math.round(g * (1 + factor));
      newB = Math.round(b * (1 + factor));
    }

    shades[shade] = `${newR} ${newG} ${newB}`;
  });

  return shades;
};

/**
 * Apply theme colors and font family to CSS variables
 */
export const applyTheme = (colors: BrandingColors) => {
  // Generate shades for each color
  const primaryShades = generateColorShades(colors.primaryColor);
  const secondaryShades = generateColorShades(colors.secondaryColor);
  const accentShades = generateColorShades(colors.accentColor);

  // Set primary color shades
  Object.entries(primaryShades).forEach(([shade, rgb]) => {
    document.documentElement.style.setProperty(`--color-primary-${shade}`, rgb);
  });

  // Set secondary color shades
  Object.entries(secondaryShades).forEach(([shade, rgb]) => {
    document.documentElement.style.setProperty(`--color-secondary-${shade}`, rgb);
  });

  // Set accent color shades
  Object.entries(accentShades).forEach(([shade, rgb]) => {
    document.documentElement.style.setProperty(`--color-accent-${shade}`, rgb);
  });

  // Apply font family
  if (colors.fontFamily) {
    document.documentElement.style.fontFamily = colors.fontFamily;
    document.body.style.fontFamily = colors.fontFamily;
  }
};

/**
 * Load branding from API and apply theme
 */
export const loadAndApplyBranding = async (token: string) => {
  try {
    const response = await fetch('http://localhost:3000/api/branding', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const branding = data.data;

      applyTheme({
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        fontFamily: branding.fontFamily
      });

      return branding;
    }
  } catch (error) {
    console.error('Failed to load branding:', error);
  }

  return null;
};

/**
 * Get logo URL
 */
export const getLogoUrl = (branding: any): string | null => {
  return branding?.logoUrl || null;
};
