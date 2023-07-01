class MeshData {
  static STRUCT = `
MeshData {
  _nbVertices      : int;
  _nbFaces         : int;
  _nbTexCoords     : int;
  _verticesXYZ     : array(float);
  _colorsRGB       : array(float);
  _materialsPBR    : array(float);
  _edges           : array(byte);
  _facesABCD       : array(int);
  _faceEdges       : array(int);
  _texCoordsST     : array(float);
  _duplicateStartCount : array(int); 
  _UVfacesABCD         : array(int); 
  _UVtrianglesABC      : array(int);
}
  `;

  loadSTRUCT(reader) {
    reader(this);

    this._verticesXYZ = new Float32Array(this._verticesXYZ);
    this._colorsRGB = new Float32Array(this._colorsRGB);
    this._materialsPBR = new Float32Array(this._materialsPBR);
    this._edges = new Uint8Array(this._edges);
    this._facesABCD = new Uint32Array(this._facesABCD);
    this._faceEdges = new Uint32Array(this._faceEdges);
    this._texCoordsST = new Float32Array(this._texCoordsST);
    this._duplicateStartCount = new Uint32Array(this._duplicateStartCount);
    this._UVfacesABCD = new Uint32Array(this._UVfacesABCD);
    this._UVtrianglesABC = new Uint32Array(this._UVtrianglesABC);
  }

  constructor() {
    this._nbVertices = 0;
    this._nbFaces = 0;
    this._nbTexCoords = 0;

    /////////////////////
    // unique vertex data
    /////////////////////

    this._verticesXYZ = null; // vertices (Float32Array)
    this._normalsXYZ = null; // normals (Float32Array)
    this._colorsRGB = null; // color vertices (Float32Array)
    this._materialsPBR = null; // pbr vertex data (Float32Array) roughness/metallic/masking

    this._vertOnEdge = null; // (1 :> on edge, 0 otherwise) (Uint8ClampedArray)
    this._vertRingFace = null; // array of neighborhood id faces (Uint32Array)
    this._vrfStartCount = null; // reference vertRingFace start and count ring (start/count) (Uint32Array)
    this._vrvStartCount = null; // array of neighborhood id vertices (start/count) (Uint32Array)
    this._vertRingVert = null; // reference vertRingVert start and count ring (Uint32Array)

    this._vertTagFlags = null; // general purposes flag, (<: Utils.TAG_FLAG) (Int32Array)
    this._vertSculptFlags = null; // editing flag (tag vertices when starting sculpting session) (<: Utils.SCULPT_FLAG) (Int32Array),
    this._vertStateFlags = null; // state flag (tag vertices to handle undo/redo) (<: Utils.STATE_FLAG) (Int32Array)

    this._vertProxy = null; // vertex proxy, for sculpting limits (Float32Array)

    ///////////////////
    // unique face data
    ///////////////////

    this._facesABCD = null; // faces tri or quad, tri will have D:Utils.TRI_INDEX (Uint32Array)

    this._faceEdges = null; // each face references the id edges (Uint32Array)
    this._faceNormalsXYZ = null; // faces normals (Float32Array)

    this._facesToTriangles = null; // faces to triangles (Uint32Array)
    this._trianglesABC = null; // triangles (Uint32Array)

    this._facesTagFlags = null; // triangles tag (<: Utils.TAG_FLAG) (Int32Array)

    ////////////
    // edge data
    ////////////
    this._edges = null; // edges (Uint8Array) (1 :> outer edge, 0 or 2 :> inner edge, >:3 non manifold)

    /////////////////
    // wireframe data
    /////////////////

    this._drawArraysWireframe = null; // array for the wireframe (base on drawArrays vertices)
    this._drawElementsWireframe = null; // array for the wireframe (base on drawElements vertices)

    //////////
    // UV data
    //////////

    this._texCoordsST = null; // tex coords (Float32Array)
    this._duplicateStartCount = null; // array of vertex duplicates location (start/count) (Uint32Array)
    this._UVfacesABCD = null; // faces unwrap (Uint32Array)
    this._UVtrianglesABC = null; // triangles tex coords (Uint32Array)

    //////////////////
    // DrawArrays data
    //////////////////

    this._DAverticesXYZ = null; // vertices (Float32Array)
    this._DAnormalsXYZ = null; // normals (Float32Array)
    this._DAcolorsRGB = null; // color vertices (Float32Array)
    this._DAmaterialsPBR = null; // material vertices (Float32Array)
    this._DAtexCoordsST = null; // texCoords (Float32Array)

    //////////////
    // Octree data
    //////////////

    this._octree = null; // root octree cell

    this._faceBoxes = null; // faces bbox (Float32Array)
    this._faceCentersXYZ = null; // faces center (Float32Array)

    this._facePosInLeaf = null; // position index in the leaf (Uint32Array)
    this._faceLeaf = []; // octree leaf
    this._leavesToUpdate = []; // leaves of the octree to check

    this._worldBound = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  }
}

import * as nstructjs from '../lib/nstructjs.js';
nstructjs.register(MeshData);

export default MeshData;
