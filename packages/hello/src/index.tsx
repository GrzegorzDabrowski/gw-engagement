import { useState } from "react";
import { createRoot } from "react-dom/client";

// Replaced at build time by esbuild --define with the version from package.json.
declare const __PKG_VERSION__: string;

type HelloProps = { name: string };

function Hello({ name }: HelloProps) {
  const [count, setCount] = useState(0);
  return (
    <div style={{ border: "2px dashed teal", padding: 12 }}>
      <p>
        Hello, {name}! (from @gw/hello v{__PKG_VERSION__})
      </p>
      <button onClick={() => setCount((c) => c + 1)}>clicked {count}×</button>
    </div>
  );
}

/**
 * Host-facing contract: the host gives us a DOM element, we own everything inside it.
 * The host never needs to know that React is used here.
 */
export function mount(el: HTMLElement, props: HelloProps): () => void {
  const root = createRoot(el);
  root.render(<Hello {...props} />);
  return () => root.unmount();
}
