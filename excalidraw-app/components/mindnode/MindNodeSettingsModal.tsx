import React, { useState, useEffect } from "react";
import {
  MINDNODE_THEMES,
  type MindNodeTheme,
  type MindNodeGlobalStyles,
  getSavedCustomTheme,
  saveCustomTheme,
  getSavedGlobalStyles,
  saveGlobalStyles,
} from "./mindNodeThemes";
import "./MindNodeSettingsModal.scss";

interface MindNodeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onApplyGlobalStyles: (styles: MindNodeGlobalStyles) => void;
  currentLayoutMode: "organic" | "threaded";
  onChangeLayoutMode: (mode: "organic" | "threaded") => void;
}

export const MindNodeSettingsModal: React.FC<MindNodeSettingsModalProps> = ({
  isOpen,
  onClose,
  activeThemeId,
  onSelectTheme,
  onApplyGlobalStyles,
  currentLayoutMode,
  onChangeLayoutMode,
}) => {
  const [selectedThemeId, setSelectedThemeId] = useState<string>(activeThemeId);
  const [customBg, setCustomBg] = useState<string>("#bbf7d0");
  const [customStroke, setCustomStroke] = useState<string>("#bbf7d0");
  const [customText, setCustomText] = useState<string>("#14532d");
  const [fontSize, setFontSize] = useState<number>(15);
  const [roughness, setRoughness] = useState<number>(0);
  const [roundness, setRoundness] = useState<number>(3);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [opacity, setOpacity] = useState<number>(100);
  const [layoutMode, setLayoutMode] = useState<"organic" | "threaded">(currentLayoutMode);

  useEffect(() => {
    setSelectedThemeId(activeThemeId);
    setLayoutMode(currentLayoutMode);
    const saved = getSavedCustomTheme();
    if (saved) {
      setCustomBg(saved.bg);
      setCustomStroke(saved.stroke);
      setCustomText(saved.text);
    }
    const savedStyles = getSavedGlobalStyles();
    if (savedStyles.fontSize) setFontSize(savedStyles.fontSize);
    if (savedStyles.roughness !== undefined) setRoughness(savedStyles.roughness);
    if (savedStyles.roundness !== undefined) setRoundness(savedStyles.roundness);
    if (savedStyles.textAlign) setTextAlign(savedStyles.textAlign);
    if (savedStyles.opacity !== undefined) setOpacity(savedStyles.opacity);
  }, [isOpen, activeThemeId, currentLayoutMode]);

  if (!isOpen) return null;

  const handleSaveAsDefaultTheme = () => {
    const customTheme: MindNodeTheme = {
      id: "custom",
      name: "Custom Theme",
      bg: customBg,
      stroke: customStroke,
      text: customText,
      badgeBg: customStroke,
      badgeText: customText,
    };
    saveCustomTheme(customTheme);
    saveGlobalStyles({
      themeId: selectedThemeId,
      customTheme,
      fontSize,
      roughness,
      roundness,
      textAlign,
      opacity,
      layoutMode,
    });
    alert("Saved as default MindMap theme & settings!");
  };

  const handleApply = () => {
    const customTheme: MindNodeTheme | undefined =
      selectedThemeId === "custom"
        ? {
            id: "custom",
            name: "Custom Theme",
            bg: customBg,
            stroke: customStroke,
            text: customText,
            badgeBg: customStroke,
            badgeText: customText,
          }
        : undefined;

    const styles: MindNodeGlobalStyles = {
      themeId: selectedThemeId,
      customTheme,
      fontSize,
      roughness,
      roundness,
      textAlign,
      opacity,
      layoutMode,
    };

    if (layoutMode !== currentLayoutMode) {
      onChangeLayoutMode(layoutMode);
    }

    onApplyGlobalStyles(styles);
    onClose();
  };

  return (
    <div className="mindnode-modal-backdrop" onClick={onClose}>
      <div className="mindnode-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mindnode-modal-header">
          <div className="header-title">
            <span className="icon">⚙️</span>
            <h3>MindMap Global Styles & Layout</h3>
          </div>
          <button className="close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="mindnode-modal-body">
          {/* Section: Layout Mode */}
          <div className="setting-section">
            <label className="section-label">📐 Branching Layout Style</label>
            <div className="segmented-control">
              <button
                className={`segment-btn ${layoutMode === "organic" ? "active" : ""}`}
                onClick={() => setLayoutMode("organic")}
              >
                🌿 Organic (4-Directional Bézier)
              </button>
              <button
                className={`segment-btn ${layoutMode === "threaded" ? "active" : ""}`}
                onClick={() => setLayoutMode("threaded")}
              >
                🧵 Threaded (YouTube Comment / Outline)
              </button>
            </div>
          </div>

          {/* Section: Color Palettes */}
          <div className="setting-section">
            <label className="section-label">🎨 Color Theme Preset</label>
            <div className="theme-palette-grid">
              {MINDNODE_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-chip ${selectedThemeId === theme.id ? "selected" : ""}`}
                  style={{ backgroundColor: theme.bg, borderColor: theme.stroke, color: theme.text }}
                  onClick={() => {
                    setSelectedThemeId(theme.id);
                    onSelectTheme(theme.id);
                    setCustomBg(theme.bg);
                    setCustomStroke(theme.stroke);
                    setCustomText(theme.text);
                  }}
                >
                  {theme.name}
                </button>
              ))}
              <button
                className={`theme-chip custom-chip ${selectedThemeId === "custom" ? "selected" : ""}`}
                style={{ backgroundColor: customBg, borderColor: customStroke, color: customText }}
                onClick={() => setSelectedThemeId("custom")}
              >
                ✨ Custom
              </button>
            </div>

            {/* Custom Color Pickers */}
            <div className="custom-color-pickers">
              <div className="color-field">
                <span>Fill:</span>
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => {
                    setCustomBg(e.target.value);
                    setSelectedThemeId("custom");
                  }}
                />
                <input
                  type="text"
                  value={customBg}
                  className="hex-input"
                  onChange={(e) => setCustomBg(e.target.value)}
                />
              </div>

              <div className="color-field">
                <span>Border/Branch:</span>
                <input
                  type="color"
                  value={customStroke}
                  onChange={(e) => {
                    setCustomStroke(e.target.value);
                    setSelectedThemeId("custom");
                  }}
                />
                <input
                  type="text"
                  value={customStroke}
                  className="hex-input"
                  onChange={(e) => setCustomStroke(e.target.value)}
                />
              </div>

              <div className="color-field">
                <span>Text:</span>
                <input
                  type="color"
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value);
                    setSelectedThemeId("custom");
                  }}
                />
                <input
                  type="text"
                  value={customText}
                  className="hex-input"
                  onChange={(e) => setCustomText(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Font Size & Text Align */}
          <div className="setting-grid-2col">
            <div className="setting-section">
              <label className="section-label">🔤 Font Size</label>
              <div className="button-group">
                {[
                  { label: "S (14px)", val: 14 },
                  { label: "M (16px)", val: 16 },
                  { label: "L (20px)", val: 20 },
                  { label: "XL (24px)", val: 24 },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`btn-toggle ${fontSize === item.val ? "active" : ""}`}
                    onClick={() => setFontSize(item.val)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-section">
              <label className="section-label">↔️ Text Alignment</label>
              <div className="button-group">
                {[
                  { label: "⬅️ Left", val: "left" as const },
                  { label: "⏺️ Center", val: "center" as const },
                  { label: "➡️ Right", val: "right" as const },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`btn-toggle ${textAlign === item.val ? "active" : ""}`}
                    onClick={() => setTextAlign(item.val)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Sloppiness (Roughness) & Edges (Roundness) */}
          <div className="setting-grid-2col">
            <div className="setting-section">
              <label className="section-label">〰️ Sloppiness (Roughness)</label>
              <div className="button-group">
                {[
                  { label: "Architect (0)", val: 0 },
                  { label: "Artist (1)", val: 1 },
                  { label: "Cartoonist (2)", val: 2 },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`btn-toggle ${roughness === item.val ? "active" : ""}`}
                    onClick={() => setRoughness(item.val)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-section">
              <label className="section-label">🔲 Edges / Roundness</label>
              <div className="button-group">
                {[
                  { label: "Sharp", val: 1 },
                  { label: "Rounded", val: 2 },
                  { label: "Pill (Full)", val: 3 },
                ].map((item) => (
                  <button
                    key={item.val}
                    className={`btn-toggle ${roundness === item.val ? "active" : ""}`}
                    onClick={() => setRoundness(item.val)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Opacity */}
          <div className="setting-section">
            <div className="section-label-row">
              <label className="section-label">👁️ Opacity</label>
              <span className="value-badge">{opacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="opacity-slider"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mindnode-modal-footer">
          <button className="btn-secondary" onClick={handleSaveAsDefaultTheme}>
            💾 Save as Default
          </button>
          <div className="footer-right">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleApply}>
              ⚡ Apply to Entire Mind Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
