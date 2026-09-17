// זריז / שליח + — שרת מינימלי ללא תלויות חיצוניות.
// מגיש את האפליקציה (public/index.html) ומשתף את תצורת החנות (לוגו, שם, תיאור, מוצרים)
// בין כל המשתמשים והמכשירים דרך /api/store.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// מיקום קובץ הנתונים. ב-Render, כדי ששמירה תהיה קבועה, הגדירו DB_FILE לנתיב של דיסק מחובר (למשל /data/db.json).
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');
const PUBLIC = path.join(__dirname, 'public');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return { store: null }; }
}
function saveDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
  catch (e) { console.error('שמירת נתונים נכשלה:', e.message); }
}
let db = loadDB();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
function sendJSON(res, code, obj) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 8e6) req.destroy(); }); // עד ~8MB (מספיק ללוגו)
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { resolve({}); } });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  // ---------- API ----------
  if (p === '/api/store' && req.method === 'GET')  return sendJSON(res, 200, db.store || {});
  if (p === '/api/store' && req.method === 'POST') {
    const b = await readBody(req);
    db.store = b.store || b;
    saveDB(db);
    return sendJSON(res, 200, { ok: true });
  }
  if (p === '/api/health') return sendJSON(res, 200, { ok: true });

  // ---------- קבצים סטטיים ----------
  let file = p === '/' ? '/index.html' : p;
  file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const fp = path.join(PUBLIC, file);
  fs.readFile(fp, (err, data) => {
    if (err) { // אם הקובץ לא נמצא — מחזירים את index.html
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log('זריז פועל על פורט ' + PORT + ' · נתונים: ' + DB_FILE));
