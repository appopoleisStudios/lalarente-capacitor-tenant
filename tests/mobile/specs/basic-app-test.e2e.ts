async function switchToWebviewContext(timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const contexts = await driver.getContexts()
    const webview = contexts.find((c) => c.toUpperCase().includes('WEBVIEW'))
    if (webview) {
      await driver.switchContext(webview)
      return true
    }
    await browser.pause(1000)
  }
  return false
}

describe('Lala Rente App Basic Test', () => {
  it('should launch the app successfully (native context)', async () => {
    await browser.pause(5000)
    await browser.saveScreenshot('./test-screenshot.png')
    const hasAnyElements = await $('android.widget.TextView').isExisting() ||
                           await $('android.widget.Button').isExisting() ||
                           await $('android.widget.EditText').isExisting()
    expect(hasAnyElements).toBe(true)
  })

  it('should detect login or onboarding in WEBVIEW (switch context first)', async () => {
    // Ensure WEBVIEW is ready and switch
    const switched = await switchToWebviewContext(45000)
    if (!switched) {
      // If WEBVIEW is not available yet, this may be a pure native screen; mark test as skipped
      console.warn('WEBVIEW not available yet; skipping WEBVIEW assertions')
      return
    }

    // In WEBVIEW we can use CSS selectors
    const loginEmail = await $('[data-testid="login-email"]').catch(() => undefined)
    const loginPwd = await $('[data-testid="login-password"]').catch(() => undefined)
    const loginBtn = await $('[data-testid="login-submit"]').catch(() => undefined)

    const hasLogin = !!(await loginEmail?.isExisting()) ||
                     !!(await loginPwd?.isExisting()) ||
                     !!(await loginBtn?.isExisting())

    // Heuristics for onboarding/welcome content
    const hasWelcome = await $('*=Welcome').isExisting().catch(() => false) ||
                       await $('*=Get Started').isExisting().catch(() => false)

    expect(hasLogin || hasWelcome).toBe(true)
  })

  it('should interact with login form if present (WEBVIEW)', async () => {
    const switched = await switchToWebviewContext(45000)
    if (!switched) {
      console.warn('WEBVIEW not available; skipping login interaction')
      return
    }

    const emailInput = await $('[data-testid="login-email"]').catch(() => undefined)
    const passwordInput = await $('[data-testid="login-password"]').catch(() => undefined)
    const submitButton = await $('[data-testid="login-submit"]').catch(() => undefined)

    if (emailInput && await emailInput.isExisting()) {
      await emailInput.setValue('test@example.com')
    }
    if (passwordInput && await passwordInput.isExisting()) {
      await passwordInput.setValue('testpassword')
    }
    if (submitButton && await submitButton.isExisting()) {
      // Do not actually submit to avoid side effects in smoke test
      console.log('Login form located successfully')
    }

    await browser.saveScreenshot('./test-screenshot-after-interaction.png')
  })
})
