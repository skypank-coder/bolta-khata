import { Component, type ReactNode } from 'react';

/** If anything ever breaks, show a way back instead of a blank page. The khata itself is safe on the phone. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="cloth grid min-h-screen place-items-center p-6 text-center text-patra" role="alert">
        <div className="max-w-md">
          <p className="font-display text-4xl">बोलता खाता</p>
          <p className="mt-4 text-xl">कुछ गड़बड़ हुई। आपका खाता फ़ोन पर सुरक्षित है।</p>
          <p className="mt-1 text-patra/80">Something went wrong. Your ledger is safe on this phone.</p>
          <button
            type="button"
            onClick={() => { window.location.hash = '#/'; window.location.reload(); }}
            className="mt-6 min-h-[52px] rounded-xl bg-haldi px-6 font-display text-xl text-bahi-dark"
          >
            फिर से खोलिए / Reload
          </button>
        </div>
      </div>
    );
  }
}
