import type { Options } from '@wdio/types'

const isApk = !!process.env.ANDROID_APP

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./specs/**/*.e2e.ts'],
  maxInstances: 1,
  logLevel: 'info',
  waitforTimeout: 20000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
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
        ? { 'appium:app': process.env.ANDROID_APP }
        : {
            'appium:appPackage': process.env.ANDROID_APP_PACKAGE || 'com.lalarente.app',
            'appium:appActivity': process.env.ANDROID_APP_ACTIVITY || 'MainActivity',
          }),
      'appium:newCommandTimeout': 180,
      'appium:adbExecTimeout': 60000,
      'appium:autoGrantPermissions': true,
      // We switch to WEBVIEW manually for stability
      'appium:autoWebview': false,
      // Set to your emulator or device
      'appium:deviceName': process.env.ANDROID_DEVICE || 'Android Emulator',
      'appium:udid': process.env.ANDROID_UDID,
    },
  ],
}

export default config


