import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Catalogue } from '../../config/catalogueConfig';
import {
  WebsiteOrderBridgeProvider,
  type WebsiteOrderBridgeValue,
} from '../WebsiteBuilder/WebsiteOrderBridge';

interface BuilderProductPreviewBridgeProps {
  currencySymbol: string;
  catalogue: Catalogue | null;
  sellerFieldsDefinition?: unknown;
  children: ReactNode;
}

/** Local qty/variant state for product page preview inside the homepage editor. */
export default function BuilderProductPreviewBridge({
  currencySymbol,
  catalogue,
  sellerFieldsDefinition,
  children,
}: BuilderProductPreviewBridgeProps) {
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [variantMap, setVariantMap] = useState<Record<string, Record<string, string>>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, boolean>>({});

  const getProductQty = useCallback((productId: string) => qtyMap[productId] ?? 0, [qtyMap]);

  const changeProductQty = useCallback((productId: string, delta: number) => {
    setQtyMap((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] ?? 0) + delta),
    }));
  }, []);

  const getVariantSelection = useCallback(
    (productId: string) => variantMap[productId] ?? {},
    [variantMap]
  );

  const setVariantSelection = useCallback((productId: string, groupId: string, option: string) => {
    setVariantMap((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? {}), [groupId]: option },
    }));
    setVariantErrors((prev) => ({ ...prev, [productId]: false }));
  }, []);

  const hasVariantError = useCallback((productId: string) => !!variantErrors[productId], [variantErrors]);

  const value = useMemo<WebsiteOrderBridgeValue>(
    () => ({
      currencySymbol,
      catalogue,
      sellerFieldsDefinition,
      getProductQty,
      changeProductQty,
      getVariantSelection,
      setVariantSelection,
      hasVariantError,
    }),
    [
      currencySymbol,
      catalogue,
      sellerFieldsDefinition,
      getProductQty,
      changeProductQty,
      getVariantSelection,
      setVariantSelection,
      hasVariantError,
    ]
  );

  return <WebsiteOrderBridgeProvider value={value}>{children}</WebsiteOrderBridgeProvider>;
}
