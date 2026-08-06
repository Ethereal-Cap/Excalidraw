import React, { useRef, useEffect, useState } from "react";
import clsx from "clsx";
import { useAtom } from "../../editor-jotai";
import { activeEyeDropperAtom } from "../EyeDropper";
import { eyeDropperIcon } from "../icons";
import { useEditorInterface } from "../App";
import { KEYS } from "@excalidraw/common";
import { getShortcutKey } from "../../shortcut";
import { t } from "../../i18n";

interface TradingViewPickerProps {
  color: string | null;
  onChange: (color: string) => void;
  onAddColor: (color: string) => void;
  colorPickerType: any;
}

// Color Conversion Helpers
const hexToHsv = (hex: string) => {
  let r = 0, g = 0, b = 0;
  const cleanHex = hex.replace(/^#/, "");
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
};

const hsvToHex = (h: number, s: number, v: number) => {
  h /= 360;
  s /= 100;
  v /= 100;

  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v; g = t; b = p;
      break;
    case 1:
      r = q; g = v; b = p;
      break;
    case 2:
      r = p; g = v; b = t;
      break;
    case 3:
      r = p; g = q; b = v;
      break;
    case 4:
      r = t; g = p; b = v;
      break;
    case 5:
      r = v; g = p; b = q;
      break;
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const TradingViewPicker = ({
  color,
  onChange,
  onAddColor,
  colorPickerType,
}: TradingViewPickerProps) => {
  const editorInterface = useEditorInterface();
  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  const hexColor = color && color.startsWith("#") ? color : "#ffffff";
  const [hsv, setHsv] = useState(() => hexToHsv(hexColor));
  const [inputValue, setInputValue] = useState(hexColor);

  useEffect(() => {
    if (color && color.startsWith("#") && color.toLowerCase() !== inputValue.toLowerCase()) {
      setHsv(hexToHsv(color));
      setInputValue(color);
    }
  }, [color, inputValue]);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const handleSvPointer = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);

    setHsv((prev) => {
      const next = { ...prev, s, v };
      const newHex = hsvToHex(next.h, next.s, next.v);
      setInputValue(newHex);
      onChange(newHex);
      return next;
    });
  };

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const h = Math.round((y / rect.height) * 360);

    setHsv((prev) => {
      const next = { ...prev, h };
      const newHex = hsvToHex(next.h, next.s, next.v);
      setInputValue(newHex);
      onChange(newHex);
      return next;
    });
  };

  const setupDrag = (
    onMove: (e: PointerEvent) => void
  ) => {
    const handlePointerMove = (moveEvent: PointerEvent) => {
      onMove(moveEvent);
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div className="tradingview-picker">
      <div className="tv-picker-top">
        <div className="tv-picker-preview-row">
          <div
            className="tv-picker-preview-box"
            style={{ backgroundColor: inputValue }}
          />
          <input
            type="text"
            className="tv-picker-hex-input"
            value={inputValue}
            onChange={(e) => {
              let val = e.target.value.trim();
              if (val && !val.startsWith("#") && !val.startsWith("transparent")) {
                val = "#" + val;
              }
              setInputValue(val);
              if (/^#[0-9A-F]{6}$/i.test(val)) {
                onChange(val);
                setHsv(hexToHsv(val));
              } else if (val === "transparent") {
                onChange(val);
              }
            }}
          />
          {editorInterface.formFactor !== "phone" && (
            <div
              className={clsx("excalidraw-eye-dropper-trigger tv-eyedropper-btn", {
                selected: eyeDropperState,
              })}
              onClick={() =>
                setEyeDropperState((s) =>
                  s
                    ? null
                    : {
                        keepOpenOnAlt: false,
                        onSelect: (color) => onChange(color),
                        colorPickerType,
                      },
                )
              }
              title={`${t(
                "labels.eyeDropper",
              )} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")} `}
            >
              {eyeDropperIcon}
            </div>
          )}
          <button
            type="button"
            className="tv-picker-add-btn"
            onClick={() => onAddColor(inputValue)}
          >
            Add
          </button>
        </div>
      </div>

      <div className="tv-picker-middle">
        <div
          ref={svRef}
          className="tv-picker-sv-box"
          style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
          onPointerDown={(e) => {
            handleSvPointer(e);
            setupDrag(handleSvPointer);
          }}
        >
          <div className="tv-picker-sv-white">
            <div className="tv-picker-sv-black">
              <div
                className="tv-picker-cursor"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div
          ref={hueRef}
          className="tv-picker-hue-slider"
          onPointerDown={(e) => {
            handleHuePointer(e);
            setupDrag(handleHuePointer);
          }}
        >
          <div
            className="tv-picker-hue-cursor"
            style={{
              top: `${(hsv.h / 360) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
