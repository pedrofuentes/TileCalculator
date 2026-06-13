import type { Project } from '../types';

const KEY = 'deck-tile-calc:projects';

export interface SavedProjects {
  [name: string]: Project;
}

export function loadAll(): SavedProjects {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SavedProjects;
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
