import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Apply auth and admin middleware to all routes
router.use(requireAuth);
router.use(requireAdmin);

// Service targets
const services = {
  radarr: 'http://localhost:7878',
  sonarr: 'http://localhost:8989',
  sabnzbd: 'http://localhost:8080',
  prowlarr: 'http://localhost:9696',
  overseerr: 'http://localhost:5055',
  qbittorrent: 'http://localhost:8085',
  bazarr: 'http://localhost:6767',
  lidarr: 'http://localhost:8686',
};

// Create proxy middleware for each service
for (const [name, target] of Object.entries(services)) {
  router.use(
    `/${name}`,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: {
        [`^/services/${name}`]: '',
      },
      onProxyRes: (proxyRes) => {
        // Strip headers that prevent iframe embedding
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
      },
      ws: false,
    })
  );
}

export default router;
