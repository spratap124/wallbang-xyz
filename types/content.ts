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

export type ChangelogEntry = {
  id: string;
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export type BlogFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  tags: string[];
  draft?: boolean;
};

export type BlogPost = BlogFrontmatter & {
  slug: string;
  content: string;
  readingTime: string;
};
