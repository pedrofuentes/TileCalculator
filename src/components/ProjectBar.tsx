import { useState } from 'react';
import type { Project } from '../types';
import { deleteProject, listNames, loadAll, saveProject } from '../state/storage';
import { makeDefaultProject } from '../state/defaults';

export function ProjectBar({
  project,
  onLoad,
}: {
  project: Project;
  onLoad: (p: Project) => void;
}) {
  const [names, setNames] = useState<string[]>(listNames());
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState('');

  const refresh = () => setNames(listNames());
  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 1800);
  };

  const handleSave = () => {
    const toSave = { ...project, name: name.trim() || 'Untitled' };
    saveProject(toSave);
    onLoad(toSave);
    refresh();
    flash('Saved');
  };

  const handleLoad = (n: string) => {
    if (!n) return;
    const all = loadAll();
    if (all[n]) {
      onLoad(all[n]);
      setName(n);
      flash('Loaded');
    }
  };

  const handleDelete = () => {
    if (!names.includes(name)) return;
    deleteProject(name);
    refresh();
    flash('Deleted');
  };

  const handleReset = () => {
    const def = makeDefaultProject();
    onLoad(def);
    setName(def.name);
    flash('Reset to default');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="w-40 rounded border border-slate-300 px-2 py-1"
      />
      <button onClick={handleSave} className="rounded bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-700">
        Save
      </button>
      <select
        value=""
        onChange={(e) => handleLoad(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        <option value="">Load…</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button onClick={handleDelete} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
        Delete
      </button>
      <button onClick={handleReset} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
        Reset
      </button>
      {status && <span className="text-xs text-emerald-600">{status}</span>}
    </div>
  );
}
