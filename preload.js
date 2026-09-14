const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Fingerprint & License IPC
  getDeviceId: () => ipcRenderer.send('get-device-id'),
  onDeviceIdReply: (callback) => {
    const handler = (event, id) => callback(id);
    ipcRenderer.on('device-id-reply', handler);
    return () => ipcRenderer.removeListener('device-id-reply', handler);
  },
  saveLicense: (licenseData) => ipcRenderer.send('save-license', licenseData),
  onSaveLicenseReply: (callback) => {
    const handler = (event, status) => callback(status);
    ipcRenderer.on('save-license-reply', handler);
    return () => ipcRenderer.removeListener('save-license-reply', handler);
  },
  loadLicense: () => ipcRenderer.send('load-license'),
  onLoadLicenseReply: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('load-license-reply', handler);
    return () => ipcRenderer.removeListener('load-license-reply', handler);
  },

  // Layout & Settings IPC
  saveUserLayoutSettings: (data) => ipcRenderer.send('save-user-layout-settings', data),
  loadUserLayoutSettingsAsync: () => ipcRenderer.invoke('load-user-layout-settings-async'),

  // Native File Dialogs for Export / Import
  exportBackupFile: (data) => ipcRenderer.invoke('export-backup-file', data),
  importBackupFile: () => ipcRenderer.invoke('import-backup-file'),

  // Native Local Directory Silent Scheduled Backup
  selectBackupDirectory: () => ipcRenderer.invoke('select-backup-directory'),
  saveBackupToDirectory: (payload) => ipcRenderer.invoke('save-backup-to-directory', payload),
  listBackupDirectoryFiles: (payload) => ipcRenderer.invoke('list-backup-directory-files', payload),
  readBackupDirectoryFile: (payload) => ipcRenderer.invoke('read-backup-directory-file', payload),

  // Database IPC Operations (UserData Path based)
  saveDatabaseState: (state) => ipcRenderer.invoke('db-save-state', state),
  loadDatabaseState: () => ipcRenderer.invoke('db-load-state'),
  exportNativeBackup: () => ipcRenderer.invoke('db-native-backup'),
  restoreNativeBackup: (content) => ipcRenderer.invoke('db-native-restore', content),

  // Auth IPC Operations
  authLogin: (credentials) => ipcRenderer.invoke('auth-login', credentials),
  authRegister: (userData) => ipcRenderer.invoke('auth-register', userData),
  authGetUsers: () => ipcRenderer.invoke('auth-get-users'),
  authResetPassword: (payload) => ipcRenderer.invoke('auth-reset-password', payload),

  // OAuth & Updates IPC
  googleOauthStart: () => ipcRenderer.invoke('google-oauth-start'),
  googleOauthRefresh: (refreshToken) => ipcRenderer.invoke('google-oauth-refresh', refreshToken),
  googleOauthGetToken: () => ipcRenderer.invoke('google-oauth-get-token'),
  googleOauthLogout: () => ipcRenderer.invoke('google-oauth-logout'),
  googleOauthStatus: () => ipcRenderer.invoke('google-oauth-status'),
  // Stage 4 Enterprise Update IPC Channels
  updateCheck: (packageBase64OrPath) => ipcRenderer.invoke('update-check', packageBase64OrPath),
  updateInstall: (packageBase64) => ipcRenderer.invoke('update-install', packageBase64),
  updateBackup: (payload) => ipcRenderer.invoke('update-backup', payload),
  updateRollback: (backupId) => ipcRenderer.invoke('update-rollback', backupId),
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // Extended Native Update Bindings
  restartApplication: () => ipcRenderer.invoke('app-restart'),
  selectUpdatePackageDialog: () => ipcRenderer.invoke('update-select-package-dialog'),
  inspectNativeUpdate: (payload) => ipcRenderer.invoke('update-inspect-native', payload),
  applyNativeUpdate: (payload) => ipcRenderer.invoke('update-apply-native', payload),
  buildNativeUpdate: (options) => ipcRenderer.invoke('update-build-native', options),
  onUpdateAvailable: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  }
});
