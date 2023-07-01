import './file-saver/dist/FileSaver.js';
export const saveAs = globalThis.saveAs;
globalThis.saveAs = undefined;

