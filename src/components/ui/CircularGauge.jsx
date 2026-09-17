import React from "react";
import { usePreferences } from "../../contexts/PreferencesContext";

const NEGATIVE = "#F43F5E";

// Indicateur circulaire. `value` est un ratio — 0,25 pour 25 % — ou null
// quand la donnée n'existe pas encore : on affiche alors un état vide plutôt
// qu'un pourcentage inventé.
//
// Le pourcentage affiché est toujours le vrai : une marge negative se lit
// « -104 % » en rouge, et des depenses superieures au chiffre d'affaires
// « 140 % ». Seul l'arc est borne au tour complet, faute de place pour
// dessiner davantage. Arrondir ces valeurs a 0 ou a 100 % revenait a cacher
// exactement ce qu'il fallait voir.
export function CircularGauge({ value, label, caption, color = "#7C5CFF", size = 92 }) {
  const { palette } = usePreferences();

  const hasValue = typeof value === "number" && Number.isFinite(value);
  const negative = hasValue && value < 0;
  const ratio = hasValue ? Math.min(Math.abs(value), 1) : 0;

  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={palette.elevated}
            strokeWidth={stroke}
          />
          {hasValue && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={negative ? NEGATIVE : color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              style={{ transition: "stroke-dasharray 600ms ease" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hasValue ? (
            <span
              className="text-lg font-bold font-display"
              style={{ color: negative ? NEGATIVE : palette.ink }}
            >
              {Math.round(value * 100)}%
            </span>
          ) : (
            <span className="text-xs" style={{ color: palette.muted }}>
              —
            </span>
          )}
        </div>
      </div>
      <p className="text-xs font-medium text-center" style={{ color: palette.ink }}>
        {label}
      </p>
      {caption && (
        <p className="text-[11px] text-center leading-tight" style={{ color: palette.muted }}>
          {caption}
        </p>
      )}
    </div>
  );
}
