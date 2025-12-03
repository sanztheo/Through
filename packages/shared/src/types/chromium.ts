export interface ChromiumConfig {
  width?: number;
  height?: number;
  headless?: boolean;
  disable_default_args?: boolean;
}

export interface ChromiumInstance {
  id: string;
  url: string;
  port: number;
}
