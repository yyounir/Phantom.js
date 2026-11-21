import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        phantom: {
          bg: "#0a0712",
          panel: "#15101f",
          border: "#2a1f3d",
          accent: "#a855f7",
          blood: "#f43f5e",
          amber: "#f59e0b",
          alive: "#10b981",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
