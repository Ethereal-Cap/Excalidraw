import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ExcalidrawImperativeAPI, BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { newImageElement } from "@excalidraw/element";
import {
  MINDNODE_THEMES,
  MINDNODE_CONSTANTS,
  type MindNodeTheme,
} from "./mindNodeThemes";
import {
  createMindNodeElement,
  createMindNodeBranch,
  autoLayoutMindNodeSubtree,
  calculateOrganicBranchPoints,
  getAllDescendantIds,
  getDescendantHierarchy,
  getImmediateChildren,
  type MindNodeDirection,
} from "./mindNodeEngine";
import "./MindNodeManager.scss";

interface MindNodeManagerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export const MindNodeManager: React.FC<MindNodeManagerProps> = ({ excalidrawAPI }) => {
  const [selectedMindNode, setSelectedMindNode] = useState<ExcalidrawElement | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string>("mint");
  const [isMindNodeModeActive, setIsMindNodeModeActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const expandTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      expandTimersRef.current.forEach((t) => clearTimeout(t));
    };
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
    (parentNode: ExcalidrawElement, direction: MindNodeDirection = "right") => {
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

      const branch = createMindNodeBranch(parentNode, childRect, parentTheme.stroke, direction);

      // Re-layout parent and all directional siblings
      const updatedElements = [...elements, childRect, childText, branch];
      const layoutUpdates = autoLayoutMindNodeSubtree(parentNode.id, updatedElements);

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
        if (el.customData?.isMindNodeBranch && el.customData?.parentId === parentNode.id) {
          const cId = el.customData?.childId;
          const child = finalElements.find((e) => e.id === cId);
          if (child) {
            const dir: MindNodeDirection = el.customData?.direction || child.customData?.direction || "right";
            let startX = parentNode.x + parentNode.width;
            let startY = parentNode.y + parentNode.height / 2;
            let endX = child.x;
            let endY = child.y + child.height / 2;

            if (dir === "left") {
              startX = parentNode.x;
              startY = parentNode.y + parentNode.height / 2;
              endX = child.x + child.width;
              endY = child.y + child.height / 2;
            } else if (dir === "top") {
              startX = parentNode.x + parentNode.width / 2;
              startY = parentNode.y;
              endX = child.x + child.width / 2;
              endY = child.y + child.height;
            } else if (dir === "bottom") {
              startX = parentNode.x + parentNode.width / 2;
              startY = parentNode.y + parentNode.height;
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
          selectedElementIds: { [childRect.id]: true },
        },
      });
    },
    [excalidrawAPI, activeThemeId],
  );

  // Toggle Collapse / Expand with One-by-One Sequential Animation
  const handleToggleCollapse = useCallback(
    (node: ExcalidrawElement) => {
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
        // --- EXPAND: Animate immediate child level only (hierarchical / incremental unfolding) ---
        // 1. Mark target node uncollapsed
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

        // 2. Identify immediate children nodes of this node
        const immediateChildNodes = workingElements.filter(
          (el) =>
            !el.isDeleted &&
            el.customData?.isMindNode &&
            el.customData?.parentId === node.id,
        );
        const immediateChildNodeIds = new Set(immediateChildNodes.map((c) => c.id));

        // 3. Find immediate branches connecting this parent to its immediate children
        const immediateBranches = workingElements.filter(
          (el) =>
            !el.isDeleted &&
            el.customData?.isMindNodeBranch &&
            el.customData?.parentId === node.id,
        );

        // 4. Find bound text elements for immediate children
        const immediateTexts = workingElements.filter(
          (el) =>
            !el.isDeleted &&
            el.customData?.isMindNodeText &&
            immediateChildNodeIds.has(el.customData?.nodeId),
        );

        // 5. Find images anchored directly to this parent or directly to immediate children
        const immediateImages = workingElements.filter(
          (el) =>
            !el.isDeleted &&
            el.type === "image" &&
            (el.customData?.anchoredMindNodeId === node.id ||
              immediateChildNodeIds.has(el.customData?.anchoredMindNodeId)),
        );

        // Sort immediate children by visual order or y-position for smooth top-to-bottom sequential appearance
        immediateChildNodes.sort(
          (a, b) => (a.customData?.order ?? a.y) - (b.customData?.order ?? b.y),
        );

        // Ensure any immediate child that has descendants of its own preserves collapsed=true state
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

        // Sequential one-by-one reveal of immediate child nodes and their branches/texts/images
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

            // Also on the very first child step, reveal any images anchored directly to the parent node
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

        // If node has anchored images but no child nodes, reveal its images directly
        if (immediateChildNodes.length === 0 && immediateImages.length > 0) {
          const revealSet = new Set(immediateImages.map((img) => img.id));
          const sceneElements = excalidrawAPI.getSceneElements();
          const nextElements = sceneElements.map((el) => {
            if (revealSet.has(el.id)) {
              return {
                ...el,
                opacity: 100,
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

  // Compute viewport position of selected mindnode for floating handle button overlays in 4 directions
  const getSelectedNodeOverlayCoords = () => {
    if (!selectedMindNode || !excalidrawAPI) return null;
    const appState = excalidrawAPI.getAppState();
    const zoom = appState.zoom.value;

    const screenX = (selectedMindNode.x + appState.scrollX) * zoom + appState.offsetLeft;
    const screenY = (selectedMindNode.y + appState.scrollY) * zoom + appState.offsetTop;
    const screenW = selectedMindNode.width * zoom;
    const screenH = selectedMindNode.height * zoom;

    return {
      // Right handle (→)
      rightX: screenX + screenW + 8,
      rightY: screenY + screenH / 2 - 14,
      // Left handle (←)
      leftX: screenX - 36,
      leftY: screenY + screenH / 2 - 14,
      // Top handle (↑)
      topX: screenX + screenW / 2 - 14,
      topY: screenY - 36,
      // Bottom handle (↓)
      bottomX: screenX + screenW / 2 - 14,
      bottomY: screenY + screenH + 8,
      // Collapse / Expand toggle handle at far right of child handle
      collapseX: screenX + screenW + 42,
      collapseY: screenY + screenH / 2 - 14,
      // Image anchor handle (📷) at top right corner
      topRightX: screenX + screenW + 8,
      topRightY: screenY - 14,
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
      </div>

      {/* Floating Interactive 4-Directional Node Handles */}
      {selectedMindNode && overlayCoords && (
        <div className="mindnode-floating-overlay">
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

          {/* Image Anchor Handle (📷) */}
          <button
            className="mindnode-handle-btn image-anchor"
            style={{
              left: `${overlayCoords.topRightX}px`,
              top: `${overlayCoords.topRightY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerImageAnchor();
            }}
            title="Anchor Multiple Images to this Node"
          >
            📷
          </button>

          {/* Collapse / Expand Subtree Toggle Button */}
          {canCollapse && (
            <button
              className={`mindnode-handle-btn collapse-toggle ${isCollapsed ? "is-collapsed" : ""}`}
              style={{
                left: `${overlayCoords.collapseX}px`,
                top: `${overlayCoords.collapseY}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCollapse(selectedMindNode);
              }}
              title={
                isCollapsed
                  ? "Expand Subtree (Sequential Reveal)"
                  : "Collapse Subtree & Anchored Images"
              }
            >
              {isCollapsed ? "▶" : "▼"}
            </button>
          )}
        </div>
      )}
    </>
  );
};

