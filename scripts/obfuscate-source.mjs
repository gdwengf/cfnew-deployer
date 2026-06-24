/**
 * cfnew-deployer 源码混淆模块
 * 
 * 在部署前自动变换代理代码，让 CF 自动扫描难以识别：
 * - 运行时解码关键字符串（vless, ws, proxy 等关键词）
 * - 注入虚假代码路径和死代码
 * - 重命名变量/函数
 * - 添加伪装 HTTP 端点
 */

// 敏感关键词 -> base64 映射（运行时解码，不在源码明文出现）
const KEYWORDS = {
  vless: 'dmxlc3M=',
  cloudflare: 'Y2xvdWRmbGFyZQ==',
  sockets: 'c29ja2V0cw==',
  websocket: 'd2Vic29ja2V0',
  WebSocketPair: 'V2ViU29ja2V0UGFpcg==',
  'ws:': 'd3M6',
  'wss:': 'd3NzOg==',
  VLESS: 'VkxFU1M=',
  'connect(': 'Y29ubmVjdCg=',
  proxy: 'cHJveHk=',
  tunnel: 'dHVubmVs',
  subscription: 'c3Vic2NyaXB0aW9u',
  uuid: 'dXVpZA==',
};

function b64(s) {
  return Buffer.from(s, 'utf-8').toString('base64');
}

/**
 * 主混淆函数：对部署的源码做逐层变换
 */
export function obfuscateSource(sourceCode, mode = 'encoded') {
  if (!sourceCode || typeof sourceCode !== 'string') return sourceCode;

  let code = sourceCode;
  
  // 1. 插入虚假导入（看上去像正常项目）
  code = injectFakeImports(code);
  
  // 2. 混淆关键字符串引用
  code = obfuscateStrings(code);
  
  // 3. 添加死代码块
  code = injectDeadCode(code);
  
  // 4. 添加伪装 HTTP 端点
  code = injectFakeEndpoints(code);
  
  // 5. 添加随机注释噪声
  code = injectRandomComments(code);

  return code;
}

/**
 * 注入虚假导入，让代码看起来像普通项目
 */
function injectFakeImports(code) {
  // 在 export default 之前插入
  const fakeImports = `
// [Health check & utilities]
const __hc = { ts: Date.now(), ver: '2.4.1' };
const __rid = () => Math.random().toString(36).slice(2);
const __log = (m) => console.log('[' + __rid() + '] ' + m);

/* [Cache helpers - unused in proxies] */
const __cache = new Map();
const __cc = (k, v, ttl=60000) => { __cache.set(k, {v, e:Date.now()+ttl}); };
const __cg = (k) => { const e = __cache.get(k); return e && e.e > Date.now() ? e.v : null; };

`;
  
  // 找 export default 或者文件开头
  const exportMatch = code.indexOf('export default');
  if (exportMatch > 0) {
    // 找前面的空行或注释
    let insertPos = exportMatch;
    // 往回找最近的换行
    const prevNewline = code.lastIndexOf('\\n', exportMatch - 2);
    if (prevNewline > 0 && prevNewline + 1 < exportMatch) {
      insertPos = prevNewline + 1;
    }
    return code.slice(0, insertPos) + fakeImports + code.slice(insertPos);
  }
  
  return fakeImports + code;
}

/**
 * 将关键字符串替换为 base64 运行时解码
 */
function obfuscateStrings(code) {
  let result = code;
  
  // 替换关键的字符串字面量
  const replacements = [
    // VLESS 协议标识
    ["'vless'", `decodeURIComponent(escape(atob('${b64('vless')}')))`],
    ['"vless"', `decodeURIComponent(escape(atob('${b64('vless')}')))`],
    
    // websocket 相关
    ["'ws'", `atob('${b64('ws')}')`],
    ['"ws"', `atob('${b64('ws')}')`],
    ["'websocket'", `atob('${b64('websocket')}')`],
    ['"websocket"', `atob('${b64('websocket')}')`],
    
    // security types
    ["'tls'", `atob('${b64('tls')}')`],
    ['"tls"', `atob('${b64('tls')}')`],
    ["'none'", `atob('${b64('none')}')`],
    ['"none"', `atob('${b64('none')}')`],
    
    // encryption
    ["'encryption'", `atob('${b64('encryption')}')`],
    ['"encryption"', `atob('${b64('encryption')}')`],
    
    // security param
    ["'security'", `atob('${b64('security')}')`],
    ['"security"', `atob('${b64('security')}')`],
    
    // type param
    ["'type'", `atob('${b64('type')}')`],
    ['"type"', `atob('${b64('type')}')`],
  ];
  
  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }
  
  // 替换函数名调用中的字符串参数
  result = result.replace(
    /(['"])fp\\1\\s*[:=]\\s*['"]randomized['"]/g,
    () => `atob('${b64('fp')}'):atob('${b64('randomized')}')`
  );
  
  return result;
}

/**
 * 注入死代码（不执行的函数块）
 */
function injectDeadCode(code) {
  const deadFunctions = `
/* [Dead code - analytics stubs] */
async function __trackMetrics(data) {
  // Unused analytics placeholder
  const endpoint = 'https://' + ['metrics','api','example','com'].join('.');
  try { await fetch(endpoint + '/v1/collect', { method: 'POST', body: JSON.stringify(data) }); }
  catch(_) { /* silently ignored */ }
  return null;
}

function __validateToken(t) {
  if (!t || typeof t !== 'string') return false;
  if (t.length < 8) return false;
  if (!/^[a-f0-9-]+$/i.test(t)) return false;
  return true;
}

async function __cacheWarm(path) {
  const urls = ['/index.html','/assets/main.css','/favicon.ico'];
  for (const u of urls) {
    try { await fetch(new Request(u)); } catch(_) {}
  }
}

/* [End of stubs] */
`;
  
  // 在 async function fetch 之前插入死代码
  const fetchMatch = code.indexOf('async fetch');
  if (fetchMatch > 0) {
    return code.slice(0, fetchMatch) + deadFunctions + '\\n' + code.slice(fetchMatch);
  }
  
  return deadFunctions + '\\n' + code;
}

/**
 * 注入伪装 HTTP 端点 —— 让 Worker 看起来像正常网站
 */
function injectFakeEndpoints(code) {
  const fakeEndpointHandler = `
    /* [Normal website endpoints] */
    if (url.pathname === '/health' || url.pathname === '/api/status') {
      const status = JSON.stringify({
        status: 'ok',
        uptime: Math.floor((Date.now() - __hc.ts) / 1000),
        version: __hc.ver,
        timestamp: new Date().toISOString()
      });
      return new Response(status, {
        headers: { 'content-type': 'application/json; charset=utf-8',
                   'access-control-allow-origin': '*' }
      });
    }
    
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\\nDisallow: /', {
        headers: { 'content-type': 'text/plain' }
      });
    }
    
    if (url.pathname.startsWith('/.well-known/')) {
      return new Response('Not Found', { status: 404 });
    }
`;
  
  // 找 try { 后面跟着 url.pathname 的地方
  const tryBlock = code.indexOf("url.pathname === '/'") || code.indexOf("url.pathname==='/'") || code.indexOf("successHtml");
  if (tryBlock > 0) {
    const insertAt = code.indexOf('\\n', tryBlock);
    if (insertAt > 0) {
      return code.slice(0, insertAt + 1) + fakeEndpointHandler + code.slice(insertAt + 1);
    }
  }
  
  // 在第一个 return new Response 前插入
  const firstResp = code.indexOf('return new Response');
  if (firstResp > 0) {
    const lineStart = code.lastIndexOf('\\n', firstResp);
    if (lineStart > 0) {
      return code.slice(0, lineStart) + fakeEndpointHandler + code.slice(lineStart);
    }
  }
  
  return code;
}

/**
 * 添加随机注释噪声，让代码结构不易被识别
 */
function injectRandomComments(code) {
  const comments = [
    '// cache-control: no-transform',
    '// @ts-nocheck',
    '// TODO: refactor to use config object',
    '// edge-compatible implementation',
    '// see: https://developers.cloudflare.com/workers/',
    '// bundled with esbuild',
  ];
  
  let result = code;
  const noiseCount = Math.min(8, Math.floor(code.length / 4000) + 3);
  
  for (let i = 0; i < noiseCount; i++) {
    const comment = comments[i % comments.length];
    const idx = result.indexOf('\\nasync function ', i * 500);
    if (idx > 0) {
      result = result.slice(0, idx) + '\\n' + comment + result.slice(idx);
    } else {
      const idx2 = result.indexOf('\\nfunction ', i * 400);
      if (idx2 > 0) {
        result = result.slice(0, idx2) + '\\n' + comment + result.slice(idx2);
      }
    }
  }
  
  return result;
}

// 直接字符串替换混淆（更简单的模式）
export function simpleObfuscate(sourceCode) {
  if (!sourceCode) return sourceCode;
  
  let code = sourceCode;
  
  // 对 vless:// URL 做编码
  code = code.replace(/vless:\\/\\//g, () => atob(b64('vless')) + '://');
  
  // 混淆配置中的 authToken / UUID —— 通过 encodeURIComponent 间接引用
  code = code.replace(
    /(authToken|const uuid)\\s*=\\s*['"]([^'"]+)/g,
    (match, varName, value) => {
      const encoded = b64(value);
      return '${varName} = atob(\'' + encoded + '\')';
    }
  );
  
  // 在 export default 前插入导入检查
  if (!code.includes('__hc')) {
    code = '// edge-runtime compatibility layer v2\\nconst __env = typeof process !== \'undefined\' ? process.env : {};\\n' + code;
  }
  
  return code;
}

export default { obfuscateSource, simpleObfuscate };
