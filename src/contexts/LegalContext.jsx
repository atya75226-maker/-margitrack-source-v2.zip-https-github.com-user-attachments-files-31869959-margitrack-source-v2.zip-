import React, { createContext, useContext, useState } from "react";

const LegalContext = createContext(null);

export function LegalProvider({ children }) {
  const [page, setPage] = useState(null); // null | "privacy" | "terms"
  const value = {
    page,
    openPrivacy: () => setPage("privacy"),
    openTerms: () => setPage("terms"),
    close: () => setPage(null),
  };
  return <LegalContext.Provider value={value}>{children}</LegalContext.Provider>;
}

export function useLegal() {
  const ctx = useContext(LegalContext);
  if (!ctx) throw new Error("useLegal() doit être utilisé à l'intérieur de <LegalProvider>");
  return ctx;
}
