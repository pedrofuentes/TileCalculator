import { useRef, useState } from 'react';
import type { Project } from '../types';
import {
  deleteProject,
  exportProjectJSON,
  listNames,
  loadAll,
  parseProjectJSON,
  saveProject,
} from '../state/storage';
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
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = () => setNames(listNames());
  const flash = (msg: string) => {
    setError('');
    setStatus(msg);
    setTimeout(() => setStatus(''), 1800);
  };
  const flashError = (msg: string) => {
    setStatus('');
    setError(msg);
    setTimeout(() => setError(''), 4000);
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

  const handleExport = () => {
    const safeName = (name.trim() || 'deck').replace(/[^a-z0-9-_]+/gi, '_');
    const blob = new Blob([exportProjectJSON({ ...project, name: name.trim() || project.name })], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.deck.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash('Exported');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const loaded = parseProjectJSON(text);
      onLoad(loaded);
      setName(loaded.name);
      flash('Imported');
    } catch (e) {
      flashError(e instanceof Error ? e.message : 'Import failed');
    }
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
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <button
        onClick={handleExport}
        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
        title="Download this deck as a .deck.json file"
      >
        Export
      </button>
      <button
        onClick={() => fileInput.current?.click()}
        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
        title="Load a deck from a .deck.json file"
      >
        Import
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = '';
        }}
      />
      {status && <span className="text-xs text-emerald-600">{status}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
