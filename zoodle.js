function Zoodle(scene, overlay, widgets) {
  this.scene = scene;
  this.overlay = overlay;
  this.widgets = widgets;

  this.selection = [];
  this.tool = "orbit";
  this.tools = {
    orbit: new OrbitTool(this),
    translate: new TranslateTool(this),
  };

  this.click = (ptr, target, x, y) => {
    this.select(target);
  };

  this.select = (target) => {
    // If this is a compositeChild, find its parent
    while (target.compositeChild) {
      target = target.addTo;
    }

    // Don't highlight if target is the scene element
    if (!target || target.element === this.scene.element) {
      this.clearSelection();
      return;
    }

    this.toggleSelection(target);
  };

  this.toggleSelection = (target) => {
    const index = this.selection.indexOf(target);

    if (index !== -1) {
      this.selection.splice(index, 1);
    } else {
      this.selection.push(target);
    }

    this.updateSelection();
  };

  this.clearSelection = () => {
    this.selection = [];

    this.updateSelection();
  };

  this.updateSelection = () => {
    this.overlay.children = [];

    for (let i = 0; i < this.selection.length; i++) {
      let currentObj = this.selection[i];

      let highlight = currentObj.copyGraph({
        addTo: this.overlay,
        color: "#E62",
        backface: "#E62",
      });

      for (let j = 0; j < highlight.flatGraph.length; j++) {
        highlight.flatGraph[j].color = "#E62";
        highlight.flatGraph[j].backface = "#E62";
      }

      Zdog.extend(highlight, this.getWorldTransforms(currentObj));

    }

    this.syncLayers();
  };

  this.getWorldTransforms = (target) => {
    let translate = new Zdog.Vector();
    let rotate = new Zdog.Vector();
    let scale = new Zdog.Vector({x: 1, y: 1, z: 1});

    let right = new Zdog.Vector({x: 1, y: 0, z: 0});
    let down = new Zdog.Vector({x: 0, y: 1, z: 0});
    let forward = new Zdog.Vector({x: 0, y: 0, z: 1});

    // Condense transforms from all ancestors except the root.
    while (target.addTo) {
      translate.transform(target.translate, target.rotate, target.scale);
      forward.rotate(target.rotate);
      down.rotate(target.rotate);
      right.rotate(target.rotate);
      scale.multiply(target.scale);

      target = target.addTo;
    }

    if (Math.abs(forward.x) > 0.99999) {
      // Gimbal lock case
      rotate.x = 0;
      rotate.y = forward.x > 0 ? -Math.PI/2 : Math.PI/2;
      rotate.z = Math.atan2(right.y, down.y);
    } else {
      rotate.y = -Math.asin(forward.x);
      rotate.x = Math.atan2(-forward.y, forward.z);
      rotate.z = Math.atan2(-down.x, right.x);
    }
    return {translate: translate, rotate: rotate, scale: scale};
  };

  this.dragStart = (ptr, target, x, y) => {
    if (!target || target.element === this.scene.element) {
      this.tool = "orbit";
    }

    this.tools[this.tool].start(ptr, target, x, y);
  };

  this.dragMove = (ptr, target, x, y) => {
    this.tools[this.tool].move(ptr, target, x, y);
  };

  this.dragEnd = (ptr, target, x, y) => {
    this.tools[this.tool].end(ptr, target, x, y);
  };

  this.fetch = new Zfetch({
    scene: this.scene,
    click: this.click,
    dragStart: this.dragStart,
    dragMove: this.dragMove,
    dragEnd: this.dragEnd,
  });

  this.syncLayers = () => {
    scene = this.scene;
    targets = [this.overlay, this.widgets];

    targets.forEach(target => {
      target.zoom = scene.zoom;
      target.scale = scene.scale;
      target.rotate = scene.rotate;
      target.translate = scene.translate;
      target.updateRenderGraph();
    });
  }

  this.syncLayers();
}

class Tool {
  constructor(editor) {
    this.editor = editor;
  }
  start(ptr, target, x, y) {}
  move(ptr, target, x, y) {}
  end(ptr, target, x, y) {}
}

class OrbitTool extends Tool {
  start(ptr, target, x, y) {
    this.editor.fetch.rotateStart(ptr, target, x, y);
  }
  move(ptr, target, x, y) {
    this.editor.fetch.rotateMove(ptr, target, x, y);
  }
}

class TranslateTool extends Tool {
  constructor(editor) {
    super(editor);
    this.startPosition = new Zdog.Vector();
  }
  start(ptr, target, x, y) {
    this.startPosition = this.editor.selected.translate.copy();
  }
  move(ptr, target, x, y) {
    let delta = new Zdog.Vector({
      x: x / this.editor.zoom,
      y: y / this.editor.zoom,
    });
    this.editor.selected.translate = this.startPosition
      .copy()
      .add(delta)
      .rotate(this.editor.scene.rotate);
  }
}

const TAU = Zdog.TAU;

const charcoal = "#333";
const raisin = "#534";
const plum = "#636";
const rose = "#C25";
const orange = "#E62";
const gold = "#EA0";
const lemon = "#ED0";
const peach = "#FDB";
const lace = "#FFF4E8";
const mint = "#CFD";
const lime = "#4A2";
const blueberry = "#359";

function init() {
  window.illoElem = document.getElementById("canvas");
  window.widgetsElem = document.getElementById("widgets");
  window.overlayElem = document.getElementById("overlay");

  illoElem.setAttribute("width", illoElem.clientWidth);
  illoElem.setAttribute("height", illoElem.clientHeight);

  widgetsElem.setAttribute("width", illoElem.clientWidth);
  widgetsElem.setAttribute("height", illoElem.clientHeight);
  overlayElem.setAttribute("width", illoElem.clientWidth);
  overlayElem.setAttribute("height", illoElem.clientHeight);

  window.illo = new Zdog.Illustration({
    element: illoElem,
    zoom: 10,
    rotate: { x: -Math.atan(1 / Math.sqrt(2)), y: TAU / 8 },
    dragRotate: false,
  });

  window.widgets = new Zdog.Illustration({
    element: widgetsElem,
    zoom: 10,
    dragRotate: false,
  });

  window.overlay = new Zdog.Illustration({
    element: overlayElem,
    zoom: 10,
    dragRotate: false,
  });

  let sun = new Zdog.Shape({
    addTo: window.illo,
    stroke: 10,
    color: gold,
  });

  new Zdog.Cone({
    addTo: sun,
    diameter: 1.5,
    length: 1.5,
    stroke: 0.1,
    translate: { y: -7.5 },
    rotate: { x: -TAU / 4 },
    color: orange,
  });

  /*window.horn = new Zdog.Horn({
    addTo: illo,
    frontDiameter: 10,
    rearDiameter: 2,
    length: 20,
    fill: true,
    stroke: 0,
    color: '#C25',
    translate: { y: -9 },
  });*/

  new Zdog.Cylinder({
    addTo: sun,
    color: orange,
    stroke: false,
    length: 1,
    diameter: 0.75,
    translate: { y: -8 },
    rotate: { x: -TAU / 4 },
  });

  new Zdog.Shape({
    addTo: sun,
    stroke: 1,
    translate: { x: 6 },
    color: raisin,
  });

  let orbit = new Zdog.Anchor({
    addTo: sun,
    rotate: { x: TAU / 4 },
  });

  let orbitalProps = {
    stroke: 0.5,
    color: charcoal,
    closed: false,
  };

  let quadrant = new Zdog.Shape({
    addTo: orbit,
    path: [
      { x: 5.8, y: -1.55 },
      {
        bezier: [
          { x: 5.1, y: -4.17 },
          { x: 2.71, y: -6 },
          { x: 0, y: -6 },
        ]
      },
    ],
  });

  Zdog.extend(quadrant, orbitalProps);

  quadrant.copy({
    scale: { y: -1 },
  });

  quadrant = new Zdog.Shape({
    addTo: orbit,
    path: [
      { x: 0, y: -6 },
      {
        arc: [
          { x: -6, y: -6 },
          { x: -6, y: 0 },
        ]
      },
    ]
  });

  Zdog.extend(quadrant, orbitalProps);

  quadrant.copy({
    scale: { y: -1 },
  });

  new Zdog.Shape({
    addTo: sun,
    stroke: 2,
    translate: { x: Math.cos(TAU/8)*8, z: Math.sin(TAU/8)*8 },
    color: rose,
  });

  orbit.copyGraph({
    rotate: { x: TAU / 4, z: TAU / 8 },
    scale: 8/6,
  });

  new Zdog.Shape({
    addTo: sun,
    stroke: 2,
    translate: { x: Math.cos(TAU/4)*10, z: Math.sin(TAU/4)*10 },
    color: blueberry,
  });

  orbit.copyGraph({
    rotate: { x: TAU / 4, z: TAU / 4 },
    scale: 10 / 6,
  });

  window.zoodle = new Zoodle(illo, overlay, widgets);
}

// TODO: Only update when we have something to update.
function update() {
  window.illo.updateRenderGraph();
  window.widgets.updateRenderGraph();
  window.overlay.updateRenderGraph();
  window.illoElem.setAttribute("data-zdog", JSON.stringify(window.illo));
  requestAnimationFrame(update);
}

init();

update();

