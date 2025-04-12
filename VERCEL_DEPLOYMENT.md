# Vercel Deployment Guide for Celestial Viewer

This document provides instructions for deploying the Celestial Viewer application on Vercel.

## Prerequisites

1. A Vercel account (https://vercel.com)
2. Git repository with the Celestial Viewer codebase

## Deployment Steps

1. **Connect your Git repository to Vercel**
   - Log in to your Vercel account
   - Click "New Project"
   - Select your Git repository containing the Celestial Viewer code
   - Click "Import"

2. **Configure project settings**
   - Project Name: `celestial-viewer` (or your preferred name)
   - Framework Preset: `Create React App`
   - Build and Output Settings:
     - Build Command: `npm run build`
     - Output Directory: `build`
   - Click "Deploy"

3. **Environment Variables**
   The application requires the following environment variables:

   ```
   REACT_APP_DATA_PATH=/data/stanton_extract.json
   REACT_APP_DEFAULT_SYSTEM=Stanton
   REACT_APP_VERSION=0.1.0
   REACT_APP_TITLE=Celestial Viewer
   ```

   For Firebase integration, the following variables are needed:
   ```
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

4. **Verify Deployment**
   - Once the deployment is complete, Vercel will provide a URL to access your application
   - Visit the URL to ensure the application is working correctly

## Continuous Deployment

Vercel will automatically deploy changes when new commits are pushed to the repository. Each deployment will create a unique URL that you can use to preview changes before they are merged into the main branch.

## Custom Domain (Optional)

To use a custom domain:
1. Go to the "Domains" tab in your project settings
2. Add your domain and follow the verification steps provided by Vercel 