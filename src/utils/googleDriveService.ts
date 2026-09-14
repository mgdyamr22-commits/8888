import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account'
});

export const DEFAULT_GOOGLE_DRIVE_CONFIG = {
  clientId: '',
  projectId: '',
  clientSecret: '',
  redirectUri: typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : 'http://localhost/11/'
};

export interface GoogleDriveOAuthConfig {
  clientId?: string;
  projectId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

// In-memory caching for Google Access Token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Retrieve saved Google OAuth config from LocalStorage or return default
export const getSavedGoogleDriveConfig = (): GoogleDriveOAuthConfig => {
  if (typeof window === 'undefined') return DEFAULT_GOOGLE_DRIVE_CONFIG;
  try {
    const raw = localStorage.getItem('almakhzoun_google_drive_custom_oauth');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        clientId: parsed.clientId || DEFAULT_GOOGLE_DRIVE_CONFIG.clientId,
        projectId: parsed.projectId || DEFAULT_GOOGLE_DRIVE_CONFIG.projectId,
        clientSecret: parsed.clientSecret || DEFAULT_GOOGLE_DRIVE_CONFIG.clientSecret,
        redirectUri: parsed.redirectUri || DEFAULT_GOOGLE_DRIVE_CONFIG.redirectUri
      };
    }
  } catch (e) {
    console.warn('Error reading saved google drive oauth config:', e);
  }
  return DEFAULT_GOOGLE_DRIVE_CONFIG;
};

// Save custom Google OAuth config to LocalStorage
export const saveGoogleDriveConfig = (config: GoogleDriveOAuthConfig) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('almakhzoun_google_drive_custom_oauth', JSON.stringify({
      clientId: config.clientId || DEFAULT_GOOGLE_DRIVE_CONFIG.clientId,
      projectId: config.projectId || DEFAULT_GOOGLE_DRIVE_CONFIG.projectId,
      clientSecret: config.clientSecret || DEFAULT_GOOGLE_DRIVE_CONFIG.clientSecret,
      redirectUri: config.redirectUri || DEFAULT_GOOGLE_DRIVE_CONFIG.redirectUri
    }));
  } catch (e) {
    console.warn('Error saving google drive oauth config:', e);
  }
};

// Helper to extract access token from hash (for OAuth redirect flow)
export const parseTokenFromHash = (hashStr: string): string | null => {
  if (!hashStr) return null;
  const cleanHash = hashStr.startsWith('#') ? hashStr.substring(1) : hashStr;
  const params = new URLSearchParams(cleanHash);
  return params.get('access_token');
};

// Initialize auth state listener and check for redirect tokens in URL hash
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if current URL has returned from OAuth redirect flow
  if (typeof window !== 'undefined' && window.location.hash) {
    const tokenFromHash = parseTokenFromHash(window.location.hash);
    if (tokenFromHash) {
      cachedAccessToken = tokenFromHash;
      localStorage.setItem('almakhzoun_google_drive_token', tokenFromHash);

      // If running inside a popup that was opened by another window
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', token: tokenFromHash }, '*');
          window.close();
          return () => {};
        } catch (e) {
          console.warn('Could not postMessage to opener:', e);
        }
      }

      // Clean the hash from the URL without full reload
      try {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      } catch (e) {}

      // Fetch user profile
      fetchUserProfile(tokenFromHash).then((u) => {
        if (onAuthSuccess) onAuthSuccess(u, tokenFromHash);
      });
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Try to retrieve token from memory or storage
        const savedToken = localStorage.getItem('almakhzoun_google_drive_token');
        if (savedToken) {
          cachedAccessToken = savedToken;
          if (onAuthSuccess) onAuthSuccess(user, savedToken);
        } else if (onAuthFailure) {
          onAuthFailure();
        }
      }
    } else {
      if (!cachedAccessToken) {
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

// Fetch Google User Profile using access token
const fetchUserProfile = async (accessToken: string): Promise<User> => {
  let userEmail = 'drive-backup-user@google.com';
  let userDisplayName = 'Google Drive User';
  try {
    const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (uRes.ok) {
      const uData = await uRes.json();
      if (uData.email) userEmail = uData.email;
      if (uData.name) userDisplayName = uData.name;
    }
  } catch (ue) {
    console.warn('Unable to retrieve userinfo profile from Google:', ue);
  }

  return {
    email: userEmail,
    displayName: userDisplayName,
    uid: userEmail
  } as unknown as User;
};

// Helper for Google Identity Services (GIS) token client
const requestGisToken = (clientId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('بيئة غير مدعومة للمصادقة'));
    }
    const win = window as any;
    const launchClient = () => {
      try {
        const client = win.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: (response: any) => {
            if (response && response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            if (response && response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error('لم يتم استلام رمز وصول صالح من Google'));
            }
          },
          error_callback: (err: any) => {
            reject(err);
          }
        });
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (e) {
        reject(e);
      }
    };

    if (win.google?.accounts?.oauth2) {
      launchClient();
    } else {
      const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => launchClient());
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => launchClient();
        script.onerror = () => reject(new Error('تعذر تحميل مكتبة مصادقة Google Identity Services.'));
        document.head.appendChild(script);
      }
    }
  });
};

// Helper for Direct OAuth 2.0 Popup with Custom Redirect URI
const requestOAuthPopupToken = (clientId: string, redirectUri: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('بيئة غير مدعومة'));
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=select_account`;

    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'GoogleOAuthPopup',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=yes`
    );

    if (!popup) {
      return reject(new Error('تم حظر النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة.'));
    }

    let isResolved = false;

    // 1. Listen for postMessage from redirect page
    const messageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_OAUTH_SUCCESS' && event.data.token) {
        if (!isResolved) {
          isResolved = true;
          window.removeEventListener('message', messageListener);
          if (pollInterval) clearInterval(pollInterval);
          resolve(event.data.token);
        }
      }
    };
    window.addEventListener('message', messageListener);

    // 2. Poll the popup URL for token in hash (same-origin case)
    const pollInterval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(pollInterval);
          window.removeEventListener('message', messageListener);
          if (!isResolved) {
            reject(new Error('تم إغلاق نافذة تسجيل الدخول قبل اكتمال العملية.'));
          }
          return;
        }

        if (popup.location && popup.location.href) {
          const popupHref = popup.location.href;
          if (popupHref.includes('access_token=')) {
            const token = parseTokenFromHash(popup.location.hash);
            if (token && !isResolved) {
              isResolved = true;
              clearInterval(pollInterval);
              window.removeEventListener('message', messageListener);
              try { popup.close(); } catch (e) {}
              resolve(token);
            }
          }
        }
      } catch (crossOriginErr) {
        // Cross-origin access error is normal while user is on accounts.google.com
      }
    }, 500);

    // Timeout safety after 3 minutes
    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(pollInterval);
        window.removeEventListener('message', messageListener);
        reject(new Error('انتهت مهلة تسجيل الدخول في جوجل.'));
      }
    }, 180000);
  });
};

// Start Google sign-in flow
export const signInWithGoogleDrive = async (customConfig?: GoogleDriveOAuthConfig): Promise<{ user: User; accessToken: string } | null> => {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  const isElectron = !!(win?.electronAPI || win?.ipcRenderer);

  const activeConfig = {
    ...getSavedGoogleDriveConfig(),
    ...(customConfig || {})
  };

  const clientId = activeConfig.clientId || DEFAULT_GOOGLE_DRIVE_CONFIG.clientId;
  const redirectUri = activeConfig.redirectUri || DEFAULT_GOOGLE_DRIVE_CONFIG.redirectUri;

  if (isElectron && win?.electronAPI?.googleOauthStart) {
    try {
      isSigningIn = true;
      const res = await win.electronAPI.googleOauthStart();
      if (res && res.accessToken) {
        cachedAccessToken = res.accessToken;
        localStorage.setItem('almakhzoun_google_drive_token', res.accessToken);
        const dummyUser = {
          email: res.email || 'user@google.com',
          displayName: 'Google Drive User'
        } as unknown as User;
        return { user: dummyUser, accessToken: res.accessToken };
      }
      throw new Error('لم يتم استلام رمز الوصول من متصفح جوجل');
    } catch (error: any) {
      console.error('Electron Google OAuth error:', error);
      const errMsg = String(error?.message || error || '').toLowerCase();
      if (errMsg.includes('cancelled') || errMsg.includes('closed') || errMsg.includes('access_denied')) {
        throw new Error('تم إلغاء العملية: أغلقت نافذة تسجيل الدخول في المتصفح.');
      }
      throw new Error(error?.message || 'فشل الاتصال بخدمة Google OAuth.');
    } finally {
      isSigningIn = false;
    }
  }

  isSigningIn = true;

  // 1. Try Google Identity Services (GIS) Token Client first (Best browser experience, no full page redirect needed)
  try {
    if (clientId) {
      const gisToken = await requestGisToken(clientId);
      if (gisToken) {
        cachedAccessToken = gisToken;
        localStorage.setItem('almakhzoun_google_drive_token', gisToken);
        const user = await fetchUserProfile(gisToken);
        return { user, accessToken: gisToken };
      }
    }
  } catch (gisErr: any) {
    console.warn('GIS Token request encountered issue, attempting OAuth Direct Popup fallback...', gisErr);
  }

  // 2. Try Direct OAuth 2.0 Popup Flow with Custom Redirect URI
  try {
    if (clientId && redirectUri) {
      const oAuthToken = await requestOAuthPopupToken(clientId, redirectUri);
      if (oAuthToken) {
        cachedAccessToken = oAuthToken;
        localStorage.setItem('almakhzoun_google_drive_token', oAuthToken);
        const user = await fetchUserProfile(oAuthToken);
        return { user, accessToken: oAuthToken };
      }
    }
  } catch (popupErr: any) {
    console.warn('Direct OAuth Popup encountered issue, attempting Firebase fallback...', popupErr);
  }

  // 3. Try Firebase signInWithPopup as fallback
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('فشل الحصول على رمز الوصول من حساب قوقل');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('almakhzoun_google_drive_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase signInWithPopup encounter:', error);
    const errMsg = String(error?.message || error?.code || error || '').toLowerCase();

    if (errMsg.includes('popup-closed-by-user') || errMsg.includes('cancelled-popup-request')) {
      throw new Error('تم إلغاء العملية: أغلقت نافذة تسجيل الدخول.');
    } else if (errMsg.includes('popup-blocked')) {
      throw new Error('تم حظر النافذة المنبثقة بواسطة المتصفح. يرجى السماح بالنوافذ المنبثقة للموقع.');
    }

    if (errMsg.includes('unauthorized-domain') || errMsg.includes('auth/unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'النطاق الحالي';
      throw new Error(`النطاق (${currentHost}) غير مسجل في إعدادات Google Cloud / Firebase Console. يرجى إضافة هذا النطاق ورابط إعادة التوجيه (${redirectUri}) في Google Cloud Console، أو استخدام التصدير اليدوي.`);
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('almakhzoun_google_drive_token');
    if (saved) {
      cachedAccessToken = saved;
      return saved;
    }
  }
  return null;
};

export const getActiveGoogleAccessToken = async (): Promise<string | null> => {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win?.electronAPI?.googleOauthGetToken) {
    try {
      const res = await win.electronAPI.googleOauthGetToken();
      if (res?.success && res.accessToken) {
        cachedAccessToken = res.accessToken;
        localStorage.setItem('almakhzoun_google_drive_token', res.accessToken);
        return res.accessToken;
      }
    } catch (e) {
      console.error('Error retrieving active Google Token from Electron:', e);
    }
  }
  return getGoogleAccessToken();
};

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('almakhzoun_google_drive_token', token);
    } else {
      localStorage.removeItem('almakhzoun_google_drive_token');
    }
  }
};

export const logoutGoogle = async () => {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win?.electronAPI?.googleOauthLogout) {
    try {
      await win.electronAPI.googleOauthLogout();
    } catch (e) {}
  }
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('almakhzoun_google_drive_token');
  }
};

/**
 * Lists backup files in Google Drive.
 */
export const listDriveBackups = async (token: string) => {
  const query = encodeURIComponent("name contains 'almakhzoun_backup_' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch files from Google Drive');
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Searches for a file by name.
 */
export const findFileByName = async (token: string, name: string): Promise<string | null> => {
  const query = encodeURIComponent(`name = '${name}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to find file '${name}' on Google Drive`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
};

/**
 * Uploads a new file or updates an existing file in Google Drive.
 * If overwriteId is specified, it updates the existing file.
 */
export const uploadBackupToDrive = async (
  token: string,
  fileName: string,
  content: string,
  overwriteId?: string | null
): Promise<{ id: string; name: string }> => {
  const fileMetadata = {
    name: fileName,
    mimeType: 'application/json'
  };

  if (overwriteId) {
    // Update existing file content (using simple media upload protocol)
    const url = `https://www.googleapis.com/upload/drive/v3/files/${overwriteId}?uploadType=media`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: content
    });

    if (!response.ok) {
      throw new Error(`Failed to update existing Drive file with ID ${overwriteId}`);
    }

    const data = await response.json();
    return { id: data.id || overwriteId, name: fileName };
  } else {
    // Create a new file (using multipart upload to upload metadata + content)
    const boundary = 'foo_bar_baz_boundary_almakhzoun_pro';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      throw new Error('Failed to upload new backup to Google Drive');
    }

    const data = await response.json();
    return { id: data.id, name: fileName };
  }
};

/**
 * Downloads file content from Google Drive.
 */
export const downloadBackupFromDrive = async (token: string, fileId: string): Promise<any> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download file ${fileId} from Google Drive`);
  }

  return await response.json();
};

/**
 * Deletes a file from Google Drive.
 */
export const deleteDriveFile = async (token: string, fileId: string) => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete file ${fileId} from Google Drive`);
  }
};
