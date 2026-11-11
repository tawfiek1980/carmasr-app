import express from 'express';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

function wrap(handler) {
  return (req, res) => {
    try {
      const result = handler(req, res);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Internal server error' });
          }
        });
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  };
}

async function loadHandler(modulePath) {
  try {
    const mod = await import(modulePath);
    return mod.default || mod.handler;
  } catch {
    return null;
  }
}

async function start() {
  const push = await loadHandler('./api/push.js');
  const payments = await loadHandler('./api/payments.js');
  const deleteAccount = await loadHandler('./api/delete-account.js');
  const adminChangePassword = await loadHandler('./api/admin-change-password.js');
  const adminHandler = await loadHandler('./api/admin.js');
  const ogPages = await loadHandler('./api/og-pages.js');

  if (push) app.all('/api/push', wrap(push));
  if (payments) app.post('/api/payments', wrap(payments));
  if (deleteAccount) app.post('/api/delete-account', wrap(deleteAccount));
  if (adminChangePassword) app.post('/api/admin-change-password', wrap(adminChangePassword));
  if (adminHandler) {
    app.all('/api/admin/:action', wrap(adminHandler));
  }
  if (ogPages) app.get('/api/og', wrap(ogPages));
  if (ogPages) app.get('/api/share', wrap(ogPages));
  if (ogPages) app.get('/api/og-pages', wrap(ogPages));

  const distPath = resolve(__dirname, 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));

    app.get('/ad/:id', (req, res) => {
      const { id } = req.params;
      if (ogPages) {
        req.query = { type: 'ad', id };
        ogPages(req, res);
      } else {
        res.redirect(302, `/listing/${id}`);
      }
    });

    app.get('/job/:id', (req, res) => {
      const { id } = req.params;
      if (ogPages) {
        req.query = { type: 'job', id };
        ogPages(req, res);
      } else {
        res.redirect(302, '/jobs');
      }
    });

    app.get('/load/:id', (req, res) => {
      const { id } = req.params;
      if (ogPages) {
        req.query = { type: 'load', id };
        ogPages(req, res);
      } else {
        res.redirect(302, '/loads');
      }
    });

    app.get('/exhibitions/:id', (req, res) => {
      const { id } = req.params;
      if (ogPages) {
        req.query = { type: 'exhibition', id };
        ogPages(req, res);
      } else {
        res.sendFile(resolve(distPath, 'index.html'));
      }
    });

    app.get('/{*path}', (req, res) => {
      res.sendFile(resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
