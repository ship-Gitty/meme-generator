export type ImageCandidate = {
  url: string;
  title?: string;
  source: "template" | "giphy" | "imgflip";
};

export type TextStyle = {
  color: string;
  weight: "bold" | "regular";
  size: number;
  position: "top" | "bottom" | "top-bottom";
};
