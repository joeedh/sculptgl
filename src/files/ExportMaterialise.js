import {zip} from '../lib/zip.js';
import ExportSTL from './ExportSTL.js';

let Export = {};

Export.exportMaterialise = function (main, statusWidget) {
  let xhr = new XMLHttpRequest();
  // xhr.open('POST', 'https://i.materialise.com/upload', true);
  // xhr.open('POST', 'uploadMaterialise.php', true);
  xhr.open('POST', 'https://i.materialise.com/web-api/tool/20cc0fd6-3cef-4111-a201-0b87026d892c/model', true);

  xhr.onprogress = function (event) {
    if (event.lengthComputable && event.total) {
      let val = Math.round(event.loaded*100.0/event.total);
      statusWidget.setMessage('Materialise upload: ' + val + '%');
    }
  };

  let hideStatus = function () {
    statusWidget.setMessage('');
  };
  xhr.onerror = hideStatus;
  xhr.onabort = hideStatus;

  xhr.onload = function () {
    hideStatus();

    if (xhr.status === 200) {
      let json = JSON.parse(xhr.responseText);
      window.open('https://i.materialise.com/en/3dprint#modelId=' + json.modelID, '_blank');
    }
  };

  let meshes = main.getMeshes();
  let box = main.computeBoundingBoxMeshes(meshes);
  let radius = main.computeRadiusFromBoundingBox(box);
  let data = ExportSTL.exportBinarySTL(meshes, {colorMagic: true, swapXY: true});

  // let blob = new Blob([data], { type: 'application/octet-stream' });
  // Export.exportFileMaterialise(radius, xhr, domStatus, blob);

  statusWidget.setMessage('Creating zip...');
  zip.useWebWorkers = true;
  zip.workerScriptsPath = 'worker/';
  zip.createWriter(new zip.BlobWriter('application/zip'), function (zipWriter) {
    zipWriter.add('yourMesh.stl', new zip.BlobReader(data), function () {
      zipWriter.close(Export.exportFileMaterialise.bind(this, radius, xhr, statusWidget));
    });
  }, onerror);

  return xhr;
};

Export.exportFileMaterialise = function (radius, xhr, statusWidget, blob) {
  if (xhr.isAborted) return;

  let fd = new FormData();
  fd.append('file', blob, 'yourMesh.zip');
  // fd.append('scale', 100 * 4.0 / radius);
  // fd.append('useAjax', 'true');
  // fd.append('plugin', '');
  // fd.append('forceEmbedding', false);

  statusWidget.setMessage('Materialise upload...');
  xhr.send(fd);
};

export default Export;
