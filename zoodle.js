class Zoodle {
  constructor(sceneElem, overlayElem, uiElem) {
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
    this.ui = new Zdog.Illustration({
      element: uiElem,
      zoom: zoom,
      resize: 'fullscreen',
      rotate: rotate,
      dragRotate: false,
    });

    this.selection = [];
    this.history = new History();
    this.tools = {
      orbit: new OrbitTool(this),
      translate: new TranslateTool(this),
    };
    this.tool = this.tools.translate;

    this.presets = {
      solar: new Solar(),
    }

    this.presets.solar.load(this.scene);

    this.sceneInput = new Zfetch({
      scene: this.scene,
      click: this.click.bind(this),
      dragStart: this.dragStart.bind(this),
      dragMove: this.dragMove.bind(this),
      dragEnd: this.dragEnd.bind(this),
    });

    this.uiInput = new Zfetch({
      scene: this.ui,
      capture: true,
      click: this.click.bind(this),
      dragStart: this.dragStart.bind(this),
      dragMove: this.dragMove.bind(this),
      dragEnd: this.dragEnd.bind(this),
    });

    uiElem.addEventListener("gotpointercapture", _ => uiElem.classList.add("active"));
    uiElem.addEventListener("lostpointercapture", _ => uiElem.classList.remove("active"));

    this.update();
  }

  update() {
    this.syncLayers();
    this.scene.updateRenderGraph();
    this.overlay.updateRenderGraph();
    this.ui.updateRenderGraph();
    //this.scene.element.setAttribute("data-zdog", JSON.stringify(this.scene));
    requestAnimationFrame(this.update.bind(this));
  }

  set tool(tool) {
    this._tool = tool;
    this.updateUI();
  }
  get tool() { return this._tool; }

  // Perform a command and add it to the history.
  do(command) {
    this.history.push(command);
    command.do();
  }

  // Store a record of a command that has already been performed.
  did(command) {
    this.history.push(command);
  }

  toggleSelection(target) {
    const index = this.selection.indexOf(target);
    if (index !== -1) {
      this.selection.splice(index, 1);
    } else {
      this.selection.push(target);
    }
    this.updateHighlights();
    this.updateUI();
  }

  clearSelection() {
    this.selection = [];
    this.updateHighlights();
    this.updateUI();
  }

  updateHighlights() {
    this.overlay.children = [];
    this.selection.forEach((selected) => {
      let highlight = selected.copyGraph({
        addTo: this.overlay,
        color: "#E62",
        backface: "#E62",
        ...this.getWorldTransforms(selected),
      });

      // Highlight all children
      highlight.flatGraph.forEach((child) => {
        child.color = '#E62';
        child.backface = '#E62';
      });

      // Apply parent transforms to selected object.
      // Zdog.extend(highlight, this.getWorldTransforms(selected));
    });
  }

  updateUI() {
    this.ui.children = [];

    if (this.selection.length === 0) {
      return;
    }

    // Create anchors matching selected objects.
    let targets = this.selection.map((target) => {
      return new Zdog.Anchor({
        addTo: this.ui,
        ...this.getWorldTransforms(target),
      });
    });

    this.tool.drawWidget(targets);
  }

  syncLayers() {
    const scene = this.scene;
    const targets = [this.overlay, this.ui];

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
    target.layer = this.getLayer(target.element)
    this.do(new SelectCommand(this, target));
  }

  dragStart(ptr, target, x, y) {
    target.layer = this.getLayer(target.element);
    if (!target || !target.addTo) {
      this.tool = new TemporaryTool(this, this.tool, this.tools.orbit, true);
    }

    this.tool.start(ptr, target, x, y);
  }

  dragMove(ptr, target, x, y) {
    target.layer = this.getLayer(target.element);
    this.tool.move(ptr, target, x, y);
  }

  dragEnd(ptr, target, x, y) {
    target.layer = this.getLayer(target.element);
    this.tool.end(ptr, target, x, y);
  }

  getLayer(element) {
    switch (element) {
      case this.scene.element:
        return Zoodle.LAYER_CANVAS;
      case this.overlay.element:
        return Zoodle.LAYER_OVERLAY;
      case this.ui.element:
        return Zoodle.LAYER_UI;
      default:
        console.error(`Unsupported element ${element}`);
    }
  }

  // returns the distance of a point (x, y) from the origin along the axis defined by the angle.
  getAxisDistance(x, y, angle) {
    return x * Math.cos(angle) + y * Math.sin(angle);
  }

  static get LAYER_CANVAS() { return 1; }
  static get LAYER_OVERLAY() { return 2; }
  static get LAYER_UI() { return 3; }
}

class Tool {
  constructor(editor) {
    this.editor = editor;
  }
  start(ptr, target, x, y) {}
  move(ptr, target, x, y) {}
  end(ptr, target, x, y) {}
  drawWidget(targets) {}
}

// this tool performs the actions of another tool without hiding the widgets of the original
class TemporaryTool extends Tool {
  constructor(editor, style, substance, autoRestore = true) {
    super(editor);
    this.style = style;
    this.substance = substance;
    this.autoRestore = autoRestore;
  }
  start(ptr, target, x, y) {
    this.substance.start(ptr, target, x, y);
  }
  move(ptr, target, x, y) {
    this.substance.move(ptr, target, x, y);
  }
  end(ptr, target, x, y) {
    this.substance.end(ptr, target, x, y);
    if (this.autoRestore) {
      this.editor.tool = this.style;
    }
  }
  drawWidget(targets) {
    this.style.drawWidget(targets);
  }
}

class OrbitTool extends Tool {
  constructor(editor) {
    super(editor);
    this.rotateStart = null;
  }
  start(ptr, target, x, y) {
    this.rotateStart = this.editor.scene.rotate.copy();
  }
  move(ptr, target, x, y) {
    let displaySize = Math.min( this.editor.scene.width, this.editor.scene.height );
    let moveRY = x / displaySize * Math.PI * Zdog.TAU;
    let moveRX = y / displaySize * Math.PI * Zdog.TAU;
    this.editor.scene.rotate.x = this.rotateStart.x - moveRX;
    this.editor.scene.rotate.y = this.rotateStart.y - moveRY;

    this.editor.syncLayers();
  }
}

class TranslateTool extends Tool {
  constructor(editor) {
    super(editor);
    this.targets = null;
    this.startTranslate = null;
    this.mode = TranslateTool.MODE_NONE;
    this.widget = null;
  }
  start(ptr, target, x, y) {
    this.widget = target;
    this.targets = this.editor.selection;
    this.mode = TranslateTool.MODE_NONE;
    if (!this.targets.length || target.layer !== Zoodle.LAYER_UI || !target.color) {
      return;
    }
    // Ensure our widget target is the base and not the tip.
    if (this.widget.diameter)
        this.widget = this.widget.addTo;
    this.startTranslate = this.targets.map((t) => t.translate.copy());
    switch (target.color) {
      case rose:
        this.mode = TranslateTool.MODE_X;
        break;
      case lime:
        this.mode = TranslateTool.MODE_Y;
        break;
      case blueberry:
        this.mode = TranslateTool.MODE_Z;
        break;
      default:
        this.mode = TranslateTool.MODE_NONE;
        break;
    }
  }
  move(ptr, target, x, y) {
    if (!this.mode) { return; }
    let direction = this.widget.renderNormal; // TODO: Break out into a function.
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x));
    delta /= -this.editor.scene.zoom; // TODO: Include pixel ratio as well.
    delta *= this.widget.scale.x;
    this.targets.forEach((t, i) => {
      t.translate[this.mode] = this.startTranslate[i][this.mode] + delta;
    });
    this.editor.updateHighlights();
    this.editor.updateUI();
  }
  end(ptr, target, x, y) {
    if (!this.mode) { return; }
    // ensure any final adjustments are applied.
    this.move(ptr, target, x, y);
    let direction = this.widget.renderNormal; // TODO: Break out into a function.
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x));
    delta /= -this.editor.scene.zoom;
    delta /= this.widget.scale;
    let command = new TranslateCommand(this.editor, this.targets, new Zdog.Vector({[this.mode]: delta}));
    this.editor.did(command);
  }
  drawWidget(targets) {
    let origin = new Zdog.Shape({
      stroke: .5,
      color: lace,
    });
    let base = new Zdog.Shape({
      path: [ { z: -1.5 }, { z: 1.5 } ],
      stroke: 1,
      translate: { z: 3 },
    });
    new Zdog.Cone({
      addTo: base,
      diameter: 2,
      length: 1.5,
      stroke: .5,
      translate: { z: 1.5 },
    });
    let z = base.copyGraph({
      color: blueberry,
    });
    z.children[0].color = blueberry;
    let y = base.copyGraph({
      color: lime,
      rotate: { x: -TAU/4 },
      translate: { y: 3 },
    });
    y.children[0].color = lime;
    let x = base.copyGraph({
      color: rose,
      rotate: { y: -TAU/4 },
      translate: { x: 3 },
    });
    x.children[0].color = rose;
    targets.forEach(t => {
      origin.copyGraph({ addTo: t, scale: 1/t.scale.x });
      z.copyGraph({
        addTo: t,
        scale: 1/t.scale.x,
        translate: { z: 3/t.scale.x },
      });
      y.copyGraph({
        addTo: t,
        scale: 1/t.scale.x,
        translate: { y: 3/t.scale.x },
      });
      x.copyGraph({
        addTo: t,
        scale: 1/t.scale.x,
        translate: { x: 3/t.scale.x },
      });
    });
  }

  static get MODE_NONE() { return ''; }
  static get MODE_X() { return 'x'; }
  static get MODE_Y() { return 'y'; }
  static get MODE_Z() { return 'z'; }
  static get MODE_VIEW() { return 'v'; }
}

class Command {
  constructor(editor) {
    this.editor = editor;
  }
  do() {}
  undo() {}
}

class SelectCommand extends Command {
  constructor(editor, target) {
    super(editor);
    this.oldSelection = null;

    // If this is a compositeChild, find its parent
    while (target && target.compositeChild) {
      target = target.addTo;
    }
    // Don't select root elements.
    if (target && !target.addTo) {
      target = null;
    }
    this.target = target;
  }
  do() {
    if (!this.target) {
      this.oldSelection = this.editor.selection;
      this.editor.clearSelection();
    } else {
      this.editor.toggleSelection(this.target);
    }
  }
  undo() {
    if (!this.target) {
      this.editor.selection = this.oldSelection;
    } else {
      this.editor.toggleSelection(this.target);
    }
  }
}

class TranslateCommand extends Command {
  constructor(editor, target, delta) {
    super(editor);
    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.delta = delta;
    this.oldTranslate = target.map((t) => t.translate.copy());
  }

  do() {
    if (!this.target) return console.error("Doing TranslateCommand with no target.");

    this.target.forEach((t, i) => {
      t.translate.set(this.oldTranslate[i]).add(this.delta);
    });
  }
  undo() {
    if (!this.target) return console.error("Undoing TranslateCommand with no target.");

    this.target.forEach((t, i) => {
      t.translate.set(this.oldTranslate[i]);
    });
  }
}

class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  push(command, newCommand = true) {
    if (newCommand) {
      this.undoStack[this.undoStack.length - 1] = command;
    } else {
      this.undoStack.push(command);
    }

    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) {
      return;
    }

    let command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
  }

  redo() {
    if (this.redoStack.length === 0) {
      return;
    }

    let command = this.redoStack.pop();
    command.do();
    this.undoStack.push(command);
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

    let middleOrbit = orbit.copyGraph({
      rotate: { x: TAU / 5, z: TAU / 8 },
      scale: 8/6,
    });

    new Zdog.Shape({
      addTo: middleOrbit,
      stroke: 2,
      translate: { x: 6 },
      color: rose,
    });

    let outerOrbit = orbit.copyGraph({
      rotate: { x: TAU / 3, z: TAU / 4 },
      scale: 10 / 6,
    });

    new Zdog.Shape({
      addTo: outerOrbit,
      stroke: 2,
      translate: { x: 6 },
      color: blueberry,
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
const uiElem = document.querySelector("#ui");
const zoodle = new Zoodle(sceneElem, overlayElem, uiElem);