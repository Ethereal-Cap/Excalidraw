import React from "react";
import clsx from "clsx";

interface SavedCustomColorsProps {
  colors: string[];
  activeSlot: number;
  setActiveSlot: (index: number) => void;
  color: string | null;
  onChange: (color: string) => void;
}

export const SavedCustomColors = ({
  colors,
  activeSlot,
  setActiveSlot,
  color,
  onChange,
}: SavedCustomColorsProps) => {
  return (
    <div className="saved-custom-colors">
      <div className="color-picker__heading" style={{ marginBottom: "0.25rem" }}>
        Saved Colors
      </div>
      <div className="saved-custom-colors-grid">
        {colors.map((c, i) => {
          const isSelected = activeSlot === i;
          return (
            <button
              key={i}
              tabIndex={-1}
              type="button"
              className={clsx(
                "color-picker__button color-picker__button--large has-outline saved-color-slot",
                {
                  "active-slot": isSelected,
                  "is-transparent": c === "transparent" || !c,
                }
              )}
              onClick={() => {
                setActiveSlot(i);
                if (c && c !== "transparent") {
                  onChange(c);
                }
              }}
              title={c || "Empty Slot"}
              style={c && c !== "transparent" ? { "--swatch-color": c } : undefined}
            >
              <div className="color-picker__button-outline" />
              {isSelected && <div className="active-slot-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
