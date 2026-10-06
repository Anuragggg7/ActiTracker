import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic resolver for frontend dist folder to ensure static build works across execution environments
const getDistFolder = () => {
  const candidatePaths = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'dist')
  ];
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
};

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads (both public/uploads and root uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Root Endpoint - Backend Health/Availability Confirmation (or SPA entry if browser)
app.get('/', (req, res, next) => {
  const isJsonReq = req.headers.accept && req.headers.accept.includes('application/json');
  const distFolder = getDistFolder();
  if (isJsonReq || !distFolder) {
    return res.status(200).json({
      success: true,
      message: 'ActiTracker Backend is running successfully'
    });
  }
  next();
});

// Health Check Endpoint (un-authenticated)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  const isDbConnected = dbState === 1;

  res.status(isDbConnected ? 200 : 503).json({
    success: isDbConnected,
    message: 'Backend is running',
    status: 'OK',
    system: 'ActivityTracker RCPIT Centralized Management Platform',
    timestamp: new Date().toISOString(),
    mongodb: {
      status: dbStatusMap[dbState] || 'Unknown',
      readyState: dbState,
      host: mongoose.connection.host || 'N/A',
      dbName: mongoose.connection.name || 'N/A'
    }
  });
});

// Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hod', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api', mediaRoutes);
app.use('/api', documentRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api', pdfRoutes);

// Serve static assets from frontend/dist if available
app.use((req, res, next) => {
  const distFolder = getDistFolder();
  if (distFolder) {
    return express.static(distFolder)(req, res, next);
  }
  next();
});

// SPA Fallback for client-side routes on page refresh (e.g., /faculty, /admin, /calendar, /login)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
    return next();
  }
  const distFolder = getDistFolder();
  if (distFolder) {
    return res.sendFile(path.join(distFolder, 'index.html'));
  }
  next();
});

// Catch-all 404 Handler for unmatched API routes
app.use((req, res) => {
  console.warn(`[404] No route matched: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use(errorHandler);

export default app;
