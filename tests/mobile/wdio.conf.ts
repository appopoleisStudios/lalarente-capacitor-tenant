import type { Options } from '@wdio/types'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const isApk = !!process.env.ANDROID_APP || true // Default to APK mode

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./specs/**/*.e2e.ts'],
  maxInstances: 1,
  logLevel: 'info',
  waitforTimeout: 30000,
  connectionRetryTimeout: 180000,
  connectionRetryCount: 5,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 240000 },
  autoCompileOpts: {
    tsNodeOpts: { transpileOnly: true, project: __dirname + '/tsconfig.json' },
  },
  services: [
    ['appium', {
      args: {
        // allow auto download of chromedriver for WebView
        allowInsecure: 'chromedriver_autodownload',
      },
    }],
  ],

  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      ...(isApk
        ? { 'appium:app': process.env.ANDROID_APP || path.join(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk') }
        : {
            'appium:appPackage': process.env.ANDROID_APP_PACKAGE || 'com.lalarente.app',
            'appium:appActivity': process.env.ANDROID_APP_ACTIVITY || 'MainActivity',
          }),
             'appium:newCommandTimeout': 300,
       'appium:adbExecTimeout': 120000,
      'appium:autoGrantPermissions': true,
      // We switch to WEBVIEW manually for stability
      'appium:autoWebview': true,
      'appium:autoWebviewTimeout': 15000,
      // Set to your emulator or device
      'appium:deviceName': process.env.ANDROID_DEVICE || 'Android Emulator',
      'appium:udid': process.env.ANDROID_UDID,
    },
  ],
}

export default config



