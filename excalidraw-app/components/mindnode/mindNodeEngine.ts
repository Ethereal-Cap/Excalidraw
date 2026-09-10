import { pointFrom, type LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";
import { newElement, newTextElement, newLinearElement } from "@excalidraw/element";
import { MINDNODE_THEMES, MINDNODE_CONSTANTS, getThemeById } from "./mindNodeThemes";

export type MindNodeDirection = "right" | "left" | "top" | "bottom";

export interface MindNodeStyleOverrides {
  backgroundColor?: string;
  strokeColor?: string;
  textColor?: string;
  roughness?: number;
  roundness?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  layoutMode?: "organic" | "threaded";
}

export interface MindNodeData {
  isMindNode: boolean;
  nodeType: "root" | "child";
  parentId?: string | null;
  childrenIds?: string[];
  connectorId?: string | null;
  badgeId?: string | null;
  themeId?: string;
  order?: number;
  collapsed?: boolean;
  direction?: MindNodeDirection;
  layoutMode?: "organic" | "threaded";
  branchStyle?: "organic" | "threaded";
  attachedImages?: string[]; // fileIds or elementIds of attached images
}

/**
 * Generate organic cubic bezier curve points for MindNode connection in 4 directions
 */
export const calculateOrganicBranchPoints = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  direction: MindNodeDirection = "right",
): readonly LocalPoint[] => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  const points: LocalPoint[] = [pointFrom<LocalPoint>(0, 0)];
  const steps = 12;
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    let cx1 = 0;
    let cy1 = 0;
    let cx2 = 0;
    let cy2 = 0;

    if (direction === "right" || direction === "left") {
      cx1 = dx * 0.45;
      cy1 = 0;
      cx2 = dx * 0.55;
      cy2 = dy;
    } else {
      // "top" or "bottom"
      cx1 = 0;
      cy1 = dy * 0.45;
      cx2 = dx;
      cy2 = dy * 0.55;
    }

    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const ttt = tt * t;

    const px = 3 * uu * t * cx1 + 3 * u * tt * cx2 + ttt * dx;
    const py = 3 * uu * t * cy1 + 3 * u * tt * cy2 + ttt * dy;

    points.push(pointFrom<LocalPoint>(Math.round(px), Math.round(py)));
  }

  return points;
};

/**
 * Creates a complete MindNode pill element with attached container text.
 * Supports style overrides and parent style inheritance.
 */
export const createMindNodeElement = (
  x: number,
  y: number,
  label = "",
  themeId = "mint",
  nodeType: "root" | "child" = "root",
  parentId: string | null = null,
  order = 1,
  direction: MindNodeDirection = "right",
  styleOverrides?: MindNodeStyleOverrides,
): {
  rect: NonDeletedExcalidrawElement;
  text: NonDeletedExcalidrawElement;
} => {
  const theme = getThemeById(themeId);
  const fontSize = styleOverrides?.fontSize || (nodeType === "root" ? 18 : 15);
  
  const approxTextWidth = label.length > 0 ? label.length * (fontSize * 0.62) : 0;
  const width = Math.max(approxTextWidth + MINDNODE_CONSTANTS.NODE_PADDING_X * 2, MINDNODE_CONSTANTS.MIN_NODE_WIDTH);
  const height = nodeType === "root" ? 48 : 42;

  const bg = styleOverrides?.backgroundColor || theme.bg;
  const stroke = styleOverrides?.strokeColor || theme.stroke;
  const textColor = styleOverrides?.textColor || theme.text;
  const roughness = styleOverrides?.roughness ?? 0;
  const roundness = styleOverrides?.roundness ?? 3;
  const opacity = styleOverrides?.opacity ?? 100;
  const textAlign = styleOverrides?.textAlign || "center";
  const fontFamily = styleOverrides?.fontFamily || 5;
  const layoutMode = styleOverrides?.layoutMode || "organic";

  const rect = newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: stroke,
    backgroundColor: bg,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness,
    roundness: { type: roundness as any },
    opacity,
    customData: {
      isMindNode: true,
      nodeType,
      parentId,
      themeId: theme.id,
      childrenIds: [],
      order,
      collapsed: false,
      direction,
      layoutMode,
    },
  });

  // Center coordinates for newTextElement
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const text = newTextElement({
    text: label,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign: "middle",
    x: centerX,
    y: centerY,
    strokeColor: textColor,
    opacity,
    containerId: rect.id,
    customData: {
      isMindNodeText: true,
      nodeId: rect.id,
    },
  });

  // Bind container
  (rect as any).boundElements = [{ id: text.id, type: "text" }];

  return { rect, text };
};

/**
 * Creates an organic curved branch connector linking parent node to child node in any of the 4 directions
 */
export const createMindNodeBranch = (
  parentRect: ExcalidrawElement,
  childRect: ExcalidrawElement,
  strokeColor: string,
  direction: MindNodeDirection = "right",
): NonDeletedExcalidrawElement => {
  let startX = parentRect.x + parentRect.width;
  let startY = parentRect.y + parentRect.height / 2;
  let endX = childRect.x;
  let endY = childRect.y + childRect.height / 2;

  if (direction === "left") {
    startX = parentRect.x;
    startY = parentRect.y + parentRect.height / 2;
    endX = childRect.x + childRect.width;
    endY = childRect.y + childRect.height / 2;
  } else if (direction === "top") {
    startX = parentRect.x + parentRect.width / 2;
    startY = parentRect.y;
    endX = childRect.x + childRect.width / 2;
    endY = childRect.y + childRect.height;
  } else if (direction === "bottom") {
    startX = parentRect.x + parentRect.width / 2;
    startY = parentRect.y + parentRect.height;
    endX = childRect.x + childRect.width / 2;
    endY = childRect.y;
  }

  const points = calculateOrganicBranchPoints(startX, startY, endX, endY, direction);

  const branch = newLinearElement({
    type: "line",
    x: startX,
    y: startY,
    width: Math.abs(endX - startX) || 1,
    height: Math.abs(endY - startY) || 1,
    points: points as any,
    strokeColor,
    strokeWidth: 2.5,
    strokeStyle: "solid",
    roughness: 0,
    roundness: { type: 2 },
    customData: {
      isMindNodeBranch: true,
      parentId: parentRect.id,
      childId: childRect.id,
      direction,
    },
  });

  return branch;
};

/**
 * Auto-layouts MindNode children across all 4 directions (right, left, top, bottom)
 */
export const autoLayoutMindNodeSubtree = (
  parentId: string,
  elements: readonly ExcalidrawElement[],
): { [id: string]: { x: number; y: number } } => {
  const elementsMap = new Map(elements.map((el) => [el.id, el]));
  const parent = elementsMap.get(parentId);
  if (!parent) return {};

  const children = elements.filter(
    (el) =>
      !el.isDeleted &&
      el.customData?.isMindNode &&
      el.customData?.parentId === parentId,
  );

  if (children.length === 0) return {};

  const updates: { [id: string]: { x: number; y: number } } = {};

  // Group children by direction
  const directions: MindNodeDirection[] = ["right", "left", "top", "bottom"];

  for (const dir of directions) {
    const dirChildren = children.filter((c) => (c.customData?.direction || "right") === dir);
    if (dirChildren.length === 0) continue;

    dirChildren.sort((a, b) => (a.customData?.order ?? a.y) - (b.customData?.order ?? b.y));

    if (dir === "right" || dir === "left") {
      const totalHeight =
        dirChildren.reduce((acc, c) => acc + c.height, 0) +
        (dirChildren.length - 1) * MINDNODE_CONSTANTS.VERTICAL_SPACING;

      const parentCenterY = parent.y + parent.height / 2;
      const startY = parentCenterY - totalHeight / 2;
      let currentY = startY;

      for (let i = 0; i < dirChildren.length; i++) {
        const child = dirChildren[i];
        const targetX =
          dir === "right"
            ? parent.x + parent.width + MINDNODE_CONSTANTS.HORIZONTAL_SPACING
            : parent.x - child.width - MINDNODE_CONSTANTS.HORIZONTAL_SPACING;

        updates[child.id] = {
          x: targetX,
          y: currentY,
        };
        currentY += child.height + MINDNODE_CONSTANTS.VERTICAL_SPACING;
      }
    } else {
      // "top" or "bottom"
      const totalWidth =
        dirChildren.reduce((acc, c) => acc + c.width, 0) +
        (dirChildren.length - 1) * MINDNODE_CONSTANTS.VERTICAL_SPACING;

      const parentCenterX = parent.x + parent.width / 2;
      const startX = parentCenterX - totalWidth / 2;
      let currentX = startX;

      for (let i = 0; i < dirChildren.length; i++) {
        const child = dirChildren[i];
        const targetY =
          dir === "bottom"
            ? parent.y + parent.height + 90
            : parent.y - child.height - 90;

        updates[child.id] = {
          x: currentX,
          y: targetY,
        };
        currentX += child.width + MINDNODE_CONSTANTS.VERTICAL_SPACING;
      }
    }
  }

  return updates;
};

/**
 * Recursively retrieves all descendant node IDs (including text, branches, and anchored images)
 */
export const getAllDescendantIds = (
  rootNodeId: string,
  elements: readonly ExcalidrawElement[],
): {
  nodeIds: string[];
  textIds: string[];
  branchIds: string[];
  imageIds: string[];
} => {
  const nodeIds: string[] = [];
  const textIds: string[] = [];
  const branchIds: string[] = [];
  const imageIds: string[] = [];

  const queue: string[] = [rootNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const el of elements) {
      if (el.isDeleted) continue;

      // Check for child mind nodes
      if (el.customData?.isMindNode && el.customData?.parentId === currentId) {
        nodeIds.push(el.id);
        queue.push(el.id);
      }
      // Check for branches originating from this parent
      if (el.customData?.isMindNodeBranch && el.customData?.parentId === currentId) {
        branchIds.push(el.id);
      }
      // Check for images anchored to current node
      if (el.type === "image" && el.customData?.anchoredMindNodeId === currentId) {
        imageIds.push(el.id);
      }
    }
  }

  // Find all text elements for the collected nodes
  for (const el of elements) {
    if (
      el.customData?.isMindNodeText &&
      nodeIds.includes(el.customData?.nodeId)
    ) {
      textIds.push(el.id);
    }
    // Also root's anchored images
    if (el.type === "image" && el.customData?.anchoredMindNodeId === rootNodeId) {
      if (!imageIds.includes(el.id)) {
        imageIds.push(el.id);
      }
    }
  }

  return { nodeIds, textIds, branchIds, imageIds };
};

/**
 * Returns immediate children nodes of a given parent
 */
export const getImmediateChildren = (
  parentId: string,
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => {
  return elements.filter(
    (el) =>
      !el.isDeleted &&
      el.customData?.isMindNode &&
      el.customData?.parentId === parentId,
  );
};

/**
 * Returns descendants organized level by level (breadth-first)
 * Each level contains { nodes: ExcalidrawElement[], branches: ExcalidrawElement[], images: ExcalidrawElement[] }
 */
export const getDescendantHierarchy = (
  rootNodeId: string,
  elements: readonly ExcalidrawElement[],
): Array<{
  nodes: ExcalidrawElement[];
  texts: ExcalidrawElement[];
  branches: ExcalidrawElement[];
  images: ExcalidrawElement[];
}> => {
  const levels: Array<{
    nodes: ExcalidrawElement[];
    texts: ExcalidrawElement[];
    branches: ExcalidrawElement[];
    images: ExcalidrawElement[];
  }> = [];

  let currentParentIds = [rootNodeId];

  while (currentParentIds.length > 0) {
    const nextNodes: ExcalidrawElement[] = [];
    const nextBranches: ExcalidrawElement[] = [];
    const nextImages: ExcalidrawElement[] = [];

    for (const parentId of currentParentIds) {
      for (const el of elements) {
        if (el.isDeleted) continue;
        if (el.customData?.isMindNode && el.customData?.parentId === parentId) {
          nextNodes.push(el);
        }
        if (el.customData?.isMindNodeBranch && el.customData?.parentId === parentId) {
          nextBranches.push(el);
        }
        if (el.type === "image" && el.customData?.anchoredMindNodeId === parentId) {
          if (!nextImages.some((img) => img.id === el.id)) {
            nextImages.push(el);
          }
        }
      }
    }

    if (nextNodes.length === 0 && nextBranches.length === 0 && nextImages.length === 0) {
      break;
    }

    // Collect text elements for nextNodes
    const nextNodeIds = nextNodes.map((n) => n.id);
    const nextTexts = elements.filter(
      (el) =>
        !el.isDeleted &&
        el.customData?.isMindNodeText &&
        nextNodeIds.includes(el.customData?.nodeId),
    );

    // Also collect any images attached directly to the nextNodes themselves
    for (const n of nextNodes) {
      for (const el of elements) {
        if (el.type === "image" && el.customData?.anchoredMindNodeId === n.id) {
          if (!nextImages.some((img) => img.id === el.id)) {
            nextImages.push(el);
          }
        }
      }
    }

    levels.push({
      nodes: nextNodes,
      texts: nextTexts,
      branches: nextBranches,
      images: nextImages,
    });

    currentParentIds = nextNodes.map((n) => n.id);
  }

  return levels;
};

/**
 * Creates an elbow thread connector linking parent node to child node in YouTube comment style
 */
export const createThreadedBranch = (
  parentRect: ExcalidrawElement,
  childRect: ExcalidrawElement,
  strokeColor: string,
): NonDeletedExcalidrawElement => {
  const startX = parentRect.x + 20;
  const startY = parentRect.y + parentRect.height;
  const endX = childRect.x;
  const endY = childRect.y + childRect.height / 2;

  const dx = endX - startX;
  const dy = endY - startY;

  const points: LocalPoint[] = [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(0, Math.round(dy)),
    pointFrom<LocalPoint>(Math.round(dx), Math.round(dy)),
  ];

  const branch = newLinearElement({
    type: "line",
    x: startX,
    y: startY,
    width: Math.abs(dx) || 1,
    height: Math.abs(dy) || 1,
    points: points as any,
    strokeColor,
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    roundness: { type: 2 },
    customData: {
      isMindNodeBranch: true,
      parentId: parentRect.id,
      childId: childRect.id,
      branchStyle: "threaded",
    },
  });

  return branch;
};

/**
 * Auto-layouts MindNode tree in YouTube comment / Threaded Outline style:
 * - Vertical spine drops down from parent
 * - Children indent horizontally to the right (+40px)
 * - Subtrees stack sequentially without vertical overlap
 */
export const autoLayoutThreadedSubtree = (
  rootNodeId: string,
  elements: readonly ExcalidrawElement[],
): { [id: string]: { x: number; y: number } } => {
  const elementsMap = new Map(elements.map((el) => [el.id, el]));
  const root = elementsMap.get(rootNodeId);
  if (!root) return {};

  const updates: { [id: string]: { x: number; y: number } } = {};
  const INDENT_X = 40;
  const GAP_Y = 16;

  // Recursive layout helper that returns the next available Y coordinate
  const layoutNodeAndDescendants = (nodeId: string, currentX: number, startY: number): number => {
    const node = elementsMap.get(nodeId);
    if (!node) return startY;

    updates[nodeId] = { x: currentX, y: startY };
    let nextY = startY + node.height + GAP_Y;

    // If node is collapsed, its children are hidden and don't take layout space
    if (node.customData?.collapsed) {
      return nextY;
    }

    const children = elements.filter(
      (el) =>
        !el.isDeleted &&
        el.customData?.isMindNode &&
        el.customData?.parentId === nodeId,
    );

    if (children.length === 0) {
      return nextY;
    }

    children.sort((a, b) => (a.customData?.order ?? a.y) - (b.customData?.order ?? b.y));

    for (const child of children) {
      nextY = layoutNodeAndDescendants(child.id, currentX + INDENT_X, nextY);
    }

    return nextY;
  };

  // If rootNode is a child node, find its top-level root ancestor
  let topRootId = rootNodeId;
  let curr = root;
  while (curr && curr.customData?.parentId) {
    const p = elementsMap.get(curr.customData.parentId);
    if (p) {
      curr = p;
      topRootId = p.id;
    } else {
      break;
    }
  }

  const topRoot = elementsMap.get(topRootId) || root;
  layoutNodeAndDescendants(topRootId, topRoot.x, topRoot.y);

  return updates;
};

