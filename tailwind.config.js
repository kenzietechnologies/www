/** @type {import('tailwindcss').Config} */
export default {
  content: ['./**/*.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      fontFamily: {
      sans: ["var(--font-sans)", 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      serif: ["var(--font-serif)", 'Georgia', 'Times New Roman', 'serif'],
      cursive: ["var(--font-cursive)", 'cursive']
      }
    }
  },
  plugins: [],
}
