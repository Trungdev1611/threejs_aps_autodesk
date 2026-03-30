import axios from 'axios'

/**
 * HTTP client dùng chung cho backend (dev: để trống baseURL + path /api → Vite proxy).
 * Production: đặt VITE_API_BASE_URL=https://your-api.example.com
 */
export const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5299',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})
