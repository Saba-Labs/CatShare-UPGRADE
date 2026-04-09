import { registerPlugin, WebPlugin } from '@capacitor/core';

export interface OpenInvoicePdfPlugin {
  openFile(options: { path: string }): Promise<void>;
  shareFile(options: {
    path: string;
    dialogTitle?: string;
    title?: string;
    text?: string;
  }): Promise<void>;
}

class OpenInvoicePdfWeb extends WebPlugin implements OpenInvoicePdfPlugin {
  async openFile(): Promise<void> {}
  async shareFile(): Promise<void> {}
}

export const OpenInvoicePdf = registerPlugin<OpenInvoicePdfPlugin>('OpenInvoicePdf', {
  web: () => new OpenInvoicePdfWeb(),
});
