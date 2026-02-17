import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./landing-produtos/**/*.{js,ts,jsx,tsx}",
    "./knexai/**/*.{js,ts,jsx,tsx}",
    "./knexchat/**/*.{js,ts,jsx,tsx}",
    "./knexdocs/**/*.{js,ts,jsx,tsx}",
    "./knexflow/**/*.{js,ts,jsx,tsx}",
    "./knexmail/**/*.{js,ts,jsx,tsx}",
    "./knexpay/**/*.{js,ts,jsx,tsx}",
    "./knexreview/**/*.{js,ts,jsx,tsx}",
    "./knexsearch/**/*.{js,ts,jsx,tsx}",
    "./supadrive/web/**/*.{js,ts,jsx,tsx}",
    "./vioanalytics/**/*.{js,ts,jsx,tsx}",
    "./vioclass/**/*.{js,ts,jsx,tsx}",
    "./viohub/**/*.{js,ts,jsx,tsx}",
    "./violive/**/*.{js,ts,jsx,tsx}",
    "./vioread/**/*.{js,ts,jsx,tsx}",
    "./viorecord/**/*.{js,ts,jsx,tsx}",
    "./viostudio/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
    },
  },
  plugins: [],
} satisfies Config;

