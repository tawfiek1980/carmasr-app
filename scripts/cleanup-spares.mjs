const KEY = 'AIzaSyBCl9kOWTqWx2emPhi_tAfhwzjXz53B3jo';
const PROJECT = 'tareeq-d4dcc';
const EMAIL = 'phone_1000000099@tareeq.app';
const PASS = 'TareeqDemo2026!';

const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
}).then((r) => r.json());
if (!auth.idToken) { console.error('AUTH FAIL', auth); process.exit(1); }
const idToken = auth.idToken;
const uid = auth.localId;
console.log('uid:', uid);

const q = await fetch(`${base}:runQuery`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'listings' }],
      where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
    },
  }),
}).then((r) => r.json());

const all = (Array.isArray(q) ? q : []).filter((x) => x.document);
const docs = all.filter((x) => {
  const f = x.document.fields || {};
  return f.category && f.category.stringValue === 'spare-parts';
});
console.log('spare-part listings found:', docs.length, '(of', all.length, 'total demo listings)');
for (const d of docs) {
  const id = d.document.name.split('/').pop();
  const res = await fetch(`${base}/listings/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${idToken}` } });
  console.log('deleted', id, res.status);
}
console.log('done');
