import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark Blue 테마 (PRD 10.1)
        bg: {
          DEFAULT: '#1a1a2e',
          header: '#16213e',
          sidebar: '#0f0f23',
          card: '#1e1e38'
        },
        // 시맨틱 컬러 - Primary
        primary: {
          DEFAULT: '#3b82f6',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        // 계층 색상 (PRD 10.1)
        level: {
          project: '#8b5cf6',  // 퍼플
          wp: '#3b82f6',       // 블루
          act: '#22c55e',      // 그린
          task: '#f59e0b'      // 앰버
        },
        // 상태 색상
        success: {
          DEFAULT: '#22c55e',
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a'
        },
        warning: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706'
        },
        danger: {
          DEFAULT: '#ef4444',
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626'
        },
        // 텍스트 색상
        text: {
          DEFAULT: '#e8e8e8',
          secondary: '#888888',
          muted: '#666666'
        },
        // 보더 색상
        border: {
          DEFAULT: '#3d3d5c',
          light: '#4d4d6c'
        },
        // 서피스 색상
        surface: {
          DEFAULT: '#1e1e38',
          50: '#2a2a4a',
          100: '#252545',
          200: '#1e1e38',
          300: '#1a1a2e',
          400: '#16213e',
          500: '#0f0f23'
        }
      },
      // 폰트 설정
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      // 간격 확장
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem'
      },
      // 보더 반경
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem'
      },
      // 박스 그림자 (다크 테마용)
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
      }
    }
  },
  plugins: []
} satisfies Config
