import Utils from '../misc/Utils.js';
import MeshStatic from '../mesh/meshStatic/MeshStatic.js';
import Mesh from '../mesh/Mesh.js';

let Edge = function (v1, v2) {
  this.previous = null;
  this.next = null;
  this.v1 = v1;
  this.v2 = v2;
};

let detectHole = function (borderEdges) {
  if (borderEdges.length <= 2)
    return;
  let nbEdges = borderEdges.length;
  let iEnd = borderEdges[0].v1;
  let iLast = borderEdges[0].v2;
  let first = borderEdges[0];
  let last = first;

  borderEdges[0] = borderEdges[--nbEdges];
  let i = 0;
  while (i < nbEdges) {
    let testEdge = borderEdges[i];
    if (testEdge.v1 === iLast) {
      testEdge.previous = last;
      last.next = testEdge;
      last = testEdge;
      iLast = borderEdges[i].v2;
      borderEdges[i] = borderEdges[--nbEdges];
      if (iLast === iEnd)
        break;
      i = 0;
    } else
      i++;
  }
  borderEdges.length = nbEdges;
  if (iLast !== iEnd)
    return;
  first.previous = last;
  last.next = first;
  return first;
};

let detectHoles = function (mesh) {
  let eAr = mesh.getEdges();
  let fAr = mesh.getFaces();
  let feAr = mesh.getFaceEdges();
  let borderEdges = [];
  for (let i = 0, len = mesh.getNbFaces(); i < len; ++i) {
    let id = i*4;
    let iv4 = feAr[id + 3];
    let isQuad = iv4 !== Utils.TRI_INDEX;
    if (eAr[feAr[id]] === 1) borderEdges.push(new Edge(fAr[id], fAr[id + 1]));
    if (eAr[feAr[id + 1]] === 1) borderEdges.push(new Edge(fAr[id + 1], fAr[id + 2]));
    if (eAr[feAr[id + 2]] === 1) borderEdges.push(new Edge(fAr[id + 2], fAr[isQuad ? id + 3 : id]));
    if (isQuad && eAr[iv4] === 1) borderEdges.push(new Edge(fAr[id + 3], fAr[id]));
  }

  let holes = [];
  while (true) {
    let firstEdge = detectHole(borderEdges);
    if (!firstEdge) break;
    holes.push(firstEdge);
  }
  return holes;
};

let advancingFrontMesh = function (mesh, firstEdge, newTris, newVerts, newColors, newMaterials) {
  let vAr = mesh.getVertices();
  let cAr = mesh.getColors();
  let mAr = mesh.getMaterials();
  // let current = firstEdge;
  // let count = 1;
  // while (current.next !== firstEdge) {
  //   current = current.next;
  //   count++;
  // }
  // console.log(count)

  // TODO : stupid naive hole filling for now
  let last = mesh.getNbVertices() + newVerts.length/3;
  let current = firstEdge;
  let avx = 0.0;
  let avy = 0.0;
  let avz = 0.0;

  let colr = 0.0;
  let colg = 0.0;
  let colb = 0.0;

  let mat1 = 0.0;
  let mat2 = 0.0;
  let mat3 = 0.0;
  let count = 0;
  do {
    let next = current.next;
    let iv1 = current.v1;
    let iv2 = current.v2;
    let iv3 = next.v2;

    newTris.push(iv1, iv2, last, Utils.TRI_INDEX);
    iv1 *= 3;
    iv2 *= 3;
    iv3 *= 3;
    count++;
    avx += vAr[iv1];
    avy += vAr[iv1 + 1];
    avz += vAr[iv1 + 2];

    colr += cAr[iv1];
    colg += cAr[iv1 + 1];
    colb += cAr[iv1 + 2];

    mat1 += mAr[iv1];
    mat2 += mAr[iv1 + 1];
    mat3 += mAr[iv1 + 2];

    let v2x = vAr[iv2];
    let v2y = vAr[iv2 + 1];
    let v2z = vAr[iv2 + 2];
    // compute normals
    let ax = vAr[iv1] - v2x;
    let ay = vAr[iv1 + 1] - v2y;
    let az = vAr[iv1 + 2] - v2z;
    let bx = vAr[iv3] - v2x;
    let by = vAr[iv3 + 1] - v2y;
    let bz = vAr[iv3 + 2] - v2z;
    let alen = ax*ax + ay*ay + az*az;
    let blen = bx*bx + by*by + bz*bz;
    current.angle = Math.acos((ax*bx + ay*by + az*bz)/Math.sqrt(alen*blen));
    current = next;
  } while (current !== firstEdge);

  newVerts.push(avx/count, avy/count, avz/count);
  newColors.push(colr/count, colg/count, colb/count);
  newMaterials.push(mat1/count, mat2/count, mat3/count);
};

let createMesh = function (mesh, vertices, faces, colors, materials) {
  let newMesh = new MeshStatic();
  newMesh.setID(mesh.getID());
  newMesh.setVertices(vertices);
  if (colors) newMesh.setColors(colors);
  if (materials) newMesh.setMaterials(materials);
  newMesh.setFaces(faces);

  // small hack
  newMesh.setTransformData(mesh.getTransformData());
  newMesh.setRenderData(mesh.getRenderData());

  Mesh.OPTIMIZE = false;
  newMesh.init();
  Mesh.OPTIMIZE = true;

  return newMesh;
};

let closeHoles = function (mesh) {
  let holes = detectHoles(mesh);
  if (holes.length === 0)
    return mesh;

  let newFaces = [];
  let newVerts = [];
  let newColors = [];
  let newMaterials = [];
  // console.time('closeHoles');
  for (let i = 0, nbHoles = holes.length; i < nbHoles; ++i) {
    advancingFrontMesh(mesh, holes[i], newFaces, newVerts, newColors, newMaterials);
  }
  // console.timeEnd('closeHoles');

  let oldVertsLen = mesh.getNbVertices()*3;
  let newVertsLen = oldVertsLen + newVerts.length;

  // set vertices
  let vertices = new Float32Array(newVertsLen);
  vertices.set(mesh.getVertices().subarray(0, oldVertsLen));
  // set colors
  let colors = new Float32Array(newVertsLen);
  colors.set(mesh.getColors().subarray(0, oldVertsLen));
  // set materials
  let materials = new Float32Array(newVertsLen);
  materials.set(mesh.getMaterials().subarray(0, oldVertsLen));

  if (newVertsLen > oldVertsLen) {
    vertices.set(newVerts, oldVertsLen);
    colors.set(newColors, oldVertsLen);
    materials.set(newMaterials, oldVertsLen);
  }

  // set faces
  let faces = new Uint32Array(mesh.getNbFaces()*4 + newFaces.length);
  faces.set(mesh.getFaces());
  if (newFaces.length > 0)
    faces.set(newFaces, mesh.getNbFaces()*4);

  return createMesh(mesh, vertices, faces, colors, materials);
};

let HoleFilling = {};

HoleFilling.createClosedMesh = function (mesh) {
  let closed = closeHoles(mesh);
  if (closed === mesh) {
    let lenv = mesh.getNbVertices()*3;
    let lenf = mesh.getNbFaces()*4;
    let faces = new Uint32Array(mesh.getFaces().subarray(0, lenf));
    let vertices = new Float32Array(mesh.getVertices().subarray(0, lenv));
    let colors = new Float32Array(mesh.getColors().subarray(0, lenv));
    let materials = new Float32Array(mesh.getMaterials().subarray(0, lenv));
    closed = createMesh(mesh, vertices, faces, colors, materials);
  }
  return closed;
};

export default HoleFilling;
