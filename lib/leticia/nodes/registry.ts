import { NodeSpec } from "./types";
import { MathNode } from "./math";
import { TeachingNode } from "./teaching";

const ALL: NodeSpec[] = [MathNode, TeachingNode];
export function listNodes() { return ALL; }
export function getNode(id: string) { return ALL.find(n => n.id === id); }
