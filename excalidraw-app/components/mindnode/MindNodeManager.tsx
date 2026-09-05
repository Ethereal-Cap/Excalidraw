import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ExcalidrawImperativeAPI, BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { newImageElement } from "@excalidraw/element";
import {
  MINDNODE_THEMES,
  MINDNODE_CONSTANTS,
  type MindNodeTheme,
  type MindNodeGlobalStyles,
  getSavedCustomTheme,
  getSavedGlobalStyles,
} from "./mindNodeThemes";
import {
  createMindNodeElement,
  createMindNodeBranch,
  createThreadedBranch,
  autoLayoutMindNodeSubtree,
  autoLayoutThreadedSubtree,
  calculateOrganicBranchPoints,
  getAllDescendantIds,
  getDescendantHierarchy,
  getImmediateChildren,
  type MindNodeDirection,
} from "./mindNodeEngine";
import { MindNodeSettingsModal } from "./MindNodeSettingsModal";
import "./MindNodeManager.scss";

interface MindNodeManagerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export const MindNodeManager: React.FC<MindNodeManagerProps> = ({ excalidrawAPI }) => {
  const [selectedMindNode, setSelectedMindNode] = useState<ExcalidrawElement | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string>("mint");
  const [isMindNodeModeActive, setIsMindNodeModeActive] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<"organic" | "threaded">("organic");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const expandTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      expandTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Load saved default styles on mount
  useEffect(() => {
    const saved = getSavedGlobalStyles();
    if (saved.layoutMode) {
      setLayoutMode(saved.layoutMode);
    }
    if (saved.themeId) {
      setActiveThemeId(saved.themeId);
    }
  }, []);

  // Monitor Excalidraw selection changes
  useEffect(() => {
    if (!excalidrawAPI) return;

    const unsubscribe = excalidrawAPI.onChange((elements, appState) => {
      const selectedIds = Object.keys(appState.selectedElementIds || {});
      if (selectedIds.length === 1) {
        const el = elements.find((e) => e.id === selectedIds[0]);
        if (el && el.customData?.isMindNode) {
          setSelectedMindNode(el);
          return;
        }
      }
      setSelectedMindNode(null);
    });

    return () => {
      unsubscribe();
    };
  }, [excalidrawAPI]);

  useEffect(() => {
    (window as any).__createMindNode = (x: number, y: number, label: string) => {
      return createMindNodeElement(x, y, label, activeThemeId, "root", null);
    };
  }, [activeThemeId]);

  // Add Root MindNode to canvas
  const handleAddRootNode = useCallback(
    (themeId = activeThemeId) => {
      if (!excalidrawAPI) return;
      const appState = excalidrawAPI.getAppState();

      // Center in viewport
      const zoom = appState.zoom.value;
      const centerX = -appState.scrollX + appState.width / (2 * zoom);
      const centerY = -appState.scrollY + appState.height / (2 * zoom);

      const { rect, text } = createMindNodeElement(
        centerX - 75,
        centerY - 24,
        "",
        themeId,
        "root",
        null,
      );

      const currentElements = excalidrawAPI.getSceneElements();
      excalidrawAPI.updateScene({
        elements: [...currentElements, rect, text],
        appState: {
          selectedElementIds: { [rect.id]: true },
        },
      });
    },
    [excalidrawAPI, activeThemeId],
  );

  // Add Child Node in any of the 4 directions (right, left, top, bottom)
  const handleAddChildNode = useCallback(
    (
      parentNode: ExcalidrawElement,
      direction: MindNodeDirection = "right",
      keepParentSelected = false,
    ) => {
      if (!excalidrawAPI) return;

      const elements = excalidrawAPI.getSceneElements();
      const parentThemeId = parentNode.customData?.themeId || activeThemeId;
      const parentTheme =
        MINDNODE_THEMES.find((t) => t.id === parentThemeId) || MINDNODE_THEMES[0];

      // Existing children in the same direction
      const existingChildren = elements.filter(
        (el) =>
          !el.isDeleted &&
          el.customData?.isMindNode &&
          el.customData?.parentId === parentNode.id &&
          (el.customData?.direction || "right") === direction,
      );

      const childIndex = existingChildren.length + 1;
      let childX = parentNode.x + parentNode.width + MINDNODE_CONSTANTS.HORIZONTAL_SPACING;
      let childY = parentNode.y;

      if (layoutMode === "threaded") {
        childX = parentNode.x + 40;
        childY = parentNode.y + parentNode.height + 16;
      } else {
        if (direction === "left") {
          childX = parentNode.x - MINDNODE_CONSTANTS.MIN_NODE_WIDTH - MINDNODE_CONSTANTS.HORIZONTAL_SPACING;
          childY = parentNode.y;
        } else if (direction === "top") {
          childX = parentNode.x;
          childY = parentNode.y - MINDNODE_CONSTANTS.MIN_NODE_HEIGHT - 90;
        } else if (direction === "bottom") {
          childX = parentNode.x;
          childY = parentNode.y + parentNode.height + 90;
        }
      }

      const { rect: childRect, text: childText } = createMindNodeElement(
        childX,
        childY,
        "",
        parentThemeId,
        "child",
        parentNode.id,
        childIndex,
        direction,
      );

      const branch =
        layoutMode === "threaded"
          ? createThreadedBranch(parentNode, childRect, parentTheme.stroke)
          : createMindNodeBranch(parentNode, childRect, parentTheme.stroke, direction);

      // Re-layout parent and all directional siblings
      const updatedElements = [...elements, childRect, childText, branch];
      const layoutUpdates =
        layoutMode === "threaded"
          ? autoLayoutThreadedSubtree(parentNode.id, updatedElements)
          : autoLayoutMindNodeSubtree(parentNode.id, updatedElements);

      const finalElements = updatedElements.map((el) => {
        if (layoutUpdates[el.id]) {
          const newPos = layoutUpdates[el.id];
          return {
            ...el,
            x: newPos.x,
            y: newPos.y,
          };
        }
        return el;
      });

      // Update branch connector endpoints to match newly calculated coordinates
      const branchSyncedElements = finalElements.map((el) => {
        if (el.customData?.isMindNodeBranch) {
          const pId = el.customData?.parentId;
          const cId = el.customData?.childId;
          const pNode = finalElements.find((e) => e.id === pId);
          const child = finalElements.find((e) => e.id === cId);
          if (pNode && child) {
            if (layoutMode === "threaded" || el.customData?.branchStyle === "threaded") {
              const updatedBranch = createThreadedBranch(pNode, child, el.strokeColor);
              return {
                ...el,
                x: updatedBranch.x,
                y: updatedBranch.y,
                width: updatedBranch.width,
                height: updatedBranch.height,
                points: (updatedBranch as any).points,
                roundness: updatedBranch.roundness,
              };
            } else {
              const dir: MindNodeDirection = el.customData?.direction || child.customData?.direction || "right";
              let startX = pNode.x + pNode.width;
              let startY = pNode.y + pNode.height / 2;
              let endX = child.x;
              let endY = child.y + child.height / 2;

              if (dir === "left") {
                startX = pNode.x;
                startY = pNode.y + pNode.height / 2;
                endX = child.x + child.width;
                endY = child.y + child.height / 2;
              } else if (dir === "top") {
                startX = pNode.x + pNode.width / 2;
                startY = pNode.y;
                endX = child.x + child.width / 2;
                endY = child.y + child.height;
              } else if (dir === "bottom") {
                startX = pNode.x + pNode.width / 2;
                startY = pNode.y + pNode.height;
                endX = child.x + child.width / 2;
                endY = child.y;
              }

              const points = calculateOrganicBranchPoints(startX, startY, endX, endY, dir);
              return {
                ...el,
                x: startX,
                y: startY,
                width: Math.abs(endX - startX) || 1,
                height: Math.abs(endY - startY) || 1,
                points: points as any,
              };
            }
          }
        }
        // Sync text container position
        if (el.customData?.isMindNodeText) {
          const container = finalElements.find((e) => e.id === el.customData?.nodeId);
          if (container) {
            return {
              ...el,
              x: container.x + (container.width - el.width) / 2,
              y: container.y + (container.height - el.height) / 2,
            };
          }
        }
        return el;
      });

      excalidrawAPI.updateScene({
        elements: branchSyncedElements as readonly ExcalidrawElement[],
        appState: {
          selectedElementIds: keepParentSelected
            ? { [parentNode.id]: true }
            : { [childRect.id]: true },
        },
      });
    },
    [excalidrawAPI, activeThemeId, layoutMode],
  );

  // Switch layout mode and re-layout active mind map
  const handleChangeLayoutMode = useCallback(
    (newMode: "organic" | "threaded") => {
      setLayoutMode(newMode);
      if (!excalidrawAPI) return;

      const currentElements = excalidrawAPI.getSceneElements();
      const rootNodes = currentElements.filter(
        (el) => !el.isDeleted && el.customData?.isMindNode && !el.customData?.parentId,
      );

      let workingElements = [...currentElements];

      for (const root of rootNodes) {
        const layoutUpdates =
          newMode === "threaded"
            ? autoLayoutThreadedSubtree(root.id, workingElements)
            : autoLayoutMindNodeSubtree(root.id, workingElements);

        workingElements = workingElements.map((el) => {
          if (layoutUpdates[el.id]) {
            return {
              ...el,
              x: layoutUpdates[el.id].x,
              y: layoutUpdates[el.id].y,
            };
          }
          return el;
        });

        // Re-generate branches for the tree based on newMode
        workingElements = workingElements.map((el) => {
          if (el.customData?.isMindNodeBranch) {
            const pId = el.customData?.parentId;
            const cId = el.customData?.childId;
            const pNode = workingElements.find((e) => e.id === pId);
            const child = workingElements.find((e) => e.id === cId);
            if (pNode && child) {
              if (newMode === "threaded") {
                const updatedBranch = createThreadedBranch(pNode, child, el.strokeColor);
                return {
                  ...el,
                  x: updatedBranch.x,
                  y: updatedBranch.y,
                  width: updatedBranch.width,
                  height: updatedBranch.height,
                  points: (updatedBranch as any).points,
                  roundness: updatedBranch.roundness,
                  customData: {
                    ...el.customData,
                    branchStyle: "threaded",
                  },
                };
              } else {
                const dir: MindNodeDirection = el.customData?.direction || child.customData?.direction || "right";
                let startX = pNode.x + pNode.width;
                let startY = pNode.y + pNode.height / 2;
                let endX = child.x;
                let endY = child.y + child.height / 2;

                if (dir === "left") {
                  startX = pNode.x;
                  startY = pNode.y + pNode.height / 2;
                  endX = child.x + child.width;
                  endY = child.y + child.height / 2;
                } else if (dir === "top") {
                  startX = pNode.x + pNode.width / 2;
                  startY = pNode.y;
                  endX = child.x + child.width / 2;
                  endY = child.y + child.height;
                } else if (dir === "bottom") {
                  startX = pNode.x + pNode.width / 2;
                  startY = pNode.y + pNode.height;
                  endX = child.x + child.width / 2;
                  endY = child.y;
                }

                const points = calculateOrganicBranchPoints(startX, startY, endX, endY, dir);
                return {
                  ...el,
                  x: startX,
                  y: startY,
                  width: Math.abs(endX - startX) || 1,
                  height: Math.abs(endY - startY) || 1,
                  points: points as any,
                  roundness: { type: 2 },
                  customData: {
                    ...el.customData,
                    branchStyle: "organic",
                  },
                };
              }
            }
          }
          // Sync text container position
          if (el.customData?.isMindNodeText) {
            const container = workingElements.find((e) => e.id === el.customData?.nodeId);
            if (container) {
              return {
                ...el,
                x: container.x + (container.width - el.width) / 2,
                y: container.y + (container.height - el.height) / 2,
              };
            }
          }
          return el;
        });
      }

      excalidrawAPI.updateScene({ elements: workingElements });
    },
    [excalidrawAPI],
  );

  // Apply Global Styles across the entire selected mind map tree
  const handleApplyGlobalStyles = useCallback(
    (styles: MindNodeGlobalStyles) => {
      if (!excalidrawAPI) return;
      const currentElements = excalidrawAPI.getSceneElements();

      // Find root or subtree of selected node (or all mind nodes if none selected)
      let targetNodeIds: string[] = [];
      if (selectedMindNode) {
        let topRootId = selectedMindNode.id;
        const elementsMap = new Map(currentElements.map((el) => [el.id, el]));
        let curr = selectedMindNode;
        while (curr && curr.customData?.parentId) {
          const p = elementsMap.get(curr.customData.parentId);
          if (p) {
            curr = p;
            topRootId = p.id;
          } else {
            break;
          }
        }
        const { nodeIds } = getAllDescendantIds(topRootId, currentElements);
        targetNodeIds = [topRootId, ...nodeIds];
      } else {
        targetNodeIds = currentElements
          .filter((el) => !el.isDeleted && el.customData?.isMindNode)
          .map((el) => el.id);
      }

      const targetNodeIdSet = new Set(targetNodeIds);

      // Selected theme
      let theme: MindNodeTheme | undefined = undefined;
      if (styles.customTheme) {
        theme = styles.customTheme;
      } else if (styles.themeId) {
        theme = MINDNODE_THEMES.find((t) => t.id === styles.themeId);
      }

      const updatedElements = currentElements.map((el) => {
        if (el.isDeleted) return el;

        // Rectangle nodes
        if (el.customData?.isMindNode && targetNodeIdSet.has(el.id)) {
          return {
            ...el,
            ...(theme ? { backgroundColor: theme.bg, strokeColor: theme.stroke } : {}),
            ...(styles.roughness !== undefined ? { roughness: styles.roughness } : {}),
            ...(styles.roundness !== undefined ? { roundness: { type: styles.roundness as any } } : {}),
            ...(styles.opacity !== undefined ? { opacity: styles.opacity } : {}),
            customData: {
              ...el.customData,
              ...(styles.themeId ? { themeId: styles.themeId } : {}),
              ...(styles.layoutMode ? { layoutMode: styles.layoutMode } : {}),
            },
          };
        }

        // Text elements
        if (el.customData?.isMindNodeText && targetNodeIdSet.has(el.customData?.nodeId)) {
          return {
            ...el,
            ...(theme ? { strokeColor: theme.text } : {}),
            ...(styles.fontSize ? { fontSize: styles.fontSize } : {}),
            ...(styles.textAlign ? { textAlign: styles.textAlign } : {}),
            ...(styles.opacity !== undefined ? { opacity: styles.opacity } : {}),
          };
        }

        // Branches
        if (el.customData?.isMindNodeBranch && targetNodeIdSet.has(el.customData?.parentId)) {
          return {
            ...el,
            ...(theme ? { strokeColor: theme.stroke } : {}),
            ...(styles.roughness !== undefined ? { roughness: styles.roughness } : {}),
            ...(styles.opacity !== undefined ? { opacity: styles.opacity } : {}),
          };
        }

        return el;
      });

      excalidrawAPI.updateScene({ elements: updatedElements as readonly ExcalidrawElement[] });
    },
    [excalidrawAPI, selectedMindNode],
  );

  // Toggle Collapse / Expand (mode: "incremental" for 1-level unfold, "all" for all levels at once)
  const handleToggleCollapse = useCallback(
    (node: ExcalidrawElement, mode: "incremental" | "all" = "incremental") => {
      if (!excalidrawAPI) return;

      // Clear any in-flight expand timers
      expandTimersRef.current.forEach((t) => clearTimeout(t));
      expandTimersRef.current = [];

      const currentElements = excalidrawAPI.getSceneElements();
      const isCurrentlyCollapsed = !!node.customData?.collapsed;

      if (!isCurrentlyCollapsed) {
        // --- COLLAPSE: Hide all descendants and images ---
        const { nodeIds, textIds, branchIds, imageIds } = getAllDescendantIds(
          node.id,
          currentElements,
        );
        const hideSet = new Set([...nodeIds, ...textIds, ...branchIds, ...imageIds]);
        const descendantNodeIdSet = new Set(nodeIds);

        const updatedElements = currentElements.map((el) => {
          if (el.id === node.id) {
            return {
              ...el,
              customData: {
                ...el.customData,
                collapsed: true,
              },
            };
          }
          if (hideSet.has(el.id)) {
            const isDescendantNode = descendantNodeIdSet.has(el.id);
            return {
              ...el,
              opacity: 0,
              locked: true,
              customData: {
                ...el.customData,
                hiddenByCollapse: true,
                ...(isDescendantNode ? { collapsed: true } : {}),
              },
            };
          }
          return el;
        });

        excalidrawAPI.updateScene({ elements: updatedElements });
        setSelectedMindNode((prev) =>
          prev && prev.id === node.id
            ? { ...prev, customData: { ...prev.customData, collapsed: true } }
            : prev,
        );
      } else {
        // --- EXPAND ---
        if (mode === "all") {
          // --- FULL EXPAND (ALL LEVELS AT ONCE) ---
          const { nodeIds, textIds, branchIds, imageIds } = getAllDescendantIds(
            node.id,
            currentElements,
          );
          const revealSet = new Set([...nodeIds, ...textIds, ...branchIds, ...imageIds]);
          const descendantNodeIdSet = new Set(nodeIds);

          const updatedElements = currentElements.map((el) => {
            if (el.id === node.id) {
              return {
                ...el,
                customData: {
                  ...el.customData,
                  collapsed: false,
                },
              };
            }
            if (revealSet.has(el.id)) {
              const isDescendantNode = descendantNodeIdSet.has(el.id);
              return {
                ...el,
                opacity: 100,
                locked: false,
                customData: {
                  ...el.customData,
                  hiddenByCollapse: false,
                  ...(isDescendantNode ? { collapsed: false } : {}),
                },
              };
            }
            return el;
          });

          excalidrawAPI.updateScene({ elements: updatedElements });
          setSelectedMindNode((prev) =>
            prev && prev.id === node.id
              ? { ...prev, customData: { ...prev.customData, collapsed: false } }
              : prev,
          );
        } else {
          // --- INCREMENTAL EXPAND (IMMEDIATE CHILD LEVEL ONLY) ---
          let workingElements = currentElements.map((el) => {
            if (el.id === node.id) {
              return {
                ...el,
                customData: {
                  ...el.customData,
                  collapsed: false,
                },
              };
            }
            return el;
          });

          // Identify immediate children nodes
          const immediateChildNodes = workingElements.filter(
            (el) =>
              !el.isDeleted &&
              el.customData?.isMindNode &&
              el.customData?.parentId === node.id,
          );
          const immediateChildNodeIds = new Set(immediateChildNodes.map((c) => c.id));

          const immediateBranches = workingElements.filter(
            (el) =>
              !el.isDeleted &&
              el.customData?.isMindNodeBranch &&
              el.customData?.parentId === node.id,
          );

          const immediateTexts = workingElements.filter(
            (el) =>
              !el.isDeleted &&
              el.customData?.isMindNodeText &&
              immediateChildNodeIds.has(el.customData?.nodeId),
          );

          const immediateImages = workingElements.filter(
            (el) =>
              !el.isDeleted &&
              el.type === "image" &&
              (el.customData?.anchoredMindNodeId === node.id ||
                immediateChildNodeIds.has(el.customData?.anchoredMindNodeId)),
          );

          immediateChildNodes.sort(
            (a, b) => (a.customData?.order ?? a.y) - (b.customData?.order ?? b.y),
          );

          // Preserve collapsed=true on immediate children that have their own descendants
          workingElements = workingElements.map((el) => {
            if (immediateChildNodeIds.has(el.id)) {
              const hasGrandchildren = workingElements.some(
                (candidate) =>
                  !candidate.isDeleted &&
                  ((candidate.customData?.isMindNode && candidate.customData?.parentId === el.id) ||
                    (candidate.type === "image" && candidate.customData?.anchoredMindNodeId === el.id)),
              );
              if (hasGrandchildren && el.customData?.collapsed === undefined) {
                return {
                  ...el,
                  customData: {
                    ...el.customData,
                    collapsed: true,
                  },
                };
              }
            }
            return el;
          });

          excalidrawAPI.updateScene({ elements: workingElements });
          setSelectedMindNode((prev) =>
            prev && prev.id === node.id
              ? { ...prev, customData: { ...prev.customData, collapsed: false } }
              : prev,
          );

          // Sequential one-by-one reveal
          immediateChildNodes.forEach((childNode, index) => {
            const timer = setTimeout(() => {
              if (!excalidrawAPI) return;

              const childBranchIds = new Set(
                immediateBranches
                  .filter((b) => b.customData?.childId === childNode.id)
                  .map((b) => b.id),
              );
              const childTextIds = new Set(
                immediateTexts
                  .filter((t) => t.customData?.nodeId === childNode.id)
                  .map((t) => t.id),
              );
              const childImageIds = new Set(
                immediateImages
                  .filter((img) => img.customData?.anchoredMindNodeId === childNode.id)
                  .map((img) => img.id),
              );

              const parentImageIds = index === 0
                ? new Set(immediateImages.filter((img) => img.customData?.anchoredMindNodeId === node.id).map((img) => img.id))
                : new Set<string>();

              const revealSet = new Set([
                childNode.id,
                ...childBranchIds,
                ...childTextIds,
                ...childImageIds,
                ...parentImageIds,
              ]);

              const sceneElements = excalidrawAPI.getSceneElements();
              const nextElements = sceneElements.map((el) => {
                if (revealSet.has(el.id)) {
                  return {
                    ...el,
                    opacity: 100,
                    locked: false,
                    customData: {
                      ...el.customData,
                      hiddenByCollapse: false,
                    },
                  };
                }
                return el;
              });

              excalidrawAPI.updateScene({ elements: nextElements });
            }, (index + 1) * 80);

            expandTimersRef.current.push(timer);
          });

          if (immediateChildNodes.length === 0 && immediateImages.length > 0) {
            const revealSet = new Set(immediateImages.map((img) => img.id));
            const sceneElements = excalidrawAPI.getSceneElements();
            const nextElements = sceneElements.map((el) => {
              if (revealSet.has(el.id)) {
                return {
                  ...el,
                  opacity: 100,
                  locked: false,
                  customData: {
                    ...el.customData,
                    hiddenByCollapse: false,
                  },
                };
              }
              return el;
            });
            excalidrawAPI.updateScene({ elements: nextElements });
          }
        }
      }
    },
    [excalidrawAPI],
  );

  // Trigger file selection for anchoring images to the active mind node
  const handleTriggerImageAnchor = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }, []);

  // Handle uploaded image files and anchor them to the mind node
  const handleImageFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !selectedMindNode || !excalidrawAPI) {
        return;
      }

      const files = Array.from(e.target.files);
      const sceneElements = excalidrawAPI.getSceneElements();

      // Find existing images already anchored to this node to calculate layout offset
      const existingAnchored = sceneElements.filter(
        (el) =>
          !el.isDeleted &&
          el.type === "image" &&
          el.customData?.anchoredMindNodeId === selectedMindNode.id,
      );

      let currentOffset = existingAnchored.length;

      for (const file of files) {
        const reader = new FileReader();
        const readPromise = new Promise<{ dataURL: DataURL; width: number; height: number }>(
          (resolve, reject) => {
            reader.onload = () => {
              const dataURL = reader.result as DataURL;
              const img = new Image();
              img.onload = () => {
                resolve({
                  dataURL,
                  width: img.naturalWidth || 160,
                  height: img.naturalHeight || 120,
                });
              };
              img.onerror = reject;
              img.src = dataURL;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          },
        );

        try {
          const { dataURL, width: origW, height: origH } = await readPromise;
          const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as any;
          const binaryFile: BinaryFileData = {
            id: fileId,
            dataURL,
            mimeType: (file.type as any) || "image/png",
            created: Date.now(),
            lastRetrieved: Date.now(),
          };

          // Register image binary in Excalidraw files
          excalidrawAPI.addFiles([binaryFile]);

          // Scale image down to standard thumbnail size (approx 140px width)
          const targetWidth = 140;
          const targetHeight = Math.round((origH / origW) * targetWidth);

          // Position anchored images directly below the node, stacked neatly
          const imgX = selectedMindNode.x + (currentOffset % 2 === 0 ? 0 : targetWidth + 12);
          const imgY =
            selectedMindNode.y +
            selectedMindNode.height +
            14 +
            Math.floor(currentOffset / 2) * (targetHeight + 12);

          const newImg = newImageElement({
            type: "image",
            x: imgX,
            y: imgY,
            width: targetWidth,
            height: targetHeight,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 0,
            opacity: 100,
            locked: false,
            fileId,
            status: "saved",
            scale: [1, 1],
            customData: {
              isAnchoredImage: true,
              anchoredMindNodeId: selectedMindNode.id,
            },
          });

          // Link image ID to node's attachedImages array
          const latestElements = excalidrawAPI.getSceneElements();
          const updatedElements = latestElements.map((el) => {
            if (el.id === selectedMindNode.id) {
              const currentAttached = el.customData?.attachedImages || [];
              return {
                ...el,
                customData: {
                  ...el.customData,
                  attachedImages: [...currentAttached, newImg.id],
                },
              };
            }
            return el;
          });

          excalidrawAPI.updateScene({
            elements: [...updatedElements, newImg],
          });

          currentOffset++;
        } catch (err) {
          console.error("Failed to load and anchor image to MindNode", err);
        }
      }
    },
    [selectedMindNode, excalidrawAPI],
  );

  // Keyboard navigation hook for Tab (child right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMindNode || !excalidrawAPI) return;

      // Don't intercept if user is currently inside a native textarea/input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "textarea" || activeTag === "input") return;

      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        handleAddChildNode(selectedMindNode, "right");
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [selectedMindNode, excalidrawAPI, handleAddChildNode]);

  // Compute viewport position of selected mindnode for floating handle button overlays
  const getSelectedNodeOverlayCoords = () => {
    if (!selectedMindNode || !excalidrawAPI) return null;
    const appState = excalidrawAPI.getAppState();
    const zoom = appState.zoom.value;

    const screenX = (selectedMindNode.x + appState.scrollX) * zoom + appState.offsetLeft;
    const screenY = (selectedMindNode.y + appState.scrollY) * zoom + appState.offsetTop;
    const screenW = selectedMindNode.width * zoom;
    const screenH = selectedMindNode.height * zoom;

    return {
      // 4 Edge handles (+)
      rightX: screenX + screenW + 8,
      rightY: screenY + screenH / 2 - 14,
      leftX: screenX - 36,
      leftY: screenY + screenH / 2 - 14,
      topX: screenX + screenW / 2 - 14,
      topY: screenY - 36,
      bottomX: screenX + screenW / 2 - 14,
      bottomY: screenY + screenH + 8,

      // 4 Corner handles (+) for opening multiple child nodes in specific directions
      // Top-Left corner: opens Top direction
      topLeftX: screenX - 14,
      topLeftY: screenY - 26,
      // Top-Right corner: opens Right direction
      topRightCornerX: screenX + screenW - 14,
      topRightCornerY: screenY - 26,
      // Bottom-Right corner: opens Bottom direction
      bottomRightX: screenX + screenW - 14,
      bottomRightY: screenY + screenH - 2,
      // Bottom-Left corner: opens Left direction
      bottomLeftX: screenX - 14,
      bottomLeftY: screenY + screenH - 2,

      // Incremental / Hierarchical collapse toggle at right side
      collapseX: screenX + screenW + 42,
      collapseY: screenY + screenH / 2 - 14,

      // Full Subtree unfold / collapse toggle at left side
      leftCollapseX: screenX - 70,
      leftCollapseY: screenY + screenH / 2 - 14,

      // Image anchor handle (📷)
      imageAnchorX: screenX + screenW + 8,
      imageAnchorY: screenY - 36,
    };
  };

  const overlayCoords = getSelectedNodeOverlayCoords();
  const isCollapsed = !!selectedMindNode?.customData?.collapsed;

  // Check if current node has children or anchored images that can be collapsed
  const hasSubtree = useCallback(() => {
    if (!selectedMindNode || !excalidrawAPI) return false;
    const elements = excalidrawAPI.getSceneElements();
    return elements.some(
      (el) =>
        !el.isDeleted &&
        ((el.customData?.isMindNode && el.customData?.parentId === selectedMindNode.id) ||
          (el.type === "image" && el.customData?.anchoredMindNodeId === selectedMindNode.id)),
    );
  }, [selectedMindNode, excalidrawAPI]);

  const canCollapse = hasSubtree() || isCollapsed;

  return (
    <>
      {/* Hidden file input for anchoring multiple images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleImageFileChange}
      />

      {/* MindNode Floating Control Pill on Toolbar */}
      <div className="mindnode-top-toolbar" title="MindNode Mind Mapping">
        <button
          className={`mindnode-btn-mode ${isMindNodeModeActive ? "active" : ""}`}
          onClick={() => {
            setIsMindNodeModeActive(!isMindNodeModeActive);
            handleAddRootNode();
          }}
          title="Create MindNode Mind Map"
        >
          <span className="mindnode-icon">🧠</span>
          <span className="mindnode-label">MindMap</span>
        </button>

        {/* Layout Style Switcher (🌿 Organic / 🧵 Threaded) */}
        <div className="mindnode-layout-pill">
          <button
            className={`layout-pill-btn ${layoutMode === "organic" ? "active" : ""}`}
            onClick={() => handleChangeLayoutMode("organic")}
            title="Organic 4-Directional Bézier Layout"
          >
            🌿 Organic
          </button>
          <button
            className={`layout-pill-btn ${layoutMode === "threaded" ? "active" : ""}`}
            onClick={() => handleChangeLayoutMode("threaded")}
            title="Threaded / YouTube Comment Outline Layout"
          >
            🧵 Threaded
          </button>
        </div>

        {/* Theme Picker Dropdown */}
        <div className="mindnode-theme-selector">
          {MINDNODE_THEMES.map((theme) => (
            <button
              key={theme.id}
              className={`mindnode-theme-dot ${activeThemeId === theme.id ? "selected" : ""}`}
              style={{ backgroundColor: theme.bg, borderColor: theme.stroke }}
              onClick={() => {
                setActiveThemeId(theme.id);
                if (selectedMindNode && excalidrawAPI) {
                  const elements = excalidrawAPI.getSceneElements();
                  const updated = elements.map((el) => {
                    if (el.id === selectedMindNode.id) {
                      return {
                        ...el,
                        strokeColor: theme.stroke,
                        backgroundColor: theme.bg,
                        customData: { ...el.customData, themeId: theme.id },
                      };
                    }
                    if (el.customData?.isMindNodeText && el.customData?.nodeId === selectedMindNode.id) {
                      return {
                        ...el,
                        strokeColor: theme.text,
                      };
                    }
                    if (
                      el.customData?.isMindNodeBranch &&
                      el.customData?.parentId === selectedMindNode.id
                    ) {
                      return {
                        ...el,
                        strokeColor: theme.stroke,
                      };
                    }
                    return el;
                  });
                  excalidrawAPI.updateScene({ elements: updated });
                }
              }}
              title={theme.name}
            />
          ))}
        </div>

        {/* Global Settings Trigger (⚙️) */}
        <button
          className="mindnode-btn-settings"
          onClick={() => setIsSettingsModalOpen(true)}
          title="MindMap Global Styles & Palette Settings"
        >
          ⚙️
        </button>
      </div>

      {/* MindNode Global Styles & Palette Modal */}
      <MindNodeSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        activeThemeId={activeThemeId}
        onSelectTheme={(themeId) => setActiveThemeId(themeId)}
        onApplyGlobalStyles={handleApplyGlobalStyles}
        currentLayoutMode={layoutMode}
        onChangeLayoutMode={handleChangeLayoutMode}
      />

      {/* Floating Interactive 4-Directional Node Handles */}
      {selectedMindNode && overlayCoords && (
        <div className="mindnode-floating-overlay">
          {/* Edge Handles (+) */}
          {/* Add Child Right (+) */}
          <button
            className="mindnode-handle-btn plus-dir plus-right"
            style={{
              left: `${overlayCoords.rightX}px`,
              top: `${overlayCoords.rightY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "right");
            }}
            title="Expand Right (Tab)"
          >
            +
          </button>

          {/* Add Child Left (+) */}
          <button
            className="mindnode-handle-btn plus-dir plus-left"
            style={{
              left: `${overlayCoords.leftX}px`,
              top: `${overlayCoords.leftY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "left");
            }}
            title="Expand Left"
          >
            +
          </button>

          {/* Add Child Top (+) */}
          <button
            className="mindnode-handle-btn plus-dir plus-top"
            style={{
              left: `${overlayCoords.topX}px`,
              top: `${overlayCoords.topY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "top");
            }}
            title="Expand Top"
          >
            +
          </button>

          {/* Add Child Bottom (+) */}
          <button
            className="mindnode-handle-btn plus-dir plus-bottom"
            style={{
              left: `${overlayCoords.bottomX}px`,
              top: `${overlayCoords.bottomY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "bottom");
            }}
            title="Expand Bottom"
          >
            +
          </button>

          {/* Corner Handles (+) to continually open multiple child nodes in designated directions */}
          {/* Top-Left Corner (+) -> Top Direction */}
          <button
            className="mindnode-handle-btn plus-corner plus-tl"
            style={{
              left: `${overlayCoords.topLeftX}px`,
              top: `${overlayCoords.topLeftY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "top", true);
            }}
            title="Add Multiple Children (Top)"
          >
            +
          </button>

          {/* Top-Right Corner (+) -> Right Direction */}
          <button
            className="mindnode-handle-btn plus-corner plus-tr"
            style={{
              left: `${overlayCoords.topRightCornerX}px`,
              top: `${overlayCoords.topRightCornerY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "right", true);
            }}
            title="Add Multiple Children (Right)"
          >
            +
          </button>

          {/* Bottom-Right Corner (+) -> Bottom Direction */}
          <button
            className="mindnode-handle-btn plus-corner plus-br"
            style={{
              left: `${overlayCoords.bottomRightX}px`,
              top: `${overlayCoords.bottomRightY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "bottom", true);
            }}
            title="Add Multiple Children (Bottom)"
          >
            +
          </button>

          {/* Bottom-Left Corner (+) -> Left Direction */}
          <button
            className="mindnode-handle-btn plus-corner plus-bl"
            style={{
              left: `${overlayCoords.bottomLeftX}px`,
              top: `${overlayCoords.bottomLeftY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode, "left", true);
            }}
            title="Add Multiple Children (Left)"
          >
            +
          </button>

          {/* Image Anchor Handle (📷) */}
          <button
            className="mindnode-handle-btn image-anchor"
            style={{
              left: `${overlayCoords.imageAnchorX}px`,
              top: `${overlayCoords.imageAnchorY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerImageAnchor();
            }}
            title="Anchor Multiple Images to this Node"
          >
            📷
          </button>

          {/* Right Collapse Button: Incremental / Hierarchical Unfold Toggle */}
          {canCollapse && (
            <button
              className={`mindnode-handle-btn collapse-toggle collapse-incremental ${
                isCollapsed ? "is-collapsed" : ""
              }`}
              style={{
                left: `${overlayCoords.collapseX}px`,
                top: `${overlayCoords.collapseY}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse(selectedMindNode, "incremental");
              }}
              title={
                isCollapsed
                  ? "Expand Subtree (Sequential / 1 Level at a time)"
                  : "Collapse Subtree & Anchored Images"
              }
            >
              {isCollapsed ? "▶" : "▼"}
            </button>
          )}

          {/* Left Collapse Button: Full Subtree Simultaneous Unfold Toggle */}
          {canCollapse && (
            <button
              className={`mindnode-handle-btn collapse-toggle collapse-all ${
                isCollapsed ? "is-collapsed" : ""
              }`}
              style={{
                left: `${overlayCoords.leftCollapseX}px`,
                top: `${overlayCoords.leftCollapseY}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse(selectedMindNode, "all");
              }}
              title={
                isCollapsed
                  ? "Expand All Subtree Levels at once"
                  : "Collapse Subtree & Anchored Images"
              }
            >
              {isCollapsed ? "◀" : "▼"}
            </button>
          )}
        </div>
      )}
    </>
  );
};

