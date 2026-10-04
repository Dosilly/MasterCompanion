import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NavigationEnd,
  NavigationStart,
  type Event,
  type NavigationBehaviorOptions,
  type UrlTree,
} from '@angular/router';
import { Subject } from 'rxjs';
import type { WorkspaceDto } from '@mastercompanion/contracts';
import {
  decodeWorkspaceRoute,
  workspaceRouteUrl,
} from '../../projects/engine/src/lib/features/workspace/workspace-route-codec';
import { WorkspaceRouting } from '../../projects/engine/src/lib/features/workspace/workspace-routing';
import type { WorkspaceRouteTarget } from '../../projects/engine/src/lib/features/workspace/workspace-route-target';
import type { WorkspaceRouteResult } from '../../projects/engine/src/lib/features/workspace/workspace-route-state';

function deferred<T>() {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      assert.ok(resolveValue);
      resolveValue(value);
    },
  };
}

const workspace: WorkspaceDto = {
  campaignId: 'campaign',
  title: 'Campaign',
  moduleId: 'module',
  moduleVersion: '1',
  startMaterialId: 'reader',
  folders: [],
  materials: [{ id: 'reader', title: 'Reader', group: '', folderId: null }],
  maps: [{ id: 'map.one', title: 'Map', assetId: 'asset', width: 800, height: 600, markers: [] }],
};

class ControlledRouter {
  readonly events = new Subject<Event>();
  readonly calls: { url: string; replace: boolean }[] = [];
  private navigationId = 0;
  constructor(public url: string) {}
  async navigateByUrl(
    url: string | UrlTree,
    options?: NavigationBehaviorOptions,
  ): Promise<boolean> {
    const address = url.toString();
    this.calls.push({ url: address, replace: options?.replaceUrl ?? false });
    await Promise.resolve();
    this.visit(address);
    return true;
  }
  visit(url: string): void {
    const id = ++this.navigationId;
    this.events.next(new NavigationStart(id, url));
    this.url = url;
    this.events.next(new NavigationEnd(id, url, url));
  }
}

describe('Workspace route addresses', () => {
  for (const target of [
    { kind: 'material', materialId: 'module:note.\u0105', anchor: 'section:one' },
    { kind: 'map', mapId: 'map.one' },
    { kind: 'game' },
    { kind: 'party' },
    { kind: 'empty' },
  ] satisfies WorkspaceRouteTarget[]) {
    test(`Serializing ${target.kind} preserves its stable target`, () => {
      assert.deepEqual(decodeWorkspaceRoute(workspaceRouteUrl(target), workspace), {
        kind: 'target',
        target,
      });
    });
  }
  for (const url of [
    '/unknown',
    '/materials',
    '/materials/a/b',
    '/materials/a;mode=edit',
    '/game?mode=edit',
    '/game#section',
    '/materials/a%2Fb',
    '/materials/%20',
    '/materials/a#',
    '/(aux:game)',
  ]) {
    test(`Unsupported address ${url} is rejected`, () => {
      assert.deepEqual(decodeWorkspaceRoute(url, workspace), {
        kind: 'error',
        code: 'invalidRoute',
      });
    });
  }
  test('An absent map is reported without selecting another map', () => {
    assert.deepEqual(decodeWorkspaceRoute('/maps/missing', workspace), {
      kind: 'error',
      code: 'mapNotFound',
    });
  });
});

describe('Workspace route intent', () => {
  test('The root selects the campaign start material by replacing history', async (t) => {
    const router = new ControlledRouter('/');
    const targets: WorkspaceRouteTarget[] = [];
    const routing = new WorkspaceRouting(router, (target) => {
      targets.push(target);
      return { kind: 'ready' };
    });
    t.after(() => routing.destroy());

    assert.equal(await routing.initialize(workspace), true);

    assert.deepEqual(router.calls, [{ url: '/materials/reader', replace: true }]);
    assert.deepEqual(targets, [{ kind: 'material', materialId: 'reader' }]);
  });
  test('A direct link is applied without adding a history entry and repeating it does not push', async (t) => {
    const router = new ControlledRouter('/party');
    const routing = new WorkspaceRouting(router, () => ({ kind: 'ready' }));
    t.after(() => routing.destroy());

    await routing.initialize(workspace);
    await routing.navigate({ kind: 'party' });

    assert.deepEqual(router.calls, []);
    assert.deepEqual(routing.state(), { kind: 'ready', target: { kind: 'party' } });
  });
  test('A newer navigation prevents a delayed read from activating an older target', async (t) => {
    const router = new ControlledRouter('/workspace');
    const gate = deferred<WorkspaceRouteResult>();
    const activated: WorkspaceRouteTarget[] = [];
    const routing = new WorkspaceRouting(router, async (target, context) => {
      if (target.kind === 'material') {
        await gate.promise;
      }
      if (context.isCurrent()) {
        activated.push(target);
      }
      return { kind: 'ready' };
    });
    t.after(() => routing.destroy());
    await routing.initialize(workspace);

    const oldRead = routing.navigate({ kind: 'material', materialId: 'reader' });
    await Promise.resolve();
    await routing.navigate({ kind: 'game' });
    gate.resolve({ kind: 'ready' });
    assert.equal(await oldRead, false);

    assert.deepEqual(activated, [{ kind: 'empty' }, { kind: 'game' }]);
    assert.deepEqual(routing.state(), { kind: 'ready', target: { kind: 'game' } });
  });
  test('Browser history invalidates an in-flight read without a router push', async (t) => {
    const router = new ControlledRouter('/workspace');
    const gate = deferred<WorkspaceRouteResult>();
    const routing = new WorkspaceRouting(router, (target) =>
      target.kind === 'material' ? gate.promise : { kind: 'ready' },
    );
    t.after(() => routing.destroy());
    await routing.initialize(workspace);

    const opening = routing.navigate({ kind: 'material', materialId: 'reader' });
    await Promise.resolve();
    router.visit('/party');
    gate.resolve({ kind: 'ready' });
    await opening;
    await Promise.resolve();

    assert.deepEqual(routing.state(), { kind: 'ready', target: { kind: 'party' } });
    assert.equal(router.calls.length, 1);
  });
  test('A failed read retries the requested address without duplicating history', async (t) => {
    const router = new ControlledRouter('/materials/reader');
    let attempts = 0;
    const routing = new WorkspaceRouting(router, () =>
      ++attempts === 1 ? { kind: 'error', code: 'materialLoadFailed' } : { kind: 'ready' },
    );
    t.after(() => routing.destroy());

    assert.equal(await routing.initialize(workspace), false);
    assert.equal(await routing.retry(), true);

    assert.equal(attempts, 2);
    assert.deepEqual(router.calls, []);
  });
  test('Destroying the owner invalidates pending activation and releases router subscription', async () => {
    const router = new ControlledRouter('/materials/reader');
    const gate = deferred<WorkspaceRouteResult>();
    const routing = new WorkspaceRouting(router, () => gate.promise);
    const opening = routing.initialize(workspace);

    routing.destroy();
    gate.resolve({ kind: 'ready' });

    assert.equal(await opening, false);
    assert.equal(router.events.observed, false);
    assert.equal(await routing.navigate({ kind: 'game' }), false);
  });
});
