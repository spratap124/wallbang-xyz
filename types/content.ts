export type FeatureItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type RoadmapPhase = {
  id: string;
  phase: string;
  title: string;
  status: "planned" | "in-progress" | "completed";
  items: string[];
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};
