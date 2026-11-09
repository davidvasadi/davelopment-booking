'use client'

import { useEffect, useRef } from 'react'

/**
 * Selymes, festett narancs–sárga háttér WebGL shaderrel: hosszú, egyenes, elmosott fénycsíkok
 * jobb felülről („/” irányban), fent telítettebb, lefelé halványul. Statikus: egyszer renderel, átméretezéskor újra.
 * WebGL nélkül a szülő CSS-gradiense látszik (a canvas átlátszó marad).
 */
const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

const FRAG = `
precision highp float;
uniform vec2 r;
uniform float seed;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
// forgatás nélküli fbm, hogy a nyújtás minden oktávon megmaradjon (egyenes csíkok)
float fbm(vec2 p){
  float v=0.,a=.5;
  for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,3.7);a*=.5;}
  return v;
}

void main(){
  vec2 n=gl_FragCoord.xy/r;            // 0..1, y felfelé
  vec2 uv=gl_FragCoord.xy/r.y;
  // csíkirány: jobbra-fel dől ("/"), a fény jobb felülről jön
  vec2 d=normalize(vec2(.66,1.));
  vec2 pn=vec2(-d.y,d.x);
  float along=dot(uv,d), across=dot(uv,pn);
  // csak egy leheletnyi görbület, hogy ne legyen vonalzó-egyenes
  float bend=(fbm(vec2(across*1.2,along*.4)+seed)-.5)*.12;
  float c=across+bend;
  float k=fbm(vec2(c*5.5,along*.28)+seed)*.7+fbm(vec2(c*16.,along*.45)+seed*1.9)*.3;

  vec3 cream =vec3(.995,.972,.935);
  vec3 peach =vec3(.980,.840,.680);
  vec3 amber =vec3(.965,.705,.370);
  vec3 orange=vec3(.945,.600,.270);
  vec3 yellow=vec3(.992,.880,.520);
  vec3 blush =vec3(.975,.860,.835);

  // hő: fent a legtelítettebb (közép-jobb felső fókusszal), lefelé halványul
  float heat=smoothstep(.15,1.,n.y);
  heat+=.45*exp(-pow((n.x-.58)*2.4,2.))*smoothstep(.45,1.,n.y);
  heat=clamp(heat,0.,1.);

  vec3 col=mix(cream,peach,smoothstep(0.,.55,heat));
  col=mix(col,amber,smoothstep(.3,.9,heat)*smoothstep(.3,.7,k));
  col=mix(col,orange,smoothstep(.55,1.,heat)*smoothstep(.45,.8,k));
  // világos fénycsíkok
  col=mix(col,cream,smoothstep(.58,.82,k)*(.35+.3*(1.-heat)));
  // sárgás tónus jobbra lent-középen, rózsás pír alul
  col=mix(col,yellow,smoothstep(.45,1.,n.x)*smoothstep(.0,.55,n.y)*.35);
  col=mix(col,blush,(1.-smoothstep(.0,.42,n.y))*.45);
  // bal oldali fehér pára
  col=mix(col,cream,smoothstep(.32,.0,n.x)*.55);

  col+=(hash(gl_FragCoord.xy)-.5)/255.*2.;
  gl_FragColor=vec4(col,1.);
}`

export function SilkGradient({ className = '', seed = 3.7 }: { className?: string; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true })
    if (!gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'r')
    gl.uniform1f(gl.getUniformLocation(prog, 'seed'), seed)

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      canvas.style.opacity = '1'
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [seed])

  return <canvas ref={ref} aria-hidden className={`opacity-0 transition-opacity duration-700 ${className}`} />
}
