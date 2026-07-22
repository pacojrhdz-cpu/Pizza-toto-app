import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        toto: {
          red: "#c8102e",
          dark: "#1f2937",
        },
      },
    },
  },
  plugins: [],
};

export default config;
