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