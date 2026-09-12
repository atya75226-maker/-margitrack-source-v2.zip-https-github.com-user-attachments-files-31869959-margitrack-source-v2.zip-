import { COLOR } from "../lib/theme";
import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Margitrack — erreur capturée par ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLOR.paper }}>
          <div className="w-full max-w-sm rounded-3xl p-7 bg-[#111827] text-center" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
            <p className="font-semibold mb-2" style={{ color: COLOR.ink }}>Une erreur est survenue</p>
            <p className="text-sm mb-6" style={{ color: COLOR.muted }}>{this.state.error.message || "Erreur inconnue."}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="w-full rounded-full py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: COLOR.violet }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
