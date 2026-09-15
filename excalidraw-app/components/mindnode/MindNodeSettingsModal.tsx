import React, { useState, useEffect } from "react";
import {
  type MindNodeTheme,
  type MindNodeGlobalStyles,
  getAllThemes,
  saveTheme,
  deleteTheme,
  resetAllThemesToDefault,
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
  onApplySubtreeStyles?: (styles: MindNodeGlobalStyles) => void;
  currentLayoutMode: "organic" | "threaded";
  onChangeLayoutMode: (mode: "organic" | "threaded") => void;
  hasSelectedNode?: boolean;
}

export const MindNodeSettingsModal: React.FC<MindNodeSettingsModalProps> = ({
  isOpen,
  onClose,
  activeThemeId,
  onSelectTheme,
  onApplyGlobalStyles,
  onApplySubtreeStyles,
  currentLayoutMode,
  onChangeLayoutMode,
  hasSelectedNode = false,
}) => {
  const [themesList, setThemesList] = useState<MindNodeTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>(activeThemeId);
  const [themeName, setThemeName] = useState<string>("");
  const [customBg, setCustomBg] = useState<string>("#bbf7d0");
  const [customStroke, setCustomStroke] = useState<string>("#bbf7d0");
  const [customText, setCustomText] = useState<string>("#14532d");
  const [fontSize, setFontSize] = useState<number>(15);
  const [fontFamily, setFontFamily] = useState<number>(5);
  const [roughness, setRoughness] = useState<number>(0);
  const [roundness, setRoundness] = useState<number>(3);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [opacity, setOpacity] = useState<number>(100);
  const [layoutMode, setLayoutMode] = useState<"organic" | "threaded">(currentLayoutMode);

  // Load themes & styles on open
  useEffect(() => {
    const all = getAllThemes();
    setThemesList(all);

    const currentTheme = all.find((t) => t.id === activeThemeId) || all[0];
    if (currentTheme) {
      setSelectedThemeId(currentTheme.id);
      setThemeName(currentTheme.name);
      setCustomBg(currentTheme.bg);
      setCustomStroke(currentTheme.stroke);
      setCustomText(currentTheme.text);
    }

    setLayoutMode(currentLayoutMode);

    const savedStyles = getSavedGlobalStyles();
    if (savedStyles.fontSize) setFontSize(savedStyles.fontSize);
    if (savedStyles.fontFamily) setFontFamily(savedStyles.fontFamily);
    if (savedStyles.roughness !== undefined) setRoughness(savedStyles.roughness);
    if (savedStyles.roundness !== undefined) setRoundness(savedStyles.roundness);
    if (savedStyles.textAlign) setTextAlign(savedStyles.textAlign);
    if (savedStyles.opacity !== undefined) setOpacity(savedStyles.opacity);
  }, [isOpen, activeThemeId, currentLayoutMode]);

  if (!isOpen) return null;

  const handleSelectThemeChip = (theme: MindNodeTheme) => {
    setSelectedThemeId(theme.id);
    setThemeName(theme.name);
    setCustomBg(theme.bg);
    setCustomStroke(theme.stroke);
    setCustomText(theme.text);
    onSelectTheme(theme.id);
  };

  const handleSaveCurrentTheme = () => {
    const updatedTheme: MindNodeTheme = {
      id: selectedThemeId,
      name: themeName || "Custom Palette",
      bg: customBg,
      stroke: customStroke,
      text: customText,
      badgeBg: customStroke,
      badgeText: customText,
      isCustom: !["mint", "cyan", "rose", "lavender", "amber", "coral"].includes(selectedThemeId),
    };
    const nextThemes = saveTheme(updatedTheme);
    setThemesList(nextThemes);
    onSelectTheme(updatedTheme.id);
    alert(`Saved changes to palette: "${updatedTheme.name}"!`);
  };

  const handleAddNewCustomTheme = () => {
    const newId = `theme_${Date.now()}`;
    const newTheme: MindNodeTheme = {
      id: newId,
      name: `Palette ${themesList.length + 1}`,
      bg: customBg,
      stroke: customStroke,
      text: customText,
      badgeBg: customStroke,
      badgeText: customText,
      isCustom: true,
    };
    const nextThemes = saveTheme(newTheme);
    setThemesList(nextThemes);
    setSelectedThemeId(newId);
    setThemeName(newTheme.name);
    onSelectTheme(newId);
  };

  const handleDeleteTheme = (idToDelete: string) => {
    if (["mint", "cyan", "rose", "lavender", "amber", "coral"].includes(idToDelete)) {
      alert("Base default themes cannot be deleted. You can edit their colors or reset them.");
      return;
    }
    const nextThemes = deleteTheme(idToDelete);
    setThemesList(nextThemes);
    const fallback = nextThemes[0];
    handleSelectThemeChip(fallback);
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all 6 default palettes to original pastel colors?")) {
      const resetThemes = resetAllThemesToDefault();
      setThemesList(resetThemes);
      handleSelectThemeChip(resetThemes[0]);
    }
  };

  const handleApply = () => {
    const currentTheme: MindNodeTheme = {
      id: selectedThemeId,
      name: themeName,
      bg: customBg,
      stroke: customStroke,
      text: customText,
      badgeBg: customStroke,
      badgeText: customText,
    };

    const styles: MindNodeGlobalStyles = {
      themeId: selectedThemeId,
      customTheme: currentTheme,
      fontSize,
      fontFamily,
      roughness,
      roundness,
      textAlign,
      opacity,
      layoutMode,
    };

    saveGlobalStyles(styles);

    if (layoutMode !== currentLayoutMode) {
      onChangeLayoutMode(layoutMode);
    }

    onApplyGlobalStyles(styles);
    onClose();
  };

  const handleApplySubtree = () => {
    const currentTheme: MindNodeTheme = {
      id: selectedThemeId,
      name: themeName,
      bg: customBg,
      stroke: customStroke,
      text: customText,
      badgeBg: customStroke,
      badgeText: customText,
    };

    const styles: MindNodeGlobalStyles = {
      themeId: selectedThemeId,
      customTheme: currentTheme,
      fontSize,
      fontFamily,
      roughness,
      roundness,
      textAlign,
      opacity,
      layoutMode,
    };

    if (onApplySubtreeStyles) {
      onApplySubtreeStyles(styles);
    }
    onClose();
  };

  const isBuiltInTheme = ["mint", "cyan", "rose", "lavender", "amber", "coral"].includes(selectedThemeId);

  return (
    <div className="mindnode-modal-backdrop" onClick={onClose}>
      <div className="mindnode-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mindnode-modal-header">
          <div className="header-title">
            <span className="icon">⚙️</span>
            <h3>MindMap Global Styles & Palette Customizer</h3>
          </div>
          <button className="close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="mindnode-modal-body">
          {/* Section: Layout Mode */}
          <div className="setting-section">
            <label className="section-label">📐 Layout Style (Per Mind Map / Branch)</label>
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

          {/* Section: Color Palettes & Preset Customizer */}
          <div className="setting-section">
            <div className="section-label-row">
              <label className="section-label">🎨 Color Palettes ({themesList.length})</label>
              <div className="palette-header-actions">
                <button className="text-btn" onClick={handleAddNewCustomTheme} title="Create New Palette">
                  ➕ Add Palette
                </button>
                <button className="text-btn danger" onClick={handleResetDefaults} title="Reset Default 6 Palettes">
                  🔄 Reset Defaults
                </button>
              </div>
            </div>

            <div className="theme-palette-grid">
              {themesList.map((theme) => (
                <div
                  key={theme.id}
                  className={`theme-chip-wrapper ${selectedThemeId === theme.id ? "selected" : ""}`}
                >
                  <button
                    className="theme-chip"
                    style={{ backgroundColor: theme.bg, borderColor: theme.stroke, color: theme.text }}
                    onClick={() => handleSelectThemeChip(theme)}
                  >
                    {theme.name}
                  </button>
                  {theme.isCustom && (
                    <button
                      className="delete-chip-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTheme(theme.id);
                      }}
                      title="Delete Palette"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Selected Theme Color Editor */}
            <div className="custom-color-editor-box">
              <div className="theme-name-row">
                <span>Palette Name:</span>
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  className="theme-name-input"
                  placeholder="e.g. Neon Horizon"
                />
                <button className="btn-save-theme" onClick={handleSaveCurrentTheme} title="Save Color Changes">
                  💾 Save Palette
                </button>
              </div>

              <div className="color-inputs-row">
                <div className="color-field">
                  <label>Background Fill</label>
                  <div className="picker-wrapper">
                    <input
                      type="color"
                      value={customBg}
                      onChange={(e) => setCustomBg(e.target.value)}
                      className="native-color-picker"
                    />
                    <input
                      type="text"
                      value={customBg}
                      onChange={(e) => setCustomBg(e.target.value)}
                      className="hex-input"
                    />
                  </div>
                </div>

                <div className="color-field">
                  <label>Border / Stroke</label>
                  <div className="picker-wrapper">
                    <input
                      type="color"
                      value={customStroke}
                      onChange={(e) => setCustomStroke(e.target.value)}
                      className="native-color-picker"
                    />
                    <input
                      type="text"
                      value={customStroke}
                      onChange={(e) => setCustomStroke(e.target.value)}
                      className="hex-input"
                    />
                  </div>
                </div>

                <div className="color-field">
                  <label>Text Color</label>
                  <div className="picker-wrapper">
                    <input
                      type="color"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="native-color-picker"
                    />
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="hex-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Typography & Styling */}
          <div className="setting-section">
            <label className="section-label">✍️ Typography</label>
            <div className="typography-row">
              <div className="setting-sub-group">
                <span className="sub-label">Font Family</span>
                <div className="button-group">
                  {[
                    { label: "Handwritten", val: 5 },
                    { label: "Normal", val: 6 },
                    { label: "Code", val: 8 },
                  ].map((f) => (
                    <button
                      key={f.val}
                      className={`btn-toggle ${fontFamily === f.val ? "active" : ""}`}
                      onClick={() => setFontFamily(f.val)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-sub-group">
                <span className="sub-label">Font Size</span>
                <div className="button-group">
                  {[14, 16, 18, 22].map((sz) => (
                    <button
                      key={sz}
                      className={`btn-toggle ${fontSize === sz ? "active" : ""}`}
                      onClick={() => setFontSize(sz)}
                    >
                      {sz}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-sub-group">
                <span className="sub-label">Text Alignment</span>
                <div className="button-group">
                  {(["left", "center", "right"] as const).map((al) => (
                    <button
                      key={al}
                      className={`btn-toggle ${textAlign === al ? "active" : ""}`}
                      onClick={() => setTextAlign(al)}
                    >
                      {al === "left" ? "⬅️" : al === "center" ? "↔️" : "➡️"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Roughness & Edges */}
          <div className="settings-split-row">
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
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          {hasSelectedNode && (
            <button
              className="btn-subtree"
              onClick={handleApplySubtree}
              title="Apply these colors & layout only to the selected node and all its child branches"
            >
              🌿 Apply to This Node & Sub-Children
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleApply}
            title="Apply these styles across the entire selected mind map from root to leaves"
          >
            ⚡ Apply to Selected Mind Map
          </button>
        </div>
      </div>
    </div>
  );
};
