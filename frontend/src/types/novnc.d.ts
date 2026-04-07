declare module '@novnc/novnc/lib/rfb' {
  interface RFBOptions {
    credentials?: { password?: string };
    shared?: boolean;
    wsProtocols?: string[];
  }

  interface CredentialsEvent extends Event {
    detail: { types: string[] };
  }

  class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string, options?: RFBOptions);
    disconnect(): void;
    sendCredentials(credentials: { password: string }): void;
    scaleViewport: boolean;
    resizeSession: boolean;
    clipViewport: boolean;
    showDotCursor: boolean;
    viewportScale: number;
    qualityLevel: number;
    compressionLevel: number;
    viewOnly: boolean;
    focusOnClick: boolean;
  }

  export default RFB;
}
