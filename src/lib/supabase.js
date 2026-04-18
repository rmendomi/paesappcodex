import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Mutex in-memory para serializar refreshes de token.
// Las extensiones de browser (MetaMask, Rabby, etc.) rompen navigator.locks
// con un SES lockdown. Este mutex evita el race condition que causaba
// "Invalid Refresh Token: Refresh Token Not Found" cuando dos refreshes
// concurrentes intentaban usar el mismo token.
let _locked = false;
const _queue = [];

function _release() {
  _locked = false;
  if (_queue.length > 0) _queue.shift()();
}

const safeLock = (_name, _timeout, fn) => {
  if (!_locked) {
    _locked = true;
    return Promise.resolve().then(fn).finally(_release);
  }
  return new Promise((resolve) => {
    _queue.push(() => {
      _locked = true;
      resolve(Promise.resolve().then(fn).finally(_release));
    });
  });
};

export const supabase = createClient(url, key, {
  auth: { lock: safeLock },
});
