#!/usr/bin/env node

/**
 * qqbot CLI - 用于升级和管理 qqbot 插件
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const args = process.argv.slice(2);
const command = args[0];

function detectInstallation() {
  const home = homedir();
  if (existsSync(join(home, '.openclaw'))) return 'openclaw';
  if (existsSync(join(home, '.clawdbot'))) return 'clawdbot';
  return null;
}

const PLUGIN_IDS = ['qqbot', 'openclaw-qq', '@sliverp/qqbot', '@tencent-connect/openclaw-qq', '@tencent-connect/qqbot', '@tencent-connect/openclaw-qqbot', 'openclaw-qqbot'];
const EXTENSION_DIR_NAMES = ['qqbot', 'openclaw-qq', 'openclaw-qqbot'];

function cleanupInstallation(appName) {
  const home = homedir();
  const appDir = join(home, `.${appName}`);
  const configFile = join(appDir, `${appName}.json`);
  let oldQqbotConfig = null;

  console.log(`\n>>> 处理 ${appName} 安装...`);

  if (existsSync(configFile)) {
    try {
      const config = JSON.parse(readFileSync(configFile, 'utf8'));
      if (config.channels?.qqbot) {
        oldQqbotConfig = { ...config.channels.qqbot };
        console.log('已保存旧的 qqbot 配置');
      }
    } catch (err) {
      console.error('读取配置文件失败:', err.message);
    }
  }

  for (const dirName of EXTENSION_DIR_NAMES) {
    const extensionDir = join(appDir, 'extensions', dirName);
    if (existsSync(extensionDir)) {
      console.log(`删除旧版本插件: ${extensionDir}`);
      rmSync(extensionDir, { recursive: true, force: true });
    }
  }

  if (existsSync(configFile)) {
    console.log('清理配置文件中的插件字段...');
    try {
      const config = JSON.parse(readFileSync(configFile, 'utf8'));
      for (const id of PLUGIN_IDS) {
        if (config.channels?.[id]) delete config.channels[id];
        if (config.plugins?.entries?.[id]) delete config.plugins.entries[id];
        if (config.plugins?.installs?.[id]) delete config.plugins.installs[id];
        if (Array.isArray(config.plugins?.allow)) {
          config.plugins.allow = config.plugins.allow.filter((x) => x !== id);
        }
      }
      writeFileSync(configFile, JSON.stringify(config, null, 2));
      console.log('配置文件已更新');
    } catch (err) {
      console.error('清理配置文件失败:', err.message);
    }
  }

  return oldQqbotConfig;
}

function runCommand(cmd, args = []) {
  try {
    execSync([cmd, ...args].join(' '), { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function upgrade() {
  console.log('=== qqbot 插件升级脚本 ===');
  let foundInstallation = null;
  let savedConfig = null;
  const home = homedir();

  if (existsSync(join(home, '.openclaw'))) {
    savedConfig = cleanupInstallation('openclaw');
    foundInstallation = 'openclaw';
  }
  if (existsSync(join(home, '.clawdbot'))) {
    const clawdbotConfig = cleanupInstallation('clawdbot');
    if (!savedConfig) savedConfig = clawdbotConfig;
    foundInstallation = 'clawdbot';
  }

  if (!foundInstallation) {
    console.log('\n未找到 clawdbot 或 openclaw 安装目录');
    process.exit(1);
  }

  console.log('\n=== 清理完成 ===');
  console.log('\n[1/2] 安装新版本插件...');
  runCommand(foundInstallation, ['plugins', 'install', 'openclaw-qqbot']);

  console.log('\n[2/2] 配置机器人通道...');
  if (savedConfig?.appId && savedConfig?.clientSecret) {
    const token = `${savedConfig.appId}:${savedConfig.clientSecret}`;
    console.log(`使用已保存的配置: appId=${savedConfig.appId}`);
    runCommand(foundInstallation, ['channels', 'add', '--channel', 'qqbot', '--token', `"${token}"`]);
    if (savedConfig.markdownSupport !== undefined) {
      runCommand(foundInstallation, ['config', 'set', 'channels.qqbot.markdownSupport', String(savedConfig.markdownSupport)]);
    }
  } else {
    console.log('未找到已保存的 qqbot 配置，请手动配置');
    return;
  }

  console.log('\n=== 升级完成 ===');
}

function install() {
  console.log('=== qqbot 插件安装 ===');
  const cmd = detectInstallation();
  if (!cmd) {
    console.log('未找到 clawdbot 或 openclaw 安装');
    process.exit(1);
  }
  console.log(`\n使用 ${cmd} 安装插件...`);
  runCommand(cmd, ['plugins', 'install', '@tencent-connect/openclaw-qqbot']);
  console.log('\n=== 安装完成 ===');
}

function showHelp() {
  console.log(`
qqbot CLI - QQ机器人插件管理工具

用法:
  npx openclaw-qqbot <命令>

命令:
  upgrade       清理旧版本插件（升级前执行）
  install       安装插件到 openclaw/clawdbot
`);
}

switch (command) {
  case 'upgrade':
    upgrade();
    break;
  case 'install':
    install();
    break;
  case '-h':
  case '--help':
  case 'help':
    showHelp();
    break;
  default:
    if (command) console.log(`未知命令: ${command}`);
    showHelp();
    process.exit(command ? 1 : 0);
}
