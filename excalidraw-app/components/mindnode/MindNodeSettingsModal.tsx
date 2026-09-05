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
  const [themesList, setThemesList] = useState<MindNodeTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>(activeThemeId);
  const [themeName, setThemeName] = useState<string>("");
  const [customBg, setCustomBg] = useState<string>("#bbf7d0");
  const [customStroke, setCustomStroke] = useState<string>("#bbf7d0");
  const [customText, setCustomText] = useState<string>("#14532d");
  const [fontSize, setFontSize] = useState<number>(15);
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
            <label className="section-label">📐 Layout Style (Per Mind Map)</label>
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
                <label>Palette Name:</label>
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="Palette Name"
                  className="theme-name-input"
                />
              </div>

              <div className="custom-color-pickers">
                <div className="color-field">
                  <span>Fill:</span>
                  <input
                    type="color"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                  />
                  <input
                    type="text"
                    value={customBg}
                    className="hex-input"
                    onChange={(e) => setCustomBg(e.target.value)}
                  />
                </div>

                <div className="color-field">
                  <span>Border & Branch:</span>
                  <input
                    type="color"
                    value={customStroke}
                    onChange={(e) => setCustomStroke(e.target.value)}
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
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                  <input
                    type="text"
                    value={customText}
                    className="hex-input"
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                </div>
              </div>

              <div className="editor-actions-row">
                <button className="btn-save-preset" onClick={handleSaveCurrentTheme}>
                  💾 Save Palette ({themeName})
                </button>
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
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleApply}>
            ⚡ Apply to Selected Mind Map
          </button>
        </div>
      </div>
    </div>
  );
};
