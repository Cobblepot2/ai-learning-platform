import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <div
      className={`prose prose-stone max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-stone-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal ${
        compact ? "prose-sm prose-p:my-2 prose-ul:my-2" : ""
      }`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
