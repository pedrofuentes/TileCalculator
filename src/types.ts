// Core domain types. All spatial values are stored in the base unit: INCHES.

export type Unit = 'in' | 'ft' | 'cm' | 'mm' | 'm';

export interface RectOp {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  op: 'add' | 'subtract';
}

export interface TileConfig {
  width: number;
  height: number;
  gap: number;
  /** Number of visible "wood" slats/stripes drawn across the tile (along the grain). */
  slats: number;
  /** Whether the tile has a visible grain direction (drawn + alternated). */
  directional: boolean;
}

export interface BorderType {
  id: string;
  name: string;
  /** Visual face width of the border strip (for the diagram). */
  faceWidth: number;
  /** Length of a single border piece (e.g. 12" to match a tile edge). */
  pieceLength: number;
  hasCornerPieces: boolean;
  color: string;
}

export interface SideAssignment {
  sideId: string;
  borderTypeId: string | null;
}

export interface PostType {
  id: string;
  name: string;
  /** Footprint span along the edge (inches). */
  width: number;
  /** Footprint depth pointing inward from the edge (inches). */
  depth: number;
  color: string;
}

export interface Post {
  id: string;
  postTypeId: string;
  /** Side the post is attached to. */
  sideId: string;
  /** Distance (inches) from the side's endpoint a, measured along the side. */
  pos: number;
  /**
   * Inward setback (inches) from the edge/border line to the post's outer face.
   * 0 (default) means the post sits flush against the edge.
   */
  margin?: number;
}

export interface GridConfig {
  mode: 'auto' | 'manual';
  offsetX: number;
  offsetY: number;
  /**
   * Side IDs the user has marked as "cut sides" — edges that should absorb the
   * partial/cut tiles. Full tiles are kept flush against the un-marked sides.
   * Empty (default) preserves the legacy behavior of minimizing total cuts.
   */
  cutSides: string[];
}

export interface Project {
  name: string;
  unit: Unit;
  rects: RectOp[];
  tile: TileConfig;
  borderTypes: BorderType[];
  sideAssignments: SideAssignment[];
  postTypes: PostType[];
  posts: Post[];
  grid: GridConfig;
  /**
   * Tile layout pattern:
   *  - 'none': no slat pattern is drawn (plain tiles).
   *  - 'uniform': every tile shares the same grain direction.
   *  - 'checkerboard': grain rotates 90deg on every tile (by (col+row) parity).
   */
  layoutPattern: 'none' | 'uniform' | 'checkerboard';
  /** Grain direction of the even/origin tile. */
  grainDirection: 'horizontal' | 'vertical';
  /**
   * When true, offcut reuse is modeled with edge- & grain-aware pairing (interlocking
   * tiles). When false, the optimistic area-based estimate is used.
   */
  interlockReuse: boolean;
  /**
   * What the deck dimensions represent:
   *  - 'tileField': dimensions are the tile area; trim extends outward (no tile reduction).
   *  - 'totalFootprint': dimensions are the total bounded space; trim insets the tile field.
   */
  dimensionBasis: 'tileField' | 'totalFootprint';
}
