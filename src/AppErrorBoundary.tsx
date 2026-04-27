import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled frontend error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0B] text-slate-200 flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border border-red-600/20 bg-[#141417] p-8 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-red-400 mb-3">
              Application Error
            </div>
            <h1 className="text-2xl font-black uppercase italic text-white mb-3">CrisisConnect</h1>
            <p className="text-sm text-slate-400 leading-6">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-red-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
