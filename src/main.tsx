import React, { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error?: Error; info?: ErrorInfo };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center px-6">
          <div className="max-w-xl rounded-lg border bg-background p-6 shadow-sm space-y-3">
            <h1 className="text-xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an error and stopped rendering. Check the console for details.
            </p>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
              {this.state.error?.message}
              {"\n"}
              {this.state.info?.componentStack}
            </pre>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => {
                  console.clear();
                  console.error(this.state.error, this.state.info);
                  alert("Errors logged to console.");
                }}
              >
                Log to console
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
