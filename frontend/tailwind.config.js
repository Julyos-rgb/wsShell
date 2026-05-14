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
                    DEFAULT: 'rgb(var(--c-primary-400) / <alpha-value>)',
                    50: 'rgb(var(--c-primary-50) / <alpha-value>)',
                    100: 'rgb(var(--c-primary-100) / <alpha-value>)',
                    200: 'rgb(var(--c-primary-200) / <alpha-value>)',
                    300: 'rgb(var(--c-primary-300) / <alpha-value>)',
                    400: 'rgb(var(--c-primary-400) / <alpha-value>)',
                    500: 'rgb(var(--c-primary-500) / <alpha-value>)',
                    600: 'rgb(var(--c-primary-600) / <alpha-value>)',
                    700: 'rgb(var(--c-primary-700) / <alpha-value>)',
                    800: 'rgb(var(--c-primary-800) / <alpha-value>)',
                    900: 'rgb(var(--c-primary-900) / <alpha-value>)',
                },
                'surface': {
                    DEFAULT: 'rgb(var(--c-surface-300) / <alpha-value>)',
                    50: 'rgb(var(--c-surface-50) / <alpha-value>)',
                    100: 'rgb(var(--c-surface-100) / <alpha-value>)',
                    200: 'rgb(var(--c-surface-200) / <alpha-value>)',
                    300: 'rgb(var(--c-surface-300) / <alpha-value>)',
                    400: 'rgb(var(--c-surface-400) / <alpha-value>)',
                    500: 'rgb(var(--c-surface-500) / <alpha-value>)',
                },
                'accent': {
                    DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
                    blue: 'rgb(var(--c-accent-blue) / <alpha-value>)',
                    green: 'rgb(var(--c-accent-green) / <alpha-value>)',
                    yellow: 'rgb(var(--c-accent-yellow) / <alpha-value>)',
                    red: 'rgb(var(--c-accent-red) / <alpha-value>)',
                    pink: 'rgb(var(--c-accent-pink) / <alpha-value>)',
                    mauve: 'rgb(var(--c-accent-mauve) / <alpha-value>)',
                    peach: 'rgb(var(--c-accent-peach) / <alpha-value>)',
                    teal: 'rgb(var(--c-accent-teal) / <alpha-value>)',
                    sky: 'rgb(var(--c-accent-sky) / <alpha-value>)',
                },
                'text': {
                    DEFAULT: 'rgb(var(--c-text) / <alpha-value>)',
                    muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
                    subtext: 'rgb(var(--c-text-subtext) / <alpha-value>)',
                    dim: 'rgb(var(--c-text-dim) / <alpha-value>)',
                },
                'border': {
                    DEFAULT: 'rgb(var(--c-border) / <alpha-value>)',
                    hover: 'rgb(var(--c-border-hover) / <alpha-value>)',
                    active: 'rgb(var(--c-border-active) / <alpha-value>)',
                },
                'danger': {
                    DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)',
                    dark: 'rgb(var(--c-danger-dark) / <alpha-value>)',
                },
                'warning': {
                    DEFAULT: 'rgb(var(--c-warning) / <alpha-value>)',
                    dark: 'rgb(var(--c-warning-dark) / <alpha-value>)',
                },
                'success': {
                    DEFAULT: 'rgb(var(--c-success) / <alpha-value>)',
                    dark: 'rgb(var(--c-success-dark) / <alpha-value>)',
                },
            },
            fontFamily: {
                'mono': ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
                'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'slide-up': 'slideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'slide-down': 'slideDown 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'slide-in-top': 'slideInTop 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'slide-out-top': 'slideOutTop 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'scale-in': 'scaleIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'spin-slow': 'spin 3s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-12px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                slideInTop: {
                    '0%': { opacity: '0', transform: 'translateY(-20px) scale(0.96)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                slideOutTop: {
                    '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                    '100%': { opacity: '0', transform: 'translateY(-20px) scale(0.96)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
            },
        },
    },
    plugins: [],
}
