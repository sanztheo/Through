"use client";

import React, { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

// Configure marked for safety and styling
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const htmlContent = useMemo(() => {
    if (!content) return "";
    
    try {
      const rawHtml = marked.parse(content) as string;
      // Sanitize HTML to prevent XSS (DOMPurify only works in browser)
      if (typeof window !== "undefined") {
        return DOMPurify.sanitize(rawHtml);
      }
      return rawHtml;
    } catch {
      return content;
    }
  }, [content]);

  if (!content) return null;

  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{
        // Basic markdown styling inline to avoid CSS conflicts
      }}
    />
  );
}
