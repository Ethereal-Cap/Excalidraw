/**
 * MindNode Theme & Styling System for Excalidraw
 * Provides the pastel palette, node types, and branch curve colors
 * inspired by MindNode with full multi-theme customization and unlimited presets.
 */

export interface MindNodeTheme {
  id: string;
  name: string;
  bg: string;
  stroke: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  isCustom?: boolean;
}

export const DEFAULT_MINDNODE_THEMES: MindNodeTheme[] = [
  {
    id: "mint",
    name: "Mint Fresh",
    bg: "#bbf7d0", // soft pastel mint green
    stroke: "#bbf7d0", // matching pastel mint green border
    text: "#14532d", // deep forest green text
    badgeBg: "#86efac",
    badgeText: "#14532d",
  },
  {
    id: "cyan",
    name: "Ocean Cyan",
    bg: "#a5f3fc", // pastel cyan/teal
    stroke: "#a5f3fc", // matching pastel cyan border
    text: "#0c4a6e", // deep navy text
    badgeBg: "#7dd3fc",
    badgeText: "#0c4a6e",
  },
  {
    id: "rose",
    name: "Soft Rose",
    bg: "#fbcfe8", // soft pink
    stroke: "#fbcfe8", // matching soft rose border
    text: "#831843", // deep wine text
    badgeBg: "#f9a8d4",
    badgeText: "#831843",
  },
  {
    id: "lavender",
    name: "Lavender Mist",
    bg: "#ddd6fe", // soft lavender violet
    stroke: "#ddd6fe", // matching soft lavender border
    text: "#4c1d95", // deep violet text
    badgeBg: "#c4b5fd",
    badgeText: "#4c1d95",
  },
  {
    id: "amber",
    name: "Golden Sunrise",
    bg: "#fde68a", // soft warm amber
    stroke: "#fde68a", // matching warm gold border
    text: "#78350f", // deep amber text
    badgeBg: "#fcd34d",
    badgeText: "#78350f",
  },
  {
    id: "coral",
    name: "Coral Peach",
    bg: "#fed7aa", // soft peach
    stroke: "#fed7aa", // matching coral peach border
    text: "#7c2d12", // deep rust text
    badgeBg: "#fdba74",
    badgeText: "#7c2d12",
  },
];

export const MINDNODE_CONSTANTS = {
  NODE_PADDING_X: 24,
  NODE_PADDING_Y: 12,
  MIN_NODE_WIDTH: 150,
  MIN_NODE_HEIGHT: 44,
  HORIZONTAL_SPACING: 140, // distance between parent and child branch
  VERTICAL_SPACING: 20, // gap between sibling nodes
  BADGE_SIZE: 28,
  BADGE_OFFSET_X: -36, // position to the left of the child node
};

export interface MindNodeGlobalStyles {
  themeId?: string;
  customTheme?: MindNodeTheme;
  fontSize?: number; // 14, 16, 20, 24
  roughness?: number; // 0 (architect), 1 (artist), 2 (cartoonist)
  roundness?: number; // 1 (sharp), 2 (round), 3 (pill)
  textAlign?: "left" | "center" | "right";
  opacity?: number; // 0 - 100
  layoutMode?: "organic" | "threaded";
}

const ALL_THEMES_STORAGE_KEY = "excalidraw-mindnode-all-themes";
const GLOBAL_STYLES_STORAGE_KEY = "excalidraw-mindnode-global-styles";

export const getAllThemes = (): MindNodeTheme[] => {
  try {
    const raw = localStorage.getItem(ALL_THEMES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load MindNode themes from storage", err);
  }
  return DEFAULT_MINDNODE_THEMES;
};

export const saveAllThemes = (themes: MindNodeTheme[]): void => {
  try {
    localStorage.setItem(ALL_THEMES_STORAGE_KEY, JSON.stringify(themes));
  } catch (err) {
    console.error("Failed to save MindNode themes to storage", err);
  }
};

export const saveTheme = (theme: MindNodeTheme): MindNodeTheme[] => {
  const current = getAllThemes();
  const existingIdx = current.findIndex((t) => t.id === theme.id);
  let next: MindNodeTheme[];
  if (existingIdx >= 0) {
    next = [...current];
    next[existingIdx] = theme;
  } else {
    next = [...current, theme];
  }
  saveAllThemes(next);
  return next;
};

export const deleteTheme = (themeId: string): MindNodeTheme[] => {
  const current = getAllThemes();
  const next = current.filter((t) => t.id !== themeId);
  saveAllThemes(next);
  return next;
};

export const resetAllThemesToDefault = (): MindNodeTheme[] => {
  try {
    localStorage.removeItem(ALL_THEMES_STORAGE_KEY);
  } catch {}
  return DEFAULT_MINDNODE_THEMES;
};

export const getThemeById = (themeId?: string): MindNodeTheme => {
  const themes = getAllThemes();
  if (!themeId) return themes[0] || DEFAULT_MINDNODE_THEMES[0];
  return themes.find((t) => t.id === themeId) || themes[0] || DEFAULT_MINDNODE_THEMES[0];
};

export const MINDNODE_THEMES = DEFAULT_MINDNODE_THEMES;

export const getSavedGlobalStyles = (): MindNodeGlobalStyles => {
  try {
    const raw = localStorage.getItem(GLOBAL_STYLES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveGlobalStyles = (styles: MindNodeGlobalStyles): void => {
  try {
    localStorage.setItem(GLOBAL_STYLES_STORAGE_KEY, JSON.stringify(styles));
  } catch (err) {
    console.error("Failed to save global MindNode styles", err);
  }
};
