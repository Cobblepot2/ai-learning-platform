"use client";

import { useEffect, useRef } from "react";

/**
 * Animated light bands behind the public pages. A port of the React Bits
 * "ColorBends" shader to plain WebGL, so the page does not need three.js for
 * one full-screen quad.
 *
 * Performance follows the tuned DC version: one pixel per CSS pixel (never
 * the device pixel ratio), a 60 fps cap even on 120 Hz screens, and no pointer
 * tracking. It also stops while the tab is hidden. Lower resolution makes the
 * grain blocky, so keep it at 1. Reduced motion gets one still frame; no WebGL
 * gets a CSS gradient.
 */
const MAX_COLORS = 8;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
#define MAX_COLORS ${MAX_COLORS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform float uNoise;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;

  vec2 s = q;
  vec3 sumCol = vec3(0.0);
  float cover = 0.0;
  float kBelow = clamp(uWarpStrength, 0.0, 1.0);
  float kMix = pow(kBelow, 0.3);
  float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
  for (int i = 0; i < MAX_COLORS; ++i) {
    if (i >= uColorCount) break;
    s -= 0.01;
    vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
    float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    vec2 warped = s + (r - s) * kBelow * gain;
    float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    float w = 1.0 - exp(-6.0 / exp(6.0 * mix(m0, m1, kMix)));
    sumCol += uColors[i] * w;
    cover = max(cover, w);
  }
  vec3 col = clamp(sumCol, 0.0, 1.0);
  float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
  col = clamp(col + (n - 0.5) * uNoise, 0.0, 1.0);
  gl_FragColor = vec4(col * cover, cover);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ColorBends({
  colors,
  rotation = 45,
  speed = 0.2,
  scale = 1,
  frequency = 1,
  warpStrength = 1,
  noise = 0.1,
  fps = 60,
  resolution = 1,
  className = "",
}: {
  colors: string[];
  rotation?: number;
  speed?: number;
  scale?: number;
  frequency?: number;
  warpStrength?: number;
  noise?: number;
  /** Frame cap, so 120 Hz screens do not draw twice as often. */
  fps?: number;
  /** Fraction of CSS pixels to render; the canvas is stretched to fill. Below 1 the grain shows. */
  resolution?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorKey = colors.join(",");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = document.createElement("canvas");
    canvas.className = "block h-full w-full";
    const gl = canvas.getContext("webgl", { antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
    const vert = gl && compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl?.createProgram();
    if (!gl || !vert || !frag || !program) {
      container.dataset.fallback = "true";
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      container.dataset.fallback = "true";
      return;
    }
    gl.useProgram(program);
    container.appendChild(canvas);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const at = (name: string) => gl.getUniformLocation(program, name);
    const palette = colorKey.split(",").filter(Boolean).slice(0, MAX_COLORS);
    const flat = new Float32Array(MAX_COLORS * 3);
    palette.forEach((hex, i) => flat.set(hexToRgb(hex), i * 3));
    gl.uniform3fv(at("uColors"), flat);
    gl.uniform1i(at("uColorCount"), palette.length);
    gl.uniform1f(at("uSpeed"), speed);
    gl.uniform1f(at("uScale"), scale);
    gl.uniform1f(at("uFrequency"), frequency);
    gl.uniform1f(at("uWarpStrength"), warpStrength);
    gl.uniform1f(at("uNoise"), noise);
    const rad = (rotation * Math.PI) / 180;
    gl.uniform2f(at("uRot"), Math.cos(rad), Math.sin(rad));
    const uCanvas = at("uCanvas");
    const uTime = at("uTime");

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = 1000 / fps;
    let elapsed = 0;
    let last = 0;
    let frame = 0;
    const render = () => {
      gl.uniform1f(uTime, still ? 4 : elapsed / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Resizing clears the canvas, so draw again straight away.
    const resize = () => {
      const w = Math.max(1, Math.round(container.clientWidth * resolution));
      const h = Math.max(1, Math.round(container.clientHeight * resolution));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uCanvas, w, h);
      render();
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const delta = now - last;
      if (delta < interval) return;
      // Advance by the capped step only, so time does not jump after a pause.
      elapsed += Math.min(delta, interval * 2);
      last = now - (delta % interval);
      render();
    };
    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      render();
      if (!still) frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      canvas.remove();
    };
  }, [colorKey, rotation, speed, scale, frequency, warpStrength, noise, fps, resolution]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`h-full w-full data-[fallback=true]:bg-[radial-gradient(ellipse_at_30%_20%,#3730a3_0%,transparent_55%),radial-gradient(ellipse_at_75%_70%,#6d28d9_0%,transparent_50%)] ${className}`}
    />
  );
}
