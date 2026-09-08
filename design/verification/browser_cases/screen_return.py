def run(browser, output):
    browser("set", "viewport", "1554", "900")
    browser("mouse", "move", "20", "20")
    browser("open", "http://127.0.0.1:5175/index.html?screen=agent-focus")
    browser("eval", "--stdin", source=r"""
(async () => {
  const control = document.querySelector('.viewer-screen-return');
  const link = control.querySelector('a');
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const settle = () => Promise.all(link.getAnimations().map(a => a.finished));
  assert(control.hasAttribute('data-revealed'), 'return link missing introduction');
  await new Promise(resolve => setTimeout(resolve, 3100));
  await settle();
  assert(getComputedStyle(link).opacity === '0', 'return link did not hide');
  const before = control.getBoundingClientRect();
  window.dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', clientX: before.left + before.width / 2,
    clientY: before.top - before.height / 2,
  }));
  await settle();
  assert(getComputedStyle(link).opacity === '1', 'nearby pointer did not reveal return link');
  assert(control.getBoundingClientRect().top === before.top, 'return target moved');
  window.dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', clientX: 20, clientY: 20,
  }));
  await settle();
  assert(getComputedStyle(link).opacity === '0', 'return link stayed visible away from pointer');
  link.focus();
  await settle();
  assert(getComputedStyle(link).opacity === '1', 'keyboard focus did not reveal return link');
  assert(link.hash === '#/screens/agent-focus', 'return destination changed');
})()
""")
    browser("press", "Enter")
    browser("wait", "--fn", "location.hash === '#/screens/agent-focus' && !!document.querySelector('design-app')")
    print("Passed screen return introduction, auto-hide, pointer reveal, and keyboard navigation checks.")
