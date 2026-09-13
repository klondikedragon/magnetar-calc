import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";

class ApplicationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  copyDetails = async () => {
    const { error } = this.state;
    const details = `Magnetar Calculator could not start.\n\n${error?.name ?? "Error"}: ${error?.message ?? "Unknown error"}${error?.stack ? `\n\n${error.stack}` : ""}`;
    try {
      await navigator.clipboard.writeText(details);
      this.setState({ copied: true });
    } catch {
      // Clipboard permission is optional; the visible details remain available.
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { error, copied } = this.state;
    return <main className="fatal-error-shell"><section className="fatal-error-card" role="alert">
      <p className="eyebrow">CALCULATOR ERROR</p>
      <h1>The calculator could not load this workspace.</h1>
      <p>Your saved data is still in this browser. Copy the details below if you want to diagnose or report the problem.</p>
      <details open><summary>Technical details</summary><pre>{`${error?.name ?? "Error"}: ${error?.message ?? "Unknown error"}${error?.stack ? `\n\n${error.stack}` : ""}`}</pre></details>
      <button onClick={this.copyDetails}>{copied ? "Copied details" : "Copy technical details"}</button>
    </section></main>;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ApplicationErrorBoundary><App /></ApplicationErrorBoundary>
  </React.StrictMode>,
);
