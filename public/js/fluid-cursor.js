/* WebGL fluid cursor — ported from the Artemis tracker splash-cursor pipeline. */
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (reduced || coarse) return;

  function boot() {
    let canvas = document.getElementById("fluid");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "fluid";
      canvas.setAttribute("aria-hidden", "true");
      document.body.prepend(canvas);
    }
    const config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 512,
      DENSITY_DISSIPATION: 3.5,
      VELOCITY_DISSIPATION: 2,
      PRESSURE: 0.1,
      PRESSURE_ITERATIONS: 10,
      CURL: 3,
      SPLAT_RADIUS: 0.2,
      SPLAT_FORCE: 6000,
      COLOR_UPDATE_SPEED: 10,
    };
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext("webgl2", params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    let halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension("EXT_color_buffer_float");
      supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
    } else {
      halfFloat = gl.getExtension("OES_texture_half_float");
      supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
    }
    gl.clearColor(0, 0, 0, 1);
    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;

    function supportRenderTextureFormat(internalFormat, format, type) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    function getSupportedFormat(internalFormat, format, type) {
      if (!supportRenderTextureFormat(internalFormat, format, type)) {
        if (internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type);
        if (internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
        return null;
      }
      return { internalFormat, format };
    }
    const ext = {
      formatRGBA: isWebGL2
        ? getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatTexType)
        : getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType),
      formatRG: isWebGL2
        ? getSupportedFormat(gl.RG16F, gl.RG, halfFloatTexType)
        : getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType),
      formatR: isWebGL2
        ? getSupportedFormat(gl.R16F, gl.RED, halfFloatTexType)
        : getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType),
      halfFloatTexType,
      supportLinearFiltering,
    };
    if (!ext.formatRGBA || !ext.formatRG || !ext.formatR) {
      canvas.style.display = "none";
      return;
    }
    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256;
    }

    function compileShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    function createProgram(vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      return p;
    }
    function getUniforms(p) {
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(p, i).name;
        u[name] = gl.getUniformLocation(p, name);
      }
      return u;
    }

    const baseVS = compileShader(
      gl.VERTEX_SHADER,
      "precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0);vR=vUv+vec2(texelSize.x,0);vT=vUv+vec2(0,texelSize.y);vB=vUv-vec2(0,texelSize.y);gl_Position=vec4(aPosition,0,1);}"
    );
    const copyFS = compileShader(gl.FRAGMENT_SHADER, "precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;void main(){gl_FragColor=texture2D(uTexture,vUv);}");
    const clearFS = compileShader(gl.FRAGMENT_SHADER, "precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}");
    const splatFS = compileShader(gl.FRAGMENT_SHADER, "precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;void main(){vec2 p=vUv-point.xy;p.x*=aspectRatio;vec3 splat=exp(-dot(p,p)/radius)*color;vec3 base=texture2D(uTarget,vUv).xyz;gl_FragColor=vec4(base+splat,1);}");
    const advFS = compileShader(gl.FRAGMENT_SHADER, "precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uVelocity,uSource;uniform vec2 texelSize;uniform float dt,dissipation;void main(){vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;vec4 result=texture2D(uSource,coord);float decay=1.+dissipation*dt;gl_FragColor=result/decay;}");
    const divFS = compileShader(gl.FRAGMENT_SHADER, "precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0,0,1);}");
    const curlFS = compileShader(gl.FRAGMENT_SHADER, "precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0,0,1);}");
    const vortFS = compileShader(gl.FRAGMENT_SHADER, "precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;vec2 force=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));force/=length(force)+.0001;force*=curl*C;force.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy;v+=force*dt;v=min(max(v,-1000.),1000.);gl_FragColor=vec4(v,0,1);}");
    const pressFS = compileShader(gl.FRAGMENT_SHADER, "precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,div=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-div)*.25,0,0,1);}");
    const gradFS = compileShader(gl.FRAGMENT_SHADER, "precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy;v.xy-=vec2(R-L,T-B);gl_FragColor=vec4(v,0,1);}");
    const dispFS = compileShader(gl.FRAGMENT_SHADER, "precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uTexture;void main(){vec3 c=texture2D(uTexture,vUv).rgb;float a=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c,a);}");

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    function blit(target, clear) {
      if (!target) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture: tex,
        fbo,
        width: w,
        height: h,
        texelSizeX: 1 / w,
        texelSizeY: 1 / h,
        attach(id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          return id;
        },
      };
    }
    function createDoubleFBO(w, h, iF, f, t, p) {
      let r = createFBO(w, h, iF, f, t, p);
      let w2 = createFBO(w, h, iF, f, t, p);
      return {
        width: w,
        height: h,
        texelSizeX: r.texelSizeX,
        texelSizeY: r.texelSizeY,
        get read() {
          return r;
        },
        set read(v) {
          r = v;
        },
        get write() {
          return w2;
        },
        set write(v) {
          w2 = v;
        },
        swap() {
          const tmp = r;
          r = w2;
          w2 = tmp;
        },
      };
    }
    function getRes(res) {
      let ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (ar < 1) ar = 1 / ar;
      const mn = Math.round(res);
      const mx = Math.round(res * ar);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? { width: mx, height: mn } : { width: mn, height: mx };
    }

    const copyP = createProgram(baseVS, copyFS);
    const clearP = createProgram(baseVS, clearFS);
    const splatP = createProgram(baseVS, splatFS);
    const advP = createProgram(baseVS, advFS);
    const divP = createProgram(baseVS, divFS);
    const curlP = createProgram(baseVS, curlFS);
    const vortP = createProgram(baseVS, vortFS);
    const pressP = createProgram(baseVS, pressFS);
    const gradP = createProgram(baseVS, gradFS);
    const dispP = createProgram(baseVS, dispFS);
    const clearU = getUniforms(clearP);
    const splatU = getUniforms(splatP);
    const advU = getUniforms(advP);
    const divU = getUniforms(divP);
    const curlU = getUniforms(curlP);
    const vortU = getUniforms(vortP);
    const pressU = getUniforms(pressP);
    const gradU = getUniforms(gradP);
    const dispU = getUniforms(dispP);

    let dye, velocity, divergence, curl, pressure;
    function initFBOs() {
      const sr = getRes(config.SIM_RESOLUTION);
      const dr = getRes(config.DYE_RESOLUTION);
      const tt = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      const fil = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);
      dye = createDoubleFBO(dr.width, dr.height, rgba.internalFormat, rgba.format, tt, fil);
      velocity = createDoubleFBO(sr.width, sr.height, rg.internalFormat, rg.format, tt, fil);
      divergence = createFBO(sr.width, sr.height, r.internalFormat, r.format, tt, gl.NEAREST);
      curl = createFBO(sr.width, sr.height, r.internalFormat, r.format, tt, gl.NEAREST);
      pressure = createDoubleFBO(sr.width, sr.height, r.internalFormat, r.format, tt, gl.NEAREST);
    }
    function resizeCanvas() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        initFBOs();
      }
    }
    initFBOs();

    function HSVtoRGB(h, s, v) {
      let r, g, b;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          r = v; g = t; b = p; break;
        case 1:
          r = q; g = v; b = p; break;
        case 2:
          r = p; g = v; b = t; break;
        case 3:
          r = p; g = q; b = v; break;
        case 4:
          r = t; g = p; b = v; break;
        default:
          r = v; g = p; b = q;
      }
      return { r: r * 0.18, g: g * 0.18, b: b * 0.18 };
    }
    function splat(x, y, dx, dy, color) {
      gl.useProgram(splatP);
      gl.uniform1i(splatU.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatU.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatU.point, x, y);
      gl.uniform3f(splatU.color, dx, dy, 0);
      gl.uniform1f(splatU.radius, (config.SPLAT_RADIUS / 100) * (canvas.width / canvas.height > 1 ? canvas.width / canvas.height : 1));
      blit(velocity.write);
      velocity.swap();
      gl.uniform1i(splatU.uTarget, dye.read.attach(0));
      gl.uniform3f(splatU.color, color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    const pointers = [
      {
        texcoordX: 0.5,
        texcoordY: 0.5,
        prevTexcoordX: 0.5,
        prevTexcoordY: 0.5,
        deltaX: 0,
        deltaY: 0,
        moved: false,
        color: { r: 0.2, g: 0.55, b: 0.9 },
      },
    ];
    let lastTime = Date.now();
    let colorTimer = 0;

    function step(dt) {
      gl.disable(gl.BLEND);
      gl.useProgram(curlP);
      gl.uniform2f(curlU.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlU.uVelocity, velocity.read.attach(0));
      blit(curl);
      gl.useProgram(vortP);
      gl.uniform2f(vortU.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vortU.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vortU.uCurl, curl.attach(1));
      gl.uniform1f(vortU.curl, config.CURL);
      gl.uniform1f(vortU.dt, dt);
      blit(velocity.write);
      velocity.swap();
      gl.useProgram(divP);
      gl.uniform2f(divU.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divU.uVelocity, velocity.read.attach(0));
      blit(divergence);
      gl.useProgram(clearP);
      gl.uniform1i(clearU.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearU.value, config.PRESSURE);
      blit(pressure.write);
      pressure.swap();
      gl.useProgram(pressP);
      gl.uniform2f(pressU.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressU.uDivergence, divergence.attach(0));
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressU.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }
      gl.useProgram(gradP);
      gl.uniform2f(gradU.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradU.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradU.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();
      gl.useProgram(advP);
      gl.uniform2f(advU.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      let vid = velocity.read.attach(0);
      gl.uniform1i(advU.uVelocity, vid);
      gl.uniform1i(advU.uSource, vid);
      gl.uniform1f(advU.dt, dt);
      gl.uniform1f(advU.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();
      gl.uniform1i(advU.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advU.uSource, dye.read.attach(1));
      gl.uniform1f(advU.dissipation, config.DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }
    let running = !document.hidden;
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) lastTime = Date.now();
    });

    function frame() {
      if (!running) {
        requestAnimationFrame(frame);
        return;
      }
      resizeCanvas();
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.016666);
      lastTime = now;
      colorTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorTimer >= 1) {
        colorTimer = 0;
        pointers.forEach((p) => {
          p.color = HSVtoRGB(Math.random(), 1, 1);
        });
      }
      pointers.forEach((p) => {
        if (p.moved) {
          p.moved = false;
          splat(p.texcoordX, p.texcoordY, p.deltaX * config.SPLAT_FORCE, p.deltaY * config.SPLAT_FORCE, p.color);
        }
      });
      step(dt);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      gl.useProgram(dispP);
      gl.uniform1i(dispU.uTexture, dye.read.attach(0));
      blit(null);
      requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", (e) => {
      const p = pointers[0];
      p.prevTexcoordX = p.texcoordX;
      p.prevTexcoordY = p.texcoordY;
      p.texcoordX = e.clientX / canvas.clientWidth;
      p.texcoordY = 1 - e.clientY / canvas.clientHeight;
      const ar = canvas.clientWidth / canvas.clientHeight;
      p.deltaX = (p.texcoordX - p.prevTexcoordX) * (ar < 1 ? ar : 1);
      p.deltaY = (p.texcoordY - p.prevTexcoordY) * (ar > 1 ? 1 / ar : 1);
      p.moved = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
    });
    window.addEventListener("mousedown", (e) => {
      const p = pointers[0];
      const c = HSVtoRGB(Math.random(), 1, 1);
      c.r *= 10;
      c.g *= 10;
      c.b *= 10;
      p.texcoordX = e.clientX / canvas.clientWidth;
      p.texcoordY = 1 - e.clientY / canvas.clientHeight;
      splat(p.texcoordX, p.texcoordY, 10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5), c);
    });
    frame();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
