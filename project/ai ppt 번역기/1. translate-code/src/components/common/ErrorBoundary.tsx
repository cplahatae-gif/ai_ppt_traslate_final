import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - 전역 오류 처리 컴포넌트
 * 
 * React 컴포넌트 트리에서 발생하는 JavaScript 오류를 캡처하고
 * 사용자 친화적인 오류 화면을 표시합니다.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });

        // 오류 로깅 서비스에 보고 (예: Sentry, LogRocket 등)
        // 현재는 콘솔에만 기록
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-white flex items-center justify-center p-8">
                    <div className="max-w-md w-full text-center">
                        {/* Icon */}
                        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-2xl flex items-center justify-center border-2 border-red-200">
                            <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-black text-black mb-2">
                            문제가 발생했습니다
                        </h1>
                        <p className="text-gray-500 mb-6 text-sm">
                            예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
                        </p>

                        {/* Error Details (Development) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-left">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">오류 상세</p>
                                <pre className="text-xs text-red-600 overflow-auto max-h-32 font-mono">
                                    {this.state.error.message}
                                </pre>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                                            스택 트레이스 보기
                                        </summary>
                                        <pre className="text-[10px] text-gray-500 overflow-auto max-h-40 mt-2 font-mono">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-black text-sm font-bold rounded-lg transition-colors border border-gray-200"
                            >
                                다시 시도
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                페이지 새로고침
                            </button>
                        </div>

                        {/* Support */}
                        <p className="mt-8 text-xs text-gray-400">
                            문제가 계속되면 관리자에게 문의하세요.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
