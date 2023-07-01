class OctreeCell {
  constructor(parent) {
    this._parent = parent ? parent : null; // parent
    this._depth = parent ? parent._depth + 1 : 0; // depth of current node
    this._children = []; // children

    // extended boundary for intersect test
    this._aabbLoose = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

    // boundary in order to store exactly the face according to their center
    this._aabbSplit = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    this._iFaces = []; // faces (if cell is a leaf)

    this._flag = 0; // to track deleted cell
  }

  resetNbFaces(nbFaces) {
    let facesAll = this._iFaces;
    facesAll.length = nbFaces;
    for (let i = 0; i < nbFaces; ++i)
      facesAll[i] = i;
  }

  /** Subdivide octree, aabbSplit must be already set, and aabbLoose will be expanded if it's a leaf  */
  build(mesh) {
    let i = 0;

    let stack = OctreeCell.STACK;
    stack[0] = this;
    let curStack = 1;
    let leaves = [];
    while (curStack > 0) {
      let cell = stack[--curStack];
      let nbFaces = cell._iFaces.length;
      if (nbFaces > OctreeCell.MAX_FACES && cell._depth < OctreeCell.MAX_DEPTH) {
        cell.constructChildren(mesh);
        let children = cell._children;
        for (i = 0; i < 8; ++i)
          stack[curStack + i] = children[i];
        curStack += 8;
      } else if (nbFaces > 0) {
        leaves.push(cell);
      }
    }

    let nbLeaves = leaves.length;
    for (i = 0; i < nbLeaves; ++i)
      leaves[i].constructLeaf(mesh);
  }

  /** Construct the leaf  */
  constructLeaf(mesh) {
    let iFaces = this._iFaces;
    let nbFaces = iFaces.length;
    let bxmin = Infinity;
    let bymin = Infinity;
    let bzmin = Infinity;
    let bxmax = -Infinity;
    let bymax = -Infinity;
    let bzmax = -Infinity;
    let faceBoxes = mesh.getFaceBoxes();
    let facePosInLeaf = mesh.getFacePosInLeaf();
    let faceLeaf = mesh.getFaceLeaf();
    for (let i = 0; i < nbFaces; ++i) {
      let id = iFaces[i];
      faceLeaf[id] = this;
      facePosInLeaf[id] = i;
      id *= 6;
      let xmin = faceBoxes[id];
      let ymin = faceBoxes[id + 1];
      let zmin = faceBoxes[id + 2];
      let xmax = faceBoxes[id + 3];
      let ymax = faceBoxes[id + 4];
      let zmax = faceBoxes[id + 5];
      if (xmin < bxmin) bxmin = xmin;
      if (xmax > bxmax) bxmax = xmax;
      if (ymin < bymin) bymin = ymin;
      if (ymax > bymax) bymax = ymax;
      if (zmin < bzmin) bzmin = zmin;
      if (zmax > bzmax) bzmax = zmax;
    }
    this.expandsAabbLoose(bxmin, bymin, bzmin, bxmax, bymax, bzmax);
  }

  /** Construct sub cells of the octree */
  constructChildren(mesh) {
    let split = this._aabbSplit;
    let xmin = split[0];
    let ymin = split[1];
    let zmin = split[2];
    let xmax = split[3];
    let ymax = split[4];
    let zmax = split[5];
    let dX = (xmax - xmin) * 0.5;
    let dY = (ymax - ymin) * 0.5;
    let dZ = (zmax - zmin) * 0.5;
    let xcen = (xmax + xmin) * 0.5;
    let ycen = (ymax + ymin) * 0.5;
    let zcen = (zmax + zmin) * 0.5;

    let child0 = new OctreeCell(this);
    let child1 = new OctreeCell(this);
    let child2 = new OctreeCell(this);
    let child3 = new OctreeCell(this);
    let child4 = new OctreeCell(this);
    let child5 = new OctreeCell(this);
    let child6 = new OctreeCell(this);
    let child7 = new OctreeCell(this);

    let iFaces0 = child0._iFaces;
    let iFaces1 = child1._iFaces;
    let iFaces2 = child2._iFaces;
    let iFaces3 = child3._iFaces;
    let iFaces4 = child4._iFaces;
    let iFaces5 = child5._iFaces;
    let iFaces6 = child6._iFaces;
    let iFaces7 = child7._iFaces;
    let faceCenters = mesh.getFaceCenters();
    let iFaces = this._iFaces;
    let nbFaces = iFaces.length;
    for (let i = 0; i < nbFaces; ++i) {
      let iFace = iFaces[i];
      let id = iFace * 3;
      let cx = faceCenters[id];
      let cy = faceCenters[id + 1];
      let cz = faceCenters[id + 2];

      if (cx > xcen) {
        if (cy > ycen) {
          if (cz > zcen) iFaces6.push(iFace);
          else iFaces5.push(iFace);
        } else {
          if (cz > zcen) iFaces2.push(iFace);
          else iFaces1.push(iFace);
        }
      } else {
        if (cy > ycen) {
          if (cz > zcen) iFaces7.push(iFace);
          else iFaces4.push(iFace);
        } else {
          if (cz > zcen) iFaces3.push(iFace);
          else iFaces0.push(iFace);
        }
      }
    }

    child0.setAabbSplit(xmin, ymin, zmin, xcen, ycen, zcen);
    child1.setAabbSplit(xmin + dX, ymin, zmin, xcen + dX, ycen, zcen);
    child2.setAabbSplit(xcen, ycen - dY, zcen, xmax, ymax - dY, zmax);
    child3.setAabbSplit(xmin, ymin, zmin + dZ, xcen, ycen, zcen + dZ);
    child4.setAabbSplit(xmin, ymin + dY, zmin, xcen, ycen + dY, zcen);
    child5.setAabbSplit(xcen, ycen, zcen - dZ, xmax, ymax, zmax - dZ);
    child6.setAabbSplit(xcen, ycen, zcen, xmax, ymax, zmax);
    child7.setAabbSplit(xcen - dX, ycen, zcen, xmax - dX, ymax, zmax);

    this._children.length = 0;
    this._children.push(child0, child1, child2, child3, child4, child5, child6, child7);
    iFaces.length = 0;
  }

  setAabbSplit(xmin, ymin, zmin, xmax, ymax, zmax) {
    let aabb = this._aabbSplit;
    aabb[0] = xmin;
    aabb[1] = ymin;
    aabb[2] = zmin;
    aabb[3] = xmax;
    aabb[4] = ymax;
    aabb[5] = zmax;
  }

  setAabbLoose(xmin, ymin, zmin, xmax, ymax, zmax) {
    let aabb = this._aabbLoose;
    aabb[0] = xmin;
    aabb[1] = ymin;
    aabb[2] = zmin;
    aabb[3] = xmax;
    aabb[4] = ymax;
    aabb[5] = zmax;
  }

  /** Collect faces in cells hit by a ray */
  collectIntersectRay(vNear, eyeDir, collectFaces, leavesHit) {
    let vx = vNear[0];
    let vy = vNear[1];
    let vz = vNear[2];
    let irx = 1.0 / eyeDir[0];
    let iry = 1.0 / eyeDir[1];
    let irz = 1.0 / eyeDir[2];
    let acc = 0;

    let stack = OctreeCell.STACK;
    stack[0] = this;
    let curStack = 1;
    while (curStack > 0) {
      let cell = stack[--curStack];
      let loose = cell._aabbLoose;
      let t1 = (loose[0] - vx) * irx;
      let t2 = (loose[3] - vx) * irx;
      let t3 = (loose[1] - vy) * iry;
      let t4 = (loose[4] - vy) * iry;
      let t5 = (loose[2] - vz) * irz;
      let t6 = (loose[5] - vz) * irz;
      let tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
      let tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
      if (tmax < 0 || tmin > tmax) // no intersection
        continue;

      let children = cell._children;
      if (children.length === 8) {
        for (let i = 0; i < 8; ++i)
          stack[curStack + i] = children[i];
        curStack += 8;
      } else {
        if (leavesHit) leavesHit.push(cell);
        let iFaces = cell._iFaces;
        collectFaces.set(iFaces, acc);
        acc += iFaces.length;
      }
    }
    return new Uint32Array(collectFaces.subarray(0, acc));
  }

  /** Collect faces inside a sphere */
  collectIntersectSphere(vert, radiusSquared, collectFaces, leavesHit) {
    let vx = vert[0];
    let vy = vert[1];
    let vz = vert[2];
    let acc = 0;

    let stack = OctreeCell.STACK;
    stack[0] = this;
    let curStack = 1;
    while (curStack > 0) {
      let cell = stack[--curStack];
      let loose = cell._aabbLoose;
      let dx = 0.0;
      let dy = 0.0;
      let dz = 0.0;

      if (loose[0] > vx) dx = loose[0] - vx;
      else if (loose[3] < vx) dx = loose[3] - vx;
      else dx = 0.0;

      if (loose[1] > vy) dy = loose[1] - vy;
      else if (loose[4] < vy) dy = loose[4] - vy;
      else dy = 0.0;

      if (loose[2] > vz) dz = loose[2] - vz;
      else if (loose[5] < vz) dz = loose[5] - vz;
      else dz = 0.0;

      if ((dx * dx + dy * dy + dz * dz) > radiusSquared) // no intersection
        continue;

      let children = cell._children;
      if (children.length === 8) {
        for (let i = 0; i < 8; ++i)
          stack[curStack + i] = children[i];
        curStack += 8;
      } else {
        if (leavesHit) leavesHit.push(cell);
        let iFaces = cell._iFaces;
        collectFaces.set(iFaces, acc);
        acc += iFaces.length;
      }
    }
    return new Uint32Array(collectFaces.subarray(0, acc));
  }

  /** Add a face in the octree, subdivide the cell if necessary */
  addFace(faceId, bxmin, bymin, bzmin, bxmax, bymax, bzmax, cx, cy, cz) {
    let stack = OctreeCell.STACK;
    stack[0] = this;
    let curStack = 1;
    while (curStack > 0) {
      let cell = stack[--curStack];
      let split = cell._aabbSplit;
      if (cx <= split[0]) continue;
      if (cy <= split[1]) continue;
      if (cz <= split[2]) continue;
      if (cx > split[3]) continue;
      if (cy > split[4]) continue;
      if (cz > split[5]) continue;

      let loose = cell._aabbLoose;
      // expands cell aabb loose with aabb face
      if (bxmin < loose[0]) loose[0] = bxmin;
      if (bymin < loose[1]) loose[1] = bymin;
      if (bzmin < loose[2]) loose[2] = bzmin;
      if (bxmax > loose[3]) loose[3] = bxmax;
      if (bymax > loose[4]) loose[4] = bymax;
      if (bzmax > loose[5]) loose[5] = bzmax;
      let children = cell._children;

      if (children.length === 8) {
        for (let i = 0; i < 8; ++i)
          stack[curStack + i] = children[i];
        curStack += 8;
      } else {
        cell._iFaces.push(faceId);
        return cell;
      }
    }
  }

  /** Cut leaves if needed */
  pruneIfPossible() {
    let cell = this;
    while (cell._parent) {
      let parent = cell._parent;

      let children = parent._children;
      // means that the current cell has already pruned
      if (children.length === 0)
        return;

      // check if we can prune
      for (let i = 0; i < 8; ++i) {
        let child = children[i];
        if (child._iFaces.length > 0 || child._children.length === 8) {
          return;
        }
      }

      children.length = 0;
      cell = parent;
    }
  }

  /** Expand aabb loose */
  expandsAabbLoose(bxmin, bymin, bzmin, bxmax, bymax, bzmax) {
    let parent = this;
    while (parent) {
      let pLoose = parent._aabbLoose;
      let proceed = false;
      if (bxmin < pLoose[0]) {
        pLoose[0] = bxmin;
        proceed = true;
      }
      if (bymin < pLoose[1]) {
        pLoose[1] = bymin;
        proceed = true;
      }
      if (bzmin < pLoose[2]) {
        pLoose[2] = bzmin;
        proceed = true;
      }
      if (bxmax > pLoose[3]) {
        pLoose[3] = bxmax;
        proceed = true;
      }
      if (bymax > pLoose[4]) {
        pLoose[4] = bymax;
        proceed = true;
      }
      if (bzmax > pLoose[5]) {
        pLoose[5] = bzmax;
        proceed = true;
      }
      parent = proceed ? parent._parent : null;
    }
  }
}

OctreeCell.FLAG = 0;

OctreeCell.MAX_DEPTH = 8;
OctreeCell.MAX_FACES = 100; // maximum faces per cell
(function () {
  let nb = 1 + 7 * OctreeCell.MAX_DEPTH;
  let stack = OctreeCell.STACK = new Array(nb);
  for (let i = 0; i < nb; ++i)
    stack[i] = null;
})();

export default OctreeCell;
