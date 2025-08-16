const path = require('path');

exports.config = {
    runner: 'local',
    specs: [
        './tests/**/*.js'
    ],
    exclude: [],
    maxInstances: 1,
    capabilities: [{
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': 'Android Emulator',
        'appium:platformVersion': '33',
        'appium:app': path.join(__dirname, 'android/app/build/outputs/apk/debug/app-debug.apk'),
        'appium:autoGrantPermissions': true,
        'appium:noReset': false
    }],
    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: ['appium'],
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    appium: {
        command: 'appium',
        args: {
            address: '127.0.0.1',
            port: 4723,
            log: './appium.log'
        }
    }
};
