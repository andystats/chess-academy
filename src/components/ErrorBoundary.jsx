import { Component } from 'react';

// React only exposes render-error recovery through a class component. Catches anything the tree
// below throws (e.g. a WebGL failure in a decorative scene) and degrades to a reload prompt
// instead of unmounting the whole app to a blank page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-6xl" aria-hidden>
          ♚
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-gray-600">Reloading usually fixes it — your progress is saved on this device.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex min-h-touch items-center rounded-2xl bg-brand-500 px-6 font-semibold text-white hover:bg-brand-600"
        >
          Reload
        </button>
      </div>
    );
  }
}
