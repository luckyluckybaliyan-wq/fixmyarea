require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'data', 'issues.json');
const CATEGORIES = ['road', 'light', 'garbage', 'water', 'drain', 'safety', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved'];

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const load = () => JSON.parse(fs.readFileSync(DB, 'utf8'));
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 1));
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);

// simple in-memory rate limit: 30 writes / 10 min / IP
const hits = new Map();
function limiter(req, res, next) {
  const k = req.ip, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 600000);
  if (arr.length >= 30) return res.status(429).json({ error: 'Too many requests, try later.' });
  arr.push(now); hits.set(k, arr); next();
}

// Loads Google Maps with the key kept on the server
app.get('/maps-loader.js', (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  res.type('js').send(`window.APP_CONFIG=${JSON.stringify({
    lat: Number(process.env.DEFAULT_LAT) || 28.6139,
    lng: Number(process.env.DEFAULT_LNG) || 77.209, hasKey: !!key })};
  ${key ? `var s=document.createElement('script');s.src='https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=initMap';s.async=true;document.head.appendChild(s);`
        : `window.addEventListener('DOMContentLoaded',()=>window.initMap&&window.initMap());`}`);
});

app.get('/api/issues', (req, res) => {
  const { category, status, q } = req.query;
  let list = load();
  if (category) list = list.filter((i) => i.category === category);
  if (status) list = list.filter((i) => i.status === status);
  if (q) list = list.filter((i) => (i.title + i.description + i.address).toLowerCase().includes(String(q).toLowerCase()));
  res.json(list.sort((a, b) => b.upvotes - a.upvotes));
});

app.get('/api/issues/:id', (req, res) => {
  const i = load().find((x) => x.id === req.params.id);
  i ? res.json(i) : res.status(404).json({ error: 'Issue not found' });
});

app.post('/api/issues', limiter, (req, res) => {
  const b = req.body, lat = Number(b.lat), lng = Number(b.lng);
  if (!clean(b.title, 100) || !(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || !CATEGORIES.includes(b.category))
    return res.status(400).json({ error: 'Title, category and a valid map location are required.' });
  const issue = { id: crypto.randomUUID(), title: clean(b.title, 100), description: clean(b.description, 800),
    category: b.category, status: 'open', lat, lng, address: clean(b.address, 150), upvotes: 0, comments: [], createdAt: new Date().toISOString() };
  const d = load(); d.push(issue); save(d); res.status(201).json(issue);
});

app.post('/api/issues/:id/upvote', limiter, (req, res) => {
  const d = load(), i = d.find((x) => x.id === req.params.id);
  if (!i) return res.status(404).json({ error: 'Issue not found' });
  i.upvotes++; save(d); res.json({ upvotes: i.upvotes });
});

app.post('/api/issues/:id/comments', limiter, (req, res) => {
  const d = load(), i = d.find((x) => x.id === req.params.id), text = clean(req.body.text, 300);
  if (!i) return res.status(404).json({ error: 'Issue not found' });
  if (!text) return res.status(400).json({ error: 'Comment cannot be empty.' });
  i.comments.push({ name: clean(req.body.name, 40) || 'Neighbour', text, at: new Date().toISOString() });
  save(d); res.status(201).json(i);
});

app.patch('/api/issues/:id/status', (req, res) => {
  if (req.get('x-admin-token') !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Admin token required.' });
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
  const d = load(), i = d.find((x) => x.id === req.params.id);
  if (!i) return res.status(404).json({ error: 'Issue not found' });
  i.status = req.body.status; save(d); res.json(i);
});

app.get('/api/stats', (req, res) => {
  const d = load(), by = (k) => d.reduce((a, i) => ((a[i[k]] = (a[i[k]] || 0) + 1), a), {});
  res.json({ total: d.length, byStatus: by('status'), byCategory: by('category') });
});

app.listen(PORT, () => console.log(`FixMyArea running at http://localhost:${PORT}`));
