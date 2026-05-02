/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    // darkMode: 'class', // 다크모드 완전 제거
    theme: {
        extend: {
            colors: {
                // Main Colors (Flex Style: Minimalist)
                "primary": "#4f46e5", // Indigo (Accent)
                "primary-hover": "#4338ca",
                "black": "#111827", // Main Text & Strong Borders
                "gray-dark": "#374151", // Sub Text
                "gray-medium": "#9ca3af", // Disabled / Placeholder
                "gray-light": "#f3f4f6", // Subtle Backgrounds
                "white": "#ffffff", // Main Background
                "border-strong": "#111827", // Strong Black Border (Flex Vibe)
                "border-subtle": "#e5e7eb", // Divider
            },
            fontFamily: {
                "display": ["Pretendard", "Inter", "Noto Sans KR", "sans-serif"],
                "body": ["Pretendard", "Inter", "Noto Sans KR", "sans-serif"],
            },
            borderRadius: {
                "xl": "1rem", // Rounded corners
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.1)',
                'float': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            },
        },
    },
    plugins: [],
}
