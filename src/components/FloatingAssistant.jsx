import React, { useState } from "react";
import { AdvisorPage } from "./AdvisorPage";
import { usePreferences } from "../contexts/PreferencesContext";

export function FloatingAssistant({ restaurantId }) {
  const { palette, t } = usePreferences();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 z-20 flex items-center gap-2 rounded-full bg-[#7C5CFF] text-white shadow-lg px-4 py-3 text-sm font-semibold active:scale-95 transition" aria-label="Ouvrir l'assistant Margitrack">
        ✨ Assistant
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center sm:justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl h-[85vh] max-h-[85vh] p-4 flex flex-col" style={{ backgroundColor: palette.bg }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: palette.ink }}>✨ {t("assistant_title")}</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-xl leading-none px-2">×</button>
            </div>
            <div className="flex-1 min-h-0">
              <AdvisorPage restaurantId={restaurantId} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
