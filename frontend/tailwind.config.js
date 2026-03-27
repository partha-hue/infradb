/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // High-end Zinc palette (Linear-inspired)
        background: "#080809",
        sidebar: "#0c0c0d",
        panel: "#111113",
        border: "rgba(255, 255, 255, 0.06)",
        "border-bright": "rgba(255, 255, 255, 0.12)",
        
        brand: {
          DEFAULT: "#10b981", // Emerald
          glow: "rgba(16, 185, 129, 0.15)",
        },
        
        // Semantic Enterprise colors
        production: "#f43f5e", // Rose
        staging: "#f59e0b",   // Amber
        development: "#10b981", // Emerald
      },
      fontSize: {
        'xs': '11px',
        'sm': '13px',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
