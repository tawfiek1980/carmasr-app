import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-red-500 text-2xl font-bold">!</span>
        </div>
        <h2 className="text-xl font-bold text-text mb-2">عذراً، حدث خطأ غير متوقع</h2>
        <p className="text-text-light text-sm mb-6 max-w-md">
          يرجى تحديث الصفحة أو المحاولة مرة أخرى
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors"
        >
          تحديث الصفحة
        </button>
      </div>
    );
  }
}
