"use client";

/**
 * The Haunted Call Graph — a shared React Flow component used by the dashboard
 * results view and the Grimoire (saved-hunt) detail view. Nodes are functions
 * colored by verdict and grouped into columns so dead code visually clusters;
 * edges to zombies animate in purple. Clicking a node reports selection so the
 * parent can show the Hunter/Skeptic Chain-of-Thought.
 */

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { GraphEdge, GraphNode, Verdict } from "@/lib/agent/types";
import { COLORS } from "@/lib/theme";

interface NodeData {
  label: string;
  verdict: Verdict;
  file: string;
  referenceCount: number;
  isExported: boolean;
  selected?: boolean;
}

function PhantomNode({ data }: NodeProps) {
  const d = data as NodeData;
  const color = COLORS[d.verdict];
  return (
    <div
      className="rounded-lg border px-2 py-1 text-[11px] font-mono"
      style={{
        borderColor: color,
        background: `${color}14`,
        boxShadow: d.selected ? `0 0 0 2px ${color}` : `0 0 12px ${color}33`,
        color,
      }}
      title={`${d.file} · refs=${d.referenceCount}${d.isExported ? " · exported" : ""}`}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6 }} />
      {d.label}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6 }} />
    </div>
  );
}
const nodeTypes = { phantom: PhantomNode };

export function HuntGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const order: Verdict[] = ["alive", "uncertain", "dead"];
    const col = (v: Verdict) => order.indexOf(v);
    const counters = [0, 0, 0];
    const verdictById = new Map(nodes.map((n) => [n.id, n.verdict]));

    const rfNodes: Node[] = nodes.map((n) => {
      const c = col(n.verdict);
      const y = counters[c]++ * 70;
      return {
        id: n.id,
        type: "phantom",
        position: { x: c * 280, y },
        data: {
          label: n.label,
          verdict: n.verdict,
          file: n.file,
          referenceCount: n.referenceCount,
          isExported: n.isExported,
          selected: n.id === selectedId,
        } as NodeData,
      };
    });

    const rfEdges: Edge[] = edges.map((e) => {
      const zombie = verdictById.get(e.target) === "dead";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: zombie,
        style: { stroke: zombie ? COLORS.dead : "#3f3f46", strokeOpacity: zombie ? 0.7 : 0.35, strokeWidth: 1.5 },
      };
    });
    return { rfNodes, rfEdges };
  }, [nodes, edges, selectedId]);

  return (
    <div className="h-[460px]">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, n) => onSelect(n.id)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2a1f3d" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={(n) => COLORS[(n.data as NodeData).verdict]} maskColor="rgba(0,0,0,0.7)" />
      </ReactFlow>
    </div>
  );
}
