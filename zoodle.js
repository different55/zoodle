class Zoodle {
  constructor(sceneElem, overlayElem, widgetsElem) {
    // TODO: Calculate appropriate zooms and sizes
    let zoom = 10;
    let rotate = { x: -Math.atan(1 / Math.sqrt(2)), y: TAU / 8 };

    this.scene = new Zdog.Illustration({
      element: sceneElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });
    this.overlay = new Zdog.Illustration({
      element: overlayElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });
    this.widgets = new Zdog.Illustration({
      element: widgetsElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });

    this.selection = [];
    this.queue = [];
    this.tool = "orbit";
    this.tools = {
      orbit: new OrbitTool(this),
    };

    this.presets = {
      solar: new Solar(this.scene),
    }

    this.presets.solar.load(this.scene);

    this.fetch = new Zfetch({
      scene: this.scene,
      click: this.click.bind(this),
      dragStart: this.dragStart.bind(this),
      dragMove: this.dragMove.bind(this),
      dragEnd: this.dragEnd.bind(this),
    });

    this.update();
  }

  update() {
    this.scene.updateRenderGraph();
    this.overlay.updateRenderGraph();
    this.widgets.updateRenderGraph();
    //this.scene.element.setAttribute("data-zdog", JSON.stringify(this.scene));
    requestAnimationFrame(this.update.bind(this));
  }

  select(target) {
    if (!target) {
      this.clearSelection();
      return;
    }

    // If this is a compositeChild, find its parent
    while (target.compositeChild) {
      target = target.addTo;
    }

    // Don't highlight if target is the scene element
    if (!target.addTo) {
      this.clearSelection();
      return;
    }

    this.toggleSelection(target);
  }

  toggleSelection(target) {
    const index = this.selection.indexOf(target);
    if (index !== -1) {
      this.selection.splice(index, 1);
    } else {
      this.selection.push(target);
    }
    this.updateSelection();
  }

  clearSelection() {
    this.selection = [];
    this.updateSelection();
  }

  updateSelection() {
    this.overlay.children = [];
    this.selection.forEach((selected) => {
      let highlight = selected.copyGraph({
        addTo: this.overlay,
        color: "#E62",
        backface: "#E62",
      });

      // Highlight all children
      highlight.flatGraph.forEach((child) => {
        child.color = '#E62';
        child.backface = '#E62';
      });

      // Apply parent transforms to selected object.
      Zdog.extend(highlight, this.getWorldTransforms(selected));
    });

    this.syncLayers();
  }

  syncLayers() {
    const scene = this.scene;
    const targets = [this.overlay, this.widgets];

    targets.forEach((target) => {
      target.translate = scene.translate;
      target.rotate = scene.rotate;
      target.scale = scene.scale;
      target.zoom = scene.zoom;
      target.updateGraph();
    });
  }

  getWorldTransforms(target) {
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
  }

  // input
  click(ptr, target, x, y) {
    this.select(target);
  }

  dragStart(ptr, target, x, y) {
    // TODO: Edit Zfetch so it just returns null instead of the scene.
    if (!target || target.element === this.scene.element) {
      this.tool = "orbit";
    }

    this.tools[this.tool].start(ptr, target, x, y);
  }

  dragMove(ptr, target, x, y) {
    this.tools[this.tool].move(ptr, target, x, y);
  }

  dragEnd(ptr, target, x, y) {
    this.tools[this.tool].end(ptr, target, x, y);
  }
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

class Preset {
  load(illo) {}
}

class Solar extends Preset {
  load(illo) {
    let sun = new Zdog.Shape({
      addTo: illo,
      stroke: 10,
      color: gold,
    });

    let arrow = new Zdog.Cone({
      addTo: sun,
      diameter: 1.5,
      length: 1.5,
      stroke: false,
      translate: { y: -7.5 },
      rotate: { x: -TAU / 4 },
      color: orange,
    });

    new Zdog.Cylinder({
      addTo: arrow,
      color: orange,
      stroke: false,
      length: 1,
      diameter: 0.75,
      translate: { z: -.5 },
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
        { bezier: [
            { x: 5.1, y: -4.17 },
            { x: 2.71, y: -6 },
            { x: 0, y: -6 },
          ]},
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
        { arc: [
            { x: -6, y: -6 },
            { x: -6, y: 0 },
          ]},
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

const sceneElem = document.querySelector("#canvas");
const overlayElem = document.querySelector("#overlay");
const widgetsElem = document.querySelector("#widgets");
const zoodle = new Zoodle(sceneElem, overlayElem, widgetsElem);