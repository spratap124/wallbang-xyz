import { MDXRemote } from "next-mdx-remote/rsc";

const components = {
  h2: (props: React.ComponentProps<"h2">) => (
    <h2 className="mt-10 mb-4 text-2xl font-semibold tracking-tight" {...props} />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3 className="mt-8 mb-3 text-xl font-semibold" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="mb-4 leading-relaxed text-muted-foreground" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="mb-4 list-disc space-y-2 pl-5 text-muted-foreground" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="mb-4 list-decimal space-y-2 pl-5 text-muted-foreground" {...props} />
  ),
  li: (props: React.ComponentProps<"li">) => <li className="leading-relaxed" {...props} />,
  strong: (props: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a className="text-primary underline-offset-4 hover:underline" {...props} />
  ),
};

export function ArticleContent({ source }: { source: string }) {
  return (
    <div className="max-w-3xl">
      <MDXRemote source={source} components={components} />
    </div>
  );
}
