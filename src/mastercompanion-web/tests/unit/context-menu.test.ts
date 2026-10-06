import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { ContextMenuInteraction } from '../../projects/ui/src/lib/context-menu/context-menu-interaction';
import { contextMenuPosition } from '../../projects/ui/src/lib/context-menu/context-menu-position';

function fixture(t: TestContext, disabled = false) {
  const browser = new Window();
  for (const name of ['document', 'KeyboardEvent', 'PointerEvent', 'MouseEvent', 'Event']) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: Reflect.get(browser, name),
    });
    t.after(() => {
      if (previous) {
        Object.defineProperty(globalThis, name, previous);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    });
  }
  const trigger = document.createElement('button');
  const outside = document.createElement('button');
  const menu = document.createElement('div');
  menu.tabIndex = -1;
  menu.innerHTML = `
    <button data-menu-action="first" ${disabled ? 'disabled' : ''}>First</button>
    <button data-menu-action="disabled" disabled>Disabled</button>
    <button data-menu-action="last" ${disabled ? 'disabled' : ''}>Last</button>
  `;
  document.body.append(trigger, menu, outside);
  const selected: string[] = [];
  let dismissals = 0;
  const interaction = new ContextMenuInteraction(
    menu,
    { trigger, anchor: { x: 100, y: 100 }, label: 'Actions', actions: [] },
    (id) => selected.push(id),
    () => dismissals++,
  );
  t.after(() => {
    interaction.destroy();
    browser.happyDOM.abort();
  });
  const key = (value: string) =>
    menu.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
    );
  return { trigger, menu, outside, selected, interaction, key, dismissals: () => dismissals };
}

describe('Context menu interaction', () => {
  test('Arrow navigation wraps and skips disabled actions; Home and End reach boundaries', (t) => {
    const { menu, key } = fixture(t);
    const items = menu.querySelectorAll('button');

    assert.equal(document.activeElement, items[0]);
    key('ArrowDown');
    assert.equal(document.activeElement, items[2]);
    key('ArrowDown');
    assert.equal(document.activeElement, items[0]);
    key('ArrowUp');
    assert.equal(document.activeElement, items[2]);
    key('Home');
    assert.equal(document.activeElement, items[0]);
    key('End');
    assert.equal(document.activeElement, items[2]);
  });

  for (const activation of ['Enter', ' ']) {
    test(`${activation === ' ' ? 'Space' : activation} selects the focused action and returns focus`, (t) => {
      const { selected, trigger, key } = fixture(t);

      key(activation);

      assert.deepEqual(selected, ['first']);
      assert.equal(document.activeElement, trigger);
    });
  }

  test('Escape dismisses once, returns focus and removes global listeners', (t) => {
    const { key, trigger, outside, dismissals } = fixture(t);

    key('Escape');
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    key('Escape');

    assert.equal(dismissals(), 1);
    assert.equal(document.activeElement, trigger);
  });

  test('An outside pointer dismisses without stealing focus from its target', (t) => {
    const { outside, dismissals } = fixture(t);
    outside.focus();

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    assert.equal(dismissals(), 1);
    assert.equal(document.activeElement, outside);
  });

  test('A disabled action never emits selection', (t) => {
    const { menu, selected } = fixture(t);
    const button = menu.querySelector<HTMLButtonElement>('button:disabled');
    assert.ok(button);

    button.click();

    assert.deepEqual(selected, []);
  });

  test('A menu with all actions disabled remains dismissible with keyboard', (t) => {
    const { menu, key, dismissals } = fixture(t, true);

    assert.equal(document.activeElement, menu);
    key('ArrowDown');
    key('Enter');
    key('Escape');

    assert.equal(dismissals(), 1);
  });

  test('Scrolling inside the menu preserves it; scrolling its document dismisses it', (t) => {
    const { menu, dismissals } = fixture(t);

    menu.dispatchEvent(new Event('scroll'));
    assert.equal(dismissals(), 0);
    document.dispatchEvent(new Event('scroll'));

    assert.equal(dismissals(), 1);
  });

  test('Destroy removes interaction listeners and restores the trigger focus', (t) => {
    const { interaction, trigger, key, selected, dismissals } = fixture(t);

    interaction.destroy();
    key('Enter');
    key('Escape');

    assert.equal(document.activeElement, trigger);
    assert.deepEqual(selected, []);
    assert.equal(dismissals(), 0);
  });
});

describe('Context menu viewport positioning', () => {
  for (const { name, anchor, expected } of [
    { name: 'inside the viewport', anchor: { x: 100, y: 80 }, expected: { x: 100, y: 80 } },
    {
      name: 'past the right and bottom edges',
      anchor: { x: 900, y: 600 },
      expected: { x: 572, y: 392 },
    },
    { name: 'before the top and left edges', anchor: { x: -10, y: -10 }, expected: { x: 8, y: 8 } },
  ]) {
    test(`A pointer ${name} keeps the menu inside the viewport`, () => {
      assert.deepEqual(
        contextMenuPosition(anchor, { width: 220, height: 200 }, { width: 800, height: 600 }),
        expected,
      );
    });
  }
});
