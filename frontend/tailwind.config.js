/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#09090b", // Zinc 950
        foreground: "#fafafa",
        card: "#121215",
        border: "#27272a",
        accent: {
          DEFAULT: "#10b981", // Emerald 500
          foreground: "#052e16",
        },
        muted: {
          DEFAULT: "#27272a",
          foreground: "#a1a1aa",
        },
        sidebar: "#0c0c0e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      boxShadow: {
        'glow': '0 0 15px -3px rgba(16, 185, 129, 0.2)',
      }
    },
  },
  plugins: [],
}
