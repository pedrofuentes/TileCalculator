import type { Project } from '../types';
import { normalizeProject } from './defaults';

const KEY = 'deck-tile-calc:projects';

export interface SavedProjects {
  [name: string]: Project;
}

export function loadAll(): SavedProjects {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedProjects;
    const out: SavedProjects = {};
    for (const [k, v] of Object.entries(parsed)) out[k] = normalizeProject(v);
    return out;
  } catch {
    return {};
  }
}

export function saveProject(project: Project): void {
  const all = loadAll();
  all[project.name] = project;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteProject(name: string): void {
  const all = loadAll();
  delete all[name];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function listNames(): string[] {
  return Object.keys(loadAll()).sort();
}

const SCHEMA_VERSION = 1;

/** Serialize a project to a portable JSON string (pretty-printed). */
export function exportProjectJSON(project: Project): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, project }, null, 2);
}

/**
 * Parse a JSON string produced by {@link exportProjectJSON} (or a bare project
 * object) back into a normalized Project. Throws on malformed input.
 */
export function parseProjectJSON(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const obj = data as { project?: unknown } | null;
  const raw =
    obj && typeof obj === 'object' && 'project' in obj && obj.project
      ? (obj.project as Project)
      : (data as Project);
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Project).rects)) {
    throw new Error('Not a recognizable deck project file.');
  }
  return normalizeProject(raw as Project);
}
