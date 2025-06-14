# Vercel Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] ✅ Build test completed successfully
- [x] ✅ Environment variables template created (`.env.example`)
- [x] ✅ Vercel configuration file created (`vercel.json`)
- [x] ✅ Next.js config updated for production (`next.config.ts`)
- [x] ✅ API proxy updated to use environment variables
- [x] ✅ WebSocket configuration updated for production
- [x] ✅ `.gitignore` file properly configured

## 🚀 Ready to Deploy!

Your Next.js application is now ready for Vercel deployment. Follow these steps:

### 1. Push to GitHub
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Deploy via Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure environment variables (see DEPLOYMENT_GUIDE.md)
4. Deploy!

### 3. Environment Variables to Set in Vercel

**Essential Variables:**
```
NEXTAUTH_SECRET=<generate-random-secret>
NEXTAUTH_URL=https://your-app.vercel.app
```

**Backend API URLs (update with your actual URLs):**
```
API_BASE_URL=https://your-backend-api.com/api
GROUP_API_BASE_URL=https://your-group-api.com/api
NOTIFICATION_API_BASE_URL=https://your-notification-api.com/api
FILES_API_BASE_URL=https://your-files-api.com/api
PRESENCE_API_BASE_URL=https://your-presence-api.com/api
WS_BASE_URL=wss://your-websocket-server.com
```

## ⚠️ Important Notes

### WebSocket Limitations
- Vercel doesn't support persistent WebSocket connections
- Your WebSocket server must be hosted elsewhere (Railway, Render, AWS, etc.)
- Update `WS_BASE_URL` to point to your external WebSocket server

### Backend Services
- Ensure all backend services are deployed and accessible
- Configure CORS to allow requests from your Vercel domain
- Update any hardcoded localhost URLs

### Security
- Generate a strong `NEXTAUTH_SECRET`
- Use HTTPS URLs for all production services
- Review and update CORS settings

## 🔍 Post-Deployment Testing

After deployment, test:
- [ ] Login/Registration functionality
- [ ] API proxy endpoints
- [ ] WebSocket connections (if backend is deployed)
- [ ] Image uploads and file handling
- [ ] Chat functionality
- [ ] Navigation and routing

## 📚 Additional Resources

- [Vercel Deployment Documentation](https://vercel.com/docs/concepts/deployments/overview)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

## 🚨 Need Help?

If you encounter issues:
1. Check Vercel function logs
2. Review browser console for errors
3. Verify environment variables are set correctly
4. Check backend service accessibility
5. Review CORS configuration
