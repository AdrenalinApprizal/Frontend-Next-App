# Deployment Guide for Vercel

## Prerequisites

1. **GitHub Repository**: Make sure your code is pushed to a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Backend Services**: Ensure your backend APIs are deployed and accessible

## Step-by-Step Deployment

### 1. Prepare Environment Variables

Before deploying, you need to set up environment variables in Vercel. Go to your Vercel dashboard and add these environment variables:

#### Required Environment Variables:
- `NEXTAUTH_SECRET`: A random secret string (you can generate one with: `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

#### Backend API URLs (Update with your actual backend URLs):
- `API_BASE_URL`: Your main API base URL
- `GROUP_API_BASE_URL`: Your group/messages API base URL  
- `NOTIFICATION_API_BASE_URL`: Your notifications API base URL
- `FILES_API_BASE_URL`: Your files API base URL
- `PRESENCE_API_BASE_URL`: Your presence API base URL

#### WebSocket Configuration:
- `WS_BASE_URL`: Your WebSocket server URL (use `wss://` for production)
- `NEXT_PUBLIC_WEBSOCKET_PORT`: WebSocket port (if needed)

### 2. Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will automatically detect it's a Next.js project
4. Add your environment variables in the "Environment Variables" section
5. Click "Deploy"

#### Option B: Deploy via Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
vercel

# Follow the prompts to configure your deployment
```

### 3. Configure Custom Domain (Optional)
1. In your Vercel dashboard, go to your project
2. Navigate to "Settings" > "Domains"
3. Add your custom domain
4. Update `NEXTAUTH_URL` environment variable with your custom domain

### 4. Post-Deployment Configuration

#### Update CORS Settings
Make sure your backend APIs allow requests from your Vercel domain:
- Add your Vercel domain to CORS allowed origins
- Update any API keys or webhooks to use the new domain

#### Update Authentication Callbacks
If using external auth providers, update their callback URLs to point to your Vercel domain.

### 5. Environment Variables Template

Copy these to your Vercel environment variables:

```
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
API_BASE_URL=https://your-backend-api.com/api
GROUP_API_BASE_URL=https://your-group-api.com/api
NOTIFICATION_API_BASE_URL=https://your-notification-api.com/api
FILES_API_BASE_URL=https://your-files-api.com/api
PRESENCE_API_BASE_URL=https://your-presence-api.com/api
WS_BASE_URL=wss://your-websocket-server.com
```

## Important Notes

### WebSocket Considerations
- Vercel has limitations with WebSocket connections
- Your WebSocket server needs to be hosted separately (not on Vercel)
- Consider using services like Railway, Render, or AWS for WebSocket hosting

### Backend Services
- Ensure all your backend services are deployed and accessible from the internet
- Update all localhost URLs to production URLs
- Configure CORS properly for your Vercel domain

### Security
- Use HTTPS URLs for all production services
- Keep your `NEXTAUTH_SECRET` secure and unique
- Regularly rotate API keys and secrets

## Troubleshooting

### Common Issues:
1. **Environment Variables**: Make sure all required environment variables are set
2. **CORS Errors**: Configure your backend to allow requests from your Vercel domain
3. **API Endpoints**: Verify all backend services are accessible from the internet
4. **WebSocket Issues**: Ensure WebSocket server is deployed separately from Vercel

### Debugging:
- Check Vercel function logs in the dashboard
- Use the browser's Network tab to debug API calls
- Monitor your backend service logs for errors

## Performance Optimization

1. **Image Optimization**: Already configured in next.config.ts
2. **Caching**: Vercel automatically caches static assets
3. **ISR**: Consider implementing Incremental Static Regeneration for better performance
4. **Edge Functions**: Consider moving some API routes to Edge Runtime for better performance

## Monitoring

After deployment, monitor:
- Vercel Analytics for performance metrics
- Function logs for errors
- Backend API performance
- WebSocket connection stability
