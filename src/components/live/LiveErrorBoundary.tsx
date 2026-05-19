import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class LiveErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Live session component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mt-4 text-sm">
          <p className="font-semibold mb-1">Session Component Error</p>
          <p className="text-xs opacity-80">{
            // @ts-ignore
            this.props.fallbackMessage || 'An unexpected error occurred in the live view.'}</p>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
