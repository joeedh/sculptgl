import {vec3, mat3, mat4} from '../lib/gl-matrix.js';
import Enums from '../misc/Enums.js';
import Utils from '../misc/Utils.js';
import OctreeCell from '../math3d/OctreeCell.js';
import Shader from '../render/ShaderLib.js';
import RenderData from './RenderData.js';

/*
Basic usage:
let mesh = new MeshStatic(gl); // provide gl only if we need to render the mesh
mesh.setVertices(vertices); // vec3 xyz
mesh.setFaces(faces); // ivec4 abcd (d=Utils.TRI_INDEX if tri)

// these are optional
mesh.setColors(colors); // vec3 rgb
mesh.setMaterials(materials); // vec3 roughness/metalness/masking
mesh.initTexCoordsDataFromOBJData(UV, facesUV); // vec2, ivec4

mesh.init(); // compute octree/topo/UV, etc...
mesh.initRender(); // only if gl has been provided
*/

let DEF_ROUGHNESS = 0.18; // 0.18;
let DEF_METALNESS = 0.08; // 0.08;

class Mesh {

  constructor() {
    this._id = Mesh.ID++; // useful id to retrieve a mesh (dynamic mesh, multires mesh, voxel mesh)
    this._meshData = null;
    this._transformData = null;
    this._renderData = null;
    this._isVisible = true;
  }

  static sortFunction(meshA, meshB) {
    // render transparent (back to front) after opaque (front to back) ones
    let aTr = meshA.isTransparent();
    let bTr = meshB.isTransparent();
    if (aTr && !bTr) return 1;
    if (!aTr && bTr) return -1;
    return (meshB.getDepth() - meshA.getDepth())*(aTr && bTr ? 1.0 : -1.0);
  }

  setID(id) {
    this._id = id;
  }

  isVisible() {
    return this._isVisible;
  }

  setVisible(bool) {
    this._isVisible = bool;
  }

  setVertices(vAr) {
    this._meshData._verticesXYZ = vAr;
    this._meshData._nbVertices = vAr.length/3;
  }

  setFaces(fAr) {
    this._meshData._facesABCD = fAr;
    this._meshData._nbFaces = fAr.length/4;
  }

  setTexCoords(tAr) {
    this._meshData._texCoordsST = tAr;
    this._meshData._nbTexCoords = tAr.length/2;
  }

  setColors(cAr) {
    this._meshData._colorsRGB = cAr;
  }

  setMaterials(mAr) {
    this._meshData._materialsPBR = mAr;
  }

  setVerticesDuplicateStartCount(startCount) {
    this._meshData._duplicateStartCount = startCount;
  }

  setFacesTexCoord(fuAr) {
    this._meshData._UVfacesABCD = fuAr;
  }

  setMeshData(mdata) {
    this._meshData = mdata;
  }

  setRenderData(rdata) {
    this._renderData = rdata;
  }

  setTransformData(tdata) {
    this._transformData = tdata;
  }

  setNbVertices(nbVertices) {
    this._meshData._nbVertices = nbVertices;
  }

  setNbFaces(nbFaces) {
    this._meshData._nbFaces = nbFaces;
  }

  getID() {
    return this._id;
  }

  getRenderData() {
    return this._renderData;
  }

  getMeshData() {
    return this._meshData;
  }

  getTransformData() {
    return this._transformData;
  }

  getNbVertices() {
    return this._meshData._nbVertices;
  }

  getNbFaces() {
    return this._meshData._nbFaces;
  }

  getNbQuads() {
    return this.getNbTriangles() - this.getNbFaces();
  }

  getNbTriangles() {
    return this._meshData._trianglesABC.length/3;
  }

  getNbTexCoords() {
    return this._meshData._nbTexCoords;
  }

  hasUV() {
    return this._meshData._texCoordsST !== null;
  }

  getVertices() {
    return this._meshData._verticesXYZ;
  }

  getColors() {
    return this._meshData._colorsRGB;
  }

  getNormals() {
    return this._meshData._normalsXYZ;
  }

  getMaterials() {
    return this._meshData._materialsPBR;
  }

  getVerticesTagFlags() {
    return this._meshData._vertTagFlags;
  }

  getVerticesSculptFlags() {
    return this._meshData._vertSculptFlags;
  }

  getVerticesStateFlags() {
    return this._meshData._vertStateFlags;
  }

  getVerticesRingVertStartCount() {
    return this._meshData._vrvStartCount;
  }

  getVerticesRingVert() {
    return this._meshData._vertRingVert;
  }

  getVerticesRingFaceStartCount() {
    return this._meshData._vrfStartCount;
  }

  getVerticesRingFace() {
    return this._meshData._vertRingFace;
  }

  getVerticesOnEdge() {
    return this._meshData._vertOnEdge;
  }

  getVerticesProxy() {
    return this._meshData._vertProxy;
  }

  getFaces() {
    return this._meshData._facesABCD;
  }

  hasOnlyTriangles() {
    return this.getNbTriangles() === this.getNbFaces();
  }

  hasOnlyQuads() {
    return this.getNbTriangles() === this.getNbFaces()*2;
  }

  getFaceNormals() {
    return this._meshData._faceNormalsXYZ;
  }

  getFaceBoxes() {
    return this._meshData._faceBoxes;
  }

  getFaceCenters() {
    return this._meshData._faceCentersXYZ;
  }

  getFacesTagFlags() {
    return this._meshData._facesTagFlags;
  }

  getFaceEdges() {
    return this._meshData._faceEdges;
  }

  getFacesToTriangles() {
    return this._meshData._facesToTriangles;
  }

  getTrianglesTexCoord() {
    return this._meshData._UVtrianglesABC;
  }

  getTriangles() {
    return this._meshData._trianglesABC;
  }

  getEdges() {
    return this._meshData._edges;
  }

  getNbEdges() {
    return this._meshData._edges.length;
  }

  getTexCoords() {
    return this._meshData._texCoordsST;
  }

  getVerticesDuplicateStartCount() {
    return this._meshData._duplicateStartCount;
  }

  getFacesTexCoord() {
    return this._meshData._UVfacesABCD;
  }

  getVerticesDrawArrays() {
    if (!this._meshData._DAverticesXYZ) this.updateDrawArrays();
    return this._meshData._DAverticesXYZ;
  }

  getNormalsDrawArrays() {
    return this._meshData._DAnormalsXYZ;
  }

  getColorsDrawArrays() {
    return this._meshData._DAcolorsRGB;
  }

  getMaterialsDrawArrays() {
    return this._meshData._DAmaterialsPBR;
  }

  getTexCoordsDrawArrays() {
    return this._meshData._DAtexCoordsST;
  }

  getOctree() {
    return this._meshData._octree;
  }

  getCenter() {
    return this._transformData._center;
  }

  getMV() {
    return this._transformData._lastComputedMV;
  }

  getMVP() {
    return this._transformData._lastComputedMVP;
  }

  getN() {
    return this._transformData._lastComputedN;
  }

  getEN() {
    return this._transformData._lastComputedEN;
  }

  getDepth() {
    return this._transformData._lastComputedDepth;
  }

  getMatrix() {
    return this._transformData._matrix;
  }

  getEditMatrix() {
    return this._transformData._editMatrix;
  }

  getScale2() {
    let m = this._transformData._matrix;
    return m[0]*m[0] + m[4]*m[4] + m[8]*m[8];
  }

  getScale() {
    return Math.sqrt(this.getScale2());
  }

  getSymmetryOrigin() {
    let orig = vec3.create();
    let tdata = this._transformData;
    let offset = tdata._symmetryOffset*this.computeLocalRadius();
    return vec3.scaleAndAdd(orig, tdata._center, tdata._symmetryNormal, offset);
  }

  getSymmetryOffset() {
    return this._transformData._symmetryOffset;
  }

  setSymmetryOffset(offset) {
    this._transformData._symmetryOffset = offset;
  }

  getSymmetryNormal() {
    return this._transformData._symmetryNormal;
  }

  getFacePosInLeaf() {
    return this._meshData._facePosInLeaf;
  }

  getFaceLeaf() {
    return this._meshData._faceLeaf;
  }

  getLeavesToUpdate() {
    return this._meshData._leavesToUpdate;
  }

  getLocalBound() {
    return this._meshData._octree._aabbLoose;
  }

  getRenderNbEdges() {
    return this.getNbEdges();
  }

  init() {
    this.initColorsAndMaterials();
    this.allocateArrays();
    this.initTopology();
    this.updateGeometry();
    if (this._renderData)
      this.updateDuplicateColorsAndMaterials();
    this.updateCenter();
  }

  initTopology() {
    this.initFaceRings();
    this.optimize();
    this.initEdges();
    this.initVertexRings();
    this.initRenderTriangles();
  }

  updateGeometry(iFaces, iVerts) {
    this.updateFacesAabbAndNormal(iFaces);
    this.updateVerticesNormal(iVerts);
    this.updateOctree(iFaces);
    if (this._renderData) {
      this.updateDuplicateGeometry(iVerts);
      this.updateDrawArrays(iFaces);
    }
  }

  allocateArrays() {
    let nbVertices = this.getNbVertices();

    if (this.hasUV()) {
      let nbTexCoords = this._meshData._texCoordsST.length/2;

      let tmp = new Float32Array(nbTexCoords*3);
      tmp.set(this._meshData._verticesXYZ);
      this._meshData._verticesXYZ = tmp;

      this._meshData._normalsXYZ = new Float32Array(nbTexCoords*3);

      tmp = new Float32Array(nbTexCoords*3);
      if (this._meshData._colorsRGB) tmp.set(this._meshData._colorsRGB);
      this._meshData._colorsRGB = tmp;

      tmp = new Float32Array(nbTexCoords*3);
      if (this._meshData._materialsPBR) tmp.set(this._meshData._materialsPBR);
      this._meshData._materialsPBR = tmp;

    } else {
      this._meshData._normalsXYZ = this._meshData._normalsXYZ || new Float32Array(nbVertices*3);
      this._meshData._colorsRGB = this._meshData._colorsRGB || new Float32Array(nbVertices*3);
      this._meshData._materialsPBR = this._meshData._materialsPBR || new Float32Array(nbVertices*3);
    }

    this._meshData._vertOnEdge = new Uint8Array(nbVertices);
    this._meshData._vrvStartCount = new Uint32Array(nbVertices*2);
    this._meshData._vrfStartCount = new Uint32Array(nbVertices*2);
    this._meshData._vertTagFlags = new Int32Array(nbVertices);
    this._meshData._vertSculptFlags = new Int32Array(nbVertices);
    this._meshData._vertStateFlags = new Int32Array(nbVertices);
    this._meshData._vertProxy = new Float32Array(nbVertices*3);

    let nbFaces = this.getNbFaces();
    this._meshData._faceEdges = new Uint32Array(nbFaces*4);
    this._meshData._facesToTriangles = new Uint32Array(nbFaces);
    this._meshData._faceBoxes = new Float32Array(nbFaces*6);
    this._meshData._faceNormalsXYZ = new Float32Array(nbFaces*3);
    this._meshData._faceCentersXYZ = new Float32Array(nbFaces*3);
    this._meshData._facesTagFlags = new Int32Array(nbFaces);

    this._meshData._facePosInLeaf = new Uint32Array(nbFaces);
    let faceLeaf = this._meshData._faceLeaf;
    faceLeaf.length = nbFaces;
    for (let i = 0; i < nbFaces; ++i) {
      faceLeaf[i] = null;
    }
  }

  /** Init color and material array */
  initColorsAndMaterials() {
    let nbVertices = this.getNbVertices();
    let i = 0;
    let len = nbVertices*3;
    if (!this._meshData._colorsRGB || this._meshData._colorsRGB.length !== len) {
      let cAr = this._meshData._colorsRGB = new Float32Array(len);
      for (i = 0; i < len; ++i) {
        cAr[i] = 1.0;
      }
    }
    if (!this._meshData._materialsPBR || this._meshData._materialsPBR.length !== len) {
      let mAr = this._meshData._materialsPBR = new Float32Array(len);
      for (i = 0; i < nbVertices; ++i) {
        let j = i*3;
        mAr[j] = DEF_ROUGHNESS;
        mAr[j + 1] = DEF_METALNESS;
        mAr[j + 2] = 1.0;
      }
    }
  }

  /** Computes faces ring around vertices */
  initFaceRings() {
    let fAr = this.getFaces();
    let nbVertices = this.getNbVertices();
    let nbFaces = this.getNbFaces();
    let i = 0;
    let id = 0;
    let countRing = new Uint32Array(nbVertices);
    for (i = 0; i < nbFaces; ++i) {
      id = i*4;
      countRing[fAr[id]]++;
      countRing[fAr[id + 1]]++;
      countRing[fAr[id + 2]]++;
      let i4 = fAr[id + 3];
      if (i4 !== Utils.TRI_INDEX)
        countRing[i4]++;
    }

    let ringFace = this.getVerticesRingFaceStartCount();
    let acc = 0;
    for (i = 0; i < nbVertices; ++i) {
      let count = countRing[i];
      ringFace[i*2] = acc;
      ringFace[i*2 + 1] = count;
      acc += count;
    }

    let vrf = new Uint32Array(Utils.getMemory(4*nbFaces*6), 0, nbFaces*6);
    acc = 0;
    for (i = 0; i < nbFaces; ++i) {
      id = i*4;
      let iv1 = fAr[id];
      let iv2 = fAr[id + 1];
      let iv3 = fAr[id + 2];
      let iv4 = fAr[id + 3];
      vrf[ringFace[iv1*2] + (--countRing[iv1])] = i;
      vrf[ringFace[iv2*2] + (--countRing[iv2])] = i;
      vrf[ringFace[iv3*2] + (--countRing[iv3])] = i;
      if (iv4 !== Utils.TRI_INDEX) {
        vrf[ringFace[iv4*2] + (--countRing[iv4])] = i;
        ++acc;
      }
    }

    this._meshData._vertRingFace = new Uint32Array(vrf.subarray(0, nbFaces*3 + acc));
  }

  /** Update a group of vertices' normal */
  updateVerticesNormal(iVerts) {
    let vrfStartCount = this.getVerticesRingFaceStartCount();
    let vertRingFace = this.getVerticesRingFace();
    let ringFaces = vertRingFace instanceof Array ? vertRingFace : null;
    let nAr = this.getNormals();
    let faceNormals = this.getFaceNormals();

    let full = iVerts === undefined;
    let nbVerts = full ? this.getNbVertices() : iVerts.length;
    for (let i = 0; i < nbVerts; ++i) {
      let ind = full ? i : iVerts[i];
      let start, end;
      if (ringFaces) {
        vertRingFace = ringFaces[ind];
        start = 0;
        end = vertRingFace.length;
      } else {
        start = vrfStartCount[ind*2];
        end = start + vrfStartCount[ind*2 + 1];
      }
      let nx = 0.0;
      let ny = 0.0;
      let nz = 0.0;
      for (let j = start; j < end; ++j) {
        let id = vertRingFace[j]*3;
        nx += faceNormals[id];
        ny += faceNormals[id + 1];
        nz += faceNormals[id + 2];
      }
      let len = end - start;
      if (len !== 0.0) len = 1.0/len;
      ind *= 3;
      nAr[ind] = nx*len;
      nAr[ind + 1] = ny*len;
      nAr[ind + 2] = nz*len;
    }
  }

  /** Computes vertex ring around vertices */
  initVertexRings() {
    let vrvStartCount = this.getVerticesRingVertStartCount();
    let vertRingVert = this._meshData._vertRingVert = new Uint32Array(this.getNbEdges()*2);
    let vrfStartCount = this.getVerticesRingFaceStartCount();
    let vertRingFace = this.getVerticesRingFace();
    let vertTagFlags = this.getVerticesTagFlags();
    let vertOnEdge = this.getVerticesOnEdge();
    let fAr = this.getFaces();
    let vrvStart = 0;

    for (let i = 0, l = this.getNbVertices(); i < l; ++i) {
      let tagFlag = ++Utils.TAG_FLAG;
      let vrfStart = vrfStartCount[i*2];
      let vrfEnd = vrfStart + vrfStartCount[i*2 + 1];
      let vrvCount = 0;

      for (let j = vrfStart; j < vrfEnd; ++j) {
        let ind = vertRingFace[j]*4;
        let iVer1 = fAr[ind];
        let iVer2 = fAr[ind + 1];
        let iVer3 = fAr[ind + 2];
        let iVer4 = fAr[ind + 3];

        if (iVer1 === i) iVer1 = iVer4 !== Utils.TRI_INDEX ? iVer4 : iVer3;
        else if (iVer2 === i || iVer4 === i) iVer2 = iVer3;
        else if (iVer3 === i && iVer4 !== Utils.TRI_INDEX) iVer1 = iVer4;

        if (vertTagFlags[iVer1] !== tagFlag) {
          vertRingVert[vrvStart + (vrvCount++)] = iVer1;
          vertTagFlags[iVer1] = tagFlag;
        }

        if (vertTagFlags[iVer2] !== tagFlag) {
          vertRingVert[vrvStart + (vrvCount++)] = iVer2;
          vertTagFlags[iVer2] = tagFlag;
        }
      }

      vrvStartCount[i*2] = vrvStart;
      vrvStartCount[i*2 + 1] = vrvCount;
      vrvStart += vrvCount;
      if ((vrfEnd - vrfStart) !== vrvCount)
        vertOnEdge[i] = 1;
    }
  }

  /** Get more vertices (n-ring) */
  expandsVertices(iVerts, nRing) {
    let tagFlag = ++Utils.TAG_FLAG;
    let nbVerts = iVerts.length;
    let vrvStartCount = this.getVerticesRingVertStartCount();
    let vertRingVert = this.getVerticesRingVert();
    let ringVerts = vertRingVert instanceof Array ? vertRingVert : null;
    let vertTagFlags = this.getVerticesTagFlags();
    let acc = nbVerts;
    let nbVertices = this.getNbVertices();
    let iVertsExpanded = new Uint32Array(Utils.getMemory(4*nbVertices), 0, nbVertices);
    iVertsExpanded.set(iVerts);

    let i = 0;
    for (i = 0; i < nbVerts; ++i) {
      vertTagFlags[iVertsExpanded[i]] = tagFlag;
    }

    let iBegin = 0;
    while (nRing) {
      --nRing;
      for (i = iBegin; i < nbVerts; ++i) {
        let idVert = iVertsExpanded[i];
        let start, end;
        if (ringVerts) {
          vertRingVert = ringVerts[idVert];
          start = 0;
          end = vertRingVert.length;
        } else {
          start = vrvStartCount[idVert*2];
          end = start + vrvStartCount[idVert*2 + 1];
        }

        for (let j = start; j < end; ++j) {
          let id = vertRingVert[j];
          if (vertTagFlags[id] === tagFlag)
            continue;

          vertTagFlags[id] = tagFlag;
          iVertsExpanded[acc++] = id;
        }
      }
      iBegin = nbVerts;
      nbVerts = acc;
    }

    return new Uint32Array(iVertsExpanded.subarray(0, acc));
  }

  /** Return all the vertices linked to a group of faces */
  getVerticesFromFaces(iFaces) {
    let tagFlag = ++Utils.TAG_FLAG;
    let nbFaces = iFaces.length;
    let vertTagFlags = this.getVerticesTagFlags();
    let fAr = this.getFaces();
    let acc = 0;
    let verts = new Uint32Array(Utils.getMemory(4*iFaces.length*4), 0, iFaces.length*4);

    for (let i = 0; i < nbFaces; ++i) {
      let ind = iFaces[i]*4;
      let iVer1 = fAr[ind];
      let iVer2 = fAr[ind + 1];
      let iVer3 = fAr[ind + 2];
      let iVer4 = fAr[ind + 3];
      if (vertTagFlags[iVer1] !== tagFlag) {
        vertTagFlags[iVer1] = tagFlag;
        verts[acc++] = iVer1;
      }
      if (vertTagFlags[iVer2] !== tagFlag) {
        vertTagFlags[iVer2] = tagFlag;
        verts[acc++] = iVer2;
      }
      if (vertTagFlags[iVer3] !== tagFlag) {
        vertTagFlags[iVer3] = tagFlag;
        verts[acc++] = iVer3;
      }

      if (iVer4 !== Utils.TRI_INDEX && vertTagFlags[iVer4] !== tagFlag) {
        vertTagFlags[iVer4] = tagFlag;
        verts[acc++] = iVer4;
      }
    }
    return new Uint32Array(verts.subarray(0, acc));
  }

  /** Update a group of faces normal and aabb */
  updateFacesAabbAndNormal(iFaces) {
    let faceNormals = this.getFaceNormals();
    let faceBoxes = this.getFaceBoxes();
    let faceCenters = this.getFaceCenters();
    let vAr = this.getVertices();
    let fAr = this.getFaces();

    let full = iFaces === undefined;
    let nbFaces = full ? this.getNbFaces() : iFaces.length;
    for (let i = 0; i < nbFaces; ++i) {
      let ind = full ? i : iFaces[i];
      let idTri = ind*3;
      let idFace = ind*4;
      let idBox = ind*6;
      let ind1 = fAr[idFace]*3;
      let ind2 = fAr[idFace + 1]*3;
      let ind3 = fAr[idFace + 2]*3;
      let ind4 = fAr[idFace + 3];
      let isQuad = ind4 !== Utils.TRI_INDEX;
      if (isQuad) ind4 *= 3;

      let v1x = vAr[ind1];
      let v1y = vAr[ind1 + 1];
      let v1z = vAr[ind1 + 2];
      let v2x = vAr[ind2];
      let v2y = vAr[ind2 + 1];
      let v2z = vAr[ind2 + 2];
      let v3x = vAr[ind3];
      let v3y = vAr[ind3 + 1];
      let v3z = vAr[ind3 + 2];

      // compute normals
      let ax = v2x - v1x;
      let ay = v2y - v1y;
      let az = v2z - v1z;
      let bx = v3x - v1x;
      let by = v3y - v1y;
      let bz = v3z - v1z;
      let crx = ay*bz - az*by;
      let cry = az*bx - ax*bz;
      let crz = ax*by - ay*bx;

      // compute boxes
      // for code readability of course
      let xmin = v1x < v2x ? v1x < v3x ? v1x : v3x : v2x < v3x ? v2x : v3x;
      let xmax = v1x > v2x ? v1x > v3x ? v1x : v3x : v2x > v3x ? v2x : v3x;
      let ymin = v1y < v2y ? v1y < v3y ? v1y : v3y : v2y < v3y ? v2y : v3y;
      let ymax = v1y > v2y ? v1y > v3y ? v1y : v3y : v2y > v3y ? v2y : v3y;
      let zmin = v1z < v2z ? v1z < v3z ? v1z : v3z : v2z < v3z ? v2z : v3z;
      let zmax = v1z > v2z ? v1z > v3z ? v1z : v3z : v2z > v3z ? v2z : v3z;

      if (isQuad) {
        let v4x = vAr[ind4];
        let v4y = vAr[ind4 + 1];
        let v4z = vAr[ind4 + 2];
        if (v4x < xmin) xmin = v4x;
        if (v4x > xmax) xmax = v4x;
        if (v4y < ymin) ymin = v4y;
        if (v4y > ymax) ymax = v4y;
        if (v4z < zmin) zmin = v4z;
        if (v4z > zmax) zmax = v4z;
        ax = v3x - v4x;
        ay = v3y - v4y;
        az = v3z - v4z;
        crx += ay*bz - az*by;
        cry += az*bx - ax*bz;
        crz += ax*by - ay*bx;
      }

      // normals
      faceNormals[idTri] = crx;
      faceNormals[idTri + 1] = cry;
      faceNormals[idTri + 2] = crz;
      // boxes
      faceBoxes[idBox] = xmin;
      faceBoxes[idBox + 1] = ymin;
      faceBoxes[idBox + 2] = zmin;
      faceBoxes[idBox + 3] = xmax;
      faceBoxes[idBox + 4] = ymax;
      faceBoxes[idBox + 5] = zmax;
      // compute centers
      faceCenters[idTri] = (xmin + xmax)*0.5;
      faceCenters[idTri + 1] = (ymin + ymax)*0.5;
      faceCenters[idTri + 2] = (zmin + zmax)*0.5;
    }
  }

  /** Get more faces (n-ring) */
  expandsFaces(iFaces, nRing) {
    let tagFlag = ++Utils.TAG_FLAG;
    let nbFaces = iFaces.length;
    let vrfStartCount = this.getVerticesRingFaceStartCount();
    let vertRingFace = this.getVerticesRingFace();
    let ringFaces = vertRingFace instanceof Array ? vertRingFace : null;
    let ftf = this.getFacesTagFlags();
    let fAr = this.getFaces();
    let acc = nbFaces;
    let iFacesExpanded = new Uint32Array(Utils.getMemory(4*this.getNbFaces()), 0, this.getNbFaces());
    iFacesExpanded.set(iFaces);
    let i = 0;
    for (i = 0; i < nbFaces; ++i) {
      ftf[iFacesExpanded[i]] = tagFlag;
    }
    let iBegin = 0;
    while (nRing) {
      --nRing;
      for (i = iBegin; i < nbFaces; ++i) {
        let ind = iFacesExpanded[i]*4;

        for (let j = 0; j < 4; ++j) {
          let idv = fAr[ind + j];
          if (idv === Utils.TRI_INDEX)
            continue;

          let start, end;
          if (ringFaces) {
            vertRingFace = ringFaces[idv];
            start = 0;
            end = vertRingFace.length;
          } else {
            start = vrfStartCount[idv*2];
            end = start + vrfStartCount[idv*2 + 1];
          }
          for (let k = start; k < end; ++k) {
            let id = vertRingFace[k];
            if (ftf[id] === tagFlag)
              continue;
            ftf[id] = tagFlag;
            iFacesExpanded[acc++] = id;
          }
        }
      }
      iBegin = nbFaces;
      nbFaces = acc;
    }
    return new Uint32Array(iFacesExpanded.subarray(0, acc));
  }

  /** Return all the faces linked to a group of vertices */
  getFacesFromVertices(iVerts) {
    let tagFlag = ++Utils.TAG_FLAG;
    let nbVerts = iVerts.length;
    let vrfStartCount = this.getVerticesRingFaceStartCount();
    let vertRingFace = this.getVerticesRingFace();
    let ringFaces = vertRingFace instanceof Array ? vertRingFace : null;
    let ftf = this.getFacesTagFlags();
    let acc = 0;
    let iFaces = new Uint32Array(Utils.getMemory(4*this.getNbFaces()), 0, this.getNbFaces());
    for (let i = 0; i < nbVerts; ++i) {
      let idVert = iVerts[i];
      let start, end;
      if (ringFaces) {
        vertRingFace = ringFaces[idVert];
        start = 0;
        end = vertRingFace.length;
      } else {
        start = vrfStartCount[idVert*2];
        end = start + vrfStartCount[idVert*2 + 1];
      }
      for (let j = start; j < end; ++j) {
        let iFace = vertRingFace[j];
        if (ftf[iFace] !== tagFlag) {
          ftf[iFace] = tagFlag;
          iFaces[acc++] = iFace;
        }
      }
    }
    return new Uint32Array(iFaces.subarray(0, acc));
  }

  /** Computes triangles */
  initRenderTriangles() {
    if (this.hasUV())
      this._meshData._UVtrianglesABC = this.computeTrianglesFromFaces(this.getFacesTexCoord());
    this._meshData._trianglesABC = this.computeTrianglesFromFaces(this.getFaces());
  }

  /** Computes triangles from faces */
  computeTrianglesFromFaces(faces) {
    let nbFaces = this.getNbFaces();
    let facesToTris = this.getFacesToTriangles();
    let iAr = new Uint32Array(Utils.getMemory(4*nbFaces*6), 0, nbFaces*6);
    let acc = 0;
    for (let i = 0; i < nbFaces; ++i) {
      facesToTris[i] = acc;
      let iFace = i*4;
      let iv1 = faces[iFace];
      let iv2 = faces[iFace + 1];
      let iv3 = faces[iFace + 2];
      let iv4 = faces[iFace + 3];
      let iTri = acc*3;
      iAr[iTri] = iv1;
      iAr[iTri + 1] = iv2;
      iAr[iTri + 2] = iv3;
      ++acc;
      if (iv4 !== Utils.TRI_INDEX) {
        iTri = acc*3;
        iAr[iTri] = iv1;
        iAr[iTri + 1] = iv3;
        iAr[iTri + 2] = iv4;
        ++acc;
      }
    }
    return new Uint32Array(iAr.subarray(0, acc*3));
  }

  initEdges() {
    let fAr = this.getFaces();
    let feAr = this.getFaceEdges();
    let nbEdges = 0;
    let vertEdgeTemp = new Uint32Array(this.getNbVertices());
    let vrfStartCount = this.getVerticesRingFaceStartCount();
    let vertRingFace = this.getVerticesRingFace();
    for (let i = 0, nbVerts = this.getNbVertices(); i < nbVerts; ++i) {
      let start = vrfStartCount[i*2];
      let end = start + vrfStartCount[i*2 + 1];
      let compTest = nbEdges;
      for (let j = start; j < end; ++j) {
        let id = vertRingFace[j]*4;
        let iv1 = fAr[id];
        let iv2 = fAr[id + 1];
        let iv3 = fAr[id + 2];
        let iv4 = fAr[id + 3];
        let t = 0;
        let idEdge = 0;
        if (iv4 === Utils.TRI_INDEX) {
          if (i > iv1) {
            t = vertEdgeTemp[iv1];
            idEdge = id + (i === iv2 ? 0 : 2);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv1] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
          if (i > iv2) {
            t = vertEdgeTemp[iv2];
            idEdge = id + (i === iv1 ? 0 : 1);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv2] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
          if (i > iv3) {
            t = vertEdgeTemp[iv3];
            idEdge = id + (i === iv1 ? 2 : 1);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv3] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
          feAr[id + 3] = Utils.TRI_INDEX;
        } else {
          if (i > iv1 && i !== iv3) {
            t = vertEdgeTemp[iv1];
            idEdge = id + (i === iv2 ? 0 : 3);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv1] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
          if (i > iv2 && i !== iv4) {
            t = vertEdgeTemp[iv2];
            idEdge = id + (i === iv1 ? 0 : 1);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv2] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
          if (i > iv3 && i !== iv1) {
            t = vertEdgeTemp[iv3];
            idEdge = id + (i === iv2 ? 1 : 2);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv3] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
          if (i > iv4 && i !== iv2) {
            t = vertEdgeTemp[iv4];
            idEdge = id + (i === iv1 ? 3 : 2);
            if (t <= compTest) {
              feAr[idEdge] = nbEdges;
              vertEdgeTemp[iv4] = ++nbEdges;
            } else {
              feAr[idEdge] = t - 1;
            }
          }
        }
      }
    }
    let eAr = this._meshData._edges = new Uint8ClampedArray(nbEdges);
    for (let k = 0, nbFaces = this.getNbFaces(); k < nbFaces; ++k) {
      let idf = k*4;
      eAr[feAr[idf]]++;
      eAr[feAr[idf + 1]]++;
      eAr[feAr[idf + 2]]++;
      let i4 = feAr[idf + 3];
      if (i4 !== Utils.TRI_INDEX)
        eAr[i4]++;
    }
  }

  /** Return wireframe array (or compute it if not up to date) */
  getWireframe() {
    let nbEdges = this.getNbEdges();
    let cdw;
    let useDrawArrays = this.isUsingDrawArrays();
    if (useDrawArrays) {
      if (this._meshData._drawArraysWireframe && this._meshData._drawArraysWireframe.length === nbEdges*2) {
        return this._meshData._drawArraysWireframe;
      }
      cdw = this._meshData._drawArraysWireframe = new Uint32Array(nbEdges*2);
    } else {
      if (this._meshData._drawElementsWireframe && this._meshData._drawElementsWireframe.length === nbEdges*2) {
        return this._meshData._drawElementsWireframe;
      }
      cdw = this._meshData._drawElementsWireframe = new Uint32Array(nbEdges*2);
    }

    let fAr = this.getFaces();
    let feAr = this.getFaceEdges();
    let nbFaces = this.getNbFaces();
    let facesToTris = this.getFacesToTriangles();

    let nbLines = 0;
    let tagEdges = new Uint8Array(nbEdges);

    for (let i = 0; i < nbFaces; ++i) {
      let id = i*4;

      let iv1, iv2, iv3;
      let iv4 = fAr[id + 3];
      let isQuad = iv4 !== Utils.TRI_INDEX;

      if (useDrawArrays) {
        let idTri = facesToTris[i]*3;
        iv1 = idTri;
        iv2 = idTri + 1;
        iv3 = idTri + 2;
        if (isQuad) iv4 = idTri + 5;
      } else {
        iv1 = fAr[id];
        iv2 = fAr[id + 1];
        iv3 = fAr[id + 2];
      }

      let ide1 = feAr[id];
      let ide2 = feAr[id + 1];
      let ide3 = feAr[id + 2];
      let ide4 = feAr[id + 3];

      if (tagEdges[ide1] === 0) {
        tagEdges[ide1] = 1;
        cdw[nbLines*2] = iv1;
        cdw[nbLines*2 + 1] = iv2;
        nbLines++;
      }
      if (tagEdges[ide2] === 0) {
        tagEdges[ide2] = 1;
        cdw[nbLines*2] = iv2;
        cdw[nbLines*2 + 1] = iv3;
        nbLines++;
      }
      if (tagEdges[ide3] === 0) {
        tagEdges[ide3] = 1;
        cdw[nbLines*2] = iv3;
        cdw[nbLines*2 + 1] = isQuad ? iv4 : iv1;
        nbLines++;
      }
      if (isQuad && tagEdges[ide4] === 0) {
        tagEdges[ide4] = 1;
        cdw[nbLines*2] = iv4;
        cdw[nbLines*2 + 1] = iv1;
        nbLines++;
      }
    }
    return useDrawArrays ? this._meshData._drawArraysWireframe : this._meshData._drawElementsWireframe;
  }

  updateDuplicateGeometry(iVerts) {
    if (!this.isUsingTexCoords() || !this.hasUV())
      return;

    let vAr = this.getVertices();
    let cAr = this.getColors();
    let mAr = this.getMaterials();
    let nAr = this.getNormals();
    let startCount = this.getVerticesDuplicateStartCount();

    let full = iVerts === undefined;
    let nbVerts = full ? this.getNbVertices() : iVerts.length;
    for (let i = 0; i < nbVerts; ++i) {
      let ind = full ? i : iVerts[i];
      let start = startCount[ind*2];
      if (start === 0)
        continue;

      let end = start + startCount[ind*2 + 1];
      let idOrig = ind*3;
      let vx = vAr[idOrig];
      let vy = vAr[idOrig + 1];
      let vz = vAr[idOrig + 2];
      let nx = nAr[idOrig];
      let ny = nAr[idOrig + 1];
      let nz = nAr[idOrig + 2];
      let cx = cAr[idOrig];
      let cy = cAr[idOrig + 1];
      let cz = cAr[idOrig + 2];
      let mx = mAr[idOrig];
      let my = mAr[idOrig + 1];
      let mz = mAr[idOrig + 2];
      for (let j = start; j < end; ++j) {
        let idDup = j*3;
        vAr[idDup] = vx;
        vAr[idDup + 1] = vy;
        vAr[idDup + 2] = vz;
        nAr[idDup] = nx;
        nAr[idDup + 1] = ny;
        nAr[idDup + 2] = nz;
        cAr[idDup] = cx;
        cAr[idDup + 1] = cy;
        cAr[idDup + 2] = cz;
        mAr[idDup] = mx;
        mAr[idDup + 1] = my;
        mAr[idDup + 2] = mz;
      }
    }
  }

  updateDuplicateColorsAndMaterials(iVerts) {
    if (!this.isUsingTexCoords() || !this.hasUV())
      return;

    let cAr = this.getColors();
    let mAr = this.getMaterials();
    let startCount = this.getVerticesDuplicateStartCount();

    let full = iVerts === undefined;
    let nbVerts = full ? this.getNbVertices() : iVerts.length;
    for (let i = 0; i < nbVerts; ++i) {
      let ind = full ? i : iVerts[i];
      let start = startCount[ind*2];
      if (start === 0)
        continue;

      let end = start + startCount[ind*2 + 1];
      let idOrig = ind*3;
      let cx = cAr[idOrig];
      let cy = cAr[idOrig + 1];
      let cz = cAr[idOrig + 2];
      let mx = mAr[idOrig];
      let my = mAr[idOrig + 1];
      let mz = mAr[idOrig + 2];
      for (let j = start; j < end; ++j) {
        let idDup = j*3;
        cAr[idDup] = cx;
        cAr[idDup + 1] = cy;
        cAr[idDup + 2] = cz;
        mAr[idDup] = mx;
        mAr[idDup + 1] = my;
        mAr[idDup + 2] = mz;
      }
    }
  }

  initTexCoordsDataFromOBJData(uvAr, uvfArOrig) {
    let fAr = this.getFaces();
    let len = fAr.length;

    if (len != uvfArOrig.length) return;
    let nbUV = uvAr.length/2;

    // fix integrity (bug with sgl export??)
    for (let i = 0; i < len; ++i) {
      if (uvfArOrig[i] >= nbUV) {
        uvfArOrig[i] = fAr[i];
      }
    }

    let nbVertices = this.getNbVertices();
    let i = 0;
    let j = 0;
    let iv = 0;
    let tag = 0;

    // detect duplicates vertices because of tex coords
    let tagV = new Int32Array(nbVertices);
    // vertex without uv might receive random values...
    let tArTemp = new Float32Array(Utils.getMemory(nbVertices*4*2), 0, nbVertices*2);
    let dup = [];
    let acc = 0;
    let nbDuplicates = 0;
    for (i = 0; i < len; ++i) {
      iv = fAr[i];
      if (iv === Utils.TRI_INDEX)
        continue;

      let uv = uvfArOrig[i];
      tag = tagV[iv];
      if (tag === (uv + 1))
        continue;

      if (tag === 0) {
        tagV[iv] = uv + 1;
        tArTemp[iv*2] = uvAr[uv*2];
        tArTemp[iv*2 + 1] = uvAr[uv*2 + 1];
        continue;
      }

      // first duplicate
      if (tag > 0) {
        tagV[iv] = --acc;
        dup.push([uv]);
        ++nbDuplicates;
        continue;
      }
      // check if we need to insert a new duplicate
      let dupArray = dup[-tag - 1];
      let nbDup = dupArray.length;
      for (j = 0; j < nbDup; ++j) {
        if (dupArray[j] === uv)
          break;
      }
      // insert new duplicate
      if (j === nbDup) {
        ++nbDuplicates;
        dupArray.push(uv);
      }
    }

    // order the duplicates vertices (and tex coords)
    let tAr = new Float32Array((nbVertices + nbDuplicates)*2);
    tAr.set(tArTemp);
    let startCount = this._meshData._duplicateStartCount = new Uint32Array(nbVertices*2);
    acc = 0;
    for (i = 0; i < nbVertices; ++i) {
      tag = tagV[i];
      if (tag >= 0)
        continue;

      let dAr = dup[-tag - 1];
      let nbDu = dAr.length;
      let start = nbVertices + acc;
      startCount[i*2] = start;
      startCount[i*2 + 1] = nbDu;
      acc += nbDu;
      for (j = 0; j < nbDu; ++j) {
        let idUv = dAr[j]*2;
        let idUvCoord = (start + j)*2;
        tAr[idUvCoord] = uvAr[idUv];
        tAr[idUvCoord + 1] = uvAr[idUv + 1];
      }
    }

    // create faces that uses duplicates vertices (with textures coordinates)
    let uvfAr = new Uint32Array(fAr);
    len = fAr.length;
    for (i = 0; i < len; ++i) {
      iv = uvfAr[i];
      if (iv === Utils.TRI_INDEX)
        continue;

      tag = tagV[iv];
      if (tag > 0)
        continue;

      let idtex = uvfArOrig[i];
      let dArray = dup[-tag - 1];
      let nbEl = dArray.length;
      for (j = 0; j < nbEl; ++j) {
        if (idtex === dArray[j]) {
          uvfAr[i] = startCount[iv*2] + j;
          break;
        }
      }
    }

    this.setTexCoords(tAr);
    this.setFacesTexCoord(uvfAr);
  }

  setAlreadyDrawArrays() {
    // kind of a hack, to be used if the main arrays are already draw arrays
    this._meshData._DAverticesXYZ = this.getVertices();
    this._meshData._DAnormalsXYZ = this.getNormals();
    this._meshData._DAcolorsRGB = this.getColors();
    this._meshData._DAmaterialsPBR = this.getMaterials();
  }

  /** Updates the arrays that are going to be used by webgl */
  updateDrawArrays(iFaces) {
    if (!this.isUsingDrawArrays())
      return;

    let vAr = this.getVertices();
    let nAr = this.getNormals();
    let cAr = this.getColors();
    let mAr = this.getMaterials();

    let fAr = this.getFaces();

    let nbTriangles = this.getNbTriangles();
    let facesToTris = this.hasOnlyTriangles() ? null : this.getFacesToTriangles();

    let full = iFaces === undefined;
    let cdv = this._meshData._DAverticesXYZ;
    let cdn = this._meshData._DAnormalsXYZ;
    let cdc = this._meshData._DAcolorsRGB;
    let cdm = this._meshData._DAmaterialsPBR;

    if (!cdv || cdv.length < nbTriangles*9) {
      cdv = this._meshData._DAverticesXYZ = new Float32Array(nbTriangles*9);
      cdn = this._meshData._DAnormalsXYZ = new Float32Array(nbTriangles*9);
      cdc = this._meshData._DAcolorsRGB = new Float32Array(nbTriangles*9);
      cdm = this._meshData._DAmaterialsPBR = new Float32Array(nbTriangles*9);
    }

    let nbFaces = full ? this.getNbFaces() : iFaces.length;
    for (let i = 0; i < nbFaces; ++i) {
      let idFace = full ? i : iFaces[i];
      let ftt = facesToTris ? facesToTris[idFace] : idFace;
      let vId = ftt*9;

      idFace *= 4;
      let id1 = fAr[idFace]*3;
      let id2 = fAr[idFace + 1]*3;
      let id3 = fAr[idFace + 2]*3;

      // coordinates
      cdv[vId] = vAr[id1];
      cdv[vId + 1] = vAr[id1 + 1];
      cdv[vId + 2] = vAr[id1 + 2];
      cdv[vId + 3] = vAr[id2];
      cdv[vId + 4] = vAr[id2 + 1];
      cdv[vId + 5] = vAr[id2 + 2];
      cdv[vId + 6] = vAr[id3];
      cdv[vId + 7] = vAr[id3 + 1];
      cdv[vId + 8] = vAr[id3 + 2];

      // color
      cdc[vId] = cAr[id1];
      cdc[vId + 1] = cAr[id1 + 1];
      cdc[vId + 2] = cAr[id1 + 2];
      cdc[vId + 3] = cAr[id2];
      cdc[vId + 4] = cAr[id2 + 1];
      cdc[vId + 5] = cAr[id2 + 2];
      cdc[vId + 6] = cAr[id3];
      cdc[vId + 7] = cAr[id3 + 1];
      cdc[vId + 8] = cAr[id3 + 2];

      // material
      cdm[vId] = mAr[id1];
      cdm[vId + 1] = mAr[id1 + 1];
      cdm[vId + 2] = mAr[id1 + 2];
      cdm[vId + 3] = mAr[id2];
      cdm[vId + 4] = mAr[id2 + 1];
      cdm[vId + 5] = mAr[id2 + 2];
      cdm[vId + 6] = mAr[id3];
      cdm[vId + 7] = mAr[id3 + 1];
      cdm[vId + 8] = mAr[id3 + 2];

      // normals
      cdn[vId] = nAr[id1];
      cdn[vId + 1] = nAr[id1 + 1];
      cdn[vId + 2] = nAr[id1 + 2];
      cdn[vId + 3] = nAr[id2];
      cdn[vId + 4] = nAr[id2 + 1];
      cdn[vId + 5] = nAr[id2 + 2];
      cdn[vId + 6] = nAr[id3];
      cdn[vId + 7] = nAr[id3 + 1];
      cdn[vId + 8] = nAr[id3 + 2];

      let id4 = fAr[idFace + 3];
      if (id4 === Utils.TRI_INDEX)
        continue;
      id4 *= 3;

      vId += 9;
      // coordinates
      cdv[vId] = vAr[id1];
      cdv[vId + 1] = vAr[id1 + 1];
      cdv[vId + 2] = vAr[id1 + 2];
      cdv[vId + 3] = vAr[id3];
      cdv[vId + 4] = vAr[id3 + 1];
      cdv[vId + 5] = vAr[id3 + 2];
      cdv[vId + 6] = vAr[id4];
      cdv[vId + 7] = vAr[id4 + 1];
      cdv[vId + 8] = vAr[id4 + 2];

      // colors
      cdc[vId] = cAr[id1];
      cdc[vId + 1] = cAr[id1 + 1];
      cdc[vId + 2] = cAr[id1 + 2];
      cdc[vId + 3] = cAr[id3];
      cdc[vId + 4] = cAr[id3 + 1];
      cdc[vId + 5] = cAr[id3 + 2];
      cdc[vId + 6] = cAr[id4];
      cdc[vId + 7] = cAr[id4 + 1];
      cdc[vId + 8] = cAr[id4 + 2];

      // materials
      cdm[vId] = mAr[id1];
      cdm[vId + 1] = mAr[id1 + 1];
      cdm[vId + 2] = mAr[id1 + 2];
      cdm[vId + 3] = mAr[id3];
      cdm[vId + 4] = mAr[id3 + 1];
      cdm[vId + 5] = mAr[id3 + 2];
      cdm[vId + 6] = mAr[id4];
      cdm[vId + 7] = mAr[id4 + 1];
      cdm[vId + 8] = mAr[id4 + 2];

      // normals
      cdn[vId] = nAr[id1];
      cdn[vId + 1] = nAr[id1 + 1];
      cdn[vId + 2] = nAr[id1 + 2];
      cdn[vId + 3] = nAr[id3];
      cdn[vId + 4] = nAr[id3 + 1];
      cdn[vId + 5] = nAr[id3 + 2];
      cdn[vId + 6] = nAr[id4];
      cdn[vId + 7] = nAr[id4 + 1];
      cdn[vId + 8] = nAr[id4 + 2];
    }

    if (this.isUsingTexCoords())
      this.updateDrawArraysTexCoord(iFaces);
  }

  /** Updates the UV array data for drawArrays */
  updateDrawArraysTexCoord(iFaces) {
    let nbTriangles = this.getNbTriangles();
    let facesToTris = this.getFacesToTriangles();

    let full = iFaces === undefined;
    let cdt = this._meshData._DAtexCoordsST;
    if (!cdt || cdt.length !== nbTriangles*6)
      cdt = this._meshData._DAtexCoordsST = new Float32Array(nbTriangles*6);

    let tAr = this.getTexCoords();
    let fArUV = this.getFacesTexCoord();

    let nbFaces = full ? this.getNbFaces() : iFaces.length;
    for (let i = 0; i < nbFaces; ++i) {
      let idFace = full ? i : iFaces[i];
      let ftt = facesToTris[idFace];
      let vIduv = ftt*6;

      idFace *= 4;
      let id1uv = fArUV[idFace]*2;
      let id2uv = fArUV[idFace + 1]*2;
      let id3uv = fArUV[idFace + 2]*2;

      cdt[vIduv] = tAr[id1uv];
      cdt[vIduv + 1] = tAr[id1uv + 1];
      cdt[vIduv + 2] = tAr[id2uv];
      cdt[vIduv + 3] = tAr[id2uv + 1];
      cdt[vIduv + 4] = tAr[id3uv];
      cdt[vIduv + 5] = tAr[id3uv + 1];

      let id4uv = fArUV[idFace + 3];
      if (id4uv === Utils.TRI_INDEX)
        continue;
      id4uv *= 3;

      vIduv += 6;
      cdt[vIduv] = tAr[id1uv];
      cdt[vIduv + 1] = tAr[id1uv + 1];
      cdt[vIduv + 2] = tAr[id3uv];
      cdt[vIduv + 3] = tAr[id3uv + 1];
      cdt[vIduv + 4] = tAr[id4uv];
      cdt[vIduv + 5] = tAr[id4uv + 1];
    }
  }

  /////////////////
  // TRANSFORM DATA
  /////////////////
  updateCenter() {
    let box = this.getLocalBound();
    vec3.set(this._transformData._center, (box[0] + box[3])*0.5, (box[1] + box[4])*0.5, (box[2] + box[5])*0.5);
  }

  /** Pre compute mv and mvp matrices as well as the depth center */
  updateMatrices(camera) {
    mat3.normalFromMat4(this._transformData._lastComputedEN, this._transformData._editMatrix);
    mat4.mul(this._transformData._lastComputedMV, camera.getView(), this._transformData._matrix);
    mat3.normalFromMat4(this._transformData._lastComputedN, this._transformData._lastComputedMV);
    mat4.mul(this._transformData._lastComputedMVP, camera.getProjection(), this._transformData._lastComputedMV);
    let cen = this._transformData._center;
    let m = this._transformData._lastComputedMVP;
    this._transformData._lastComputedDepth = m[2]*cen[0] + m[6]*cen[1] + m[10]*cen[2] + m[14];
  }

  computeLocalRadius() {
    let box = this.getLocalBound();
    return 0.5*vec3.dist([box[0], box[1], box[2]], [box[3], box[4], box[5]]);
  }

  normalizeSize() {
    let scale = Utils.SCALE/(2.0*this.computeLocalRadius());
    mat4.scale(this._transformData._matrix, this._transformData._matrix, [scale, scale, scale]);
  }

  computeWorldBound() {
    let worldb = this._meshData._worldBound;
    let localb = this.getLocalBound();
    let mat = this.getMatrix();

    // trans
    worldb[0] = worldb[3] = mat[12];
    worldb[1] = worldb[4] = mat[13];
    worldb[2] = worldb[5] = mat[14];

    // rotate per component
    for (let i = 0; i < 3; ++i) {
      let i4 = i*4;
      let mini = localb[i];
      let maxi = localb[i + 3];
      for (let j = 0; j < 3; ++j) {
        let cm = mat[i4 + j];
        let a = cm*maxi;
        let b = cm*mini;
        if (a < b) {
          worldb[j] += a;
          worldb[j + 3] += b;
        } else {
          worldb[j] += b;
          worldb[j + 3] += a;
        }
      }
    }

    return worldb;
  }

  /////////
  // OCTREE
  /////////

  /** Return faces intersected by a ray */
  intersectRay(vNear, eyeDir, collectLeaves) {
    let nbFaces = this.getNbFaces();
    let collectFaces = new Uint32Array(Utils.getMemory(nbFaces*4), 0, nbFaces);
    return this._meshData._octree.collectIntersectRay(vNear, eyeDir, collectFaces, collectLeaves
                                                                                   ? this._meshData._leavesToUpdate
                                                                                   : undefined);
  }

  /** Return faces inside a sphere */
  intersectSphere(vert, radiusSquared, collectLeaves) {
    let nbFaces = this.getNbFaces();
    let collectFaces = new Uint32Array(Utils.getMemory(nbFaces*4), 0, nbFaces);
    return this._meshData._octree.collectIntersectSphere(vert, radiusSquared, collectFaces, collectLeaves
                                                                                            ? this._meshData._leavesToUpdate
                                                                                            : undefined);
  }

  /**
   * Update Octree
   * For each faces we check if its position inside the octree has changed
   * if so... we mark this face and we remove it from its former cells
   * We push back the marked faces into the octree
   */
  updateOctree(iFaces) {
    if (iFaces)
      this.updateOctreeAdd(this.updateOctreeRemove(iFaces));
    else
      this.computeOctree();
  }

  computeAabb() {
    let nbVertices = this.getNbVertices();
    let vAr = this.getVertices();
    let xmin = Infinity;
    let ymin = Infinity;
    let zmin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;
    let zmax = -Infinity;
    for (let i = 0; i < nbVertices; ++i) {
      let j = i*3;
      let vx = vAr[j];
      let vy = vAr[j + 1];
      let vz = vAr[j + 2];
      if (vx < xmin) xmin = vx;
      if (vx > xmax) xmax = vx;
      if (vy < ymin) ymin = vy;
      if (vy > ymax) ymax = vy;
      if (vz < zmin) zmin = vz;
      if (vz > zmax) zmax = vz;
    }
    return [xmin, ymin, zmin, xmax, ymax, zmax];
  }

  /** Compute the octree */
  computeOctree() {
    let abRoot = this.computeAabb();
    let xmin = abRoot[0];
    let ymin = abRoot[1];
    let zmin = abRoot[2];
    let xmax = abRoot[3];
    let ymax = abRoot[4];
    let zmax = abRoot[5];
    let dx = xmax - xmin;
    let dy = ymax - ymin;
    let dz = zmax - zmin;

    // add minimal thickness
    let offset = Math.sqrt(dx*dx + dy*dy + dz*dz)*0.2;
    let eps = 1e-16;
    if (xmax - xmin < eps) {
      xmin -= offset;
      xmax += offset;
    }
    if (ymax - ymin < eps) {
      ymin -= offset;
      ymax += offset;
    }
    if (zmax - zmin < eps) {
      zmin -= offset;
      zmax += offset;
    }

    // root octree bigger than minimum aabb... (to avoid too many octree rebuild)
    let dfx = dx*0.3;
    let dfy = dy*0.3;
    let dfz = dz*0.3;
    let xmin2 = xmin - dfx;
    let xmax2 = xmax + dfx;
    let ymin2 = ymin - dfy;
    let ymax2 = ymax + dfy;
    let zmin2 = zmin - dfz;
    let zmax2 = zmax + dfz;

    // octree construction
    let octree = this._meshData._octree = new OctreeCell();
    octree.resetNbFaces(this.getNbFaces());
    octree.setAabbLoose(xmin, ymin, zmin, xmax, ymax, zmax);
    octree.setAabbSplit(xmin2, ymin2, zmin2, xmax2, ymax2, zmax2);
    octree.build(this);
  }

  updateOctreeRemove(iFaces) {
    let faceCenters = this.getFaceCenters();
    let fboxes = this.getFaceBoxes();
    let facePosInLeaf = this._meshData._facePosInLeaf;
    let faceLeaf = this._meshData._faceLeaf;
    let nbFaces = iFaces.length;
    let acc = 0;
    let facesToMove = new Uint32Array(Utils.getMemory(4*nbFaces), 0, nbFaces);
    // recompute position inside the octree
    for (let i = 0; i < nbFaces; ++i) {
      let idFace = iFaces[i];
      let idb = idFace*6;
      let idCen = idFace*3;
      let leaf = faceLeaf[idFace];
      let ab = leaf._aabbSplit;

      let vx = faceCenters[idCen];
      let vy = faceCenters[idCen + 1];
      let vz = faceCenters[idCen + 2];

      if (vx <= ab[0] || vy <= ab[1] || vz <= ab[2] || vx > ab[3] || vy > ab[4] || vz > ab[5]) {
        // a face center has moved from its cell
        facesToMove[acc++] = iFaces[i];
        let facesInLeaf = leaf._iFaces;
        if (facesInLeaf.length > 0) { // remove faces from octree cell
          let iFaceLast = facesInLeaf[facesInLeaf.length - 1];
          let iPos = facePosInLeaf[idFace];
          facesInLeaf[iPos] = iFaceLast;
          facePosInLeaf[iFaceLast] = iPos;
          facesInLeaf.pop();
        }
      } else { // expands cell aabb loose if necessary
        leaf.expandsAabbLoose(fboxes[idb], fboxes[idb + 1], fboxes[idb + 2], fboxes[idb + 3], fboxes[idb + 4], fboxes[idb + 5]);
      }
    }
    return new Uint32Array(facesToMove.subarray(0, acc));
  }

  updateOctreeAdd(facesToMove) {
    let fc = this.getFaceCenters();
    let fb = this.getFaceBoxes();
    let facePosInLeaf = this._meshData._facePosInLeaf;
    let faceLeaf = this._meshData._faceLeaf;
    let nbFacesToMove = facesToMove.length;

    let root = this._meshData._octree;
    let rootSplit = root._aabbSplit;
    let xmin = rootSplit[0];
    let ymin = rootSplit[1];
    let zmin = rootSplit[2];
    let xmax = rootSplit[3];
    let ymax = rootSplit[4];
    let zmax = rootSplit[5];

    for (let i = 0; i < nbFacesToMove; ++i) { // add face to the octree
      let idFace = facesToMove[i];
      let idb = idFace*6;
      let ibux = fb[idb];
      let ibuy = fb[idb + 1];
      let ibuz = fb[idb + 2];
      let iblx = fb[idb + 3];
      let ibly = fb[idb + 4];
      let iblz = fb[idb + 5];

      if (ibux > xmax || iblx < xmin || ibuy > ymax || ibly < ymin || ibuz > zmax || iblz < zmin) {
        // a face is outside the root node, we reconstruct the whole octree, slow... but rare
        this.computeOctree();
        this._meshData._leavesToUpdate.length = 0;
        break;
      }

      let idc = idFace*3;
      let newleaf = root.addFace(idFace, ibux, ibuy, ibuz, iblx, ibly, iblz, fc[idc], fc[idc + 1], fc[idc + 2]);
      if (newleaf) {
        facePosInLeaf[idFace] = newleaf._iFaces.length - 1;
        faceLeaf[idFace] = newleaf;
      } else { // failed to insert face in octree, re-insert it back
        let facesInLeaf = faceLeaf[idFace]._iFaces;
        facePosInLeaf[idFace] = facesInLeaf.length;
        facesInLeaf.push(facesToMove[i]);
      }
    }
  }

  /** balance octree (cut empty leaves or go deeper if needed) */
  balanceOctree() {
    ++OctreeCell.FLAG;
    let leavesToUpdate = this._meshData._leavesToUpdate;
    let nbLeaves = leavesToUpdate.length;

    for (let i = 0; i < nbLeaves; ++i) {
      let leaf = leavesToUpdate[i];
      if (leaf._flag === OctreeCell.FLAG)
        continue;

      if (leaf._iFaces.length === 0)
        leaf.pruneIfPossible();
      else if (leaf._iFaces.length > OctreeCell.MAX_FACES && leaf._depth < OctreeCell.MAX_DEPTH)
        leaf.build(this);

      leaf._flag = OctreeCell.FLAG;
    }

    leavesToUpdate.length = 0;
  }

  //////////////
  // RENDER DATA
  //////////////
  setFlatColor(val) {
    this.getFlatColor().set(val);
  }

  setAlbedo(val) {
    this.getAlbedo().set(val);
  }

  setMode(mode) {
    this._renderData._mode = mode;
  }

  setRoughness(val) {
    this._renderData._roughness = val;
  }

  setMetallic(val) {
    this._renderData._metallic = val;
  }

  setOpacity(alpha) {
    this._renderData._alpha = alpha;
  }

  setTexture0(tex) {
    this._renderData._texture0 = tex;
  }

  setMatcap(idMat) {
    this._renderData._matcap = idMat;
  }

  setCurvature(cur) {
    this._renderData._curvature = cur;
  }

  setFlatShading(flatShading) {
    this._renderData._flatShading = flatShading;
  }

  setShowWireframe(showWireframe) {
    this._renderData._showWireframe = RenderData.ONLY_DRAW_ARRAYS ? false : showWireframe;
    this.updateWireframeBuffer();
  }

  setUseDrawArrays(bool) {
    this._renderData._useDrawArrays = bool;
  }

  getGL() {
    return this._renderData._gl;
  }

  getCount() {
    let gl = this.getGL();
    if (this.getMode() === gl.TRIANGLES) return this.getNbTriangles()*3;
    if (this.getMode() === gl.LINES) return this.getNbVertices();
    return 0;
  }

  getVertexBuffer() {
    return this._renderData._vertexBuffer;
  }

  getNormalBuffer() {
    return this._renderData._normalBuffer;
  }

  getColorBuffer() {
    return this._renderData._colorBuffer;
  }

  getMaterialBuffer() {
    return this._renderData._materialBuffer;
  }

  getTexCoordBuffer() {
    return this._renderData._texCoordBuffer;
  }

  getIndexBuffer() {
    return this._renderData._indexBuffer;
  }

  getWireframeBuffer() {
    return this._renderData._wireframeBuffer;
  }

  getRoughness() {
    return this._renderData._roughness;
  }

  getMetallic() {
    return this._renderData._metallic;
  }

  getOpacity() {
    return this._renderData._alpha;
  }

  getFlatColor() {
    return this._renderData._flatColor;
  }

  getMode() {
    return this._renderData._mode;
  }

  getAlbedo() {
    return this._renderData._albedo;
  }

  getTexture0() {
    return this._renderData._texture0;
  }

  getMatcap() {
    return this._renderData._matcap;
  }

  getCurvature() {
    return this._renderData._curvature;
  }

  getFlatShading() {
    return this._renderData._flatShading;
  }

  getShowWireframe() {
    return this._renderData._showWireframe;
  }

  isUsingDrawArrays() {
    return this._renderData._useDrawArrays || RenderData.ONLY_DRAW_ARRAYS;
  }

  isUsingTexCoords() {
    let shaderType = this._renderData._shaderType;
    return shaderType === Enums.Shader.UV || shaderType === Enums.Shader.PAINTUV;
  }

  isTransparent() {
    return this._renderData._alpha < 0.99;
  }

  getShaderType() {
    return this._renderData._shaderType;
  }

  setShaderType(shaderName) {
    let hasUV = this.hasUV();
    if (shaderName === Enums.Shader.UV && !hasUV) {
      if (this._renderData._shaderType !== Enums.Shader.UV)
        return;
      shaderName = Enums.Shader.MATCAP;
    }

    this._renderData._shaderType = shaderName;
    if (hasUV) {
      this.updateDuplicateGeometry();
      this.updateDrawArrays();
    }
    this.updateBuffers();
  }

  initRender() {
    this.setShaderType(this._renderData._shaderType);
    this.setShowWireframe(this.getShowWireframe());
  }

  /////////
  // RENDER
  /////////
  render(main) {
    if (!this.isVisible()) return;
    Shader[this.getShaderType()].getOrCreate(this.getGL()).draw(this, main);
  }

  renderWireframe(main) {
    if (!this.isVisible()) return;
    Shader[Enums.Shader.WIREFRAME].getOrCreate(this.getGL()).draw(this, main);
  }

  renderFlatColor(main) {
    if (!this.isVisible()) return;
    Shader[Enums.Shader.FLAT].getOrCreate(this.getGL()).draw(this, main);
  }

  /////////////////
  // UPDATE BUFFERS
  /////////////////
  getRenderNbVertices() {
    if (this.isUsingDrawArrays()) return this.getCount();
    return this.isUsingTexCoords() ? this.getNbTexCoords() : this.getNbVertices();
  }

  updateVertexBuffer() {
    let vertices = this.isUsingDrawArrays() ? this.getVerticesDrawArrays() : this.getVertices();
    this.getVertexBuffer().update(vertices, this.getRenderNbVertices()*3);
  }

  updateNormalBuffer() {
    let normals = this.isUsingDrawArrays() ? this.getNormalsDrawArrays() : this.getNormals();
    this.getNormalBuffer().update(normals, this.getRenderNbVertices()*3);
  }

  updateColorBuffer() {
    let colors = this.isUsingDrawArrays() ? this.getColorsDrawArrays() : this.getColors();
    this.getColorBuffer().update(colors, this.getRenderNbVertices()*3);
  }

  updateMaterialBuffer() {
    let materials = this.isUsingDrawArrays() ? this.getMaterialsDrawArrays() : this.getMaterials();
    this.getMaterialBuffer().update(materials, this.getRenderNbVertices()*3);
  }

  updateTexCoordBuffer() {
    if (this.isUsingTexCoords()) {
      let texCoords = this.isUsingDrawArrays() ? this.getTexCoordsDrawArrays() : this.getTexCoords();
      this.getTexCoordBuffer().update(texCoords, this.getRenderNbVertices()*2);
    }
  }

  updateIndexBuffer() {
    if (!this.isUsingDrawArrays()) {
      let triangles = this.isUsingTexCoords() ? this.getTrianglesTexCoord() : this.getTriangles();
      this.getIndexBuffer().update(triangles, this.getNbTriangles()*3);
    }
  }

  updateWireframeBuffer() {
    if (this.getShowWireframe())
      this.getWireframeBuffer().update(this.getWireframe(), this.getNbEdges()*2);
  }

  updateGeometryBuffers() {
    this.updateVertexBuffer();
    this.updateNormalBuffer();
  }

  updateBuffers() {
    this.updateGeometryBuffers();
    this.updateColorBuffer();
    this.updateMaterialBuffer();
    this.updateTexCoordBuffer();
    this.updateIndexBuffer();
    this.updateWireframeBuffer();
  }

  release() {
    if (this.getTexture0())
      this.getGL().deleteTexture(this.getTexture0());
    this.getVertexBuffer().release();
    this.getNormalBuffer().release();
    this.getColorBuffer().release();
    this.getMaterialBuffer().release();
    this.getIndexBuffer().release();
    this.getWireframeBuffer().release();
  }

  copyRenderConfig(mesh) {
    this.setFlatShading(mesh.getFlatShading());
    this.setShowWireframe(mesh.getShowWireframe());
    this.setShaderType(mesh.getShaderType());
    this.setMatcap(mesh.getMatcap());
    this.setTexture0(mesh.getTexture0());
    this.setCurvature(mesh.getCurvature());
    this.setOpacity(mesh.getOpacity());
  }

  copyTransformData(mesh) {
    vec3.copy(this.getCenter(), mesh.getCenter());
    mat4.copy(this.getMatrix(), mesh.getMatrix());
    mat4.copy(this.getEditMatrix(), mesh.getEditMatrix());
    vec3.copy(this.getSymmetryNormal(), mesh.getSymmetryNormal());
  }

  copyData(mesh) {
    this.setVertices(mesh.getVertices().slice());
    this.setFaces(mesh.getFaces().slice());

    this.setColors(mesh.getColors().slice());
    this.setMaterials(mesh.getMaterials().slice());
    if (mesh.hasUV()) {
      this.initTexCoordsDataFromOBJData(mesh.getTexCoords(), mesh.getFacesTexCoord());
    }

    this.init();
    this.initRender();

    this.copyTransformData(mesh);
    this.copyRenderConfig(mesh);
  }

  optimize() {
    if (this.getNbFaces() === 0 || !Mesh.OPTIMIZE)
      return;

    // lower is better :
    // ACTVR : ~1 is optimal (soup or not)
    // ACMR : ~0.5 optimal ratio, 3 for triangle soup
    // let data = this.computeCacheScore();

    this.optimizePostTransform();
    this.optimizePreTransform();
    this.initFaceRings();

    // console.log('\nbefore ACMR ' + data.ACMR);
    // console.log('before ACTVR ' + data.ACTVR);
    // data = this.computeCacheScore();
    // console.log('after ACMR ' + data.ACMR);
    // console.log('after ACTVR ' + data.ACTVR);
  }

  computeCacheScore() {
    let fAr = this.getFaces();
    let nbFaces = this.getNbFaces();

    let sizeCache = 32;
    let cache = [];
    cache.length = sizeCache;

    let cacheMiss = 0;
    let k = 0;
    for (let i = 0; i < nbFaces; ++i) {
      let id = i*3;
      let nbPoly = fAr[id + 3] !== Utils.TRI_INDEX ? 4 : 3;
      // check in cache
      for (let j = 0; j < nbPoly; ++j) {

        let idFace = fAr[id + j];
        // check in cache
        for (k = 0; k < sizeCache; ++k) {
          if (cache[k] === undefined) {
            cache[k] = idFace;
            cacheMiss++;
            break;
          } else if (cache[k] === idFace) {
            break;
          }
        }

        if (k === sizeCache) {
          cacheMiss++;
          cache.shift();
          cache.push(idFace);
        }
      }
    }

    return {
      ACMR : cacheMiss/nbFaces,
      ACTVR: cacheMiss/this.getNbVertices()
    };
  }

  optimizePostTransform() {
    // post transform optimization (index buffer re-index), it implements tipsy
    // http://gfx.cs.princeton.edu/pubs/Sander_2007_%3ETR/tipsy.pdf

    let i = 0;
    let cacheSize = 32;
    let hasUV = this.hasUV();
    let fAr = this.getFaces();
    let fArUV = hasUV ? this.getFacesTexCoord() : fAr;

    let nbFaces = this.getNbFaces();
    let nbUniqueVertices = this.getNbVertices();
    let nbVertices = hasUV ? this.getNbTexCoords() : nbUniqueVertices;

    let dupUV = this.getVerticesDuplicateStartCount();
    let mapToUnique = new Uint32Array(nbVertices - nbUniqueVertices);
    if (hasUV) {
      for (i = 0; i < nbVertices; ++i) {
        let dupStart = dupUV[i*2];
        let dupEnd = dupStart + dupUV[i*2 + 1];
        for (let j = dupStart; j < dupEnd; ++j) {
          mapToUnique[j - nbUniqueVertices] = i;
        }
      }
    }

    let fringsStartCount = this.getVerticesRingFaceStartCount();
    let frings = this.getVerticesRingFace();

    let livesTriangles = new Int32Array(nbVertices);
    for (i = 0; i < nbUniqueVertices; ++i) {
      livesTriangles[i] = fringsStartCount[i*2 + 1];
    }

    for (i = nbUniqueVertices; i < nbVertices; ++i) {
      livesTriangles[i] = fringsStartCount[mapToUnique[i - nbUniqueVertices]*2 + 1];
    }

    let vTimeStamp = new Uint32Array(nbVertices);
    let timeStamp = cacheSize + 1;
    let cursor = 0;

    let deadEndStack = new Uint32Array(Utils.getMemory(4*nbFaces*4), 0, nbFaces*4);
    let deadEndCount = 0;
    let emittedFaces = new Uint8Array(nbFaces);

    let fArUVNew = new Uint32Array(nbFaces*4);
    let fArNew = hasUV ? new Uint32Array(nbFaces*4) : fArUVNew;
    let fcount = 0;

    let fanningVertex = 0;
    while (fanningVertex >= 0) {

      let ringCandidates = [];

      let idRing = fanningVertex >= nbUniqueVertices ? mapToUnique[fanningVertex - nbUniqueVertices] : fanningVertex;
      let start = fringsStartCount[idRing*2];
      let end = start + fringsStartCount[idRing*2 + 1];

      for (i = start; i < end; ++i) {
        let idFace = frings[i];
        if (emittedFaces[idFace]) continue;
        emittedFaces[idFace] = 1;

        let idf = idFace*4;

        let idv1 = deadEndStack[deadEndCount++] = fArUVNew[fcount++] = fArUV[idf];
        let idv2 = deadEndStack[deadEndCount++] = fArUVNew[fcount++] = fArUV[idf + 1];
        let idv3 = deadEndStack[deadEndCount++] = fArUVNew[fcount++] = fArUV[idf + 2];
        let idv4 = fArUVNew[fcount++] = fArUV[idf + 3];
        let isQuad = idv4 !== Utils.TRI_INDEX;

        if (hasUV) {
          fArNew[fcount - 4] = fAr[idf];
          fArNew[fcount - 3] = fAr[idf + 1];
          fArNew[fcount - 2] = fAr[idf + 2];
          fArNew[fcount - 1] = fAr[idf + 3];
        }

        ringCandidates.push(idv1, idv2, idv3);

        --livesTriangles[idv1];
        --livesTriangles[idv2];
        --livesTriangles[idv3];

        if (timeStamp - vTimeStamp[idv1] > cacheSize) vTimeStamp[idv1] = timeStamp++;
        if (timeStamp - vTimeStamp[idv2] > cacheSize) vTimeStamp[idv2] = timeStamp++;
        if (timeStamp - vTimeStamp[idv3] > cacheSize) vTimeStamp[idv3] = timeStamp++;

        if (isQuad) {
          deadEndStack[deadEndCount++] = idv4;
          ringCandidates.push(idv4);
          --livesTriangles[idv4];
          if (timeStamp - vTimeStamp[idv4] > cacheSize) vTimeStamp[idv4] = timeStamp++;
        }

      }

      // get emitted next vertex
      fanningVertex = -1;
      let bestPriority = -1;
      let nbCandidates = ringCandidates.length;
      for (i = 0; i < nbCandidates; ++i) {
        let idc = ringCandidates[i];
        let liveCount = livesTriangles[idc];
        if (liveCount <= 0) continue;

        let priority = 0;
        let posCache = timeStamp - vTimeStamp[idc];
        if (posCache + 2*liveCount <= cacheSize) {
          priority = posCache;
        }

        if (priority > bestPriority) {
          bestPriority = priority;
          fanningVertex = idc;
        }
      }

      if (fanningVertex !== -1) continue;

      while (deadEndCount > 0) {
        let vEnd = deadEndStack[--deadEndCount];
        if (livesTriangles[vEnd] > 0) {
          fanningVertex = vEnd;
          break;
        }
      }

      if (fanningVertex !== -1) continue;

      while (cursor < nbVertices) {
        if (livesTriangles[cursor++] > 0) {
          fanningVertex = cursor - 1;
          break;
        }
      }

    }

    fArUV.set(fArUVNew.subarray(0, nbFaces*4));
    if (hasUV) fAr.set(fArNew.subarray(0, nbFaces*4));

  }

  optimizePreTransform() {
    // pre transform optimization (not as important as post transform though)
    // it also removes unused vertices

    let vArOld = this.getVertices();
    let cArOld = this.getColors();
    let mArOld = this.getMaterials();
    let nbVertices = this.getNbVertices();

    let fAr = this.getFaces();
    let fArCount = this.getNbFaces()*4;

    let vArNew = new Float32Array(nbVertices*3);
    let cArNew = new Float32Array(nbVertices*3);
    let mArNew = new Float32Array(nbVertices*3);

    let idvPos = new Uint32Array(nbVertices);
    let acc = 0;
    let i = 0;
    for (i = 0; i < fArCount; ++i) {
      let iv = fAr[i];
      if (iv === Utils.TRI_INDEX) continue;

      let tag = idvPos[iv] - 1;
      if (tag === -1) {
        let idNew = acc*3;
        let idOld = iv*3;
        vArNew[idNew] = vArOld[idOld];
        vArNew[idNew + 1] = vArOld[idOld + 1];
        vArNew[idNew + 2] = vArOld[idOld + 2];

        cArNew[idNew] = cArOld[idOld];
        cArNew[idNew + 1] = cArOld[idOld + 1];
        cArNew[idNew + 2] = cArOld[idOld + 2];

        mArNew[idNew] = mArOld[idOld];
        mArNew[idNew + 1] = mArOld[idOld + 1];
        mArNew[idNew + 2] = mArOld[idOld + 2];

        tag = acc++;
        idvPos[iv] = tag + 1;
      }

      fAr[i] = tag;
    }

    let nbUnusedVertex = nbVertices - acc;
    if (nbUnusedVertex > 0)
      this.setNbVertices(acc);

    // Only the unique "positoned" vertices are pre transform, because sculptgl 
    // requires the duplicate vertices to be after the uniques positioned vertices
    if (this.hasUV()) {
      let fArUV = this.getFacesTexCoord();
      // remap unique vertex i
      for (i = 0; i < fArCount; ++i) {
        let iduv = fArUV[i];
        if (iduv < nbVertices) fArUV[i] = idvPos[iduv] - 1;
        else if (iduv !== Utils.TRI_INDEX) fArUV[i] -= nbUnusedVertex;
      }

      let nbUV = this.getNbTexCoords();
      let nbUVNew = this.getNbTexCoords() - nbUnusedVertex;

      let tAr = this.getTexCoords();
      let tArNew = new Float32Array(nbUVNew*2);
      let dupUVNew = new Uint32Array(acc*2);
      let dupUV = this.getVerticesDuplicateStartCount();

      for (i = 0; i < nbVertices; ++i) {
        let i2 = i*2;
        let start = dupUV[i2];
        let newiv = (idvPos[i] - 1)*2;
        if (newiv < 0) continue;

        if (start > 0) {
          dupUVNew[newiv] = start - nbUnusedVertex;
          dupUVNew[newiv + 1] = dupUV[i2 + 1];
        }

        tArNew[newiv] = tAr[i2];
        tArNew[newiv + 1] = tAr[i2 + 1];
      }

      for (i = nbVertices; i < nbUV; ++i) {
        let ivd = i*2;
        let ivdnew = (i - nbUnusedVertex)*2;
        tArNew[ivdnew] = tAr[ivd];
        tArNew[ivdnew + 1] = tAr[ivd + 1];
      }

      this.setVerticesDuplicateStartCount(dupUVNew);
      this.setTexCoords(tArNew);
    }

    vArOld.set(vArNew);
    cArOld.set(cArNew);
    mArOld.set(mArNew);

  }
}

Mesh.OPTIMIZE = true;
Mesh.ID = 0;

export default Mesh;
