(() => {
  "use strict";

  const ARTWORK_URL = "/guru-rinpoche-thangka-original-6391x8940.jpg";
  const ARTWORK_FALLBACK_URL = "/guru-rinpoche-1920x2400-v1.jpg";
  const ARTWORK_PART_URLS = [
    "/guru-rinpoche-thangka-original.part-00",
    "/guru-rinpoche-thangka-original.part-01",
  ];
  const AUDIO_DURATION_FALLBACK = 472;

  const stage = document.getElementById("resonanceStage");
  const canvas = document.getElementById("resonanceCanvas");
  const artwork = document.getElementById("resonanceArtwork");
  const listen = document.getElementById("resonanceListen");
  const listenLabel = document.getElementById("resonanceListenLabel");
  const listenTime = document.getElementById("resonanceListenTime");
  const progress = document.getElementById("resonanceProgress");
  const audio = document.getElementById("resonanceAudio");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  if (
    !stage ||
    !canvas ||
    !artwork ||
    !listen ||
    !listenLabel ||
    !listenTime ||
    !progress ||
    !audio
  ) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) return;

  let sourceImage = null;
  let artworkLayer = null;
  let backgroundLayer = null;
  let particles = [];
  let animationFrame = null;
  let startTime = performance.now();
  let audioGraph = null;
  let objectUrl = null;

  const pointer = {
    nx: 0.78,
    ny: 0.5,
    targetX: 0.78,
    targetY: 0.5,
    velocity: 0,
    active: false,
  };

  const clamp = (value, minimum, maximum) =>
    Math.max(minimum, Math.min(maximum, value));

  const formatTime = (seconds) => {
    const safeSeconds = Number.isFinite(seconds)
      ? Math.max(0, seconds)
      : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = Math.floor(safeSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  const easeOutExpo = (value) =>
    value >= 1 ? 1 : 1 - 2 ** (-10 * value);

  const createParticles = (count) =>
    Array.from({ length: count }, (_, index) => {
      const edge = index % 4;
      const edgePosition = Math.random();
      const start =
        edge === 0
          ? { x: edgePosition, y: -0.08 }
          : edge === 1
            ? { x: 1.08, y: edgePosition }
            : edge === 2
              ? { x: edgePosition, y: 1.08 }
              : { x: -0.08, y: edgePosition };

      return {
        angle: Math.random() * Math.PI * 2,
        radius: 0.18 + Math.random() * 0.56,
        phase: Math.random() * Math.PI * 2,
        speed: 0.18 + Math.random() * 0.46,
        size: 0.55 + Math.random() * 1.75,
        opacity: 0.2 + Math.random() * 0.7,
        startX: start.x,
        startY: start.y,
        side: Math.random() > 0.28 ? 1 : -1,
      };
    });

  const drawImageCover = (
    targetContext,
    image,
    width,
    height,
  ) => {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (imageRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceWidth) * 0.5;
    } else {
      sourceHeight = image.naturalWidth / targetRatio;
      sourceY = clamp(
        image.naturalHeight * 0.41 - sourceHeight * 0.5,
        0,
        image.naturalHeight - sourceHeight,
      );
    }

    targetContext.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
  };

  const buildArtworkLayer = (image, width, height) => {
    const layer = document.createElement("canvas");
    layer.width = Math.max(1, Math.round(width));
    layer.height = Math.max(1, Math.round(height));
    const layerContext = layer.getContext("2d");
    if (!layerContext) return layer;

    const mobile = width < 700;
    const compactDesktop = !mobile && width / height < 1.62;
    const cropHeight =
      image.naturalHeight * (mobile ? 0.86 : 0.88);
    const cropY = image.naturalHeight * (mobile ? 0.015 : 0.005);
    const destinationHeight =
      height * (mobile ? 1.08 : compactDesktop ? 1.07 : 1.2);
    const destinationWidth =
      destinationHeight * (image.naturalWidth / cropHeight);
    const centerX = width * (mobile ? 0.54 : 0.5);
    const destinationX = centerX - destinationWidth * 0.5;
    const destinationY =
      -height * (mobile ? 0.025 : compactDesktop ? 0.018 : 0.075);

    layerContext.drawImage(
      image,
      0,
      cropY,
      image.naturalWidth,
      cropHeight,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
    );

    layerContext.globalCompositeOperation = "destination-in";
    const horizontalMask = layerContext.createLinearGradient(
      destinationX,
      0,
      destinationX + destinationWidth,
      0,
    );
    horizontalMask.addColorStop(0, "rgba(0,0,0,0)");
    horizontalMask.addColorStop(0.08, "rgba(0,0,0,0.12)");
    horizontalMask.addColorStop(0.18, "rgba(0,0,0,0.65)");
    horizontalMask.addColorStop(0.28, "rgba(0,0,0,1)");
    horizontalMask.addColorStop(0.78, "rgba(0,0,0,1)");
    horizontalMask.addColorStop(0.9, "rgba(0,0,0,0.65)");
    horizontalMask.addColorStop(1, "rgba(0,0,0,0)");
    layerContext.fillStyle = horizontalMask;
    layerContext.fillRect(0, 0, width, height);

    const verticalMask = layerContext.createLinearGradient(
      0,
      0,
      0,
      height,
    );
    verticalMask.addColorStop(0, "rgba(0,0,0,0.84)");
    verticalMask.addColorStop(0.08, "rgba(0,0,0,1)");
    verticalMask.addColorStop(0.9, "rgba(0,0,0,1)");
    verticalMask.addColorStop(1, "rgba(0,0,0,0.35)");
    layerContext.fillStyle = verticalMask;
    layerContext.fillRect(0, 0, width, height);

    return layer;
  };

  const buildBackgroundLayer = (image, width, height) => {
    const layer = document.createElement("canvas");
    layer.width = Math.max(1, Math.round(width));
    layer.height = Math.max(1, Math.round(height));
    const layerContext = layer.getContext("2d");
    if (!layerContext) return layer;

    layerContext.save();
    layerContext.filter =
      "blur(18px) saturate(0.86) brightness(0.68)";
    layerContext.translate(-28, -28);
    drawImageCover(layerContext, image, width + 56, height + 56);
    layerContext.restore();

    layerContext.fillStyle = "rgba(30, 11, 7, 0.12)";
    layerContext.fillRect(0, 0, width, height);

    const warmth = layerContext.createRadialGradient(
      width * 0.52,
      height * 0.43,
      0,
      width * 0.52,
      height * 0.43,
      Math.max(width, height) * 0.62,
    );
    warmth.addColorStop(0, "rgba(239, 178, 92, 0.14)");
    warmth.addColorStop(0.52, "rgba(87, 34, 18, 0.08)");
    warmth.addColorStop(1, "rgba(13, 6, 5, 0.58)");
    layerContext.fillStyle = warmth;
    layerContext.fillRect(0, 0, width, height);

    return layer;
  };

  const readAudioLevel = () => {
    if (!audioGraph || audio.paused) return 0;
    audioGraph.analyser.getByteFrequencyData(audioGraph.data);
    const sampleCount = Math.min(audioGraph.data.length, 64);
    let total = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      total += audioGraph.data[index];
    }
    return total / sampleCount / 255;
  };

  const render = (timestamp) => {
    if (!sourceImage) return;

    const bounds = stage.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr) ||
      !artworkLayer ||
      !backgroundLayer
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      artworkLayer = buildArtworkLayer(sourceImage, width, height);
      backgroundLayer = buildBackgroundLayer(
        sourceImage,
        width,
        height,
      );
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const elapsed = Math.max(0, timestamp - startTime);
    const time = elapsed / 1000;
    const entrance = reducedMotion.matches
      ? 1
      : easeOutExpo(Math.min(1, elapsed / 1900));
    const easing = pointer.active ? 0.12 : 0.028;
    const previousX = pointer.nx;
    const previousY = pointer.ny;
    pointer.nx += (pointer.targetX - pointer.nx) * easing;
    pointer.ny += (pointer.targetY - pointer.ny) * easing;
    pointer.velocity =
      pointer.velocity * 0.84 +
      Math.hypot(pointer.nx - previousX, pointer.ny - previousY) * 42;

    const audioLevel = readAudioLevel();
    context.drawImage(backgroundLayer, 0, 0, width, height);

    const haloX = width * (0.52 + (pointer.nx - 0.5) * 0.035);
    const haloY = height * (0.43 + (pointer.ny - 0.5) * 0.03);
    const pointerX = pointer.nx * width;
    const pointerY = pointer.ny * height;
    const motionBoost = 1 + audioLevel * 1.8;

    context.save();
    context.globalCompositeOperation = "screen";
    for (let ring = 0; ring < 12; ring += 1) {
      const radius =
        Math.min(width, height) *
        (0.22 + ring * 0.043) *
        (0.5 + entrance * 0.5);
      const attraction = Math.max(
        0,
        1 -
          Math.hypot(pointerX - haloX, pointerY - haloY) /
            Math.max(width, height),
      );
      const segments = 80;
      context.beginPath();
      for (let segment = 0; segment <= segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const wave =
          Math.sin(angle * 3 + time * (0.28 + ring * 0.015)) *
            (2.5 + ring * 0.28) +
          Math.cos(angle * 5 - time * 0.16) * 1.8;
        const baseX =
          haloX +
          Math.cos(angle) * (radius + wave * motionBoost) * 1.08;
        const baseY =
          haloY +
          Math.sin(angle) * (radius + wave * motionBoost) * 0.88;
        const distanceToPointer = Math.max(
          60,
          Math.hypot(pointerX - baseX, pointerY - baseY),
        );
        const pull =
          Math.min(1, 130 / distanceToPointer) *
          attraction *
          (pointer.active ? 1 : 0.45);
        const x = baseX + (pointerX - baseX) * pull * 0.23;
        const y = baseY + (pointerY - baseY) * pull * 0.23;
        if (segment === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = `rgba(241, 188, 98, ${
        0.055 + ring * 0.008 + audioLevel * 0.08
      })`;
      context.lineWidth = ring % 3 === 0 ? 1.1 : 0.55;
      context.stroke();
    }
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    const streamCount = width < 700 ? 10 : 25;
    for (let stream = 0; stream < streamCount; stream += 1) {
      const offset =
        stream / Math.max(1, streamCount - 1) - 0.5;
      const startX =
        haloX + width * (0.11 + Math.abs(offset) * 0.08);
      const startY = haloY + offset * height * 0.66;
      const endX =
        pointerX +
        Math.cos(time * 0.22 + stream * 0.78) *
          (18 + Math.abs(offset) * 68);
      const endY =
        pointerY +
        offset * height * 0.28 +
        Math.sin(time * 0.34 + stream) * 14;
      const controlX =
        (startX + endX) * 0.5 +
        Math.sin(time * 0.18 + stream * 0.42) * 52;
      const controlY =
        (startY + endY) * 0.5 - offset * height * 0.18;
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(controlX, controlY, endX, endY);
      context.strokeStyle = `rgba(246, 193, 105, ${
        0.08 +
        (1 - Math.abs(offset)) * 0.12 +
        (pointer.active ? 0.06 : 0) +
        pointer.velocity * 0.055 +
        audioLevel * 0.1
      })`;
      context.lineWidth = stream % 4 === 0 ? 1.6 : 0.88;
      context.stroke();
    }
    context.restore();

    const drawParticles = (front) => {
      context.save();
      context.globalCompositeOperation = "screen";
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if ((index % 3 === 0) !== front) continue;
        const orbit =
          particle.angle +
          time *
            particle.speed *
            0.16 *
            particle.side *
            motionBoost;
        const rightBias = index % 5 === 0 ? 0 : width * 0.12;
        const orbitX =
          haloX +
          Math.cos(orbit) * width * particle.radius * 0.72 +
          rightBias;
        const orbitY =
          haloY +
          Math.sin(orbit) * height * particle.radius * 0.62 +
          Math.sin(time * particle.speed + particle.phase) * 9;
        const distance = Math.max(
          50,
          Math.hypot(pointerX - orbitX, pointerY - orbitY),
        );
        const influence =
          Math.min(1, 180 / distance) *
          (pointer.active ? 1 : 0.34) *
          (0.5 + pointer.velocity * 0.25);
        const tangentX = -(pointerY - orbitY) / distance;
        const tangentY = (pointerX - orbitX) / distance;
        const targetX =
          orbitX +
          (pointerX - orbitX) * influence * 0.2 +
          tangentX * influence * 46;
        const targetY =
          orbitY +
          (pointerY - orbitY) * influence * 0.2 +
          tangentY * influence * 46;
        const x =
          particle.startX * width * (1 - entrance) +
          targetX * entrance;
        const y =
          particle.startY * height * (1 - entrance) +
          targetY * entrance;
        const flicker =
          0.55 +
          Math.sin(
            time * (0.7 + particle.speed) + particle.phase,
          ) *
            0.22;
        const radius =
          particle.size *
          (0.75 +
            audioLevel * 1.6 +
            Math.min(pointer.velocity, 1) * 0.28);

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 208, 120, ${
          particle.opacity * flicker * entrance
        })`;
        context.fill();

        if (
          pointer.active &&
          influence > 0.28 &&
          index % 5 === 0
        ) {
          context.beginPath();
          context.moveTo(x, y);
          context.quadraticCurveTo(
            x - tangentX * 16,
            y - tangentY * 16,
            x - tangentX * 32,
            y - tangentY * 32,
          );
          context.strokeStyle = `rgba(255, 210, 132, ${
            influence * 0.22
          })`;
          context.lineWidth = 0.55;
          context.stroke();
        }
      }
      context.restore();
    };

    drawParticles(false);

    context.save();
    context.globalAlpha = 0.18 + entrance * 0.82;
    const scale = reducedMotion.matches
      ? 1
      : 1.055 - entrance * 0.055;
    context.translate(width * 0.5, height * 0.47);
    context.scale(scale, scale);
    context.translate(-width * 0.5, -height * 0.47);
    context.drawImage(artworkLayer, 0, 0, width, height);
    context.restore();

    drawParticles(true);

    context.save();
    context.globalCompositeOperation = "screen";
    const cursorGlow = context.createRadialGradient(
      pointerX,
      pointerY,
      0,
      pointerX,
      pointerY,
      180 + audioLevel * 60,
    );
    cursorGlow.addColorStop(
      0,
      `rgba(255, 222, 160, ${
        pointer.active ? 0.28 : 0.08
      })`,
    );
    cursorGlow.addColorStop(
      0.38,
      "rgba(236, 174, 84, 0.055)",
    );
    cursorGlow.addColorStop(1, "rgba(236, 174, 84, 0)");
    context.fillStyle = cursorGlow;
    context.fillRect(pointerX - 240, pointerY - 240, 480, 480);

    if (pointer.active) {
      context.beginPath();
      context.arc(pointerX, pointerY, 2.2, 0, Math.PI * 2);
      context.fillStyle = "rgba(255, 236, 192, 0.92)";
      context.fill();
      context.beginPath();
      context.arc(
        pointerX,
        pointerY,
        12 + audioLevel * 8,
        0,
        Math.PI * 2,
      );
      context.strokeStyle = "rgba(246, 193, 105, 0.32)";
      context.lineWidth = 0.75;
      context.stroke();
    }
    context.restore();

    if (!reducedMotion.matches || !audio.paused || elapsed < 2100) {
      animationFrame = window.requestAnimationFrame(render);
    }
  };

  const restart = () => {
    if (!sourceImage) return;
    artworkLayer = null;
    backgroundLayer = null;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(render);
  };

  const applyImage = async (src, original) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    try {
      await image.decode();
    } catch {
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
    }
    sourceImage = image;
    artwork.src = src;
    artwork.dataset.originalResolution = original ? "true" : "false";
    stage.dataset.originalArtwork = original ? "true" : "false";
    artworkLayer = null;
    backgroundLayer = null;
    particles = createParticles(window.innerWidth < 700 ? 180 : 600);
    startTime = performance.now();
    restart();
  };

  const loadOriginalArtwork = async () => {
    try {
      const direct = await fetch(ARTWORK_URL, {
        method: "HEAD",
        cache: "force-cache",
      });
      if (direct.ok) {
        await applyImage(ARTWORK_URL, true);
        return;
      }
    } catch {}

    try {
      const parts = await Promise.all(
        ARTWORK_PART_URLS.map(async (url) => {
          const response = await fetch(url, {
            cache: "force-cache",
          });
          if (!response.ok) {
            throw new Error("Artwork part unavailable");
          }
          return response.arrayBuffer();
        }),
      );
      objectUrl = URL.createObjectURL(
        new Blob(parts, { type: "image/jpeg" }),
      );
      await applyImage(objectUrl, true);
    } catch {}
  };

  const updatePointer = (event) => {
    if (reducedMotion.matches) return;
    const bounds = stage.getBoundingClientRect();
    pointer.targetX = clamp(
      (event.clientX - bounds.left) / bounds.width,
      0.02,
      0.98,
    );
    pointer.targetY = clamp(
      (event.clientY - bounds.top) / bounds.height,
      0.02,
      0.98,
    );
    pointer.active = true;
    if (!animationFrame) restart();
  };

  stage.addEventListener("pointermove", updatePointer);
  stage.addEventListener("pointerdown", updatePointer);
  stage.addEventListener("pointerleave", () => {
    pointer.targetX = 0.78;
    pointer.targetY = 0.5;
    pointer.active = false;
  });

  const ensureAudioGraph = () => {
    if (audioGraph) return audioGraph;
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    const source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    audioGraph = {
      context: audioContext,
      analyser,
      data: new Uint8Array(analyser.frequencyBinCount),
    };
    return audioGraph;
  };

  const togglePlayback = async () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      const graph = ensureAudioGraph();
      if (graph && graph.context.state === "suspended") {
        await graph.context.resume();
      }
      await audio.play();
      restart();
    } catch {
      listenTime.textContent = "点击重试";
    }
  };

  listen.addEventListener("click", () => void togglePlayback());
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      event.code === "Space" &&
      !(target instanceof HTMLElement &&
        target.matches("button, a, input, textarea, select"))
    ) {
      event.preventDefault();
      void togglePlayback();
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    listenTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(
      audio.duration || AUDIO_DURATION_FALLBACK,
    )}`;
  });
  audio.addEventListener("timeupdate", () => {
    const duration = audio.duration || AUDIO_DURATION_FALLBACK;
    listenTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(
      duration,
    )}`;
    progress.style.transform = `scaleX(${Math.min(
      1,
      audio.currentTime / duration,
    )})`;
  });
  audio.addEventListener("play", () => {
    stage.classList.add("is-playing");
    listenLabel.textContent = "暂停";
    listen.setAttribute("aria-label", "暂停唱诵");
    listen.setAttribute("aria-pressed", "true");
  });
  audio.addEventListener("pause", () => {
    stage.classList.remove("is-playing");
    listenLabel.textContent = "聆听";
    listen.setAttribute("aria-label", "聆听唱诵");
    listen.setAttribute("aria-pressed", "false");
  });
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
  });
  audio.addEventListener("error", () => {
    listenTime.textContent = "点击重试";
  });

  window.addEventListener("resize", restart);
  reducedMotion.addEventListener("change", restart);
  window.addEventListener("pagehide", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
  });

  void applyImage(ARTWORK_FALLBACK_URL, false).then(
    loadOriginalArtwork,
  );
})();
