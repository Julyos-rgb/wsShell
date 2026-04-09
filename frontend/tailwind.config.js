/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'primary': {
                    DEFAULT: '#818cf8',
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
                'surface': {
                    DEFAULT: '#1e1e2e',
                    50: '#313244',
                    100: '#282838',
                    200: '#232333',
                    300: '#1e1e2e',
                    400: '#181825',
                    500: '#11111b',
                },
                'accent': {
                    DEFAULT: '#94e2d5',
                    blue: '#89b4fa',
                    green: '#a6e3a1',
                    yellow: '#f9e2af',
                    red: '#f38ba8',
                    pink: '#f5c2e7',
                    mauve: '#cba6f7',
                    peach: '#fab387',
                    teal: '#94e2d5',
                    sky: '#89dceb',
                },
                'text': {
                    DEFAULT: '#cdd6f4',
                    muted: '#a6adc8',
                    subtext: '#6c7086',
                    dim: '#585b70',
                },
                'border': {
                    DEFAULT: '#313244',
                    hover: '#45475a',
                    active: '#585b70',
                },
                'danger': {
                    DEFAULT: '#f38ba8',
                    dark: '#45273a',
                },
                'warning': {
                    DEFAULT: '#f9e2af',
                    dark: '#453d2A',
                },
                'success': {
                    DEFAULT: '#a6e3a1',
                    dark: '#2a3d2e',
                },
            },
            fontFamily: {
                'mono': ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
                'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.2s ease-out',
                'slide-up': 'slideUp 0.2s ease-out',
                'slide-down': 'slideDown 0.15s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'spin-slow': 'spin 3s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': {
                        opacity: '0'
                    },
                    '100%': {
                        opacity: '1'
                    },
                },
                slideUp: {
                    '0%': {
                        opacity: '0',
                        transform: 'translateY(8px)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translateY(0)'
                    },
                },
                slideDown: {
                    '0%': {
                        opacity: '0',
                        transform: 'translateY(-8px)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translateY(0)'
                    },
                },
                pulseSoft: {
                    '0%, 100%': {
                        opacity: '1'
                    },
                    '50%': {
                        opacity: '0.6'
                    },
                },
            },
            boxShadow: {
                'glass': '0 4px 30px rgba(0, 0, 0, 0.3)',
                'glow': '0 0 15px rgba(129, 140, 248, 0.15)',
                'glow-sm': '0 0 8px rgba(129, 140, 248, 0.1)',
            },
        },
    },
    plugins: [],
}