import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  post: {
    getAll: () => ipcRenderer.invoke('post:getAll'),
    save: (post: unknown) => ipcRenderer.invoke('post:save', post),
    delete: (id: string) => ipcRenderer.invoke('post:delete', id),
    publish: (id: string, platforms: string[]) =>
      ipcRenderer.invoke('post:publish', id, platforms)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings)
  },
  tistory: {
    auth: (appId: string, appSecret: string) =>
      ipcRenderer.invoke('tistory:auth', appId, appSecret),
    getBlogs: (accessToken: string) => ipcRenderer.invoke('tistory:getBlogs', accessToken)
  }
})
