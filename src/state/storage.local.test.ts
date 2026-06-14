import { describe, test, expect, beforeEach } from 'vitest';
import { makeDefaultProject, normalizeProject } from './defaults';
import {
  deleteProject,
  listNames,
  loadAll,
  parseProjectJSON,
  saveProject,
} from './storage';

const STORAGE_KEY = 'deck-tile-calc:projects';

// Minimal in-memory Storage so the localStorage-backed functions can be tested
// in the default node environment (no jsdom / DOM needed).
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

function makeProjectNamed(name: string) {
  return {
    ...makeDefaultProject(),
    name,
  };
}

describe('localStorage-backed project storage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  test('saveProject then loadAll round-trips a saved project by project name', () => {
    const project = makeProjectNamed('Saved deck');

    saveProject(project);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toHaveProperty(project.name);
    expect(loadAll()).toEqual({
      [project.name]: normalizeProject(project),
    });
  });

  test('listNames returns saved project names sorted alphabetically', () => {
    saveProject(makeProjectNamed('Beta deck'));
    saveProject(makeProjectNamed('Alpha deck'));

    expect(listNames()).toEqual(['Alpha deck', 'Beta deck']);
  });

  test('deleteProject removes the named project from saved projects', () => {
    saveProject(makeProjectNamed('Alpha deck'));
    saveProject(makeProjectNamed('Beta deck'));

    deleteProject('Alpha deck');

    expect(loadAll()).not.toHaveProperty('Alpha deck');
    expect(listNames()).toEqual(['Beta deck']);
  });

  test('loadAll returns an empty object when storage is empty', () => {
    expect(loadAll()).toEqual({});
  });

  test('loadAll returns an empty object when storage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid JSON');

    expect(loadAll()).toEqual({});
  });

  test('parseProjectJSON rejects JSON without recognizable project data', () => {
    expect(() => parseProjectJSON('{"schemaVersion":1,"project":{"name":"No rects"}}')).toThrow(
      'Not a recognizable deck project file.',
    );
  });
});
