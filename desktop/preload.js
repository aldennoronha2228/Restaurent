const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('nexrestoDesktop', {
  app: 'NexResto',
});
