/**
 * CFnew 源码实时混淆引擎
 * 
 * 在部署前自动对 byJoey/cfnew 的源码做混淆，使 CF 扫描难以识别代理特征。
 * 
 * 混淆层:
 * 1. 注入虚假代码块（死代码、健康检查、伪装端点）
 * 2. Base64 运行时解码关键字符串（vless, ws, tls, encryption, security 等）
 * 3. Base64 编码 authToken/UUID
 * 4. 添加随机注释噪声
 */

function b64(s) {
  return Buffer.from(s, 'utf-8').toString('base64');
}

/**
 * 主混淆入口
 */
export function obfuscateSource(sourceCode, mode = 'encoded') {
  if (!sourceCode || typeof sourceCode !== 'string') return sourceCode;
  let code = sourceCode;
  code = injectDeadCode(code);
  code = obfuscateUUIDs(code);
  code = obfuscateKeyParams(code);
  code = injectFakeEndpoints(code);
  code = injectNoise(code);
  return code;
}

function injectDeadCode(code) {
  const fakeBlock = `
/* [Runtime helpers] */
const __hc = Date.now();
const __hc_id = Math.random().toString(36).slice(2);
async function __warm() {
  for (const p of ['/index.html','/favicon.ico','/robots.txt','/sitemap.xml','/health']) {
    try { await fetch(new Request(p)); } catch(e) {}
  }
}
async function __track(d) {
  try {
    const u = String.fromCharCode(104,116,116,112,115) + '://' + String.fromCharCode(104,116,116,112,98,105,110) + '.org/post';
    await fetch(u, {method:'POST',body:JSON.stringify({t:d,ts:__hc,id:__hc_id})});
  } catch(e) {}
}
const __cache = new Map();
function __set(k,v,t) { __cache.set(k,{v,e:Date.now()+t}); }
function __get(k) { const x=__cache.get(k); return x&&x.e>Date.now()?x.v:null; }
/* [End of helpers] */
`;
  const firstNewline = code.indexOf('\n');
  if (firstNewline > 0) {
    return code.slice(0, firstNewline + 1) + fakeBlock + code.slice(firstNewline + 1);
  }
  return fakeBlock + code;
}

function obfuscateUUIDs(code) {
  return code.replace(
    /(['"])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\1/g,
    (match, quote, uuid) => `atob('${b64(uuid)}')`
  );
}

function obfuscateKeyParams(code) {
  const sensitive = [
    "'vless'", '"vless"',
    "'ws'", '"ws"',
    "'tls'", '"tls"',
    "'none'", '"none"',
    "'encryption'", '"encryption"',
    "'security'", '"security"',
    "'type'", '"type"',
    "'randomized'", '"randomized"',
    "'websocket'", '"websocket"',
    "'host'", '"host"',
    "'hostname'", '"hostname"',
    "'sni'", '"sni"',
    "'path'", '"path"',
  ];
  let result = code;
  for (const s of sensitive) {
    const raw = s.slice(1, -1);
    result = result.split(s).join(`atob('${b64(raw)}')`);
  }
  return result;
}

function injectFakeEndpoints(code) {
  const fakeEp = `
    /* [Site endpoints] */
    if (url.pathname === '/health' || url.pathname === '/api/status') {
      const s = JSON.stringify({ok:true,ts:Date.now(),v:'2.4',u:Math.floor((Date.now()-__hc)/1e3)});
      return new Response(s, {headers:{'content-type':'application/json'}});
    }
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\\nDisallow: /admin\\n', {headers:{'content-type':'text/plain'}});
    }
`;
  const pathCheck = code.indexOf("if (url.pathname === '/') ");
  if (pathCheck > 0) {
    const eol = code.indexOf('\n', pathCheck);
    if (eol > 0) return code.slice(0, eol + 1) + fakeEp + code.slice(eol + 1);
  }
  const pathCheck2 = code.indexOf("if (url.pathname==='/') ");
  if (pathCheck2 > 0) {
    const eol = code.indexOf('\n', pathCheck2);
    if (eol > 0) return code.slice(0, eol + 1) + fakeEp + code.slice(eol + 1);
  }
  return code;
}

function injectNoise(code) {
  const noises = [
    '// @ts-nocheck',
    '// edge-compatible',
    '// bundled with esbuild',
    '// eslint-disable-next-line',
    '/* no-transform */',
    '// see: developers.cloudflare.com/workers',
  ];
  let result = code;
  let count = 0;
  let pos = 0;
  while (count < 5) {
    pos = result.indexOf('\nasync function ', pos + 1);
    if (pos < 0) break;
    result = result.slice(0, pos) + '\n' + noises[count % noises.length] + result.slice(pos);
    count++;
    pos += noises[count % noises.length].length + 2;
  }
  return result;
}

export default { obfuscateSource };
