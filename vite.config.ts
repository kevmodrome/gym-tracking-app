import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Allow access via Cloudflare Tunnel ephemeral URLs (`cloudflared tunnel --url http://localhost:5173`)
		// and named tunnels. Required for testing camera/PWA features that need HTTPS on a real phone.
		allowedHosts: ['.trycloudflare.com', '.cfargotunnel.com']
	}
});
