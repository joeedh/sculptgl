let SurfaceNets = {};
SurfaceNets.BLOCK = false;

/**
 * Based on Mikola Lysenko SurfaceNets
 * https://github.com/mikolalysenko/isosurface
 *
 * Based on: S.F. Gibson, "Constrained Elastic Surface Nets". (1998) MERL Tech Report.
 */

    // This is just the vertex number of each cube
let computeCubeEdges = function () {
      let cubeEdges = new Uint32Array(24);
      let k = 0;
      for (let i = 0; i < 8; ++i) {
        for (let j = 1; j <= 4; j <<= 1) {
          let p = i ^ j;
          if (i <= p) {
            cubeEdges[k++] = i;
            cubeEdges[k++] = p;
          }
        }
      }
      return cubeEdges;
    };

let computeEdgeTable = function (cubeEdges) {
  //Initialize the intersection table.
  //  This is a 2^(cube configuration) ->  2^(edge configuration) map
  //  There is one entry for each possible cube configuration, and the output is a 12-bit vector enumerating all edges crossing the 0-level.
  let edgeTable = new Uint32Array(256);
  for (let i = 0; i < 256; ++i) {
    let em = 0;
    for (let j = 0; j < 24; j += 2) {
      let a = !!(i & (1<<cubeEdges[j]));
      let b = !!(i & (1<<cubeEdges[j + 1]));
      em |= a !== b ? (1<<(j>>1)) : 0;
    }
    edgeTable[i] = em;
  }
  return edgeTable;
};

//Precompute edge table, like Paul Bourke does.
let cubeEdges = computeCubeEdges();
let edgeTable = computeEdgeTable(cubeEdges);

let readScalarValues = function (voxels, grid, dims, n, cols, mats) {
  let colors = voxels.colorField;
  let materials = voxels.materialField;
  let data = voxels.distanceField;

  //Read in 8 field values around this vertex and store them in an array
  //Also calculate 8-bit mask, like in marching cubes, so we can speed up sign checks later
  let c1 = 0;
  let c2 = 0;
  let c3 = 0;
  let m1 = 0;
  let m2 = 0;
  let m3 = 0;
  let invSum = 0;

  let mask = 0;
  let g = 0;
  let rx = dims[0];
  let rxy = dims[0]*dims[1];
  for (let k = 0; k < 2; ++k) {
    for (let j = 0; j < 2; ++j) {
      for (let i = 0; i < 2; ++i) {
        let id = n + i + j*rx + k*rxy;
        let id3 = id*3;
        let p = data[id];
        grid[g] = p;
        mask |= (p < 0.0) ? (1<<g) : 0;
        g++;
        if (p !== Infinity) {
          p = Math.min(1/Math.abs(p), 1e15);
          invSum += p;
          c1 += colors[id3]*p;
          c2 += colors[id3 + 1]*p;
          c3 += colors[id3 + 2]*p;
          m1 += materials[id3]*p;
          m2 += materials[id3 + 1]*p;
          m3 += materials[id3 + 2]*p;
        }
      }
    }
  }

  if (mask !== 0 && mask !== 0xff) {
    if (invSum > 0.0) invSum = 1.0/invSum;
    cols.push(c1*invSum, c2*invSum, c3*invSum);
    mats.push(m1*invSum, m2*invSum, m3*invSum);
  }

  return mask;
};

let vTemp = [0.0, 0.0, 0.0];
let interpolateVertices = function (edgeMask, cubeEdges, grid, x, vertices) {
  vTemp[0] = vTemp[1] = vTemp[2] = 0.0;
  let edgeCount = 0;
  //For every edge of the cube...
  for (let i = 0; i < 12; ++i) {
    //Use edge mask to check if it is crossed
    if (!(edgeMask & (1<<i)))
      continue;
    ++edgeCount; //If it did, increment number of edge crossings
    if (SurfaceNets.BLOCK)
      continue;
    //Now find the point of intersection
    let e0 = cubeEdges[i<<1]; //Unpack vertices
    let e1 = cubeEdges[(i<<1) + 1];
    let g0 = grid[e0]; //Unpack grid values
    let t = g0 - grid[e1]; //Compute point of intersection
    if (Math.abs(t) < 1e-7)
      continue;
    t = g0/t;

    //Interpolate vertices and add up intersections (this can be done without multiplying)
    for (let j = 0, k = 1; j < 3; ++j, k <<= 1) {
      let a = e0 & k;
      if (a !== (e1 & k))
        vTemp[j] += a ? 1.0 - t : t;
      else
        vTemp[j] += a ? 1.0 : 0.0;
    }
  }
  //Now we just average the edge intersections and add them to coordinate
  let s = 1.0/edgeCount;
  for (let l = 0; l < 3; ++l) {
    vTemp[l] = x[l] + s*vTemp[l];
  }
  vertices.push(vTemp[0], vTemp[1], vTemp[2]);
};

let createFace = function (edgeMask, mask, buffer, R, m, x, faces) {
  //Now we need to add faces together, to do this we just loop over 3 basis components
  for (let i = 0; i < 3; ++i) {
    //The first three entries of the edgeMask count the crossings along the edge
    if (!(edgeMask & (1<<i)))
      continue;

    // i = axes we are point along.  iu, iv = orthogonal axes
    let iu = (i + 1)%3;
    let iv = (i + 2)%3;

    //If we are on a boundary, skip it
    if (x[iu] === 0 || x[iv] === 0)
      continue;

    //Otherwise, look up adjacent edges in buffer
    let du = R[iu];
    let dv = R[iv];

    //Remember to flip orientation depending on the sign of the corner.
    if (mask & 1)
      faces.push(buffer[m], buffer[m - du], buffer[m - du - dv], buffer[m - dv]);
    else
      faces.push(buffer[m], buffer[m - dv], buffer[m - du - dv], buffer[m - du]);
  }
};

SurfaceNets.computeSurface = function (voxels) {
  let dims = voxels.dims;

  let vertices = [];
  let cols = [];
  let mats = [];
  let faces = [];
  let n = 0;
  let x = new Int32Array(3);
  let R = new Int32Array([1, (dims[0] + 1), (dims[0] + 1)*(dims[1] + 1)]);
  let grid = new Float32Array(8);
  let nbBuf = 1;
  let buffer = new Int32Array(R[2]*2);

  //March over the voxel grid
  for (x[2] = 0; x[2] < dims[2] - 1; ++x[2], n += dims[0], nbBuf ^= 1, R[2] = -R[2]) {

    //m is the pointer into the buffer we are going to use.  
    //This is slightly obtuse because javascript does not have good support for packed data structures, so we must use typed arrays :(
    //The contents of the buffer will be the indices of the vertices on the previous x/y slice of the volume
    let m = 1 + (dims[0] + 1)*(1 + nbBuf*(dims[1] + 1));

    for (x[1] = 0; x[1] < dims[1] - 1; ++x[1], ++n, m += 2) {
      for (x[0] = 0; x[0] < dims[0] - 1; ++x[0], ++n, ++m) {

        let mask = readScalarValues(voxels, grid, dims, n, cols, mats);
        //Check for early termination if cell does not intersect boundary
        if (mask === 0 || mask === 0xff)
          continue;
        //Sum up edge intersections
        let edgeMask = edgeTable[mask];
        buffer[m] = vertices.length/3;
        interpolateVertices(edgeMask, cubeEdges, grid, x, vertices);
        createFace(edgeMask, mask, buffer, R, m, x, faces);
      }
    }
  }

  //All done!  Return the result
  return {
    colors   : new Float32Array(cols),
    materials: new Float32Array(mats),
    vertices : new Float32Array(vertices),
    faces    : new Uint32Array(faces)
  };
};

export default SurfaceNets;
