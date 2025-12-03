// Electron webview type declarations for React
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        nodeintegration?: string;
        disablewebsecurity?: string;
        partition?: string;
        allowpopups?: string;
        preload?: string;
        useragent?: string;
      },
      HTMLElement
    >;
  }
}
