import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);