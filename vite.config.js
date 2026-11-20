import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  base: command === 'serve'
    ? '/'
    : '/ghg-emissions-web/',
}))

