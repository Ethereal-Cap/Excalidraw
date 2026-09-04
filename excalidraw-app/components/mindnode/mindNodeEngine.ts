import { pointFrom, type LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";
import { newElement, newTextElement, newLinearElement } from "@excalidraw/element";
import { MINDNODE_THEMES, MINDNODE_CONSTANTS } from "./mindNodeThemes";

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
  attachedImages?: string[]; // fileIds or elementIds of attached images
}

/**
 * Generate organic cubic bezier curve points for MindNode connection
 */
export const calculateOrganicBranchPoints = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): readonly LocalPoint[] => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  const points: LocalPoint[] = [pointFrom<LocalPoint>(0, 0)];
  const steps = 12;
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx1 = dx * 0.45;
    const cy1 = 0;
    const cx2 = dx * 0.55;
    const cy2 = dy;

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
 * Creates a complete MindNode pill element with attached container text
 */
export const createMindNodeElement = (
  x: number,
  y: number,
  label: string,
  themeId = "mint",
  nodeType: "root" | "child" = "root",
  parentId: string | null = null,
  order = 1,
): {
  rect: NonDeletedExcalidrawElement;
  text: NonDeletedExcalidrawElement;
} => {
  const theme = MINDNODE_THEMES.find((t) => t.id === themeId) || MINDNODE_THEMES[0];
  const fontSize = nodeType === "root" ? 18 : 15;
  
  const approxTextWidth = Math.max(label.length * (fontSize * 0.62), 120);
  const width = Math.max(approxTextWidth + MINDNODE_CONSTANTS.NODE_PADDING_X * 2, MINDNODE_CONSTANTS.MIN_NODE_WIDTH);
  const height = nodeType === "root" ? 48 : 42;

  const rect = newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: theme.stroke,
    backgroundColor: theme.bg,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    roundness: { type: 3 }, // smooth rounded pill corners
    customData: {
      isMindNode: true,
      nodeType,
      parentId,
      themeId: theme.id,
      childrenIds: [],
      order,
      collapsed: false,
    },
  });

  const text = newTextElement({
    text: label,
    fontSize,
    fontFamily: 2, // clean sans-serif
    textAlign: "center",
    verticalAlign: "middle",
    x: x + 10,
    y: y + (height - fontSize * 1.25) / 2,
    width: width - 20,
    height: fontSize * 1.25,
    strokeColor: theme.text,
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
 * Creates an organic curved branch connector linking parent node to child node
 */
export const createMindNodeBranch = (
  parentRect: ExcalidrawElement,
  childRect: ExcalidrawElement,
  strokeColor: string,
): NonDeletedExcalidrawElement => {
  const startX = parentRect.x + parentRect.width;
  const startY = parentRect.y + parentRect.height / 2;

  const endX = childRect.x;
  const endY = childRect.y + childRect.height / 2;

  const points = calculateOrganicBranchPoints(startX, startY, endX, endY);

  const branch = newLinearElement({
    type: "line",
    x: startX,
    y: startY,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
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
    },
  });

  return branch;
};

/**
 * Auto-layouts MindNode children in a balanced vertical tree to the right of parent
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

  children.sort((a, b) => (a.customData?.order ?? a.y) - (b.customData?.order ?? b.y));

  const totalHeight =
    children.reduce((acc, c) => acc + c.height, 0) +
    (children.length - 1) * MINDNODE_CONSTANTS.VERTICAL_SPACING;

  const parentCenterY = parent.y + parent.height / 2;
  const startY = parentCenterY - totalHeight / 2;
  const targetX = parent.x + parent.width + MINDNODE_CONSTANTS.HORIZONTAL_SPACING;

  const updates: { [id: string]: { x: number; y: number } } = {};
  let currentY = startY;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    updates[child.id] = {
      x: targetX,
      y: currentY,
    };
    currentY += child.height + MINDNODE_CONSTANTS.VERTICAL_SPACING;
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

