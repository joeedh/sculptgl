import {vec3, mat4} from '../lib/gl-matrix.js';
import HoleFilling from './HoleFilling.js';
import SurfaceNets from './SurfaceNets.js';
import MarchingCubes from './MarchingCubes.js';
import Geometry from '../math3d/Geometry.js';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';
import Utils from '../misc/Utils.js';
import Enums from '../misc/Enums.js';
import Smooth from './tools/Smooth.js';

let Remesh = {};
Remesh.RESOLUTION = 150;
Remesh.BLOCK = false;
Remesh.SMOOTHING = true;

let floodFill = function (voxels) {
  let step = voxels.step;
  let res = voxels.dims;
  let rx = res[0];
  let ry = res[1];
  let rxy = rx*ry;

  let crossedEdges = voxels.crossedEdges;
  let distField = voxels.distanceField;
  let datalen = distField.length;
  let tagCell = new Uint8Array(datalen); // 0 interior, 1 exterior
  let stack = new Int32Array(datalen);

  stack[0] = 0;
  let curStack = 1;

  let dirs = [-1, 1, -rx, rx, -rxy, rxy];
  let dirsEdge = [0, 0, 1, 1, 2, 2];
  let nbDir = dirs.length;
  let i = 0;
  let idNext = 0;

  while (curStack > 0) {
    let cell = stack[--curStack];
    let cellDist = distField[cell];
    if (cellDist < step) {
      // border hit
      for (i = 0; i < nbDir; ++i) {
        let off = dirs[i];
        idNext = cell + off;
        if (idNext >= datalen || idNext < 0) continue; // range check
        if (tagCell[idNext] === 1) continue; // check if already tagged as exterior
        if (distField[idNext] === Infinity) continue; // check if we are in the far exterior zone
        if (crossedEdges[(off >= 0 ? cell : idNext)*3 + dirsEdge[i]] === 0) {
          tagCell[idNext] = 1;
          stack[curStack++] = idNext;
        }
      }
    } else {
      // exterior
      for (i = 0; i < nbDir; ++i) {
        idNext = cell + dirs[i];
        if (idNext >= datalen || idNext < 0) continue; // range check
        if (tagCell[idNext] === 1) continue; // check if already tagged as exterior
        tagCell[idNext] = 1;
        stack[curStack++] = idNext;
      }
    }
  }

  for (let id = 0; id < datalen; ++id) {
    if (distField[id] === 0) console.log('hit');
    if (tagCell[id] === 0)
      distField[id] = -distField[id];
  }
};

let voxelize = function (mesh, voxels) {
  let min = voxels.min;
  let step = voxels.step;
  let dims = voxels.dims;
  let invStep = 1.0/step;

  let vminx = min[0];
  let vminy = min[1];
  let vminz = min[2];

  let rx = dims[0];
  let ry = dims[1];
  let rxy = rx*ry;
  let distField = voxels.distanceField;
  let crossedEdges = voxels.crossedEdges;
  let colors = voxels.colorField;
  let materials = voxels.materialField;

  let iAr = mesh.getTriangles();
  let vAr = mesh.getVertices();
  let cAr = mesh.getColors();
  let mAr = mesh.getMaterials();
  let nbTriangles = mesh.getNbTriangles();

  let v1 = [0.0, 0.0, 0.0];
  let v2 = [0.0, 0.0, 0.0];
  let v3 = [0.0, 0.0, 0.0];
  let triEdge1 = [0.0, 0.0, 0.0];
  let triEdge2 = [0.0, 0.0, 0.0];
  let point = [0.0, 0.0, 0.0];
  let closest = [0.0, 0.0, 0.0, 0];
  let dirUnit = [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0]
  ];

  let inv3 = 1/3;
  for (let iTri = 0; iTri < nbTriangles; ++iTri) {
    let idTri = iTri*3;

    let iv1 = iAr[idTri]*3;
    let iv2 = iAr[idTri + 1]*3;
    let iv3 = iAr[idTri + 2]*3;

    let v1x = v1[0] = vAr[iv1];
    let v1y = v1[1] = vAr[iv1 + 1];
    let v1z = v1[2] = vAr[iv1 + 2];
    let v2x = v2[0] = vAr[iv2];
    let v2y = v2[1] = vAr[iv2 + 1];
    let v2z = v2[2] = vAr[iv2 + 2];
    let v3x = v3[0] = vAr[iv3];
    let v3y = v3[1] = vAr[iv3 + 1];
    let v3z = v3[2] = vAr[iv3 + 2];

    let c1x = (cAr[iv1] + cAr[iv2] + cAr[iv3])*inv3;
    let c1y = (cAr[iv1 + 1] + cAr[iv2 + 1] + cAr[iv3 + 1])*inv3;
    let c1z = (cAr[iv1 + 2] + cAr[iv2 + 2] + cAr[iv3 + 2])*inv3;
    let m1x = (mAr[iv1] + mAr[iv2] + mAr[iv3])*inv3;
    let m1y = (mAr[iv1 + 1] + mAr[iv2 + 1] + mAr[iv3 + 1])*inv3;
    let m1z = (mAr[iv1 + 2] + mAr[iv2 + 2] + mAr[iv3 + 2])*inv3;

    // bounding box recomputation (we already have the bbox of the quad but
    // not of the triangles...)
    let xmin = v1x < v2x ? v1x < v3x ? v1x : v3x : v2x < v3x ? v2x : v3x;
    let xmax = v1x > v2x ? v1x > v3x ? v1x : v3x : v2x > v3x ? v2x : v3x;
    let ymin = v1y < v2y ? v1y < v3y ? v1y : v3y : v2y < v3y ? v2y : v3y;
    let ymax = v1y > v2y ? v1y > v3y ? v1y : v3y : v2y > v3y ? v2y : v3y;
    let zmin = v1z < v2z ? v1z < v3z ? v1z : v3z : v2z < v3z ? v2z : v3z;
    let zmax = v1z > v2z ? v1z > v3z ? v1z : v3z : v2z > v3z ? v2z : v3z;

    // cache what can be cached for faster ray-tri and point-tri tests
    // basically edge stuffs
    let e1x = triEdge1[0] = v2x - v1x;
    let e1y = triEdge1[1] = v2y - v1y;
    let e1z = triEdge1[2] = v2z - v1z;
    let e2x = triEdge2[0] = v3x - v1x;
    let e2y = triEdge2[1] = v3y - v1y;
    let e2z = triEdge2[2] = v3z - v1z;
    let a00 = e1x*e1x + e1y*e1y + e1z*e1z;
    let a01 = e1x*e2x + e1y*e2y + e1z*e2z;
    let a11 = e2x*e2x + e2y*e2y + e2z*e2z;

    let snapMinx = Math.floor((xmin - vminx)*invStep);
    let snapMiny = Math.floor((ymin - vminy)*invStep);
    let snapMinz = Math.floor((zmin - vminz)*invStep);

    let snapMaxx = Math.ceil((xmax - vminx)*invStep);
    let snapMaxy = Math.ceil((ymax - vminy)*invStep);
    let snapMaxz = Math.ceil((zmax - vminz)*invStep);

    for (let k = snapMinz; k <= snapMaxz; ++k) {
      for (let j = snapMiny; j <= snapMaxy; ++j) {
        for (let i = snapMinx; i <= snapMaxx; ++i) {
          let x = vminx + i*step;
          let y = vminy + j*step;
          let z = vminz + k*step;
          let n = i + j*rx + k*rxy;

          point[0] = x;
          point[1] = y;
          point[2] = z;
          let newDist = Geometry.distance2PointTriangleEdges(point, triEdge1, triEdge2, v1, a00, a01, a11, closest);
          newDist = Math.sqrt(newDist);
          if (newDist < distField[n]) {
            distField[n] = newDist;
            let n3 = n*3;
            colors[n3] = c1x;
            colors[n3 + 1] = c1y;
            colors[n3 + 2] = c1z;
            materials[n3] = m1x;
            materials[n3 + 1] = m1y;
            materials[n3 + 2] = m1z;
          }

          if (newDist > step)
            continue;

          for (let it = 0; it < 3; ++it) {
            let val = closest[it] - point[it];
            if (val < 0.0 || val > step)
              continue;

            let idEdge = n*3 + it;
            if (crossedEdges[idEdge] === 1)
              continue;

            let dist = Geometry.intersectionRayTriangleEdges(point, dirUnit[it], triEdge1, triEdge2, v1);
            if (dist < 0.0 || dist > step)
              continue;

            crossedEdges[idEdge] = 1;
          }

        }
      }
    }
  }
};

// grid structure
let createVoxelData = function (box) {
  let step = Math.max((box[3] - box[0]), (box[4] - box[1]), (box[5] - box[2]))/Remesh.RESOLUTION;
  let stepMin = step*1.51;
  let stepMax = step*1.51;
  let min = [box[0] - stepMin, box[1] - stepMin, box[2] - stepMin];
  let max = [box[3] + stepMax, box[4] + stepMax, box[5] + stepMax];

  let rx = Math.ceil((max[0] - min[0])/step);
  let ry = Math.ceil((max[1] - min[1])/step);
  let rz = Math.ceil((max[2] - min[2])/step);

  let datalen = rx*ry*rz;
  let buffer = Utils.getMemory((4*(1 + 3 + 3) + 3)*datalen);
  let distField = new Float32Array(buffer, 0, datalen);
  let colors = new Float32Array(buffer, 4*datalen, datalen*3);
  let materials = new Float32Array(buffer, 16*datalen, datalen*3);
  let crossedEdges = new Uint8Array(buffer, 28*datalen, datalen*3);

  // Initialize data
  for (let idf = 0; idf < datalen; ++idf) {
    distField[idf] = Infinity;
  }

  for (let ide = 0, datalene = datalen*3; ide < datalene; ++ide) {
    crossedEdges[ide] = 0;
  }

  for (let idc = 0, datalenc = datalen*3; idc < datalenc; ++idc) {
    colors[idc] = materials[idc] = -1;
  }

  let voxels = {};
  voxels.dims = [rx, ry, rz];
  voxels.step = step;
  voxels.min = min;
  voxels.max = max;
  voxels.crossedEdges = crossedEdges;
  voxels.distanceField = distField;
  voxels.colorField = colors;
  voxels.materialField = materials;
  return voxels;
};

let createMesh = function (mesh, faces, vertices, colors, materials) {
  let newMesh = new MeshStatic(mesh.getGL());
  newMesh.setID(mesh.getID());
  newMesh.setFaces(faces);
  newMesh.setVertices(vertices);
  if (colors) newMesh.setColors(colors);
  if (materials) newMesh.setMaterials(materials);
  newMesh.setRenderData(mesh.getRenderData());
  newMesh.init();
  newMesh.initRender();
  return newMesh;
};

// hole filling + transform to world + ComputeBox
let prepareMeshes = function (meshes) {
  let box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let tmp = [0.0, 0.0, 0.0];
  for (let i = 0, nbm = meshes.length; i < nbm; ++i) {
    let mesh = meshes[i];
    if (mesh.isUsingTexCoords())
      mesh.setShaderType(Enums.Shader.MATCAP);
    let matrix = mesh.getMatrix();

    mesh = meshes[i] = HoleFilling.createClosedMesh(mesh);
    let vAr = mesh.getVertices();
    for (let j = 0, nbv = mesh.getNbVertices(); j < nbv; ++j) {
      let id = j*3;
      tmp[0] = vAr[id];
      tmp[1] = vAr[id + 1];
      tmp[2] = vAr[id + 2];
      vec3.transformMat4(tmp, tmp, matrix);
      let x = vAr[id] = tmp[0];
      let y = vAr[id + 1] = tmp[1];
      let z = vAr[id + 2] = tmp[2];
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (z < box[2]) box[2] = z;
      if (x > box[3]) box[3] = x;
      if (y > box[4]) box[4] = y;
      if (z > box[5]) box[5] = z;
    }
  }
  return box;
};

let alignMeshBound = function (mesh, box) {
  let oldMin = [box[0], box[1], box[2]];
  let oldMax = [box[3], box[4], box[5]];
  let oldRadius = vec3.dist(oldMin, oldMax);
  let oldCenter = vec3.add([], oldMin, oldMax);
  vec3.scale(oldCenter, oldCenter, 0.5);

  let newBox = mesh.getLocalBound();
  let newMin = [newBox[0], newBox[1], newBox[2]];
  let newMax = [newBox[3], newBox[4], newBox[5]];
  let newRadius = vec3.dist(newMin, newMax);
  let newCenter = vec3.add([], newMin, newMax);
  vec3.scale(newCenter, newCenter, 0.5);

  let scale = oldRadius/newRadius;
  let tr = vec3.scale([], oldCenter, 1.0/scale);
  vec3.sub(tr, tr, newCenter);

  let mat = mesh.getMatrix();
  mat4.identity(mat);
  mat4.scale(mat, mat, [scale, scale, scale]);
  mat4.translate(mat, mat, tr);
};

let tangentialSmoothing = function (mesh) {
  let nbVertices = mesh.getNbVertices();
  let indices = new Uint32Array(nbVertices);
  for (let i = 0; i < nbVertices; ++i) {
    indices[i] = i;
  }

  let smo = new Smooth();
  smo.setToolMesh(mesh);
  smo.smoothTangent(indices, 1.0);
  mesh.updateGeometry();
  mesh.updateGeometryBuffers();
};

Remesh.remesh = function (meshes, baseMesh, manifold) {
  console.time('remesh total');

  console.time('1. prepareMeshes');
  meshes = meshes.slice();
  let box = prepareMeshes(meshes);
  console.timeEnd('1. prepareMeshes');

  console.time('2. voxelization');
  let voxels = createVoxelData(box);
  for (let i = 0, l = meshes.length; i < l; ++i) {
    voxelize(meshes[i], voxels);
  }
  console.timeEnd('2. voxelization');

  console.time('3. flood');
  floodFill(voxels);
  console.timeEnd('3. flood');

  let res;
  if (manifold) {
    console.time('4. marchingCubes');
    MarchingCubes.BLOCK = Remesh.BLOCK;
    res = MarchingCubes.computeSurface(voxels);
    console.timeEnd('4. marchingCubes');
  } else {
    console.time('4. surfaceNets');
    SurfaceNets.BLOCK = Remesh.BLOCK;
    res = SurfaceNets.computeSurface(voxels);
    console.timeEnd('4. surfaceNets');
  }

  console.time('5. createMesh');
  let nmesh = createMesh(baseMesh, res.faces, res.vertices, res.colors, res.materials);
  console.timeEnd('5. createMesh');

  alignMeshBound(nmesh, box);

  if (manifold && Remesh.SMOOTHING) {
    console.time('6. tangential smoothing');
    tangentialSmoothing(nmesh);
    console.timeEnd('6. tangential smoothing');
  }

  console.timeEnd('remesh total');
  console.log('\n');
  return nmesh;
};

Remesh.mergeArrays = function (meshes, arr) {
  let nbVertices = 0;
  let nbFaces = 0;
  let nbQuads = 0;
  let nbTriangles = 0;
  let i, j;

  let nbMeshes = meshes.length;
  let k = 0;
  for (i = 0; i < nbMeshes; ++i) {
    nbVertices += meshes[i].getNbVertices();
    nbFaces += meshes[i].getNbFaces();
    nbQuads += meshes[i].getNbQuads();
    nbTriangles += meshes[i].getNbTriangles();
  }

  arr.nbVertices = nbVertices;
  arr.nbFaces = nbFaces;
  arr.nbQuads = nbQuads;
  arr.nbTriangles = nbTriangles;

  let vAr = arr.vertices = arr.vertices !== undefined ? new Float32Array(nbVertices*3) : null;
  let cAr = arr.colors = arr.colors !== undefined ? new Float32Array(nbVertices*3) : null;
  let mAr = arr.materials = arr.materials !== undefined ? new Float32Array(nbVertices*3) : null;
  let fAr = arr.faces = arr.faces !== undefined ? new Uint32Array(nbFaces*4) : null;
  let iAr = arr.triangles = arr.triangles !== undefined ? new Uint32Array(nbTriangles*3) : null;

  let ver = [0.0, 0.0, 0.0];
  let offsetVerts = 0;
  let offsetFaces = 0;
  let offsetTris = 0;
  let offsetIndex = 0;
  for (i = 0; i < nbMeshes; ++i) {
    let mesh = meshes[i];
    let mVerts = mesh.getVertices();
    let mCols = mesh.getColors();
    let mMats = mesh.getMaterials();
    let mFaces = mesh.getFaces();
    let mTris = mesh.getTriangles();

    let mNbVertices = mesh.getNbVertices();
    let mNbFaces = mesh.getNbFaces();
    let mNbTriangles = mesh.getNbTriangles();
    let matrix = mesh.getMatrix();

    for (j = 0; j < mNbVertices; ++j) {
      k = j*3;
      ver[0] = mVerts[k];
      ver[1] = mVerts[k + 1];
      ver[2] = mVerts[k + 2];
      vec3.transformMat4(ver, ver, matrix);
      vAr[offsetVerts + k] = ver[0];
      vAr[offsetVerts + k + 1] = ver[1];
      vAr[offsetVerts + k + 2] = ver[2];
      if (cAr) {
        cAr[offsetVerts + k] = mCols[k];
        cAr[offsetVerts + k + 1] = mCols[k + 1];
        cAr[offsetVerts + k + 2] = mCols[k + 2];
      }
      if (mAr) {
        mAr[offsetVerts + k] = mMats[k];
        mAr[offsetVerts + k + 1] = mMats[k + 1];
        mAr[offsetVerts + k + 2] = mMats[k + 2];
      }
    }

    offsetVerts += mNbVertices*3;
    if (fAr) {
      for (j = 0; j < mNbFaces; ++j) {
        k = j*4;
        fAr[offsetFaces + k] = mFaces[k] + offsetIndex;
        fAr[offsetFaces + k + 1] = mFaces[k + 1] + offsetIndex;
        fAr[offsetFaces + k + 2] = mFaces[k + 2] + offsetIndex;
        fAr[offsetFaces + k + 3] = mFaces[k + 3] === Utils.TRI_INDEX ? Utils.TRI_INDEX : mFaces[k + 3] + offsetIndex;
      }
    }

    if (iAr) {
      for (j = 0; j < mNbTriangles; ++j) {
        k = j*3;
        iAr[offsetTris + k] = mTris[k] + offsetIndex;
        iAr[offsetTris + k + 1] = mTris[k + 1] + offsetIndex;
        iAr[offsetTris + k + 2] = mTris[k + 2] + offsetIndex;
      }
    }

    offsetIndex += mNbVertices;
    offsetFaces += mNbFaces*4;
    offsetTris += mNbTriangles*3;
  }

  return arr;
};

Remesh.mergeMeshes = function (meshes, baseMesh) {
  let arr = {vertices: null, colors: null, materials: null, faces: null};
  Remesh.mergeArrays(meshes, arr);
  return createMesh(baseMesh, arr.faces, arr.vertices, arr.colors, arr.materials);
};

export default Remesh;
