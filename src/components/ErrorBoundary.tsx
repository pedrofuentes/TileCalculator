import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary so a render-time throw (e.g. a malformed imported
 * project reaching computeProject) degrades to a recoverable message instead of
 * a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in deck app:', error, info);
  }

  private handleReset = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex h-full min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-lg font-semibold text-red-700">Something went wrong</h1>
            <p className="mb-3 text-sm text-slate-600">
              The deck couldn&apos;t be rendered. This usually means a loaded or imported project
              file is incomplete or in an unexpected format.
            </p>
            <pre className="mb-4 max-h-32 overflow-auto rounded bg-slate-100 p-2 text-xs text-slate-500">
              {error.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => this.setState({ error: null })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Try again
              </button>
              <button
                onClick={this.handleReset}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
