import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  fallback: ReactNode | ((reset: () => void) => ReactNode);
  children: ReactNode;
}

/** Keeps one broken part (say, the map when Google Maps can't load) from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Kintsugi caught an error", error, info.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(this.reset) : fallback;
  }
}
