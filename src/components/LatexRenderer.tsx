import React from "react";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";

export const LatexRenderer = ({ children }: { children: string }) => {
  return (
    <span className="latex-container">
      <Latex>{children}</Latex>
    </span>
  );
};
