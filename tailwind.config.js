/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F7FA',
          300: '#9BA9BA',
          600: '#183556',
          700: '#102943',
        },
        primary: {
          DEFAULT: '#1E3A8A', // Trustworthy navy/blue
          light: '#3B82F6',
          dark: '#1E3A8A',
        },
        gray: {
          50: '#F8FAFC', // Light gray background
          100: '#F1F5F9',
          200: '#E2E8F0',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0, 0, 0, 0.05)',
        card: '0 10px 40px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
    },
  },
  plugins: [],
}
