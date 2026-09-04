/**
 * MindNode Theme & Styling System for Excalidraw
 * Provides the pastel palette, node types, and branch curve colors
 * inspired by MindNode.
 */

export interface MindNodeTheme {
  id: string;
  name: string;
  bg: string;
  stroke: string;
  text: string;
  badgeBg: string;
  badgeText: string;
}

export const MINDNODE_THEMES: MindNodeTheme[] = [
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
