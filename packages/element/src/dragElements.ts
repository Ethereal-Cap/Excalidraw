import {
  type Bounds,
  TEXT_AUTOWRAP_THRESHOLD,
  getGridPoint,
  getFontString,
  DRAGGING_THRESHOLD,
} from "@excalidraw/common";

import type {
  AppState,
  NormalizedZoomValue,
  NullableGridSize,
  PointerDownState,
} from "@excalidraw/excalidraw/types";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { unbindBindingElement, updateBoundElements } from "./binding";
import { getCommonBounds } from "./bounds";
import { getPerfectElementSize } from "./sizeHelpers";
import { getBoundTextElement } from "./textElement";
import { getMinTextElementWidth } from "./textMeasurements";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import {
  isArrowElement,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isTextElement,
} from "./typeChecks";

import type { Scene } from "./Scene";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "./types";

export const dragSelectedElements = (
  pointerDownState: PointerDownState,
  _selectedElements: NonDeletedExcalidrawElement[],
  offset: { x: number; y: number },
  scene: Scene,
  snapOffset: {
    x: number;
    y: number;
  },
  gridSize: NullableGridSize,
) => {
  if (
    _selectedElements.length === 1 &&
    isElbowArrow(_selectedElements[0]) &&
    (_selectedElements[0].startBinding || _selectedElements[0].endBinding)
  ) {
    return;
  }

  const selectedElements = _selectedElements.filter((element) => {
    if (isElbowArrow(element) && element.startBinding && element.endBinding) {
      const startElement = _selectedElements.find(
        (el) => el.id === element.startBinding?.elementId,
      );
      const endElement = _selectedElements.find(
        (el) => el.id === element.endBinding?.elementId,
      );

      return startElement && endElement;
    }

    return true;
  });

  // we do not want a frame and its elements to be selected at the same time
  // but when it happens (due to some bug), we want to avoid updating element
  // in the frame twice, hence the use of set
  const elementsToUpdate = new Set<NonDeletedExcalidrawElement>(
    selectedElements,
  );
  const frames = selectedElements
    .filter((e) => isFrameLikeElement(e))
    .map((f) => f.id);

  if (frames.length > 0) {
    for (const element of scene.getNonDeletedElements()) {
      if (element.frameId !== null && frames.includes(element.frameId)) {
        elementsToUpdate.add(element);
      }
    }
  }

  const origElements: ExcalidrawElement[] = [];

  for (const element of elementsToUpdate) {
    const origElement = pointerDownState.originalElements.get(element.id);
    // if original element is not set (e.g. when you duplicate during a drag
    // operation), exit to avoid undefined behavior
    if (!origElement) {
      return;
    }
    origElements.push(origElement);
  }

  // Support MindNode subtree movement:
  // When a MindNode is dragged, collect all its descendant nodes, texts, branches,
  // and anchored images so the entire tree moves together with the picked node.
  const draggedMindNodes = selectedElements.filter(
    (e) => e.customData?.isMindNode,
  );
  if (draggedMindNodes.length > 0) {
    const allNonDeleted = scene.getNonDeletedElements();
    for (const mn of draggedMindNodes) {
      const queue: string[] = [mn.id];
      const descendantNodeIds = new Set<string>();

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        for (const el of allNonDeleted) {
          if (el.customData?.isMindNode && el.customData?.parentId === currentId) {
            if (!descendantNodeIds.has(el.id)) {
              descendantNodeIds.add(el.id);
              queue.push(el.id);
              elementsToUpdate.add(el);

              // Auto-collapse sub-nodes on drag
              if (!el.customData?.collapsed || el.opacity !== 0) {
                scene.mutateElement(el, {
                  opacity: 0,
                  customData: {
                    ...el.customData,
                    collapsed: true,
                    hiddenByCollapse: true,
                  },
                });
              }
            }
          }
        }
      }

      // Collect texts, branches, and anchored images for the dragged node and all its descendants
      const allSubtreeNodeIds = new Set([mn.id, ...descendantNodeIds]);
      for (const el of allNonDeleted) {
        // MindNode text labels
        if (
          el.customData?.isMindNodeText &&
          allSubtreeNodeIds.has(el.customData?.nodeId)
        ) {
          elementsToUpdate.add(el);
          if (descendantNodeIds.has(el.customData?.nodeId) && el.opacity !== 0) {
            scene.mutateElement(el, {
              opacity: 0,
              customData: {
                ...el.customData,
                hiddenByCollapse: true,
              },
            });
          }
        }
        // Subtree branches (branches between nodes within the dragged subtree)
        if (
          el.customData?.isMindNodeBranch &&
          allSubtreeNodeIds.has(el.customData?.parentId) &&
          allSubtreeNodeIds.has(el.customData?.childId)
        ) {
          elementsToUpdate.add(el);
          if (el.opacity !== 0) {
            scene.mutateElement(el, {
              opacity: 0,
              customData: {
                ...el.customData,
                hiddenByCollapse: true,
              },
            });
          }
        }
        // Images anchored to nodes in this subtree
        if (
          el.type === "image" &&
          allSubtreeNodeIds.has(el.customData?.anchoredMindNodeId)
        ) {
          elementsToUpdate.add(el);
          // If the dragged node itself is collapsed or if the image is anchored to a descendant
          if (
            (mn.customData?.collapsed || descendantNodeIds.has(el.customData?.anchoredMindNodeId)) &&
            el.opacity !== 0
          ) {
            scene.mutateElement(el, {
              opacity: 0,
              customData: {
                ...el.customData,
                hiddenByCollapse: true,
              },
            });
          }
        }
      }
    }
  }

  const adjustedOffset = calculateOffset(
    getCommonBounds(origElements),
    offset,
    snapOffset,
    gridSize,
  );

  const elementsToUpdateIds = new Set(
    Array.from(elementsToUpdate, (el) => el.id),
  );

  elementsToUpdate.forEach((element) => {
    const isArrow = !isArrowElement(element);
    const isStartBoundElementSelected =
      isArrow ||
      (element.startBinding
        ? elementsToUpdateIds.has(element.startBinding.elementId)
        : false);
    const isEndBoundElementSelected =
      isArrow ||
      (element.endBinding
        ? elementsToUpdateIds.has(element.endBinding.elementId)
        : false);

    if (!isArrowElement(element)) {
      updateElementCoords(pointerDownState, element, scene, adjustedOffset);

      // skip arrow labels since we calculate its position during render
      const textElement = getBoundTextElement(
        element,
        scene.getNonDeletedElementsMap(),
      );
      if (textElement) {
        updateElementCoords(
          pointerDownState,
          textElement,
          scene,
          adjustedOffset,
        );
      }
      updateBoundElements(element, scene, {
        simultaneouslyUpdated: Array.from(elementsToUpdate),
      });
    } else if (
      // NOTE: Add a little initial drag to the arrow dragging when the arrow
      // is the single element being dragged to avoid accidentally unbinding
      // the arrow when the user just wants to select it.

      elementsToUpdate.size > 1 ||
      Math.max(Math.abs(adjustedOffset.x), Math.abs(adjustedOffset.y)) >
        DRAGGING_THRESHOLD ||
      (!element.startBinding && !element.endBinding)
    ) {
      updateElementCoords(pointerDownState, element, scene, adjustedOffset);

      const shouldUnbindStart =
        element.startBinding && !isStartBoundElementSelected;
      const shouldUnbindEnd = element.endBinding && !isEndBoundElementSelected;
      if (shouldUnbindStart || shouldUnbindEnd) {
        // NOTE: Moving the bound arrow should unbind it, otherwise we would
        // have weird situations, like 0 lenght arrow when the user moves
        // the arrow outside a filled shape suddenly forcing the arrow start
        // and end point to jump "outside" the shape.
        if (shouldUnbindStart) {
          unbindBindingElement(element, "start", scene);
        }
        if (shouldUnbindEnd) {
          unbindBindingElement(element, "end", scene);
        }
      }
    }
  });

  // Re-sync incoming branch connector curve if dragging a child MindNode whose parent is stationary
  if (draggedMindNodes.length > 0) {
    const allNonDeleted = scene.getNonDeletedElements();
    for (const mn of draggedMindNodes) {
      if (mn.customData?.parentId && !elementsToUpdateIds.has(mn.customData?.parentId)) {
        const parent = allNonDeleted.find((e) => e.id === mn.customData?.parentId);
        const incomingBranch = allNonDeleted.find(
          (e) =>
            e.customData?.isMindNodeBranch &&
            e.customData?.parentId === mn.customData?.parentId &&
            e.customData?.childId === mn.id,
        );
        if (parent && incomingBranch) {
          const dir = (incomingBranch.customData?.direction || mn.customData?.direction || "right") as "right" | "left" | "top" | "bottom";
          let startX = parent.x + parent.width;
          let startY = parent.y + parent.height / 2;
          let endX = mn.x;
          let endY = mn.y + mn.height / 2;

          if (dir === "left") {
            startX = parent.x;
            startY = parent.y + parent.height / 2;
            endX = mn.x + mn.width;
            endY = mn.y + mn.height / 2;
          } else if (dir === "top") {
            startX = parent.x + parent.width / 2;
            startY = parent.y;
            endX = mn.x + mn.width / 2;
            endY = mn.y + mn.height;
          } else if (dir === "bottom") {
            startX = parent.x + parent.width / 2;
            startY = parent.y + parent.height;
            endX = mn.x + mn.width / 2;
            endY = mn.y;
          }

          const dx = endX - startX;
          const dy = endY - startY;

          const points: LocalPoint[] = [pointFrom<LocalPoint>(0, 0)];
          const steps = 12;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            let cx1 = 0;
            let cy1 = 0;
            let cx2 = 0;
            let cy2 = 0;

            if (dir === "right" || dir === "left") {
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

          scene.mutateElement(incomingBranch as ExcalidrawLinearElement, {
            x: startX,
            y: startY,
            width: Math.abs(dx) || 1,
            height: Math.abs(dy) || 1,
            points,
          });
        }
      }
    }
  }
};

const calculateOffset = (
  commonBounds: Bounds,
  dragOffset: { x: number; y: number },
  snapOffset: { x: number; y: number },
  gridSize: NullableGridSize,
): { x: number; y: number } => {
  const [x, y] = commonBounds;
  let nextX = x + dragOffset.x + snapOffset.x;
  let nextY = y + dragOffset.y + snapOffset.y;

  if (snapOffset.x === 0 || snapOffset.y === 0) {
    const [nextGridX, nextGridY] = getGridPoint(
      x + dragOffset.x,
      y + dragOffset.y,
      gridSize,
    );

    if (snapOffset.x === 0) {
      nextX = nextGridX;
    }

    if (snapOffset.y === 0) {
      nextY = nextGridY;
    }
  }
  return {
    x: nextX - x,
    y: nextY - y,
  };
};

const updateElementCoords = (
  pointerDownState: PointerDownState,
  element: ExcalidrawElement,
  scene: Scene,
  dragOffset: { x: number; y: number },
) => {
  const originalElement =
    pointerDownState.originalElements.get(element.id) ?? element;

  const nextX = originalElement.x + dragOffset.x;
  const nextY = originalElement.y + dragOffset.y;

  scene.mutateElement(element, {
    x: nextX,
    y: nextY,
  });
};

export const getDragOffsetXY = (
  selectedElements: NonDeletedExcalidrawElement[],
  x: number,
  y: number,
): [number, number] => {
  const [x1, y1] = getCommonBounds(selectedElements);
  return [x - x1, y - y1];
};

/**
 * Sizes a text element as it is dragged out.
 *
 * A dragged text pins one point and grows away from it; `anchorRatio` says
 * where along the box that point sits — 0 for its left edge, 1 for its right,
 * 0.5 for its centre.
 *
 * A free text pins the point the drag started from and takes the ratio from
 * the drag direction, so it can be pulled either way. A text bound to an arrow
 * endpoint instead pins whatever the binding placed it against and takes the
 * ratio from its alignment — which is also what keeps it from growing back
 * over the arrow, since dragging that way makes no progress rather than
 * flipping the box around.
 */
export const dragNewTextElement = ({
  newElement,
  anchorX,
  anchorRatio,
  pointerX,
  nextY,
  zoom,
  scene,
  informMutation = true,
}: {
  newElement: ExcalidrawTextElement;
  anchorX: number;
  /** 0 = anchored by its left edge, 1 = by its right, 0.5 = by its centre */
  anchorRatio: number;
  pointerX: number;
  /** free text re-tops itself to the drag origin; a bound one must not move */
  nextY?: number;
  zoom: NormalizedZoomValue;
  scene: Scene;
  informMutation?: boolean;
}) => {
  const offset = pointerX - anchorX;

  // how far the pointer has travelled away from the anchor along the direction
  // the box may grow — negative once it heads back the other way
  const reach =
    anchorRatio === 0 ? offset : anchorRatio === 1 ? -offset : Math.abs(offset);

  const width = Math.max(
    // a centred box grows on both sides, so it widens at twice the reach
    anchorRatio === 0.5 ? reach * 2 : reach,
    getMinTextElementWidth(
      getFontString({
        fontSize: newElement.fontSize,
        fontFamily: newElement.fontFamily,
      }),
      newElement.lineHeight,
    ),
  );

  scene.mutateElement(
    newElement,
    {
      x: anchorX - width * anchorRatio,
      ...(nextY === undefined ? {} : { y: nextY }),
      width,
      ...(reach > TEXT_AUTOWRAP_THRESHOLD / zoom ? { autoResize: false } : {}),
    },
    { informMutation, isDragging: false },
  );
};

export const dragNewElement = ({
  newElement,
  elementType,
  originX,
  originY,
  x,
  y,
  width,
  height,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  zoom,
  scene,
  widthAspectRatio = null,
  originOffset = null,
  informMutation = true,
}: {
  newElement: NonDeletedExcalidrawElement;
  elementType: AppState["activeTool"]["type"];
  originX: number;
  originY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shouldMaintainAspectRatio: boolean;
  shouldResizeFromCenter: boolean;
  zoom: NormalizedZoomValue;
  scene: Scene;
  /** whether to keep given aspect ratio when `isResizeWithSidesSameLength` is
      true */
  widthAspectRatio?: number | null;
  originOffset?: {
    x: number;
    y: number;
  } | null;
  informMutation?: boolean;
}) => {
  if (shouldMaintainAspectRatio && newElement.type !== "selection") {
    if (widthAspectRatio) {
      height = width / widthAspectRatio;
    } else {
      // Depending on where the cursor is at (x, y) relative to where the starting point is
      // (originX, originY), we use ONLY width or height to control size increase.
      // This allows the cursor to always "stick" to one of the sides of the bounding box.
      if (Math.abs(y - originY) > Math.abs(x - originX)) {
        ({ width, height } = getPerfectElementSize(
          elementType,
          height,
          x < originX ? -width : width,
        ));
      } else {
        ({ width, height } = getPerfectElementSize(
          elementType,
          width,
          y < originY ? -height : height,
        ));
      }

      if (height < 0) {
        height = -height;
      }
    }
  }

  if (isTextElement(newElement)) {
    // a text is only ever sized horizontally — its height follows the wrapped
    // content — so it grows away from the point the drag started at
    dragNewTextElement({
      newElement,
      anchorX: originX + (originOffset?.x ?? 0),
      anchorRatio: shouldResizeFromCenter ? 0.5 : x < originX ? 1 : 0,
      pointerX: x,
      nextY: originY + (originOffset?.y ?? 0),
      zoom,
      scene,
      informMutation,
    });
    return;
  }

  let newX = x < originX ? originX - width : originX;
  let newY = y < originY ? originY - height : originY;

  if (shouldResizeFromCenter) {
    width += width;
    height += height;
    newX = originX - width / 2;
    newY = originY - height / 2;
  }

  if (width !== 0 && height !== 0) {
    let imageInitialDimension = null;
    if (isImageElement(newElement)) {
      imageInitialDimension = {
        initialWidth: width,
        initialHeight: height,
      };
    }

    scene.mutateElement(
      newElement,
      {
        x: newX + (originOffset?.x ?? 0),
        y: newY + (originOffset?.y ?? 0),
        width,
        height,
        ...imageInitialDimension,
      },
      { informMutation, isDragging: false },
    );
  }
};
