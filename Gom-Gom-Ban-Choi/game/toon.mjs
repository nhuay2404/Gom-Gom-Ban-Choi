// Toon shading cho phòng 3D (mặc định bật; ?toon=0 để xem lại kiểu PBR cũ).
// Shading theo shader toon của Roystan (Unity): sáng tối chia nấc + rim light (viền sáng mép khối phía nắng)
// + đốm bóng sắc cạnh cho vật bóng. Viền theo kiểu Outlines của pmndrs/drei: "inverted hull" vẽ lại khối ở mặt sau,
// đẩy phình theo pháp tuyến đã làm mượt, độ dày cố định theo px trên màn hình.
import * as THREE from 'three';

export const TOON = (() => {
  try { return new URLSearchParams(location.search).get('toon') !== '0'; } catch { return true; }
})();

// Kiểu Cats & Soup: gần như không có chiếu sáng theo hướng. Đèn trời phẳng (mọi mặt sáng như nhau, xem RE_IndirectDiffuse_Toon),
// nắng gần như đều mọi mặt (TONES) và chủ yếu chỉ để tạo bóng đổ mềm dưới mèo / đồ vật. Hình khối do viền đảm nhận.
export const TOON_LIGHT = { hemi: 1.55, sun: .9, shadow: .5 };
// Góc nhìn hẹp (gần ortho) cho cảm giác tranh 2D: FOV nhỏ, lùi camera xa tương ứng để khung hình giữ nguyên.
export const TOON_FOV = 18;

// Dải sáng theo N·L (trục ngang 0..1 = mặt quay lưng .. quay thẳng vào nắng), LinearFilter trên dải 64 px.
const TONES = [[0, .9], [.45, 1]], EDGE = .08; // mặt khuất chỉ tối hơn 10%, đủ tách mặt khối mà không ra cảm giác đổ sáng 3D
const gradientMap = (() => {
  const W = 64, data = new Uint8Array(W);
  for (let i = 0; i < W; i++) {
    const x = (i + .5) / W;
    let v = TONES[0][1];
    for (let k = 1; k < TONES.length; k++) {
      const t = Math.min(1, Math.max(0, (x - TONES[k][0] + EDGE) / (2 * EDGE)));
      v += (TONES[k][1] - TONES[k - 1][1]) * t * t * (3 - 2 * t);
    }
    data[i] = Math.round(v * 255);
  }
  const tex = new THREE.DataTexture(data, W, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

// Thay hàm chiếu sáng trực tiếp của MeshToonMaterial: giữ phần nấc sáng gốc, cộng thêm rim + đốm bóng.
// directLight.color đã nhân bóng đổ, nên rim/đốm bóng tự tắt ở chỗ bị che nắng.
const RIM_AMOUNT = .72, GLOSS = 180.0;
const LIGHTS_CHUNK = `
varying vec3 vViewPosition;
struct ToonMaterial { vec3 diffuseColor; };
uniform float toonRim;
uniform float toonSpec;
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  float NdotL = dot( geometryNormal, directLight.direction );
  // Rim (Roystan): mép khối nhìn xiên, phía quay về nắng.
  float rimDot = 1.0 - saturate( dot( geometryViewDir, geometryNormal ) );
  float rim = smoothstep( ${(RIM_AMOUNT - .015).toFixed(3)}, ${(RIM_AMOUNT + .015).toFixed(3)}, rimDot * pow( saturate( NdotL ), 0.1 ) );
  // Đốm bóng Blinn-Phong cắt sắc cạnh.
  vec3 halfDir = normalize( directLight.direction + geometryViewDir );
  float spec = smoothstep( 0.45, 0.5, pow( saturate( dot( geometryNormal, halfDir ) ), ${GLOSS.toFixed(1)} ) * smoothstep( 0.0, 0.06, NdotL ) );
  vec3 rimColor = mix( material.diffuseColor, vec3( 1.0 ), 0.65 );
  reflectedLight.directDiffuse += directLight.color * RECIPROCAL_PI * ( rimColor * rim * toonRim + vec3( spec * toonSpec ) );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  // Ánh sáng trời PHẲNG: mọi mặt nhận như mặt hướng lên, không phụ thuộc pháp tuyến, nên mặt bên / mặt dưới
  // không tối dần như 3D thật. Màu & cường độ trời (ngày / đêm) vẫn lấy từ đèn hemi.
  vec3 flatIrradiance = irradiance;
  #if NUM_HEMI_LIGHTS > 0
    flatIrradiance = getAmbientLightIrradiance( ambientLightColor )
      + mix( hemisphereLights[ 0 ].groundColor, hemisphereLights[ 0 ].skyColor, 0.85 );
  #endif
  reflectedLight.indirectDiffuse += flatIrradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon`;
// Màu pastel: giảm độ đậm rồi pha trắng, làm trên không gian sRGB (như pha màu trên giấy) cho cả màu khối lẫn texture
// (cỏ, sàn...). Không đụng cat-art.mjs nên mèo 2D trên bàn chơi giữ nguyên màu.
export const PASTEL = { sat: 1.12, white: .16 }; // sat > 1 bù lại độ đậm bị trắng pha loãng: sáng nhẹ mà màu vẫn tươi
const PASTEL_CHUNK = `#include <color_fragment>
{
  vec3 pastel = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
  pastel = mix( vec3( dot( pastel, vec3( 0.299, 0.587, 0.114 ) ) ), pastel, ${PASTEL.sat.toFixed(3)} );
  diffuseColor.rgb = pow( mix( pastel, vec3( 1.0 ), ${PASTEL.white.toFixed(3)} ), vec3( 2.2 ) );
}`;
export function pastelColor(color) {
  const c = color.clone().convertLinearToSRGB();
  const l = c.r * .299 + c.g * .587 + c.b * .114;
  c.lerp(new THREE.Color(l, l, l), 1 - PASTEL.sat).lerp(new THREE.Color(1, 1, 1), PASTEL.white);
  return c.convertSRGBToLinear();
}
function toonShader(shader) {
  shader.uniforms.toonRim = { value: this.userData.toonRim };
  shader.uniforms.toonSpec = { value: this.userData.toonSpec };
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <lights_toon_pars_fragment>', LIGHTS_CHUNK)
    .replace('#include <color_fragment>', PASTEL_CHUNK);
}

// Nhận cùng tham số với MeshPhysicalMaterial, bỏ các thông số PBR mà toon không dùng.
// Vật nhám (roughness cao) không có đốm bóng; nước / kính / kim loại có đốm nhẹ. rim: 0..1, mặc định tắt cho phẳng.
const KEEP = ['color', 'map', 'emissive', 'emissiveIntensity', 'emissiveMap', 'transparent', 'opacity', 'side', 'wireframe', 'alphaTest', 'depthWrite'];
export function toonMat(params = {}) {
  const picked = { gradientMap };
  for (const key of KEEP) if (params[key] !== undefined) picked[key] = params[key];
  const material = new THREE.MeshToonMaterial(picked);
  const glossy = (params.roughness ?? 1) < .5 || (params.metalness ?? 0) > .3;
  material.userData.toonRim = params.rim ?? 0;
  material.userData.toonSpec = params.spec ?? (glossy ? .5 : 0);
  material.onBeforeCompile = toonShader;
  return material;
}

// Ánh sáng cho toon: không env map, không tone mapping để màu ra đúng mã hex.
export function toonLook(renderer, scene) {
  renderer.toneMapping = THREE.NoToneMapping;
  scene.environment = null;
}

// ---------- Viền ----------
const OUTLINE_PX = 3;
// Nét vẽ tay: dày ĐỀU, liền mạch (không đứt), chỉ đậm / nhạt dần dọc theo nét như mực thấm không đều, thêm xơ bút rất nhẹ.
//   wobble  : dao động độ dày, giữ nhỏ để nét trông đều        tone : mức nhạt tối đa của đoạn "mờ" (0 = đậm đều)
//   toneScale: độ dài một đoạn đậm→mờ (số nhỏ = đoạn dài, chuyển mềm)   grain : độ rõ của xơ bút
// Mọi nhiễu tính theo toạ độ của chính khối (không theo pixel màn hình) nên khi xoay camera hay mèo di chuyển,
// hoa văn nét dính chặt vào khối, không trôi / nhấp nháy.
const STROKE = { wobble: .15, wobbleScale: 3.0, tone: 0, toneScale: 4.5, grain: .05, grainScale: 34.0, inner: .1 };
const NOISE_GLSL = `
float toonHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float toonNoise( vec3 x ) {
  vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( toonHash( i ), toonHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( toonHash( i + vec3( 0, 1, 0 ) ), toonHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( toonHash( i + vec3( 0, 0, 1 ) ), toonHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( toonHash( i + vec3( 0, 1, 1 ) ), toonHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}`;
const resolution = new THREE.Vector2(1, 1);
const sizeTmp = new THREE.Vector2();
// Gọi trước mỗi lần render có viền. Mặc định tắt so ID (ảnh thumbnail không có pass ID: viền đậm đều);
// renderOutlineIds() bật lại cho phòng chính.
export function syncOutlineResolution(renderer) {
  renderer.getDrawingBufferSize(sizeTmp);
  resolution.copy(sizeTmp);
  outlineShared.useIds.value = 0;
}

// ---------- Viền trong mờ đi (kiểu Cats & Soup) ----------
// Viền chỉ đậm ở đường bao ngoài (nét in lên cỏ, trời, vật khác). Chỗ một bộ phận chồng lên bộ phận khác của CÙNG một
// "khối" (tai trên đầu, thân trên chân, bụng dưới, rễ trên gốc cây, chấn song trên cột rào...) thì nét gần như biến mất.
// Cách làm: pass phụ vẽ cả cảnh (không có viền) ra texture, mỗi pixel ghi ID của khối đứng trước nhất ở đó; khi vẽ viền,
// pixel viền nào nằm đè lên chính khối của nó thì hạ alpha xuống STROKE.inner.
// "Khối" = tổ tiên gần nhất có markOutlineUnit() (mèo, món đồ, hàng rào, bụi cây...); không đánh dấu thì mỗi mesh là một khối.
export const OUTLINE_LAYER = 1, DECAL_LAYER = 2;
// Sàn / nền cỏ lùi lại trong depth test theo ĐỘ DỐC của chính nó trên màn hình (polygonOffsetFactor ~ số px): phần viền
// phình ra quanh chân đồ đạc nằm trên sàn luôn thắng sàn ở mọi mức zoom (sàn nhìn xiên nên độ dốc depth lớn, tự tỉ lệ
// theo khoảng cách), không chập chờn. 6 px > bề rộng viền dày nhất (mèo ~5 px).
export const FLOOR_OFFSET = { polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 2 };
export function markOutlineUnit(object) { object.userData.outlineUnit = true; return object; }
function unitIdOf(object) {
  if (object.userData.outlineUnitId) return object.userData.outlineUnitId;
  let node = object;
  while (node && !node.userData.outlineUnit) node = node.parent;
  return (object.userData.outlineUnitId = (node || object).id);
}
const encodeId = (id, out) => out.set(id & 255, (id >> 8) & 255, (id >> 16) & 255);
const outlineShared = { tIds: { value: null }, useIds: { value: 0 } };
const idMat = new THREE.ShaderMaterial({
  uniforms: { unitId: { value: new THREE.Vector3() } },
  vertexShader: `
    #include <common>
    #include <batching_pars_vertex>
    #include <skinning_pars_vertex>
    void main() {
      #include <batching_vertex>
      #include <skinbase_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
    }`,
  fragmentShader: `uniform vec3 unitId; void main() { gl_FragColor = vec4( unitId / 255.0, 1.0 ); }`,
});
idMat.onBeforeRender = (renderer, scene, camera, geometry, object) => {
  encodeId(unitIdOf(object), idMat.uniforms.unitId.value);
  idMat.uniformsNeedUpdate = true;
};
let idTarget = null;
const clearTmp = new THREE.Color();
export function renderOutlineIds(renderer, scene, camera) {
  renderer.getDrawingBufferSize(sizeTmp);
  if (!idTarget) idTarget = new THREE.WebGLRenderTarget(sizeTmp.x, sizeTmp.y, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  else if (idTarget.width !== sizeTmp.x || idTarget.height !== sizeTmp.y) idTarget.setSize(sizeTmp.x, sizeTmp.y);
  const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha(), prevAuto = renderer.shadowMap.autoUpdate;
  const prevOverride = scene.overrideMaterial, prevBackground = scene.background, prevMask = camera.layers.mask;
  renderer.getClearColor(clearTmp);
  scene.overrideMaterial = idMat; scene.background = null;
  camera.layers.set(0);                  // không vẽ viền vào pass ID
  renderer.shadowMap.autoUpdate = false; // bóng đổ để pass chính cập nhật, khỏi vẽ shadow map hai lần
  // Vật trong suốt đang mờ (tường phòng khách khi chắn camera) không được che ID của vật phía sau: nếu không, viền
  // của vật đó không nhận ra mình đang đè lên chính nó và vẽ đậm thành mảng tối (thảm) trong lúc tường mờ dần.
  const hidden = [];
  scene.traverse(node => {
    const m = node.isMesh && node.visible && node.material;
    if (m && !Array.isArray(m) && m.transparent && m.opacity < .99) { node.visible = false; hidden.push(node); }
  });
  renderer.setRenderTarget(idTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  hidden.forEach(node => { node.visible = true; });
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(clearTmp, prevAlpha);
  renderer.shadowMap.autoUpdate = prevAuto;
  scene.overrideMaterial = prevOverride; scene.background = prevBackground;
  camera.layers.mask = prevMask;
  camera.layers.enable(OUTLINE_LAYER);
  camera.layers.enable(DECAL_LAYER);
  outlineShared.tIds.value = idTarget.texture;
  outlineShared.useIds.value = 1;
}

// Kiểu viền theo khối: gán userData.outlineStyle = 'cat' (hoặc tên khác) cho khối gốc, mọi mesh bên trong dùng kiểu đó.
//   px: độ dày (px màn hình)   dark: độ sáng còn lại của màu khối trong mực (nhỏ = đậm hơn)
//   tone: mức nhạt của đoạn "mờ"   brown: tông nâu pha vào mực   inner: độ đậm nét trong (0 = bỏ hẳn)
export const OUTLINE_STYLES = {
  default: { px: OUTLINE_PX, dark: .35, tone: 0, brown: '#4a2c1f', inner: STROKE.inner }, // nét đậm đặc, không đoạn nhạt
  cat: { px: 4.4, dark: .25, tone: 0, brown: '#3a2016', inner: 0 }, // mèo: nét dày, đậm đặc, không có nét trong
  // tai mèo: khối nhỏ nên cùng số px trông mảnh hơn thân, dày hơn chút cho cân
  catEar: { px: 5.2, dark: .25, tone: 0, brown: '#3a2016', inner: 0 },
};
function outlineStyleOf(node) {
  for (let n = node; n; n = n.parent) if (n.userData.outlineStyle) return n.userData.outlineStyle;
  return 'default';
}
const outlineMats = new Map();
function outlineMat(baseColor, styleName = 'default') {
  const style = OUTLINE_STYLES[styleName] || OUTLINE_STYLES.default;
  // Viền nâu ấm pha tông của khối (kiểu line Cats & Soup): mèo cam viền nâu cam, rào trắng viền nâu xám.
  const ink = pastelColor(baseColor).multiplyScalar(style.dark).lerp(new THREE.Color(style.brown), .5);
  const key = `${styleName}:${ink.getHexString()}`;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: ink }, width: { value: style.px }, toneAmount: { value: style.tone }, innerAlpha: { value: style.inner }, resolution: { value: resolution }, unitId: { value: new THREE.Vector3() }, ...outlineShared },
    vertexShader: `
      uniform float width; uniform vec2 resolution;
      attribute vec3 outlineNormal;
      varying vec3 vObj;
      varying float vDown;
      ${NOISE_GLSL}
      void main() {
        vObj = position;
        float w = width * (1.0 - ${(STROKE.wobble / 2).toFixed(3)} + ${STROKE.wobble.toFixed(3)} * toonNoise(position * ${STROKE.wobbleScale.toFixed(2)}));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Mép dưới của vật đặt trên sàn (bồn hoa, chân mèo, đáy hộp...): phần viền phình ra phía dưới rơi lên mặt sàn ĐỨNG
        // TRƯỚC đáy vật, nên bị sàn che (viền phía gần camera mất / chập chờn khi xoay). Kéo riêng các đỉnh có pháp tuyến
        // hướng xuống về phía camera đúng bằng vài lần bề rộng viền (tính theo kích thước 1 px ở khoảng cách đó).
        // Không kéo đỉnh hướng lên / ngang để viền không chọc xuyên khối mỏng (tai mèo).
        float down = smoothstep(0.05, 0.6, -normalize(mat3(modelMatrix) * outlineNormal).y);
        float pixelWorld = 2.0 * -mv.z / (projectionMatrix[1][1] * resolution.y);
        // Chỉ kéo tối đa 1.5 cm: kéo tỉ lệ khoảng cách thì zoom xa vượt bề dày vật dẹt (thảm, thảm chùi chân, đệm) và mặt đáy
        // viền trồi lên đè lên mặt trên của vật / của khối nằm trên nó thành mảng tối. Phần viền phình ra nằm trên sàn thì sàn
        // tự lùi lại theo độ dốc (FLOOR_OFFSET) nên không cần kéo xa. Mặt đáy viền còn đè lên chính khối thì bỏ (vDown).
        mv.z += down * min(w * pixelWorld * 3.0, 0.015);
        vDown = down;
        vec4 clip = projectionMatrix * mv;
        vec2 dir = (projectionMatrix * vec4(normalize(normalMatrix * outlineNormal), 0.0)).xy;
        float len = length(dir);
        if (len > 1e-5) clip.xy += dir / len * w * 2.0 / resolution * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float toneAmount;
      uniform float innerAlpha;
      uniform vec3 unitId;
      uniform sampler2D tIds;
      uniform float useIds;
      uniform vec2 resolution;
      varying vec3 vObj;
      varying float vDown;
      ${NOISE_GLSL}
      void main() {
        // Đậm / mờ: nhiễu tần số thấp, 2 lớp (đoạn dài + đoạn ngắn hơn) cho nhịp tay tự nhiên, chuyển mềm.
        float tone = toonNoise(vObj * ${STROKE.toneScale.toFixed(2)}) * 0.7 + toonNoise(vObj * ${(STROKE.toneScale * 2.7).toFixed(2)} + 3.0) * 0.3;
        tone = smoothstep(0.3, 0.8, tone);
        // Xơ bút: hạt mịn, rất nhẹ, cũng theo toạ độ khối nên không nhấp nháy.
        float fiber = smoothstep(0.5, 0.9, toonNoise(vObj * ${STROKE.grainScale.toFixed(2)} + 11.0));
        vec3 c = mix(color, mix(color, vec3(1.0), 0.55), tone * toneAmount + fiber * ${STROKE.grain.toFixed(3)});
        float alpha = 1.0;
        if (useIds > 0.5) { // đè lên chính khối của mình -> nét trong, mờ đi
          vec3 behind = floor(texture2D(tIds, gl_FragCoord.xy / resolution).rgb * 255.0 + 0.5);
          if (all(equal(behind, unitId))) {
            // mặt đáy viền (bị kéo về phía camera) đè lên chính vật: không phải nét trong thật, bỏ (không thì vật tối khi zoom xa)
            if (innerAlpha <= 0.0 || vDown > 0.5) discard;
            alpha = innerAlpha;
          }
        }
        gl_FragColor = vec4(c, alpha);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    transparent: true, depthWrite: false,
    // Kéo viền về phía camera một chút trong depth test: vật đặt sát sàn (bồn hoa, thảm, chân đồ đạc) có mặt đáy trùng
    // mặt sàn, nếu không có offset thì viền và sàn "giành" pixel (z-fighting) làm nét bị giật, đứt khi xoay camera.
    // Chỉ dùng units (lệch cố định), không dùng factor: factor tỉ lệ theo độ dốc mặt nên ở khối mỏng nhìn xiên (tai mèo)
    // viền mặt sau bị kéo vượt lên trước mặt trước, thành vệt viền chọc xuyên qua tai.
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -6,
  });
  material.onBeforeRender = (renderer, scene, camera, geometry, hull) => {
    encodeId(unitIdOf(hull.parent), material.uniforms.unitId.value);
    material.uniformsNeedUpdate = true;
  };
  outlineMats.set(key, material);
  return material;
}

// Pháp tuyến làm mượt để viền ở góc hộp cạnh sắc không bị hở: tại mỗi vị trí chỉ cộng các hướng pháp tuyến khác nhau
// (đỉnh trùng hướng ở đường nối UV không bị đếm hai lần nên góc khối không lệch về một mặt), giống toCreasedNormals(angle = π) của drei.
function ensureOutlineNormals(geometry) {
  if (geometry.attributes.outlineNormal) return;
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const sums = new Map(), keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    keys[i] = key;
    const entry = sums.get(key) || sums.set(key, { sum: [0, 0, 0], seen: new Set() }).get(key);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i), dir = `${nx.toFixed(2)},${ny.toFixed(2)},${nz.toFixed(2)}`;
    if (entry.seen.has(dir)) continue;
    entry.seen.add(dir);
    entry.sum[0] += nx; entry.sum[1] += ny; entry.sum[2] += nz;
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = sums.get(keys[i]).sum, len = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / len; out[i * 3 + 1] = y / len; out[i * 3 + 2] = z / len;
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}

const FLAT = new Set(['PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'ShapeGeometry']);
const noRaycast = () => {};
// Gắn viền cho mọi khối toon đặc chưa có viền (gọi lại thoải mái: khối đã có viền thì bỏ qua).
export function addOutlines(root) {
  if (!TOON) return;
  const todo = [];
  root.traverse(node => {
    if (!node.isMesh || node.isInstancedMesh || node.userData.outline || node.userData.outlined || node.userData.noOutline) return;
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    // Tấm dán trong suốt (mặt / mắt / ria mèo, ô trời cửa sổ...): không ghi vào pass ID (nếu ghi, cả tấm vuông kể cả phần
    // trong suốt bị coi là "thân mèo" nên viền chỗ đó bị xoá) và vẽ SAU viền để ria mép nằm đè lên trên nét viền.
    if (material?.transparent && !material.isMeshToonMaterial && !node.userData.decal) {
      node.userData.decal = true;
      node.layers.set(DECAL_LAYER);
      node.renderOrder = 2;
    }
    if (!material?.isMeshToonMaterial || material.transparent || material.wireframe) return;
    if (FLAT.has(node.geometry.type) || !node.geometry.attributes.normal) return;
    todo.push([node, material]);
  });
  for (const [node, material] of todo) {
    node.userData.outlined = true;
    ensureOutlineNormals(node.geometry);
    const hull = new THREE.Mesh(node.geometry, outlineMat(material.color, outlineStyleOf(node)));
    hull.userData.outline = true;
    hull.raycast = noRaycast;
    hull.castShadow = hull.receiveShadow = false;
    hull.layers.set(OUTLINE_LAYER);
    // Viền là vật trong suốt (alpha cho nét trong) và không ghi depth. Tường phòng khách cũng trong suốt (để mờ đi khi chắn
    // camera); nếu tường được vẽ SAU viền thì nó đè mất viền của đồ đứng trước nó, và thứ tự này đổi theo góc camera nên
    // viền chập chờn khi xoay. renderOrder 1: viền luôn vẽ sau mọi vật trong suốt thường, trước tấm dán (2).
    hull.renderOrder = 1;
    node.add(hull);
  }
}
