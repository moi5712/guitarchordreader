const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSheets: () => ipcRenderer.invoke('api:getSheets'),
  getSheetsPath: () => ipcRenderer.invoke('api:getSheetsPath'),
  selectSheetsFolder: () => ipcRenderer.invoke('api:selectSheetsFolder'),
  openSheetsFolder: () => ipcRenderer.invoke('api:openSheetsFolder'),
  saveSheet: (filename, content) => ipcRenderer.invoke('api:saveSheet', filename, content),
  saveSheetAs: (suggestedFilename, content) => ipcRenderer.invoke('api:saveSheetAs', suggestedFilename, content),
  showItemInFolder: (filePath) => ipcRenderer.invoke('api:showItemInFolder', filePath),
  deleteSheet: (filename) => ipcRenderer.invoke('api:deleteSheet', filename),
  getBookmarks: () => ipcRenderer.invoke('api:getBookmarks'),
  setBookmark: (filename, bookmarked) => ipcRenderer.invoke('api:setBookmark', filename, bookmarked),
  importFromUrl: (urls) => ipcRenderer.invoke('api:importFromUrl', urls),
  getChordFingerings: () => ipcRenderer.invoke('api:getChordFingerings'),
  getChordsFilePath: () => ipcRenderer.invoke('api:getChordsFilePath'),
});
