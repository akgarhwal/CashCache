// Firebase web config is public by design (it ships to every browser).
// Do not put Admin / service-account keys here or in Vercel env vars.
// Lock this down in the Firebase console:
//   Authentication → Google provider → Enable
//   Authentication → Settings → Authorized domains (localhost + your Vercel host)
//   Firestore → publish firestore.rules
//   Google Cloud → Credentials → this API key → HTTP referrer restriction
// Analytics is intentionally not used.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCmg017XXVxC53GEHAc3qzgY2B5Anflgu0",
  authDomain: "cashcache-a4c7f.firebaseapp.com",
  projectId: "cashcache-a4c7f",
  storageBucket: "cashcache-a4c7f.firebasestorage.app",
  messagingSenderId: "537312971980",
  appId: "1:537312971980:web:c3fd9ed132229075778669",
};
