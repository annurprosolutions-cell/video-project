// Scene order + cut points (seconds). Cuts sit just before the lyric line that opens the next scene.
(() => {
  const plan = [
    // [scene, cut after (s), transition length (s), type 0=dissolve 1=via white 2=via black]
    ['dawn', 16.3, 1.2, 0],
    ['rainWindow', 27.6, 1.0, 0],
    ['beach', 38.3, 1.2, 0],
    ['padi', 53.9, 1.2, 0],
    ['lake', 73.7, .9, 0],
    ['nightRain', 79.5, 1.0, 2],
    ['surau', 84.8, 1.1, 0],
    ['storm', 96.0, 1.2, 0],
    ['forest', 104.8, 1.1, 0],
    ['masjid', 112.7, .9, 0],
    ['aerial', 124.1, 1.0, 0],
    ['ocean', 137.8, 1.3, 2],
    ['underwater', 143.7, 1.2, 1],
    ['nightBeach', 150.0, 1.6, 1],
    ['sunrise', 999, 0, 0],
  ].filter(([n]) => SCN[n]);
  plan.forEach(([n, at, dur, type], i) => {
    Engine.add(SCN[n]);
    if (i < plan.length - 1) Engine.cut(at, dur, type);
  });
})();
