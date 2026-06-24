import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { obfuscateSource } from './scripts/obfuscate-source.mjs';

const 端口 = Number(process.env.PORT || 8790);
const 静态目录 = resolve(import.meta.dirname, 'public');
const 源码目录 = resolve(import.meta.dirname, 'public', 'sources');
const 源码远程基础 = 'https://raw.githubusercontent.com/gdwengf/cfnew/main';
const 接口地址 = 'https://api.cloudflare.com/client/v4';
const 兼容日期 = '2026-01-20';
const 绑定名 = 'C';
