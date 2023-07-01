import Utils from '../misc/Utils.js';
import Remesh from '../editing/Remesh.js';

let Export = {};

let getResult = function (meshes) {
  return Remesh.mergeArrays(meshes, {vertices: null, colors: null, faces: null});
};

/** Export Ascii PLY file */
Export.exportAsciiPLY = function (meshes) {
  let res = getResult(meshes);
  let nbVertices = res.nbVertices;
  let nbFaces = res.nbFaces;
  let vAr = res.vertices;
  let cAr = res.colors;
  let fAr = res.faces;

  let i = 0;
  let j = 0;
  let data = 'ply\nformat ascii 1.0\ncomment created by SculptGL\n';
  data += 'element vertex ' + nbVertices + '\n';
  data += 'property float x\nproperty float y\nproperty float z\n';
  data += 'property uchar red\nproperty uchar green\nproperty uchar blue\n';
  data += 'element face ' + nbFaces + '\n';
  data += 'property list uchar uint vertex_indices\nend_header\n';

  for (i = 0; i < nbVertices; ++i) {
    j = i*3;
    data += vAr[j] + ' ' +
      vAr[j + 1] + ' ' +
      vAr[j + 2] + ' ' +
      ((cAr[j]*0xff) | 0) + ' ' +
      ((cAr[j + 1]*0xff) | 0) + ' ' +
      ((cAr[j + 2]*0xff) | 0) + '\n';
  }

  for (i = 0; i < nbFaces; ++i) {
    j = i*4;
    let id = fAr[j + 3];
    let isQuad = id !== Utils.TRI_INDEX;
    data += (isQuad ? '4 ' : '3 ') + fAr[j] + ' ' + fAr[j + 1] + ' ' + fAr[j + 2] + (isQuad ? ' ' + id + '\n' : '\n');
  }
  return new Blob([data]);
};

/** Export binary PLY file */
Export.exportBinaryPLY = function (meshes, opt) {
  let res = getResult(meshes);
  let nbVertices = res.nbVertices;
  let nbFaces = res.nbFaces;
  let nbQuads = res.nbQuads;
  let nbTriangles = res.nbTriangles;
  let vAr = res.vertices;
  let cAr = res.colors;
  let fAr = res.faces;

  let i = 0;
  let j = 0;
  let k = 0;

  if (opt && opt.swapXY) {
    for (i = 0; i < nbVertices; ++i) {
      k = i*3;
      let yVal = vAr[k + 1];
      vAr[k + 1] = -vAr[k + 2];
      vAr[k + 2] = yVal;
    }
  }

  let endian = Utils.littleEndian ? 'little' : 'big';
  let header = 'ply\nformat binary_' + endian + '_endian 1.0\ncomment created by SculptGL\n';
  header += 'element vertex ' + nbVertices + '\n';
  header += 'property float x\nproperty float y\nproperty float z\n';
  header += 'property uchar red\nproperty uchar green\nproperty uchar blue\n';
  header += 'element face ' + nbFaces + '\n';
  header += 'property list uchar uint vertex_indices\nend_header\n';

  let vertSize = vAr.length*4 + cAr.length;
  let indexSize = (nbQuads*4 + nbTriangles*3)*4 + nbFaces;
  let totalSize = header.length + vertSize + indexSize*2;
  let data = new Uint8Array(totalSize);
  let dview = new DataView(data.buffer);

  j = header.length;
  let posOc = 0;
  for (posOc = 0; posOc < j; ++posOc) {
    data[posOc] = header.charCodeAt(posOc);
  }

  for (i = 0; i < nbVertices; ++i) {
    j = i*3;
    dview.setFloat32(posOc, vAr[j], true);
    posOc += 4;
    dview.setFloat32(posOc, vAr[j + 1], true);
    posOc += 4;
    dview.setFloat32(posOc, vAr[j + 2], true);
    posOc += 4;

    dview.setUint8(posOc, Math.round(255.0*cAr[j]));
    posOc += 1;
    dview.setUint8(posOc, Math.round(255.0*cAr[j + 1]));
    posOc += 1;
    dview.setUint8(posOc, Math.round(255.0*cAr[j + 2]));
    posOc += 1;
  }

  for (i = 0; i < nbFaces; ++i) {
    j = i*4;
    let isQuad = fAr[j + 3] !== Utils.TRI_INDEX;

    dview.setUint8(posOc, isQuad ? 4 : 3);
    posOc += 1;

    dview.setUint32(posOc, fAr[j], true);
    posOc += 4;
    dview.setUint32(posOc, fAr[j + 1], true);
    posOc += 4;
    dview.setUint32(posOc, fAr[j + 2], true);
    posOc += 4;
    if (isQuad) {
      dview.setUint32(posOc, fAr[j + 3], true);
      posOc += 4;
    }
  }

  return new Blob([data]);
};

export default Export;
