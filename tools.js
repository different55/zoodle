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
    this.targets = this.editor.selection.slice(0);
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
    delta *= this.widget.addTo.addTo.scale.x;
    delta *= Math.abs(this.widget.renderNormal.magnitude2d());
    // TODO: Oh I know where this is going wrong, we're not including how the view rotation is going to shorten the distance.
    // We need some sines or cosines or something or both in here.
    this.targets.forEach((t, i) => {
      t.translate[this.mode] = this.startTranslate[i][this.mode] + delta;
    });
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
  end(ptr, target, x, y) {
    if (!this.mode) { return; }
    // ensure any final adjustments are applied.
    this.move(ptr, target, x, y);
    let direction = this.widget.renderNormal; // TODO: Break out into a function.
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x));
    delta /= -this.editor.scene.zoom;
    delta *= this.widget.addTo.addTo.scale.x;
    delta /= Math.abs(this.widget.renderNormal.magnitude2d());
    let command = new TranslateCommand(this.editor, this.targets, new Zdog.Vector({[this.mode]: delta}), this.startTranslate);
    this.editor.did(command);
  }
  drawWidget(targets) {
    // Create anchors matching selected objects.
    targets = targets.map((target) => {
      // TODO: Double check this is correct.
      let parentTransforms = this.editor.getWorldTransforms(target.addTo);
      let childTranslate = target.translate.copy().rotate(parentTransforms.rotate);
      parentTransforms.translate.add(childTranslate);
      parentTransforms.translate.multiply(parentTransforms.scale);
      return new Zdog.Anchor({
        addTo: this.editor.ui,
        ...parentTransforms,
      });
    });

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

// TODO: I think this is going to need to run on basis vectors like getWorldTransforms.
class RotateTool extends Tool {
  constructor(editor) {
    super(editor);
    this.targets = null;
    this.startRotate = null;
    this.mode = RotateTool.MODE_NONE;
    this.widget = null;
  }

  start(ptr, target, x, y) {
    this.widget = target;
    this.targets = this.editor.selection.slice(0);
    this.mode = RotateTool.MODE_NONE;
    if (!this.targets.length || target.layer !== Zoodle.LAYER_UI || !target.color) {
      return;
    }

    this.startRotate = this.targets.map( t => t.rotate.copy() );

    switch (target.color) {
      case rose:
        this.mode = RotateTool.MODE_X;
        break;
      case lime:
        this.mode = RotateTool.MODE_Y;
        break;
      case blueberry:
        this.mode = RotateTool.MODE_Z;
        break;
    }
  }
  move( ptr, target, x, y ) {
    if (!this.mode) { return; }

    let displaySize = Math.min( this.editor.scene.width, this.editor.scene.height );
    x /= displaySize / Math.PI * Zdog.TAU;
    y /= displaySize / Math.PI * Zdog.TAU;
    let direction = this.widget.renderNormal;
    let delta = this.editor.getAxisDistance(x, y, Math.atan2(direction.y, direction.x) + TAU/4 );
    this.targets.forEach((t, i) => {
      t.rotate[this.mode] = this.startRotate[i][this.mode] + delta;
    });
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
  // TODO: Let's stash `delta` somewhere so we don't have to recalculate it in end()
  end( ptr, target, x, y ) {
    if (!this.mode) { return; }
    // ensure any final adjustments are applied.
    this.move( ptr, target, x, y );
    let displaySize = Math.min( this.editor.scene.width, this.editor.scene.height );
    x /= displaySize * Math.PI * Zdog.TAU;
    y /= displaySize * Math.PI * Zdog.TAU;
    let direction = this.widget.renderNormal;
    let delta = this.editor.getAxisDistance( x, y, Math.atan2(direction.y, direction.x) + TAU/4 );
    let command = new RotateCommand(this.editor, this.targets, new Zdog.Vector({[this.mode]: delta}));
    this.editor.did(command);
  }
  drawWidget(targets) {
    // Create anchors matching selected objects.
    targets = targets.map((target) => {
      return new Zdog.Anchor({
        addTo: this.editor.ui,
        ...this.editor.getWorldTransforms(target),
      });
    });

    const widgetDiameter = 10;
    const widgetStroke = 0.75;

    let origin = new Zdog.Shape({
      stroke: .5,
      color: lace,
    });
    let zRing = new Zdog.Ellipse({
      diameter: widgetDiameter,
      stroke: widgetStroke,
      color: blueberry,
    });
    let yRing = zRing.copyGraph({
      rotate: { x: TAU/4 },
      color: lime,
    });
    let xRing = zRing.copyGraph({
      rotate: { y: TAU/4 },
      color: rose,
    });
    targets.forEach(t => {
      origin.copyGraph({ addTo: t, scale: 1/t.scale.x });
      zRing.copyGraph({ addTo: t, scale: 1/t.scale.x });
      yRing.copyGraph({ addTo: t, scale: 1/t.scale.x });
      xRing.copyGraph({ addTo: t, scale: 1/t.scale.x });
    });
  }

  static get MODE_NONE() { return ''; }
  static get MODE_X() { return 'x'; }
  static get MODE_Y() { return 'y'; }
  static get MODE_Z() { return 'z'; }
}

class Command {
  constructor(editor) {
    this.editor = editor;
  }
  do() {}
  undo() {}
}

class SelectCommand extends Command {
  constructor(editor, target, replace = false) {
    super(editor);
    this.replace = replace;
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
    this.oldSelection = this.editor.selection.slice( 0 );
    if (!this.target) {
      this.editor.clearSelection();
    } else if (this.replace) {
      this.editor.setSelection(this.target);
    } else {
      this.editor.toggleSelection(this.target);
    }
    this.refresh();
  }
  undo() {
    this.editor.selection = this.oldSelection;
    this.refresh();
  }
  refresh() {
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
}

class TranslateCommand extends Command {
  constructor(editor, target, delta, oldTranslate = null) {
    super(editor);
    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.delta = delta;
    this.oldTranslate = oldTranslate || target.map((t) => t.translate.copy());
  }

  do() {
    if (!this.target) return console.error("Doing TranslateCommand with no target.");

    this.target.forEach((t, i) => {
      t.translate.set(this.oldTranslate[i]).add(this.delta);
    });
    this.refresh();
  }
  undo() {
    if (!this.target) return console.error("Undoing TranslateCommand with no target.");

    this.target.forEach((t, i) => {
      t.translate.set(this.oldTranslate[i]);
    });
    this.refresh();
  }
  refresh() {
    this.editor.updateHighlights();
    this.editor.updateUI();
    this.editor.props.updatePanel();
  }
}

class RotateCommand extends Command {
  // TODO: Add oldTranslate and oldRotate to the constructor, or maybe a flag to tell it if it's getting new or old transforms.
  constructor(editor, target, delta) {
    super(editor);
    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.delta = delta;
    this.oldRotate = target.map((t) => t.rotate.copy());
  }

  do() {
    // TODO: Probably better to just throw in the constructor.
    if (!this.target) return console.error("Doing RotateCommand with no target.");

    this.target.forEach((t, i) => {
      t.rotate.set(this.oldRotate[i]).add(this.delta);
    });
  }
  undo() {
    if (!this.target) return console.error("Undoing RotateCommand with no target.");

    this.target.forEach((t, i) => {
      t.rotate.set(this.oldRotate[i]);
    });
  }
}

class EditCommand extends Command {
  constructor(editor, target, propId, value, oldValue = null) {
    super(editor);
    if (!target) {
      throw new Error("No target specified for EditCommand");
    }

    if (!Array.isArray(target)) {
      target = [target];
    }
    this.target = target;
    this.propId = propId;
    this.value = value;
    this.oldValue = oldValue || target.map( (t) => t[propId]);
  }
  do() {
    this.target.forEach( (t) => {
      t[this.propId] = this.value;
      if (t.updatePath) t.updatePath();
    });
  }
  undo() {
    this.target.forEach( (t, i) => {
      t[this.propId] = this.oldValue[i];
      if (t.updatePath) t.updatePath();
    });
  }
}