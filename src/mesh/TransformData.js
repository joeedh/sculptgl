import {vec3, mat3, mat4} from '../lib/gl-matrix.js';
import * as nstructjs from '../lib/nstructjs.js';

class TransformData {
  static STRUCT = `
  TransformData {
    _center             : array(float);
    _matrix             : array(float);
    _editMatrix         : array(float);
    _symmetryNormal     : array(float);
    _symmetryOffset     : float;
  }
  `;

  loadSTRUCT(reader) {
    reader(this);
  }

  constructor() {
    this._center = vec3.create(); // center of the mesh (local space, before transformation)
    this._matrix = mat4.create(); // transformation matrix of the mesh
    this._editMatrix = mat4.create(); // edit matrix

    this._symmetryNormal = [1.0, 0.0, 0.0]; // symmetry normal
    this._symmetryOffset = 0.0; // offset

    // the model-view and model-view-projection and normal matrices 
    // are computed at the beginning of each frame (after camera update)
    this._lastComputedMV = mat4.create(); // MV matrix
    this._lastComputedMVP = mat4.create(); // MVP matrix
    this._lastComputedN = mat3.create(); // N matrix
    this._lastComputedEN = mat3.create(); // Editmatrix N matrix
    this._lastComputedDepth = 0.0; // depth of center

    this._lastWorldBound = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  }
}
nstructjs.register(TransformData);

export default TransformData;
