import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/element/types";
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
} from "./mindNodeEngine";
import "./MindNodeManager.scss";

interface MindNodeManagerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export const MindNodeManager: React.FC<MindNodeManagerProps> = ({ excalidrawAPI }) => {
  const [selectedMindNode, setSelectedMindNode] = useState<ExcalidrawElement | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string>("mint");
  const [isMindNodeModeActive, setIsMindNodeModeActive] = useState<boolean>(false);

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
        centerX - 80,
        centerY - 24,
        "Central Topic",
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

  // Add Child Node
  const handleAddChildNode = useCallback(
    (parentNode: ExcalidrawElement) => {
      if (!excalidrawAPI) return;

      const elements = excalidrawAPI.getSceneElements();
      const parentThemeId = parentNode.customData?.themeId || activeThemeId;
      const parentTheme =
        MINDNODE_THEMES.find((t) => t.id === parentThemeId) || MINDNODE_THEMES[0];

      // Existing children to determine vertical placement and child index
      const existingChildren = elements.filter(
        (el) =>
          !el.isDeleted &&
          el.customData?.isMindNode &&
          el.customData?.parentId === parentNode.id,
      );

      const childIndex = existingChildren.length + 1;
      const childX =
        parentNode.x + parentNode.width + MINDNODE_CONSTANTS.HORIZONTAL_SPACING;
      const childY =
        parentNode.y +
        (childIndex - 1) * (MINDNODE_CONSTANTS.MIN_NODE_HEIGHT + MINDNODE_CONSTANTS.VERTICAL_SPACING);

      const { rect: childRect, text: childText } = createMindNodeElement(
        childX,
        childY,
        `Subtopic ${childIndex}`,
        parentThemeId,
        "child",
        parentNode.id,
        childIndex,
      );

      const branch = createMindNodeBranch(parentNode, childRect, parentTheme.stroke);

      // Re-layout parent and all siblings
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
            const startX = parentNode.x + parentNode.width;
            const startY = parentNode.y + parentNode.height / 2;
            const endX = child.x;
            const endY = child.y + child.height / 2;
            const points = calculateOrganicBranchPoints(startX, startY, endX, endY);
            return {
              ...el,
              x: startX,
              y: startY,
              width: Math.abs(endX - startX),
              height: Math.abs(endY - startY),
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
              x: container.x + 10,
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

  // Add Sibling Node
  const handleAddSiblingNode = useCallback(
    (currentNode: ExcalidrawElement) => {
      if (!excalidrawAPI) return;
      const parentId = currentNode.customData?.parentId;
      const elements = excalidrawAPI.getSceneElements();

      if (parentId) {
        const parentNode = elements.find((e) => e.id === parentId);
        if (parentNode) {
          handleAddChildNode(parentNode);
          return;
        }
      }

      // If current is root, spawn a new sibling root node
      const { rect, text } = createMindNodeElement(
        currentNode.x,
        currentNode.y + currentNode.height + 60,
        "New Idea",
        activeThemeId,
        "root",
        null,
      );

      excalidrawAPI.updateScene({
        elements: [...elements, rect, text],
        appState: {
          selectedElementIds: { [rect.id]: true },
        },
      });
    },
    [excalidrawAPI, handleAddChildNode, activeThemeId],
  );

  // Keyboard navigation hook for Tab (child) and Enter (sibling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMindNode || !excalidrawAPI) return;

      // Don't intercept if user is currently inside a native textarea/input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "textarea" || activeTag === "input") return;

      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        handleAddChildNode(selectedMindNode);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleAddSiblingNode(selectedMindNode);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [selectedMindNode, excalidrawAPI, handleAddChildNode, handleAddSiblingNode]);

  // Compute viewport position of selected mindnode for floating (+) button overlay
  const getSelectedNodeOverlayCoords = () => {
    if (!selectedMindNode || !excalidrawAPI) return null;
    const appState = excalidrawAPI.getAppState();
    const zoom = appState.zoom.value;

    const screenX = (selectedMindNode.x + appState.scrollX) * zoom + appState.offsetLeft;
    const screenY = (selectedMindNode.y + appState.scrollY) * zoom + appState.offsetTop;
    const screenW = selectedMindNode.width * zoom;
    const screenH = selectedMindNode.height * zoom;

    return {
      rightX: screenX + screenW + 8,
      centerY: screenY + screenH / 2 - 12,
      bottomX: screenX + screenW / 2 - 12,
      bottomY: screenY + screenH + 8,
    };
  };

  const overlayCoords = getSelectedNodeOverlayCoords();

  return (
    <>
      {/* MindNode Floating Control Pill on Toolbar */}
      <div className="mindnode-toolbar-badge" title="MindNode Mind Mapping">
        <button
          className={`mindnode-btn-mode ${isMindNodeModeActive ? "active" : ""}`}
          onClick={() => {
            setIsMindNodeModeActive(!isMindNodeModeActive);
            handleAddRootNode();
          }}
          title="Create MindNode Mind Map (Click or Tab/Enter)"
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

      {/* Floating Interactive (+) Node Handles */}
      {selectedMindNode && overlayCoords && (
        <div className="mindnode-floating-overlay">
          {/* Add Child Handle (+) */}
          <button
            className="mindnode-plus-btn child"
            style={{
              left: `${overlayCoords.rightX}px`,
              top: `${overlayCoords.centerY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddChildNode(selectedMindNode);
            }}
            title="Add Child Node (Tab)"
          >
            +
          </button>

          {/* Add Sibling Handle (+) */}
          <button
            className="mindnode-plus-btn sibling"
            style={{
              left: `${overlayCoords.bottomX}px`,
              top: `${overlayCoords.bottomY}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddSiblingNode(selectedMindNode);
            }}
            title="Add Sibling Node (Enter)"
          >
            +
          </button>
        </div>
      )}
    </>
  );
};
