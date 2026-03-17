import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  componentDidCatch(error: Error) {
    console.error("APP CRASH:", error.message, error.stack);
    this.setState({ error: error.message });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: 20, color: 'red', background: 'white', fontSize: 14}}>
          <b>App Error:</b><br/>{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

// Initialize GoogleAuth for web/native (required for web; safe on native)
try {
  const clientId = (import.meta as any).env?.VITE_GOOGLE_WEB_CLIENT_ID;
  if (clientId) {
    GoogleAuth.initialize({
      clientId,
      scopes: ["profile", "email"],
      grantOfflineAccess: false,
    });
  } else {
    if (Capacitor.getPlatform() === "web") {
      console.warn("VITE_GOOGLE_WEB_CLIENT_ID is not set; Google login may not work on web.");
    }
  }
} catch (e) {
  console.warn("GoogleAuth init skipped:", e);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);