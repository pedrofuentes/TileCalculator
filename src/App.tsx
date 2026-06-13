import { useMemo, useState } from 'react';
import type { Project } from './types';
import { computeProject } from './compute';
import { makeDefaultProject, uid } from './state/defaults';
import { ShapeBuilder } from './components/ShapeBuilder';
import {
  BorderTypesPanel,
  DimensionBasisPanel,
  GridControls,
  PlacedPostsPanel,
  PostTypesPanel,
  SideAssignmentPanel,
  TileConfigPanel,
  UnitSelector,
} from './components/ConfigPanels';
import { ProjectBar } from './components/ProjectBar';
import { DeckCanvas } from './render/DeckCanvas';
import { ResultsPanel } from './render/ResultsPanel';

export default function App() {
  const [project, setProject] = useState<Project>(() => makeDefaultProject());
  const [hoveredSideId, setHoveredSideId] = useState<string | null>(null);
  const computed = useMemo(() => computeProject(project), [project]);

  const patch = (p: Partial<Project>) => setProject((prev) => ({ ...prev, ...p }));

  const assignSide = (sideId: string, borderTypeId: string | null) =>
    setProject((prev) => ({
      ...prev,
      sideAssignments: [
        ...prev.sideAssignments.filter((a) => a.sideId !== sideId),
        { sideId, borderTypeId },
      ],
    }));

  const toggleCutSide = (sideId: string) =>
    setProject((prev) => {
      const current = prev.grid.cutSides ?? [];
      const cutSides = current.includes(sideId)
        ? current.filter((id) => id !== sideId)
        : [...current, sideId];
      return { ...prev, grid: { ...prev.grid, cutSides } };
    });

  const addPost = (sideId: string, pos: number, postTypeId: string) =>
    setProject((prev) => ({
      ...prev,
      posts: [
        ...(prev.posts ?? []),
        { id: uid('post'), postTypeId, sideId, pos },
      ],
    }));

  const removePost = (id: string) =>
    setProject((prev) => ({
      ...prev,
      posts: (prev.posts ?? []).filter((p) => p.id !== id),
    }));

  const updatePost = (id: string, patch: Partial<(typeof project.posts)[number]>) =>
    setProject((prev) => ({
      ...prev,
      posts: (prev.posts ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-800">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Deck Tile Calculator</h1>
          <p className="text-xs text-slate-500">Tiles, borders &amp; cut planning for irregular decks</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Units</span>
          <UnitSelector unit={project.unit} onChange={(u) => patch({ unit: u })} />
        </div>
        <div className="ml-auto">
          <ProjectBar project={project} onLoad={(p) => setProject(p)} />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[340px_1fr_360px]">
        {/* Controls */}
        <aside className="space-y-3 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3">
          <ShapeBuilder rects={project.rects} unit={project.unit} onChange={(rects) => patch({ rects })} />
          <DimensionBasisPanel
            basis={project.dimensionBasis ?? 'tileField'}
            onChange={(dimensionBasis) => patch({ dimensionBasis })}
          />
          <TileConfigPanel tile={project.tile} unit={project.unit} onChange={(tile) => patch({ tile })} />
          <GridControls
            grid={project.grid}
            unit={project.unit}
            appliedOffset={{ x: computed.offsetX, y: computed.offsetY }}
            onChange={(grid) => patch({ grid })}
          />
          <BorderTypesPanel
            borderTypes={project.borderTypes}
            unit={project.unit}
            onChange={(borderTypes) => patch({ borderTypes })}
          />
          <PostTypesPanel
            postTypes={project.postTypes ?? []}
            unit={project.unit}
            onChange={(postTypes) => patch({ postTypes })}
          />
          <PlacedPostsPanel
            posts={project.posts ?? []}
            postTypes={project.postTypes ?? []}
            sides={computed.shape.sides}
            unit={project.unit}
            hoveredSideId={hoveredSideId}
            onHover={setHoveredSideId}
            onUpdate={updatePost}
            onRemove={removePost}
          />
          <SideAssignmentPanel
            sides={computed.shape.sides}
            assignments={project.sideAssignments}
            borderTypes={project.borderTypes}
            unit={project.unit}
            cutSides={project.grid.cutSides ?? []}
            gridMode={project.grid.mode}
            hoveredSideId={hoveredSideId}
            onHover={setHoveredSideId}
            onChange={(sideAssignments) => patch({ sideAssignments })}
            onToggleCutSide={toggleCutSide}
          />
        </aside>

        {/* Visualization */}
        <main className="overflow-hidden border-r border-slate-200">
          <DeckCanvas
            computed={computed}
            project={project}
            hoveredSideId={hoveredSideId}
            onHover={setHoveredSideId}
            onAssignSide={assignSide}
            onToggleCutSide={toggleCutSide}
            onAddPost={addPost}
            onRemovePost={removePost}
          />
        </main>

        {/* Results */}
        <aside className="overflow-y-auto bg-slate-50 p-3">
          <ResultsPanel computed={computed} unit={project.unit} />
        </aside>
      </div>
    </div>
  );
}
