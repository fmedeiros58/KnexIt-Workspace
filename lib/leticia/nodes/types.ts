export type Msg = { role: "user"|"assistant"|"system"; content: string };
export type NodeSpec = {
  id: string;
  title: string;
  system: string;
  keywords: string[];
  preHints?: string[];
};
