(() => {
  const canvas = document.getElementById("artwork-canvas");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BG = "#ebe7de";

  function getCanvasSize() {
    const w = window.innerWidth;
    if (w < 640) return 280;
    if (w < 768) return 320;
    return 380;
  }

  function getDensity() {
    const w = window.innerWidth;
    if (w < 640) return { layers: 52, rayParticles: 48, subRays: 5 };
    return { layers: 72, rayParticles: 64, subRays: 6 };
  }

  let canvasSize = getCanvasSize();
  let ctx = canvas.getContext("2d");
  let mouse = { x: canvasSize / 2, y: canvasSize / 2 };
  let nodes = [];
  let time = 0;
  let frameId = null;

  function createNodes() {
    const { layers: starLayers, rayParticles, subRays: subRaysPerMain } = getDensity();
    const pointRays = 12;
    const list = [];

    for (let layer = 0; layer < starLayers; layer++) {
      const t = layer / starLayers;
      const z = (Math.random() - 0.5) * 60;

      for (let ray = 0; ray < pointRays; ray++) {
        const rayAngle = (ray / pointRays) * Math.PI * 2;
        const mainDistance = t * 170 + Math.sin(t * Math.PI) * 50;
        const x = Math.cos(rayAngle) * mainDistance;
        const y = Math.sin(rayAngle) * mainDistance;

        list.push(makeNode(x, y, z, 0.4, 0.25));

        for (let subRay = 1; subRay < subRaysPerMain; subRay++) {
          const subAngle = rayAngle + (subRay / subRaysPerMain) * (Math.PI / pointRays);
          const subProgress = subRay / subRaysPerMain;
          const subDistance = t * 120 * (1 - Math.abs(subProgress - 0.5) * 0.5);
          list.push(makeNode(
            Math.cos(subAngle) * subDistance,
            Math.sin(subAngle) * subDistance,
            z,
            0.35,
            0.22
          ));
        }

        if (t < 0.8) {
          const innerAngle = rayAngle + Math.PI / pointRays;
          const innerDistance = t * 100 * 0.8;
          list.push(makeNode(
            Math.cos(innerAngle) * innerDistance,
            Math.sin(innerAngle) * innerDistance,
            z,
            0.35,
            0.2
          ));
        }
      }
    }

    const rayCount = 12;
    for (let ray = 0; ray < rayCount; ray++) {
      const rayAngle = (ray / rayCount) * Math.PI * 2;
      for (let i = 0; i < rayParticles; i++) {
        const t = i / rayParticles;
        const distance = t * 200;
        list.push({
          ...makeNode(
            Math.cos(rayAngle) * distance,
            Math.sin(rayAngle) * distance,
            (Math.random() - 0.5) * 40,
            0.2,
            0.12
          ),
          color: `rgba(120, 118, 112, ${0.35 * (1 - t)})`,
          isRay: true,
        });
      }
    }

    return list;
  }

  function makeNode(x, y, z, baseSize, variance) {
    return {
      originalX: x,
      originalY: y,
      originalZ: z,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      dispersing: false,
      disperseTime: 0,
      size: baseSize + Math.random() * variance,
      isRay: false,
    };
  }

  function resize() {
    const next = getCanvasSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasSize = next;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + "px";
    canvas.style.height = canvasSize + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mouse = { x: canvasSize / 2, y: canvasSize / 2 };
  }

  function project3DPoint(x, y, z, rotationX, rotationZ) {
    let rotatedY = y * Math.cos(rotationX) - z * Math.sin(rotationX);
    const rotatedZ = y * Math.sin(rotationX) + z * Math.cos(rotationX);
    const rotatedX = x * Math.cos(rotationZ) - rotatedY * Math.sin(rotationZ);
    rotatedY = x * Math.sin(rotationZ) + rotatedY * Math.cos(rotationZ);
    const scale = 400 / (400 + rotatedZ);
    return {
      x: rotatedX * scale + canvasSize / 2,
      y: rotatedY * scale + canvasSize / 2,
      z: rotatedZ,
      scale,
    };
  }

  function setPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * canvasSize;
    mouse.y = ((clientY - rect.top) / rect.height) * canvasSize;
  }

  function drawFrame(rotationX, rotationZ) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    if (!reducedMotion) {
      const candidates = [];
      nodes.forEach((node) => {
        const projected = project3DPoint(node.x, node.y, node.z, rotationX, rotationZ);
        const dist = Math.hypot(projected.x - mouse.x, projected.y - mouse.y);
        if (dist < 100 && !node.dispersing && !node.isRay) {
          candidates.push({ node, distance: dist });
        }
      });

      candidates.sort((a, b) => a.distance - b.distance);
      candidates.slice(0, 12).forEach(({ node }) => {
        node.dispersing = true;
        node.disperseTime = 0;
        const angle = Math.atan2(node.y, node.x);
        const verticalAngle = Math.atan2(node.z, Math.hypot(node.x, node.y));
        node.vx = Math.cos(angle) * Math.cos(verticalAngle) * 2;
        node.vy = Math.sin(angle) * Math.cos(verticalAngle) * 2;
        node.vz = Math.sin(verticalAngle) * 2;
      });

      nodes.forEach((node) => {
        if (!node.dispersing) return;
        node.disperseTime += 0.01;
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;
        node.vx *= 0.94;
        node.vy *= 0.94;
        node.vz *= 0.9;
        node.vz -= 0.05;

        if (node.disperseTime > 3.5 || Math.hypot(node.x, node.y) > 450) {
          node.dispersing = false;
          node.x = node.originalX;
          node.y = node.originalY;
          node.z = node.originalZ;
          node.vx = 0;
          node.vy = 0;
          node.vz = 0;
        }
      });
    }

    const sorted = [...nodes].sort((a, b) => {
      const pa = project3DPoint(a.x, a.y, a.z, rotationX, rotationZ);
      const pb = project3DPoint(b.x, b.y, b.z, rotationX, rotationZ);
      return pb.z - pa.z;
    });

    sorted.forEach((node) => {
      const projected = project3DPoint(node.x, node.y, node.z, rotationX, rotationZ);
      let alpha = projected.scale;
      if (node.dispersing) alpha *= 1 - node.disperseTime / 3.5;
      const size = node.size * projected.scale;

      if (node.isRay) {
        ctx.fillStyle = node.color;
      } else {
        ctx.fillStyle = `rgba(31, 30, 29, ${alpha * 0.75})`;
      }

      ctx.beginPath();
      ctx.arc(projected.x, projected.y, Math.max(0.35, size), 0, Math.PI * 2);
      ctx.fill();
    });

    const glow = ctx.createRadialGradient(
      canvasSize / 2, canvasSize / 2, 0,
      canvasSize / 2, canvasSize / 2, canvasSize * 0.38
    );
    glow.addColorStop(0, "rgba(255, 248, 230, 0.12)");
    glow.addColorStop(1, "rgba(255, 248, 230, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  }

  function animate() {
    time += 0.0022;
    drawFrame(time * 0.08, time * 0.06);
    frameId = requestAnimationFrame(animate);
  }

  function init() {
    if (frameId) cancelAnimationFrame(frameId);
    resize();
    nodes = createNodes();
    if (reducedMotion) {
      drawFrame(0.15, 0.1);
    } else {
      animate();
    }
  }

  canvas.addEventListener("mousemove", (e) => setPointer(e.clientX, e.clientY));
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 200);
  });

  init();
})();
