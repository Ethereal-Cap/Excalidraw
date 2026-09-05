import { loginIcon, eyeIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import type { Theme } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";

import { saveDebugState } from "./DebugCanvas";

const githubIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const plusIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const brainIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
  </svg>
);

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = React.memo((props) => {
  const [mindNodeMode, setMindNodeMode] = React.useState<"creator" | "presenter">(() => {
    return (localStorage.getItem("mindnode_app_mode") as "creator" | "presenter") || "creator";
  });

  React.useEffect(() => {
    const handleModeChange = () => {
      const mode = (localStorage.getItem("mindnode_app_mode") as "creator" | "presenter") || "creator";
      setMindNodeMode(mode);
    };
    window.addEventListener("mindnode:mode-change", handleModeChange);
    window.addEventListener("storage", handleModeChange);
    return () => {
      window.removeEventListener("mindnode:mode-change", handleModeChange);
      window.removeEventListener("storage", handleModeChange);
    };
  }, []);

  const handleSetMode = (newMode: "creator" | "presenter") => {
    localStorage.setItem("mindnode_app_mode", newMode);
    setMindNodeMode(newMode);
    window.dispatchEvent(new CustomEvent("mindnode:mode-change", { detail: newMode }));
  };

  return (
    <MainMenu>
      <MainMenu.Item
        icon={plusIcon}
        onSelect={() => {
          const uniqueId = "canvas-" + Math.random().toString(36).substring(2, 9);
          window.location.hash = `id=${uniqueId}`;
        }}
      >
        New Canvas
      </MainMenu.Item>
      <MainMenu.ItemCustom className="mindnode-mode-toggle-container">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "4px 8px",
            userSelect: "none",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            <span style={{ fontSize: "16px" }}>
              {mindNodeMode === "creator" ? "🎨" : "📽️"}
            </span>
            <span>{mindNodeMode === "creator" ? "Creator Mode" : "Presenter Mode"}</span>
          </div>
          <div
            style={{
              display: "flex",
              background: "var(--color-surface-hover, rgba(0,0,0,0.06))",
              borderRadius: "8px",
              padding: "2px",
              gap: "2px",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSetMode("creator");
              }}
              style={{
                border: "none",
                background: mindNodeMode === "creator" ? "#4f46e5" : "transparent",
                color: mindNodeMode === "creator" ? "#ffffff" : "var(--color-on-surface, #64748b)",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Creator Mode: Full editing, top toolbar & node creation controls"
            >
              Creator
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSetMode("presenter");
              }}
              style={{
                border: "none",
                background: mindNodeMode === "presenter" ? "#4f46e5" : "transparent",
                color: mindNodeMode === "presenter" ? "#ffffff" : "var(--color-on-surface, #64748b)",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Presenter Mode: Minimalist canvas, hides top toolbar & plus buttons, keeps collapse/expand controls"
            >
              Presenter
            </button>
          </div>
        </div>
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.Item
        icon={githubIcon}
        onSelect={() => {
          if (props.excalidrawAPI) {
            props.excalidrawAPI.toggleSidebar({ name: "default", tab: "github" });
          }
        }}
      >
        GitHub Storage
      </MainMenu.Item>
      <MainMenu.ItemLink
        icon={loginIcon}
        href={`${import.meta.env.VITE_APP_PLUS_APP}${
          isExcalidrawPlusSignedUser ? "" : "/sign-up"
        }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
        className="highlighted"
      >
        {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
      </MainMenu.ItemLink>
      <MainMenu.Item
        icon={eyeIcon}
        onSelect={() => {
          if (window.visualDebug) {
            delete window.visualDebug;
            saveDebugState({ enabled: false });
          } else {
            window.visualDebug = { data: [] };
            saveDebugState({ enabled: true });
          }
          props?.refresh();
        }}
      >
        Visual Debug
      </MainMenu.Item>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
