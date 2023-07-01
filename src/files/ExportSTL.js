import {vec3} from '../lib/gl-matrix.js';
import Remesh from '../editing/Remesh.js';

let Export = {};

let getResult = function (meshes) {
  let res = Remesh.mergeArrays(meshes, {vertices: null, colors: null, triangles: null});

  let vAr = res.vertices;
  let iAr = res.triangles;

  let v1 = vec3.create();
  let v2 = vec3.create();
  let v3 = vec3.create();
  let nAr = res.faceNormals = new Float32Array(res.nbTriangles*3);
  for (let i = 0; i < res.nbTriangles; ++i) {
    let id = i*3;
    let i1 = iAr[id]*3;
    let i2 = iAr[id + 1]*3;
    let i3 = iAr[id + 2]*3;
    vec3.set(v1, vAr[i1], vAr[i1 + 1], vAr[i1 + 2]);
    vec3.set(v2, vAr[i2], vAr[i2 + 1], vAr[i2 + 2]);
    vec3.set(v3, vAr[i3], vAr[i3 + 1], vAr[i3 + 2]);

    vec3.sub(v2, v2, v1); // v2 = v2 - v1
    vec3.sub(v3, v3, v2); // v3 = v3 - v1
    vec3.cross(v1, v2, v3); // v1 = v2 ^ v3
    vec3.normalize(v1, v1);

    nAr[id] = v1[0];
    nAr[id + 1] = v1[1];
    nAr[id + 2] = v1[2];
  }

  return res;
};

/** Export Ascii STL file */
Export.exportAsciiSTL = function (meshes) {
  let res = getResult(meshes);
  let nbTriangles = res.nbTriangles;
  let vAr = res.vertices;
  let iAr = res.triangles;
  let fnAr = res.faceNormals;

  let data = 'solid mesh\n';
  for (let i = 0; i < nbTriangles; ++i) {
    let id = i*3;
    data += ' facet normal ' + fnAr[id] + ' ' + fnAr[id + 1] + ' ' + fnAr[id + 2] + '\n';
    data += '  outer loop\n';
    let iv1 = iAr[id]*3;
    let iv2 = iAr[id + 1]*3;
    let iv3 = iAr[id + 2]*3;
    data += '   vertex ' + vAr[iv1] + ' ' + vAr[iv1 + 1] + ' ' + vAr[iv1 + 2] + '\n';
    data += '   vertex ' + vAr[iv2] + ' ' + vAr[iv2 + 1] + ' ' + vAr[iv2 + 2] + '\n';
    data += '   vertex ' + vAr[iv3] + ' ' + vAr[iv3 + 1] + ' ' + vAr[iv3 + 2] + '\n';
    data += '  endloop\n';
    data += ' endfacet\n';
  }
  data += 'endsolid mesh\n';
  return new Blob([data]);
};

/** Export binary STL file */
Export.exportBinarySTL = function (meshes, opt) {
  let res = getResult(meshes);
  let nbTriangles = res.nbTriangles;
  let vAr = res.vertices;
  let cAr = res.colors;
  let iAr = res.triangles;
  let fnAr = res.faceNormals;
  let i, k;

  if (opt && opt.swapXY) {
    let nbVertices = res.nbVertices;
    for (i = 0; i < nbVertices; ++i) {
      k = i*3;
      let yVal = vAr[k + 1];
      vAr[k + 1] = -vAr[k + 2];
      vAr[k + 2] = yVal;
    }
  }

  let data = new Uint8Array(84 + nbTriangles*50);

  let colorMagic = opt && opt.colorMagic;
  if (colorMagic) {
    // COLOR=255,255,255,255
    let hdr = [67, 79, 76, 79, 82, 61, 255, 255, 255, 255];
    for (i = 0; i < hdr.length; ++i) {
      data[i] = hdr[i];
    }
  }

  (new DataView(data.buffer)).setUint32(80, nbTriangles, true);

  let verBuffer = new Uint8Array(vAr.buffer);
  let norBuffer = new Uint8Array(fnAr.buffer);
  let offset = 84;
  let inc = 0;

  let colorActivate = colorMagic ? 0 : (1<<15);

  let mulc = 31/3;
  for (i = 0; i < nbTriangles; ++i) {
    k = i*12;
    for (inc = 0; inc < 12; ++inc) {
      data[offset++] = norBuffer[k++];
    }
    k = i*3;
    let iv1 = iAr[k]*3;
    let iv2 = iAr[k + 1]*3;
    let iv3 = iAr[k + 2]*3;

    let id1 = iv1*4;
    for (inc = 0; inc < 12; ++inc) {
      data[offset++] = verBuffer[id1++];
    }
    let id2 = iv2*4;
    for (inc = 0; inc < 12; ++inc) {
      data[offset++] = verBuffer[id2++];
    }
    let id3 = iv3*4;
    for (inc = 0; inc < 12; ++inc) {
      data[offset++] = verBuffer[id3++];
    }

    let r = Math.round((cAr[iv1] + cAr[iv2] + cAr[iv3])*mulc);
    let g = Math.round((cAr[iv1 + 1] + cAr[iv2 + 1] + cAr[iv3 + 1])*mulc)<<5;
    let b = Math.round((cAr[iv1 + 2] + cAr[iv2 + 2] + cAr[iv3 + 2])*mulc);

    if (colorMagic) {
      b = b<<10;
    } else {
      r = r<<10;
    }

    let col = r + g + b + colorActivate;
    data[offset++] = col & 255;
    data[offset++] = col>>8;
  }
  return new Blob([data]);
};

export default Export;
