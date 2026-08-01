import { useEffect, useRef, useState } from 'react';
import { getConfig } from '../api/config.api.js';

let scriptPromise = null;
function loadGoogleScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить Google Sign-In'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function GoogleSignInButton({ onCredential }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getConfig()
      .then(({ googleClientId }) => {
        if (cancelled || !googleClientId) return;
        return loadGoogleScript().then(() => {
          if (cancelled) return;
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => onCredentialRef.current(response.credential),
          });
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            locale: 'ru',
          });
          setAvailable(true);
        });
      })
      .catch(() => {
        // Google login just won't be offered
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <div className="google-signin">
      <div className="google-signin-divider">или</div>
      <div ref={buttonRef} />
    </div>
  );
}
