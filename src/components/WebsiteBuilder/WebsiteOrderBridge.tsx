import { createContext, useContext, type ReactNode } from 'react';
import type { Catalogue } from '../../config/catalogueConfig';

export interface WebsiteOrderBridgeValue {
  currencySymbol: string;
  catalogue: Catalogue | null;
  sellerFieldsDefinition: unknown;
  getProductQty: (productId: string) => number;
  changeProductQty: (productId: string, delta: number, qstep: number) => void;
  getVariantSelection: (productId: string) => Record<string, string>;
  setVariantSelection: (productId: string, groupId: string, option: string) => void;
  hasVariantError: (productId: string) => boolean;
}

const WebsiteOrderBridgeContext = createContext<WebsiteOrderBridgeValue | null>(null);

export function WebsiteOrderBridgeProvider({
  value,
  children,
}: {
  value: WebsiteOrderBridgeValue;
  children: ReactNode;
}) {
  return <WebsiteOrderBridgeContext.Provider value={value}>{children}</WebsiteOrderBridgeContext.Provider>;
}

export function useWebsiteOrderBridge(): WebsiteOrderBridgeValue | null {
  return useContext(WebsiteOrderBridgeContext);
}
