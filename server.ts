import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

function cleanFolderId(input?: string): string {
  if (!input) return '1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL';
  const str = input.trim();
  const match = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str.replace(/https?:\/\/[^/]+\//, '').replace(/\//g, '').trim();
}

const PORT = 3000;
const DEFAULT_FOLDER_ID = cleanFolderId(process.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL');
let activeScriptUrl = (
  process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
  process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwMcAGqZcecU1coJ-jG0RffGEbY6TJmWmwqB2AkSNBqrWI3gfu_P0QRVA4FX84Cs4gH/exec'
).trim();

async function startServer() {
  const app = express();

  // Support up to 50MB files (base64 encoded)
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Health and config endpoint
  app.get('/api/config', (req: Request, res: Response) => {
    res.json({
      folderId: DEFAULT_FOLDER_ID,
      folderUrl: `https://drive.google.com/drive/folders/${DEFAULT_FOLDER_ID}`,
      scriptUrl: activeScriptUrl,
      appsScriptUrlConfigured: !!activeScriptUrl,
    });
  });

  // Save Apps Script URL endpoint
  app.post('/api/config/script-url', (req: Request, res: Response) => {
    const { scriptUrl } = req.body;
    const trimmed = (scriptUrl || '').trim();

    if (!trimmed) {
      activeScriptUrl = '';
      return res.json({ status: 'success', message: 'Script URL cleared.', scriptUrl: '' });
    }

    if (!trimmed.startsWith('https://script.google.com/')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Google Apps Script URL. It must begin with https://script.google.com/macros/s/.../exec',
      });
    }

    activeScriptUrl = trimmed;
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL = trimmed;

    // Persist to .env file if possible
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      if (envContent.includes('VITE_GOOGLE_APPS_SCRIPT_URL=')) {
        envContent = envContent.replace(
          /VITE_GOOGLE_APPS_SCRIPT_URL=.*/g,
          `VITE_GOOGLE_APPS_SCRIPT_URL="${trimmed}"`
        );
      } else {
        envContent += `\nVITE_GOOGLE_APPS_SCRIPT_URL="${trimmed}"\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    } catch (fsErr) {
      console.warn('Could not persist to .env file, holding in memory:', fsErr);
    }

    return res.json({
      status: 'success',
      message: 'Google Apps Script Web App URL saved successfully.',
      scriptUrl: activeScriptUrl,
    });
  });

  // Upload proxy endpoint: forwards directly to Google Apps Script
  app.post('/api/upload', async (req: Request, res: Response) => {
    try {
      const { studentName, filename, fileData, mimeType, scriptUrl, folderId } = req.body;

      if (!studentName || !studentName.trim()) {
        return res.status(400).json({ status: 'error', message: 'Student Full Name is required.' });
      }

      if (!fileData) {
        return res.status(400).json({ status: 'error', message: 'No file data received.' });
      }

      const targetScriptUrl = (scriptUrl || activeScriptUrl).trim();
      const targetFolderId = cleanFolderId(folderId || DEFAULT_FOLDER_ID);

      // STRICT CHECK: Do NOT simulate success if Apps Script URL is missing!
      if (!targetScriptUrl) {
        return res.status(400).json({
          status: 'not_configured',
          message:
            'Google Apps Script backend URL is not connected yet. Files cannot be uploaded to Google Drive until your Google Apps Script is deployed and connected.',
          requiresSetup: true,
          targetFolderId,
        });
      }

      // Sanitize student name: e.g. "Rameez Ali" -> "Rameez_Ali"
      const cleanStudentName = studentName
        .trim()
        .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, '')
        .replace(/\s+/g, '_') || 'Student';

      // Parse filename
      const lastDot = (filename || 'submission').lastIndexOf('.');
      const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename || 'submission';
      const ext = lastDot > 0 ? filename.substring(lastDot) : '';
      const cleanBase = baseName.replace(/[\\/:*?"<>|]/g, '_');
      const targetFilename = `${cleanBase}_${cleanStudentName}${ext}`;

      // Forward to Google Apps Script
      console.log(`Forwarding upload for ${studentName} (${targetFilename}) to Apps Script...`);
      const appsScriptResponse = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          studentName: studentName.trim(),
          filename: filename || 'submission',
          fileData,
          mimeType: mimeType || 'application/octet-stream',
          folderId: targetFolderId,
        }),
        redirect: 'follow',
      });

      const responseText = await appsScriptResponse.text();
      console.log('Apps Script response status:', appsScriptResponse.status, 'Preview:', responseText.slice(0, 150));

      // Check if response is HTML (indicates Google login redirection or permission error)
      if (
        responseText.includes('<!DOCTYPE') ||
        responseText.includes('<html') ||
        responseText.includes('Google Accounts') ||
        responseText.includes('Sign in')
      ) {
        return res.status(403).json({
          status: 'error',
          message:
            'Google Apps Script returned an authentication prompt instead of accepting the file. Please re-deploy your Web App with "Who has access" set to "Anyone" (not "Only myself" or domain-restricted).',
          isAuthIssue: true,
        });
      }

      try {
        const data = JSON.parse(responseText);
        if (data.status === 'error') {
          return res.status(500).json({
            status: 'error',
            message: `Google Apps Script error: ${data.message || 'Unknown Drive error'}`,
          });
        }
        return res.json(data);
      } catch (parseErr) {
        console.error('Failed to parse Apps Script response as JSON:', responseText.slice(0, 300));
        return res.status(502).json({
          status: 'error',
          message: `Unexpected response from Google Apps Script. Ensure the script returns JSON. Raw output: ${responseText.slice(0, 200)}`,
        });
      }
    } catch (err: any) {
      console.error('Upload handler error:', err);
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Internal server error while processing upload to Google Drive.',
      });
    }
  });

  // Test an actual upload endpoint
  app.post('/api/test-upload', async (req: Request, res: Response) => {
    try {
      const { scriptUrl } = req.body;
      const targetUrl = (scriptUrl || activeScriptUrl).trim();

      if (!targetUrl) {
        return res.json({
          status: 'info',
          message: 'No Google Apps Script URL configured yet.',
          targetFolderId: DEFAULT_FOLDER_ID,
        });
      }

      // Perform a ping / test check
      const checkResp = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
      });
      const data = await checkResp.text();

      return res.json({
        status: 'success',
        ok: checkResp.ok,
        data: data.slice(0, 500),
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        message: err.message || 'Test connection failed.',
      });
    }
  });

  // Mount Vite dev server in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Student Submission Portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
