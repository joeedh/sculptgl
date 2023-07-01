import Enums from '../../misc/Enums.js';
import Brush from './Brush.js';
import Inflate from './Inflate.js';
import Twist from './Twist.js';
import Smooth from './Smooth.js';
import Flatten from './Flatten.js';
import Pinch from './Pinch.js';
import Crease from './Crease.js';
import Drag from './Drag.js';
import Paint from './Paint.js';
import Move from './Move.js';
import Masking from './Masking.js';
import LocalScale from './LocalScale.js';
import Transform from './Transform.js';

let Tools = [];

Tools[Enums.Tools.BRUSH] = Brush;
Tools[Enums.Tools.INFLATE] = Inflate;
Tools[Enums.Tools.TWIST] = Twist;
Tools[Enums.Tools.SMOOTH] = Smooth;
Tools[Enums.Tools.FLATTEN] = Flatten;
Tools[Enums.Tools.PINCH] = Pinch;
Tools[Enums.Tools.CREASE] = Crease;
Tools[Enums.Tools.DRAG] = Drag;
Tools[Enums.Tools.PAINT] = Paint;
Tools[Enums.Tools.MOVE] = Move;
Tools[Enums.Tools.MASKING] = Masking;
Tools[Enums.Tools.LOCALSCALE] = LocalScale;
Tools[Enums.Tools.TRANSFORM] = Transform;

Tools[Enums.Tools.BRUSH].uiName = 'sculptBrush';
Tools[Enums.Tools.INFLATE].uiName = 'sculptInflate';
Tools[Enums.Tools.TWIST].uiName = 'sculptTwist';
Tools[Enums.Tools.SMOOTH].uiName = 'sculptSmooth';
Tools[Enums.Tools.FLATTEN].uiName = 'sculptFlatten';
Tools[Enums.Tools.PINCH].uiName = 'sculptPinch';
Tools[Enums.Tools.CREASE].uiName = 'sculptCrease';
Tools[Enums.Tools.DRAG].uiName = 'sculptDrag';
Tools[Enums.Tools.PAINT].uiName = 'sculptPaint';
Tools[Enums.Tools.MOVE].uiName = 'sculptMove';
Tools[Enums.Tools.MASKING].uiName = 'sculptMasking';
Tools[Enums.Tools.LOCALSCALE].uiName = 'sculptLocalScale';
Tools[Enums.Tools.TRANSFORM].uiName = 'sculptTransform';

export default Tools;
