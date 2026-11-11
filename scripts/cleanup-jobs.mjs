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
      from: [{ collectionId: 'jobs' }],
      where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
    },
  }),
}).then((r) => r.json());

const docs = (Array.isArray(q) ? q : []).filter((x) => x.document);
console.log('jobs found:', docs.length);
for (const d of docs) {
  const id = d.document.name.split('/').pop();
  const res = await fetch(`${base}/jobs/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${idToken}` } });
  console.log('deleted', id, res.status);
}
console.log('done');
